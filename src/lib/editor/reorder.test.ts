import { describe, expect, it } from 'vitest';

import { computeReorderUpdates } from './reorder';

const rows = (...orders: number[]) =>
  orders.map((o, i) => ({ id: `r${i}`, display_order: o }));

describe('computeReorderUpdates', () => {
  it('drag from 0 to 1 swaps the two cells (downstream by 1)', () => {
    const updates = computeReorderUpdates(rows(0, 1, 2), 'r0', 1);
    // r1 must shift from 1 → 0, r0 must land at 1. r2 stays at 2.
    expect(updates).toEqual([
      { id: 'r1', display_order: 0 },
      { id: 'r0', display_order: 1 },
    ]);
  });

  it('drag from 0 to 2 lands the cell at 2 with both siblings shifted down', () => {
    const updates = computeReorderUpdates(rows(0, 1, 2), 'r0', 2);
    expect(updates).toEqual([
      { id: 'r1', display_order: 0 },
      { id: 'r2', display_order: 1 },
      { id: 'r0', display_order: 2 },
    ]);
  });

  it('drag from 2 to 0 lands the cell at 0 with both siblings shifted up (upstream)', () => {
    const updates = computeReorderUpdates(rows(0, 1, 2), 'r2', 0);
    expect(updates).toEqual([
      { id: 'r0', display_order: 1 },
      { id: 'r1', display_order: 2 },
      { id: 'r2', display_order: 0 },
    ]);
  });

  it('drag from 2 to 1 swaps just the two adjacent cells', () => {
    const updates = computeReorderUpdates(rows(0, 1, 2), 'r2', 1);
    expect(updates).toEqual([
      { id: 'r1', display_order: 2 },
      { id: 'r2', display_order: 1 },
    ]);
  });

  it('drag to the same position is a no-op', () => {
    expect(computeReorderUpdates(rows(0, 1, 2), 'r1', 1)).toEqual([]);
  });

  it('drag to out-of-range clamps to the last valid index', () => {
    // 99 → last index (2) for a 3-row scope.
    const updates = computeReorderUpdates(rows(0, 1, 2), 'r0', 99);
    expect(updates[updates.length - 1]).toEqual({
      id: 'r0',
      display_order: 2,
    });
  });

  it('returns [] for an unknown id (defensive)', () => {
    expect(computeReorderUpdates(rows(0, 1, 2), 'missing', 1)).toEqual([]);
  });
});
