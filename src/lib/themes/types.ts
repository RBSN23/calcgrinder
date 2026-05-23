// Calculator theme system — types
//
// Themes are self-contained, absolute (NOT App-theme adaptive) bundles of
// visual tokens that describe one calculator's look. The `Theme` type is a
// discriminated union on `cardStyle`: when `cardStyle ∈ {'tinted','glass'}`,
// `cardTints` is required (non-null); otherwise it may be `null`.
//
// See ./README.md for how to add a 9th theme.

import type { CSSProperties } from 'react';

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

  // Chart palette
  chartA: string;
  chartB: string;
  chartGrid: string;

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
