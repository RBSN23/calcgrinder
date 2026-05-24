// PROJ-12 — Scenario types.
//
// A scenario is one row from the `scenarios` table (registered users)
// or one entry in localStorage (anonymous visitors). Both shapes share
// the same logical fields; localStorage adds `saved_at` and skips the
// server-only `share_token`.

export const MAX_SCENARIO_TITLE_LENGTH = 200;
export const MAX_SCENARIO_DESCRIPTION_LENGTH = 2000;

/** Full input snapshot keyed by cell name. */
export type ScenarioValues = Record<string, unknown>;

/** Server-side scenario row (mirrors the `scenarios` table). */
export interface ScenarioRow {
  id: string;
  calculator_id: string | null;
  owner_id: string;
  title: string;
  description: string;
  values: ScenarioValues;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

/** Server-side scenario row joined with parent calculator info — used
 * by the dashboard My Scenarios list. */
export interface ScenarioRowWithCalc extends ScenarioRow {
  calculator: {
    id: string | null;
    title: string;
    public_token: string | null;
    soft_delete_at: string | null;
  } | null;
}

/** Anonymous localStorage row. `id` is a client-generated UUID, never
 * reused on the server (migration creates fresh server IDs). */
export interface LocalScenario {
  id: string;
  title: string;
  description: string;
  values: ScenarioValues;
  saved_at: string;
}

export type TitleValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'title_required' | 'title_too_long' };

export function validateScenarioTitle(raw: string): TitleValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'title_required' };
  if (trimmed.length > MAX_SCENARIO_TITLE_LENGTH) {
    return { ok: false, reason: 'title_too_long' };
  }
  return { ok: true, value: trimmed };
}

export function validateScenarioDescription(raw: string): boolean {
  return raw.length <= MAX_SCENARIO_DESCRIPTION_LENGTH;
}
