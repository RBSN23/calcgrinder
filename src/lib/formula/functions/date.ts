// Date built-ins. Engine stores dates as integer epoch days; only
// TODAY/NOW/DATE cross the JS Date boundary. WEEKDAY follows the
// Excel default mode: 1 = Sunday, 7 = Saturday.

import { outOfRangeError } from '../errors';
import {
  coerceDate,
  dateToEpochDay,
  EMPTY,
  epochDayToDate,
  isEmpty,
  makeDate,
} from '../values';
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
  evaluate: FunctionEntry['evaluate'],
  is_volatile = false
): FunctionEntry {
  return { name, category: 'date', signature, parameters, short_description, evaluate, is_volatile };
}

const DAY_MS = 86_400_000;
const MAX_EPOCH_DAY = dateToEpochDay(new Date(Date.UTC(9999, 11, 31)));
const MIN_EPOCH_DAY = dateToEpochDay(new Date(Date.UTC(1, 0, 1)));

function checkRange(epochDay: number, where: string): number {
  if (epochDay < MIN_EPOCH_DAY || epochDay > MAX_EPOCH_DAY) {
    throw outOfRangeError(`${where} produced a date outside year 0001–9999`);
  }
  return epochDay;
}

export const DATE_FUNCTIONS: FunctionEntry[] = [
  entry('TODAY', 'TODAY()', [], 'Today\'s date (UTC), shared across the evaluation pass.',
    (args, ctx) => {
      if (args.length !== 0) throw outOfRangeError('TODAY takes no arguments');
      return makeDate(dateToEpochDay(ctx.now));
    }, true),

  entry('NOW', 'NOW()', [], 'Current UTC date-and-time encoded as a date (day only) for v1.',
    (args, ctx) => {
      if (args.length !== 0) throw outOfRangeError('NOW takes no arguments');
      // v1 only exposes day-precision dates; NOW behaves like TODAY
      // but tagged volatile separately so future v2 time-of-day work
      // doesn't have to retro-rename.
      return makeDate(dateToEpochDay(ctx.now));
    }, true),

  entry('DATE', 'DATE(year, month, day)', [
    { name: 'year', type: 'integer' },
    { name: 'month', type: 'integer' },
    { name: 'day', type: 'integer' },
  ], 'Construct a date from year/month/day (UTC).', (args, ctx, scope) => {
    expectArity('DATE', args, 3);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const y = coerceInt(vs[0]!, 'DATE year', 1, 9999);
    const m = coerceInt(vs[1]!, 'DATE month');
    const d = coerceInt(vs[2]!, 'DATE day');
    const ms = Date.UTC(y, m - 1, d);
    if (Number.isNaN(ms)) throw outOfRangeError('DATE is not a valid date');
    const ed = checkRange(Math.floor(ms / DAY_MS), 'DATE');
    return makeDate(ed);
  }),

  entry('YEAR', 'YEAR(date)', [{ name: 'date', type: 'date' }],
    'Year of a date.', (args, ctx, scope) => {
      expectArity('YEAR', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      if (isEmpty(v)) return EMPTY;
      return epochDayToDate(coerceDate(v, 'YEAR argument').epochDay).getUTCFullYear();
    }),

  entry('MONTH', 'MONTH(date)', [{ name: 'date', type: 'date' }],
    'Month (1–12) of a date.', (args, ctx, scope) => {
      expectArity('MONTH', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      if (isEmpty(v)) return EMPTY;
      return epochDayToDate(coerceDate(v, 'MONTH argument').epochDay).getUTCMonth() + 1;
    }),

  entry('DAY', 'DAY(date)', [{ name: 'date', type: 'date' }],
    'Day-of-month (1–31) of a date.', (args, ctx, scope) => {
      expectArity('DAY', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      if (isEmpty(v)) return EMPTY;
      return epochDayToDate(coerceDate(v, 'DAY argument').epochDay).getUTCDate();
    }),

  entry('DAYS', 'DAYS(end, start)', [
    { name: 'end', type: 'date' }, { name: 'start', type: 'date' },
  ], 'Integer number of days from start to end.', (args, ctx, scope) => {
    expectArity('DAYS', args, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    return coerceDate(vs[0], 'DAYS end').epochDay - coerceDate(vs[1], 'DAYS start').epochDay;
  }),

  entry('EDATE', 'EDATE(date, months)', [
    { name: 'date', type: 'date' }, { name: 'months', type: 'integer' },
  ], 'Shift a date by the given number of months.', (args, ctx, scope) => {
    expectArity('EDATE', args, 2);
    const vs = evalArgs(args, ctx, scope);
    const e = propagateEmpty(vs); if (e !== undefined) return e;
    const d = epochDayToDate(coerceDate(vs[0], 'EDATE date').epochDay);
    const months = coerceInt(vs[1]!, 'EDATE months');
    const targetMonth = d.getUTCMonth() + months;
    const ms = Date.UTC(d.getUTCFullYear(), targetMonth, d.getUTCDate());
    return makeDate(checkRange(Math.floor(ms / DAY_MS), 'EDATE'));
  }),

  entry('EOMONTH', 'EOMONTH(date, months)', [
    { name: 'date', type: 'date' }, { name: 'months', type: 'integer' },
  ], 'Last day of the month, shifted by N months from date.',
    (args, ctx, scope) => {
      expectArity('EOMONTH', args, 2);
      const vs = evalArgs(args, ctx, scope);
      const e = propagateEmpty(vs); if (e !== undefined) return e;
      const d = epochDayToDate(coerceDate(vs[0], 'EOMONTH date').epochDay);
      const months = coerceInt(vs[1]!, 'EOMONTH months');
      const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0);
      return makeDate(checkRange(Math.floor(ms / DAY_MS), 'EOMONTH'));
    }),

  entry('WEEKDAY', 'WEEKDAY(date)', [{ name: 'date', type: 'date' }],
    'Day of week (1 = Sunday … 7 = Saturday).', (args, ctx, scope) => {
      expectArity('WEEKDAY', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      if (isEmpty(v)) return EMPTY;
      return epochDayToDate(coerceDate(v, 'WEEKDAY argument').epochDay).getUTCDay() + 1;
    }),
];
