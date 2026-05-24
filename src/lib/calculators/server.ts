import 'server-only';

import type { CellRow } from '@/lib/cells/types';
import type { ChartRow } from '@/lib/charts/types';
import type { SectionRow } from '@/lib/sections/types';
import { DEFAULT_SECTION_TITLE } from '@/lib/sections/types';
import { createClient } from '@/lib/supabase/server';
import type { TextBlockRow } from '@/lib/text-blocks/types';

import type { CalculatorRow } from './types';

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface EditorBundle {
  calculator: CalculatorRow;
  sections: SectionRow[];
  cells: CellRow[];
  charts: ChartRow[];
  textBlocks: TextBlockRow[];
}

/**
 * PROJ-10 — walk `base`, `base (2)`, `base (3)`, … until the first free
 * `(owner_id, title)` slot for the owner across the active set (soft-deleted
 * rows are excluded by the partial unique index). Used by:
 *   - `POST /api/calculators` so the default "Untitled calculator" never
 *     surfaces a 409 to the user; and
 *   - the migration's dedupe-backfill (which inlines the same algorithm
 *     in PL/pgSQL).
 * (The duplicate stored procedure inlines the same loop in PL/pgSQL.)
 *
 * Capped at 100 attempts to bound the worst case; on exhaustion returns
 * `null` so the caller can surface a 500 with a clear log line.
 */
export const TITLE_AUTORESOLVE_LIMIT = 100;

export async function resolveUniqueTitle(
  supabase: ServerSupabaseClient,
  ownerId: string,
  base: string,
): Promise<string | null> {
  let attempt = 1;
  let candidate = base;
  while (attempt <= TITLE_AUTORESOLVE_LIMIT) {
    const { data, error } = await supabase
      .from('calculators')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('title', candidate)
      .is('soft_delete_at', null)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('resolveUniqueTitle: lookup failed', error);
      return null;
    }
    if (!data) return candidate;
    attempt += 1;
    candidate = `${base} (${attempt})`;
  }
  return null;
}

/**
 * Fetches a calculator row for the editor's server-side page load. Returns
 * `null` when the row doesn't exist, is owned by someone else, or has been
 * soft-deleted — the editor page collapses all three into a single 404 so
 * an attacker cannot enumerate IDs across owners.
 *
 * The query runs through the cookie-bound publishable-key client, so
 * Row-Level Security (defined in the PROJ-8 migration) scopes the row to
 * `auth.uid()` automatically. The `soft_delete_at IS NULL` filter is added
 * explicitly because RLS does not gate soft-deleted rows from their owner
 * — Trash recovery in PROJ-13 needs to read them via a separate endpoint.
 */
/**
 * PROJ-10 — Server-side fetch of the current user's My Calculators
 * list. Returns non-soft-deleted rows in `updated_at DESC` order.
 * Backed by the `idx_calculators_owner_updated_at_desc` index from
 * PROJ-8. Defensive `LIMIT 100` per the spec (PRD scope is dozens,
 * not thousands). RLS scopes by owner automatically.
 */
const ROW_COLUMNS =
  'id, title, description, theme_id, updated_at, published, public_token' as const;

export async function listMyCalculators(): Promise<CalculatorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('calculators')
    .select(ROW_COLUMNS)
    .is('soft_delete_at', null)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    theme_id: row.theme_id,
    updated_at: row.updated_at,
    published: row.published,
    public_token: row.public_token,
  }));
}

/**
 * PROJ-13 — current user's soft-deleted calculators for the Trash
 * section. Ordered `soft_delete_at DESC` (most recently deleted first)
 * via `idx_calculators_owner_soft_delete`. RLS scopes by owner.
 * Returns the lifecycle-row shape with `soft_delete_at` so the card
 * can compute the "Deleted N days ago · Purges in M days" footer.
 */
export interface TrashedCalculatorRow extends CalculatorRow {
  soft_delete_at: string;
}

const TRASH_ROW_COLUMNS = `${ROW_COLUMNS}, soft_delete_at` as const;

export async function listMySoftDeletedCalculators(): Promise<
  TrashedCalculatorRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('calculators')
    .select(TRASH_ROW_COLUMNS)
    .not('soft_delete_at', 'is', null)
    .order('soft_delete_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data
    .map((row): TrashedCalculatorRow | null => {
      if (typeof row.soft_delete_at !== 'string') return null;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        theme_id: row.theme_id,
        updated_at: row.updated_at,
        published: row.published,
        public_token: row.public_token,
        soft_delete_at: row.soft_delete_at,
      };
    })
    .filter((r): r is TrashedCalculatorRow => r !== null);
}

/**
 * PROJ-18 — server-side fetch of the curated Presets list for the
 * dashboard. Backed by the SECURITY DEFINER `fn_list_presets` RPC
 * (owner-only RLS on `calculators` blocks cross-user reads, so the
 * visibility rule lives inside the function: sysadmin owner +
 * published + not soft-deleted). Returns the full preset shape;
 * `<CalcCard variant='preset'>` only consumes the CalculatorRow
 * subset, the rest is forward-compat for the deferred attribution
 * banner.
 *
 * Failure handling mirrors `listMyCalculators` — a transient RPC
 * error degrades to an empty array + `console.error`, so the
 * dashboard renders the empty-state body instead of crashing.
 */
export interface PresetCalculatorRow extends CalculatorRow {
  owner_id: string;
  owner_name: string;
}

export async function listPresets(): Promise<PresetCalculatorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_list_presets');
  if (error || !data) {
    if (error) console.error('listPresets: RPC failed', error);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    theme_id: row.theme_id,
    updated_at: row.updated_at,
    published: row.published,
    public_token: row.public_token,
    owner_id: row.owner_id,
    owner_name: row.owner_name ?? '',
  }));
}

export async function getCalculatorForEditor(
  id: string,
): Promise<CalculatorRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('calculators')
    .select(ROW_COLUMNS)
    .eq('id', id)
    .is('soft_delete_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    theme_id: data.theme_id,
    updated_at: data.updated_at,
    published: data.published,
    public_token: data.public_token,
  };
}

/**
 * PROJ-9 — fetch calculator + sections + cells in one server-side pass
 * for the editor route. Runs the zero-section backfill (default
 * "Section 1") transparently for calculators created before PROJ-9
 * shipped. Returns `null` when the calculator is missing / not owned /
 * soft-deleted (same 404 collapse as `getCalculatorForEditor`).
 */
export async function getEditorBundle(
  id: string,
): Promise<EditorBundle | null> {
  const calculator = await getCalculatorForEditor(id);
  if (!calculator) return null;

  const supabase = await createClient();

  let { data: sections } = await supabase
    .from('sections')
    .select(
      'id, calculator_id, title, description, layout_pattern_id, display_order, created_at, updated_at',
    )
    .eq('calculator_id', id)
    .order('display_order', { ascending: true });

  // Backfill: legacy calculators created in PROJ-8 have no sections.
  if (!sections || sections.length === 0) {
    const { data: created } = await supabase
      .from('sections')
      .insert({
        calculator_id: id,
        title: DEFAULT_SECTION_TITLE,
        description: '',
        layout_pattern_id: 'single_column',
        display_order: 0,
      })
      .select(
        'id, calculator_id, title, description, layout_pattern_id, display_order, created_at, updated_at',
      )
      .single();
    sections = created ? [created] : [];
  }

  const { data: cells } = await supabase
    .from('cells')
    .select(
      // PROJ-17 — `tabular_columns` is included so the editor doesn't
      // hydrate with `undefined` columns and then phantom-seed on
      // every mount (which would clobber the persisted config + drop
      // an unwanted PATCH into the undo stack). Audit surface per
      // the BUG-H2 maintenance contract: cell-column enumeration
      // must stay in sync across server.ts (editor bundle),
      // fn_get_public_calculator + fn_get_scenario_by_share_token
      // (read RPCs), and fn_duplicate_calculator (write RPC).
      'id, calculator_id, section_id, kind, name, label, description, description_render, value_type, visibility, editability, default_value, formula, display_widget, display_format, display_emphasis, unit, numeric_min, numeric_max, numeric_step, select_options, currency_code, card_accent, card_background_tint, card_border, card_size_hint, text_size, text_colour, tabular_columns, display_order, created_at, updated_at',
    )
    .eq('calculator_id', id)
    .order('section_id', { ascending: true })
    .order('display_order', { ascending: true });

  // PROJ-15 — charts ride alongside cells in the editor bundle so a page
  // reload restores the canvas verbatim (without this, charts created in
  // a session vanish on refresh — QA BUG-C2).
  const { data: charts } = await supabase
    .from('charts')
    .select(
      'id, calculator_id, section_id, name, chart_type, title, subtitle, bindings, style, card_accent, card_background_tint, card_border, card_size_hint, display_order, created_at, updated_at',
    )
    .eq('calculator_id', id)
    .order('section_id', { ascending: true })
    .order('display_order', { ascending: true });

  // PROJ-16 — text blocks ride alongside cells/charts in the editor
  // bundle for the same reload-restore reason.
  const { data: textBlocksRaw } = await supabase
    .from('text_blocks')
    .select(
      'id, calculator_id, section_id, body, card_accent, card_background_tint, card_border, card_size_hint, text_size, text_colour, display_order, created_at, updated_at',
    )
    .eq('calculator_id', id)
    .order('section_id', { ascending: true })
    .order('display_order', { ascending: true });
  const textBlocks = (textBlocksRaw ?? []) as unknown as TextBlockRow[];

  // The section backfill bumped calculators.updated_at via the
  // parent-bump trigger — refresh the token so the client doesn't
  // immediately see a 409 on its first PATCH.
  let refreshedUpdatedAt = calculator.updated_at;
  if (sections && sections.length > 0) {
    const { data: refreshed } = await supabase
      .from('calculators')
      .select('updated_at')
      .eq('id', id)
      .maybeSingle();
    if (refreshed?.updated_at) refreshedUpdatedAt = refreshed.updated_at;
  }

  return {
    calculator: { ...calculator, updated_at: refreshedUpdatedAt },
    sections: (sections ?? []) as SectionRow[],
    cells: (cells ?? []) as unknown as CellRow[],
    charts: (charts ?? []) as unknown as ChartRow[],
    textBlocks,
  };
}
