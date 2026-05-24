// PROJ-17 — Tabular-columns reconciliation helpers.
//
// Pure functions consumed by `cell-card.tsx`'s formula-commit handler
// and by the first-Tabular-activation path. Keeping them separate from
// the React tree makes them trivial to unit-test against the
// "smart-merge on formula commit" AC matrix.

import {
  humaniseKey,
  inferColumnFormatting,
} from './format';
import type { TabularColumn } from './types';

export interface ReconcileOptions {
  /** Existing column config (may be empty). */
  prev: TabularColumn[];
  /** First row of the new evaluation; used to derive new keys. */
  firstRow: Record<string, unknown> | null;
}

/**
 * Smart-merge reconciliation per the PROJ-17 spec:
 *
 *  - Surviving keys (still present in the new first row) keep their
 *    hand-tuned label / format / alignment / currency_code / visibility,
 *    in their CURRENT order relative to other survivors. Maintainer
 *    reorders are authoritative — even if the new first-row keys are
 *    in a different order, surviving column positions are preserved.
 *  - Vanished keys (no longer in the new first row) are dropped.
 *  - New keys (in the first row but not in `prev`) are appended at the
 *    end with auto-populated defaults derived from the sample value.
 *
 * If the new shape is not `array_of_objects` (callers pass
 * `firstRow = null`), the function returns `prev` unchanged — spec
 * mandates we don't touch the config on shape errors.
 */
export function reconcileTabularColumns({
  prev,
  firstRow,
}: ReconcileOptions): TabularColumn[] {
  if (!firstRow) return prev;
  const newKeys = Object.keys(firstRow).map((k) => String(k));
  if (newKeys.length === 0) return prev;
  const newKeySet = new Set(newKeys);
  const existing = new Map(prev.map((c) => [c.id, c]));

  // 1. Surviving columns — keep their order relative to other survivors.
  const survivors: TabularColumn[] = prev.filter((c) => newKeySet.has(c.id));

  // 2. Append new keys (those not already in the surviving set).
  const survivorIds = new Set(survivors.map((c) => c.id));
  const newlyIntroduced: TabularColumn[] = [];
  for (const key of newKeys) {
    if (survivorIds.has(key)) continue;
    if (existing.has(key)) continue; // (Defensive — would have been caught above.)
    newlyIntroduced.push(columnFromSample(key, firstRow[key]));
  }
  return [...survivors, ...newlyIntroduced];
}

/**
 * Seed a fresh `tabular_columns` array from the first row of a
 * formula result. Used at first-Tabular-activation when `prev` is
 * empty. Identical semantics to the "new key" branch of
 * `reconcileTabularColumns`, so this is just a thin convenience.
 */
export function seedTabularColumns(
  firstRow: Record<string, unknown>,
): TabularColumn[] {
  return Object.keys(firstRow).map((key) =>
    columnFromSample(String(key), firstRow[key]),
  );
}

function columnFromSample(key: string, sample: unknown): TabularColumn {
  const { format, alignment } = inferColumnFormatting(sample);
  return {
    id: key,
    label: humaniseKey(key),
    format,
    alignment,
    currency_code: null,
    visibility: 'visible',
  };
}
