// PROJ-15 — Shared SVG primitives for chart renderers.
//
// Each renderer is a pure function of (data, theme bundle, options) → SVG.
// No fetching, no theme lookup, no error handling inside renderers — the
// caller (ChartCard) handles broken/empty bindings up-front.

import * as React from 'react';

import type { ChartPalette } from '@/lib/themes';

export const SANS =
  'var(--font-geist-sans), -apple-system, system-ui, sans-serif';
export const MONO = 'var(--font-geist-mono), monospace';

export interface ChartThemeBundle {
  /** Background colour drawn behind the SVG (used for slice stroke fills). */
  surface: string;
  /** Default text colour. */
  text: string;
  /** Muted text (legend, labels, captions). */
  muted: string;
  /** Subtle text (axis ticks). */
  subtle: string;
  /** Grid + hairline border colour for axis rules. */
  border: string;
  /** Resolved palette: 8 series stops + heat + pos/neg/neutral. */
  palette: ChartPalette;
  /** True for glow themes — adds drop-shadow filters on series strokes. */
  glow: boolean;
}

/** Catmull-Rom → cubic-bezier smoothing. */
export function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return '';
  if (pts.length < 3) {
    return pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Build a polyline path through the given points (no smoothing). */
export function linearPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
}

/** Pick "nice" tick locations between 0 and max (rounded up to nearest step). */
export function niceTicks(
  min: number,
  max: number,
  approx: number = 5,
): number[] {
  if (!isFinite(min) || !isFinite(max) || max === min) return [min, max];
  const span = max - min;
  const step0 = span / approx;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  let step: number;
  if (norm < 1.5) step = mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const out: number[] = [];
  const start = Math.floor(min / step) * step;
  for (let v = start; v <= max + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export interface LegendItem {
  label: string;
  color: string;
  swatch: 'box' | 'line';
}

export function LegendRow({
  theme,
  items,
  mono = false,
}: {
  theme: ChartThemeBundle;
  items: LegendItem[];
  mono?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        marginTop: 6,
        fontSize: 11,
        color: theme.muted,
        fontFamily: mono ? MONO : SANS,
        letterSpacing: -0.05,
      }}
    >
      {items.map((it, i) => (
        <span
          key={i}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span
            style={{
              width: it.swatch === 'line' ? 12 : 9,
              height: it.swatch === 'line' ? 2 : 9,
              borderRadius: it.swatch === 'line' ? 0 : 2,
              background: it.color,
              boxShadow:
                theme.glow && it.swatch !== 'line' ? `0 0 6px ${it.color}66` : undefined,
            }}
          />
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Wrap an SVG renderer with a soft "no data" placeholder when series is empty. */
export function EmptyPlot({ theme }: { theme: ChartThemeBundle }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: theme.subtle,
        fontFamily: SANS,
        fontStyle: 'italic',
      }}
    >
      No data yet
    </div>
  );
}

/** Format a number with a small / compact suffix (1.2k, 3.4M). */
export function formatTick(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  if (a >= 1) return `${Math.round(n * 100) / 100}`;
  return `${n}`;
}

/** Truncate an array to CHART_MAX_POINTS and return both the truncated list and the
 * original length (for the "Showing first 500 of N" notice). */
import { CHART_MAX_POINTS } from '@/lib/charts/limits';

export function truncateSeries<T>(
  values: readonly T[],
): { values: T[]; truncatedFrom: number | null } {
  if (values.length <= CHART_MAX_POINTS) {
    return { values: [...values], truncatedFrom: null };
  }
  return {
    values: values.slice(0, CHART_MAX_POINTS),
    truncatedFrom: values.length,
  };
}

/** Standard chart-card body padding (matches docs/design/charts.jsx ChartCard). */
export const BODY_PAD = 18;
export const CHART_W = 408;
export const CHART_H = 200;
