import { describe, it, expect } from 'vitest';
import { parse } from './parser';

describe('parser', () => {
  it('treats a leading = as the formula-start sigil', () => {
    const ast = parse('=1+2');
    expect(ast.type).toBe('BinaryOp');
  });

  it('parses the spec example formula', () => {
    const ast = parse('=PMT(monthly_rate, term_years*12, -loan_amount)');
    expect(ast).toMatchObject({
      type: 'FunctionCall',
      name: 'PMT',
      args: [
        { type: 'CellRef', name: 'monthly_rate' },
        {
          type: 'BinaryOp',
          op: '*',
          left: { type: 'CellRef', name: 'term_years' },
          right: { type: 'NumberLiteral', value: 12 },
        },
        {
          type: 'UnaryOp',
          op: '-',
          operand: { type: 'CellRef', name: 'loan_amount' },
        },
      ],
    });
  });

  it('parses TRUE and FALSE as boolean literals', () => {
    expect(parse('=TRUE')).toMatchObject({ type: 'BooleanLiteral', value: true });
    expect(parse('=false')).toMatchObject({ type: 'BooleanLiteral', value: false });
  });

  it('parses PI and E as bare constants', () => {
    expect(parse('=PI')).toMatchObject({ type: 'ConstantRef', name: 'PI' });
    expect(parse('=E')).toMatchObject({ type: 'ConstantRef', name: 'E' });
  });

  it('parses a single-parameter lambda', () => {
    const ast = parse('=MAP(SEQUENCE(3), i => i * 2)');
    expect(ast).toMatchObject({
      type: 'FunctionCall',
      name: 'MAP',
      args: [
        { type: 'FunctionCall', name: 'SEQUENCE' },
        { type: 'Lambda', params: ['i'] },
      ],
    });
  });

  it('parses a multi-parameter lambda', () => {
    const ast = parse('=REDUCE(SEQUENCE(3), 0, (acc, x) => acc + x)');
    const reduce = ast as { args: { type: string; params?: string[] }[] };
    expect(reduce.args[2]).toMatchObject({ type: 'Lambda', params: ['acc', 'x'] });
  });

  it('honours operator precedence: * binds tighter than +', () => {
    const ast = parse('=1+2*3');
    expect(ast).toMatchObject({
      type: 'BinaryOp',
      op: '+',
      left: { type: 'NumberLiteral', value: 1 },
      right: { type: 'BinaryOp', op: '*' },
    });
  });

  it('makes ^ right-associative', () => {
    const ast = parse('=2^3^2');
    // Should be 2^(3^2) not (2^3)^2.
    expect(ast).toMatchObject({
      type: 'BinaryOp',
      op: '^',
      left: { type: 'NumberLiteral', value: 2 },
      right: { type: 'BinaryOp', op: '^' },
    });
  });

  it('throws a friendly syntax error on unmatched paren', () => {
    expect(() => parse('=PMT(1, 2')).toThrowError(/Expected RPAREN/);
  });

  it('throws on trailing operator', () => {
    expect(() => parse('=1+')).toThrowError(/end of formula/);
  });

  it('throws on empty formula', () => {
    expect(() => parse('')).toThrowError(/Empty formula/);
    expect(() => parse('=')).toThrowError(/Empty formula|Unexpected/);
  });

  it('uppercases function names for case-insensitive dispatch', () => {
    expect(parse('=pmt(1,2,3)')).toMatchObject({ type: 'FunctionCall', name: 'PMT' });
    expect(parse('=Pmt(1,2,3)')).toMatchObject({ type: 'FunctionCall', name: 'PMT' });
  });
});
