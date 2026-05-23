// Common helpers used by every function-category file.

import type { AstNode } from '../ast';
import {
  outOfRangeError,
  wrongTypeError,
} from '../errors';
import { coerceNumber, EMPTY, isEmpty, isDate } from '../values';
import type { EvalContext, Scope } from './types';

// Eagerly evaluate every arg in left-to-right order.
export function evalArgs(
  args: AstNode[],
  ctx: EvalContext,
  scope: Scope
): unknown[] {
  return args.map((a) => ctx.evalNode(a, scope));
}

// Assert an exact arg count and throw a friendly error otherwise.
export function expectArity(name: string, args: AstNode[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    if (min === max) {
      throw wrongTypeError(
        `${name} expects ${min} argument${min === 1 ? '' : 's'} but got ${args.length}`
      );
    }
    throw wrongTypeError(
      `${name} expects ${min}–${max} arguments but got ${args.length}`
    );
  }
}

// Assert at least N args.
export function expectMinArity(name: string, args: AstNode[], min: number): void {
  if (args.length < min) {
    throw wrongTypeError(
      `${name} expects at least ${min} argument${min === 1 ? '' : 's'} but got ${args.length}`
    );
  }
}

// If any of the listed values is EMPTY, throw an out-of-range — but
// most callers want "if any arg empty, the whole result is empty",
// which is `propagateEmpty`. This helper just tells you.
export function anyEmpty(values: unknown[]): boolean {
  return values.some(isEmpty);
}

// Many arithmetic operators / function args propagate empty: if any
// arg is the empty sentinel, return empty without evaluating further.
// Helper for that pattern.
export function propagateEmpty(values: unknown[]): unknown | undefined {
  return anyEmpty(values) ? EMPTY : undefined;
}

// Strip EMPTY values from an array — used by SUM, AVERAGE, etc. that
// per spec ignore blanks (Excel-compat).
export function dropEmpty(values: unknown[]): unknown[] {
  return values.filter((v) => !isEmpty(v));
}

// Number-coerce every value (after dropping empties). Throws
// wrong_type with a positional label.
export function coerceNumberArray(
  fnName: string,
  values: unknown[]
): number[] {
  return values.map((v, i) =>
    coerceNumber(v, `${fnName} argument ${i + 1}`)
  );
}

// Flatten a level of array-spread for variadic aggregators: SUM(a, b,
// SEQUENCE(3)) should treat the array result as more numbers. We
// only flatten one level — nested arrays would be a wrong_type.
export function flattenForAggregation(values: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const v of values) {
    if (Array.isArray(v)) {
      for (const inner of v) {
        if (typeof inner === 'object' && inner !== null && !isDate(inner)) {
          throw wrongTypeError(
            'cannot aggregate over an array of objects — use MAP/FILTER first'
          );
        }
        out.push(inner);
      }
    } else {
      out.push(v);
    }
  }
  return out;
}

// Bounds-checked integer coercion used by INT, ROUND digit-count
// args, SEQUENCE size, etc.
export function coerceInt(
  v: unknown,
  argLabel: string,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY
): number {
  const n = coerceNumber(v, argLabel);
  const i = Math.trunc(n);
  if (i < min || i > max) {
    throw outOfRangeError(`${argLabel} is out of range (${min}–${max})`);
  }
  return i;
}
