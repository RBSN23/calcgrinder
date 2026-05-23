// Shared types for the function table.
//
// Separated from evaluator.ts so the category files (math.ts, etc.)
// can import without pulling in the evaluator (which would create a
// circular dep — the evaluator imports the function table).

import type { AstNode } from '../ast';
import type { FunctionCategory, FunctionParameter } from '../types';

export interface EvalContext {
  // Look up a cell's already-computed value by name. Returns the
  // EMPTY sentinel if the cell is empty or not on the calculator
  // (the analyzer reports unknown_name separately at the parse stage,
  // but the evaluator falls back to EMPTY for robustness).
  resolveCell(name: string): unknown;
  // Shared instant for TODAY()/NOW() — same across every call in
  // one evaluation pass.
  now: Date;
  // Recursive evaluation of an AST node within the given scope.
  evalNode(node: AstNode, scope: Scope): unknown;
}

export type Scope = Map<string, unknown>;

// Functions receive raw AST args. The default is to immediately
// evaluate each (see helpers.evalArgs), but functions that need
// short-circuit (IF, IFS, AND, OR) or lambda dispatch (MAP, FILTER,
// REDUCE) deal with the AST directly.
export type EvaluateFn = (
  args: AstNode[],
  ctx: EvalContext,
  scope: Scope
) => unknown;

export interface FunctionEntry {
  name: string;
  category: FunctionCategory;
  signature: string;
  parameters: FunctionParameter[];
  short_description: string;
  is_volatile?: boolean;
  evaluate: EvaluateFn;
}
