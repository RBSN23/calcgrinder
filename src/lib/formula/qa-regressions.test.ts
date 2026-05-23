// QA regression cases for PROJ-7 acceptance criteria not covered
// elsewhere. Added by the /qa pass on 2026-05-23. Each test maps to a
// specific AC checkbox so a future change that regresses one of these
// is caught by name.

import { beforeEach, describe, expect, it } from 'vitest';
import { _resetParseCache, getStructuralErrors } from './analyzer';
import { evaluateCalculator } from './evaluator';
import { MAX_FORMULA_LEN } from './limits';
import type { Cell } from './types';

beforeEach(() => _resetParseCache());

describe('AC — cycle propagation to external dependents', () => {
  // Spec AC: "Given a chain `x → cycled_cell`, when the cycle is
  // active, then `x` emits the propagation message (`↑ depends on …`)
  // — not `cycle` itself."
  it('cell outside the cycle gets runtime propagation, not cycle', () => {
    const cells: Cell[] = [
      { name: 'a', kind: 'output', formula: '=b + 1' },
      { name: 'b', kind: 'output', formula: '=a + 1' },
      { name: 'x', kind: 'output', formula: '=a + 10' },
    ];
    const r = evaluateCalculator(cells, {});
    expect(r.a.error?.category).toBe('cycle');
    expect(r.b.error?.category).toBe('cycle');
    expect(r.x.error?.category).toBe('runtime');
    expect(r.x.error?.message).toMatch(/↑ depends on/);
  });
});

describe('AC — formula 2000-char cap surfaces as syntax error', () => {
  // Spec AC: "Given a calculator save request, when any cell's
  // formula exceeds 2000 characters … then save is rejected with a
  // clear message naming the limit hit."
  it('formula longer than MAX_FORMULA_LEN is reported by getStructuralErrors', () => {
    const longFormula = '=' + Array(MAX_FORMULA_LEN + 5).fill('1').join('+');
    const cells: Cell[] = [{ name: 'big', kind: 'output', formula: longFormula }];
    const errs = getStructuralErrors(cells);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({
      cellName: 'big',
      category: 'syntax',
    });
    expect(errs[0]!.message).toMatch(new RegExp(String(MAX_FORMULA_LEN)));
  });
});

describe('AC — SUMIF / COUNTIF accept lambda only', () => {
  // Tech-design decision: SUMIF / COUNTIF predicates accept lambda
  // only, not Excel criterion strings. One predicate vocabulary
  // across the engine.
  it('SUMIF with criterion-string predicate → wrong_type', () => {
    const cells: Cell[] = [
      { name: 'r', kind: 'output', formula: '=SUMIF(SEQUENCE(5), ">2")' },
    ];
    const r = evaluateCalculator(cells, {});
    expect(r.r.error?.category).toBe('wrong_type');
  });

  it('SUMIF with lambda predicate works', () => {
    const cells: Cell[] = [
      { name: 'r', kind: 'output', formula: '=SUMIF(SEQUENCE(5), x => x > 2)' },
    ];
    const r = evaluateCalculator(cells, {});
    expect(r.r.value).toBe(12); // 3 + 4 + 5
  });

  it('COUNTIF with lambda predicate works', () => {
    const cells: Cell[] = [
      { name: 'r', kind: 'output', formula: '=COUNTIF(SEQUENCE(5), x => x >= 3)' },
    ];
    const r = evaluateCalculator(cells, {});
    expect(r.r.value).toBe(3);
  });
});

describe('AC — short-circuit semantics', () => {
  it('IF unchosen branch errors do not surface', () => {
    const cells: Cell[] = [
      { name: 'r', kind: 'output', formula: '=IF(TRUE, 42, 1/0)' },
    ];
    expect(evaluateCalculator(cells, {}).r.value).toBe(42);
  });

  it('AND short-circuits on first FALSE', () => {
    const cells: Cell[] = [
      { name: 'r', kind: 'output', formula: '=AND(FALSE, 1/0)' },
    ];
    expect(evaluateCalculator(cells, {}).r.value).toBe(false);
  });

  it('OR short-circuits on first TRUE', () => {
    const cells: Cell[] = [
      { name: 'r', kind: 'output', formula: '=OR(TRUE, 1/0)' },
    ];
    expect(evaluateCalculator(cells, {}).r.value).toBe(true);
  });
});

describe('AC — aggregator empty handling', () => {
  it('SUM ignores empty values', () => {
    const cells: Cell[] = [
      { name: 'a', kind: 'input', input_type: 'number', default_value: 10 },
      { name: 'b', kind: 'input', input_type: 'number' },
      { name: 'c', kind: 'input', input_type: 'number', default_value: 30 },
      { name: 's', kind: 'output', formula: '=SUM(a, b, c)' },
    ];
    expect(evaluateCalculator(cells, {}).s.value).toBe(40);
  });

  it('SUM with all empty returns empty', () => {
    const cells: Cell[] = [
      { name: 'a', kind: 'input', input_type: 'number' },
      { name: 'b', kind: 'input', input_type: 'number' },
      { name: 's', kind: 'output', formula: '=SUM(a, b)' },
    ];
    expect(evaluateCalculator(cells, {}).s.shape).toBe('empty');
  });

  it('AVERAGE ignores empty values (Excel-compat)', () => {
    const cells: Cell[] = [
      { name: 'a', kind: 'input', input_type: 'number', default_value: 10 },
      { name: 'b', kind: 'input', input_type: 'number' },
      { name: 'c', kind: 'input', input_type: 'number', default_value: 30 },
      { name: 'avg', kind: 'output', formula: '=AVERAGE(a, b, c)' },
    ];
    expect(evaluateCalculator(cells, {}).avg.value).toBe(20);
  });
});

describe('AC — date arithmetic boundary', () => {
  it('date overflow → out_of_range, not silent overflow', () => {
    const cells: Cell[] = [
      { name: 'r', kind: 'output', formula: '=DATE(9999,12,31) + 999999' },
    ];
    const r = evaluateCalculator(cells, {});
    expect(r.r.error?.category).toBe('out_of_range');
  });
});

describe('AC — OBJECT key validation', () => {
  it('non-string key → wrong_type', () => {
    const cells: Cell[] = [
      { name: 'r', kind: 'output', formula: '=OBJECT(1, "value")' },
    ];
    const r = evaluateCalculator(cells, {});
    expect(r.r.error?.category).toBe('wrong_type');
  });
});

describe('AC — lambda parameter shadows outer cell', () => {
  it('lambda param with same name as cell shadows the cell-ref', () => {
    const cells: Cell[] = [
      { name: 'multiplier', kind: 'input', input_type: 'number', default_value: 10 },
      { name: 'r', kind: 'output',
        formula: '=MAP(SEQUENCE(3), multiplier => multiplier * 2)' },
    ];
    expect(evaluateCalculator(cells, {}).r.value).toEqual([2, 4, 6]);
  });
});

describe('Defense-in-depth — hostile cell names', () => {
  // PROJ-9's name regex `[a-z][a-z0-9_]*` rejects `__proto__` /
  // `constructor` so this is unreachable in real authoring. We still
  // assert that if a hostile cell name leaks through, the engine
  // does NOT pollute the global Object.prototype.
  it('cell named __proto__ does not pollute Object.prototype', () => {
    const cells: Cell[] = [
      { name: '__proto__', kind: 'output', formula: '=42' },
      { name: 'r', kind: 'output', formula: '=1+1' },
    ];
    const before = Object.getOwnPropertyNames(Object.prototype).length;
    evaluateCalculator(cells, {});
    const after = Object.getOwnPropertyNames(Object.prototype).length;
    expect(after).toBe(before);
    expect((Object.prototype as Record<string, unknown>).r).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).value).toBeUndefined();
  });
});
