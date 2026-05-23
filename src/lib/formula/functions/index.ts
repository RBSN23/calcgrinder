// Frozen function table — single source of truth for everything the
// engine can call. Per the spec's sandboxing rules:
//   • enumerable + fixed at module load
//   • no dynamic registration at runtime
//   • the catalogue is a pure projection of this table
//
// Adding a function: add it to the appropriate category file, then
// nothing else here changes — the table is built by concatenating
// the per-category arrays at module load.

import { ARRAY_FUNCTIONS } from './array';
import { DATE_FUNCTIONS } from './date';
import { FINANCIAL_FUNCTIONS } from './financial';
import { LOGICAL_FUNCTIONS } from './logical';
import { MATH_FUNCTIONS } from './math';
import { PREDICATE_FUNCTIONS } from './predicate';
import { STATISTICAL_FUNCTIONS } from './statistical';
import { STRING_FUNCTIONS } from './string';
import type { FunctionEntry } from './types';

const ALL: FunctionEntry[] = [
  ...MATH_FUNCTIONS,
  ...LOGICAL_FUNCTIONS,
  ...PREDICATE_FUNCTIONS,
  ...FINANCIAL_FUNCTIONS,
  ...STATISTICAL_FUNCTIONS,
  ...STRING_FUNCTIONS,
  ...DATE_FUNCTIONS,
  ...ARRAY_FUNCTIONS,
];

const table: Record<string, FunctionEntry> = {};
for (const fn of ALL) {
  if (table[fn.name]) {
    throw new Error(`Duplicate function in table: ${fn.name}`);
  }
  table[fn.name] = fn;
}

export const FUNCTION_TABLE: Readonly<Record<string, FunctionEntry>> = Object.freeze(table);

export const FUNCTION_LIST: readonly FunctionEntry[] = Object.freeze(ALL);

// Reserved-word set: every function name plus the bare-constant /
// literal identifiers. Exported so PROJ-9 name-validation can reject
// `pmt`, `PMT`, `TRUE`, `FALSE`, `PI`, `E`, `EMPTY` as cell names
// without having to know the engine's internal taxonomy.
//
// Per the spec's edge-case note, formula authoring tokenizes
// function names case-insensitively for friendliness — so a cell
// named `PMT` would shadow the function on resolution. We add both
// the UPPERCASE form (the canonical function name) and the
// lowercase form (the typical cell-name spelling) to keep
// validation predictable.
function buildReservedWords(): readonly string[] {
  const set = new Set<string>();
  for (const fn of ALL) {
    set.add(fn.name);
    set.add(fn.name.toLowerCase());
  }
  // TRUE/FALSE are case-insensitive boolean literals, so reject
  // either case as a cell name. PI/E are case-SENSITIVE constants
  // (lowercase `e` is a valid cell name) — only reject the uppercase
  // forms. EMPTY is the engine's sentinel-name and is reserved in
  // both cases to keep its meaning unambiguous in formulas.
  for (const w of ['TRUE', 'FALSE']) {
    set.add(w);
    set.add(w.toLowerCase());
  }
  for (const w of ['PI', 'E']) set.add(w);
  for (const w of ['EMPTY']) {
    set.add(w);
    set.add(w.toLowerCase());
  }
  return Object.freeze([...set].sort());
}

export const RESERVED_WORDS: readonly string[] = buildReservedWords();
