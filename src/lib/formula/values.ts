// Internal value model.
//
// The engine speaks four primitive scalar kinds — number, string,
// boolean, epoch-day date — plus arrays of scalars / arrays of
// objects, plus the cross-cutting `empty` sentinel.
//
// Dates are stored and operated on as integer days since 1970-01-01
// (UTC). `date - date = integer days` and `date + n = date` become
// integer arithmetic, with no timezone hazard. Renderers convert
// epoch-day → display string at the boundary.

import { wrongTypeError } from './errors';
import type { Shape } from './types';

// Unique sentinel for "this cell's input hasn't been typed yet".
// Distinct from null/undefined so consumers can distinguish missing
// from explicit-null.
export const EMPTY: unique symbol = Symbol('empty');
export type Empty = typeof EMPTY;

// Tag-based date wrapper. We keep dates structurally distinct from
// plain numbers so `1 + 2` doesn't accidentally become a date.
export interface DateValue {
  readonly __date: true;
  readonly epochDay: number;
}

export function makeDate(epochDay: number): DateValue {
  return { __date: true, epochDay: Math.trunc(epochDay) };
}

export function isDate(v: unknown): v is DateValue {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { __date?: unknown }).__date === true &&
    typeof (v as { epochDay?: unknown }).epochDay === 'number'
  );
}

// Convert a JS Date (UTC) → epoch days. Used at the boundary of
// TODAY() / NOW() / DATE().
export function dateToEpochDay(d: Date): number {
  const ms = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  );
  return Math.floor(ms / 86_400_000);
}

export function epochDayToDate(epochDay: number): Date {
  return new Date(epochDay * 86_400_000);
}

export function isEmpty(v: unknown): v is Empty {
  return v === EMPTY;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isScalarArray(v: unknown): v is unknown[] {
  if (!Array.isArray(v)) return false;
  return v.every((x) => typeof x !== 'object' || isDate(x) || x === null);
}

export function isObjectArray(v: unknown): v is Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  return v.every(
    (x) => typeof x === 'object' && x !== null && !Array.isArray(x) && !isDate(x)
  );
}

// Inspect a fully-evaluated value and report its public shape.
export function shapeOf(v: unknown): Shape {
  if (isEmpty(v)) return 'empty';
  if (Array.isArray(v)) {
    if (v.length === 0) return 'array_of_scalars';
    return isObjectArray(v) ? 'array_of_objects' : 'array_of_scalars';
  }
  return 'scalar';
}

// Strict number coercion used by arithmetic operators and most
// numeric functions. Booleans coerce (TRUE → 1, FALSE → 0), dates do
// NOT coerce (date arithmetic is handled by the binary-op layer),
// strings throw wrong_type per the spec.
export function coerceNumber(v: unknown, argLabel = 'argument'): number {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      throw wrongTypeError(`${argLabel} is not a finite number`);
    }
    return v;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    throw wrongTypeError(
      `${argLabel} is text but a number is expected`
    );
  }
  if (isDate(v)) {
    throw wrongTypeError(
      `${argLabel} is a date but a number is expected`
    );
  }
  if (isEmpty(v)) {
    throw wrongTypeError(`${argLabel} is empty but a number is expected`);
  }
  throw wrongTypeError(`${argLabel} is not a number`);
}

export function coerceBoolean(v: unknown, argLabel = 'argument'): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  throw wrongTypeError(
    `${argLabel} is not a boolean (got ${typeName(v)})`
  );
}

export function coerceString(v: unknown, argLabel = 'argument'): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (isDate(v)) {
    const d = epochDayToDate(v.epochDay);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  throw wrongTypeError(
    `${argLabel} cannot be converted to text (got ${typeName(v)})`
  );
}

export function coerceDate(v: unknown, argLabel = 'argument'): DateValue {
  if (isDate(v)) return v;
  throw wrongTypeError(`${argLabel} is not a date (got ${typeName(v)})`);
}

export function typeName(v: unknown): string {
  if (isEmpty(v)) return 'empty';
  if (v === null) return 'null';
  if (isDate(v)) return 'date';
  if (Array.isArray(v)) {
    return isObjectArray(v) ? 'array_of_objects' : 'array_of_scalars';
  }
  return typeof v;
}
