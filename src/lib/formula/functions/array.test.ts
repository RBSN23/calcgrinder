import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from '../evaluator';

function run(formula: string): unknown {
  return evaluateCalculator(
    [{ name: 'r', kind: 'output' as const, formula }],
    {}
  ).r;
}

describe('array functions', () => {
  it('SEQUENCE', () => {
    expect(run('=SEQUENCE(5)')).toMatchObject({ value: [1, 2, 3, 4, 5] });
    expect(run('=SEQUENCE(3, 10, 2)')).toMatchObject({ value: [10, 12, 14] });
  });

  it('RANGE', () => {
    expect(run('=RANGE(0, 5)')).toMatchObject({ value: [0, 1, 2, 3, 4] });
    expect(run('=RANGE(0, 10, 2)')).toMatchObject({ value: [0, 2, 4, 6, 8] });
    expect(run('=RANGE(10, 0, -2)')).toMatchObject({ value: [10, 8, 6, 4, 2] });
  });

  it('MAP', () => {
    expect(run('=MAP(SEQUENCE(3), i => i * i)')).toMatchObject({ value: [1, 4, 9] });
  });

  it('FILTER', () => {
    expect(run('=FILTER(SEQUENCE(10), x => x > 5)')).toMatchObject({
      value: [6, 7, 8, 9, 10],
    });
  });

  it('REDUCE folds with a 2-arg lambda', () => {
    expect(run('=REDUCE(SEQUENCE(5), 0, (acc, x) => acc + x)')).toMatchObject({ value: 15 });
  });

  it('OBJECT builds a record (last duplicate key wins)', () => {
    expect(run('=OBJECT("a", 1, "b", 2)')).toMatchObject({ value: { a: 1, b: 2 } });
    expect(run('=OBJECT("k", 1, "k", 2)')).toMatchObject({ value: { k: 2 } });
  });

  it('OBJECT with non-string key errors as wrong_type', () => {
    expect((run('=OBJECT(1, "v")') as { error: { category: string } }).error.category).toBe(
      'wrong_type'
    );
  });

  it('RECORD aliases OBJECT', () => {
    expect(run('=RECORD("a", 1)')).toMatchObject({ value: { a: 1 } });
  });

  it('MAP returning OBJECT yields array_of_objects shape', () => {
    const r = run('=MAP(SEQUENCE(2), i => OBJECT("i", i, "sq", i*i))') as {
      shape: string;
      value: { i: number; sq: number }[];
    };
    expect(r.shape).toBe('array_of_objects');
    expect(r.value).toEqual([
      { i: 1, sq: 1 },
      { i: 2, sq: 4 },
    ]);
  });

  it('SEQUENCE exceeding 10k errors out_of_range', () => {
    expect((run('=SEQUENCE(10001)') as { error: { category: string } }).error.category).toBe(
      'out_of_range'
    );
  });
});
