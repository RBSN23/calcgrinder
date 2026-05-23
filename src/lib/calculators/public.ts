import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type {
  PublicCalculator,
  PublicCalculatorFetchResult,
  PublicSection,
  PublicSectionCell,
} from './types';

/**
 * PROJ-11 — server-side fetch for the anonymous /c/<token> visitor route.
 *
 * Single round trip via the `fn_get_public_calculator(p_token)` SECURITY
 * DEFINER RPC. The RPC bypasses owner-scoped RLS but is gated by the
 * 128-bit unguessable token match, so anonymous callers cannot enumerate
 * calculators with a leaked anon key.
 *
 * Result discriminator:
 *   - { status: 'ok',   calculator } → 200 (render at /c/<token>)
 *   - { status: 'gone', soft_delete_at } → 410 (soft-deleted, within
 *     RETENTION_PERIOD_DAYS window)
 *   - null → 404 (no token-match; do not leak whether the token ever
 *     existed)
 *
 * The Supabase server client is reused (the anonymous publishable key is
 * sufficient — the RPC is granted to `anon` + `authenticated`, and the
 * function itself runs with definer privileges). No cookie / session is
 * required by the RPC but the helper happens to attach the visitor's
 * session if one is present, which is harmless.
 */
export async function fetchPublicCalculator(
  token: string,
): Promise<PublicCalculatorFetchResult> {
  if (!token) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_get_public_calculator', {
    p_token: token,
  });

  if (error) {
    console.error('fetchPublicCalculator: RPC error', error);
    return null;
  }
  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];
  if (row.soft_delete_at) {
    return { status: 'gone', soft_delete_at: row.soft_delete_at };
  }

  const sections = normaliseSections(row.sections);

  const calculator: PublicCalculator = {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    theme_id: row.theme_id,
    public_token: row.public_token,
    published: row.published,
    updated_at: row.updated_at,
    sections,
  };

  return { status: 'ok', calculator };
}

/**
 * The RPC returns `sections` as a JSONB array typed as `Json`. We hand-roll
 * the narrowing here so the visitor renderer sees real PublicSection /
 * PublicSectionCell types without any `any` leak. Unknown JSON shapes
 * (a future RPC field, a missing column) degrade gracefully: the section
 * or cell is dropped, never crashes the render.
 */
function normaliseSections(value: unknown): PublicSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): PublicSection | null => {
      if (!isRecord(entry)) return null;
      const id = stringField(entry, 'id');
      const title = stringField(entry, 'title');
      const description = stringField(entry, 'description') ?? '';
      const layoutPattern = stringField(entry, 'layout_pattern_id');
      const displayOrder = numberField(entry, 'display_order');
      if (!id || title == null || !layoutPattern || displayOrder == null) {
        return null;
      }
      return {
        id,
        title,
        description,
        layout_pattern_id: layoutPattern,
        display_order: displayOrder,
        cells: normaliseCells(entry.cells),
      };
    })
    .filter((s): s is PublicSection => s !== null)
    .sort((a, b) => a.display_order - b.display_order);
}

function normaliseCells(value: unknown): PublicSectionCell[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): PublicSectionCell | null => {
      if (!isRecord(entry)) return null;
      // Required string fields. Everything else is forwarded as-is from
      // the RPC; the cells schema is fully owned by PROJ-9 and we don't
      // re-validate the enum bounds here (the database CHECK constraints
      // already do).
      const id = stringField(entry, 'id');
      const name = stringField(entry, 'name');
      const label = stringField(entry, 'label');
      const kind = stringField(entry, 'kind');
      const valueType = stringField(entry, 'value_type');
      const displayOrder = numberField(entry, 'display_order');
      if (!id || !name || label == null || !kind || !valueType || displayOrder == null) {
        return null;
      }
      return {
        id,
        kind: kind as PublicSectionCell['kind'],
        name,
        label,
        description: stringField(entry, 'description') ?? '',
        description_render:
          (stringField(entry, 'description_render') ??
            'caption') as PublicSectionCell['description_render'],
        value_type: valueType as PublicSectionCell['value_type'],
        visibility:
          (stringField(entry, 'visibility') ?? 'visible') as PublicSectionCell['visibility'],
        editability:
          (stringField(entry, 'editability') ?? 'readonly') as PublicSectionCell['editability'],
        default_value: jsonField(entry, 'default_value') as PublicSectionCell['default_value'],
        formula: stringField(entry, 'formula'),
        display_widget: stringField(entry, 'display_widget') as PublicSectionCell['display_widget'],
        display_format: stringField(entry, 'display_format') ?? 'auto',
        display_emphasis:
          (stringField(entry, 'display_emphasis') ??
            'plain') as PublicSectionCell['display_emphasis'],
        unit: stringField(entry, 'unit'),
        numeric_min: numberField(entry, 'numeric_min'),
        numeric_max: numberField(entry, 'numeric_max'),
        numeric_step: numberField(entry, 'numeric_step'),
        select_options: jsonField(
          entry,
          'select_options',
        ) as PublicSectionCell['select_options'],
        currency_code: stringField(entry, 'currency_code'),
        card_accent: stringField(entry, 'card_accent') ?? 'theme',
        card_background_tint:
          (stringField(entry, 'card_background_tint') ??
            'none') as PublicSectionCell['card_background_tint'],
        card_border:
          (stringField(entry, 'card_border') ?? 'none') as PublicSectionCell['card_border'],
        card_size_hint:
          (stringField(entry, 'card_size_hint') ??
            'narrow') as PublicSectionCell['card_size_hint'],
        text_size: stringField(entry, 'text_size') ?? 'm',
        text_colour: stringField(entry, 'text_colour') ?? 'default',
        display_order: displayOrder,
      };
    })
    .filter((c): c is PublicSectionCell => c !== null)
    .sort((a, b) => a.display_order - b.display_order);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const v = record[key];
  return typeof v === 'string' ? v : null;
}

function numberField(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const v = record[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function jsonField(record: Record<string, unknown>, key: string): unknown {
  return record[key] ?? null;
}
