import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from '../evaluator';

function run(formula: string): unknown {
  const cells = [{ name: 'r', kind: 'output' as const, formula }];
  return evaluateCalculator(cells, {}).r;
}

describe('math functions', () => {
  it('ABS', () => {
    expect(run('=ABS(-3.5)')).toMatchObject({ value: 3.5 });
  });

  it('ROUND with default and explicit digits', () => {
    expect(run('=ROUND(1.5)')).toMatchObject({ value: 2 });
    expect(run('=ROUND(1.456, 2)')).toMatchObject({ value: 1.46 });
  });

  it('ROUNDUP and ROUNDDOWN', () => {
    expect(run('=ROUNDUP(1.1)')).toMatchObject({ value: 2 });
    expect(run('=ROUNDDOWN(1.9)')).toMatchObject({ value: 1 });
    expect(run('=ROUNDUP(-1.1)')).toMatchObject({ value: -2 });
    expect(run('=ROUNDDOWN(-1.9)')).toMatchObject({ value: -1 });
  });

  it('SQRT of negative throws out_of_range', () => {
    expect((run('=SQRT(-1)') as { error: { category: string } }).error.category).toBe('out_of_range');
  });

  it('POWER', () => {
    expect(run('=POWER(2, 10)')).toMatchObject({ value: 1024 });
  });

  it('MIN and MAX', () => {
    expect(run('=MIN(3, 1, 4, 1, 5)')).toMatchObject({ value: 1 });
    expect(run('=MAX(3, 1, 4, 1, 5)')).toMatchObject({ value: 5 });
  });

  it('MOD with zero divisor errors', () => {
    expect((run('=MOD(5, 0)') as { error: { category: string } }).error.category).toBe('divide_by_zero');
  });

  it('FLOOR / CEILING with significance', () => {
    expect(run('=FLOOR(7, 3)')).toMatchObject({ value: 6 });
    expect(run('=CEILING(7, 3)')).toMatchObject({ value: 9 });
  });

  it('LOG / LN / EXP', () => {
    expect(run('=LOG(100, 10)')).toMatchObject({ value: 2 });
    expect(run('=LN(EXP(1))')).toMatchObject({ value: expect.closeTo(1, 10) });
  });

  it('LOG of negative errors', () => {
    expect((run('=LOG(-1)') as { error: { category: string } }).error.category).toBe('out_of_range');
  });

  it('SIGN', () => {
    expect(run('=SIGN(-5)')).toMatchObject({ value: -1 });
    expect(run('=SIGN(0)')).toMatchObject({ value: 0 });
    expect(run('=SIGN(5)')).toMatchObject({ value: 1 });
  });

  it('INT rounds toward -∞', () => {
    expect(run('=INT(-1.5)')).toMatchObject({ value: -2 });
    expect(run('=INT(1.9)')).toMatchObject({ value: 1 });
  });

  it('RANDBETWEEN respects bounds', () => {
    for (let i = 0; i < 20; i++) {
      const r = run('=RANDBETWEEN(1, 10)') as { value: number };
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(10);
      expect(Number.isInteger(r.value)).toBe(true);
    }
  });
});
