import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from '../evaluator';

function run(formula: string): unknown {
  const cells = [{ name: 'r', kind: 'output' as const, formula }];
  return evaluateCalculator(cells, {}).r;
}

describe('logical functions', () => {
  it('IF short-circuits the unchosen branch', () => {
    // The else branch would divide by zero; we never reach it.
    expect(run('=IF(TRUE, 42, 1/0)')).toMatchObject({ value: 42 });
    expect(run('=IF(FALSE, 1/0, 42)')).toMatchObject({ value: 42 });
  });

  it('IFS returns the first matching branch', () => {
    expect(run('=IFS(FALSE, "a", TRUE, "b", TRUE, "c")')).toMatchObject({ value: 'b' });
  });

  it('IFS errors on odd arg count', () => {
    expect((run('=IFS(TRUE, 1, FALSE)') as { error: { category: string } }).error.category).toBe('wrong_type');
  });

  it('AND short-circuits at the first FALSE', () => {
    expect(run('=AND(TRUE, TRUE, FALSE, 1/0)')).toMatchObject({ value: false });
    expect(run('=AND(TRUE, TRUE)')).toMatchObject({ value: true });
  });

  it('OR short-circuits at the first TRUE', () => {
    expect(run('=OR(FALSE, TRUE, 1/0)')).toMatchObject({ value: true });
    expect(run('=OR(FALSE, FALSE)')).toMatchObject({ value: false });
  });

  it('NOT', () => {
    expect(run('=NOT(TRUE)')).toMatchObject({ value: false });
    expect(run('=NOT(FALSE)')).toMatchObject({ value: true });
  });
});
