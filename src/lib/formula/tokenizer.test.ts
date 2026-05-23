import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenizer';

describe('tokenizer', () => {
  it('tokenizes numbers including decimals and exponents', () => {
    const toks = tokenize('1 23 4.5 .25 1e3 2.5e-2');
    expect(toks.map((t) => t.value)).toEqual([
      '1', '23', '4.5', '.25', '1e3', '2.5e-2', '',
    ]);
  });

  it('tokenizes identifiers and operators', () => {
    const toks = tokenize('PMT(monthly_rate, term*12)');
    expect(toks.map((t) => `${t.type}:${t.value}`)).toEqual([
      'IDENT:PMT', 'LPAREN:(', 'IDENT:monthly_rate', 'COMMA:,',
      'IDENT:term', 'OP:*', 'NUMBER:12', 'RPAREN:)', 'EOF:',
    ]);
  });

  it('normalizes != to <>', () => {
    const toks = tokenize('1 != 2');
    expect(toks[1]).toMatchObject({ type: 'OP', value: '<>' });
  });

  it('handles two-character comparison operators', () => {
    const toks = tokenize('a <= b >= c <> d');
    expect(toks.filter((t) => t.type === 'OP').map((t) => t.value)).toEqual([
      '<=', '>=', '<>',
    ]);
  });

  it('parses doubled-quote string escapes', () => {
    const toks = tokenize('"hello ""world"""');
    expect(toks[0]).toMatchObject({ type: 'STRING', value: 'hello "world"' });
  });

  it('throws on unterminated strings', () => {
    expect(() => tokenize('"oops')).toThrowError(/Unterminated string/);
  });

  it('throws on unexpected characters', () => {
    expect(() => tokenize('a @ b')).toThrowError(/Unexpected character/);
  });

  it('recognizes the arrow token for lambdas', () => {
    const toks = tokenize('i => i * 2');
    expect(toks[1]).toMatchObject({ type: 'ARROW', value: '=>' });
  });
});
