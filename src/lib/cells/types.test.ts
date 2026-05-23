// PROJ-9 — cell type helpers.

import { describe, expect, it } from 'vitest';

import {
  defaultEditability,
  defaultWidget,
  nextDefaultCellName,
  validateCellName,
} from './types';

describe('validateCellName', () => {
  it('accepts a clean snake_case name', () => {
    expect(validateCellName('loan_amount')).toEqual({
      ok: true,
      value: 'loan_amount',
    });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateCellName('  principal  ')).toEqual({
      ok: true,
      value: 'principal',
    });
  });

  it('rejects empty / whitespace-only names', () => {
    expect(validateCellName('   ')).toEqual({
      ok: false,
      reason: 'name_required',
    });
  });

  it('rejects names starting with a digit', () => {
    const result = validateCellName('1amount');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('name_invalid');
  });

  it('rejects names with uppercase letters', () => {
    const result = validateCellName('LoanAmount');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('name_invalid');
  });

  it('rejects names longer than 40 chars', () => {
    const result = validateCellName('a'.repeat(41));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('name_invalid');
  });

  it('accepts names exactly 40 chars long', () => {
    const name = 'a' + 'b'.repeat(39);
    expect(name.length).toBe(40);
    expect(validateCellName(name)).toEqual({ ok: true, value: name });
  });

  it('rejects reserved words (lowercase function names)', () => {
    const result = validateCellName('pmt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('name_reserved');
      expect(result.reservedWord).toBe('pmt');
    }
  });

  it('rejects the lowercase boolean literal "true"', () => {
    const result = validateCellName('true');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('name_reserved');
  });

  it('rejects "empty" reserved sentinel', () => {
    const result = validateCellName('empty');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('name_reserved');
  });
});

describe('nextDefaultCellName', () => {
  it('returns cell_1 for an empty set', () => {
    expect(nextDefaultCellName([])).toBe('cell_1');
  });

  it('skips taken names', () => {
    expect(nextDefaultCellName(['cell_1', 'cell_2'])).toBe('cell_3');
  });

  it('fills in gaps if cell_1 is free', () => {
    expect(nextDefaultCellName(['cell_2', 'cell_3'])).toBe('cell_1');
  });

  it('ignores non-cell_N names', () => {
    expect(nextDefaultCellName(['loan', 'rate'])).toBe('cell_1');
  });
});

describe('defaultEditability', () => {
  it('makes inputs editable', () => {
    expect(defaultEditability('input')).toBe('editable');
  });

  it('makes outputs readonly', () => {
    expect(defaultEditability('output')).toBe('readonly');
  });
});

describe('defaultWidget', () => {
  it.each([
    ['number', 'number_field'],
    ['currency', 'number_field'],
    ['percent', 'number_field'],
    ['date', 'date_picker'],
    ['boolean', 'toggle_switch'],
    ['select', 'dropdown'],
    ['text', 'text_field'],
  ] as const)('picks %s → %s', (value_type, widget) => {
    expect(defaultWidget(value_type)).toBe(widget);
  });
});
