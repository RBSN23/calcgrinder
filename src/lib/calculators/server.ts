import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { CellRow } from '@/lib/cells/types';
import type { SectionRow } from '@/lib/sections/types';
import { DEFAULT_SECTION_TITLE } from '@/lib/sections/types';

import type { CalculatorRow } from './types';

export interface EditorBundle {
  calculator: CalculatorRow;
  sections: SectionRow[];
  cells: CellRow[];
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
export async function getCalculatorForEditor(
  id: string,
): Promise<CalculatorRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('calculators')
    .select('id, title, description, theme_id, updated_at')
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
