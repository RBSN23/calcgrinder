// PROJ-9 — layout-pattern catalogue tests.

import { describe, expect, it } from 'vitest';

import {
  SINGLE_COLUMN_PATTERN,
  TWO_COLUMN_PATTERN,
  TWO_THIRDS_ONE_THIRD_PATTERN,
  resolveLayoutPattern,
} from './layout-patterns';
import {
  bento,
  bentoGlassy,
  calcgrinder,
  calcgrinderCI,
  editorial,
  minimal,
  terminal,
  vessel,
} from './index';

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
});

describe('every theme publishes single_column', () => {
  const themes = [
    calcgrinder,
    vessel,
    editorial,
    calcgrinderCI,
    minimal,
    bento,
    bentoGlassy,
    terminal,
  ];

  it.each(themes.map((t) => [t.id, t]))(
    '%s publishes single_column',
    (_id, theme) => {
      const ids = theme.layoutPatterns.map((p) => p.id);
      expect(ids).toContain('single_column');
    },
  );
});

describe('calcgrinder default theme publishes the AC-mandated trio', () => {
  it('contains single_column, two_column, two_thirds_one_third', () => {
    const ids = calcgrinder.layoutPatterns.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'single_column',
        'two_column',
        'two_thirds_one_third',
      ]),
    );
  });
});

describe('resolveLayoutPattern', () => {
  it('returns the matching pattern when the id is known', () => {
    const result = resolveLayoutPattern(
      calcgrinder.layoutPatterns,
      'two_column',
    );
    expect(result.pattern.id).toBe('two_column');
    expect(result.fellBack).toBe(false);
  });

  it('falls back to single_column when the id is unknown', () => {
    const result = resolveLayoutPattern(
      calcgrinder.layoutPatterns,
      'no_such_pattern',
    );
    expect(result.pattern.id).toBe('single_column');
    expect(result.fellBack).toBe(true);
  });

  it('falls back without the banner flag when the id is null', () => {
    const result = resolveLayoutPattern(calcgrinder.layoutPatterns, null);
    expect(result.pattern.id).toBe('single_column');
    expect(result.fellBack).toBe(false);
  });
});
