import { describe, expect, it } from 'vitest';

import { getTheme, getThemeIds } from './index';

const ALLOWED_VARS = new Set([
  '--font-geist-sans',
  '--font-geist-mono',
]);

const FONT_FIELDS = new Set(['font', 'fontMono']);

function findVarReferences(value: string): string[] {
  const matches = value.match(/var\(\s*(--[a-zA-Z0-9_-]+)/g) ?? [];
  return matches.map((m) => m.replace(/^var\(\s*/, ''));
}

describe('theme self-containment', () => {
  it.each(getThemeIds())(
    '%s only references --font-geist-* CSS variables (and only inside font / fontMono)',
    (id) => {
      const theme = getTheme(id);
      for (const [field, value] of Object.entries(theme)) {
        if (typeof value !== 'string') continue;
        const refs = findVarReferences(value);
        if (refs.length === 0) continue;
        // CSS variables are only allowed in font/fontMono.
        expect(
          FONT_FIELDS.has(field),
          `theme.${field} on "${id}" references a CSS variable: ${refs.join(', ')}`,
        ).toBe(true);
        for (const ref of refs) {
          expect(
            ALLOWED_VARS.has(ref),
            `theme.${field} on "${id}" references disallowed variable ${ref}`,
          ).toBe(true);
        }
      }
    },
  );

  it.each(getThemeIds())(
    '%s replaces literal "Geist" / "Geist Mono" with CSS variables',
    (id) => {
      const theme = getTheme(id);
      // The bare quoted strings "Geist" and "Geist Mono" must NOT appear
      // in font fields — they were replaced with var(--font-geist-sans)
      // and var(--font-geist-mono) respectively.
      expect(theme.font).not.toMatch(/"Geist"/);
      expect(theme.fontMono).not.toMatch(/"Geist"/);
      expect(theme.fontMono).not.toMatch(/"Geist Mono"/);
      expect(theme.font).toMatch(/var\(--font-geist-(sans|mono)\)/);
      expect(theme.fontMono).toMatch(/var\(--font-geist-mono\)/);
    },
  );

  it.each(getThemeIds())('%s strips mortgage-mock fields', (id) => {
    const theme = getTheme(id) as unknown as Record<string, unknown>;
    expect(theme.titleLabel).toBeUndefined();
    expect(theme.title).toBeUndefined();
    expect(theme.subtitle).toBeUndefined();
  });

  it.each(getThemeIds())(
    '%s carries id / displayName / description',
    (id) => {
      const theme = getTheme(id);
      expect(theme.id).toBe(id);
      expect(theme.displayName).toBeTruthy();
      expect(theme.description).toBeTruthy();
    },
  );

  it('tinted and glass themes carry a complete cardTints object', () => {
    for (const id of getThemeIds()) {
      const theme = getTheme(id);
      if (theme.cardStyle === 'tinted' || theme.cardStyle === 'glass') {
        expect(theme.cardTints).not.toBeNull();
        if (theme.cardTints) {
          expect(theme.cardTints.inputs).toBeTruthy();
          expect(theme.cardTints.results).toBeTruthy();
          expect(theme.cardTints.chart).toBeTruthy();
          expect(theme.cardTints.hero).toBeTruthy();
          expect(theme.cardTints.heroFg).toBeTruthy();
        }
      }
    }
  });
});
