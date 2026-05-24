// PROJ-15 — Server-side chart field validation.
//
// Mirrors the helpers in `@/lib/cells/validation.ts`. Encodes the rules the
// database CHECK constraints + RESERVED_WORDS + ALLOWED_COLOR_TOKENS lists
// enforce, mapping invalid bodies to AC-specified HTTP error shapes.

import { RESERVED_WORDS } from '@/lib/formula';
import { ALLOWED_COLOR_TOKENS } from '@/lib/themes';

import {
  BINDINGS_SCHEMA,
  type ChartBindings,
} from './bindings';
import {
  CHART_NAME_PATTERN,
  MAX_CHART_SUBTITLE_LENGTH,
  MAX_CHART_TITLE_LENGTH,
  type ChartType,
} from './types';

export type ChartValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

export function validateChartNameField(name: string): ChartValidationResult {
  if (!CHART_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'name_invalid',
        pattern_description:
          'Lowercase letters, digits, and underscores only. Must start with a letter. Max 40 chars.',
      },
    };
  }
  if (RESERVED_WORDS.includes(name)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'name_reserved', reserved_word: name },
    };
  }
  return { ok: true };
}

export function validateTitleField(value: string): ChartValidationResult {
  if (value.length > MAX_CHART_TITLE_LENGTH) {
    return {
      ok: false,
      status: 400,
      body: { error: 'title_too_long', max: MAX_CHART_TITLE_LENGTH },
    };
  }
  return { ok: true };
}

export function validateSubtitleField(value: string): ChartValidationResult {
  if (value.length > MAX_CHART_SUBTITLE_LENGTH) {
    return {
      ok: false,
      status: 400,
      body: { error: 'subtitle_too_long', max: MAX_CHART_SUBTITLE_LENGTH },
    };
  }
  return { ok: true };
}

/**
 * Parse + validate a bindings JSON object against the type-specific Zod
 * schema. Coerces defaults (via Zod's `.default(...)`), rejects unknown
 * `color_token_id` values, and surfaces the validation failure as a 400.
 */
export function validateBindings(
  chart_type: ChartType,
  raw: unknown,
): { ok: true; value: ChartBindings } | { ok: false; status: number; body: Record<string, unknown> } {
  const schema = BINDINGS_SCHEMA[chart_type];
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Look for a color_token_id violation specifically to surface the
    // AC-required 400 `color_token_invalid` error shape.
    const tokenIssue = parsed.error.issues.find((iss) =>
      iss.path.some((p) => p === 'color_token_id'),
    );
    if (tokenIssue) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'color_token_invalid',
          allowed_tokens: ALLOWED_COLOR_TOKENS,
        },
      };
    }
    return {
      ok: false,
      status: 400,
      body: { error: 'bindings_invalid' },
    };
  }
  return { ok: true, value: parsed.data as ChartBindings };
}
