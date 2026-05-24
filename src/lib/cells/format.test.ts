// PROJ-17 — Unit tests for the shared formatter.

import { describe, expect, it } from 'vitest';

import {
  formatValue,
  humaniseKey,
  inferColumnFormatting,
} from './format';

describe('formatValue', () => {
  it('renders an em dash for null / undefined / empty', () => {
    expect(formatValue({ format: 'auto' }, null)).toBe('—');
    expect(formatValue({ format: 'auto' }, undefined)).toBe('—');
    expect(formatValue({ format: 'currency' }, null)).toBe('—');
  });

  it('formats currency with the column code over USD fallback', () => {
    expect(formatValue({ format: 'currency', currency_code: 'EUR' }, 1234.5)).toContain('€');
    expect(formatValue({ format: 'currency' }, 1234.5)).toContain('$');
  });

  it('formats integers, decimals, percents', () => {
    expect(formatValue({ format: 'number_integer' }, 1234.56)).toBe('1,235');
    expect(formatValue({ format: 'number_decimal_2' }, 1234)).toBe('1,234.00');
    expect(formatValue({ format: 'number_decimal_4' }, 1)).toBe('1.0000');
    expect(formatValue({ format: 'percent_0' }, 0.1234)).toBe('12%');
    expect(formatValue({ format: 'percent_2' }, 0.1234)).toBe('12.34%');
  });

  it('formats dates with short and long month', () => {
    const date = new Date('2026-05-24T00:00:00Z');
    expect(formatValue({ format: 'date_short' }, date)).toMatch(/May/);
    expect(formatValue({ format: 'date_long' }, date)).toMatch(/May/);
  });

  it('renders booleans as Yes/No under text_plain', () => {
    expect(formatValue({ format: 'text_plain' }, true)).toBe('Yes');
    expect(formatValue({ format: 'text_plain' }, false)).toBe('No');
  });

  it('falls back to String(raw) for non-numeric values in numeric formats', () => {
    // Best-effort pass-through per spec: "non-numeric row value in a
    // numeric-formatted column → plain text, no per-cell error indicator".
    expect(formatValue({ format: 'currency' }, 'N/A')).toBe('N/A');
    expect(formatValue({ format: 'number_decimal_2' }, 'N/A')).toBe('N/A');
  });

  it('treats unknown format as text_plain fallback', () => {
    expect(formatValue({ format: 'banana' }, 'apple')).toBe('apple');
    expect(formatValue({ format: 'banana' }, 42)).toBe('42');
  });
});

describe('humaniseKey', () => {
  it('converts snake_case to Sentence case', () => {
    expect(humaniseKey('monthly_payment')).toBe('Monthly payment');
    expect(humaniseKey('balance')).toBe('Balance');
    expect(humaniseKey('a_b_c')).toBe('A b c');
  });

  it('returns the original key when empty after stripping underscores', () => {
    expect(humaniseKey('___')).toBe('___');
  });
});

describe('inferColumnFormatting', () => {
  it('right-aligns numerics with decimal_2', () => {
    expect(inferColumnFormatting(12.3)).toEqual({
      format: 'number_decimal_2',
      alignment: 'right',
    });
  });

  it('detects ISO date strings', () => {
    expect(inferColumnFormatting('2026-05-24')).toEqual({
      format: 'date_short',
      alignment: 'left',
    });
  });

  it('defaults to text_plain for strings and booleans', () => {
    expect(inferColumnFormatting('hello')).toEqual({
      format: 'text_plain',
      alignment: 'left',
    });
    expect(inferColumnFormatting(true)).toEqual({
      format: 'text_plain',
      alignment: 'left',
    });
  });
});
