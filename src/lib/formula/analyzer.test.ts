import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetParseCache,
  getDependencies,
} from './analyzer';
import { getStructuralErrors } from './analyzer';
import type { Cell } from './types';

beforeEach(() => _resetParseCache());

function input(name: string): Cell {
  return { name, kind: 'input', input_type: 'number' };
}
function output(name: string, formula: string): Cell {
  return { name, kind: 'output', formula };
}

describe('getStructuralErrors', () => {
  it('returns empty for a clean calculator', () => {
    const cells = [input('rate'), output('doubled', '=rate * 2')];
    expect(getStructuralErrors(cells)).toEqual([]);
  });

  it('reports syntax errors', () => {
    const cells = [output('bad', '=PMT(1,')];
    const errs = getStructuralErrors(cells);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({ cellName: 'bad', category: 'syntax' });
  });

  it('reports unknown-name errors', () => {
    const cells = [output('bad', '=missing + 1')];
    const errs = getStructuralErrors(cells);
    expect(errs).toEqual([
      expect.objectContaining({ cellName: 'bad', category: 'unknown_name' }),
    ]);
    expect(errs[0]!.message).toContain('missing');
  });

  it('reports 2-cell cycles with full path', () => {
    const cells = [output('a', '=b + 1'), output('b', '=a + 1')];
    const errs = getStructuralErrors(cells);
    expect(errs).toHaveLength(2);
    for (const e of errs) {
      expect(e.category).toBe('cycle');
      expect(e.message).toMatch(/Cycle: .* → .* → .*/);
    }
    // Same path message across cycle members.
    expect(errs[0]!.message).toBe(errs[1]!.message);
  });

  it('reports a 5-cell cycle naming the full path', () => {
    const cells = [
      output('a', '=b'),
      output('b', '=c'),
      output('c', '=d'),
      output('d', '=e'),
      output('e', '=a'),
    ];
    const errs = getStructuralErrors(cells);
    expect(errs).toHaveLength(5);
    for (const e of errs) {
      expect(e.message).toBe('Cycle: a → b → c → d → e → a');
    }
  });

  it('reports a self-cycle as length-1 cycle', () => {
    const cells = [output('monthly_payment', '=monthly_payment + 1')];
    const errs = getStructuralErrors(cells);
    expect(errs).toEqual([
      expect.objectContaining({
        cellName: 'monthly_payment',
        category: 'cycle',
        message: 'Cycle: monthly_payment → monthly_payment',
      }),
    ]);
  });

  it('excludes runtime-only errors (divide_by_zero, wrong_type)', () => {
    const cells = [
      input('zero'),
      output('bad', '=1 / zero'),
    ];
    expect(getStructuralErrors(cells)).toEqual([]);
  });
});

describe('getDependencies', () => {
  it('returns transitive deps', () => {
    const cells = [
      input('a'),
      input('b'),
      output('c', '=a + b'),
      output('d', '=c * 2'),
    ];
    expect(getDependencies('d', cells).sort()).toEqual(['a', 'b', 'c']);
  });

  it('handles lambda-captured outer cells', () => {
    const cells = [
      input('multiplier'),
      output(
        'doubled_seq',
        '=MAP(SEQUENCE(3), i => i * multiplier)'
      ),
    ];
    expect(getDependencies('doubled_seq', cells)).toContain('multiplier');
  });

  it('does NOT treat lambda parameters as cell deps', () => {
    const cells = [
      output('seq', '=MAP(SEQUENCE(3), i => i * 2)'),
    ];
    expect(getDependencies('seq', cells)).toEqual([]);
  });
});
