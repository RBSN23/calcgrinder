// Public types for the formula engine.
//
// These are the shapes that PROJ-8 (Editor), PROJ-9 (Cell Authoring),
// PROJ-10 (Publish), and PROJ-11 (Visitor View) consume. See the
// PROJ-7 spec §"Engine API Surface" for the consumer contract.

export type Shape =
  | 'scalar'
  | 'array_of_scalars'
  | 'array_of_objects'
  | 'empty';

export type ErrorCategory =
  | 'syntax'
  | 'unknown_name'
  | 'cycle'
  | 'wrong_type'
  | 'divide_by_zero'
  | 'out_of_range'
  | 'runtime';

export interface CellError {
  category: ErrorCategory;
  message: string;
  // For cycles: the discovered path, e.g. ['a','b','c','a'].
  path?: string[];
}

export interface CellResult {
  value: unknown;
  shape: Shape;
  error?: CellError;
}

export type EvaluationResult = Record<string, CellResult>;

export type InputType =
  | 'number'
  | 'percent'
  | 'currency'
  | 'boolean'
  | 'text'
  | 'date';

export type CellKind = 'input' | 'output';

export interface Cell {
  name: string;
  kind: CellKind;
  // Inputs:
  input_type?: InputType;
  default_value?: unknown;
  // Outputs:
  formula?: string;
}

// Visitor-typed values keyed by input cell name. Missing keys (or
// `undefined`) mean "the visitor hasn't typed anything yet" — this
// triggers empty-propagation per the spec.
export type Inputs = Record<string, unknown>;

export interface StructuralError {
  cellName: string;
  category: 'syntax' | 'unknown_name' | 'cycle';
  message: string;
  path?: string[];
}

export interface FunctionParameter {
  name: string;
  type: string;
  variadic?: boolean;
  optional?: boolean;
}

export interface FunctionMeta {
  name: string;
  signature: string;
  parameters: FunctionParameter[];
  category: FunctionCategory;
  short_description: string;
  is_volatile?: boolean;
}

export type FunctionCategory =
  | 'math'
  | 'logical'
  | 'predicate'
  | 'financial'
  | 'statistical'
  | 'string'
  | 'date'
  | 'array';
