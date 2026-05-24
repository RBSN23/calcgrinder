// PROJ-9 — Server-side cell field validation.
//
// Encodes the rules the database CHECK constraints + RESERVED_WORDS
// list enforce. Used by the cell POST + PATCH route handlers to map
// invalid bodies to the AC-specified HTTP error shapes.

import { RESERVED_WORDS, MAX_FORMULA_LEN } from '@/lib/formula';

import {
  CELL_NAME_PATTERN,
  MAX_TABULAR_COLUMN_LABEL_LENGTH,
  MAX_TABULAR_COLUMNS,
  type CellKind,
  type CellVisibility,
  type CellEditability,
  type CellValueType,
  type TabularColumn,
} from './types';
import { DISPLAY_FORMATS } from './format';

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

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const ALIGNMENTS: readonly TabularColumn['alignment'][] = ['left', 'center', 'right'];
const VISIBILITIES: readonly TabularColumn['visibility'][] = ['visible', 'hidden'];

/**
 * Validate a `tabular_columns` array against the per-row Zod-style
 * rules from PROJ-17 §"Column-config field validation". Returns
 * { ok: false, … } with the AC-specified error codes on the first
 * row that fails; { ok: true, normalised } with the normalised array
 * (currency_codes upper-cased) on success.
 *
 * Spec hooks:
 *  - column_label_too_long  → > MAX_TABULAR_COLUMN_LABEL_LENGTH chars.
 *  - invalid_column_format  → format not in DISPLAY_FORMATS.
 *  - invalid_column_alignment → alignment not in ALIGNMENTS.
 *  - invalid_currency_code  → not /^[A-Z]{3}$/ after upper-casing.
 *  - tabular_columns_too_long → > MAX_TABULAR_COLUMNS entries.
 *  - tabular_columns_duplicate_id → two rows with the same id.
 */
export function validateTabularColumns(
  raw: unknown,
): CellValidationResult & { normalised?: TabularColumn[] } {
  if (raw === undefined || raw === null) return { ok: true };
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'invalid_tabular_columns' },
    };
  }
  if (raw.length > MAX_TABULAR_COLUMNS) {
    return {
      ok: false,
      status: 400,
      body: { error: 'tabular_columns_too_long', max: MAX_TABULAR_COLUMNS },
    };
  }
  const normalised: TabularColumn[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      return {
        ok: false,
        status: 400,
        body: { error: 'invalid_tabular_columns' },
      };
    }
    const r = entry as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : null;
    if (!id) {
      return {
        ok: false,
        status: 400,
        body: { error: 'invalid_tabular_columns' },
      };
    }
    if (seenIds.has(id)) {
      return {
        ok: false,
        status: 400,
        body: { error: 'tabular_columns_duplicate_id', id },
      };
    }
    seenIds.add(id);
    const label = typeof r.label === 'string' ? r.label : '';
    if (label.length > MAX_TABULAR_COLUMN_LABEL_LENGTH) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'column_label_too_long',
          max: MAX_TABULAR_COLUMN_LABEL_LENGTH,
        },
      };
    }
    const format = typeof r.format === 'string' ? r.format : 'auto';
    if (!(DISPLAY_FORMATS as readonly string[]).includes(format)) {
      return {
        ok: false,
        status: 400,
        body: { error: 'invalid_column_format' },
      };
    }
    const alignment = (typeof r.alignment === 'string'
      ? r.alignment
      : 'left') as TabularColumn['alignment'];
    if (!(ALIGNMENTS as readonly string[]).includes(alignment)) {
      return {
        ok: false,
        status: 400,
        body: { error: 'invalid_column_alignment' },
      };
    }
    const visibility = (typeof r.visibility === 'string'
      ? r.visibility
      : 'visible') as TabularColumn['visibility'];
    if (!(VISIBILITIES as readonly string[]).includes(visibility)) {
      return {
        ok: false,
        status: 400,
        body: { error: 'invalid_column_visibility' },
      };
    }
    let currency_code: string | null = null;
    if (r.currency_code != null && r.currency_code !== '') {
      const raw = typeof r.currency_code === 'string' ? r.currency_code : '';
      const upper = raw.toUpperCase();
      if (!CURRENCY_PATTERN.test(upper)) {
        return {
          ok: false,
          status: 400,
          body: {
            error: 'invalid_currency_code',
            pattern: 'ISO 4217 (3 uppercase letters)',
          },
        };
      }
      currency_code = upper;
    }
    normalised.push({
      id,
      label,
      format,
      alignment,
      currency_code,
      visibility,
    });
  }
  return { ok: true, normalised };
}
