// PROJ-15 — Chart limits. Canonical source of truth; PROJ-17 (Tabular) and
// future perf passes import from here rather than redefining.

/** Per-series cap. Series longer than this truncate to first 500 + notice. */
export const CHART_MAX_POINTS = 500;

/** Per-chart cap on series count for multi-series chart types. */
export const CHART_MAX_SERIES = 8;

/** 2D cap (rows × columns) for the Heatmap renderer. Exceeded → placeholder, no partial render. */
export const CHART_MAX_HEATMAP_CELLS = 500;

/** Per-calculator cap on chart count. */
export const MAX_CHARTS = 30;

/** Single shared animation duration in ms (PROJ-15 hard-codes 300ms ease-out). */
export const CHART_ANIMATION_MS = 300;
