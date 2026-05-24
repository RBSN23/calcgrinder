'use client';

// PROJ-15 — Heatmap chart renderer.
//
// Dense grid only — if columns × rows > CHART_MAX_HEATMAP_CELLS the caller
// renders the broken-binding placeholder instead (no partial-grid render).

import * as React from 'react';

import { CHART_MAX_HEATMAP_CELLS } from '@/lib/charts/limits';

import { CHART_W, EmptyPlot, MONO, type ChartThemeBundle } from './utils';

export interface HeatmapRendererProps {
  theme: ChartThemeBundle;
  columns: string[];
  rows: string[];
  /** Length must equal columns.length × rows.length (row-major). */
  values: number[];
  showAxisLabels?: boolean;
}

export function HeatmapChartSvg({
  theme,
  columns,
  rows,
  values,
  showAxisLabels = true,
}: HeatmapRendererProps) {
  const nCols = columns.length;
  const nRows = rows.length;
  if (nCols === 0 || nRows === 0) return <EmptyPlot theme={theme} />;
  if (nCols * nRows > CHART_MAX_HEATMAP_CELLS) return <EmptyPlot theme={theme} />;
  if (values.length < nCols * nRows) return <EmptyPlot theme={theme} />;

  const pad = { l: showAxisLabels ? 60 : 10, r: 10, t: showAxisLabels ? 22 : 10, b: 10 };
  const innerW = CHART_W - pad.l - pad.r;
  const innerH = Math.max(120, nRows * 18);
  const cellW = innerW / nCols;
  const cellH = innerH / nRows;
  const minV = Math.min(...values.filter(Number.isFinite));
  const maxV = Math.max(...values.filter(Number.isFinite));
  const range = maxV - minV || 1;

  const ramp = theme.palette.heat;
  const colorFor = (v: number): string => {
    const norm = (v - minV) / range;
    const idx = Math.min(ramp.length - 1, Math.max(0, Math.round(norm * (ramp.length - 1))));
    return ramp[idx];
  };

  const totalH = pad.t + innerH + pad.b;
  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${totalH}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {showAxisLabels
        ? columns.map((c, i) => (
            <text
              key={`c-${i}`}
              x={pad.l + cellW * (i + 0.5)}
              y={pad.t - 6}
              fontSize={10}
              textAnchor="middle"
              fill={theme.muted}
              fontFamily={MONO}
            >
              {c}
            </text>
          ))
        : null}
      {showAxisLabels
        ? rows.map((r, i) => (
            <text
              key={`r-${i}`}
              x={pad.l - 8}
              y={pad.t + cellH * (i + 0.5) + 3.5}
              fontSize={10}
              textAnchor="end"
              fill={theme.muted}
              fontFamily={MONO}
            >
              {r}
            </text>
          ))
        : null}
      {rows.map((_, ri) =>
        columns.map((_, ci) => {
          const v = values[ri * nCols + ci];
          return (
            <rect
              key={`${ri}-${ci}`}
              x={pad.l + ci * cellW}
              y={pad.t + ri * cellH}
              width={cellW - 1}
              height={cellH - 1}
              fill={colorFor(v ?? minV)}
            />
          );
        }),
      )}
    </svg>
  );
}
