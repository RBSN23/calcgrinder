// PROJ-9 — Section type.
//
// Mirrors the public.sections row shape. See the migration at
// supabase/migrations/20260524120000_sections_and_cells.sql.

export const MAX_SECTION_TITLE_LENGTH = 100;

export const DEFAULT_SECTION_TITLE = 'Section 1';
export const NEW_SECTION_TITLE = 'New section';

export interface SectionRow {
  id: string;
  calculator_id: string;
  title: string;
  description: string;
  layout_pattern_id: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type SectionTitleValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'title_required' | 'title_too_long' };

/**
 * Pure helper used by the section header input + the PATCH wrapper.
 * Trims and validates the proposed title against the same rules the
 * database check constraint enforces (`length(trim(title)) BETWEEN 1 AND 100`).
 */
export function validateSectionTitle(raw: string): SectionTitleValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'title_required' };
  if (trimmed.length > MAX_SECTION_TITLE_LENGTH) {
    return { ok: false, reason: 'title_too_long' };
  }
  return { ok: true, value: trimmed };
}
