// PROJ-8 — Editor calculator type.
//
// Mirrors the public `calculators` row shape that PROJ-8's backend migration
// creates. The generated Supabase types (`src/lib/supabase/types.ts`) will
// add the row to `Database['public']['Tables']['calculators']` once the
// migration lands; until then the editor uses this local type as the
// single source of truth.

import type { CellRow } from '@/lib/cells/types';
import type { ChartRow } from '@/lib/charts/types';
import type { SectionRow } from '@/lib/sections/types';

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

// PROJ-11 — Public calculator shape served by the SECURITY DEFINER RPC
// `fn_get_public_calculator(p_token)`. Sections carry their cells already;
// the visitor surface does not fan out additional fetches.
//
// Sections lose `calculator_id`, `created_at`, `updated_at` (not needed for
// the read-only render). Cells lose `calculator_id`, `section_id`,
// `created_at`, `updated_at` (same reason — the section already groups
// them, and ordering is stable via `display_order`).

export type PublicSectionCell = Omit<
  CellRow,
  'calculator_id' | 'section_id' | 'created_at' | 'updated_at'
>;

// PROJ-15 — Charts ride along with their parent section in the visitor RPC
// payload. Same omit shape as cells: calculator_id + section_id + audit
// timestamps are redundant for a read-only render.
export type PublicSectionChart = Omit<
  ChartRow,
  'calculator_id' | 'section_id' | 'created_at' | 'updated_at'
>;

export type PublicSection = Omit<
  SectionRow,
  'calculator_id' | 'created_at' | 'updated_at'
> & {
  cells: PublicSectionCell[];
  charts: PublicSectionChart[];
};

/**
 * What `fetchPublicCalculator(token)` returns. Discriminated on `status`
 * so the page / route handler can branch on 200 vs 410 cleanly. `null` is
 * never returned for a "found-but-soft-deleted" calculator; instead the
 * fetcher surfaces `status: 'gone'` so the route handler can return 410.
 *
 *   - 'ok'   → render the calculator at /c/<token>
 *   - 'gone' → soft-deleted; route handler responds 410
 *   - null   → no row matches the token; page responds 404
 */
export interface PublicCalculator {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  theme_id: string;
  public_token: string;
  published: boolean;
  updated_at: string;
  sections: PublicSection[];
}

export type PublicCalculatorFetchResult =
  | { status: 'ok'; calculator: PublicCalculator }
  | { status: 'gone'; soft_delete_at: string }
  | null;

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
