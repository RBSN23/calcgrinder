// Aggregation / descriptive statistics. Per spec, empty values are
// ignored — `SUM(a, b, c)` with `b` empty returns `a + c`; all-empty
// returns EMPTY. Arrays are auto-flattened one level.

import {
  outOfRangeError,
  wrongTypeError,
} from '../errors';
import { coerceNumber, EMPTY, isEmpty } from '../values';
import {
  coerceNumberArray,
  evalArgs,
  expectArity,
  expectMinArity,
  flattenForAggregation,
} from './helpers';
import type { AstNode } from '../ast';
import type { FunctionEntry, EvalContext, Scope } from './types';

function entry(
  name: string,
  signature: string,
  parameters: FunctionEntry['parameters'],
  short_description: string,
  evaluate: FunctionEntry['evaluate']
): FunctionEntry {
  return { name, category: 'statistical', signature, parameters, short_description, evaluate };
}

// SUMIF / COUNTIF accept a lambda as the criterion. The spec's
// architecture decision locked "lambda only, no Excel criterion
// strings" — one predicate vocabulary across the engine.
function evalPredicate(
  fnName: string,
  predicateAst: AstNode,
  ctx: EvalContext,
  scope: Scope,
  x: unknown
): boolean {
  if (predicateAst.type !== 'Lambda') {
    throw wrongTypeError(`${fnName} predicate must be a lambda (e.g. x => x > 100)`);
  }
  if (predicateAst.params.length !== 1) {
    throw wrongTypeError(`${fnName} predicate lambda must take exactly one parameter`);
  }
  const inner: Scope = new Map(scope);
  inner.set(predicateAst.params[0]!, x);
  const r = ctx.evalNode(predicateAst.body, inner);
  if (isEmpty(r)) return false;
  if (typeof r === 'boolean') return r;
  if (typeof r === 'number') return r !== 0;
  throw wrongTypeError(`${fnName} predicate must return a boolean`);
}

export const STATISTICAL_FUNCTIONS: FunctionEntry[] = [
  entry('SUM', 'SUM(value1, value2, ...)', [
    { name: 'values', type: 'number', variadic: true },
  ], 'Sum of arguments. Empty values are ignored.', (args, ctx, scope) => {
    expectMinArity('SUM', args, 1);
    const vs = flattenForAggregation(evalArgs(args, ctx, scope))
      .filter((v) => !isEmpty(v));
    if (vs.length === 0) return EMPTY;
    return coerceNumberArray('SUM', vs).reduce((a, b) => a + b, 0);
  }),

  entry('AVERAGE', 'AVERAGE(value1, value2, ...)', [
    { name: 'values', type: 'number', variadic: true },
  ], 'Arithmetic mean. Empty values are ignored.', (args, ctx, scope) => {
    expectMinArity('AVERAGE', args, 1);
    const vs = flattenForAggregation(evalArgs(args, ctx, scope))
      .filter((v) => !isEmpty(v));
    if (vs.length === 0) return EMPTY;
    const nums = coerceNumberArray('AVERAGE', vs);
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }),

  entry('COUNT', 'COUNT(value1, value2, ...)', [
    { name: 'values', type: 'any', variadic: true },
  ], 'Count of numeric arguments. Empty values are ignored.',
    (args, ctx, scope) => {
      expectMinArity('COUNT', args, 1);
      const vs = flattenForAggregation(evalArgs(args, ctx, scope));
      return vs.filter((v) => typeof v === 'number' && Number.isFinite(v)).length;
    }),

  entry('MEDIAN', 'MEDIAN(value1, value2, ...)', [
    { name: 'values', type: 'number', variadic: true },
  ], 'Median value. Empty values are ignored.', (args, ctx, scope) => {
    expectMinArity('MEDIAN', args, 1);
    const vs = flattenForAggregation(evalArgs(args, ctx, scope))
      .filter((v) => !isEmpty(v));
    if (vs.length === 0) return EMPTY;
    const sorted = coerceNumberArray('MEDIAN', vs).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }),

  entry('STDEV', 'STDEV(value1, value2, ...)', [
    { name: 'values', type: 'number', variadic: true },
  ], 'Sample standard deviation. Empty values are ignored.',
    (args, ctx, scope) => {
      expectMinArity('STDEV', args, 1);
      const vs = flattenForAggregation(evalArgs(args, ctx, scope))
        .filter((v) => !isEmpty(v));
      if (vs.length < 2) throw outOfRangeError('STDEV needs at least 2 non-empty values');
      const nums = coerceNumberArray('STDEV', vs);
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const sq = nums.reduce((a, b) => a + (b - mean) ** 2, 0);
      return Math.sqrt(sq / (nums.length - 1));
    }),

  entry('PRODUCT', 'PRODUCT(value1, value2, ...)', [
    { name: 'values', type: 'number', variadic: true },
  ], 'Product of arguments. Empty values are ignored.',
    (args, ctx, scope) => {
      expectMinArity('PRODUCT', args, 1);
      const vs = flattenForAggregation(evalArgs(args, ctx, scope))
        .filter((v) => !isEmpty(v));
      if (vs.length === 0) return EMPTY;
      return coerceNumberArray('PRODUCT', vs).reduce((a, b) => a * b, 1);
    }),

  entry('SUMIF', 'SUMIF(range, predicate)', [
    { name: 'range', type: 'array' },
    { name: 'predicate', type: 'lambda' },
  ], 'Sum elements of an array matching the predicate lambda.',
    (args, ctx, scope) => {
      expectArity('SUMIF', args, 2);
      const range = ctx.evalNode(args[0]!, scope);
      if (isEmpty(range)) return EMPTY;
      if (!Array.isArray(range)) throw wrongTypeError('SUMIF first argument must be an array');
      let total = 0;
      let count = 0;
      for (const x of range) {
        if (isEmpty(x)) continue;
        if (evalPredicate('SUMIF', args[1]!, ctx, scope, x)) {
          total += coerceNumber(x, 'SUMIF element');
          count++;
        }
      }
      return count === 0 ? 0 : total;
    }),

  entry('COUNTIF', 'COUNTIF(range, predicate)', [
    { name: 'range', type: 'array' },
    { name: 'predicate', type: 'lambda' },
  ], 'Count elements of an array matching the predicate lambda.',
    (args, ctx, scope) => {
      expectArity('COUNTIF', args, 2);
      const range = ctx.evalNode(args[0]!, scope);
      if (isEmpty(range)) return 0;
      if (!Array.isArray(range)) throw wrongTypeError('COUNTIF first argument must be an array');
      let count = 0;
      for (const x of range) {
        if (isEmpty(x)) continue;
        if (evalPredicate('COUNTIF', args[1]!, ctx, scope, x)) count++;
      }
      return count;
    }),
];
