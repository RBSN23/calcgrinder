// PROJ-9 — section type helpers.

import { describe, expect, it } from 'vitest';

import { validateSectionTitle } from './types';

describe('validateSectionTitle', () => {
  it('accepts a normal title', () => {
    expect(validateSectionTitle('Inputs')).toEqual({ ok: true, value: 'Inputs' });
  });

  it('trims surrounding whitespace', () => {
    expect(validateSectionTitle('  Inputs  ')).toEqual({ ok: true, value: 'Inputs' });
  });

  it('rejects empty / whitespace-only titles', () => {
    expect(validateSectionTitle('   ')).toEqual({
      ok: false,
      reason: 'title_required',
    });
  });

  it('rejects titles longer than 100 chars after trim', () => {
    const result = validateSectionTitle('a'.repeat(101));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('title_too_long');
  });

  it('accepts a title of exactly 100 chars', () => {
    const title = 'a'.repeat(100);
    expect(validateSectionTitle(title)).toEqual({ ok: true, value: title });
  });
});
