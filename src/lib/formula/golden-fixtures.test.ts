// Golden fixtures: end-to-end example calculators that double as
// regression coverage and live documentation of the function
// catalogue. Each fixture maps to specific acceptance criteria in
// the PROJ-7 spec.

import { describe, expect, it } from 'vitest';
import {
  evaluateCalculator,
  getStructuralErrors,
  type Cell,
} from './index';

describe('golden fixtures', () => {
  describe('mortgage calculator', () => {
    const cells: Cell[] = [
      { name: 'loan_amount', kind: 'input', input_type: 'currency', default_value: 200000 },
      { name: 'interest_rate', kind: 'input', input_type: 'percent', default_value: 0.06 },
      { name: 'term_years', kind: 'input', input_type: 'number', default_value: 30 },
      { name: 'monthly_rate', kind: 'output', formula: '=interest_rate / 12' },
      { name: 'num_payments', kind: 'output', formula: '=term_years * 12' },
      {
        name: 'monthly_payment',
        kind: 'output',
        formula: '=PMT(monthly_rate, num_payments, -loan_amount)',
      },
      {
        name: 'total_paid',
        kind: 'output',
        formula: '=monthly_payment * num_payments',
      },
      {
        name: 'total_interest',
        kind: 'output',
        formula: '=total_paid - loan_amount',
      },
    ];

    it('computes a clean, structurally-valid mortgage', () => {
      expect(getStructuralErrors(cells)).toEqual([]);
      const r = evaluateCalculator(cells, {});
      expect((r.monthly_payment.value as number)).toBeCloseTo(1199.1011, 2);
      expect((r.total_interest.value as number)).toBeGreaterThan(0);
    });

    it('still computes with visitor overrides', () => {
      const r = evaluateCalculator(cells, {
        loan_amount: 100000,
        interest_rate: 0.04,
        term_years: 15,
      });
      expect((r.monthly_payment.value as number)).toBeCloseTo(739.69, 1);
    });
  });

  describe('amortisation schedule (array_of_objects)', () => {
    const cells: Cell[] = [
      { name: 'loan_amount', kind: 'input', input_type: 'currency', default_value: 100000 },
      { name: 'monthly_rate', kind: 'input', input_type: 'percent', default_value: 0.005 },
      { name: 'num_payments', kind: 'input', input_type: 'number', default_value: 12 },
      {
        name: 'schedule',
        kind: 'output',
        formula: `=MAP(SEQUENCE(num_payments), i => OBJECT("month", i, "interest", ROUND(IPMT(monthly_rate, i, num_payments, -loan_amount), 2), "principal", ROUND(PPMT(monthly_rate, i, num_payments, -loan_amount), 2)))`,
      },
    ];

    it('produces array_of_objects', () => {
      const r = evaluateCalculator(cells, {});
      expect(r.schedule.shape).toBe('array_of_objects');
      const arr = r.schedule.value as { month: number; interest: number; principal: number }[];
      expect(arr).toHaveLength(12);
      expect(arr[0]!.month).toBe(1);
      expect(arr[0]!.interest).toBeGreaterThan(0);
      expect(arr[0]!.principal).toBeGreaterThan(0);
    });
  });

  describe('SaaS unit-econ calculator', () => {
    const cells: Cell[] = [
      { name: 'mrr', kind: 'input', input_type: 'currency', default_value: 100 },
      { name: 'gross_margin', kind: 'input', input_type: 'percent', default_value: 0.8 },
      { name: 'churn_rate', kind: 'input', input_type: 'percent', default_value: 0.05 },
      { name: 'cac', kind: 'input', input_type: 'currency', default_value: 200 },
      {
        name: 'lifetime_months',
        kind: 'output',
        formula: '=1 / churn_rate',
      },
      {
        name: 'ltv',
        kind: 'output',
        formula: '=mrr * gross_margin * lifetime_months',
      },
      {
        name: 'ltv_cac',
        kind: 'output',
        formula: '=ltv / cac',
      },
      {
        name: 'verdict',
        kind: 'output',
        formula: '=IF(ltv_cac >= 3, "healthy", "needs work")',
      },
    ];

    it('computes a healthy SaaS scenario', () => {
      const r = evaluateCalculator(cells, {});
      expect((r.lifetime_months.value as number)).toBe(20);
      expect((r.ltv.value as number)).toBe(1600);
      expect(r.ltv_cac.value).toBe(8);
      expect(r.verdict.value).toBe('healthy');
    });

    it('handles divide-by-zero in churn', () => {
      const r = evaluateCalculator(cells, { churn_rate: 0 });
      expect(r.lifetime_months.error?.category).toBe('divide_by_zero');
      // downstream cells propagate
      expect(r.ltv.error?.message).toContain('depends on lifetime_months');
    });
  });

  describe('text output', () => {
    const cells: Cell[] = [
      { name: 'price', kind: 'input', input_type: 'currency', default_value: 1234.5 },
      {
        name: 'summary',
        kind: 'output',
        formula: '="Total: $" & TEXT(price, "#,##0.00")',
      },
    ];
    it('builds a formatted string', () => {
      const r = evaluateCalculator(cells, {});
      expect(r.summary.value).toBe('Total: $1,234.50');
    });
  });

  describe('all-empty short-circuit (visitor first-paint)', () => {
    const cells: Cell[] = [
      { name: 'amount', kind: 'input', input_type: 'currency' },
      { name: 'rate', kind: 'input', input_type: 'percent' },
      { name: 'months', kind: 'input', input_type: 'number' },
      { name: 'payment', kind: 'output', formula: '=PMT(rate/12, months, -amount)' },
      { name: 'total', kind: 'output', formula: '=payment * months' },
    ];
    it('every output is empty on first paint', () => {
      const r = evaluateCalculator(cells, {});
      expect(r.payment.shape).toBe('empty');
      expect(r.total.shape).toBe('empty');
      expect(r.payment.error).toBeUndefined();
      expect(r.total.error).toBeUndefined();
    });
  });
});
