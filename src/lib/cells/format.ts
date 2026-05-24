// PROJ-17 — Shared formatter for cell values and table cell values.
//
// Single source of truth for the 10-entry display_format catalogue
// shared between scalar cells (PROJ-9 cell-card) and the per-column
// renderer (PROJ-17 tabular-renderer). Inlining a copy in either
// callsite drifts the moment a format entry changes.
//
// Contract: `formatValue(spec, value)` returns a *plain string* —
// never raw HTML. React renders the return as a text node, so there
// is no XSS surface even when row values come from untrusted formula
// inputs.

import { isEmpty } from '@/lib/formula';

import type { CellRow, CellValueType } from './types';

export type DisplayFormat =
  | 'auto'
  | 'number_integer'
  | 'number_decimal_2'
  | 'number_decimal_4'
  | 'currency'
  | 'percent_0'
  | 'percent_2'
  | 'date_short'
  | 'date_long'
  | 'text_plain';

export const DISPLAY_FORMATS: readonly DisplayFormat[] = [
  'auto',
  'number_integer',
  'number_decimal_2',
  'number_decimal_4',
  'currency',
  'percent_0',
  'percent_2',
  'date_short',
  'date_long',
  'text_plain',
];

export interface FormatSpec {
  format: string;
  currency_code?: string | null;
  // PROJ-9 cells carry a `value_type` that nudges some legacy
  // formatting decisions (text → String(raw); boolean → Yes/No). Table
  // columns don't carry a value_type — defaults handle those rows.
  value_type?: CellValueType;
}

const EM_DASH = '—';

export function formatValue(spec: FormatSpec, raw: unknown): string {
  if (raw === undefined || raw === null) return EM_DASH;
  if (isEmpty(raw)) return EM_DASH;

  const { format, currency_code, value_type } = spec;

  // Honour the cell-level value_type override only when there's no
  // explicit format selection (i.e. `auto`). A column with format =
  // 'currency' shouldn't be overridden by an inherited value_type of
  // 'text' from a cell.
  if (value_type === 'boolean' && (format === 'auto' || format === 'text_plain')) {
    return raw ? 'Yes' : 'No';
  }
  if (value_type === 'text' && (format === 'auto' || format === 'text_plain')) {
    return String(raw);
  }

  const num = typeof raw === 'number' ? raw : Number(raw);

  try {
    if (format === 'currency' || value_type === 'currency') {
      if (!Number.isFinite(num)) return String(raw);
      const code = currency_code || 'USD';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 2,
      }).format(num);
    }
    if (format === 'percent_0' || format === 'percent_2' || value_type === 'percent') {
      if (!Number.isFinite(num)) return String(raw);
      const fractionDigits = format === 'percent_0' ? 0 : 2;
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: fractionDigits,
      }).format(num);
    }
    if (format === 'date_short' || format === 'date_long' || value_type === 'date') {
      const date = raw instanceof Date ? raw : new Date(String(raw));
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: format === 'date_long' ? 'long' : 'short',
          day: 'numeric',
        });
      }
      return String(raw);
    }
    if (format === 'number_integer') {
      if (!Number.isFinite(num)) return String(raw);
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
    }
    if (format === 'number_decimal_2') {
      if (!Number.isFinite(num)) return String(raw);
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    }
    if (format === 'number_decimal_4') {
      if (!Number.isFinite(num)) return String(raw);
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }).format(num);
    }
    if (format === 'text_plain') {
      if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
      return String(raw);
    }
    // `format === 'auto'` (or anything unrecognised) — number-friendly
    // fallback that mirrors PROJ-9's pre-PROJ-17 behaviour.
    if (Number.isFinite(num) && typeof raw !== 'boolean') {
      return new Intl.NumberFormat('en-US').format(num);
    }
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
    return String(raw);
  } catch {
    return String(raw);
  }
}

/**
 * Convenience wrapper for cell rendering — derives the FormatSpec
 * from a CellRow so cell-card.tsx can call one line instead of
 * constructing the spec at each call site.
 */
export function formatCellValue(cell: CellRow, raw: unknown): string {
  return formatValue(
    {
      format: cell.display_format,
      currency_code: cell.currency_code,
      value_type: cell.value_type,
    },
    raw,
  );
}

/**
 * Humanise a snake_case formula key for use as a default column label
 * (`monthly_payment` → "Monthly payment"). PROJ-17 auto-populates new
 * column entries with this; the maintainer can override per-column.
 */
export function humaniseKey(key: string): string {
  const cleaned = key.replace(/_+/g, ' ').trim();
  if (cleaned.length === 0) return key;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Infer a sensible default column `format` and `alignment` from a
 * sample value. Used at first-Tabular-activation and during
 * smart-merge for newly-introduced keys.
 */
export function inferColumnFormatting(sample: unknown): {
  format: DisplayFormat;
  alignment: 'left' | 'right';
} {
  if (typeof sample === 'number' && Number.isFinite(sample)) {
    return { format: 'number_decimal_2', alignment: 'right' };
  }
  if (sample instanceof Date) {
    return { format: 'date_short', alignment: 'left' };
  }
  if (typeof sample === 'string') {
    // Looks like an ISO date? Use date_short.
    if (/^\d{4}-\d{2}-\d{2}/.test(sample) && !Number.isNaN(new Date(sample).getTime())) {
      return { format: 'date_short', alignment: 'left' };
    }
  }
  if (typeof sample === 'boolean') {
    return { format: 'text_plain', alignment: 'left' };
  }
  return { format: 'text_plain', alignment: 'left' };
}
