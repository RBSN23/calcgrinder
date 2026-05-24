import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type {
  PublicCalculator,
  PublicSection,
  PublicSectionCell,
  PublicSectionChart,
  PublicSectionTextBlock,
} from '@/lib/calculators/types';
import { CHART_TYPES, type ChartType } from '@/lib/charts/types';

import type { ScenarioValues } from './types';

/**
 * PROJ-12 — Server-side fetch for a scenario by its share token AND
 * parent calculator's public token. Single round-trip via the
 * `fn_get_scenario_by_share_token(p_share_token, p_calc_token)`
 * SECURITY DEFINER RPC.
 *
 * The two-arg signature enforces the cross-calc-forge defence inside
 * the function: when `p_calc_token` doesn't match the scenario's
 * `calculator.public_token`, the RPC returns 0 rows and this helper
 * returns null (visitor page falls back to scenario-404 copy).
 *
 * Returns `null` when:
 *   - No scenario matches the share token, OR
 *   - The scenario exists but `p_calc_token` doesn't match, OR
 *   - The parent calculator is soft-deleted or hard-deleted (the
 *     calculator-level state takes precedence per spec line 1049).
 */
export interface PublicScenarioBundle {
  scenarioId: string;
  scenarioTitle: string;
  scenarioDescription: string;
  scenarioValues: ScenarioValues;
  scenarioOwnerId: string;
  scenarioOwnerName: string;
  scenarioUpdatedAt: string;
  shareToken: string;
  calculator: PublicCalculator;
}

export async function fetchPublicScenario(
  shareToken: string,
  calcToken: string,
): Promise<PublicScenarioBundle | null> {
  if (!shareToken || !calcToken) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fn_get_scenario_by_share_token', {
    p_share_token: shareToken,
    p_calc_token: calcToken,
  });

  if (error) {
    console.error('fetchPublicScenario: RPC error', error);
    return null;
  }
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;

  const r = row as Record<string, unknown>;
  const scenarioId = stringField(r, 'scenario_id');
  const scenarioTitle = stringField(r, 'scenario_title');
  const scenarioOwnerId = stringField(r, 'scenario_owner_id');
  const scenarioUpdatedAt = stringField(r, 'scenario_updated_at');
  const calcPayload = r.calculator_payload;

  if (
    !scenarioId ||
    scenarioTitle == null ||
    !scenarioOwnerId ||
    !scenarioUpdatedAt ||
    !calcPayload
  ) {
    return null;
  }
  const calculator = normaliseCalculator(calcPayload);
  if (!calculator) return null;

  return {
    scenarioId,
    scenarioTitle,
    scenarioDescription: stringField(r, 'scenario_description') ?? '',
    scenarioValues: normaliseValues(r.scenario_values),
    scenarioOwnerId,
    scenarioOwnerName: stringField(r, 'scenario_owner_name') ?? 'Anonymous',
    scenarioUpdatedAt,
    shareToken,
    calculator,
  };
}

function normaliseValues(value: unknown): ScenarioValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ScenarioValues;
}

function normaliseCalculator(value: unknown): PublicCalculator | null {
  if (!isRecord(value)) return null;
  const id = stringField(value, 'id');
  const owner_id = stringField(value, 'owner_id');
  const title = stringField(value, 'title');
  const theme_id = stringField(value, 'theme_id');
  const public_token = stringField(value, 'public_token');
  const updated_at = stringField(value, 'updated_at');
  if (!id || !owner_id || title == null || !theme_id || !public_token || !updated_at) {
    return null;
  }
  return {
    id,
    owner_id,
    title,
    description: stringField(value, 'description') ?? '',
    theme_id,
    public_token,
    published: value.published === true,
    updated_at,
    sections: normaliseSections(value.sections),
  };
}

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
        charts: normaliseCharts(entry.charts),
        text_blocks: normaliseTextBlocks(entry.text_blocks),
      };
    })
    .filter((s): s is PublicSection => s !== null)
    .sort((a, b) => a.display_order - b.display_order);
}

function normaliseTextBlocks(value: unknown): PublicSectionTextBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): PublicSectionTextBlock | null => {
      if (!isRecord(entry)) return null;
      const id = stringField(entry, 'id');
      const displayOrder = numberField(entry, 'display_order');
      if (!id || displayOrder == null) return null;
      return {
        id,
        body: stringField(entry, 'body') ?? '',
        card_accent: stringField(entry, 'card_accent') ?? 'theme',
        card_background_tint:
          (stringField(entry, 'card_background_tint') ??
            'none') as PublicSectionTextBlock['card_background_tint'],
        card_border:
          (stringField(entry, 'card_border') ?? 'none') as
            PublicSectionTextBlock['card_border'],
        card_size_hint:
          (stringField(entry, 'card_size_hint') ?? 'wide') as
            PublicSectionTextBlock['card_size_hint'],
        text_size:
          (stringField(entry, 'text_size') ?? 'm') as
            PublicSectionTextBlock['text_size'],
        text_colour:
          (stringField(entry, 'text_colour') ?? 'default') as
            PublicSectionTextBlock['text_colour'],
        display_order: displayOrder,
      };
    })
    .filter((t): t is PublicSectionTextBlock => t !== null)
    .sort((a, b) => a.display_order - b.display_order);
}

function normaliseCells(value: unknown): PublicSectionCell[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): PublicSectionCell | null => {
      if (!isRecord(entry)) return null;
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

/**
 * PROJ-15 — defensive narrowing for charts on each section (companion of
 * the same helper in `@/lib/calculators/public`; duplicated here to keep
 * the scenarios RPC's normaliser self-contained, matching the existing
 * cells helper pattern in this file).
 */
function normaliseCharts(value: unknown): PublicSectionChart[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): PublicSectionChart | null => {
      if (!isRecord(entry)) return null;
      const id = stringField(entry, 'id');
      const name = stringField(entry, 'name');
      const chartType = stringField(entry, 'chart_type');
      const displayOrder = numberField(entry, 'display_order');
      if (
        !id ||
        !name ||
        !chartType ||
        !(CHART_TYPES as readonly string[]).includes(chartType) ||
        displayOrder == null
      ) {
        return null;
      }
      return {
        id,
        name,
        chart_type: chartType as ChartType,
        title: stringField(entry, 'title') ?? '',
        subtitle: stringField(entry, 'subtitle') ?? '',
        bindings: (jsonField(entry, 'bindings') ??
          {}) as PublicSectionChart['bindings'],
        style: (jsonField(entry, 'style') ??
          {}) as PublicSectionChart['style'],
        card_accent: stringField(entry, 'card_accent') ?? 'theme',
        card_background_tint:
          (stringField(entry, 'card_background_tint') ??
            'none') as PublicSectionChart['card_background_tint'],
        card_border:
          (stringField(entry, 'card_border') ??
            'none') as PublicSectionChart['card_border'],
        card_size_hint:
          (stringField(entry, 'card_size_hint') ??
            'narrow') as PublicSectionChart['card_size_hint'],
        display_order: displayOrder,
      };
    })
    .filter((c): c is PublicSectionChart => c !== null)
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
