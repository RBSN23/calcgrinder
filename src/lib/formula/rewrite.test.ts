// PROJ-9 — rewriteFormulaReference tests.

import { afterEach, describe, expect, it } from 'vitest';

import { _resetParseCache } from './analyzer';
import { rewriteFormulaReference } from './rewrite';

afterEach(() => {
  _resetParseCache();
});

describe('rewriteFormulaReference', () => {
  it('rewrites a simple cell reference', () => {
    expect(rewriteFormulaReference('=loan_amount', 'loan_amount', 'principal')).toBe(
      '=principal',
    );
  });

  it('rewrites multiple references in arithmetic', () => {
    expect(
      rewriteFormulaReference(
        '=loan_amount + (loan_amount * rate)',
        'loan_amount',
        'principal',
      ),
    ).toBe('=principal + (principal * rate)');
  });

  it('does not rewrite a partial-match substring identifier', () => {
    expect(
      rewriteFormulaReference('=loan_amount_2 + 1', 'loan_amount', 'principal'),
    ).toBe('=loan_amount_2 + 1');
  });

  it('does not rewrite occurrences inside string literals', () => {
    expect(
      rewriteFormulaReference(
        '="loan_amount: " & loan_amount',
        'loan_amount',
        'principal',
      ),
    ).toBe('="loan_amount: " & principal');
  });

  it('does not rewrite function names', () => {
    expect(rewriteFormulaReference('=SUM(a, b)', 'SUM', 'TOTAL')).toBe(
      '=SUM(a, b)',
    );
  });

  it('rewrites a reference inside a lambda body when not shadowed', () => {
    expect(
      rewriteFormulaReference(
        '=MAP(SEQUENCE(n), x => x * loan_amount)',
        'loan_amount',
        'principal',
      ),
    ).toBe('=MAP(SEQUENCE(n), x => x * principal)');
  });

  it('does NOT rewrite a lambda parameter shadowing the renamed cell', () => {
    expect(
      rewriteFormulaReference(
        '=MAP(SEQUENCE(n), i => i * 2)',
        'i',
        'index',
      ),
    ).toBe('=MAP(SEQUENCE(n), i => i * 2)');
  });

  it('rewrites outer-bound references when a lambda shadows only inside', () => {
    expect(
      rewriteFormulaReference(
        '=i + MAP(SEQUENCE(n), i => i * 2)',
        'i',
        'index',
      ),
    ).toBe('=index + MAP(SEQUENCE(n), i => i * 2)');
  });

  it('rewrites the second argument of a multi-arg call', () => {
    expect(
      rewriteFormulaReference('=PMT(rate, term, principal)', 'rate', 'r'),
    ).toBe('=PMT(r, term, principal)');
  });

  it('returns the original string when oldName === newName', () => {
    expect(rewriteFormulaReference('=a + b', 'a', 'a')).toBe('=a + b');
  });

  it('returns the original string when there are no references', () => {
    expect(rewriteFormulaReference('=1 + 2', 'a', 'b')).toBe('=1 + 2');
  });

  it('returns the original string for an unparseable formula', () => {
    expect(rewriteFormulaReference('=(', 'a', 'b')).toBe('=(');
  });

  it('rewrites a reference at column zero (no leading =)', () => {
    expect(rewriteFormulaReference('loan + 1', 'loan', 'principal')).toBe(
      'principal + 1',
    );
  });

  it('preserves whitespace between tokens', () => {
    expect(rewriteFormulaReference('=  loan   +  1', 'loan', 'principal')).toBe(
      '=  principal   +  1',
    );
  });
});
