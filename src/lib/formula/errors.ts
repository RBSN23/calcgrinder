// Centralised error builders for the formula engine.
//
// All error message strings live here so plain-English wording stays
// consistent across the tokenizer, parser, analyzer, evaluator, and
// the ~60 built-in functions. No `throw new Error("…")` should exist
// outside this module.

import type { CellError, ErrorCategory } from './types';

export class FormulaError extends Error {
  category: ErrorCategory;
  path?: string[];

  constructor(category: ErrorCategory, message: string, path?: string[]) {
    super(message);
    this.name = 'FormulaError';
    this.category = category;
    this.path = path;
  }

  toCellError(): CellError {
    const out: CellError = { category: this.category, message: this.message };
    if (this.path) out.path = this.path;
    return out;
  }
}

export function syntaxError(message: string, column?: number): FormulaError {
  const where = typeof column === 'number' ? ` at column ${column + 1}` : '';
  return new FormulaError('syntax', `${message}${where}`);
}

export function unknownNameError(name: string): FormulaError {
  return new FormulaError('unknown_name', `Unknown name: ${name}`);
}

export function cycleError(path: string[]): FormulaError {
  return new FormulaError('cycle', `Cycle: ${path.join(' → ')}`, path);
}

export function wrongTypeError(message: string): FormulaError {
  return new FormulaError('wrong_type', message);
}

export function divideByZeroError(): FormulaError {
  return new FormulaError('divide_by_zero', 'Division by zero');
}

export function outOfRangeError(message: string): FormulaError {
  return new FormulaError('out_of_range', message);
}

export function arrayTooLargeError(limit: number): FormulaError {
  return outOfRangeError(`Array result too large (limit: ${limit} rows)`);
}

export function runtimeError(message: string): FormulaError {
  return new FormulaError('runtime', message);
}

export function propagationError(dependencyName: string): FormulaError {
  // Plain-English propagation message per the acceptance criteria.
  return new FormulaError(
    'runtime',
    `↑ depends on ${dependencyName} which has an error`
  );
}

// Renderer-facing shape mismatch vocabulary. Engine doesn't enforce
// this — renderers (PROJ-17 tabular cells in particular) do — but the
// strings live here so consumers reuse them verbatim per the
// acceptance criteria.
export function shapeMismatchMessage(expected: string, got: string): string {
  return `expected ${expected}, got ${got}`;
}
