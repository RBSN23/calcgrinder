// PROJ-12 — localStorage scenario store (anonymous visitors).
//
// One key per calculator: `cg:scenarios:<calculator-public-token>`.
// Value is a JSON array of `LocalScenario` records, most-recently-saved
// first. All helpers degrade silently when localStorage is unavailable
// (SSR, private mode rejecting writes) — the visitor sees the in-memory
// list only and the next save fires the QuotaExceededError CTA.

import type { LocalScenario, ScenarioValues } from './types';

export const SCENARIO_KEY_PREFIX = 'cg:scenarios:';

export class LocalScenarioQuotaError extends Error {
  constructor() {
    super('localStorage quota exceeded');
    this.name = 'LocalScenarioQuotaError';
  }
}

function isAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function keyFor(calculatorPublicToken: string): string {
  return `${SCENARIO_KEY_PREFIX}${calculatorPublicToken}`;
}

function safeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers; not cryptographic but unique enough.
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function listLocalScenarios(
  calculatorPublicToken: string,
): LocalScenario[] {
  if (!isAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(calculatorPublicToken));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLocalScenario).sort((a, b) =>
      b.saved_at.localeCompare(a.saved_at),
    );
  } catch {
    return [];
  }
}

export interface SaveLocalScenarioInput {
  calculatorPublicToken: string;
  /** When set, overwrite the row with this id (selected row in sheet). */
  overwriteId?: string;
  title: string;
  description: string;
  values: ScenarioValues;
}

export interface SaveLocalScenarioResult {
  scenario: LocalScenario;
  overwritten: boolean;
}

export function saveLocalScenario(
  input: SaveLocalScenarioInput,
): SaveLocalScenarioResult {
  if (!isAvailable()) {
    throw new Error('localStorage unavailable');
  }
  const existing = listLocalScenarios(input.calculatorPublicToken);
  let overwritten = false;
  const now = new Date().toISOString();
  let next: LocalScenario;
  let nextList: LocalScenario[];
  if (input.overwriteId) {
    const idx = existing.findIndex((s) => s.id === input.overwriteId);
    if (idx >= 0) {
      overwritten = true;
      next = {
        id: existing[idx].id,
        title: input.title,
        description: input.description,
        values: input.values,
        saved_at: now,
      };
      nextList = existing.slice();
      nextList[idx] = next;
    } else {
      next = {
        id: safeUuid(),
        title: input.title,
        description: input.description,
        values: input.values,
        saved_at: now,
      };
      nextList = [next, ...existing];
    }
  } else {
    next = {
      id: safeUuid(),
      title: input.title,
      description: input.description,
      values: input.values,
      saved_at: now,
    };
    nextList = [next, ...existing];
  }
  try {
    window.localStorage.setItem(
      keyFor(input.calculatorPublicToken),
      JSON.stringify(nextList),
    );
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22)
    ) {
      throw new LocalScenarioQuotaError();
    }
    throw err;
  }
  return { scenario: next, overwritten };
}

export function deleteLocalScenario(
  calculatorPublicToken: string,
  scenarioId: string,
): void {
  if (!isAvailable()) return;
  const existing = listLocalScenarios(calculatorPublicToken);
  const next = existing.filter((s) => s.id !== scenarioId);
  try {
    if (next.length === 0) {
      window.localStorage.removeItem(keyFor(calculatorPublicToken));
    } else {
      window.localStorage.setItem(
        keyFor(calculatorPublicToken),
        JSON.stringify(next),
      );
    }
  } catch {
    // Ignore — best-effort delete.
  }
}

/** Walk every `cg:scenarios:*` key. Returns a flat list of
 * `{ calculatorPublicToken, scenarios }` for the migration helper. */
export interface LocalScenarioBundle {
  calculatorPublicToken: string;
  scenarios: LocalScenario[];
}

export function collectAllLocalScenarios(): LocalScenarioBundle[] {
  if (!isAvailable()) return [];
  const bundles: LocalScenarioBundle[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(SCENARIO_KEY_PREFIX)) continue;
      const token = k.slice(SCENARIO_KEY_PREFIX.length);
      const scenarios = listLocalScenarios(token);
      if (scenarios.length > 0) {
        bundles.push({ calculatorPublicToken: token, scenarios });
      }
    }
  } catch {
    return bundles;
  }
  return bundles;
}

export function clearLocalScenarios(calculatorPublicToken: string): void {
  if (!isAvailable()) return;
  try {
    window.localStorage.removeItem(keyFor(calculatorPublicToken));
  } catch {
    // ignore
  }
}

function isLocalScenario(value: unknown): value is LocalScenario {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.description === 'string' &&
    typeof v.saved_at === 'string' &&
    typeof v.values === 'object' &&
    v.values !== null
  );
}
