// PROJ-17 — Smart-merge reconciliation tests.

import { describe, expect, it } from 'vitest';

import {
  reconcileTabularColumns,
  seedTabularColumns,
} from './tabular-reconcile';
import type { TabularColumn } from './types';

const col = (overrides: Partial<TabularColumn>): TabularColumn => ({
  id: overrides.id ?? 'k',
  label: overrides.label ?? 'K',
  format: overrides.format ?? 'auto',
  alignment: overrides.alignment ?? 'left',
  currency_code: overrides.currency_code ?? null,
  visibility: overrides.visibility ?? 'visible',
});

describe('seedTabularColumns', () => {
  it('seeds from first-row keys in insertion order', () => {
    const seeded = seedTabularColumns({ month: 1, payment: 100.5, label: 'Jan' });
    expect(seeded.map((c) => c.id)).toEqual(['month', 'payment', 'label']);
  });

  it('infers right-aligned number_decimal_2 for numeric values', () => {
    const [{ format, alignment }] = seedTabularColumns({ amount: 10 });
    expect(format).toBe('number_decimal_2');
    expect(alignment).toBe('right');
  });

  it('humanises labels', () => {
    const [{ label }] = seedTabularColumns({ monthly_payment: 1 });
    expect(label).toBe('Monthly payment');
  });
});

describe('reconcileTabularColumns', () => {
  it('returns prev unchanged when firstRow is null (shape error)', () => {
    const prev: TabularColumn[] = [col({ id: 'a', label: 'A' })];
    expect(reconcileTabularColumns({ prev, firstRow: null })).toBe(prev);
  });

  it('returns prev unchanged when firstRow is empty (no first row to sample)', () => {
    const prev: TabularColumn[] = [col({ id: 'a' })];
    expect(reconcileTabularColumns({ prev, firstRow: {} })).toBe(prev);
  });

  it('keeps hand-tuned labels on surviving keys', () => {
    const prev: TabularColumn[] = [
      col({ id: 'monthly_payment', label: 'Monthly payment' }),
    ];
    const next = reconcileTabularColumns({
      prev,
      firstRow: { monthly_payment: 100 },
    });
    expect(next[0].label).toBe('Monthly payment');
  });

  it('drops vanished keys and appends new keys with defaults', () => {
    const prev: TabularColumn[] = [
      col({ id: 'a', label: 'Alpha' }),
      col({ id: 'b', label: 'Beta' }),
    ];
    const next = reconcileTabularColumns({
      prev,
      firstRow: { a: 1, c: 'x' },
    });
    expect(next.map((c) => c.id)).toEqual(['a', 'c']);
    expect(next[0].label).toBe('Alpha');
    expect(next[1].label).toBe('C');
  });

  it('preserves maintainer reorder even when first-row keys come in a different order', () => {
    const prev: TabularColumn[] = [
      col({ id: 'c' }),
      col({ id: 'a' }),
      col({ id: 'b' }),
    ];
    const next = reconcileTabularColumns({
      prev,
      firstRow: { a: 1, b: 2, c: 3 },
    });
    expect(next.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('appends new keys at the end after the existing reorder is preserved', () => {
    const prev: TabularColumn[] = [col({ id: 'b' }), col({ id: 'a' })];
    const next = reconcileTabularColumns({
      prev,
      firstRow: { a: 1, b: 2, c: 3 },
    });
    expect(next.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('reintroduced keys come back with default config (no ghost memory)', () => {
    const prev: TabularColumn[] = [col({ id: 'a', label: 'Custom' })];
    // First commit drops `a`.
    const intermediate = reconcileTabularColumns({
      prev,
      firstRow: { b: 1 },
    });
    expect(intermediate.map((c) => c.id)).toEqual(['b']);
    // Second commit re-introduces `a` — default label, not "Custom".
    const next = reconcileTabularColumns({
      prev: intermediate,
      firstRow: { b: 1, a: 99 },
    });
    expect(next.find((c) => c.id === 'a')?.label).toBe('A');
  });
});
