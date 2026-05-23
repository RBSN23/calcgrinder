// Recursive-descent parser: token stream → AST.
//
// Grammar (highest precedence first; right-associative noted):
//
//   formula     := "=" expression EOF
//   expression  := lambda | comparison
//   lambda      := IDENT "=>" expression
//                | "(" IDENT ("," IDENT)* ")" "=>" expression
//   comparison  := concat ( ("=" | "<>" | "<" | ">" | "<=" | ">=") concat )*
//   concat      := additive ( "&" additive )*
//   additive    := multiplicative ( ("+"|"-") multiplicative )*
//   multiplicative := power ( ("*"|"/"|"%") power )*
//   power       := unary ( "^" power )?           // right-assoc
//   unary       := ("+"|"-") unary | primary
//   primary     := NUMBER | STRING | "(" expression ")"
//                | IDENT                          // cell-ref, constant, or bool literal
//                | IDENT "(" arg-list? ")"        // function call
//   arg-list    := expression ("," expression)*
//
// Cell-ref / function dispatch is decided by whether the identifier
// is immediately followed by "(" — function — and whether the bare
// identifier matches a known constant (PI, E) or bool literal
// (TRUE, FALSE).

import type {
  AstNode,
  BinaryOperator,
  Lambda,
  UnaryOperator,
} from './ast';
import { syntaxError } from './errors';
import { tokenize, type Token } from './tokenizer';

const BARE_CONSTANTS = new Set(['PI', 'E']);

export function parse(input: string): AstNode {
  let body = input;
  let bodyColumnOffset = 0;
  // Allow optional leading "=" sigil — Excel-style.
  // The acceptance criterion says formulas start with "=", so most
  // do, but we don't reject formulas that omit it (the editor may
  // store either form). The leading whitespace is also tolerated.
  const trimmed = body.replace(/^\s+/, '');
  bodyColumnOffset = body.length - trimmed.length;
  body = trimmed;
  if (body.startsWith('=')) {
    body = body.slice(1);
    bodyColumnOffset += 1;
  }
  if (body.trim() === '') {
    throw syntaxError('Empty formula', bodyColumnOffset);
  }

  const tokens = tokenize(body);
  const parser = new Parser(tokens, bodyColumnOffset);
  const ast = parser.parseExpression();
  parser.expectEof();
  return ast;
}

class Parser {
  private i = 0;
  constructor(private tokens: Token[], private colOffset: number) {}

  parseExpression(): AstNode {
    // Lambdas: detect bare-ident-arrow or paren-list-arrow.
    if (this.isLambdaStart()) {
      return this.parseLambda();
    }
    return this.parseComparison();
  }

  private isLambdaStart(): boolean {
    const t = this.peek();
    // form: IDENT =>
    if (t.type === 'IDENT' && this.peek(1).type === 'ARROW') {
      // Don't treat a bare bool literal or constant as a lambda
      // parameter. (`TRUE => x` is nonsense; reject as syntax.)
      const upper = t.value.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') return false;
      return true;
    }
    // form: ( IDENT [, IDENT]* ) =>
    if (t.type === 'LPAREN') {
      let j = this.i + 1;
      if (this.tokens[j]?.type !== 'IDENT') return false;
      j++;
      while (this.tokens[j]?.type === 'COMMA') {
        j++;
        if (this.tokens[j]?.type !== 'IDENT') return false;
        j++;
      }
      if (this.tokens[j]?.type !== 'RPAREN') return false;
      if (this.tokens[j + 1]?.type !== 'ARROW') return false;
      return true;
    }
    return false;
  }

  private parseLambda(): Lambda {
    const startCol = this.peek().column + this.colOffset;
    const params: string[] = [];
    if (this.peek().type === 'LPAREN') {
      this.consume('LPAREN');
      params.push(this.consume('IDENT').value);
      while (this.peek().type === 'COMMA') {
        this.consume('COMMA');
        params.push(this.consume('IDENT').value);
      }
      this.consume('RPAREN');
    } else {
      params.push(this.consume('IDENT').value);
    }
    // Reject UPPERCASE param names that collide with reserved words.
    for (const p of params) {
      if (BARE_CONSTANTS.has(p.toUpperCase()) || p.toUpperCase() === 'TRUE' || p.toUpperCase() === 'FALSE') {
        throw syntaxError(`'${p}' is a reserved word and cannot be a lambda parameter`, startCol);
      }
    }
    this.consume('ARROW');
    const body = this.parseExpression();
    return { type: 'Lambda', params, body, column: startCol };
  }

  private parseComparison(): AstNode {
    let left = this.parseConcat();
    while (this.isOp('=', '<>', '<', '>', '<=', '>=')) {
      const tok = this.consume('OP');
      const right = this.parseConcat();
      left = {
        type: 'BinaryOp',
        op: tok.value as BinaryOperator,
        left,
        right,
        column: tok.column + this.colOffset,
      };
    }
    return left;
  }

  private parseConcat(): AstNode {
    let left = this.parseAdditive();
    while (this.isOp('&')) {
      const tok = this.consume('OP');
      const right = this.parseAdditive();
      left = {
        type: 'BinaryOp',
        op: '&',
        left,
        right,
        column: tok.column + this.colOffset,
      };
    }
    return left;
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative();
    while (this.isOp('+', '-')) {
      const tok = this.consume('OP');
      const right = this.parseMultiplicative();
      left = {
        type: 'BinaryOp',
        op: tok.value as BinaryOperator,
        left,
        right,
        column: tok.column + this.colOffset,
      };
    }
    return left;
  }

  private parseMultiplicative(): AstNode {
    let left = this.parseUnary();
    while (this.isOp('*', '/', '%')) {
      const tok = this.consume('OP');
      const right = this.parseUnary();
      left = {
        type: 'BinaryOp',
        op: tok.value as BinaryOperator,
        left,
        right,
        column: tok.column + this.colOffset,
      };
    }
    return left;
  }

  // Unary binds LOOSER than ^ so `-2^2` parses as `-(2^2) = -4`
  // (math convention). Excel's `=-2^2 = 4` is the alternative; we
  // chose math convention for plain-English parity.
  private parseUnary(): AstNode {
    if (this.isOp('+', '-')) {
      const tok = this.consume('OP');
      const operand = this.parseUnary();
      return {
        type: 'UnaryOp',
        op: tok.value as UnaryOperator,
        operand,
        column: tok.column + this.colOffset,
      };
    }
    return this.parsePower();
  }

  private parsePower(): AstNode {
    const left = this.parsePrimary();
    if (this.isOp('^')) {
      const tok = this.consume('OP');
      const right = this.parsePower(); // right-assoc
      return {
        type: 'BinaryOp',
        op: '^',
        left,
        right,
        column: tok.column + this.colOffset,
      };
    }
    return left;
  }

  private parsePrimary(): AstNode {
    const tok = this.peek();
    if (tok.type === 'NUMBER') {
      this.i++;
      const n = Number(tok.value);
      if (!Number.isFinite(n)) {
        throw syntaxError(`Invalid number '${tok.value}'`, tok.column + this.colOffset);
      }
      return { type: 'NumberLiteral', value: n, column: tok.column + this.colOffset };
    }
    if (tok.type === 'STRING') {
      this.i++;
      return { type: 'StringLiteral', value: tok.value, column: tok.column + this.colOffset };
    }
    if (tok.type === 'LPAREN') {
      this.i++;
      const inner = this.parseExpression();
      this.consume('RPAREN');
      return inner;
    }
    if (tok.type === 'IDENT') {
      this.i++;
      // Function call?
      if (this.peek().type === 'LPAREN') {
        this.consume('LPAREN');
        const args: AstNode[] = [];
        if (this.peek().type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek().type === 'COMMA') {
            this.consume('COMMA');
            args.push(this.parseExpression());
          }
        }
        this.consume('RPAREN');
        return {
          type: 'FunctionCall',
          name: tok.value.toUpperCase(),
          args,
          column: tok.column + this.colOffset,
        };
      }
      // Bare identifier: bool literal, bare constant, or cell-ref.
      // TRUE/FALSE are case-insensitive (Excel-style). PI/E are
      // case-SENSITIVE — lowercase `e` is a valid cell name, only
      // exact-case `PI`/`E` refer to the math constants.
      const upper = tok.value.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        return {
          type: 'BooleanLiteral',
          value: upper === 'TRUE',
          column: tok.column + this.colOffset,
        };
      }
      if (BARE_CONSTANTS.has(tok.value)) {
        return {
          type: 'ConstantRef',
          name: tok.value as 'PI' | 'E',
          column: tok.column + this.colOffset,
        };
      }
      // Otherwise it's a cell-ref. We do NOT enforce the snake_case
      // pattern here — that's PROJ-9's name-validation job, and the
      // engine just resolves whatever it gets. The analyzer will
      // report unknown_name if the cell isn't on the calculator.
      return {
        type: 'CellRef',
        name: tok.value,
        column: tok.column + this.colOffset,
      };
    }
    if (tok.type === 'EOF') {
      throw syntaxError('Unexpected end of formula', tok.column + this.colOffset);
    }
    if (tok.type === 'RPAREN') {
      throw syntaxError(`Unexpected ')'`, tok.column + this.colOffset);
    }
    if (tok.type === 'COMMA') {
      throw syntaxError(`Unexpected ','`, tok.column + this.colOffset);
    }
    if (tok.type === 'ARROW') {
      throw syntaxError(`Unexpected '=>'`, tok.column + this.colOffset);
    }
    if (tok.type === 'OP') {
      throw syntaxError(`Unexpected operator '${tok.value}'`, tok.column + this.colOffset);
    }
    throw syntaxError(`Unexpected token '${tok.value}'`, tok.column + this.colOffset);
  }

  private peek(offset = 0): Token {
    return (
      this.tokens[this.i + offset] ?? { type: 'EOF', value: '', column: 0 }
    );
  }

  private consume(type: Token['type']): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw syntaxError(
        `Expected ${type}, got ${tok.type === 'EOF' ? 'end of formula' : `'${tok.value}'`}`,
        tok.column + this.colOffset
      );
    }
    this.i++;
    return tok;
  }

  private isOp(...ops: string[]): boolean {
    const t = this.peek();
    return t.type === 'OP' && ops.includes(t.value);
  }

  expectEof(): void {
    const t = this.peek();
    if (t.type !== 'EOF') {
      throw syntaxError(
        `Unexpected '${t.value}' (trailing content after expression)`,
        t.column + this.colOffset
      );
    }
  }
}
