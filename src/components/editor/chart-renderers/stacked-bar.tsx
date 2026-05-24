'use client';

// PROJ-15 — Stacked Bar chart renderer.

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

export interface StackLayer {
  label: string;
  color: string;
  values: number[];
}

export interface StackedBarRendererProps {
  theme: ChartThemeBundle;
  xLabels: string[];
  layers: StackLayer[];
  showAxisLabels?: boolean;
  showLegend?: boolean;
}

export function StackedBarChartSvg({
  theme,
  xLabels,
  layers,
  showAxisLabels = true,
  showLegend = true,
}: StackedBarRendererProps) {
  const visible = layers.slice(0, CHART_MAX_SERIES);
  if (visible.length === 0 || xLabels.length === 0) return <EmptyPlot theme={theme} />;

  const pad = { l: 40, r: 14, t: 10, b: showAxisLabels ? 24 : 10 };
  const N = xLabels.length;
  const totals = Array.from({ length: N }, (_, i) =>
    visible.reduce((a, s) => a + (s.values[i] ?? 0), 0),
  );
  const max = Math.max(...totals, 1);
  const ticks = niceTicks(0, max, 4);
  const yMax = ticks[ticks.length - 1];
  const innerW = CHART_W - pad.l - pad.r;
  const slot = innerW / N;
  const barW = slot * 0.6;

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
          let cursor = CHART_H - pad.b;
          return (
            <g key={i}>
              {visible.map((s, sj) => {
                const v = s.values[i] ?? 0;
                const h = (v / (yMax || 1)) * (CHART_H - pad.t - pad.b);
                const y = cursor - h;
                cursor -= h;
                return (
                  <rect
                    key={sj}
                    x={cx - barW / 2}
                    y={y}
                    width={barW}
                    height={Math.max(0, h)}
                    fill={s.color}
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
