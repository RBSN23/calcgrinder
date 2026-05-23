import 'server-only';

import type { CellRow } from '@/lib/cells/types';
import type { SectionRow } from '@/lib/sections/types';
import { DEFAULT_SECTION_TITLE } from '@/lib/sections/types';
import { createClient } from '@/lib/supabase/server';

import type { CalculatorRow } from './types';

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface EditorBundle {
  calculator: CalculatorRow;
  sections: SectionRow[];
  cells: CellRow[];
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
      'id, calculator_id, section_id, kind, name, label, description, description_render, value_type, visibility, editability, default_value, formula, display_widget, display_format, display_emphasis, unit, numeric_min, numeric_max, numeric_step, select_options, currency_code, card_accent, card_background_tint, card_border, card_size_hint, text_size, text_colour, display_order, created_at, updated_at',
    )
    .eq('calculator_id', id)
    .order('section_id', { ascending: true })
    .order('display_order', { ascending: true });

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
    cells: (cells ?? []) as CellRow[],
  };
}
