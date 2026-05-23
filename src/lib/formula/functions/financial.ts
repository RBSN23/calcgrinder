// Financial built-ins.
//
// Convention follows Excel: PMT/PV/FV use sign-bearing cash flows
// (deposits positive, withdrawals negative). When borrowing money,
// authors pass `-loan_amount` per the spec's example. All formulas
// guard against degenerate parameters and emit `out_of_range` rather
// than NaN.

import { outOfRangeError } from '../errors';
import { coerceNumber } from '../values';
import {
  coerceInt,
  evalArgs,
  expectArity,
  propagateEmpty,
} from './helpers';
import type { FunctionEntry } from './types';

function entry(
  name: string,
  signature: string,
  parameters: FunctionEntry['parameters'],
  short_description: string,
  evaluate: FunctionEntry['evaluate']
): FunctionEntry {
  return { name, category: 'financial', signature, parameters, short_description, evaluate };
}

function pmtCore(rate: number, nper: number, pv: number, fv = 0, when: 0 | 1 = 0): number {
  if (nper <= 0) throw outOfRangeError('PMT periods must be > 0');
  if (rate === 0) return -(pv + fv) / nper;
  const r1n = Math.pow(1 + rate, nper);
  const pmt = -(pv * r1n + fv) * rate / ((1 + rate * when) * (r1n - 1));
  if (!Number.isFinite(pmt)) throw outOfRangeError('PMT result is not finite');
  return pmt;
}

function fvCore(rate: number, nper: number, pmt: number, pv: number, when: 0 | 1): number {
  if (rate === 0) return -(pv + pmt * nper);
  const r1n = Math.pow(1 + rate, nper);
  return -(pv * r1n + pmt * (1 + rate * when) * (r1n - 1) / rate);
}

function pvCore(rate: number, nper: number, pmt: number, fv: number, when: 0 | 1): number {
  if (rate === 0) return -(pmt * nper + fv);
  const r1n = Math.pow(1 + rate, nper);
  return -(pmt * (1 + rate * when) * (r1n - 1) / rate + fv) / r1n;
}

// Interest portion of payment in period `per`.
function ipmtCore(rate: number, per: number, nper: number, pv: number, fv = 0, when: 0 | 1 = 0): number {
  const pmt = pmtCore(rate, nper, pv, fv, when);
  if (rate === 0) return 0;
  // Balance at end of period (per-1):
  const r1n = Math.pow(1 + rate, per - 1);
  const balanceBefore = pv * r1n + pmt * (r1n - 1) / rate;
  let interest = -balanceBefore * rate;
  if (when === 1 && per > 1) interest /= (1 + rate);
  if (when === 1 && per === 1) interest = 0;
  return interest;
}

function ppmtCore(rate: number, per: number, nper: number, pv: number, fv = 0, when: 0 | 1 = 0): number {
  return pmtCore(rate, nper, pv, fv, when) - ipmtCore(rate, per, nper, pv, fv, when);
}

export const FINANCIAL_FUNCTIONS: FunctionEntry[] = [
  entry('PMT', 'PMT(rate, nper, pv, fv?, type?)', [
    { name: 'rate', type: 'number' },
    { name: 'nper', type: 'number' },
    { name: 'pv', type: 'number' },
    { name: 'fv', type: 'number', optional: true },
    { name: 'type', type: 'integer', optional: true },
  ], 'Periodic loan/annuity payment.', (args, ctx, scope) => {
    expectArity('PMT', args, 3, 5);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const [rate, nper, pv, fv = 0, type = 0] = vs as number[];
    return pmtCore(
      coerceNumber(rate, 'PMT rate'),
      coerceNumber(nper, 'PMT nper'),
      coerceNumber(pv, 'PMT pv'),
      coerceNumber(fv, 'PMT fv'),
      type ? 1 : 0
    );
  }),

  entry('FV', 'FV(rate, nper, pmt, pv?, type?)', [
    { name: 'rate', type: 'number' },
    { name: 'nper', type: 'number' },
    { name: 'pmt', type: 'number' },
    { name: 'pv', type: 'number', optional: true },
    { name: 'type', type: 'integer', optional: true },
  ], 'Future value of an annuity.', (args, ctx, scope) => {
    expectArity('FV', args, 3, 5);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const rate = coerceNumber(vs[0], 'FV rate');
    const nper = coerceNumber(vs[1], 'FV nper');
    const pmt = coerceNumber(vs[2], 'FV pmt');
    const pv = vs.length >= 4 ? coerceNumber(vs[3], 'FV pv') : 0;
    const type = vs.length >= 5 ? (coerceInt(vs[4]!, 'FV type', 0, 1) as 0 | 1) : 0;
    return fvCore(rate, nper, pmt, pv, type);
  }),

  entry('PV', 'PV(rate, nper, pmt, fv?, type?)', [
    { name: 'rate', type: 'number' },
    { name: 'nper', type: 'number' },
    { name: 'pmt', type: 'number' },
    { name: 'fv', type: 'number', optional: true },
    { name: 'type', type: 'integer', optional: true },
  ], 'Present value of an annuity.', (args, ctx, scope) => {
    expectArity('PV', args, 3, 5);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const rate = coerceNumber(vs[0], 'PV rate');
    const nper = coerceNumber(vs[1], 'PV nper');
    const pmt = coerceNumber(vs[2], 'PV pmt');
    const fv = vs.length >= 4 ? coerceNumber(vs[3], 'PV fv') : 0;
    const type = vs.length >= 5 ? (coerceInt(vs[4]!, 'PV type', 0, 1) as 0 | 1) : 0;
    return pvCore(rate, nper, pmt, fv, type);
  }),

  entry('NPV', 'NPV(rate, value1, value2, ...)', [
    { name: 'rate', type: 'number' },
    { name: 'values', type: 'number', variadic: true },
  ], 'Net present value of a stream of future cash flows.',
    (args, ctx, scope) => {
      if (args.length < 2) throw outOfRangeError('NPV requires at least 2 arguments');
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const rate = coerceNumber(vs[0], 'NPV rate');
      // Flatten one level — authors often pass SEQUENCE/MAP output.
      const cashFlows: number[] = [];
      for (let i = 1; i < vs.length; i++) {
        const v = vs[i];
        if (Array.isArray(v)) {
          for (const inner of v) cashFlows.push(coerceNumber(inner, `NPV value ${i}`));
        } else {
          cashFlows.push(coerceNumber(v, `NPV value ${i}`));
        }
      }
      return cashFlows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, i + 1), 0);
    }),

  entry('IRR', 'IRR(cashflows, guess?)', [
    { name: 'cashflows', type: 'array_of_numbers' },
    { name: 'guess', type: 'number', optional: true },
  ], 'Internal rate of return via Newton-Raphson.', (args, ctx, scope) => {
    expectArity('IRR', args, 1, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const series = vs[0];
    if (!Array.isArray(series)) {
      throw outOfRangeError('IRR cashflows must be an array');
    }
    const cf = series.map((x, i) => coerceNumber(x, `IRR cashflow[${i}]`));
    if (cf.length < 2) throw outOfRangeError('IRR needs at least 2 cashflows');
    let r = vs.length === 2 ? coerceNumber(vs[1], 'IRR guess') : 0.1;
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0, dnpv = 0;
      for (let t = 0; t < cf.length; t++) {
        const d = Math.pow(1 + r, t);
        npv += cf[t]! / d;
        dnpv -= t * cf[t]! / (d * (1 + r));
      }
      if (Math.abs(npv) < 1e-9) return r;
      if (dnpv === 0) break;
      r -= npv / dnpv;
    }
    throw outOfRangeError('IRR did not converge');
  }),

  entry('RATE', 'RATE(nper, pmt, pv, fv?, type?, guess?)', [
    { name: 'nper', type: 'number' },
    { name: 'pmt', type: 'number' },
    { name: 'pv', type: 'number' },
    { name: 'fv', type: 'number', optional: true },
    { name: 'type', type: 'integer', optional: true },
    { name: 'guess', type: 'number', optional: true },
  ], 'Periodic interest rate of an annuity.', (args, ctx, scope) => {
    expectArity('RATE', args, 3, 6);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const nper = coerceNumber(vs[0], 'RATE nper');
    const pmt = coerceNumber(vs[1], 'RATE pmt');
    const pv = coerceNumber(vs[2], 'RATE pv');
    const fv = vs.length >= 4 ? coerceNumber(vs[3], 'RATE fv') : 0;
    const type = vs.length >= 5 ? (coerceInt(vs[4]!, 'RATE type', 0, 1) as 0 | 1) : 0;
    let r = vs.length === 6 ? coerceNumber(vs[5], 'RATE guess') : 0.1;
    // Newton-Raphson on FV equation: pv*(1+r)^n + pmt*(1+r*type)*((1+r)^n - 1)/r + fv = 0
    for (let i = 0; i < 100; i++) {
      const r1n = Math.pow(1 + r, nper);
      const f = pv * r1n + pmt * (1 + r * type) * (r1n - 1) / r + fv;
      if (Math.abs(f) < 1e-9) return r;
      // numerical derivative
      const eps = 1e-7;
      const r2 = r + eps;
      const r1n2 = Math.pow(1 + r2, nper);
      const f2 = pv * r1n2 + pmt * (1 + r2 * type) * (r1n2 - 1) / r2 + fv;
      const df = (f2 - f) / eps;
      if (df === 0) break;
      r -= f / df;
    }
    throw outOfRangeError('RATE did not converge');
  }),

  entry('NPER', 'NPER(rate, pmt, pv, fv?, type?)', [
    { name: 'rate', type: 'number' },
    { name: 'pmt', type: 'number' },
    { name: 'pv', type: 'number' },
    { name: 'fv', type: 'number', optional: true },
    { name: 'type', type: 'integer', optional: true },
  ], 'Number of periods of an annuity.', (args, ctx, scope) => {
    expectArity('NPER', args, 3, 5);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const rate = coerceNumber(vs[0], 'NPER rate');
    const pmt = coerceNumber(vs[1], 'NPER pmt');
    const pv = coerceNumber(vs[2], 'NPER pv');
    const fv = vs.length >= 4 ? coerceNumber(vs[3], 'NPER fv') : 0;
    const type = vs.length >= 5 ? (coerceInt(vs[4]!, 'NPER type', 0, 1) as 0 | 1) : 0;
    if (rate === 0) {
      if (pmt === 0) throw outOfRangeError('NPER: pmt and rate cannot both be zero');
      return -(pv + fv) / pmt;
    }
    const c = pmt * (1 + rate * type) / rate;
    const num = c - fv;
    const den = pv + c;
    if (num / den <= 0) throw outOfRangeError('NPER not solvable with given inputs');
    return Math.log(num / den) / Math.log(1 + rate);
  }),

  entry('IPMT', 'IPMT(rate, per, nper, pv, fv?, type?)', [
    { name: 'rate', type: 'number' },
    { name: 'per', type: 'integer' },
    { name: 'nper', type: 'number' },
    { name: 'pv', type: 'number' },
    { name: 'fv', type: 'number', optional: true },
    { name: 'type', type: 'integer', optional: true },
  ], 'Interest portion of payment in given period.', (args, ctx, scope) => {
    expectArity('IPMT', args, 4, 6);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const rate = coerceNumber(vs[0], 'IPMT rate');
    const per = coerceInt(vs[1]!, 'IPMT per', 1);
    const nper = coerceNumber(vs[2], 'IPMT nper');
    const pv = coerceNumber(vs[3], 'IPMT pv');
    const fv = vs.length >= 5 ? coerceNumber(vs[4], 'IPMT fv') : 0;
    const type = vs.length >= 6 ? (coerceInt(vs[5]!, 'IPMT type', 0, 1) as 0 | 1) : 0;
    return ipmtCore(rate, per, nper, pv, fv, type);
  }),

  entry('PPMT', 'PPMT(rate, per, nper, pv, fv?, type?)', [
    { name: 'rate', type: 'number' },
    { name: 'per', type: 'integer' },
    { name: 'nper', type: 'number' },
    { name: 'pv', type: 'number' },
    { name: 'fv', type: 'number', optional: true },
    { name: 'type', type: 'integer', optional: true },
  ], 'Principal portion of payment in given period.', (args, ctx, scope) => {
    expectArity('PPMT', args, 4, 6);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const rate = coerceNumber(vs[0], 'PPMT rate');
    const per = coerceInt(vs[1]!, 'PPMT per', 1);
    const nper = coerceNumber(vs[2], 'PPMT nper');
    const pv = coerceNumber(vs[3], 'PPMT pv');
    const fv = vs.length >= 5 ? coerceNumber(vs[4], 'PPMT fv') : 0;
    const type = vs.length >= 6 ? (coerceInt(vs[5]!, 'PPMT type', 0, 1) as 0 | 1) : 0;
    return ppmtCore(rate, per, nper, pv, fv, type);
  }),

  entry('CUMIPMT', 'CUMIPMT(rate, nper, pv, start_period, end_period, type?)', [
    { name: 'rate', type: 'number' },
    { name: 'nper', type: 'number' },
    { name: 'pv', type: 'number' },
    { name: 'start_period', type: 'integer' },
    { name: 'end_period', type: 'integer' },
    { name: 'type', type: 'integer', optional: true },
  ], 'Cumulative interest paid between two periods.', (args, ctx, scope) => {
    expectArity('CUMIPMT', args, 5, 6);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const rate = coerceNumber(vs[0], 'CUMIPMT rate');
    const nper = coerceNumber(vs[1], 'CUMIPMT nper');
    const pv = coerceNumber(vs[2], 'CUMIPMT pv');
    const start = coerceInt(vs[3]!, 'CUMIPMT start_period', 1);
    const end = coerceInt(vs[4]!, 'CUMIPMT end_period', 1);
    const type = vs.length >= 6 ? (coerceInt(vs[5]!, 'CUMIPMT type', 0, 1) as 0 | 1) : 0;
    if (start > end) throw outOfRangeError('CUMIPMT start_period must be ≤ end_period');
    let total = 0;
    for (let p = start; p <= end; p++) total += ipmtCore(rate, p, nper, pv, 0, type);
    return total;
  }),
];
