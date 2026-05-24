'use client';

// PROJ-15 — Pie chart renderer.

import * as React from 'react';

import {
  CHART_H,
  CHART_W,
  EmptyPlot,
  MONO,
  SANS,
  type ChartThemeBundle,
} from './utils';

export interface PieSliceDatum {
  label: string;
  value: number;
}

export interface PieRendererProps {
  theme: ChartThemeBundle;
  slices: PieSliceDatum[];
  showLegend?: boolean;
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const large = (a1 - a0) % (2 * Math.PI) > Math.PI ? 1 : 0;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function PieChartSvg({ theme, slices, showLegend = true }: PieRendererProps) {
  if (slices.length === 0) return <EmptyPlot theme={theme} />;
  const total = slices.reduce((s, d) => s + (d.value || 0), 0);
  if (total <= 0) return <EmptyPlot theme={theme} />;

  const cx = 110;
  const cy = 96;
  const r = 78;
  const colors = theme.palette.series;
  const arcs = slices.reduce<
    { d: PieSliceDatum; a0: number; a1: number; color: string; pct: number }[]
  >((acc, d, i) => {
    const a0 = i === 0 ? -Math.PI / 2 : acc[i - 1].a1;
    const a1 = a0 + (d.value / total) * Math.PI * 2;
    acc.push({
      d,
      a0,
      a1,
      color: colors[i % colors.length],
      pct: Math.round((d.value / total) * 100),
    });
    return acc;
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg
        viewBox={`0 0 ${CHART_W * 0.55} ${CHART_H}`}
        style={{ width: '55%', height: 'auto' }}
      >
        {arcs.map((s, i) => (
          <path
            key={i}
            d={arcPath(cx, cy, r, s.a0, s.a1)}
            fill={s.color}
            stroke={theme.surface}
            strokeWidth={1.5}
          />
        ))}
      </svg>
      {showLegend ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontFamily: SANS,
          }}
        >
          {arcs.map((s, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: s.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: theme.text, flex: 1 }}>{s.d.label}</span>
              <span
                style={{
                  color: theme.muted,
                  fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.pct}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
