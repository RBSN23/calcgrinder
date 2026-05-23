// PROJ-9 — Theme layout-pattern catalogue.
//
// Each theme publishes an ordered list of LayoutPatterns describing the
// column layouts a maintainer may pick for a section. Every theme MUST
// publish 'single_column' (the universal fallback rendered when a
// section's stored layout_pattern_id is unknown to the active theme).
//
// `columnSpans` is the flex / grid template the renderer uses. Numbers
// are relative weights (e.g. [1, 1] = two equal-width columns,
// [2, 1] = two-thirds + one-third).

export interface LayoutPattern {
  id: string;
  displayName: string;
  description: string;
  columns: number;
  columnSpans: number[];
}

export const SINGLE_COLUMN_PATTERN: LayoutPattern = {
  id: 'single_column',
  displayName: 'Single column',
  description: 'One full-width column.',
  columns: 1,
  columnSpans: [1],
};

export const TWO_COLUMN_PATTERN: LayoutPattern = {
  id: 'two_column',
  displayName: 'Two columns',
  description: 'Two equal-width columns.',
  columns: 2,
  columnSpans: [1, 1],
};

export const TWO_THIRDS_ONE_THIRD_PATTERN: LayoutPattern = {
  id: 'two_thirds_one_third',
  displayName: 'Two-thirds + one-third',
  description: 'A wide column with a narrow sidebar.',
  columns: 2,
  columnSpans: [2, 1],
};

export const ONE_THIRD_TWO_THIRDS_PATTERN: LayoutPattern = {
  id: 'one_third_two_thirds',
  displayName: 'One-third + two-thirds',
  description: 'A narrow column with a wide main area.',
  columns: 2,
  columnSpans: [1, 2],
};

export const THREE_COLUMN_PATTERN: LayoutPattern = {
  id: 'three_column',
  displayName: 'Three columns',
  description: 'Three equal-width columns.',
  columns: 3,
  columnSpans: [1, 1, 1],
};

/**
 * Resolves a stored layout_pattern_id against a theme's published
 * catalogue, returning the matching pattern or the single_column
 * fallback when the id is missing. The caller decides whether to
 * surface the fallback banner (Builder does; visitor view does not).
 */
export function resolveLayoutPattern(
  patterns: readonly LayoutPattern[],
  storedId: string | null | undefined,
): { pattern: LayoutPattern; fellBack: boolean } {
  if (storedId != null) {
    const match = patterns.find((p) => p.id === storedId);
    if (match) return { pattern: match, fellBack: false };
  }
  const fallback =
    patterns.find((p) => p.id === SINGLE_COLUMN_PATTERN.id) ??
    SINGLE_COLUMN_PATTERN;
  return { pattern: fallback, fellBack: storedId != null };
}
