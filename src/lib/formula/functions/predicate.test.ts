import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from '../evaluator';
import type { Cell } from '../types';

describe('predicate functions', () => {
  it('ISEMPTY / ISBLANK on an empty input is TRUE', () => {
    const cells: Cell[] = [
      { name: 'x', kind: 'input', input_type: 'number' },
      { name: 'a', kind: 'output', formula: '=ISEMPTY(x)' },
      { name: 'b', kind: 'output', formula: '=ISBLANK(x)' },
    ];
    const result = evaluateCalculator(cells, {});
    expect(result.a.value).toBe(true);
    expect(result.b.value).toBe(true);
  });

  it('ISEMPTY on 0 is FALSE', () => {
    const cells: Cell[] = [
      { name: 'x', kind: 'input', input_type: 'number' },
      { name: 'r', kind: 'output', formula: '=ISEMPTY(x)' },
    ];
    expect(evaluateCalculator(cells, { x: 0 }).r.value).toBe(false);
  });

  it('ISNUMBER / ISTEXT', () => {
    const cells: Cell[] = [
      { name: 'a', kind: 'output', formula: '=ISNUMBER(42)' },
      { name: 'b', kind: 'output', formula: '=ISTEXT("hi")' },
      { name: 'c', kind: 'output', formula: '=ISNUMBER("hi")' },
    ];
    const r = evaluateCalculator(cells, {});
    expect(r.a.value).toBe(true);
    expect(r.b.value).toBe(true);
    expect(r.c.value).toBe(false);
  });
});
