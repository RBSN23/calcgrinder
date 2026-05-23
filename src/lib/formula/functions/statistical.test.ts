import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from '../evaluator';
import type { Cell } from '../types';

function run(formula: string, inputs: Record<string, unknown> = {}, extra: Cell[] = []): unknown {
  const cells: Cell[] = [
    ...extra,
    { name: 'r', kind: 'output' as const, formula },
  ];
  return evaluateCalculator(cells, inputs).r;
}

describe('statistical functions', () => {
  it('SUM ignores empty values', () => {
    const cells: Cell[] = [
      { name: 'a', kind: 'input', input_type: 'number' },
      { name: 'b', kind: 'input', input_type: 'number' },
      { name: 'c', kind: 'input', input_type: 'number' },
      { name: 'r', kind: 'output', formula: '=SUM(a, b, c)' },
    ];
    const result = evaluateCalculator(cells, { a: 1, c: 3 });
    expect(result.r).toMatchObject({ value: 4 });
  });

  it('SUM of all empties is empty', () => {
    const cells: Cell[] = [
      { name: 'a', kind: 'input', input_type: 'number' },
      { name: 'b', kind: 'input', input_type: 'number' },
      { name: 'r', kind: 'output', formula: '=SUM(a, b)' },
    ];
    expect(evaluateCalculator(cells, {}).r.shape).toBe('empty');
  });

  it('AVERAGE ignores empty values', () => {
    expect(run('=AVERAGE(1, 2, 3, 4)')).toMatchObject({ value: 2.5 });
  });

  it('COUNT counts numeric entries only', () => {
    expect(run('=COUNT(1, 2, 3)')).toMatchObject({ value: 3 });
  });

  it('MEDIAN of even count averages middle two', () => {
    expect(run('=MEDIAN(1, 2, 3, 4)')).toMatchObject({ value: 2.5 });
  });

  it('STDEV is the sample standard deviation (Excel STDEV.S)', () => {
    // For [2,4,4,4,5,5,7,9], variance = 32/(8-1) = 4.571…
    // → stddev = sqrt(32/7) ≈ 2.138089935299395
    const result = run('=STDEV(2,4,4,4,5,5,7,9)') as { value: number };
    expect(result.value).toBeCloseTo(Math.sqrt(32 / 7), 6);
  });

  it('PRODUCT', () => {
    expect(run('=PRODUCT(2, 3, 4)')).toMatchObject({ value: 24 });
  });

  it('SUMIF with lambda predicate', () => {
    expect(run('=SUMIF(SEQUENCE(10), x => x > 5)')).toMatchObject({
      value: 6 + 7 + 8 + 9 + 10,
    });
  });

  it('COUNTIF with lambda predicate', () => {
    expect(run('=COUNTIF(SEQUENCE(10), x => x > 5)')).toMatchObject({ value: 5 });
  });

  it('SUMIF rejects criterion strings (lambda only)', () => {
    const r = run('=SUMIF(SEQUENCE(3), ">5")') as { error: { category: string } };
    expect(r.error.category).toBe('wrong_type');
  });
});
