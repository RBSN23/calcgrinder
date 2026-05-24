// PROJ-12 — Scenario value application + structure-drift detection.
//
// Scenarios store `values` keyed by **cell name** (the user-meaningful
// stable identifier from PROJ-9). When the parent calculator is
// edited after the scenario was saved, some keys may no longer match
// any current cell — that's a "drift skip". Two skip reasons:
//
//   - rename / removal: the saved cell name is missing from the
//     current calculator entirely.
//   - type-change: the saved value type doesn't match what the cell
//     now expects (a strict comparison — see `valueMatchesType`).
//
// Adding a brand-new cell since the save does NOT trigger drift;
// the new cell just uses its calculator default.

import type { CellRow } from '@/lib/cells/types';
import type { PublicSectionCell } from '@/lib/calculators/types';

import type { ScenarioValues } from './types';

type AnyCell = CellRow | PublicSectionCell;

export interface ScenarioApplyResult {
  /** Filtered map containing only the saved values that successfully
   * applied — i.e. the cell still exists AND the value type still
   * matches. This is what gets seeded into `<VisitorInputProvider>`. */
  appliedInputs: ScenarioValues;
  /** True when at least one saved value was skipped due to rename /
   * removal / type-change. Drives the structure-drift banner. */
  hasDrift: boolean;
  /** Names of saved values that were skipped (for debugging). */
  skippedNames: string[];
}

export function applyScenarioValues(
  cells: readonly AnyCell[],
  savedValues: ScenarioValues,
): ScenarioApplyResult {
  const cellsByName = new Map<string, AnyCell>();
  for (const cell of cells) {
    cellsByName.set(cell.name, cell);
  }
  const appliedInputs: ScenarioValues = {};
  const skippedNames: string[] = [];
  for (const [name, value] of Object.entries(savedValues)) {
    const cell = cellsByName.get(name);
    if (!cell) {
      skippedNames.push(name);
      continue;
    }
    if (cell.kind !== 'input') {
      // Output cells stored under their own name (editable Outputs in
      // PROJ-9 can be overridden) — same lookup rules apply, but only
      // editable cells accept overrides on apply. Readonly outputs
      // count as drift (the override no longer matches anything we
      // can apply).
      if (cell.editability !== 'editable') {
        skippedNames.push(name);
        continue;
      }
    }
    if (!valueMatchesType(value, cell.value_type)) {
      skippedNames.push(name);
      continue;
    }
    appliedInputs[name] = value;
  }
  return {
    appliedInputs,
    hasDrift: skippedNames.length > 0,
    skippedNames,
  };
}

/**
 * Strict value/type match. Stored JSON is widened to JS primitives by
 * `JSON.parse`, so dates land as ISO strings; we accept either a
 * string (ISO) or a Date instance for `date`. Booleans, numbers, and
 * strings each require their exact JS type. `null` always passes —
 * a null saved value means "no override" rather than a skip.
 */
function valueMatchesType(value: unknown, valueType: string): boolean {
  if (value === null || value === undefined) return true;
  switch (valueType) {
    case 'number':
    case 'currency':
    case 'percent':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      if (value instanceof Date) return !Number.isNaN(value.getTime());
      return typeof value === 'string';
    case 'select':
    case 'text':
      return typeof value === 'string';
    default:
      return true;
  }
}

/**
 * Compute the "modified" condition for a visitor surface — true if any
 * current input differs from the loaded baseline.
 *
 * The baseline is what was applied on initial page-load (scenario
 * values on `?s=` URLs, defaults on bare URLs). The current `inputs`
 * map merges the baseline with the visitor's typed-in changes. We
 * compare each baseline key AND each current-inputs key so a value
 * deleted (set back to `undefined`) still counts.
 */
export function isInputsModifiedFromBaseline(
  baseline: ScenarioValues,
  inputs: ScenarioValues,
): boolean {
  const keys = new Set<string>([
    ...Object.keys(baseline),
    ...Object.keys(inputs),
  ]);
  for (const k of keys) {
    if (!shallowEqual(baseline[k], inputs[k])) return true;
  }
  return false;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  // Compare arrays / plain JSON objects by stringified form. Scenario
  // values are always JSON primitives or short arrays — JSON.stringify
  // is fine here.
  if (typeof a === typeof b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}
