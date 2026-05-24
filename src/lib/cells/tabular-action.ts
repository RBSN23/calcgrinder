// PROJ-17 BUG-M1 / BUG-M2 — Helpers for bundling tabular_columns
// reconciliation into the user-action PATCH that triggered it.
//
// Before this helper existed, the auto-pop / smart-merge logic ran as
// a `useEffect` side-effect in `cell-card.tsx`: the user's formula
// commit issued one PATCH (formula only), the effect observed the
// new shape, and issued a SECOND PATCH for the column delta. Two
// PATCHes meant two `recordOperation` entries — Cmd-Z reverted only
// the column delta, leaving the formula in place. Worse, Cmd-Z'ing
// the empty-columns state allowed the effect to re-fire and re-seed,
// trapping the user in a snap-back loop (BUG-M2).
//
// `computeTabularActionPatch` runs at the user-action site (the
// formula-commit handler in `grid-column.tsx`, the emphasis-switch
// onPatch interceptor in `cell-card.tsx`) and returns the additive
// PATCH fields that should be merged into the user's call. The
// caller issues ONE `patchCell({ formula, ...tabularPatch })` →
// ONE undo entry that reverts everything atomically.
//
// `evaluateSpeculative` evaluates the calculator with the target
// cell's formula swapped for a candidate string. The formula-commit
// handler uses it to predict the new result BEFORE the PATCH lands,
// so the column reconciliation runs against the new shape.

import {
  evaluateCalculator,
  type Cell as EngineCell,
  type CellResult,
  type Inputs,
} from '@/lib/formula';

import {
  reconcileTabularColumns,
  seedTabularColumns,
} from './tabular-reconcile';
import type { CellDisplayEmphasis, CellRow, TabularColumn } from './types';

export interface TabularActionPatch {
  tabular_columns?: TabularColumn[];
  display_emphasis?: 'tabular';
  card_size_hint?: 'wide';
}

interface ComputeTabularActionPatchArgs {
  /** The cell as it exists pre-PATCH (old formula, old emphasis). */
  cell: CellRow;
  /** The emphasis the cell will have after the user's PATCH lands. */
  nextEmphasis: CellDisplayEmphasis;
  /**
   * The engine result evaluated against the cell's NEXT state — i.e.
   * the result of the new formula (for formula commits) or the result
   * of the existing formula under the new emphasis (for emphasis
   * switches). When undefined / errored / non-array, the helper
   * returns an empty patch and the user's PATCH is unchanged.
   */
  result: CellResult | undefined;
}

/**
 * Compute the additive `tabular_columns` / `display_emphasis` /
 * `card_size_hint` fields that should accompany a user-action PATCH
 * so the change lands in ONE undo entry. Returns an empty object
 * when no tabular-related update is needed.
 *
 * Semantics mirror the pre-existing `useTabularAutoPopulation` hook
 * verbatim — first-time seed + emphasis-promotion (BUG-H1) + size
 * bump, OR smart-merge reconciliation when columns already exist —
 * only restructured so the work happens at the user-action site.
 */
export function computeTabularActionPatch(
  args: ComputeTabularActionPatchArgs,
): TabularActionPatch {
  const { cell, nextEmphasis, result } = args;
  if (cell.kind !== 'output') return {};
  if (!result || result.error) return {};
  if (result.shape !== 'array_of_objects') return {};
  const rows = Array.isArray(result.value) ? result.value : [];
  if (rows.length === 0) return {};
  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== 'object') return {};
  const firstRowAsRecord = firstRow as Record<string, unknown>;

  const tabularBranchActive =
    nextEmphasis === 'tabular' ||
    (nextEmphasis === 'plain' && (cell.tabular_columns ?? []).length === 0);
  if (!tabularBranchActive) return {};

  const existing = cell.tabular_columns ?? [];

  // First-time seed: promote emphasis to 'tabular' (the BUG-H1 fix),
  // seed columns from the first row, bump card_size_hint narrow → wide.
  if (existing.length === 0) {
    const patch: TabularActionPatch = {
      tabular_columns: seedTabularColumns(firstRowAsRecord),
    };
    if (nextEmphasis === 'plain') {
      patch.display_emphasis = 'tabular';
    }
    if (cell.card_size_hint === 'narrow') {
      patch.card_size_hint = 'wide';
    }
    return patch;
  }

  // Smart-merge: reconcile column config against new first-row keys.
  // No-op when ids + order already match (avoids spurious PATCH on a
  // commit that didn't shift the row shape).
  const reconciled = reconcileTabularColumns({
    prev: existing,
    firstRow: firstRowAsRecord,
  });
  if (sameColumnIdsAndOrder(existing, reconciled)) return {};
  return { tabular_columns: reconciled };
}

function sameColumnIdsAndOrder(
  a: TabularColumn[],
  b: TabularColumn[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

/**
 * Evaluate the calculator with one cell's formula speculatively
 * replaced by a candidate string. Used by the Grid formula-commit
 * handler to predict the new evaluation result before issuing the
 * PATCH, so `computeTabularActionPatch` can reconcile against the
 * NEW row shape (not the OLD result).
 */
export function evaluateSpeculative(
  cells: CellRow[],
  inputs: Inputs,
  cellId: string,
  candidateFormula: string,
): CellResult | undefined {
  const engineCells = cells.map((c) =>
    c.id === cellId
      ? toEngineCellWithFormula(c, candidateFormula)
      : toEngineCell(c),
  );
  const results = evaluateCalculator(engineCells, inputs);
  const targetCell = cells.find((c) => c.id === cellId);
  return targetCell ? results[targetCell.name] : undefined;
}

function toEngineCell(c: CellRow): EngineCell {
  if (c.kind === 'input') {
    return {
      name: c.name,
      kind: 'input',
      input_type:
        c.value_type === 'select'
          ? 'text'
          : (c.value_type as EngineCell['input_type']),
      default_value: c.default_value ?? undefined,
    };
  }
  return { name: c.name, kind: 'output', formula: c.formula ?? '' };
}

function toEngineCellWithFormula(
  c: CellRow,
  formula: string,
): EngineCell {
  if (c.kind === 'input') {
    // Inputs don't have formulas — caller error; return as-is so the
    // engine ignores the candidate. (computeTabularActionPatch will
    // bail anyway since kind !== 'output'.)
    return toEngineCell(c);
  }
  return { name: c.name, kind: 'output', formula };
}
