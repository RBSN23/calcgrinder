// AST node shapes. Pure types — no logic, no defaults.
//
// The parser only emits one of these. There is intentionally no
// "raw JS" or "eval" node — sandboxing relies on this set being
// closed.

export type AstNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | CellRef
  | ConstantRef
  | FunctionCall
  | Lambda
  | BinaryOp
  | UnaryOp;

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
  column: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
  column: number;
}

export interface BooleanLiteral {
  type: 'BooleanLiteral';
  value: boolean;
  column: number;
}

// snake_case lowercase identifier — references another cell by name.
export interface CellRef {
  type: 'CellRef';
  name: string;
  column: number;
}

// Bare-identifier constant: PI, E. (TRUE/FALSE are BooleanLiteral.)
export interface ConstantRef {
  type: 'ConstantRef';
  name: 'PI' | 'E';
  column: number;
}

// Function call: `NAME(arg1, arg2, ...)`. The parser uppercases
// `name` so dispatch is case-insensitive on the way in.
export interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  args: AstNode[];
  column: number;
}

// Arrow lambda with one or more parameters and a single expression
// body: `i => i * 2` or `(acc, x) => acc + x`.
export interface Lambda {
  type: 'Lambda';
  params: string[];
  body: AstNode;
  column: number;
}

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^'
  | '&'
  | '='
  | '<>'
  | '<'
  | '>'
  | '<='
  | '>=';

export interface BinaryOp {
  type: 'BinaryOp';
  op: BinaryOperator;
  left: AstNode;
  right: AstNode;
  column: number;
}

export type UnaryOperator = '-' | '+' | 'NOT';

export interface UnaryOp {
  type: 'UnaryOp';
  op: UnaryOperator;
  operand: AstNode;
  column: number;
}
