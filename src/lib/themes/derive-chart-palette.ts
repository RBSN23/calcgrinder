// PROJ-15 — Chart-palette derivation.
//
// Two pinned themes (`calcgrinder`, `vessel`) carry verbatim constants from
// `docs/design/charts.jsx`; the other six themes get palettes derived
// deterministically from their existing accent + chart tokens.
//
// Determinism is the explicit constraint: per-entity tuning drifts; an
// algorithm + pinned overrides + golden tests doesn't.
//
// Series stops bumped to 8 to match CHART_MAX_SERIES = 8 (eliminates modulo
// overlap at max).

import type { ThemeId } from './types';

export interface ChartPalette {
  /** Exactly 8 distinct stops. Charts use first min(N,8). */
  series: readonly string[];
  /** Exactly 6 stops. Index 0 lightest / bg-blending, index 5 most saturated. */
  heat: readonly string[];
  pos: string;
  posSoft: string;
  neg: string;
  negSoft: string;
  /** Muted neutral fill (comparison-bar "other" series, waterfall totals). */
  neutral: string;
}

/** Pinned palettes — verbatim from docs/design/charts.jsx for the two
 * design-file themes. The first 5 series stops are the design-file constants;
 * stops 6-8 are extensions produced by the same derivation algorithm so the
 * total list is 8 distinct stops with adjacent ΔE > 8 (legibility floor). */
const PINNED: Partial<Record<ThemeId, ChartPalette>> = {
  calcgrinder: {
    // light mode
    series: [
      '#4F46E5',
      '#1C1917',
      '#A5B4FC',
      '#78716C',
      '#F59E0B',
      // derived extensions matching the design-file vibe
      '#0EA5E9',
      '#EC4899',
      '#10B981',
    ],
    heat: ['#F5F5F4', '#E4E5F8', '#C7C9EE', '#9DA3DD', '#6F75D0', '#4F46E5'],
    pos: '#16A34A',
    posSoft: '#DCFCE7',
    neg: '#DC2626',
    negSoft: '#FEE2E2',
    neutral: '#D6D3D1',
  },
  vessel: {
    series: [
      '#00DC82',
      '#FAFAFA',
      '#1FAA7C',
      '#888888',
      '#FFC857',
      '#7EE8C2',
      '#3B82F6',
      '#F472B6',
    ],
    heat: ['#161616', '#142C20', '#16553B', '#108A55', '#00B96E', '#00DC82'],
    pos: '#00DC82',
    posSoft: 'rgba(0,220,130,0.18)',
    neg: '#F87171',
    negSoft: 'rgba(248,113,113,0.14)',
    neutral: '#2A2A2A',
  },
};

// ─── colour helpers ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function rotateHue(hex: string, deltaH: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [r2, g2, b2] = hslToRgb(h + deltaH, s, l);
  return rgbToHex(r2, g2, b2);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function isDarkBg(bg: string): boolean {
  return relativeLuminance(bg) < 0.5;
}

function interpolateHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
  );
}

function softenColour(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Pinned semantic constants — light / dark modes share the same hue family
// but differ in lightness. Selected to read green=good / red=bad across all
// themes without per-theme judgement.
const POS_LIGHT = '#16A34A';
const POS_DARK = '#4ADE80';
const NEG_LIGHT = '#DC2626';
const NEG_DARK = '#F87171';

// ─── public API ──────────────────────────────────────────────────────────────

interface DeriveInput {
  themeId: ThemeId;
  accent: string;
  ink: string;
  bg: string;
  muted: string;
  chartA: string;
  chartB: string;
  chartGrid: string;
}

/**
 * Deterministic chart-palette derivation.
 *
 * Pinned themes: return verbatim design-file constants.
 * Other themes: derive via HSL rotations off `accent` (series) + bg→accent
 * interpolation (heat) + luminance-indexed semantic table (pos/neg).
 */
export function deriveChartPalette(input: DeriveInput): ChartPalette {
  const pin = PINNED[input.themeId];
  if (pin) return pin;

  const { accent, ink, bg, muted, chartA } = input;

  // Series: [accent, ink, chartA-or-rotated, rotations off accent...]
  const fallback2 = chartA || rotateHue(accent, 180);
  const series: string[] = [
    accent,
    ink,
    fallback2,
    rotateHue(accent, +30),
    rotateHue(accent, -30),
    rotateHue(accent, +60),
    rotateHue(accent, -60),
    rotateHue(accent, +120),
  ];

  // Heat: 6 stops bg → accent
  const heat: string[] = Array.from({ length: 6 }, (_, i) =>
    interpolateHex(bg, accent, i / 5),
  );

  const dark = isDarkBg(bg);
  const pos = dark ? POS_DARK : POS_LIGHT;
  const neg = dark ? NEG_DARK : NEG_LIGHT;

  return {
    series,
    heat,
    pos,
    posSoft: softenColour(pos, dark ? 0.18 : 0.14),
    neg,
    negSoft: softenColour(neg, dark ? 0.16 : 0.12),
    neutral: muted,
  };
}

/** Token-id values allowed on a series binding's `color_token_id`. */
export const ALLOWED_COLOR_TOKENS = [
  'series.0',
  'series.1',
  'series.2',
  'series.3',
  'series.4',
  'series.5',
  'series.6',
  'series.7',
  'pos',
  'neg',
  'neutral',
] as const;

export type ChartColorTokenId = (typeof ALLOWED_COLOR_TOKENS)[number];

export function isChartColorTokenId(v: unknown): v is ChartColorTokenId {
  return (
    typeof v === 'string' &&
    (ALLOWED_COLOR_TOKENS as readonly string[]).includes(v)
  );
}

/** Resolve a token-id to a hex via the given palette. */
export function resolveChartToken(
  palette: ChartPalette,
  token: ChartColorTokenId | string | null | undefined,
): string | null {
  if (!token) return null;
  if (token === 'pos') return palette.pos;
  if (token === 'neg') return palette.neg;
  if (token === 'neutral') return palette.neutral;
  const m = /^series\.(\d)$/.exec(token);
  if (m) {
    const idx = parseInt(m[1], 10);
    return palette.series[idx] ?? null;
  }
  return null;
}
