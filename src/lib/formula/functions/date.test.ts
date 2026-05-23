import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from '../evaluator';
import { makeDate } from '../values';

function run(formula: string, inputs: Record<string, unknown> = {}): unknown {
  return evaluateCalculator(
    [
      { name: 'd', kind: 'input', input_type: 'date' },
      { name: 'r', kind: 'output', formula },
    ],
    inputs
  ).r;
}

describe('date functions', () => {
  it('DATE constructs an epoch-day date', () => {
    const r = run('=DATE(2026, 5, 23)') as { value: { epochDay: number } };
    // 2026-05-23 epoch days
    const expected = Math.floor(Date.UTC(2026, 4, 23) / 86_400_000);
    expect(r.value.epochDay).toBe(expected);
  });

  it('YEAR / MONTH / DAY decompose a date', () => {
    expect(run('=YEAR(DATE(2026, 5, 23))')).toMatchObject({ value: 2026 });
    expect(run('=MONTH(DATE(2026, 5, 23))')).toMatchObject({ value: 5 });
    expect(run('=DAY(DATE(2026, 5, 23))')).toMatchObject({ value: 23 });
  });

  it('DAYS returns integer day difference', () => {
    expect(run('=DAYS(DATE(2026, 1, 11), DATE(2026, 1, 1))')).toMatchObject({ value: 10 });
  });

  it('EDATE shifts by months', () => {
    const r = run('=YEAR(EDATE(DATE(2026, 1, 31), 1))') as { value: number };
    expect(r.value).toBe(2026);
  });

  it('EOMONTH returns last day of month', () => {
    // EOMONTH(2026-02-15, 0) should be 2026-02-28
    expect(run('=DAY(EOMONTH(DATE(2026, 2, 15), 0))')).toMatchObject({ value: 28 });
  });

  it('WEEKDAY (1=Sun … 7=Sat)', () => {
    // 2026-05-23 is a Saturday → 7
    expect(run('=WEEKDAY(DATE(2026, 5, 23))')).toMatchObject({ value: 7 });
  });

  it('date overflow → out_of_range', () => {
    const r = run('=DATE(9999, 12, 31) + 999999') as { error: { category: string } };
    expect(r.error.category).toBe('out_of_range');
  });

  it('input dates flow through', () => {
    expect(run('=YEAR(d)', { d: makeDate(0) })).toMatchObject({ value: 1970 });
  });
});
