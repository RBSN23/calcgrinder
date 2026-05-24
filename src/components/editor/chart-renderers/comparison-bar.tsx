'use client';

// PROJ-15 — Comparison Bar chart renderer.
//
// Two series side-by-side per X category, with a caption row for "labels" if
// the per-pair width is wide enough; otherwise tooltips on hover.

import * as React from 'react';

import {
  CHART_H,
  CHART_W,
  EmptyPlot,
  LegendItem,
  LegendRow,
  MONO,
  niceTicks,
  type ChartThemeBundle,
} from './utils';

const PAIR_LEGIBILITY_THRESHOLD_PX = 32;

export interface ComparisonBarRendererProps {
  theme: ChartThemeBundle;
  xLabels: string[];
  seriesA: { label: string; values: number[]; color?: string };
  seriesB: { label: string; values: number[]; color?: string };
  /** Per-pair caption labels (one per X position). Empty = no labels row. */
  labels?: string[];
  showAxisLabels?: boolean;
  showLegend?: boolean;
}

export function ComparisonBarChartSvg({
  theme,
  xLabels,
  seriesA,
  seriesB,
  labels = [],
  showAxisLabels = true,
  showLegend = true,
}: ComparisonBarRendererProps) {
  if (xLabels.length === 0) return <EmptyPlot theme={theme} />;

  const colorA = seriesA.color ?? theme.palette.series[0];
  const colorB = seriesB.color ?? theme.palette.neutral;

  const allVals = [...seriesA.values, ...seriesB.values].filter(Number.isFinite);
  const max = allVals.length ? Math.max(...allVals, 1) : 1;
  const ticks = niceTicks(0, max, 4);
  const yMax = ticks[ticks.length - 1];

  const N = xLabels.length;
  const hasCaptions = labels.length > 0;
  const pad = {
    l: 48,
    r: 14,
    t: 10,
    b: showAxisLabels ? (hasCaptions ? 36 : 24) : 10,
  };
  const innerW = CHART_W - pad.l - pad.r;
  const slot = innerW / N;
  const barW = slot * 0.32;
  const captionsFit = slot >= PAIR_LEGIBILITY_THRESHOLD_PX;

  const ys = (v: number) =>
    CHART_H - pad.b - (v / (yMax || 1)) * (CHART_H - pad.t - pad.b);

  return (
    <>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {ticks.map((g) => (
          <g key={g}>
            <line
              x1={pad.l}
              x2={CHART_W - pad.r}
              y1={ys(g)}
              y2={ys(g)}
              stroke={theme.border}
              strokeWidth={1}
            />
            {showAxisLabels ? (
              <text
                x={pad.l - 6}
                y={ys(g) + 3.5}
                fontSize={10}
                textAnchor="end"
                fill={theme.subtle}
                fontFamily={MONO}
              >
                {g}
              </text>
            ) : null}
          </g>
        ))}
        {xLabels.map((lab, i) => {
          const cx = pad.l + slot * (i + 0.5);
          const va = seriesA.values[i] ?? 0;
          const vb = seriesB.values[i] ?? 0;
          const ya = ys(va);
          const yb = ys(vb);
          const ha = Math.max(0, CHART_H - pad.b - ya);
          const hb = Math.max(0, CHART_H - pad.b - yb);
          const captionForPair = labels[i] ?? '';
          return (
            <g key={i}>
              <rect
                x={cx - barW - 1}
                y={ya}
                width={barW}
                height={ha}
                rx={2}
                fill={colorA}
              >
                {!captionsFit && captionForPair ? <title>{captionForPair}</title> : null}
              </rect>
              <rect
                x={cx + 1}
                y={yb}
                width={barW}
                height={hb}
                rx={2}
                fill={colorB}
              >
                {!captionsFit && captionForPair ? <title>{captionForPair}</title> : null}
              </rect>
              {showAxisLabels ? (
                <text
                  x={cx}
                  y={CHART_H - pad.b + 13}
                  fontSize={10}
                  textAnchor="middle"
                  fill={theme.subtle}
                  fontFamily={MONO}
                >
                  {lab}
                </text>
              ) : null}
              {hasCaptions && captionsFit ? (
                <text
                  x={cx}
                  y={CHART_H - pad.b + 26}
                  fontSize={9.5}
                  textAnchor="middle"
                  fill={theme.muted}
                  fontFamily={MONO}
                >
                  {captionForPair}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {showLegend ? (
        <LegendRow
          theme={theme}
          items={[
            { label: seriesA.label || 'Series A', color: colorA, swatch: 'box' } as LegendItem,
            { label: seriesB.label || 'Series B', color: colorB, swatch: 'box' } as LegendItem,
          ]}
        />
      ) : null}
    </>
  );
}
