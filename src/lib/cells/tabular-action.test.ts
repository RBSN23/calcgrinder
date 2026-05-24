// PROJ-17 BUG-M1 / BUG-M2 — Unit tests for computeTabularActionPatch
// and evaluateSpeculative. These cover the pure-function half of the
// fix; the E2E suite covers the wiring + undo bundling at the user-
// action sites.

import { describe, expect, it } from 'vitest';

import {
  computeTabularActionPatch,
  evaluateSpeculative,
} from './tabular-action';
import type { CellRow, TabularColumn } from './types';
import type { CellResult } from '@/lib/formula';

const baseCell: CellRow = {
  id: 'cell-1',
  calculator_id: 'calc-1',
  section_id: 'sec-1',
  kind: 'output',
  name: 'amort',
  label: '',
  description: '',
  description_render: 'caption',
  value_type: 'number',
  visibility: 'visible',
  editability: 'readonly',
  default_value: null,
  formula: '=1',
  display_widget: null,
  display_format: 'auto',
  display_emphasis: 'plain',
  unit: null,
  numeric_min: null,
  numeric_max: null,
  numeric_step: null,
  select_options: null,
  currency_code: null,
  card_accent: 'auto',
  card_background_tint: 'none',
  card_border: 'none',
  card_size_hint: 'narrow',
  text_size: 'm',
  text_colour: 'default',
  tabular_columns: [],
  display_order: 0,
  created_at: '',
  updated_at: '',
};

const aooResult = (rows: Array<Record<string, unknown>>): CellResult => ({
  value: rows,
  shape: 'array_of_objects',
});

describe('computeTabularActionPatch — first-time seed', () => {
  it('seeds tabular_columns + promotes plain→tabular + bumps narrow→wide in one patch', () => {
    const patch = computeTabularActionPatch({
      cell: baseCell,
      nextEmphasis: 'plain',
      result: aooResult([{ month: 1, principal: 100 }]),
    });
    expect(patch.display_emphasis).toBe('tabular');
    expect(patch.card_size_hint).toBe('wide');
    expect(patch.tabular_columns?.map((c) => c.id)).toEqual(['month', 'principal']);
  });

  it('does not include display_emphasis when nextEmphasis is already tabular', () => {
    const patch = computeTabularActionPatch({
      cell: baseCell,
      nextEmphasis: 'tabular',
      result: aooResult([{ a: 1 }]),
    });
    expect(patch.display_emphasis).toBeUndefined();
    expect(patch.tabular_columns).toHaveLength(1);
  });

  it('does not include card_size_hint when the cell is already wide', () => {
    const wide = { ...baseCell, card_size_hint: 'wide' as const };
    const patch = computeTabularActionPatch({
      cell: wide,
      nextEmphasis: 'plain',
      result: aooResult([{ a: 1 }]),
    });
    expect(patch.card_size_hint).toBeUndefined();
  });
});

describe('computeTabularActionPatch — smart-merge', () => {
  it('returns reconciled columns when first-row keys add/drop', () => {
    const cell: CellRow = {
      ...baseCell,
      display_emphasis: 'tabular',
      tabular_columns: [
        { id: 'a', label: 'Alpha', format: 'auto', alignment: 'left', currency_code: null, visibility: 'visible' },
        { id: 'b', label: 'Beta', format: 'auto', alignment: 'left', currency_code: null, visibility: 'visible' },
      ] as TabularColumn[],
    };
    const patch = computeTabularActionPatch({
      cell,
      nextEmphasis: 'tabular',
      result: aooResult([{ a: 1, c: 2 }]),
    });
    expect(patch.tabular_columns?.map((c) => c.id)).toEqual(['a', 'c']);
    // No emphasis-promotion (already tabular) and no size-bump (cell
    // already has its hand-tuned size).
    expect(patch.display_emphasis).toBeUndefined();
    expect(patch.card_size_hint).toBeUndefined();
  });

  it('returns an empty patch when first-row keys match existing column ids exactly', () => {
    const cell: CellRow = {
      ...baseCell,
      display_emphasis: 'tabular',
      tabular_columns: [
        { id: 'a', label: 'Alpha', format: 'auto', alignment: 'left', currency_code: null, visibility: 'visible' },
        { id: 'b', label: 'Beta', format: 'auto', alignment: 'left', currency_code: null, visibility: 'visible' },
      ] as TabularColumn[],
    };
    const patch = computeTabularActionPatch({
      cell,
      nextEmphasis: 'tabular',
      result: aooResult([{ a: 1, b: 2 }]),
    });
    expect(patch).toEqual({});
  });
});

describe('computeTabularActionPatch — guards', () => {
  it('returns {} for input cells', () => {
    const input = { ...baseCell, kind: 'input' as const };
    const patch = computeTabularActionPatch({
      cell: input,
      nextEmphasis: 'tabular',
      result: aooResult([{ a: 1 }]),
    });
    expect(patch).toEqual({});
  });

  it('returns {} for scalar / array_of_scalars / error / empty results', () => {
    for (const result of [
      undefined,
      { value: 1, shape: 'scalar' as const },
      { value: [1, 2], shape: 'array_of_scalars' as const },
      { value: [], shape: 'array_of_objects' as const },
      { value: undefined, shape: 'scalar' as const, error: { category: 'runtime' as const, message: 'x' } },
    ]) {
      expect(
        computeTabularActionPatch({
          cell: baseCell,
          nextEmphasis: 'tabular',
          result,
        }),
      ).toEqual({});
    }
  });

  it('returns {} when nextEmphasis is plain and columns already exist (user explicitly cycled)', () => {
    const cell: CellRow = {
      ...baseCell,
      display_emphasis: 'tabular',
      tabular_columns: [
        { id: 'a', label: 'Alpha', format: 'auto', alignment: 'left', currency_code: null, visibility: 'visible' },
      ] as TabularColumn[],
    };
    // Maintainer is switching FROM tabular TO plain — explicit Edge
    // Case spec line 750-766. Helper must not touch columns.
    const patch = computeTabularActionPatch({
      cell,
      nextEmphasis: 'plain',
      result: aooResult([{ a: 1, b: 2 }]),
    });
    expect(patch).toEqual({});
  });
});

describe('evaluateSpeculative', () => {
  it('returns the result of the candidate formula without mutating the cell', () => {
    const cell: CellRow = {
      ...baseCell,
      formula: '=1',
    };
    const result = evaluateSpeculative(
      [cell],
      {},
      cell.id,
      '=MAP(SEQUENCE(2), i => OBJECT("x", i))',
    );
    expect(result?.shape).toBe('array_of_objects');
    expect(result?.value).toEqual([{ x: 1 }, { x: 2 }]);
    // Original cell untouched.
    expect(cell.formula).toBe('=1');
  });

  it('respects dependencies on other cells in the array', () => {
    const inputCell: CellRow = {
      ...baseCell,
      id: 'in-1',
      name: 'multiplier',
      kind: 'input',
      value_type: 'number',
      default_value: 5,
      formula: null,
    };
    const outputCell: CellRow = {
      ...baseCell,
      id: 'out-1',
      name: 'derived',
      formula: '=1',
    };
    const result = evaluateSpeculative(
      [inputCell, outputCell],
      {},
      outputCell.id,
      '=multiplier * 2',
    );
    expect(result?.shape).toBe('scalar');
    expect(result?.value).toBe(10);
  });
});
