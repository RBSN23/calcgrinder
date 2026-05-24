'use client';

// PROJ-15 — Radial Progress chart renderer.

import * as React from 'react';

import { EmptyPlot, MONO, SANS, type ChartThemeBundle } from './utils';

export interface RadialProgressRendererProps {
  theme: ChartThemeBundle;
  current: number;
  goal: number;
  centreLabel?: string;
}

export function RadialProgressSvg({
  theme,
  current,
  goal,
  centreLabel,
}: RadialProgressRendererProps) {
  if (!Number.isFinite(current) || !Number.isFinite(goal) || goal <= 0) {
    return <EmptyPlot theme={theme} />;
  }
  const pct = Math.max(0, Math.min(1, current / goal));
  const W = 220;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2 + 6;
  const r = 70;
  const stroke = 14;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct);
  const colour =
    pct >= 1 ? theme.palette.pos : theme.palette.series[0];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={theme.border}
        strokeWidth={stroke}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={colour}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={theme.glow ? { filter: `drop-shadow(0 0 6px ${colour}99)` } : undefined}
      />
      <text
        x={cx}
        y={cy + 2}
        fontSize={28}
        fontWeight={600}
        textAnchor="middle"
        fill={theme.text}
        fontFamily={MONO}
      >
        {Math.round(pct * 100)}%
      </text>
      {centreLabel ? (
        <text
          x={cx}
          y={cy + 24}
          fontSize={11}
          textAnchor="middle"
          fill={theme.muted}
          fontFamily={SANS}
          style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
        >
          {centreLabel}
        </text>
      ) : null}
    </svg>
  );
}
