'use client';

// PROJ-15 — Area chart renderer (stacked filled areas).

import * as React from 'react';

import { CHART_MAX_SERIES } from '@/lib/charts/limits';

import {
  CHART_H,
  CHART_W,
  EmptyPlot,
  LegendItem,
  LegendRow,
  MONO,
  niceTicks,
  smoothPath,
  linearPath,
  type ChartThemeBundle,
} from './utils';

export interface AreaDatum {
  label: string;
  color: string;
  values: number[];
}

export interface AreaRendererProps {
  theme: ChartThemeBundle;
  xLabels: string[];
  series: AreaDatum[];
  smooth?: boolean;
  showAxisLabels?: boolean;
  showLegend?: boolean;
}

export function AreaChartSvg({
  theme,
  xLabels,
  series,
  smooth = true,
  showAxisLabels = true,
  showLegend = true,
}: AreaRendererProps) {
  const visible = series.slice(0, CHART_MAX_SERIES);
  if (visible.length === 0 || xLabels.length === 0) return <EmptyPlot theme={theme} />;

  const pad = { l: 40, r: 14, t: 10, b: showAxisLabels ? 24 : 10 };
  const N = xLabels.length;
  const stackTotals = Array.from({ length: N }, (_, i) =>
    visible.reduce((acc, s) => acc + (s.values[i] ?? 0), 0),
  );
  const max = Math.max(...stackTotals, 1);
  const ticks = niceTicks(0, max, 4);
  const yMax = ticks[ticks.length - 1];

  const xs = (i: number) =>
    pad.l + (N <= 1 ? 0 : (i / (N - 1)) * (CHART_W - pad.l - pad.r));
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
        {visible.map((s, layerIdx) => {
          const topVals = Array.from({ length: N }, (_, i) =>
            visible.slice(0, layerIdx + 1).reduce((a, sx) => a + (sx.values[i] ?? 0), 0),
          );
          const bottomVals = Array.from({ length: N }, (_, i) =>
            visible.slice(0, layerIdx).reduce((a, sx) => a + (sx.values[i] ?? 0), 0),
          );
          const top: [number, number][] = topVals.map((v, i) => [xs(i), ys(v)]);
          const bottom: [number, number][] = bottomVals.map((v, i) => [xs(i), ys(v)]);
          const topPath = smooth ? smoothPath(top) : linearPath(top);
          const bottomReversed = [...bottom].reverse();
          const bottomPath = (smooth ? smoothPath(bottomReversed) : linearPath(bottomReversed)).replace(
            /^M/,
            'L',
          );
          const d = `${topPath} ${bottomPath} Z`;
          return (
            <g key={layerIdx}>
              <path d={d} fill={s.color} fillOpacity={theme.glow ? 0.4 : 0.35} />
              <path
                d={topPath}
                fill="none"
                stroke={s.color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
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
      </svg>
      {showLegend ? (
        <LegendRow
          theme={theme}
          items={visible.map<LegendItem>((s) => ({
            label: s.label,
            color: s.color,
            swatch: 'box',
          }))}
        />
      ) : null}
    </>
  );
}
