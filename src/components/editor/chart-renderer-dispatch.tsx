'use client';

// PROJ-15 — Renderer dispatcher.
//
// Resolves a ChartRow + cells + evaluation → the correct SVG renderer.
// Always called after ChartBrokenBindingPanel has been ruled out by the
// structural-error analysis.

import * as React from 'react';

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
  SparklineBindingsT,
  StackedBarBindingsT,
  WaterfallBindingsT,
} from '@/lib/charts/bindings';
import { CHART_MAX_POINTS } from '@/lib/charts/limits';
import type { ChartRow } from '@/lib/charts/types';
import type { CellRow } from '@/lib/cells/types';
import type { EvaluationResult } from '@/lib/formula';
import type { ChartPalette } from '@/lib/themes';

import {
  AreaChartSvg,
  BarChartSvg,
  BulletChartSvg,
  ComparisonBarChartSvg,
  DonutChartSvg,
  HeatmapChartSvg,
  LineChartSvg,
  PieChartSvg,
  RadialProgressSvg,
  SparklineSvg,
  StackedBarChartSvg,
  WaterfallChartSvg,
  type ChartThemeBundle,
} from './chart-renderers';
import {
  findCellById,
  readArray,
  readScalarNumber,
  resolveSeriesList,
  resolveXAxisLabels,
  toNumbers,
  toStrings,
} from './chart-data-resolver';

interface DispatchProps {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  theme: ChartThemeBundle;
}

export function ChartRendererDispatch({
  chart,
  cells,
  evaluation,
  theme,
}: DispatchProps) {
  const showAxisLabels = chart.style.axis_labels !== 'hide';
  const showLegend = chart.style.legend !== 'hide';

  switch (chart.chart_type) {
    case 'line': {
      const b = chart.bindings as LineBindingsT;
      const xLabels = resolveXAxisLabels(b.x_axis, cells, evaluation);
      const series = resolveSeriesList(
        b.lines,
        cells,
        evaluation,
        theme.palette,
      );
      return (
        <LineChartSvg
          theme={theme}
          xLabels={xLabels}
          series={series}
          smooth={chart.style.smooth_lines}
          showAxisLabels={showAxisLabels}
          showLegend={showLegend}
        />
      );
    }
    case 'bar': {
      const b = chart.bindings as BarBindingsT;
      const xLabels = resolveXAxisLabels(b.x_axis, cells, evaluation);
      const series = resolveSeriesList(
        b.bars,
        cells,
        evaluation,
        theme.palette,
      );
      return (
        <BarChartSvg
          theme={theme}
          xLabels={xLabels}
          series={series}
          showAxisLabels={showAxisLabels}
          showLegend={showLegend}
        />
      );
    }
    case 'area': {
      const b = chart.bindings as AreaBindingsT;
      const xLabels = resolveXAxisLabels(b.x_axis, cells, evaluation);
      const series = resolveSeriesList(
        b.areas,
        cells,
        evaluation,
        theme.palette,
      );
      return (
        <AreaChartSvg
          theme={theme}
          xLabels={xLabels}
          series={series}
          smooth={chart.style.smooth_lines}
          showAxisLabels={showAxisLabels}
          showLegend={showLegend}
        />
      );
    }
    case 'stacked_bar': {
      const b = chart.bindings as StackedBarBindingsT;
      const xLabels = resolveXAxisLabels(b.x_axis, cells, evaluation);
      const layers = resolveSeriesList(
        b.stack_layers,
        cells,
        evaluation,
        theme.palette,
      );
      return (
        <StackedBarChartSvg
          theme={theme}
          xLabels={xLabels}
          layers={layers}
          showAxisLabels={showAxisLabels}
          showLegend={showLegend}
        />
      );
    }
    case 'pie': {
      const b = chart.bindings as PieBindingsT;
      const labelsArr = readArray(
        evaluation[findCellById(cells, b.slice_labels)?.name ?? ''],
      );
      const sizesArr = readArray(
        evaluation[findCellById(cells, b.slice_sizes)?.name ?? ''],
      );
      const labels = labelsArr ? toStrings(labelsArr) : [];
      const sizes = sizesArr ? toNumbers(sizesArr) : [];
      const N = Math.min(labels.length, sizes.length);
      const slices = Array.from({ length: N }, (_, i) => ({
        label: labels[i],
        value: sizes[i],
      }));
      return <PieChartSvg theme={theme} slices={slices} showLegend={showLegend} />;
    }
    case 'donut': {
      const b = chart.bindings as DonutBindingsT;
      const labelsArr = readArray(
        evaluation[findCellById(cells, b.slice_labels)?.name ?? ''],
      );
      const sizesArr = readArray(
        evaluation[findCellById(cells, b.slice_sizes)?.name ?? ''],
      );
      const labels = labelsArr ? toStrings(labelsArr) : [];
      const sizes = sizesArr ? toNumbers(sizesArr) : [];
      const N = Math.min(labels.length, sizes.length);
      const slices = Array.from({ length: N }, (_, i) => ({
        label: labels[i],
        value: sizes[i],
      }));
      const centreValue = readScalarNumber(
        evaluation[findCellById(cells, b.centre_value)?.name ?? ''],
      );
      return (
        <DonutChartSvg
          theme={theme}
          slices={slices}
          centreLabel={b.centre_label || undefined}
          centreValue={centreValue ?? undefined}
          showLegend={showLegend}
        />
      );
    }
    case 'comparison_bar': {
      const b = chart.bindings as ComparisonBarBindingsT;
      const xLabels = resolveXAxisLabels(b.x_axis, cells, evaluation);
      const aArr = readArray(
        evaluation[findCellById(cells, b.series_a.cell_id)?.name ?? ''],
      );
      const bArr = readArray(
        evaluation[findCellById(cells, b.series_b.cell_id)?.name ?? ''],
      );
      const labelsArr = readArray(
        evaluation[findCellById(cells, b.labels)?.name ?? ''],
      );
      return (
        <ComparisonBarChartSvg
          theme={theme}
          xLabels={xLabels}
          seriesA={{
            label: b.series_a.label,
            color: theme.palette.series[0],
            values: aArr ? toNumbers(aArr) : [],
          }}
          seriesB={{
            label: b.series_b.label,
            color: theme.palette.neutral,
            values: bArr ? toNumbers(bArr) : [],
          }}
          labels={labelsArr ? toStrings(labelsArr) : []}
          showAxisLabels={showAxisLabels}
          showLegend={showLegend}
        />
      );
    }
    case 'sparkline': {
      const b = chart.bindings as SparklineBindingsT;
      const arr = readArray(
        evaluation[findCellById(cells, b.values)?.name ?? ''],
      );
      return (
        <SparklineSvg
          theme={theme}
          values={arr ? toNumbers(arr) : []}
          smooth={chart.style.smooth_lines}
        />
      );
    }
    case 'waterfall': {
      const b = chart.bindings as WaterfallBindingsT;
      const stepsArr = readArray(
        evaluation[findCellById(cells, b.steps)?.name ?? ''],
      );
      const changesArr = readArray(
        evaluation[findCellById(cells, b.changes)?.name ?? ''],
      );
      return (
        <WaterfallChartSvg
          theme={theme}
          steps={stepsArr ? toStrings(stepsArr) : []}
          changes={changesArr ? toNumbers(changesArr) : []}
          showAxisLabels={showAxisLabels}
        />
      );
    }
    case 'bullet': {
      const b = chart.bindings as BulletBindingsT;
      const actual = readScalarNumber(
        evaluation[findCellById(cells, b.actual)?.name ?? ''],
      );
      const target = readScalarNumber(
        evaluation[findCellById(cells, b.target)?.name ?? ''],
      );
      const bandsArr = readArray(
        evaluation[findCellById(cells, b.performance_bands)?.name ?? ''],
      );
      return (
        <BulletChartSvg
          theme={theme}
          actual={actual ?? 0}
          target={target ?? 0}
          performanceBands={bandsArr ? toNumbers(bandsArr) : []}
          showLegend={showLegend}
        />
      );
    }
    case 'heatmap': {
      const b = chart.bindings as HeatmapBindingsT;
      const colsArr = readArray(
        evaluation[findCellById(cells, b.columns)?.name ?? ''],
      );
      const rowsArr = readArray(
        evaluation[findCellById(cells, b.rows)?.name ?? ''],
      );
      const valuesArr = readArray(
        evaluation[findCellById(cells, b.cell_colours)?.name ?? ''],
      );
      return (
        <HeatmapChartSvg
          theme={theme}
          columns={colsArr ? toStrings(colsArr) : []}
          rows={rowsArr ? toStrings(rowsArr) : []}
          values={valuesArr ? toNumbers(valuesArr) : []}
          showAxisLabels={showAxisLabels}
        />
      );
    }
    case 'radial_progress': {
      const b = chart.bindings as RadialProgressBindingsT;
      const current = readScalarNumber(
        evaluation[findCellById(cells, b.current)?.name ?? ''],
      );
      const goal = readScalarNumber(
        evaluation[findCellById(cells, b.goal)?.name ?? ''],
      );
      return (
        <RadialProgressSvg
          theme={theme}
          current={current ?? 0}
          goal={goal ?? 0}
          centreLabel={b.centre_label || undefined}
        />
      );
    }
  }
}

/** Returns true if any visible series exceeds CHART_MAX_POINTS — caller shows
 * a muted "Showing first N" notice. */
export function chartHasTruncation(
  chart: ChartRow,
  cells: CellRow[],
  evaluation: EvaluationResult,
): { truncated: boolean; from: number } {
  let from = 0;
  let truncated = false;
  const checkArray = (cellId: string | null | undefined) => {
    if (!cellId) return;
    const cell = findCellById(cells, cellId);
    if (!cell) return;
    const arr = readArray(evaluation[cell.name]);
    if (arr && arr.length > CHART_MAX_POINTS) {
      truncated = true;
      from = Math.max(from, arr.length);
    }
  };
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
        ((chart.bindings as unknown) as Record<
          string,
          { cell_id: string | null }[]
        >)[seriesKey] ?? [];
      list.forEach((s) => checkArray(s.cell_id));
      checkArray((chart.bindings as LineBindingsT).x_axis);
      break;
    }
    case 'sparkline':
      checkArray((chart.bindings as SparklineBindingsT).values);
      break;
    default:
      break;
  }
  return { truncated, from };
}
