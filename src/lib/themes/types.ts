// Calculator theme system — types
//
// Themes are self-contained, absolute (NOT App-theme adaptive) bundles of
// visual tokens that describe one calculator's look. The `Theme` type is a
// discriminated union on `cardStyle`: when `cardStyle ∈ {'tinted','glass'}`,
// `cardTints` is required (non-null); otherwise it may be `null`.
//
// See ./README.md for how to add a 9th theme.

import type { CSSProperties } from 'react';

import type { ChartPalette } from './derive-chart-palette';
import type { LayoutPattern } from './layout-patterns';

export type ThemeId =
  | 'calcgrinder'
  | 'vessel'
  | 'editorial'
  | 'calcgrinderCI'
  | 'minimal'
  | 'bento'
  | 'bentoGlassy'
  | 'terminal';

export type CardStyle = 'flat' | 'glow' | 'tinted' | 'glass' | 'terminal';

export type CardTintKind = 'generic' | 'inputs' | 'results' | 'chart' | 'hero';

export type NumberSize = 18 | 28 | 40;

export interface CardTints {
  inputs: string;
  results: string;
  chart: string;
  hero: string;
  heroFg: string;
}

interface ThemeBase {
  id: ThemeId;
  displayName: string;
  description: string;

  // Typography
  font: string;
  fontMono: string;

  // Surface colours
  bg: string;
  surface: string;
  card: string;
  cardAlt: string;
  border: string;
  borderStr: string;
  rule: string;

  // Text colours
  ink: string;
  text: string;
  muted: string;
  subtle: string;

  // Accent
  accent: string;
  accentFg: string;
  accentSoft: string;

  // Chart palette (primitives — retained for backward-compat with PROJ-6
  // consumers that haven't migrated to chartPalette).
  chartA: string;
  chartB: string;
  chartGrid: string;

  // PROJ-15 — Chart palette bundle: 8-stop series, 6-stop heat ramp,
  // positive/negative semantic pair (+ soft variants), neutral fill.
  chartPalette: ChartPalette;

  // Shape
  radius: number;
  fieldRadius: number;
  padding: number;
  headerH: number;
  cardShadow: string;

  // Layout
  cols2: string;
  cols3: string;

  // Cosmetics (all optional — only some themes set them)
  brandColor?: string;
  glowRgba?: string;
  uppercase?: boolean;
  monoEverything?: boolean;

  // PROJ-9 — Layout-pattern catalogue. Every theme MUST publish at least
  // 'single_column'; richer themes add multi-column patterns. The Builder
  // reads this when rendering a section; an unknown stored id falls back
  // to single_column with an inline banner.
  layoutPatterns: readonly LayoutPattern[];
}

// `tinted` / `glass` MUST carry cardTints. Everything else MAY set
// `cardTints: null`. This is enforced by the build via the discriminated
// union below.
export type Theme =
  | (ThemeBase & {
      cardStyle: 'tinted' | 'glass';
      cardTints: CardTints;
    })
  | (ThemeBase & {
      cardStyle: 'flat' | 'glow' | 'terminal';
      cardTints: null;
    });

export type { CSSProperties };
export type { ChartPalette } from './derive-chart-palette';
