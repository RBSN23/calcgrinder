// Static analysis: parse-cache, dependency graph, cycle detection,
// unknown-name detection. Powers the Publish gate
// (`getStructuralErrors`) and rename-with-update
// (`getDependencies`).
//
// The parse cache is module-level so `evaluateCalculator` and
// `getStructuralErrors` share parsed ASTs — no double-parsing
// during a single editor keystroke.

import type { AstNode } from './ast';
import { cycleError, FormulaError, syntaxError, unknownNameError } from './errors';
import { FUNCTION_TABLE } from './functions';
import { MAX_FORMULA_LEN } from './limits';
import { parse } from './parser';
import type { Cell, StructuralError } from './types';

interface ParseResult {
  ast?: AstNode;
  error?: FormulaError;
}

const parseCache = new Map<string, ParseResult>();

export function parseFormula(formula: string): ParseResult {
  const cached = parseCache.get(formula);
  if (cached) return cached;
  if (formula.length > MAX_FORMULA_LEN) {
    const result: ParseResult = {
      error: syntaxError(
        `Formula exceeds ${MAX_FORMULA_LEN}-character limit`
      ),
    };
    parseCache.set(formula, result);
    return result;
  }
  try {
    const ast = parse(formula);
    const result: ParseResult = { ast };
    parseCache.set(formula, result);
    return result;
  } catch (err) {
    const result: ParseResult = {
      error:
        err instanceof FormulaError
          ? err
          : syntaxError(err instanceof Error ? err.message : 'Parse failed'),
    };
    parseCache.set(formula, result);
    return result;
  }
}

// Test-only helper to clear the parse cache between runs.
export function _resetParseCache(): void {
  parseCache.clear();
}

// Walk an AST collecting the names of cells referenced. Lambda
// parameters shadow outer cell-refs; outer captures by a lambda body
// are still recorded as dependencies (per spec edge-case
// "MAP lambda references an outer cell").
export function collectCellRefs(ast: AstNode, shadowed = new Set<string>()): Set<string> {
  const out = new Set<string>();
  walk(ast, shadowed, out);
  return out;
}

function walk(node: AstNode, shadowed: Set<string>, out: Set<string>): void {
  switch (node.type) {
    case 'CellRef':
      if (!shadowed.has(node.name)) out.add(node.name);
      return;
    case 'FunctionCall':
      for (const a of node.args) walk(a, shadowed, out);
      return;
    case 'Lambda': {
      const inner = new Set(shadowed);
      for (const p of node.params) inner.add(p);
      walk(node.body, inner, out);
      return;
    }
    case 'BinaryOp':
      walk(node.left, shadowed, out);
      walk(node.right, shadowed, out);
      return;
    case 'UnaryOp':
      walk(node.operand, shadowed, out);
      return;
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'ConstantRef':
      return;
  }
}

// Validate that every name referenced from `ast` resolves to either
// a cell on `cells` or a function in the table (functions are
// matched at function-call sites, not via bare-ident — bare-ident is
// always a cell-ref). Returns the first unknown-name error found, or
// null.
export function findUnknownName(ast: AstNode, cellNames: Set<string>): FormulaError | null {
  return findUnknownNameInner(ast, new Set(), cellNames);
}

function findUnknownNameInner(
  node: AstNode,
  shadowed: Set<string>,
  cellNames: Set<string>
): FormulaError | null {
  switch (node.type) {
    case 'CellRef':
      if (shadowed.has(node.name)) return null;
      if (!cellNames.has(node.name)) return unknownNameError(node.name);
      return null;
    case 'FunctionCall': {
      if (!FUNCTION_TABLE[node.name]) {
        return unknownNameError(node.name);
      }
      for (const a of node.args) {
        const e = findUnknownNameInner(a, shadowed, cellNames);
        if (e) return e;
      }
      return null;
    }
    case 'Lambda': {
      const inner = new Set(shadowed);
      for (const p of node.params) inner.add(p);
      return findUnknownNameInner(node.body, inner, cellNames);
    }
    case 'BinaryOp': {
      const l = findUnknownNameInner(node.left, shadowed, cellNames);
      if (l) return l;
      return findUnknownNameInner(node.right, shadowed, cellNames);
    }
    case 'UnaryOp':
      return findUnknownNameInner(node.operand, shadowed, cellNames);
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'ConstantRef':
      return null;
  }
}

export interface DependencyAnalysis {
  // For every output cell: the cells it references directly.
  directDeps: Map<string, Set<string>>;
  // Per-cell parse errors (only for cells whose parse failed).
  parseErrors: Map<string, FormulaError>;
  // Per-cell unknown-name errors (cells that parsed but reference
  // a name not on the calculator).
  unknownNameErrors: Map<string, FormulaError>;
  // Cycles, expressed as the discovered path through each
  // participating cell. Every cell in the cycle maps to the same
  // path string array.
  cycleMembers: Map<string, string[]>;
}

export function analyzeCells(cells: Cell[]): DependencyAnalysis {
  const cellNames = new Set(cells.map((c) => c.name));
  const directDeps = new Map<string, Set<string>>();
  const parseErrors = new Map<string, FormulaError>();
  const unknownNameErrors = new Map<string, FormulaError>();

  for (const cell of cells) {
    if (cell.kind !== 'output' || cell.formula == null) {
      directDeps.set(cell.name, new Set());
      continue;
    }
    const parsed = parseFormula(cell.formula);
    if (parsed.error) {
      parseErrors.set(cell.name, parsed.error);
      directDeps.set(cell.name, new Set());
      continue;
    }
    const refs = collectCellRefs(parsed.ast!);
    directDeps.set(cell.name, refs);
    const unknown = findUnknownName(parsed.ast!, cellNames);
    if (unknown) unknownNameErrors.set(cell.name, unknown);
  }

  // Cycle detection: Tarjan-flavoured DFS that records the full
  // path. Iterative to avoid blowing the stack for long chains.
  const cycleMembers = detectCycles(directDeps);

  return { directDeps, parseErrors, unknownNameErrors, cycleMembers };
}

function detectCycles(
  directDeps: Map<string, Set<string>>
): Map<string, string[]> {
  const cycles = new Map<string, string[]>();
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const name of directDeps.keys()) color.set(name, WHITE);

  for (const start of directDeps.keys()) {
    if (color.get(start) !== WHITE) continue;
    visit(start);
  }

  function visit(start: string): void {
    // Iterative DFS using an explicit stack of frames; each frame
    // records the current node and an iterator over its remaining
    // children.
    const path: string[] = [];
    const pathSet = new Set<string>();
    type Frame = { node: string; iter: IterableIterator<string> };
    const stack: Frame[] = [];
    function push(node: string): void {
      const deps = directDeps.get(node);
      stack.push({ node, iter: (deps ?? new Set<string>()).values() });
      path.push(node);
      pathSet.add(node);
      color.set(node, GREY);
    }
    push(start);
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const { value: child, done } = top.iter.next();
      if (done) {
        color.set(top.node, BLACK);
        path.pop();
        pathSet.delete(top.node);
        stack.pop();
        continue;
      }
      const c = color.get(child);
      if (c === GREY) {
        // Found a back edge. Build the cycle path:
        // path = [… , ancestor, …, top.node], child closes back to ancestor.
        const startIdx = path.indexOf(child);
        const cyclePath = path.slice(startIdx).concat(child);
        // Record cycle members. Every node in cyclePath (excluding
        // the final closing repetition) is a cycle member.
        for (let i = startIdx; i < path.length; i++) {
          const member = path[i]!;
          // First detection wins; subsequent paths won't overwrite.
          if (!cycles.has(member)) cycles.set(member, cyclePath);
        }
      } else if (c === WHITE || c === undefined) {
        push(child);
      }
      // BLACK: already explored, ignore.
    }
  }

  return cycles;
}

export function getStructuralErrors(cells: Cell[]): StructuralError[] {
  const { parseErrors, unknownNameErrors, cycleMembers } = analyzeCells(cells);
  const out: StructuralError[] = [];
  for (const [name, err] of parseErrors) {
    out.push({ cellName: name, category: 'syntax', message: err.message });
  }
  for (const [name, err] of unknownNameErrors) {
    out.push({ cellName: name, category: 'unknown_name', message: err.message });
  }
  for (const [name, path] of cycleMembers) {
    out.push({
      cellName: name,
      category: 'cycle',
      message: `Cycle: ${path.join(' → ')}`,
      path,
    });
  }
  return out;
}

// Transitive dependencies of `cellName` — the cells it reads from,
// directly or indirectly. Used by PROJ-9 for rename-with-update.
export function getDependencies(cellName: string, cells: Cell[]): string[] {
  const { directDeps } = analyzeCells(cells);
  const seen = new Set<string>();
  const stack: string[] = [cellName];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const deps = directDeps.get(cur);
    if (!deps) continue;
    for (const d of deps) {
      if (!seen.has(d)) {
        seen.add(d);
        stack.push(d);
      }
    }
  }
  return [...seen].sort();
}
