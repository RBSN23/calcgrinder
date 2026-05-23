// Tokenizer: formula string → flat token stream.
//
// Operates on the formula body (the leading `=` sigil is stripped by
// the parser entry-point before this runs). Single- and double-quoted
// strings are both accepted; escape sequence is doubled quote
// (Excel-style: `""` inside a "…" string = literal `"`).

import { syntaxError } from './errors';

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENT'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'ARROW'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  column: number;
}

const SINGLE_OPS = new Set(['+', '-', '*', '/', '%', '^', '&']);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Numbers: 123, 123.45, .5, 1e-3
    if (isDigit(ch) || (ch === '.' && isDigit(input[i + 1] ?? ''))) {
      const start = i;
      while (i < len && isDigit(input[i]!)) i++;
      if (input[i] === '.') {
        i++;
        while (i < len && isDigit(input[i]!)) i++;
      }
      // exponent
      if (input[i] === 'e' || input[i] === 'E') {
        i++;
        if (input[i] === '+' || input[i] === '-') i++;
        if (!isDigit(input[i] ?? '')) {
          throw syntaxError('Invalid number (expected digit after exponent)', i);
        }
        while (i < len && isDigit(input[i]!)) i++;
      }
      tokens.push({ type: 'NUMBER', value: input.slice(start, i), column: start });
      continue;
    }

    // Strings: "…" or '…' with doubled-quote escape
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let value = '';
      while (i < len) {
        if (input[i] === quote) {
          if (input[i + 1] === quote) {
            // Doubled-quote escape.
            value += quote;
            i += 2;
            continue;
          }
          break;
        }
        value += input[i];
        i++;
      }
      if (i >= len) {
        throw syntaxError('Unterminated string', start);
      }
      i++; // closing quote
      tokens.push({ type: 'STRING', value, column: start });
      continue;
    }

    // Identifiers: letters, digits, underscores. Must start with a
    // letter or underscore. We let the parser decide whether a given
    // identifier is a cell-ref, function, constant, or boolean.
    if (isIdentStart(ch!)) {
      const start = i;
      while (i < len && isIdentCont(input[i]!)) i++;
      tokens.push({ type: 'IDENT', value: input.slice(start, i), column: start });
      continue;
    }

    // Punctuation / operators
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', column: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', column: i });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', column: i });
      i++;
      continue;
    }

    // Two-character operators first, then arrow, then single.
    const two = input.slice(i, i + 2);
    if (two === '=>') {
      tokens.push({ type: 'ARROW', value: '=>', column: i });
      i += 2;
      continue;
    }
    if (two === '<=' || two === '>=' || two === '<>' || two === '!=') {
      // Normalize `!=` to `<>` for downstream simplicity.
      tokens.push({ type: 'OP', value: two === '!=' ? '<>' : two, column: i });
      i += 2;
      continue;
    }
    if (ch === '<' || ch === '>' || ch === '=') {
      tokens.push({ type: 'OP', value: ch, column: i });
      i++;
      continue;
    }
    if (SINGLE_OPS.has(ch!)) {
      tokens.push({ type: 'OP', value: ch!, column: i });
      i++;
      continue;
    }

    throw syntaxError(`Unexpected character '${ch}'`, i);
  }

  tokens.push({ type: 'EOF', value: '', column: input.length });
  return tokens;
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

function isIdentStart(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
}

function isIdentCont(c: string): boolean {
  return isIdentStart(c) || isDigit(c);
}
