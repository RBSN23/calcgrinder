'use client';

// PROJ-15 — Donut chart renderer.

import * as React from 'react';

import {
  CHART_H,
  CHART_W,
  EmptyPlot,
  MONO,
  SANS,
  type ChartThemeBundle,
} from './utils';

export interface DonutSliceDatum {
  label: string;
  value: number;
}

export interface DonutRendererProps {
  theme: ChartThemeBundle;
  slices: DonutSliceDatum[];
  centreLabel?: string;
  centreValue?: string | number | null;
  showLegend?: boolean;
}

function ringArc(
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  a0: number,
  a1: number,
): string {
  const large = (a1 - a0) % (2 * Math.PI) > Math.PI ? 1 : 0;
  const x0o = cx + rOut * Math.cos(a0);
  const y0o = cy + rOut * Math.sin(a0);
  const x1o = cx + rOut * Math.cos(a1);
  const y1o = cy + rOut * Math.sin(a1);
  const x0i = cx + rIn * Math.cos(a0);
  const y0i = cy + rIn * Math.sin(a0);
  const x1i = cx + rIn * Math.cos(a1);
  const y1i = cy + rIn * Math.sin(a1);
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

export function DonutChartSvg({
  theme,
  slices,
  centreLabel,
  centreValue,
  showLegend = true,
}: DonutRendererProps) {
  if (slices.length === 0) return <EmptyPlot theme={theme} />;
  const total = slices.reduce((s, d) => s + (d.value || 0), 0);
  if (total <= 0) return <EmptyPlot theme={theme} />;

  const cx = 110;
  const cy = 96;
  const rOut = 78;
  const rIn = 50;
  const colors = theme.palette.series;
  const arcs = slices.reduce<
    { d: DonutSliceDatum; a0: number; a1: number; color: string }[]
  >((acc, d, i) => {
    const a0 = i === 0 ? -Math.PI / 2 : acc[i - 1].a1;
    const a1 = a0 + (d.value / total) * Math.PI * 2;
    acc.push({ d, a0, a1, color: colors[i % colors.length] });
    return acc;
  }, []);
  const displayValue =
    centreValue == null
      ? ''
      : typeof centreValue === 'number'
        ? centreValue.toLocaleString()
        : String(centreValue);

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: '55%' }}>
        <svg
          viewBox={`0 0 ${CHART_W * 0.55} ${CHART_H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {arcs.map((s, i) => (
            <path
              key={i}
              d={ringArc(cx, cy, rOut, rIn, s.a0, s.a1)}
              fill={s.color}
              stroke={theme.surface}
              strokeWidth={1.5}
              style={
                theme.glow && i === 0
                  ? { filter: `drop-shadow(0 0 8px ${s.color}66)` }
                  : undefined
              }
            />
          ))}
          {displayValue ? (
            <text
              x={cx}
              y={cy - 4}
              fontSize={18}
              fontWeight={600}
              textAnchor="middle"
              fill={theme.text}
              fontFamily={MONO}
              letterSpacing={-0.6}
            >
              {displayValue}
            </text>
          ) : null}
          {centreLabel ? (
            <text
              x={cx}
              y={cy + (displayValue ? 14 : 4)}
              fontSize={10}
              textAnchor="middle"
              fill={theme.muted}
              fontFamily={SANS}
              style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
            >
              {centreLabel}
            </text>
          ) : null}
        </svg>
      </div>
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
                {Math.round((s.d.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
