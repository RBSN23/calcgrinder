// String built-ins.

import { wrongTypeError } from '../errors';
import { coerceString, EMPTY, isDate, epochDayToDate, isEmpty } from '../values';
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
  return { name, category: 'string', signature, parameters, short_description, evaluate };
}

function formatNumber(n: number, pattern: string): string {
  // Subset of Excel TEXT format codes.
  // Supports: 0 (digit), # (optional digit), . (decimal sep), , (thousands),
  // % (multiply by 100 + append %).
  if (pattern === '') return String(n);
  let value = n;
  let suffix = '';
  if (pattern.endsWith('%')) {
    value = n * 100;
    suffix = '%';
    pattern = pattern.slice(0, -1);
  }

  const [intPart = '', fracPart = ''] = pattern.split('.');
  const decimals = fracPart.replace(/[^0#]/g, '').length;
  const useThousands = intPart.includes(',');
  const rounded = value.toFixed(decimals);
  const [, fracDigits = ''] = rounded.split('.');
  let [intDigits] = rounded.split('.');
  const negative = intDigits!.startsWith('-');
  if (negative) intDigits = intDigits!.slice(1);
  if (useThousands) {
    intDigits = intDigits!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  let out = intDigits;
  if (decimals > 0) out += '.' + fracDigits!.padEnd(decimals, '0');
  return (negative ? '-' : '') + out + suffix;
}

function formatDate(epochDay: number, pattern: string): string {
  const d = epochDayToDate(epochDay);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  // Tokens (longest first to avoid partial matches):
  return pattern
    .replace(/yyyy/g, String(y))
    .replace(/yy/g, pad(y % 100, 2))
    .replace(/mm/g, pad(m, 2))
    .replace(/m/g, String(m))
    .replace(/dd/g, pad(day, 2))
    .replace(/d/g, String(day));
}

export const STRING_FUNCTIONS: FunctionEntry[] = [
  entry('CONCAT', 'CONCAT(text1, text2, ...)', [
    { name: 'texts', type: 'text', variadic: true },
  ], 'Concatenate text arguments.', (args, ctx, scope) => {
    expectMinArity('CONCAT', args, 1);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    return vs.map((v, i) => coerceString(v, `CONCAT argument ${i + 1}`)).join('');
  }),

  entry('LEFT', 'LEFT(text, n)', [
    { name: 'text', type: 'text' }, { name: 'n', type: 'integer' },
  ], 'First N characters of text.', (args, ctx, scope) => {
    expectArity('LEFT', args, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    return coerceString(vs[0], 'LEFT text').slice(0, Math.max(0, coerceInt(vs[1]!, 'LEFT n', 0)));
  }),

  entry('RIGHT', 'RIGHT(text, n)', [
    { name: 'text', type: 'text' }, { name: 'n', type: 'integer' },
  ], 'Last N characters of text.', (args, ctx, scope) => {
    expectArity('RIGHT', args, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const s = coerceString(vs[0], 'RIGHT text');
    const n = Math.max(0, coerceInt(vs[1]!, 'RIGHT n', 0));
    return n === 0 ? '' : s.slice(-n);
  }),

  entry('MID', 'MID(text, start, length)', [
    { name: 'text', type: 'text' },
    { name: 'start', type: 'integer' },
    { name: 'length', type: 'integer' },
  ], 'Substring starting at 1-based start, of given length.',
    (args, ctx, scope) => {
      expectArity('MID', args, 3);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const s = coerceString(vs[0], 'MID text');
      const start = coerceInt(vs[1]!, 'MID start', 1) - 1;
      const len = coerceInt(vs[2]!, 'MID length', 0);
      return s.slice(start, start + len);
    }),

  entry('LEN', 'LEN(text)', [{ name: 'text', type: 'text' }],
    'Length of text in characters.', (args, ctx, scope) => {
      expectArity('LEN', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      if (isEmpty(v)) return EMPTY;
      return coerceString(v, 'LEN argument').length;
    }),

  entry('LOWER', 'LOWER(text)', [{ name: 'text', type: 'text' }],
    'Lowercase text.', (args, ctx, scope) => {
      expectArity('LOWER', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      if (isEmpty(v)) return EMPTY;
      return coerceString(v, 'LOWER argument').toLowerCase();
    }),

  entry('UPPER', 'UPPER(text)', [{ name: 'text', type: 'text' }],
    'Uppercase text.', (args, ctx, scope) => {
      expectArity('UPPER', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      if (isEmpty(v)) return EMPTY;
      return coerceString(v, 'UPPER argument').toUpperCase();
    }),

  entry('TRIM', 'TRIM(text)', [{ name: 'text', type: 'text' }],
    'Remove leading / trailing / extra whitespace.', (args, ctx, scope) => {
      expectArity('TRIM', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      if (isEmpty(v)) return EMPTY;
      return coerceString(v, 'TRIM argument').trim().replace(/\s+/g, ' ');
    }),

  entry('SUBSTITUTE', 'SUBSTITUTE(text, old, new)', [
    { name: 'text', type: 'text' },
    { name: 'old', type: 'text' },
    { name: 'new', type: 'text' },
  ], 'Replace every occurrence of old with new.', (args, ctx, scope) => {
    expectArity('SUBSTITUTE', args, 3);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const s = coerceString(vs[0], 'SUBSTITUTE text');
    const o = coerceString(vs[1], 'SUBSTITUTE old');
    const n = coerceString(vs[2], 'SUBSTITUTE new');
    return o === '' ? s : s.split(o).join(n);
  }),

  entry('TEXT', 'TEXT(value, format)', [
    { name: 'value', type: 'number_or_date' },
    { name: 'format', type: 'text' },
  ], 'Format a number or date as text. Supports 0/#/.//%/, for numbers and yyyy/mm/dd for dates.',
    (args, ctx, scope) => {
      expectArity('TEXT', args, 2);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const fmt = coerceString(vs[1], 'TEXT format');
      const value = vs[0];
      if (typeof value === 'number') return formatNumber(value, fmt);
      if (isDate(value)) return formatDate(value.epochDay, fmt);
      throw wrongTypeError('TEXT first argument must be a number or date');
    }),
];
