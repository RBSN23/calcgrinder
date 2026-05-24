'use client';

// PROJ-15 — Waterfall chart renderer.

import * as React from 'react';

import {
  CHART_H,
  CHART_W,
  EmptyPlot,
  MONO,
  niceTicks,
  type ChartThemeBundle,
} from './utils';

export interface WaterfallRendererProps {
  theme: ChartThemeBundle;
  steps: string[];
  changes: number[];
  showAxisLabels?: boolean;
}

export function WaterfallChartSvg({
  theme,
  steps,
  changes,
  showAxisLabels = true,
}: WaterfallRendererProps) {
  if (steps.length === 0 || changes.length === 0) return <EmptyPlot theme={theme} />;
  const N = Math.min(steps.length, changes.length);

  const computed = Array.from({ length: N }).reduce<
    { label: string; start: number; end: number; delta: number }[]
  >((acc, _, i) => {
    const start = i === 0 ? 0 : acc[i - 1].end;
    const delta = changes[i] ?? 0;
    acc.push({ label: steps[i] ?? '', start, end: start + delta, delta });
    return acc;
  }, []);
  const tops = computed.flatMap((c) => [c.start, c.end]);
  const allFinite = tops.filter(Number.isFinite);
  const minVal = Math.min(0, ...allFinite);
  const maxVal = Math.max(0, ...allFinite);
  const ticks = niceTicks(minVal, maxVal, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  const pad = { l: 44, r: 14, t: 10, b: showAxisLabels ? 24 : 10 };
  const innerW = CHART_W - pad.l - pad.r;
  const slot = innerW / N;
  const barW = slot * 0.6;

  const ys = (v: number) =>
    CHART_H - pad.b - ((v - yMin) / (yMax - yMin || 1)) * (CHART_H - pad.t - pad.b);

  return (
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
      {computed.map((c, i) => {
        const cx = pad.l + slot * (i + 0.5);
        const y0 = ys(c.start);
        const y1 = ys(c.end);
        const top = Math.min(y0, y1);
        const h = Math.abs(y0 - y1);
        const fill =
          c.delta >= 0 ? theme.palette.pos : theme.palette.neg;
        return (
          <g key={i}>
            <rect
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={Math.max(1, h)}
              rx={2}
              fill={fill}
              fillOpacity={0.85}
            />
            {showAxisLabels ? (
              <text
                x={cx}
                y={CHART_H - pad.b + 13}
                fontSize={10}
                textAnchor="middle"
                fill={theme.subtle}
                fontFamily={MONO}
              >
                {c.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
