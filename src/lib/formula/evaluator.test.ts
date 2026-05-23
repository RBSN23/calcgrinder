import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from './evaluator';
import { EMPTY, makeDate } from './values';
import type { Cell } from './types';

function input(name: string, opts: Partial<Cell> = {}): Cell {
  return { name, kind: 'input', input_type: 'number', ...opts };
}
function output(name: string, formula: string): Cell {
  return { name, kind: 'output', formula };
}

describe('evaluateCalculator — basic arithmetic', () => {
  it('evaluates a chain of inputs and outputs', () => {
    const cells = [
      input('a'),
      input('b'),
      output('sum', '=a + b'),
      output('twice_sum', '=sum * 2'),
    ];
    const result = evaluateCalculator(cells, { a: 3, b: 5 });
    expect(result.sum).toMatchObject({ value: 8, shape: 'scalar' });
    expect(result.twice_sum).toMatchObject({ value: 16, shape: 'scalar' });
  });

  it('reports divide-by-zero with the plain-English message', () => {
    const cells = [input('divisor'), output('r', '=1 / divisor')];
    const result = evaluateCalculator(cells, { divisor: 0 });
    expect(result.r.error).toMatchObject({
      category: 'divide_by_zero',
      message: 'Division by zero',
    });
  });

  it('handles unary minus and operator precedence', () => {
    const cells = [output('r', '=-2^2')]; // = -(2^2) = -4
    const result = evaluateCalculator(cells, {});
    expect(result.r.value).toBe(-4);
  });
});

describe('evaluateCalculator — empty propagation', () => {
  it('propagates EMPTY when an input has no value and no default', () => {
    const cells = [
      input('amount'),
      output('doubled', '=amount * 2'),
    ];
    const result = evaluateCalculator(cells, {});
    expect(result.amount.shape).toBe('empty');
    expect(result.doubled.shape).toBe('empty');
    expect(result.doubled.error).toBeUndefined();
  });

  it('IF(ISEMPTY(...), 0, ...) opt-out lets the formula compute', () => {
    const cells = [
      input('deposit'),
      input('rate', { default_value: 0.05 }),
      output('result', '=IF(ISEMPTY(deposit), 0, deposit) * rate'),
    ];
    const result = evaluateCalculator(cells, {});
    expect(result.result).toMatchObject({ value: 0, shape: 'scalar' });
  });

  it('ISEMPTY and ISBLANK behave identically', () => {
    const cells = [
      input('x'),
      output('empty1', '=ISEMPTY(x)'),
      output('empty2', '=ISBLANK(x)'),
    ];
    expect(evaluateCalculator(cells, {}).empty1.value).toBe(true);
    expect(evaluateCalculator(cells, {}).empty2.value).toBe(true);
    expect(evaluateCalculator(cells, { x: 0 }).empty1.value).toBe(false);
    expect(evaluateCalculator(cells, { x: 0 }).empty2.value).toBe(false);
  });
});

describe('evaluateCalculator — type coercion', () => {
  it('treats percent input as a number', () => {
    const cells = [
      input('interest_rate', { input_type: 'percent' }),
      output('monthly', '=interest_rate / 12'),
    ];
    const result = evaluateCalculator(cells, { interest_rate: 0.0585 });
    expect(result.monthly.value).toBeCloseTo(0.004875, 7);
  });

  it('mixes currency and number with no type error', () => {
    const cells = [
      input('a', { input_type: 'currency' }),
      input('b', { input_type: 'number' }),
      output('sum', '=a + b'),
    ];
    const result = evaluateCalculator(cells, { a: 100, b: 50 });
    expect(result.sum).toMatchObject({ value: 150, shape: 'scalar' });
  });

  it('coerces boolean inputs to 0/1 in arithmetic', () => {
    const cells = [
      input('flag', { input_type: 'boolean' }),
      output('r', '=flag + 5'),
    ];
    expect(evaluateCalculator(cells, { flag: true }).r.value).toBe(6);
    expect(evaluateCalculator(cells, { flag: false }).r.value).toBe(5);
  });

  it('text in arithmetic throws wrong_type', () => {
    const cells = [
      input('label', { input_type: 'text' }),
      output('r', '=label + 1'),
    ];
    const result = evaluateCalculator(cells, { label: 'hello' });
    expect(result.r.error?.category).toBe('wrong_type');
  });
});

describe('evaluateCalculator — dates', () => {
  it('subtracts two dates to get integer days', () => {
    const cells = [
      input('start', { input_type: 'date' }),
      input('end', { input_type: 'date' }),
      output('days', '=end - start'),
    ];
    const result = evaluateCalculator(cells, {
      start: makeDate(0),
      end: makeDate(10),
    });
    expect(result.days.value).toBe(10);
  });

  it('adds an integer to a date to get a new date', () => {
    const cells = [
      input('d', { input_type: 'date' }),
      output('next', '=d + 7'),
    ];
    const result = evaluateCalculator(cells, { d: makeDate(100) });
    expect(result.next.value).toMatchObject({ epochDay: 107 });
  });
});

describe('evaluateCalculator — error propagation', () => {
  it('emits "↑ depends on …" for cells depending on an error', () => {
    const cells = [
      input('zero'),
      output('bad', '=1 / zero'),
      output('downstream', '=bad + 10'),
    ];
    const result = evaluateCalculator(cells, { zero: 0 });
    expect(result.bad.error?.category).toBe('divide_by_zero');
    expect(result.downstream.error?.category).toBe('runtime');
    expect(result.downstream.error?.message).toContain('↑ depends on bad');
  });

  it('cycle members all emit the same cycle message', () => {
    const cells = [
      { name: 'a', kind: 'output' as const, formula: '=b + 1' },
      { name: 'b', kind: 'output' as const, formula: '=a + 1' },
    ];
    const result = evaluateCalculator(cells, {});
    expect(result.a.error?.category).toBe('cycle');
    expect(result.b.error?.category).toBe('cycle');
    expect(result.a.error?.message).toBe(result.b.error?.message);
  });

  it('clears cycle errors once the cycle is broken', () => {
    const broken = [
      { name: 'a', kind: 'output' as const, formula: '=10' },
      { name: 'b', kind: 'output' as const, formula: '=a + 1' },
    ];
    const result = evaluateCalculator(broken, {});
    expect(result.a.error).toBeUndefined();
    expect(result.b.error).toBeUndefined();
    expect(result.b.value).toBe(11);
  });
});

describe('evaluateCalculator — shapes', () => {
  it('scalar shape for a number result', () => {
    const cells = [output('r', '=42')];
    expect(evaluateCalculator(cells, {}).r.shape).toBe('scalar');
  });

  it('array_of_scalars for SEQUENCE', () => {
    const cells = [output('s', '=SEQUENCE(5)')];
    expect(evaluateCalculator(cells, {}).s.shape).toBe('array_of_scalars');
    expect(evaluateCalculator(cells, {}).s.value).toEqual([1, 2, 3, 4, 5]);
  });

  it('array_of_objects for MAP returning OBJECT', () => {
    const cells = [
      output(
        'schedule',
        '=MAP(SEQUENCE(3), i => OBJECT("month", i, "payment", i * 100))'
      ),
    ];
    const r = evaluateCalculator(cells, {}).schedule;
    expect(r.shape).toBe('array_of_objects');
    expect(r.value).toEqual([
      { month: 1, payment: 100 },
      { month: 2, payment: 200 },
      { month: 3, payment: 300 },
    ]);
  });
});

describe('evaluateCalculator — array cap', () => {
  it('errors with out_of_range when an array would exceed 10000 rows', () => {
    const cells = [
      input('term_years'),
      output('schedule', '=SEQUENCE(term_years * 12)'),
    ];
    const result = evaluateCalculator(cells, { term_years: 1000 });
    expect(result.schedule.error).toMatchObject({
      category: 'out_of_range',
      message: 'Array result too large (limit: 10000 rows)',
    });
  });

  it('360 rows is fine', () => {
    const cells = [
      input('term_years'),
      output('schedule', '=SEQUENCE(term_years * 12)'),
    ];
    const result = evaluateCalculator(cells, { term_years: 30 });
    expect(result.schedule.error).toBeUndefined();
    const arr = result.schedule.value as number[];
    expect(arr).toHaveLength(360);
  });
});

describe('evaluateCalculator — volatile constants', () => {
  it('PI returns the math constant; PI() rejected as unknown', () => {
    const cells = [output('p', '=PI')];
    expect(evaluateCalculator(cells, {}).p.value).toBeCloseTo(Math.PI, 10);
  });

  it('TODAY() and NOW() share the same instant within a pass', () => {
    const cells = [
      output('t1', '=TODAY()'),
      output('t2', '=NOW()'),
    ];
    const result = evaluateCalculator(cells, {});
    const a = result.t1.value as { epochDay: number };
    const b = result.t2.value as { epochDay: number };
    expect(a.epochDay).toBe(b.epochDay);
  });

  it('rejects PI() with parens as unknown_name', () => {
    const cells = [output('p', '=PI()')];
    const result = evaluateCalculator(cells, {});
    expect(result.p.error?.category).toBe('unknown_name');
  });
});

describe('evaluateCalculator — sandboxing', () => {
  it('rejects globalThis / process / window as unknown_name', () => {
    for (const name of ['globalThis', 'process', 'window', '__proto__']) {
      const cells = [{ name: 'r', kind: 'output' as const, formula: `=${name}` }];
      const result = evaluateCalculator(cells, {});
      expect(result.r.error?.category).toBe('unknown_name');
    }
  });
});

describe('evaluateCalculator — duplicate OBJECT keys', () => {
  it('last value wins', () => {
    const cells = [output('o', '=OBJECT("k", 1, "k", 2)')];
    const result = evaluateCalculator(cells, {});
    expect(result.o.value).toEqual({ k: 2 });
  });
});

describe('evaluateCalculator — runtime errors do not block structural-clean cells', () => {
  it('returns void EMPTY value (not throw) for divide-by-zero', () => {
    const cells = [input('d'), output('r', '=1 / d')];
    const result = evaluateCalculator(cells, { d: 0 });
    expect(result.r.value).toBeUndefined();
    expect(result.r.error).toBeDefined();
  });
});
