// Array built-ins + lambda dispatch. SEQUENCE/RANGE produce numeric
// arrays; MAP/FILTER/REDUCE take lambdas; OBJECT/RECORD build a
// single record (last-key-wins). The 10,000-row cap is enforced
// inside each producer.

import {
  arrayTooLargeError,
  outOfRangeError,
  wrongTypeError,
} from '../errors';
import { MAX_ARRAY_ROWS } from '../limits';
import {
  coerceNumber,
  coerceString,
  EMPTY,
  isEmpty,
} from '../values';
import {
  coerceInt,
  evalArgs,
  expectArity,
  expectMinArity,
} from './helpers';
import type { AstNode, Lambda } from '../ast';
import type { EvalContext, FunctionEntry, Scope } from './types';

function entry(
  name: string,
  signature: string,
  parameters: FunctionEntry['parameters'],
  short_description: string,
  evaluate: FunctionEntry['evaluate']
): FunctionEntry {
  return { name, category: 'array', signature, parameters, short_description, evaluate };
}

function expectLambda(fnName: string, node: AstNode, arity: number): Lambda {
  if (node.type !== 'Lambda') {
    throw wrongTypeError(`${fnName} expects a lambda argument`);
  }
  if (node.params.length !== arity) {
    throw wrongTypeError(
      `${fnName} lambda must take exactly ${arity} parameter${arity === 1 ? '' : 's'}`
    );
  }
  return node;
}

function applyLambda1(
  fnName: string,
  lambda: Lambda,
  x: unknown,
  ctx: EvalContext,
  scope: Scope
): unknown {
  const inner: Scope = new Map(scope);
  inner.set(lambda.params[0]!, x);
  void fnName;
  return ctx.evalNode(lambda.body, inner);
}

function applyLambda2(
  fnName: string,
  lambda: Lambda,
  a: unknown,
  b: unknown,
  ctx: EvalContext,
  scope: Scope
): unknown {
  const inner: Scope = new Map(scope);
  inner.set(lambda.params[0]!, a);
  inner.set(lambda.params[1]!, b);
  void fnName;
  return ctx.evalNode(lambda.body, inner);
}

export const ARRAY_FUNCTIONS: FunctionEntry[] = [
  entry('SEQUENCE', 'SEQUENCE(n, start?, step?)', [
    { name: 'n', type: 'integer' },
    { name: 'start', type: 'number', optional: true },
    { name: 'step', type: 'number', optional: true },
  ], 'Array of N numbers starting at 1 (or `start`), stepping by 1 (or `step`).',
    (args, ctx, scope) => {
      expectArity('SEQUENCE', args, 1, 3);
      const vs = evalArgs(args, ctx, scope);
      if (vs.some(isEmpty)) return EMPTY;
      const n = coerceInt(vs[0]!, 'SEQUENCE n', 0);
      const start = vs.length >= 2 ? coerceNumber(vs[1], 'SEQUENCE start') : 1;
      const step = vs.length >= 3 ? coerceNumber(vs[2], 'SEQUENCE step') : 1;
      if (n > MAX_ARRAY_ROWS) throw arrayTooLargeError(MAX_ARRAY_ROWS);
      const out: number[] = new Array(n);
      for (let i = 0; i < n; i++) out[i] = start + i * step;
      return out;
    }),

  entry('RANGE', 'RANGE(start, end, step?)', [
    { name: 'start', type: 'number' },
    { name: 'end', type: 'number' },
    { name: 'step', type: 'number', optional: true },
  ], 'Array of numbers from `start` up to (excluding) `end`, stepping by `step`.',
    (args, ctx, scope) => {
      expectArity('RANGE', args, 2, 3);
      const vs = evalArgs(args, ctx, scope);
      if (vs.some(isEmpty)) return EMPTY;
      const start = coerceNumber(vs[0], 'RANGE start');
      const end = coerceNumber(vs[1], 'RANGE end');
      const step = vs.length >= 3 ? coerceNumber(vs[2], 'RANGE step') : 1;
      if (step === 0) throw outOfRangeError('RANGE step must be non-zero');
      const direction = step > 0 ? 1 : -1;
      if ((end - start) * direction < 0) return [];
      const count = Math.floor((end - start) / step);
      if (count > MAX_ARRAY_ROWS) throw arrayTooLargeError(MAX_ARRAY_ROWS);
      const out: number[] = new Array(count);
      for (let i = 0; i < count; i++) out[i] = start + i * step;
      return out;
    }),

  entry('MAP', 'MAP(array, lambda)', [
    { name: 'array', type: 'array' },
    { name: 'lambda', type: 'lambda' },
  ], 'Apply a lambda to each element of an array.', (args, ctx, scope) => {
    expectArity('MAP', args, 2);
    const range = ctx.evalNode(args[0]!, scope);
    if (isEmpty(range)) return EMPTY;
    if (!Array.isArray(range)) throw wrongTypeError('MAP first argument must be an array');
    const lambda = expectLambda('MAP', args[1]!, 1);
    if (range.length > MAX_ARRAY_ROWS) throw arrayTooLargeError(MAX_ARRAY_ROWS);
    const out: unknown[] = new Array(range.length);
    for (let i = 0; i < range.length; i++) {
      out[i] = applyLambda1('MAP', lambda, range[i], ctx, scope);
    }
    return out;
  }),

  entry('FILTER', 'FILTER(array, predicate)', [
    { name: 'array', type: 'array' },
    { name: 'predicate', type: 'lambda' },
  ], 'Keep elements where the predicate lambda returns TRUE.',
    (args, ctx, scope) => {
      expectArity('FILTER', args, 2);
      const range = ctx.evalNode(args[0]!, scope);
      if (isEmpty(range)) return EMPTY;
      if (!Array.isArray(range)) throw wrongTypeError('FILTER first argument must be an array');
      const lambda = expectLambda('FILTER', args[1]!, 1);
      const out: unknown[] = [];
      for (const x of range) {
        const r = applyLambda1('FILTER', lambda, x, ctx, scope);
        if (isEmpty(r)) continue;
        if (typeof r === 'boolean' ? r : r !== 0 && r !== '' && r !== false) {
          out.push(x);
        }
      }
      return out;
    }),

  entry('REDUCE', 'REDUCE(array, initial, lambda)', [
    { name: 'array', type: 'array' },
    { name: 'initial', type: 'any' },
    { name: 'lambda', type: 'lambda' },
  ], 'Fold an array with a 2-arg lambda (acc, x) => …',
    (args, ctx, scope) => {
      expectArity('REDUCE', args, 3);
      const range = ctx.evalNode(args[0]!, scope);
      if (isEmpty(range)) return ctx.evalNode(args[1]!, scope);
      if (!Array.isArray(range)) throw wrongTypeError('REDUCE first argument must be an array');
      const lambda = expectLambda('REDUCE', args[2]!, 2);
      let acc = ctx.evalNode(args[1]!, scope);
      for (const x of range) {
        acc = applyLambda2('REDUCE', lambda, acc, x, ctx, scope);
      }
      return acc;
    }),

  entry('OBJECT', 'OBJECT(key1, value1, key2, value2, ...)', [
    { name: 'key_value_pairs', type: 'pairs', variadic: true },
  ], 'Build a single record from alternating key/value arguments. Duplicate keys: last wins.',
    (args, ctx, scope) => {
      expectMinArity('OBJECT', args, 2);
      if (args.length % 2 !== 0) {
        throw wrongTypeError('OBJECT expects an even number of arguments (key, value pairs)');
      }
      const out: Record<string, unknown> = {};
      for (let i = 0; i < args.length; i += 2) {
        const key = ctx.evalNode(args[i]!, scope);
        const value = ctx.evalNode(args[i + 1]!, scope);
        if (typeof key !== 'string') {
          // Empty key is also wrong — per the edge-case spec, only
          // string keys (literal or expression-derived) are allowed.
          throw wrongTypeError(`OBJECT key ${i / 2 + 1} must be a string`);
        }
        out[key] = value;
      }
      return out;
    }),

  // Alias per spec — RECORD === OBJECT.
  entry('RECORD', 'RECORD(key1, value1, key2, value2, ...)', [
    { name: 'key_value_pairs', type: 'pairs', variadic: true },
  ], 'Alias of OBJECT.',
    (args, ctx, scope) => {
      // delegate via the same logic
      const objectFn = ARRAY_FUNCTIONS.find((f) => f.name === 'OBJECT');
      if (!objectFn) throw wrongTypeError('OBJECT not available');
      return objectFn.evaluate(args, ctx, scope);
    }),
];

// Wire up a stable string-key check that catches accidental key/value
// swap as `wrong_type`. The strict-coerceString version was avoided
// in OBJECT because coerceString turns numbers into "1" silently,
// which would hide the swap. Authors expect a friendly error.
void coerceString;
