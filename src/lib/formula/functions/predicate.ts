// Predicate built-ins. By design these accept EMPTY without
// propagating — they're how authors test for it.

import { isDate, isEmpty } from '../values';
import { evalArgs, expectArity } from './helpers';
import type { FunctionEntry } from './types';

function entry(
  name: string,
  signature: string,
  parameters: FunctionEntry['parameters'],
  short_description: string,
  evaluate: FunctionEntry['evaluate']
): FunctionEntry {
  return { name, category: 'predicate', signature, parameters, short_description, evaluate };
}

const ISEMPTY: FunctionEntry = entry(
  'ISEMPTY',
  'ISEMPTY(value)',
  [{ name: 'value', type: 'any' }],
  'TRUE if the value is an empty / not-yet-typed cell.',
  (args, ctx, scope) => {
    expectArity('ISEMPTY', args, 1);
    const [v] = evalArgs(args, ctx, scope);
    return isEmpty(v);
  }
);

export const PREDICATE_FUNCTIONS: FunctionEntry[] = [
  ISEMPTY,
  { ...ISEMPTY, name: 'ISBLANK', signature: 'ISBLANK(value)' },

  entry('ISNUMBER', 'ISNUMBER(value)', [{ name: 'value', type: 'any' }],
    'TRUE if the value is a number.', (args, ctx, scope) => {
      expectArity('ISNUMBER', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      return typeof v === 'number' && Number.isFinite(v);
    }),

  entry('ISTEXT', 'ISTEXT(value)', [{ name: 'value', type: 'any' }],
    'TRUE if the value is text.', (args, ctx, scope) => {
      expectArity('ISTEXT', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      return typeof v === 'string';
    }),

  // Light bonus — useful for the spec's "date - date" example.
  entry('ISDATE', 'ISDATE(value)', [{ name: 'value', type: 'any' }],
    'TRUE if the value is a date.', (args, ctx, scope) => {
      expectArity('ISDATE', args, 1);
      const [v] = evalArgs(args, ctx, scope);
      return isDate(v);
    }),
];
