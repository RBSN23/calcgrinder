import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from '../evaluator';

function run(formula: string): unknown {
  return evaluateCalculator(
    [{ name: 'r', kind: 'output' as const, formula }],
    {}
  ).r;
}

describe('string functions', () => {
  it('CONCAT', () => {
    expect(run('=CONCAT("hello", " ", "world")')).toMatchObject({ value: 'hello world' });
  });

  it('LEFT / RIGHT / MID', () => {
    expect(run('=LEFT("hello", 3)')).toMatchObject({ value: 'hel' });
    expect(run('=RIGHT("hello", 3)')).toMatchObject({ value: 'llo' });
    expect(run('=MID("hello", 2, 3)')).toMatchObject({ value: 'ell' });
  });

  it('LEN / LOWER / UPPER / TRIM', () => {
    expect(run('=LEN("hello")')).toMatchObject({ value: 5 });
    expect(run('=LOWER("HELLO")')).toMatchObject({ value: 'hello' });
    expect(run('=UPPER("hello")')).toMatchObject({ value: 'HELLO' });
    expect(run('=TRIM("  hello   world  ")')).toMatchObject({ value: 'hello world' });
  });

  it('SUBSTITUTE', () => {
    expect(run('=SUBSTITUTE("a b a b", "a", "X")')).toMatchObject({ value: 'X b X b' });
  });

  it('TEXT formats numbers', () => {
    expect(run('=TEXT(1234.567, "0.00")')).toMatchObject({ value: '1234.57' });
    expect(run('=TEXT(1234.5, "#,##0.00")')).toMatchObject({ value: '1,234.50' });
    expect(run('=TEXT(0.085, "0.00%")')).toMatchObject({ value: '8.50%' });
  });

  it('& operator concatenates strings', () => {
    expect(run('="hello " & "world"')).toMatchObject({ value: 'hello world' });
  });

  it('= comparison on strings', () => {
    expect(run('="a" = "a"')).toMatchObject({ value: true });
    expect(run('="a" = "b"')).toMatchObject({ value: false });
  });
});
