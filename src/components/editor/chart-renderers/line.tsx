'use client';

// PROJ-15 — Line chart renderer.

import * as React from 'react';

import { CHART_MAX_SERIES } from '@/lib/charts/limits';

import {
  CHART_H,
  CHART_W,
  EmptyPlot,
  LegendItem,
  LegendRow,
  MONO,
  linearPath,
  niceTicks,
  smoothPath,
  truncateSeries,
  type ChartThemeBundle,
} from './utils';

export interface LineDatum {
  label: string;
  color: string;
  values: number[];
}

export interface LineRendererProps {
  theme: ChartThemeBundle;
  xLabels: string[];
  series: LineDatum[];
  smooth?: boolean;
  showAxisLabels?: boolean;
  showLegend?: boolean;
}

export function LineChartSvg({
  theme,
  xLabels,
  series,
  smooth = false,
  showAxisLabels = true,
  showLegend = true,
}: LineRendererProps) {
  const visible = series.slice(0, CHART_MAX_SERIES);
  if (visible.length === 0 || xLabels.length === 0) return <EmptyPlot theme={theme} />;

  const pad = { l: 40, r: 14, t: 10, b: showAxisLabels ? 24 : 10 };
  const allVals = visible.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  const min = allVals.length ? Math.min(...allVals, 0) : 0;
  const max = allVals.length ? Math.max(...allVals, 1) : 1;
  const ticks = niceTicks(min, max, 5);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const N = xLabels.length;
  const xs = (i: number) =>
    pad.l + (N <= 1 ? 0 : (i / (N - 1)) * (CHART_W - pad.l - pad.r));
  const ys = (v: number) =>
    CHART_H - pad.b - ((v - yMin) / (yMax - yMin || 1)) * (CHART_H - pad.t - pad.b);

  const legend: LegendItem[] = visible.map((s) => ({
    label: s.label,
    color: s.color,
    swatch: 'line',
  }));

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
        {showAxisLabels
          ? xLabels.map((lab, i) => {
              const skip = Math.max(1, Math.ceil(N / 8));
              if (i % skip !== 0) return null;
              return (
                <text
                  key={i}
                  x={xs(i)}
                  y={CHART_H - pad.b + 13}
                  fontSize={10}
                  textAnchor="middle"
                  fill={theme.subtle}
                  fontFamily={MONO}
                >
                  {lab}
                </text>
              );
            })
          : null}
        {visible.map((s, si) => {
          const truncated = truncateSeries(s.values).values;
          const pts: [number, number][] = truncated.map((v, i) => [xs(i), ys(v)]);
          const d = smooth ? smoothPath(pts) : linearPath(pts);
          return (
            <g key={si}>
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={theme.glow ? { filter: `drop-shadow(0 0 4px ${s.color}99)` } : undefined}
              />
              {pts.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={2}
                  fill={theme.surface}
                  stroke={s.color}
                  strokeWidth={1.25}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {showLegend ? <LegendRow theme={theme} items={legend} /> : null}
    </>
  );
}
