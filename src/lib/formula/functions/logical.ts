// Logical built-ins. IF / IFS short-circuit: only the matching
// branch's AST is evaluated. AND / OR short-circuit on first
// false / true respectively, matching Excel-ish semantics.

import { wrongTypeError } from '../errors';
import { coerceBoolean, EMPTY, isEmpty } from '../values';
import { expectArity, expectMinArity } from './helpers';
import type { FunctionEntry } from './types';

function entry(
  name: string,
  signature: string,
  parameters: FunctionEntry['parameters'],
  short_description: string,
  evaluate: FunctionEntry['evaluate']
): FunctionEntry {
  return { name, category: 'logical', signature, parameters, short_description, evaluate };
}

export const LOGICAL_FUNCTIONS: FunctionEntry[] = [
  entry('IF', 'IF(condition, then, else)', [
    { name: 'condition', type: 'boolean' },
    { name: 'then', type: 'any' },
    { name: 'else', type: 'any' },
  ], 'Branch by condition. Only the chosen branch is evaluated.',
    (args, ctx, scope) => {
      expectArity('IF', args, 3);
      const cond = ctx.evalNode(args[0]!, scope);
      if (isEmpty(cond)) return EMPTY;
      const b = coerceBoolean(cond, 'IF condition');
      return ctx.evalNode(b ? args[1]! : args[2]!, scope);
    }),

  entry('IFS', 'IFS(cond1, val1, cond2, val2, ...)', [
    { name: 'condition_value_pairs', type: 'pairs', variadic: true },
  ], 'First matching condition returns its paired value.',
    (args, ctx, scope) => {
      expectMinArity('IFS', args, 2);
      if (args.length % 2 !== 0) {
        throw wrongTypeError('IFS expects condition/value pairs (even arg count)');
      }
      for (let i = 0; i < args.length; i += 2) {
        const cond = ctx.evalNode(args[i]!, scope);
        if (isEmpty(cond)) continue;
        if (coerceBoolean(cond, `IFS condition ${i / 2 + 1}`)) {
          return ctx.evalNode(args[i + 1]!, scope);
        }
      }
      return EMPTY;
    }),

  entry('AND', 'AND(value1, value2, ...)', [
    { name: 'values', type: 'boolean', variadic: true },
  ], 'TRUE if every argument is truthy. Short-circuits on first FALSE.',
    (args, ctx, scope) => {
      expectMinArity('AND', args, 1);
      let sawEmpty = false;
      for (let i = 0; i < args.length; i++) {
        const v = ctx.evalNode(args[i]!, scope);
        if (isEmpty(v)) { sawEmpty = true; continue; }
        if (!coerceBoolean(v, `AND argument ${i + 1}`)) return false;
      }
      return sawEmpty ? EMPTY : true;
    }),

  entry('OR', 'OR(value1, value2, ...)', [
    { name: 'values', type: 'boolean', variadic: true },
  ], 'TRUE if any argument is truthy. Short-circuits on first TRUE.',
    (args, ctx, scope) => {
      expectMinArity('OR', args, 1);
      let sawEmpty = false;
      for (let i = 0; i < args.length; i++) {
        const v = ctx.evalNode(args[i]!, scope);
        if (isEmpty(v)) { sawEmpty = true; continue; }
        if (coerceBoolean(v, `OR argument ${i + 1}`)) return true;
      }
      return sawEmpty ? EMPTY : false;
    }),

  entry('NOT', 'NOT(value)', [{ name: 'value', type: 'boolean' }],
    'Boolean negation.', (args, ctx, scope) => {
      expectArity('NOT', args, 1);
      const v = ctx.evalNode(args[0]!, scope);
      if (isEmpty(v)) return EMPTY;
      return !coerceBoolean(v, 'NOT argument');
    }),
];
