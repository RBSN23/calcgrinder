// PROJ-9 — AST-aware rename rewrite.
//
// `rewriteFormulaReference(formula, oldName, newName)` replaces every
// reference to `oldName` with `newName` inside the formula text, using
// the AST so:
//
//   - Lambda parameters with the same identifier are NOT rewritten
//     (e.g. `=MAP(SEQUENCE(n), i => i * 2)` with rename i → index keeps
//     the inner `i` because it's a locally-bound lambda parameter).
//   - String literals and column-name tokens that happen to contain
//     the identifier as a substring are NOT rewritten.
//   - Function-call names (the IDENT preceding `(`) are NOT rewritten —
//     the parser emits those as FunctionCall.name, not CellRef.
//
// On parse failure the input is returned unchanged. The caller is
// expected to feed only formulas that already parse cleanly
// (PROJ-9's rename path discovers dependents via getDependencies,
// which only returns names from parse-able formulas).

import type { AstNode } from './ast';
import { parseFormula } from './analyzer';

export function rewriteFormulaReference(
  formula: string,
  oldName: string,
  newName: string,
): string {
  if (oldName === newName) return formula;

  const { ast } = parseFormula(formula);
  if (!ast) return formula;

  const positions: { column: number; length: number }[] = [];
  collectRewritePositions(ast, oldName, new Set<string>(), positions);

  if (positions.length === 0) return formula;

  // Apply rewrites right-to-left so earlier column indices stay valid
  // while we splice.
  positions.sort((a, b) => b.column - a.column);
  let out = formula;
  for (const { column, length } of positions) {
    out = out.slice(0, column) + newName + out.slice(column + length);
  }
  return out;
}

function collectRewritePositions(
  node: AstNode,
  oldName: string,
  shadowed: Set<string>,
  out: { column: number; length: number }[],
): void {
  switch (node.type) {
    case 'CellRef':
      if (node.name === oldName && !shadowed.has(node.name)) {
        out.push({ column: node.column, length: node.name.length });
      }
      return;
    case 'FunctionCall':
      for (const a of node.args) collectRewritePositions(a, oldName, shadowed, out);
      return;
    case 'Lambda': {
      const inner = new Set(shadowed);
      for (const p of node.params) inner.add(p);
      collectRewritePositions(node.body, oldName, inner, out);
      return;
    }
    case 'BinaryOp':
      collectRewritePositions(node.left, oldName, shadowed, out);
      collectRewritePositions(node.right, oldName, shadowed, out);
      return;
    case 'UnaryOp':
      collectRewritePositions(node.operand, oldName, shadowed, out);
      return;
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'ConstantRef':
      return;
  }
}
