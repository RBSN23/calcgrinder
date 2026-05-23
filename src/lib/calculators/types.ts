// PROJ-8 — Editor calculator type.
//
// Mirrors the public `calculators` row shape that PROJ-8's backend migration
// creates. The generated Supabase types (`src/lib/supabase/types.ts`) will
// add the row to `Database['public']['Tables']['calculators']` once the
// migration lands; until then the editor uses this local type as the
// single source of truth.

export const MAX_TITLE_LENGTH = 100;

export const DEFAULT_TITLE = 'Untitled calculator';

export interface CalculatorRow {
  id: string;
  title: string;
  description: string;
  theme_id: string;
  updated_at: string;
  // PROJ-10 — lifecycle columns. `published` is the author's
  // intent to expose the calculator; `public_token` is the
  // stable, rotatable URL slug at `/c/<token>`.
  published: boolean;
  public_token: string;
}

export type TitleValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'title_required' | 'title_too_long' };

/**
 * Pure helper used by the breadcrumb input + the PATCH wrapper. Trims and
 * validates the proposed title against the same rules the database check
 * constraint enforces (`length(trim(title)) BETWEEN 1 AND 100`).
 */
export function validateTitle(raw: string): TitleValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'title_required' };
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return { ok: false, reason: 'title_too_long' };
  }
  return { ok: true, value: trimmed };
}
