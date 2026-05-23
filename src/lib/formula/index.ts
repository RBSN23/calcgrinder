// Public API surface for the formula engine.
//
// Per PROJ-7 spec §"Engine API Surface", consumers import only these
// four functions plus the public types. Internal modules
// (tokenizer/parser/AST/function table) are not exported.

export { evaluateCalculator } from './evaluator';
export {
  getStructuralErrors,
  getDependencies,
} from './analyzer';
export { getFunctionCatalogue } from './catalogue';
export { RESERVED_WORDS } from './functions';
export { MAX_CELLS, MAX_FORMULA_LEN, MAX_ARRAY_ROWS } from './limits';
export { EMPTY, isEmpty, isDate, makeDate } from './values';

export type {
  Cell,
  CellKind,
  CellError,
  CellResult,
  EvaluationResult,
  ErrorCategory,
  FunctionCategory,
  FunctionMeta,
  FunctionParameter,
  InputType,
  Inputs,
  Shape,
  StructuralError,
} from './types';
