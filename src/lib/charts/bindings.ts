// PROJ-15 — Bindings schemas (one per chart_type).
//
// JSONB on the `charts` row; validated with Zod at the API boundary and
// at the client edge. Stable JS types reflect the discriminated-union shape
// per `chart_type`.

import { z } from 'zod';

import type { ChartType } from './types';
import { ALLOWED_COLOR_TOKENS } from '@/lib/themes';

// ─── shared atoms ────────────────────────────────────────────────────────────

/** A binding slot that either points at a cell-id (UUID) or is null. */
const CellRef = z.string().uuid().nullable();

/** A series row inside a multi-series chart (Line/Bar/Area/Stacked Bar). */
const SeriesRow = z.object({
  id: z.string().min(1), // stable across drag-reorder
  label: z.string().default(''),
  cell_id: z.string().uuid().nullable(),
  /** Theme-palette-constrained colour override. Null → auto-assign. */
  color_token_id: z
    .enum(ALLOWED_COLOR_TOKENS as unknown as [string, ...string[]])
    .nullable()
    .optional()
    .default(null),
});

const ComparisonSeries = z.object({
  label: z.string().default(''),
  cell_id: CellRef,
});

// ─── per-chart_type bindings ─────────────────────────────────────────────────

export const LineBindings = z.object({
  x_axis: CellRef.default(null),
  lines: z.array(SeriesRow).default([]),
});
export const BarBindings = z.object({
  x_axis: CellRef.default(null),
  bars: z.array(SeriesRow).default([]),
});
export const AreaBindings = z.object({
  x_axis: CellRef.default(null),
  areas: z.array(SeriesRow).default([]),
});
export const StackedBarBindings = z.object({
  x_axis: CellRef.default(null),
  stack_layers: z.array(SeriesRow).default([]),
});
export const PieBindings = z.object({
  slice_labels: CellRef.default(null),
  slice_sizes: CellRef.default(null),
});
export const DonutBindings = z.object({
  slice_labels: CellRef.default(null),
  slice_sizes: CellRef.default(null),
  centre_label: z.string().max(200).default(''),
  centre_value: CellRef.default(null),
});
export const ComparisonBarBindings = z.object({
  x_axis: CellRef.default(null),
  series_a: ComparisonSeries.default({ label: '', cell_id: null }),
  series_b: ComparisonSeries.default({ label: '', cell_id: null }),
  labels: CellRef.default(null),
});
export const SparklineBindings = z.object({
  values: CellRef.default(null),
});
export const WaterfallBindings = z.object({
  steps: CellRef.default(null),
  changes: CellRef.default(null),
});
export const BulletBindings = z.object({
  actual: CellRef.default(null),
  target: CellRef.default(null),
  performance_bands: CellRef.default(null),
});
export const HeatmapBindings = z.object({
  columns: CellRef.default(null),
  rows: CellRef.default(null),
  cell_colours: CellRef.default(null),
});
export const RadialProgressBindings = z.object({
  current: CellRef.default(null),
  goal: CellRef.default(null),
  centre_label: z.string().max(200).default(''),
});

// ─── derived TS types ────────────────────────────────────────────────────────

export type SeriesRowT = z.infer<typeof SeriesRow>;
export type ComparisonSeriesT = z.infer<typeof ComparisonSeries>;

export type LineBindingsT = z.infer<typeof LineBindings>;
export type BarBindingsT = z.infer<typeof BarBindings>;
export type AreaBindingsT = z.infer<typeof AreaBindings>;
export type StackedBarBindingsT = z.infer<typeof StackedBarBindings>;
export type PieBindingsT = z.infer<typeof PieBindings>;
export type DonutBindingsT = z.infer<typeof DonutBindings>;
export type ComparisonBarBindingsT = z.infer<typeof ComparisonBarBindings>;
export type SparklineBindingsT = z.infer<typeof SparklineBindings>;
export type WaterfallBindingsT = z.infer<typeof WaterfallBindings>;
export type BulletBindingsT = z.infer<typeof BulletBindings>;
export type HeatmapBindingsT = z.infer<typeof HeatmapBindings>;
export type RadialProgressBindingsT = z.infer<typeof RadialProgressBindings>;

export type ChartBindings =
  | LineBindingsT
  | BarBindingsT
  | AreaBindingsT
  | StackedBarBindingsT
  | PieBindingsT
  | DonutBindingsT
  | ComparisonBarBindingsT
  | SparklineBindingsT
  | WaterfallBindingsT
  | BulletBindingsT
  | HeatmapBindingsT
  | RadialProgressBindingsT;

// ─── schema dispatcher ───────────────────────────────────────────────────────

export const BINDINGS_SCHEMA: Record<ChartType, z.ZodTypeAny> = {
  line: LineBindings,
  bar: BarBindings,
  area: AreaBindings,
  stacked_bar: StackedBarBindings,
  pie: PieBindings,
  donut: DonutBindings,
  comparison_bar: ComparisonBarBindings,
  sparkline: SparklineBindings,
  waterfall: WaterfallBindings,
  bullet: BulletBindings,
  heatmap: HeatmapBindings,
  radial_progress: RadialProgressBindings,
};

/** Default empty bindings for a freshly-created chart of a given type. */
export function defaultBindings(t: ChartType): ChartBindings {
  switch (t) {
    case 'line':
      return { x_axis: null, lines: [] };
    case 'bar':
      return { x_axis: null, bars: [] };
    case 'area':
      return { x_axis: null, areas: [] };
    case 'stacked_bar':
      return { x_axis: null, stack_layers: [] };
    case 'pie':
      return { slice_labels: null, slice_sizes: null };
    case 'donut':
      return {
        slice_labels: null,
        slice_sizes: null,
        centre_label: '',
        centre_value: null,
      };
    case 'comparison_bar':
      return {
        x_axis: null,
        series_a: { label: '', cell_id: null },
        series_b: { label: '', cell_id: null },
        labels: null,
      };
    case 'sparkline':
      return { values: null };
    case 'waterfall':
      return { steps: null, changes: null };
    case 'bullet':
      return { actual: null, target: null, performance_bands: null };
    case 'heatmap':
      return { columns: null, rows: null, cell_colours: null };
    case 'radial_progress':
      return { current: null, goal: null, centre_label: '' };
  }
}

// ─── series-key map (used by carry-forward) ──────────────────────────────────

export const SERIES_KEY: Record<
  'line' | 'bar' | 'area' | 'stacked_bar',
  'lines' | 'bars' | 'areas' | 'stack_layers'
> = {
  line: 'lines',
  bar: 'bars',
  area: 'areas',
  stacked_bar: 'stack_layers',
};

/**
 * Carry bindings across a chart_type switch. Rules:
 *  - within X-axis+N-series family → preserve x_axis + rename series key
 *  - within labels+values family   → preserve label+value slots, drop/add centre fields
 *  - any singleton involvement     → reset to defaultBindings(toType)
 *
 * Returns:
 *  - { kind: 'preserve', next } when bindings carry without loss
 *  - { kind: 'destructive', next, dropped } when the carry would drop data
 *    (the UI shows a destructive-confirm row before committing the switch)
 *  - { kind: 'reset', next } when bindings reset to the default empty shape
 */
export type CarryForward =
  | { kind: 'preserve'; next: ChartBindings }
  | { kind: 'destructive'; next: ChartBindings; dropped: string[] }
  | { kind: 'reset'; next: ChartBindings };

export function carryForwardBindings(
  fromType: ChartType,
  toType: ChartType,
  bindings: ChartBindings,
): CarryForward {
  if (fromType === toType) {
    return { kind: 'preserve', next: bindings };
  }

  const fromX = SERIES_KEY[fromType as keyof typeof SERIES_KEY];
  const toX = SERIES_KEY[toType as keyof typeof SERIES_KEY];

  // X-axis + N-series family ↔ family: rename the series key, preserve all rows.
  if (fromX && toX) {
    const src = bindings as unknown as { x_axis: string | null } & Record<
      string,
      SeriesRowT[]
    >;
    return {
      kind: 'preserve',
      next: {
        x_axis: src.x_axis,
        [toX]: src[fromX] ?? [],
      } as ChartBindings,
    };
  }

  // Pie ↔ Donut: preserve label+value bindings; drop or add centre fields.
  if (
    (fromType === 'pie' && toType === 'donut') ||
    (fromType === 'donut' && toType === 'pie')
  ) {
    const src = bindings as PieBindingsT | DonutBindingsT;
    if (toType === 'donut') {
      return {
        kind: 'preserve',
        next: {
          slice_labels: src.slice_labels,
          slice_sizes: src.slice_sizes,
          centre_label: '',
          centre_value: null,
        },
      };
    }
    return {
      kind: 'preserve',
      next: {
        slice_labels: src.slice_labels,
        slice_sizes: src.slice_sizes,
      },
    };
  }

  // X-axis+N-series → Pie/Donut: keep first series mapped to slice_sizes; drop the rest.
  if (fromX && (toType === 'pie' || toType === 'donut')) {
    const src = bindings as unknown as Record<string, SeriesRowT[]>;
    const seriesList = src[fromX] ?? [];
    const first = seriesList[0];
    const dropped = seriesList.slice(1).map(
      (s, i) => s.label || `Series ${i + 2}`,
    );
    const next: ChartBindings =
      toType === 'donut'
        ? {
            slice_labels: null,
            slice_sizes: first?.cell_id ?? null,
            centre_label: '',
            centre_value: null,
          }
        : {
            slice_labels: null,
            slice_sizes: first?.cell_id ?? null,
          };
    if (seriesList.length > 1) {
      return { kind: 'destructive', next, dropped };
    }
    return { kind: 'preserve', next };
  }

  // Anything else → reset; if the source had non-trivial data, flag as destructive.
  const next = defaultBindings(toType);
  const dropped = describeNonEmptyBindings(fromType, bindings);
  if (dropped.length > 0) {
    return { kind: 'destructive', next, dropped };
  }
  return { kind: 'reset', next };
}

function describeNonEmptyBindings(
  t: ChartType,
  b: ChartBindings,
): string[] {
  const out: string[] = [];
  switch (t) {
    case 'line':
    case 'bar':
    case 'area':
    case 'stacked_bar': {
      const key = SERIES_KEY[t];
      const xs = (b as unknown as Record<string, unknown>).x_axis;
      const list = ((b as unknown as Record<string, SeriesRowT[]>)[key] ?? []) as SeriesRowT[];
      if (xs) out.push('X-axis');
      list.forEach((s, i) => {
        if (s.cell_id) out.push(s.label || `Series ${i + 1}`);
      });
      return out;
    }
    case 'pie':
    case 'donut': {
      const p = b as PieBindingsT | DonutBindingsT;
      if (p.slice_labels) out.push('Slice labels');
      if (p.slice_sizes) out.push('Slice sizes');
      if (t === 'donut' && (b as DonutBindingsT).centre_value)
        out.push('Centre value');
      return out;
    }
    case 'comparison_bar': {
      const c = b as ComparisonBarBindingsT;
      if (c.x_axis) out.push('X-axis');
      if (c.series_a.cell_id) out.push(c.series_a.label || 'Series A');
      if (c.series_b.cell_id) out.push(c.series_b.label || 'Series B');
      if (c.labels) out.push('Labels');
      return out;
    }
    case 'sparkline': {
      if ((b as SparklineBindingsT).values) out.push('Values');
      return out;
    }
    case 'waterfall': {
      const w = b as WaterfallBindingsT;
      if (w.steps) out.push('Steps');
      if (w.changes) out.push('Change at each step');
      return out;
    }
    case 'bullet': {
      const bu = b as BulletBindingsT;
      if (bu.actual) out.push('Actual value');
      if (bu.target) out.push('Target');
      if (bu.performance_bands) out.push('Performance bands');
      return out;
    }
    case 'heatmap': {
      const h = b as HeatmapBindingsT;
      if (h.columns) out.push('Columns');
      if (h.rows) out.push('Rows');
      if (h.cell_colours) out.push('Cell colours');
      return out;
    }
    case 'radial_progress': {
      const r = b as RadialProgressBindingsT;
      if (r.current) out.push('Current value');
      if (r.goal) out.push('Goal');
      return out;
    }
  }
}
