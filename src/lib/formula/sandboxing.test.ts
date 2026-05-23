// Regression check: the engine source tree never reaches for `eval`,
// `Function` constructor, or `with`. The spec's sandboxing
// acceptance criterion is satisfied structurally — this test guards
// against future drift.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) yield full;
  }
}

describe('engine source sandboxing', () => {
  it('never uses eval / Function constructor / with', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const src = readFileSync(file, 'utf8');
      // Strip line comments first to ignore "no eval, no Function, …"
      // explanatory text in comments without false-positive flagging.
      const stripped = src
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      if (/\beval\s*\(/.test(stripped)) offenders.push(`${file}: eval(`);
      if (/\bnew\s+Function\s*\(/.test(stripped)) offenders.push(`${file}: new Function(`);
      if (/\bwith\s*\(/.test(stripped)) offenders.push(`${file}: with(`);
    }
    expect(offenders).toEqual([]);
  });
});
