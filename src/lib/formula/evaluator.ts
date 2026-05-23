// One-shot calculator evaluator.
//
// Flow per the tech design:
//   1. parse each output formula (cached)
//   2. analyze dependency graph + cycles + unknown names
//   3. topologically order cells whose AST parsed cleanly
//   4. evaluate each cell once against the per-pass `now` clock
//   5. emit `{ value, shape, error? }` for every cell
//
// Errors propagate per the acceptance criteria: cells that depend on
// an errored cell receive a "↑ depends on …" runtime message; cells
// that depend on an empty input receive the EMPTY sentinel (rendered
// blank by the UI).

import type { AstNode } from './ast';
import {
  analyzeCells,
  parseFormula,
} from './analyzer';
import {
  cycleError,
  divideByZeroError,
  FormulaError,
  outOfRangeError,
  propagationError,
  runtimeError,
  unknownNameError,
  wrongTypeError,
} from './errors';
import { FUNCTION_TABLE } from './functions';
import type { EvalContext, Scope } from './functions/types';
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
  EMPTY,
  isDate,
  isEmpty,
  makeDate,
  shapeOf,
} from './values';
import type {
  Cell,
  CellResult,
  EvaluationResult,
  Inputs,
} from './types';

const PI = Math.PI;
const E = Math.E;

function input_to_engine_value(cell: Cell, inputs: Inputs): unknown {
  const raw = inputs[cell.name];
  if (raw === undefined || raw === null) {
    // No visitor value; fall back to default if present.
    if (cell.default_value === undefined || cell.default_value === null) {
      return EMPTY;
    }
    return coerceDefault(cell.input_type ?? 'number', cell.default_value);
  }
  return coerceDefault(cell.input_type ?? 'number', raw);
}

function coerceDefault(type: Cell['input_type'], raw: unknown): unknown {
  if (raw === EMPTY) return EMPTY;
  switch (type) {
    case 'percent':
    case 'currency':
    case 'number': {
      if (typeof raw === 'number') return Number.isFinite(raw) ? raw : EMPTY;
      if (typeof raw === 'string') {
        if (raw.trim() === '') return EMPTY;
        const n = Number(raw);
        return Number.isFinite(n) ? n : EMPTY;
      }
      if (typeof raw === 'boolean') return raw ? 1 : 0;
      return EMPTY;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      if (typeof raw === 'number') return raw !== 0;
      if (typeof raw === 'string') {
        const t = raw.trim().toLowerCase();
        if (t === 'true' || t === '1') return true;
        if (t === 'false' || t === '0' || t === '') return false;
      }
      return EMPTY;
    }
    case 'text': {
      if (typeof raw === 'string') return raw === '' ? EMPTY : raw;
      if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
      return EMPTY;
    }
    case 'date': {
      if (isDate(raw)) return raw;
      if (typeof raw === 'string' && raw.trim() !== '') {
        const ms = Date.parse(raw);
        if (Number.isFinite(ms)) return makeDate(Math.floor(ms / 86_400_000));
      }
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return makeDate(raw);
      }
      return EMPTY;
    }
    default:
      return EMPTY;
  }
}

export function evaluateCalculator(cells: Cell[], inputs: Inputs): EvaluationResult {
  const analysis = analyzeCells(cells);
  const { directDeps, parseErrors, unknownNameErrors, cycleMembers } = analysis;

  // Per-pass shared instant for TODAY()/NOW().
  const now = new Date();

  // Build the value map. Input cells get resolved from `inputs`
  // (or default_value), output cells will be filled by evaluation.
  // Errors live in a separate map.
  const values = new Map<string, unknown>();
  const errors = new Map<string, FormulaError>();
  for (const cell of cells) {
    if (cell.kind === 'input') {
      values.set(cell.name, input_to_engine_value(cell, inputs));
    } else {
      // Pre-seed cells with structural errors so their dependents see
      // an erroring node and emit the propagation message.
      if (parseErrors.has(cell.name)) {
        errors.set(cell.name, parseErrors.get(cell.name)!);
      } else if (unknownNameErrors.has(cell.name)) {
        errors.set(cell.name, unknownNameErrors.get(cell.name)!);
      } else if (cycleMembers.has(cell.name)) {
        const path = cycleMembers.get(cell.name)!;
        errors.set(cell.name, cycleError(path));
      }
    }
  }

  // Build EvalContext used by every function in the table.
  const ctx: EvalContext = {
    now,
    resolveCell(name: string): unknown {
      if (errors.has(name)) {
        // Throw — caller (the binary-op or function) will catch in
        // its try/catch and surface as propagation.
        throw propagationError(name);
      }
      if (!values.has(name)) throw unknownNameError(name);
      return values.get(name);
    },
    evalNode(node: AstNode, scope: Scope): unknown {
      return evalAstNode(node, ctx, scope);
    },
  };

  // Topological order. Cells with structural errors (already-error)
  // are not evaluated but still appear in the iteration so we don't
  // forget them in the final output map.
  const order = topoOrder(cells, directDeps);

  for (const cellName of order) {
    const cell = cells.find((c) => c.name === cellName);
    if (!cell) continue;
    if (cell.kind !== 'output') continue;
    if (errors.has(cellName)) continue; // structural error already set
    const parsed = parseFormula(cell.formula ?? '');
    if (!parsed.ast) {
      errors.set(cellName, parsed.error!);
      continue;
    }
    try {
      const value = evalAstNode(parsed.ast, ctx, new Map());
      values.set(cellName, value);
    } catch (err) {
      if (err instanceof FormulaError) {
        errors.set(cellName, err);
      } else {
        errors.set(cellName, runtimeError(err instanceof Error ? err.message : 'Runtime error'));
      }
    }
  }

  // Project to the public result map.
  const result: EvaluationResult = {};
  for (const cell of cells) {
    const e = errors.get(cell.name);
    if (e) {
      const cellError = e.toCellError();
      result[cell.name] = { value: undefined, shape: 'empty', error: cellError };
      continue;
    }
    const v = values.get(cell.name);
    result[cell.name] = { value: v, shape: shapeOf(v) };
  }
  return result;
}

function topoOrder(
  cells: Cell[],
  directDeps: Map<string, Set<string>>
): string[] {
  const indeg = new Map<string, number>();
  const reverse = new Map<string, Set<string>>();
  for (const cell of cells) {
    indeg.set(cell.name, 0);
    reverse.set(cell.name, new Set());
  }
  for (const cell of cells) {
    const deps = directDeps.get(cell.name);
    if (!deps) continue;
    for (const d of deps) {
      if (!indeg.has(d)) continue;
      indeg.set(cell.name, (indeg.get(cell.name) ?? 0) + 1);
      reverse.get(d)!.add(cell.name);
    }
  }
  const queue: string[] = [];
  for (const [name, d] of indeg) {
    if (d === 0) queue.push(name);
  }
  const out: string[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    out.push(n);
    for (const m of reverse.get(n) ?? []) {
      indeg.set(m, (indeg.get(m) ?? 0) - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
  }
  // Any nodes left out are in cycles; the cycle detector has already
  // marked them. We still include them at the end so the caller can
  // emit per-cell errors for them.
  for (const cell of cells) {
    if (!out.includes(cell.name)) out.push(cell.name);
  }
  return out;
}

function evalAstNode(
  node: AstNode,
  ctx: EvalContext,
  scope: Scope
): unknown {
  switch (node.type) {
    case 'NumberLiteral':
      return node.value;
    case 'StringLiteral':
      return node.value;
    case 'BooleanLiteral':
      return node.value;
    case 'ConstantRef':
      return node.name === 'PI' ? PI : E;
    case 'CellRef': {
      // Lambda parameter shadows cell.
      if (scope.has(node.name)) return scope.get(node.name);
      return ctx.resolveCell(node.name);
    }
    case 'FunctionCall': {
      const fn = FUNCTION_TABLE[node.name];
      if (!fn) throw unknownNameError(node.name);
      return fn.evaluate(node.args, ctx, scope);
    }
    case 'Lambda':
      // Bare lambdas have no value; they exist only as arguments to
      // MAP / FILTER / REDUCE / SUMIF / COUNTIF. Treat as wrong_type
      // if one shows up at evaluation time.
      throw wrongTypeError('A lambda must be passed to a function (e.g. MAP, FILTER, REDUCE)');
    case 'BinaryOp':
      return evalBinaryOp(node, ctx, scope);
    case 'UnaryOp':
      return evalUnaryOp(node, ctx, scope);
  }
}

function evalBinaryOp(
  node: Extract<AstNode, { type: 'BinaryOp' }>,
  ctx: EvalContext,
  scope: Scope
): unknown {
  const left = ctx.evalNode(node.left, scope);
  const right = ctx.evalNode(node.right, scope);

  // Empty propagation for arithmetic / comparison / concat: per spec,
  // a single empty operand makes the whole expression empty.
  if (isEmpty(left) || isEmpty(right)) {
    // Equality and inequality with empty: treat empty == empty as
    // TRUE so authors can write `IF(x = "" ...)` patterns; but the
    // spec dictates ISEMPTY is the canonical check. Keep this
    // simple — propagate empty for now.
    return EMPTY;
  }

  switch (node.op) {
    case '+':
      // Date + number = date; date - date = days handled in '-'.
      if (isDate(left) && typeof right === 'number') {
        return checkedDate(left.epochDay + right);
      }
      if (typeof left === 'number' && isDate(right)) {
        return checkedDate(right.epochDay + left);
      }
      return coerceNumber(left, 'left operand') + coerceNumber(right, 'right operand');
    case '-':
      if (isDate(left) && isDate(right)) return left.epochDay - right.epochDay;
      if (isDate(left) && typeof right === 'number') {
        return checkedDate(left.epochDay - right);
      }
      return coerceNumber(left, 'left operand') - coerceNumber(right, 'right operand');
    case '*':
      return coerceNumber(left, 'left operand') * coerceNumber(right, 'right operand');
    case '/': {
      const r = coerceNumber(right, 'right operand');
      if (r === 0) throw divideByZeroError();
      return coerceNumber(left, 'left operand') / r;
    }
    case '%': {
      const r = coerceNumber(right, 'right operand');
      if (r === 0) throw divideByZeroError();
      const l = coerceNumber(left, 'left operand');
      return l - Math.floor(l / r) * r;
    }
    case '^':
      return Math.pow(
        coerceNumber(left, 'left operand'),
        coerceNumber(right, 'right operand')
      );
    case '&':
      return coerceString(left, 'left operand') + coerceString(right, 'right operand');
    case '=':
      return valueEquals(left, right);
    case '<>':
      return !valueEquals(left, right);
    case '<':
      return compareValues(left, right) < 0;
    case '>':
      return compareValues(left, right) > 0;
    case '<=':
      return compareValues(left, right) <= 0;
    case '>=':
      return compareValues(left, right) >= 0;
  }
}

function evalUnaryOp(
  node: Extract<AstNode, { type: 'UnaryOp' }>,
  ctx: EvalContext,
  scope: Scope
): unknown {
  const v = ctx.evalNode(node.operand, scope);
  if (isEmpty(v)) return EMPTY;
  switch (node.op) {
    case '-':
      return -coerceNumber(v, 'unary minus operand');
    case '+':
      return +coerceNumber(v, 'unary plus operand');
    case 'NOT':
      return !coerceBoolean(v, 'NOT operand');
  }
}

// Year 0001-01-01 .. 9999-12-31 in epoch days (UTC). Matches the
// DATE function's range — keeps date arithmetic from producing
// physically-meaningless results.
const MIN_DATE_EPOCH = Math.floor(Date.UTC(1, 0, 1) / 86_400_000);
const MAX_DATE_EPOCH = Math.floor(Date.UTC(9999, 11, 31) / 86_400_000);

function checkedDate(epochDay: number): ReturnType<typeof makeDate> {
  if (epochDay < MIN_DATE_EPOCH || epochDay > MAX_DATE_EPOCH) {
    throw outOfRangeError('date arithmetic result is outside year 0001–9999');
  }
  return makeDate(epochDay);
}

function valueEquals(a: unknown, b: unknown): boolean {
  if (isDate(a) && isDate(b)) return a.epochDay === b.epochDay;
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return false;
}

function compareValues(a: unknown, b: unknown): number {
  if (isDate(a) && isDate(b)) return a.epochDay - b.epochDay;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  throw wrongTypeError('cannot compare values of different types');
}
