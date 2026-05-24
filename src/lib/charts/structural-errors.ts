// PROJ-15 — Chart-level structural errors for the publish gate.
//
// Sibling of PROJ-7's getStructuralErrors. Returns chart-level errors so
// PROJ-10's Publish button can count chart issues alongside cell issues
// and disable Publish until every chart is presentable.
//
// Three categories:
//   1. broken_binding — referenced cell deleted, or returns the wrong shape
//      (scalar where array required, array where scalar required, text where
//      number required).
//   2. length_mismatch — Pie/Donut with len(slice_labels) ≠ len(slice_sizes);
//      Waterfall with len(steps) ≠ len(changes); Heatmap with
//      len(cell_colours) ≠ len(columns) × len(rows).
//   3. no_bindings — chart created via +Add but never wired up.
//
// Oversized data is a *warning* (chart still renders within the cap), NOT
// a structural error.

import type { CellResult, EvaluationResult, Shape } from '@/lib/formula';

import type {
  BulletBindingsT,
  ChartBindings,
  ComparisonBarBindingsT,
  DonutBindingsT,
  HeatmapBindingsT,
  LineBindingsT,
  PieBindingsT,
  RadialProgressBindingsT,
  SparklineBindingsT,
  WaterfallBindingsT,
} from './bindings';
import type { ChartRow, ChartType } from './types';

export type ChartStructuralErrorReason =
  | 'broken_binding'
  | 'length_mismatch'
  | 'no_bindings';

export interface ChartStructuralError {
  chart_id: string;
  reason: ChartStructuralErrorReason;
  /** Plain-English message; safe to render inline on the chart card. */
  message: string;
}

interface BindingLookup {
  /** Look up a cell row by id; returns null if deleted. */
  cellById: (id: string) => { name: string } | null;
  /** Look up the latest evaluation result by cell name. */
  resultByName: (name: string) => CellResult | undefined;
}

export function getChartStructuralErrors(
  charts: ChartRow[],
  evaluation: EvaluationResult,
  cells: { id: string; name: string }[],
): ChartStructuralError[] {
  const byId = new Map(cells.map((c) => [c.id, c]));
  const lookup: BindingLookup = {
    cellById: (id) => byId.get(id) ?? null,
    resultByName: (name) => evaluation[name],
  };
  return charts.flatMap((c) => analyseChart(c, lookup));
}

function analyseChart(
  chart: ChartRow,
  lookup: BindingLookup,
): ChartStructuralError[] {
  const slots = listBindingSlots(chart.chart_type, chart.bindings);
  if (slots.length === 0 || slots.every((s) => s.cell_id == null)) {
    return [
      {
        chart_id: chart.id,
        reason: 'no_bindings',
        message: 'Chart has no values to plot yet — open the Data tab.',
      },
    ];
  }

  const out: ChartStructuralError[] = [];
  const resolved: { slot: BindingSlot; result?: CellResult; cellName?: string }[] =
    [];
  for (const slot of slots) {
    if (slot.cell_id == null) {
      // Some slots are optional; only single-binding charts treat missing as fatal.
      if (slot.required) {
        out.push({
          chart_id: chart.id,
          reason: 'broken_binding',
          message: `${slot.label}: pick a value.`,
        });
      }
      continue;
    }
    const cell = lookup.cellById(slot.cell_id);
    if (!cell) {
      out.push({
        chart_id: chart.id,
        reason: 'broken_binding',
        message: `${slot.label}: cell was deleted. Pick a value.`,
      });
      continue;
    }
    const result = lookup.resultByName(cell.name);
    const shape: Shape | null = result?.error ? null : result?.shape ?? null;
    if (slot.expects === 'array_of_scalars') {
      if (shape !== 'array_of_scalars') {
        out.push({
          chart_id: chart.id,
          reason: 'broken_binding',
          message: `${slot.label}: cell \`${cell.name}\` returns a single value, not a series.`,
        });
        continue;
      }
    } else if (slot.expects === 'scalar') {
      if (shape !== 'scalar') {
        out.push({
          chart_id: chart.id,
          reason: 'broken_binding',
          message: `${slot.label}: cell \`${cell.name}\` returns a series, not a single value.`,
        });
        continue;
      }
    }
    resolved.push({ slot, result, cellName: cell.name });
  }

  out.push(...detectLengthMismatch(chart, resolved));
  return out;
}

interface BindingSlot {
  key: string;
  label: string;
  cell_id: string | null;
  expects: 'array_of_scalars' | 'scalar';
  required: boolean;
}

function listBindingSlots(
  t: ChartType,
  b: ChartBindings,
): BindingSlot[] {
  switch (t) {
    case 'line':
    case 'bar':
    case 'area':
    case 'stacked_bar': {
      const lb = b as LineBindingsT;
      const seriesKey = (
        t === 'line' ? 'lines' : t === 'bar' ? 'bars' : t === 'area' ? 'areas' : 'stack_layers'
      ) as 'lines';
      const seriesList =
        ((b as unknown) as Record<string, LineBindingsT['lines']>)[seriesKey] ??
        [];
      const slots: BindingSlot[] = [
        { key: 'x_axis', label: 'X-axis', cell_id: lb.x_axis, expects: 'array_of_scalars', required: true },
      ];
      seriesList.forEach((s, i) => {
        slots.push({
          key: `${seriesKey}.${i}`,
          label: s.label || `Series ${i + 1}`,
          cell_id: s.cell_id,
          expects: 'array_of_scalars',
          required: true,
        });
      });
      return slots;
    }
    case 'pie': {
      const p = b as PieBindingsT;
      return [
        { key: 'slice_labels', label: 'Slice labels', cell_id: p.slice_labels, expects: 'array_of_scalars', required: true },
        { key: 'slice_sizes', label: 'Slice sizes', cell_id: p.slice_sizes, expects: 'array_of_scalars', required: true },
      ];
    }
    case 'donut': {
      const d = b as DonutBindingsT;
      return [
        { key: 'slice_labels', label: 'Slice labels', cell_id: d.slice_labels, expects: 'array_of_scalars', required: true },
        { key: 'slice_sizes', label: 'Slice sizes', cell_id: d.slice_sizes, expects: 'array_of_scalars', required: true },
        { key: 'centre_value', label: 'Centre value', cell_id: d.centre_value, expects: 'scalar', required: false },
      ];
    }
    case 'comparison_bar': {
      const c = b as ComparisonBarBindingsT;
      return [
        { key: 'x_axis', label: 'X-axis', cell_id: c.x_axis, expects: 'array_of_scalars', required: true },
        { key: 'series_a', label: c.series_a.label || 'Series A', cell_id: c.series_a.cell_id, expects: 'array_of_scalars', required: true },
        { key: 'series_b', label: c.series_b.label || 'Series B', cell_id: c.series_b.cell_id, expects: 'array_of_scalars', required: true },
        { key: 'labels', label: 'Labels', cell_id: c.labels, expects: 'array_of_scalars', required: false },
      ];
    }
    case 'sparkline': {
      const s = b as SparklineBindingsT;
      return [{ key: 'values', label: 'Values', cell_id: s.values, expects: 'array_of_scalars', required: true }];
    }
    case 'waterfall': {
      const w = b as WaterfallBindingsT;
      return [
        { key: 'steps', label: 'Steps', cell_id: w.steps, expects: 'array_of_scalars', required: true },
        { key: 'changes', label: 'Change at each step', cell_id: w.changes, expects: 'array_of_scalars', required: true },
      ];
    }
    case 'bullet': {
      const bu = b as BulletBindingsT;
      return [
        { key: 'actual', label: 'Actual value', cell_id: bu.actual, expects: 'scalar', required: true },
        { key: 'target', label: 'Target', cell_id: bu.target, expects: 'scalar', required: true },
        { key: 'performance_bands', label: 'Performance bands', cell_id: bu.performance_bands, expects: 'array_of_scalars', required: false },
      ];
    }
    case 'heatmap': {
      const h = b as HeatmapBindingsT;
      return [
        { key: 'columns', label: 'Columns', cell_id: h.columns, expects: 'array_of_scalars', required: true },
        { key: 'rows', label: 'Rows', cell_id: h.rows, expects: 'array_of_scalars', required: true },
        { key: 'cell_colours', label: 'Cell colours', cell_id: h.cell_colours, expects: 'array_of_scalars', required: true },
      ];
    }
    case 'radial_progress': {
      const r = b as RadialProgressBindingsT;
      return [
        { key: 'current', label: 'Current value', cell_id: r.current, expects: 'scalar', required: true },
        { key: 'goal', label: 'Goal', cell_id: r.goal, expects: 'scalar', required: true },
      ];
    }
  }
}

function arrayLength(r?: CellResult): number | null {
  if (!r || r.error) return null;
  if (r.shape !== 'array_of_scalars') return null;
  return Array.isArray(r.value) ? r.value.length : null;
}

function detectLengthMismatch(
  chart: ChartRow,
  resolved: { slot: BindingSlot; result?: CellResult; cellName?: string }[],
): ChartStructuralError[] {
  const out: ChartStructuralError[] = [];
  const findLen = (key: string) =>
    arrayLength(resolved.find((r) => r.slot.key === key)?.result);

  switch (chart.chart_type) {
    case 'pie':
    case 'donut': {
      const a = findLen('slice_labels');
      const b = findLen('slice_sizes');
      if (a != null && b != null && a !== b) {
        out.push({
          chart_id: chart.id,
          reason: 'length_mismatch',
          message: `Slice labels and Slice sizes have different lengths (${a} vs ${b}). Adjust one of them.`,
        });
      }
      return out;
    }
    case 'waterfall': {
      const s = findLen('steps');
      const c = findLen('changes');
      if (s != null && c != null && s !== c) {
        out.push({
          chart_id: chart.id,
          reason: 'length_mismatch',
          message: `Steps and Change at each step have different lengths (${s} vs ${c}).`,
        });
      }
      return out;
    }
    case 'heatmap': {
      const cols = findLen('columns');
      const rows = findLen('rows');
      const cells = findLen('cell_colours');
      if (cols != null && rows != null && cells != null) {
        const expected = cols * rows;
        if (cells !== expected) {
          out.push({
            chart_id: chart.id,
            reason: 'length_mismatch',
            message: `Heatmap cell colours length (${cells}) doesn't match columns × rows (${cols} × ${rows} = ${expected}).`,
          });
        }
      }
      return out;
    }
    default:
      return out;
  }
}
