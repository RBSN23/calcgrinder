// PROJ-9 — Server-side cell field validation.
//
// Encodes the rules the database CHECK constraints + RESERVED_WORDS
// list enforce. Used by the cell POST + PATCH route handlers to map
// invalid bodies to the AC-specified HTTP error shapes.

import { RESERVED_WORDS, MAX_FORMULA_LEN } from '@/lib/formula';

import {
  CELL_NAME_PATTERN,
  type CellKind,
  type CellVisibility,
  type CellEditability,
  type CellValueType,
} from './types';

export type CellValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

const CELL_VALUE_TYPES: readonly CellValueType[] = [
  'number',
  'currency',
  'percent',
  'date',
  'boolean',
  'select',
  'text',
];

export function validateCellNameField(name: string): CellValidationResult {
  if (!CELL_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'name_invalid',
        pattern_description:
          'Lowercase letters, digits, and underscores only. Must start with a letter. Max 40 chars.',
      },
    };
  }
  if (RESERVED_WORDS.includes(name)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'name_reserved', reserved_word: name },
    };
  }
  return { ok: true };
}

export function validateValueType(value_type: string): CellValidationResult {
  if (!(CELL_VALUE_TYPES as readonly string[]).includes(value_type)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'value_type_invalid' },
    };
  }
  return { ok: true };
}

export function validateFormulaLength(formula: string): CellValidationResult {
  if (formula.length > MAX_FORMULA_LEN) {
    return {
      ok: false,
      status: 422,
      body: { error: 'formula_too_long', max: MAX_FORMULA_LEN },
    };
  }
  return { ok: true };
}

/**
 * Composite check: hidden cells and readonly Inputs must carry a
 * default_value. Outputs must carry a non-null formula (the DB enforces
 * the latter; we surface a friendlier error than a constraint violation).
 */
export function validateCellInvariants(args: {
  kind: CellKind;
  visibility: CellVisibility;
  editability: CellEditability;
  default_value: unknown;
  formula: string | null;
}): CellValidationResult {
  const { kind, visibility, editability, default_value, formula } = args;
  if (visibility === 'hidden' && default_value == null) {
    return {
      ok: false,
      status: 422,
      body: { error: 'hidden_requires_value' },
    };
  }
  if (
    kind === 'input' &&
    editability === 'readonly' &&
    default_value == null
  ) {
    return {
      ok: false,
      status: 422,
      body: { error: 'readonly_input_requires_value' },
    };
  }
  if (kind === 'output' && formula == null) {
    return {
      ok: false,
      status: 422,
      body: { error: 'output_requires_formula' },
    };
  }
  return { ok: true };
}
