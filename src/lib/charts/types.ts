// PROJ-15 — Chart types & shared validation helpers.
//
// Mirrors the public.charts row shape that the /backend skill will create.
// Bindings are stored as JSONB (polymorphic on chart_type) — see ./bindings.ts
// for per-type schemas and discriminated-union types.

import { RESERVED_WORDS } from '@/lib/formula';

import type { ChartBindings } from './bindings';

export const MAX_CHART_NAME_LENGTH = 40;
export const CHART_NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const MAX_CHART_TITLE_LENGTH = 200;
export const MAX_CHART_SUBTITLE_LENGTH = 200;

export const CHART_TYPES = [
  'line',
  'bar',
  'area',
  'pie',
  'donut',
  'stacked_bar',
  'comparison_bar',
  'sparkline',
  'waterfall',
  'bullet',
  'heatmap',
  'radial_progress',
] as const;

export type ChartType = (typeof CHART_TYPES)[number];

export type ChartCardBackgroundTint = 'none' | 'soft' | 'strong';
export type ChartCardBorder = 'none' | 'hairline' | 'strong';
export type ChartCardSizeHint = 'narrow' | 'wide' | 'full';
export type LegendMode = 'auto' | 'always' | 'hide';
export type AxisLabelsMode = 'auto' | 'always' | 'hide';

export interface ChartStyle {
  legend: LegendMode;
  axis_labels: AxisLabelsMode;
  animation: boolean;
  smooth_lines: boolean;
}

export const DEFAULT_CHART_STYLE: ChartStyle = {
  legend: 'auto',
  axis_labels: 'auto',
  animation: true,
  smooth_lines: false,
};

export interface ChartRow {
  id: string;
  calculator_id: string;
  section_id: string;
  name: string;
  chart_type: ChartType;
  title: string;
  subtitle: string;
  bindings: ChartBindings;
  style: ChartStyle;
  card_accent: string; // theme accent token id or 'theme'
  card_background_tint: ChartCardBackgroundTint;
  card_border: ChartCardBorder;
  card_size_hint: ChartCardSizeHint;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ─── name validation (mirrors cells) ─────────────────────────────────────────

export type ChartNameValidation =
  | { ok: true; value: string }
  | {
      ok: false;
      reason: 'name_required' | 'name_invalid' | 'name_reserved';
      reservedWord?: string;
    };

export function validateChartName(raw: string): ChartNameValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'name_required' };
  if (!CHART_NAME_PATTERN.test(trimmed))
    return { ok: false, reason: 'name_invalid' };
  if (RESERVED_WORDS.includes(trimmed))
    return { ok: false, reason: 'name_reserved', reservedWord: trimmed };
  return { ok: true, value: trimmed };
}

/** Compute the next free `chart_N` name (scan existing chart names only). */
export function nextDefaultChartName(existing: Iterable<string>): string {
  const used = new Set(existing);
  let i = 1;
  while (used.has(`chart_${i}`)) i++;
  return `chart_${i}`;
}

// ─── carry-forward families on chart_type switch ─────────────────────────────

/** Family 1: X-axis + N-series — switching within carries bindings (just
 * relabels the series-key: lines ↔ bars ↔ areas ↔ stack_layers). */
export const X_N_SERIES_FAMILY = [
  'line',
  'bar',
  'area',
  'stacked_bar',
] as const satisfies readonly ChartType[];

/** Family 2: Labels + Values — Pie ↔ Donut carries; centre fields drop
 * silently on pie ←. */
export const LABELS_VALUES_FAMILY = [
  'pie',
  'donut',
] as const satisfies readonly ChartType[];

/** Singletons — switching INTO or OUT OF resets bindings to empty shape. */
export const SINGLETON_FAMILY = [
  'comparison_bar',
  'sparkline',
  'waterfall',
  'bullet',
  'heatmap',
  'radial_progress',
] as const satisfies readonly ChartType[];

export function chartTypeFamily(
  t: ChartType,
): 'x_n_series' | 'labels_values' | 'singleton' {
  if ((X_N_SERIES_FAMILY as readonly ChartType[]).includes(t))
    return 'x_n_series';
  if ((LABELS_VALUES_FAMILY as readonly ChartType[]).includes(t))
    return 'labels_values';
  return 'singleton';
}

/** Display label for a chart type. */
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  line: 'Line',
  bar: 'Bar',
  area: 'Area',
  pie: 'Pie',
  donut: 'Donut',
  stacked_bar: 'Stacked Bar',
  comparison_bar: 'Comparison Bar',
  sparkline: 'Sparkline',
  waterfall: 'Waterfall',
  bullet: 'Bullet',
  heatmap: 'Heatmap',
  radial_progress: 'Radial Progress',
};

/** Chart types that have no X/Y axes — the axis_labels control is greyed for these. */
export const AXISLESS_TYPES: ReadonlySet<ChartType> = new Set([
  'pie',
  'donut',
  'sparkline',
  'radial_progress',
  'bullet',
]);
