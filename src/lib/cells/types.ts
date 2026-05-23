// PROJ-9 — Cell types & shared validation helpers.
//
// Mirrors the public.cells row shape from
// supabase/migrations/20260524120000_sections_and_cells.sql.

import { RESERVED_WORDS } from '@/lib/formula';

export const MAX_CELL_NAME_LENGTH = 40;
export const CELL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

export const DEFAULT_CELL_LABEL = 'New cell';

export type CellKind = 'input' | 'output';
export type CellValueType =
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'boolean'
  | 'select'
  | 'text';
export type CellVisibility = 'visible' | 'hidden';
export type CellEditability = 'editable' | 'readonly';
export type CellDescriptionRender = 'caption' | 'tooltip';
export type CellDisplayEmphasis = 'plain' | 'kpi' | 'tabular';
export type CellCardBackgroundTint = 'none' | 'soft' | 'strong';
export type CellCardBorder = 'none' | 'hairline' | 'strong';
export type CellCardSizeHint = 'narrow' | 'wide' | 'full';

export type CellWidget =
  | 'number_field'
  | 'slider'
  | 'stepper'
  | 'date_picker'
  | 'toggle_switch'
  | 'radio_pair'
  | 'dropdown'
  | 'radio_buttons'
  | 'text_field';

export interface SelectOption {
  id: string;
  label: string;
}

export type CellDefaultValue =
  | number
  | string
  | boolean
  | null;

export interface CellRow {
  id: string;
  calculator_id: string;
  section_id: string;
  kind: CellKind;
  name: string;
  label: string;
  description: string;
  description_render: CellDescriptionRender;
  value_type: CellValueType;
  visibility: CellVisibility;
  editability: CellEditability;
  default_value: CellDefaultValue;
  formula: string | null;
  display_widget: CellWidget | null;
  display_format: string;
  display_emphasis: CellDisplayEmphasis;
  unit: string | null;
  numeric_min: number | null;
  numeric_max: number | null;
  numeric_step: number | null;
  select_options: SelectOption[] | null;
  currency_code: string | null;
  card_accent: string;
  card_background_tint: CellCardBackgroundTint;
  card_border: CellCardBorder;
  card_size_hint: CellCardSizeHint;
  text_size: string;
  text_colour: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type CellNameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'name_required' | 'name_invalid' | 'name_reserved'; reservedWord?: string };

/**
 * Validate a proposed cell name. Mirrors the database CHECK constraint
 * (`^[a-z][a-z0-9_]{0,39}$`) and the API-side reserved-word rejection.
 *
 * Reserved words are loaded from `@/lib/formula` so client and server
 * share a single source of truth — no drift window.
 */
export function validateCellName(raw: string): CellNameValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'name_required' };
  if (!CELL_NAME_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'name_invalid' };
  }
  if (RESERVED_WORDS.includes(trimmed)) {
    return { ok: false, reason: 'name_reserved', reservedWord: trimmed };
  }
  return { ok: true, value: trimmed };
}

/**
 * Compute the next free `cell_N` name for a calculator, given the set
 * of names already in use. Used by POST /api/sections/:sid/cells when
 * no explicit name is supplied.
 */
export function nextDefaultCellName(existing: Iterable<string>): string {
  const used = new Set(existing);
  let i = 1;
  while (used.has(`cell_${i}`)) i++;
  return `cell_${i}`;
}

/**
 * Default `editability` for a freshly-created cell of a given kind.
 * Inputs default to editable; Outputs default to readonly.
 */
export function defaultEditability(kind: CellKind): CellEditability {
  return kind === 'input' ? 'editable' : 'readonly';
}

/**
 * Default `display_widget` for a value_type. Mirrors the Widget
 * catalogue in features/PROJ-9-cell-authoring-and-section-management.md.
 */
export function defaultWidget(value_type: CellValueType): CellWidget {
  switch (value_type) {
    case 'number':
    case 'currency':
    case 'percent':
      return 'number_field';
    case 'date':
      return 'date_picker';
    case 'boolean':
      return 'toggle_switch';
    case 'select':
      return 'dropdown';
    case 'text':
      return 'text_field';
  }
}
