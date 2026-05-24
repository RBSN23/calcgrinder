'use client';

// PROJ-15 — Bullet chart renderer.
//
// Horizontal bullet: performance bands as muted background ranges, actual
// value as a saturated bar, target as a thin vertical tick.

import * as React from 'react';

import { CHART_W, EmptyPlot, MONO, type ChartThemeBundle } from './utils';

export interface BulletRendererProps {
  theme: ChartThemeBundle;
  actual: number;
  target: number;
  /** 2-3 numbers; consecutive thresholds define bands [0,a], [a,b], [b,c]. */
  performanceBands?: number[];
  showLegend?: boolean;
}

export function BulletChartSvg({
  theme,
  actual,
  target,
  performanceBands = [],
  showLegend = true,
}: BulletRendererProps) {
  if (!Number.isFinite(actual) || !Number.isFinite(target)) {
    return <EmptyPlot theme={theme} />;
  }
  const H = 80;
  const pad = { l: 14, r: 14, t: 20, b: 24 };
  const barH = 22;
  const innerW = CHART_W - pad.l - pad.r;

  const maxBand = performanceBands.length
    ? Math.max(...performanceBands.filter(Number.isFinite))
    : Math.max(actual, target) * 1.25;
  const scale = Math.max(maxBand, target, actual, 1);

  const xs = (v: number) => pad.l + (v / scale) * innerW;
  const bandColours = [theme.border, theme.palette.neutral, theme.palette.posSoft];
  const bandStarts = [0, ...performanceBands.slice(0, -1)];

  return (
    <>
      <svg
        viewBox={`0 0 ${CHART_W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {performanceBands.map((upper, i) => {
          const start = bandStarts[i] ?? 0;
          const x = xs(start);
          const w = Math.max(0, xs(upper) - x);
          return (
            <rect
              key={i}
              x={x}
              y={pad.t}
              width={w}
              height={barH}
              fill={bandColours[Math.min(i, bandColours.length - 1)]}
              opacity={0.55}
            />
          );
        })}
        <rect
          x={pad.l}
          y={pad.t + barH * 0.25}
          width={xs(actual) - pad.l}
          height={barH * 0.5}
          rx={2}
          fill={theme.palette.series[0]}
        />
        <line
          x1={xs(target)}
          x2={xs(target)}
          y1={pad.t - 2}
          y2={pad.t + barH + 2}
          stroke={theme.text}
          strokeWidth={2}
        />
        <text
          x={pad.l}
          y={pad.t - 4}
          fontSize={10}
          fill={theme.muted}
          fontFamily={MONO}
        >
          0
        </text>
        <text
          x={pad.l + innerW}
          y={pad.t - 4}
          fontSize={10}
          textAnchor="end"
          fill={theme.muted}
          fontFamily={MONO}
        >
          {Math.round(scale * 100) / 100}
        </text>
      </svg>
      {showLegend ? (
        <div
          style={{
            display: 'flex',
            gap: 14,
            marginTop: 6,
            fontSize: 11,
            color: theme.muted,
          }}
        >
          <span>
            Actual: <strong style={{ color: theme.text }}>{actual}</strong>
          </span>
          <span>
            Target: <strong style={{ color: theme.text }}>{target}</strong>
          </span>
        </div>
      ) : null}
    </>
  );
}
