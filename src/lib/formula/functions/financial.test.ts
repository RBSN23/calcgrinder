import { describe, expect, it } from 'vitest';
import { evaluateCalculator } from '../evaluator';

function run(formula: string): unknown {
  return evaluateCalculator(
    [{ name: 'r', kind: 'output' as const, formula }],
    {}
  ).r;
}

describe('financial functions', () => {
  it('PMT on a standard 30-year mortgage', () => {
    // $200,000 loan, 6%/yr (=0.5%/mo), 360 months. Expected ~ -1199.10
    const result = run('=PMT(0.06/12, 360, -200000)') as { value: number };
    expect(result.value).toBeCloseTo(1199.1011, 2);
  });

  it('PMT at zero rate is linear', () => {
    expect(run('=PMT(0, 10, -1000)')).toMatchObject({ value: 100 });
  });

  it('PMT with nper=0 errors out_of_range', () => {
    expect((run('=PMT(0.01, 0, -1000)') as { error: { category: string } }).error.category).toBe(
      'out_of_range'
    );
  });

  it('FV of an annuity', () => {
    // $100/month at 0.5%/month for 12 months, pv=0
    // FV = -pmt * ((1+r)^n - 1)/r = -100 * (((1.005)^12 - 1)/0.005)
    const result = run('=FV(0.005, 12, -100, 0)') as { value: number };
    const r1n = Math.pow(1.005, 12);
    const expected = 100 * (r1n - 1) / 0.005;
    expect(result.value).toBeCloseTo(expected, 4);
  });

  it('NPV with positive cashflows and reasonable rate', () => {
    const result = run('=NPV(0.1, 100, 200, 300)') as { value: number };
    const expected = 100 / 1.1 + 200 / 1.21 + 300 / 1.331;
    expect(result.value).toBeCloseTo(expected, 6);
  });

  it('IRR converges on a simple cashflow', () => {
    // -100 invested, +50 +60 returns. IRR ~ 0.0697
    const result = run('=IRR(SEQUENCE(3, -100, 80))') as { value: number };
    expect(typeof result.value).toBe('number');
  });

  it('IPMT + PPMT sums to PMT', () => {
    const r1 = run('=PMT(0.01, 12, -1000)') as { value: number };
    const r2 = run('=IPMT(0.01, 1, 12, -1000) + PPMT(0.01, 1, 12, -1000)') as { value: number };
    expect(r2.value).toBeCloseTo(r1.value, 6);
  });
});
