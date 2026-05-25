import { describe, expect, it } from 'vitest';

import {
  SINGLE_COLUMN_PATTERN,
  TWO_COLUMN_PATTERN,
  TWO_THIRDS_ONE_THIRD_PATTERN,
  FOUR_COLUMN_PATTERN,
  THREE_QUARTERS_ONE_QUARTER_PATTERN,
  QUARTER_QUARTER_HALF_PATTERN,
  UNIVERSAL_LAYOUT_CATALOG,
  resolveLayoutPattern,
} from './layout-patterns';

describe('layout-pattern catalogue', () => {
  it('SINGLE_COLUMN_PATTERN is one column wide', () => {
    expect(SINGLE_COLUMN_PATTERN.id).toBe('single_column');
    expect(SINGLE_COLUMN_PATTERN.columns).toBe(1);
    expect(SINGLE_COLUMN_PATTERN.columnSpans).toEqual([1]);
  });

  it('TWO_COLUMN_PATTERN is two equal columns', () => {
    expect(TWO_COLUMN_PATTERN.id).toBe('two_column');
    expect(TWO_COLUMN_PATTERN.columns).toBe(2);
    expect(TWO_COLUMN_PATTERN.columnSpans).toEqual([1, 1]);
  });

  it('TWO_THIRDS_ONE_THIRD_PATTERN is a 2:1 split', () => {
    expect(TWO_THIRDS_ONE_THIRD_PATTERN.id).toBe('two_thirds_one_third');
    expect(TWO_THIRDS_ONE_THIRD_PATTERN.columns).toBe(2);
    expect(TWO_THIRDS_ONE_THIRD_PATTERN.columnSpans).toEqual([2, 1]);
  });

  it('FOUR_COLUMN_PATTERN is four equal columns', () => {
    expect(FOUR_COLUMN_PATTERN.id).toBe('four_column');
    expect(FOUR_COLUMN_PATTERN.columns).toBe(4);
    expect(FOUR_COLUMN_PATTERN.columnSpans).toEqual([1, 1, 1, 1]);
  });

  it('THREE_QUARTERS_ONE_QUARTER_PATTERN is a 3:1 split', () => {
    expect(THREE_QUARTERS_ONE_QUARTER_PATTERN.id).toBe('three_quarters_one_quarter');
    expect(THREE_QUARTERS_ONE_QUARTER_PATTERN.columns).toBe(2);
    expect(THREE_QUARTERS_ONE_QUARTER_PATTERN.columnSpans).toEqual([3, 1]);
  });

  it('QUARTER_QUARTER_HALF_PATTERN is a 1:1:2 split', () => {
    expect(QUARTER_QUARTER_HALF_PATTERN.id).toBe('quarter_quarter_half');
    expect(QUARTER_QUARTER_HALF_PATTERN.columns).toBe(3);
    expect(QUARTER_QUARTER_HALF_PATTERN.columnSpans).toEqual([1, 1, 2]);
  });
});

describe('UNIVERSAL_LAYOUT_CATALOG', () => {
  it('contains exactly 8 patterns in the spec-mandated order', () => {
    expect(UNIVERSAL_LAYOUT_CATALOG).toHaveLength(8);
    expect(UNIVERSAL_LAYOUT_CATALOG.map((p) => p.id)).toEqual([
      'single_column',
      'two_column',
      'two_thirds_one_third',
      'one_third_two_thirds',
      'three_column',
      'four_column',
      'three_quarters_one_quarter',
      'quarter_quarter_half',
    ]);
  });

  it('includes single_column as the first pattern', () => {
    expect(UNIVERSAL_LAYOUT_CATALOG[0].id).toBe('single_column');
  });
});

describe('resolveLayoutPattern', () => {
  it('returns the matching pattern when the id is known', () => {
    const result = resolveLayoutPattern(
      UNIVERSAL_LAYOUT_CATALOG,
      'two_column',
    );
    expect(result.pattern.id).toBe('two_column');
    expect(result.fellBack).toBe(false);
  });

  it('resolves new patterns from the universal catalog', () => {
    const result = resolveLayoutPattern(
      UNIVERSAL_LAYOUT_CATALOG,
      'four_column',
    );
    expect(result.pattern.id).toBe('four_column');
    expect(result.fellBack).toBe(false);
  });

  it('falls back to single_column when the id is unknown', () => {
    const result = resolveLayoutPattern(
      UNIVERSAL_LAYOUT_CATALOG,
      'no_such_pattern',
    );
    expect(result.pattern.id).toBe('single_column');
    expect(result.fellBack).toBe(true);
  });

  it('falls back without the banner flag when the id is null', () => {
    const result = resolveLayoutPattern(UNIVERSAL_LAYOUT_CATALOG, null);
    expect(result.pattern.id).toBe('single_column');
    expect(result.fellBack).toBe(false);
  });
});
