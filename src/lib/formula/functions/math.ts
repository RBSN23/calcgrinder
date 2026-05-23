// Math built-ins. Most of these propagate EMPTY (if any arg is the
// empty sentinel, the result is empty — visitor hasn't typed yet).

import {
  divideByZeroError,
  outOfRangeError,
  wrongTypeError,
} from '../errors';
import { coerceNumber, EMPTY } from '../values';
import {
  coerceInt,
  evalArgs,
  expectArity,
  expectMinArity,
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
  return { name, category: 'math', signature, parameters, short_description, evaluate };
}

export const MATH_FUNCTIONS: FunctionEntry[] = [
  entry('ABS', 'ABS(number)', [{ name: 'number', type: 'number' }],
    'Absolute value.', (args, ctx, scope) => {
      expectArity('ABS', args, 1);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      return Math.abs(coerceNumber(vs[0], 'ABS argument'));
    }),

  entry('ROUND', 'ROUND(number, digits?)', [
    { name: 'number', type: 'number' },
    { name: 'digits', type: 'integer', optional: true },
  ], 'Round to N decimal digits (default 0).', (args, ctx, scope) => {
    expectArity('ROUND', args, 1, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const n = coerceNumber(vs[0], 'ROUND number');
    const digits = vs.length === 2
      ? coerceInt(vs[1]!, 'ROUND digits', -15, 15)
      : 0;
    const m = Math.pow(10, digits);
    return Math.round(n * m) / m;
  }),

  entry('ROUNDUP', 'ROUNDUP(number, digits?)', [
    { name: 'number', type: 'number' },
    { name: 'digits', type: 'integer', optional: true },
  ], 'Round toward +∞ to N decimal digits.', (args, ctx, scope) => {
    expectArity('ROUNDUP', args, 1, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const n = coerceNumber(vs[0], 'ROUNDUP number');
    const digits = vs.length === 2 ? coerceInt(vs[1]!, 'ROUNDUP digits', -15, 15) : 0;
    const m = Math.pow(10, digits);
    return n >= 0 ? Math.ceil(n * m) / m : -Math.ceil(-n * m) / m;
  }),

  entry('ROUNDDOWN', 'ROUNDDOWN(number, digits?)', [
    { name: 'number', type: 'number' },
    { name: 'digits', type: 'integer', optional: true },
  ], 'Round toward zero to N decimal digits.', (args, ctx, scope) => {
    expectArity('ROUNDDOWN', args, 1, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const n = coerceNumber(vs[0], 'ROUNDDOWN number');
    const digits = vs.length === 2 ? coerceInt(vs[1]!, 'ROUNDDOWN digits', -15, 15) : 0;
    const m = Math.pow(10, digits);
    return Math.trunc(n * m) / m;
  }),

  entry('SQRT', 'SQRT(number)', [{ name: 'number', type: 'number' }],
    'Square root.', (args, ctx, scope) => {
      expectArity('SQRT', args, 1);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const n = coerceNumber(vs[0], 'SQRT argument');
      if (n < 0) throw outOfRangeError('SQRT of a negative number');
      return Math.sqrt(n);
    }),

  entry('POWER', 'POWER(base, exponent)', [
    { name: 'base', type: 'number' }, { name: 'exponent', type: 'number' },
  ], 'Raise base to exponent.', (args, ctx, scope) => {
    expectArity('POWER', args, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const base = coerceNumber(vs[0], 'POWER base');
    const exp = coerceNumber(vs[1], 'POWER exponent');
    const r = Math.pow(base, exp);
    if (!Number.isFinite(r)) throw outOfRangeError('POWER result is not finite');
    return r;
  }),

  entry('MIN', 'MIN(value1, value2, ...)', [
    { name: 'values', type: 'number', variadic: true },
  ], 'Smallest of the arguments. Empty values are ignored.',
    (args, ctx, scope) => {
      expectMinArity('MIN', args, 1);
      const vs = evalArgs(args, ctx, scope);
      const live = vs.filter((v) => v !== EMPTY);
      if (live.length === 0) return EMPTY;
      const ns = live.map((v, i) => coerceNumber(v, `MIN argument ${i + 1}`));
      return Math.min(...ns);
    }),

  entry('MAX', 'MAX(value1, value2, ...)', [
    { name: 'values', type: 'number', variadic: true },
  ], 'Largest of the arguments. Empty values are ignored.',
    (args, ctx, scope) => {
      expectMinArity('MAX', args, 1);
      const vs = evalArgs(args, ctx, scope);
      const live = vs.filter((v) => v !== EMPTY);
      if (live.length === 0) return EMPTY;
      const ns = live.map((v, i) => coerceNumber(v, `MAX argument ${i + 1}`));
      return Math.max(...ns);
    }),

  entry('MOD', 'MOD(dividend, divisor)', [
    { name: 'dividend', type: 'number' }, { name: 'divisor', type: 'number' },
  ], 'Remainder of dividend / divisor.', (args, ctx, scope) => {
    expectArity('MOD', args, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const a = coerceNumber(vs[0], 'MOD dividend');
    const b = coerceNumber(vs[1], 'MOD divisor');
    if (b === 0) throw divideByZeroError();
    return a - Math.floor(a / b) * b;
  }),

  entry('FLOOR', 'FLOOR(number, significance?)', [
    { name: 'number', type: 'number' },
    { name: 'significance', type: 'number', optional: true },
  ], 'Round down to the nearest multiple of significance (default 1).',
    (args, ctx, scope) => {
      expectArity('FLOOR', args, 1, 2);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const n = coerceNumber(vs[0], 'FLOOR number');
      const s = vs.length === 2 ? coerceNumber(vs[1], 'FLOOR significance') : 1;
      if (s === 0) throw divideByZeroError();
      return Math.floor(n / s) * s;
    }),

  entry('CEILING', 'CEILING(number, significance?)', [
    { name: 'number', type: 'number' },
    { name: 'significance', type: 'number', optional: true },
  ], 'Round up to the nearest multiple of significance (default 1).',
    (args, ctx, scope) => {
      expectArity('CEILING', args, 1, 2);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const n = coerceNumber(vs[0], 'CEILING number');
      const s = vs.length === 2 ? coerceNumber(vs[1], 'CEILING significance') : 1;
      if (s === 0) throw divideByZeroError();
      return Math.ceil(n / s) * s;
    }),

  entry('LOG', 'LOG(number, base?)', [
    { name: 'number', type: 'number' },
    { name: 'base', type: 'number', optional: true },
  ], 'Logarithm in given base (default 10).', (args, ctx, scope) => {
    expectArity('LOG', args, 1, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const n = coerceNumber(vs[0], 'LOG number');
    const base = vs.length === 2 ? coerceNumber(vs[1], 'LOG base') : 10;
    if (n <= 0) throw outOfRangeError('LOG of a non-positive number');
    if (base <= 0 || base === 1) throw outOfRangeError('LOG base must be positive and ≠ 1');
    return Math.log(n) / Math.log(base);
  }),

  entry('LN', 'LN(number)', [{ name: 'number', type: 'number' }],
    'Natural logarithm.', (args, ctx, scope) => {
      expectArity('LN', args, 1);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const n = coerceNumber(vs[0], 'LN argument');
      if (n <= 0) throw outOfRangeError('LN of a non-positive number');
      return Math.log(n);
    }),

  entry('EXP', 'EXP(number)', [{ name: 'number', type: 'number' }],
    'e raised to the power of number.', (args, ctx, scope) => {
      expectArity('EXP', args, 1);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const n = coerceNumber(vs[0], 'EXP argument');
      const r = Math.exp(n);
      if (!Number.isFinite(r)) throw outOfRangeError('EXP result is not finite');
      return r;
    }),

  entry('SIGN', 'SIGN(number)', [{ name: 'number', type: 'number' }],
    '+1, 0, or −1 according to the argument\'s sign.',
    (args, ctx, scope) => {
      expectArity('SIGN', args, 1);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      return Math.sign(coerceNumber(vs[0], 'SIGN argument'));
    }),

  entry('INT', 'INT(number)', [{ name: 'number', type: 'number' }],
    'Greatest integer ≤ number (toward −∞).', (args, ctx, scope) => {
      expectArity('INT', args, 1);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      return Math.floor(coerceNumber(vs[0], 'INT argument'));
    }),

  entry('RANDBETWEEN', 'RANDBETWEEN(low, high)', [
    { name: 'low', type: 'integer' }, { name: 'high', type: 'integer' },
  ], 'Random integer between low and high (inclusive).',
    (args, ctx, scope) => {
      expectArity('RANDBETWEEN', args, 2);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const lo = coerceInt(vs[0]!, 'RANDBETWEEN low');
      const hi = coerceInt(vs[1]!, 'RANDBETWEEN high');
      if (hi < lo) throw outOfRangeError('RANDBETWEEN high must be ≥ low');
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    }),
];

// `RANDBETWEEN` is non-deterministic — flag it so the volatile-mode
// description in the catalogue stays accurate.
for (const f of MATH_FUNCTIONS) {
  if (f.name === 'RANDBETWEEN') f.is_volatile = true;
}
