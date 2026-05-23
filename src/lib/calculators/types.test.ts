import { describe, expect, it } from 'vitest';

import { MAX_TITLE_LENGTH, validateTitle } from './types';

describe('validateTitle', () => {
  it('rejects empty strings', () => {
    expect(validateTitle('')).toEqual({ ok: false, reason: 'title_required' });
  });

  it('rejects whitespace-only strings (trim before check)', () => {
    expect(validateTitle('   ')).toEqual({ ok: false, reason: 'title_required' });
    expect(validateTitle('\t\n ')).toEqual({ ok: false, reason: 'title_required' });
  });

  it('trims leading + trailing whitespace from accepted values', () => {
    expect(validateTitle('  Mortgage  ')).toEqual({ ok: true, value: 'Mortgage' });
  });

  it('accepts up to MAX_TITLE_LENGTH chars after trim', () => {
    const exact = 'x'.repeat(MAX_TITLE_LENGTH);
    expect(validateTitle(exact)).toEqual({ ok: true, value: exact });
  });

  it('rejects strings longer than MAX_TITLE_LENGTH after trim', () => {
    const tooLong = 'x'.repeat(MAX_TITLE_LENGTH + 1);
    expect(validateTitle(tooLong)).toEqual({ ok: false, reason: 'title_too_long' });
  });

  it('measures length after trim, not before', () => {
    // 99 chars + 2 spaces around = 101 raw; should pass.
    const padded = `  ${'x'.repeat(99)}  `;
    expect(validateTitle(padded)).toEqual({ ok: true, value: 'x'.repeat(99) });
  });
});
