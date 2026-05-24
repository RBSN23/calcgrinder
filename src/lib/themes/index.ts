// Calculator theme registry.
//
// Single source of truth for which themes exist. Adding a new theme:
//   1. Create `./<id>.ts` exporting a typed `Theme`.
//   2. Import it here and add it to the `THEMES` map.
//   3. Append its id to `THEME_IDS` (the registry-consistency test then
//      keeps the two in sync).
//
// See ./README.md for the full extension procedure.

import { bento } from './bento';
import { bentoGlassy } from './bento-glassy';
import { calcgrinder } from './calcgrinder';
import { calcgrinderCI } from './calcgrinder-ci';
import { editorial } from './editorial';
import { minimal } from './minimal';
import { terminal } from './terminal';
import { vessel } from './vessel';
import type { Theme, ThemeId } from './types';

const DEFAULT_THEME_ID: ThemeId = 'calcgrinder';

const THEMES: Record<ThemeId, Theme> = {
  calcgrinder,
  vessel,
  editorial,
  calcgrinderCI,
  minimal,
  bento,
  bentoGlassy,
  terminal,
};

// Ordered ids — display / iteration order. Matches PROJ-6 AC literal.
const THEME_IDS: readonly ThemeId[] = [
  'calcgrinder',
  'vessel',
  'editorial',
  'calcgrinderCI',
  'minimal',
  'bento',
  'bentoGlassy',
  'terminal',
] as const;

export function getThemeIds(): ThemeId[] {
  return [...THEME_IDS];
}

export function getDefaultThemeId(): ThemeId {
  return DEFAULT_THEME_ID;
}

/**
 * Look up a theme by id with safe fallback.
 *
 * - Known id → returns the theme, no logging.
 * - Unknown / null / undefined → returns the default theme + `console.warn`
 *   prefixed with `[theme-system]`. The lookup is read-only — no DB writes,
 *   no persisted state changes. PROJ-8's Builder banner is the user-facing
 *   signal; this warning is the deployer-facing signal.
 */
export function getTheme(id: string | null | undefined): Theme {
  if (id != null && Object.prototype.hasOwnProperty.call(THEMES, id)) {
    return THEMES[id as ThemeId];
  }
  console.warn(
    `[theme-system] Unknown theme id "${id}" — falling back to "${DEFAULT_THEME_ID}"`,
  );
  return THEMES[DEFAULT_THEME_ID];
}

export type { CardStyle, CardTintKind, CardTints, Theme, ThemeId } from './types';
export {
  ONE_THIRD_TWO_THIRDS_PATTERN,
  SINGLE_COLUMN_PATTERN,
  THREE_COLUMN_PATTERN,
  TWO_COLUMN_PATTERN,
  TWO_THIRDS_ONE_THIRD_PATTERN,
  resolveLayoutPattern,
} from './layout-patterns';
export type { LayoutPattern } from './layout-patterns';
export {
  bento,
  bentoGlassy,
  calcgrinder,
  calcgrinderCI,
  editorial,
  minimal,
  terminal,
  vessel,
};
export { cardSurface, labelTextStyle, numberStyle } from './helpers';
export { ThemeSwatch } from './ThemeSwatch';
export {
  ALLOWED_COLOR_TOKENS,
  deriveChartPalette,
  isChartColorTokenId,
  resolveChartToken,
  type ChartColorTokenId,
} from './derive-chart-palette';
export type { ChartPalette } from './types';
