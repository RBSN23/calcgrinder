import { describe, expect, it } from 'vitest';
import { getFunctionCatalogue } from './catalogue';
import { RESERVED_WORDS } from './functions';

describe('getFunctionCatalogue', () => {
  it('returns a metadata-only projection', () => {
    const cat = getFunctionCatalogue();
    expect(cat.length).toBeGreaterThanOrEqual(60);
    for (const entry of cat) {
      expect(entry).toMatchObject({
        name: expect.any(String),
        signature: expect.any(String),
        category: expect.any(String),
        short_description: expect.any(String),
      });
      // implementation is NOT exposed.
      expect((entry as unknown as Record<string, unknown>).evaluate).toBeUndefined();
    }
  });

  it('includes every spec-mandated function name', () => {
    const cat = getFunctionCatalogue();
    const names = new Set(cat.map((f) => f.name));
    const required = [
      // math
      'ABS', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'SQRT', 'POWER', 'MIN', 'MAX',
      'MOD', 'FLOOR', 'CEILING', 'LOG', 'LN', 'EXP', 'SIGN', 'INT', 'RANDBETWEEN',
      // logical
      'IF', 'IFS', 'AND', 'OR', 'NOT',
      // predicate
      'ISEMPTY', 'ISBLANK', 'ISNUMBER', 'ISTEXT',
      // financial
      'PMT', 'FV', 'PV', 'NPV', 'IRR', 'RATE', 'NPER', 'IPMT', 'PPMT', 'CUMIPMT',
      // statistical
      'SUM', 'AVERAGE', 'COUNT', 'MEDIAN', 'STDEV', 'PRODUCT', 'SUMIF', 'COUNTIF',
      // string
      'CONCAT', 'LEFT', 'RIGHT', 'MID', 'LEN', 'LOWER', 'UPPER', 'TRIM',
      'SUBSTITUTE', 'TEXT',
      // date
      'TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY', 'DAYS', 'EDATE', 'EOMONTH', 'WEEKDAY',
      // array
      'SEQUENCE', 'RANGE', 'MAP', 'FILTER', 'REDUCE', 'OBJECT', 'RECORD',
    ];
    for (const name of required) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('marks volatile functions', () => {
    const cat = getFunctionCatalogue();
    const todayEntry = cat.find((f) => f.name === 'TODAY');
    expect(todayEntry?.is_volatile).toBe(true);
  });

  it('RESERVED_WORDS includes function names and bare constants', () => {
    // Function names: both cases (case-insensitive dispatch).
    expect(RESERVED_WORDS).toContain('PMT');
    expect(RESERVED_WORDS).toContain('pmt');
    // Boolean literals: both cases (Excel-style case-insensitive).
    expect(RESERVED_WORDS).toContain('TRUE');
    expect(RESERVED_WORDS).toContain('false');
    // PI / E: only the uppercase forms are reserved — lowercase
    // `pi` / `e` are valid cell names.
    expect(RESERVED_WORDS).toContain('PI');
    expect(RESERVED_WORDS).toContain('E');
    expect(RESERVED_WORDS).not.toContain('e');
    expect(RESERVED_WORDS).not.toContain('pi');
    expect(RESERVED_WORDS).toContain('EMPTY');
  });
});
