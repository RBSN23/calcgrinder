'use client';

// PROJ-15 — Bar chart renderer (single or grouped series).

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
  type ChartThemeBundle,
} from './utils';

export interface BarSeries {
  label: string;
  color: string;
  values: number[];
}

export interface BarRendererProps {
  theme: ChartThemeBundle;
  xLabels: string[];
  series: BarSeries[];
  showAxisLabels?: boolean;
  showLegend?: boolean;
}

export function BarChartSvg({
  theme,
  xLabels,
  series,
  showAxisLabels = true,
  showLegend = true,
}: BarRendererProps) {
  const visible = series.slice(0, CHART_MAX_SERIES);
  if (visible.length === 0 || xLabels.length === 0) return <EmptyPlot theme={theme} />;

  const pad = { l: 40, r: 14, t: 10, b: showAxisLabels ? 24 : 10 };
  const allVals = visible.flatMap((s) => s.values).filter(Number.isFinite);
  const max = allVals.length ? Math.max(...allVals, 0) : 1;
  const ticks = niceTicks(0, max, 5);
  const yMax = ticks[ticks.length - 1];
  const innerW = CHART_W - pad.l - pad.r;
  const slotW = innerW / xLabels.length;
  const groupW = slotW * 0.7;
  const barW = groupW / visible.length;

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
          const cx = pad.l + slotW * (i + 0.5);
          return (
            <g key={i}>
              {visible.map((s, sj) => {
                const v = s.values[i] ?? 0;
                const y = ys(v);
                const h = Math.max(0, CHART_H - pad.b - y);
                const x = cx - groupW / 2 + sj * barW;
                return (
                  <rect
                    key={sj}
                    x={x}
                    y={y}
                    width={Math.max(1, barW - 1)}
                    height={h}
                    rx={2}
                    ry={2}
                    fill={s.color}
                    style={theme.glow ? { filter: `drop-shadow(0 0 6px ${s.color}55)` } : undefined}
                  />
                );
              })}
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
            </g>
          );
        })}
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
