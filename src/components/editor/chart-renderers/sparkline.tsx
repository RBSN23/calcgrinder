'use client';

// PROJ-15 — Sparkline chart renderer.
//
// Compact, no axes, no legend. Inline use is handled at the call site.

import * as React from 'react';

import {
  EmptyPlot,
  smoothPath,
  linearPath,
  type ChartThemeBundle,
} from './utils';

export interface SparklineRendererProps {
  theme: ChartThemeBundle;
  values: number[];
  color?: string;
  smooth?: boolean;
  /** Renderer SVG width/height. Defaults to a flat 280×60. */
  width?: number;
  height?: number;
}

export function SparklineSvg({
  theme,
  values,
  color,
  smooth = true,
  width = 280,
  height = 60,
}: SparklineRendererProps) {
  if (values.length === 0) return <EmptyPlot theme={theme} />;
  const c = color ?? theme.palette.series[0];
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return <EmptyPlot theme={theme} />;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || 1;
  const pad = 4;
  const N = values.length;
  const xs = (i: number) =>
    pad + (N <= 1 ? 0 : (i / (N - 1)) * (width - pad * 2));
  const ys = (v: number) =>
    height - pad - ((v - min) / range) * (height - pad * 2);
  const pts: [number, number][] = values.map((v, i) => [xs(i), ys(v)]);
  const d = smooth ? smoothPath(pts) : linearPath(pts);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <path
        d={d}
        fill="none"
        stroke={c}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={theme.glow ? { filter: `drop-shadow(0 0 4px ${c}99)` } : undefined}
      />
    </svg>
  );
}
