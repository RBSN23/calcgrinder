// PROJ-15 — Shared helpers that turn (chart row, cells, evaluation) into
// the typed shapes each renderer expects.

import { CHART_MAX_POINTS } from '@/lib/charts/limits';
import type {
  AreaBindingsT,
  BarBindingsT,
  BulletBindingsT,
  ComparisonBarBindingsT,
  DonutBindingsT,
  HeatmapBindingsT,
  LineBindingsT,
  PieBindingsT,
  RadialProgressBindingsT,
  SeriesRowT,
  SparklineBindingsT,
  StackedBarBindingsT,
  WaterfallBindingsT,
} from '@/lib/charts/bindings';
import type { ChartRow } from '@/lib/charts/types';
import type { CellRow } from '@/lib/cells/types';
import type { CellResult, EvaluationResult } from '@/lib/formula';
import { resolveChartToken, type ChartPalette } from '@/lib/themes';

export function findCellById(
  cells: CellRow[],
  id: string | null | undefined,
): CellRow | null {
  if (!id) return null;
  return cells.find((c) => c.id === id) ?? null;
}

/** Return an array-of-scalars value if the cell evaluation has that shape. */
export function readArray(
  result: CellResult | undefined,
): unknown[] | null {
  if (!result || result.error) return null;
  if (result.shape !== 'array_of_scalars') return null;
  if (!Array.isArray(result.value)) return null;
  return result.value;
}

/** Convert any array of unknowns to numbers (NaN → 0 fallback). */
export function toNumbers(values: unknown[]): number[] {
  return values.slice(0, CHART_MAX_POINTS).map((v) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  });
}

export function toStrings(values: unknown[]): string[] {
  return values.slice(0, CHART_MAX_POINTS).map((v) => {
    if (v == null) return '';
    return String(v);
  });
}

export function readScalarNumber(
  result: CellResult | undefined,
): number | null {
  if (!result || result.error) return null;
  if (result.shape !== 'scalar') return null;
  const n = typeof result.value === 'number' ? result.value : Number(result.value);
  return Number.isFinite(n) ? n : null;
}

/** Resolve a series row's display colour: explicit token > auto-assigned series[i mod 8]. */
export function resolveSeriesColor(
  palette: ChartPalette,
  series: SeriesRowT,
  index: number,
): string {
  if (series.color_token_id) {
    const resolved = resolveChartToken(palette, series.color_token_id);
    if (resolved) return resolved;
  }
  return palette.series[index % palette.series.length];
}

// ─── per-chart_type resolvers ────────────────────────────────────────────────

export interface ResolvedSeries {
  label: string;
  color: string;
  values: number[];
}

export function resolveSeriesList(
  series: SeriesRowT[],
  cells: CellRow[],
  evaluation: EvaluationResult,
  palette: ChartPalette,
): ResolvedSeries[] {
  return series.map((s, i) => {
    const cell = findCellById(cells, s.cell_id);
    const result = cell ? evaluation[cell.name] : undefined;
    const arr = readArray(result);
    return {
      label: s.label || cell?.label || cell?.name || `Series ${i + 1}`,
      color: resolveSeriesColor(palette, s, i),
      values: arr ? toNumbers(arr) : [],
    };
  });
}

export function resolveXAxisLabels(
  cellId: string | null,
  cells: CellRow[],
  evaluation: EvaluationResult,
): string[] {
  const cell = findCellById(cells, cellId);
  if (!cell) return [];
  const arr = readArray(evaluation[cell.name]);
  return arr ? toStrings(arr) : [];
}

// Re-export the binding shapes the chart-card module needs.
export type {
  AreaBindingsT,
  BarBindingsT,
  BulletBindingsT,
  ComparisonBarBindingsT,
  DonutBindingsT,
  HeatmapBindingsT,
  LineBindingsT,
  PieBindingsT,
  RadialProgressBindingsT,
  SparklineBindingsT,
  StackedBarBindingsT,
  WaterfallBindingsT,
};

/** Chart-type summary for the Grid column ("Line, 3 series" / "Pie, 5 slices"). */
export function chartTypeSummary(chart: ChartRow, cells: CellRow[], evaluation: EvaluationResult): string {
  switch (chart.chart_type) {
    case 'line':
    case 'bar':
    case 'area':
    case 'stacked_bar': {
      const seriesKey =
        chart.chart_type === 'line'
          ? 'lines'
          : chart.chart_type === 'bar'
            ? 'bars'
            : chart.chart_type === 'area'
              ? 'areas'
              : 'stack_layers';
      const list =
        ((chart.bindings as unknown) as Record<string, SeriesRowT[]>)[seriesKey] ?? [];
      const noun =
        chart.chart_type === 'line'
          ? 'series'
          : chart.chart_type === 'bar'
            ? 'series'
            : chart.chart_type === 'area'
              ? 'series'
              : 'layers';
      return `${capitalise(chart.chart_type)}, ${list.length} ${noun}`;
    }
    case 'pie':
    case 'donut': {
      const labels = readArray(
        evaluation[findCellById(cells, (chart.bindings as PieBindingsT).slice_labels)?.name ?? ''],
      );
      const n = labels?.length ?? 0;
      return `${capitalise(chart.chart_type)}, ${n} slices`;
    }
    case 'comparison_bar':
      return 'Comparison Bar';
    case 'sparkline': {
      const v = readArray(
        evaluation[findCellById(cells, (chart.bindings as SparklineBindingsT).values)?.name ?? ''],
      );
      return `Sparkline, ${v?.length ?? 0} points`;
    }
    case 'waterfall': {
      const v = readArray(
        evaluation[findCellById(cells, (chart.bindings as WaterfallBindingsT).steps)?.name ?? ''],
      );
      return `Waterfall, ${v?.length ?? 0} steps`;
    }
    case 'bullet':
      return 'Bullet';
    case 'heatmap': {
      const c = readArray(
        evaluation[findCellById(cells, (chart.bindings as HeatmapBindingsT).columns)?.name ?? ''],
      );
      const r = readArray(
        evaluation[findCellById(cells, (chart.bindings as HeatmapBindingsT).rows)?.name ?? ''],
      );
      return `Heatmap, ${c?.length ?? 0}×${r?.length ?? 0}`;
    }
    case 'radial_progress':
      return 'Radial Progress';
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
