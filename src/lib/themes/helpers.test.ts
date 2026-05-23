import { describe, expect, it } from 'vitest';

import { cardSurface, labelTextStyle, numberStyle } from './helpers';
import { getTheme, getThemeIds } from './index';
import type { CardTintKind, NumberSize, ThemeId } from './types';

const KINDS: CardTintKind[] = [
  'generic',
  'inputs',
  'results',
  'chart',
  'hero',
];

const SIZES: NumberSize[] = [18, 28, 40];

describe('cardSurface', () => {
  for (const id of getThemeIds()) {
    for (const kind of KINDS) {
      it(`is stable for ${id} × ${kind}`, () => {
        expect(cardSurface(getTheme(id), kind)).toMatchSnapshot();
      });
    }
  }

  it('cardStyle:"terminal" renders flat surface regardless of kind', () => {
    // Note: no v1 theme uses cardStyle === 'terminal'. Terminal · Cyber
    // uses cardStyle === 'glow'. This test exercises the helper branch
    // via a synthetic theme so the branch is covered for future themes.
    const base = getTheme('terminal');
    const synthetic = { ...base, cardStyle: 'terminal' as const, cardTints: null };
    for (const kind of KINDS) {
      const css = cardSurface(synthetic, kind);
      expect(css.borderRadius).toBe(0);
      expect(css.boxShadow).toBe('none');
      expect(css.background).toBe(synthetic.card);
    }
  });

  it('glass theme applies cardTints[kind] for tinted kinds and backdrop filter', () => {
    const t = getTheme('bentoGlassy');
    const inputs = cardSurface(t, 'inputs');
    expect(inputs.backdropFilter).toBe('blur(20px) saturate(140%)');
    expect(inputs.WebkitBackdropFilter).toBe('blur(20px) saturate(140%)');
    if (t.cardTints) {
      expect(inputs.background).toBe(t.cardTints.inputs);
    }
  });

  it('tinted theme uses cardTints for kind-specific surfaces', () => {
    const t = getTheme('bento');
    const inputs = cardSurface(t, 'inputs');
    expect(inputs.border).toBe('none');
    if (t.cardTints) {
      expect(inputs.background).toBe(t.cardTints.inputs);
    }
  });

  it('tinted theme falls back to flat surface for generic kind', () => {
    const t = getTheme('bento');
    const generic = cardSurface(t, 'generic');
    // No tint → uses base card surface.
    expect(generic.background).toBe(t.card);
  });

  it('glow theme uses the card shadow', () => {
    const t = getTheme('vessel');
    const css = cardSurface(t, 'generic');
    expect(css.boxShadow).toBe(t.cardShadow);
    expect(css.background).toBe(t.card);
  });

  it('defaults kind to "generic"', () => {
    const t = getTheme('calcgrinder');
    expect(cardSurface(t)).toEqual(cardSurface(t, 'generic'));
  });
});

describe('labelTextStyle', () => {
  for (const id of getThemeIds()) {
    it(`is stable for ${id}`, () => {
      expect(labelTextStyle(getTheme(id))).toMatchSnapshot();
    });
  }

  it('uses theme.muted by default', () => {
    const t = getTheme('calcgrinder');
    expect(labelTextStyle(t).color).toBe(t.muted);
  });

  it('respects an explicit color override', () => {
    const t = getTheme('calcgrinder');
    expect(labelTextStyle(t, '#ff0000').color).toBe('#ff0000');
  });

  it('uses fontMono when cardStyle === "terminal" (synthetic)', () => {
    const base = getTheme('terminal');
    const synthetic = {
      ...base,
      cardStyle: 'terminal' as const,
      cardTints: null,
    };
    expect(labelTextStyle(synthetic).fontFamily).toBe(synthetic.fontMono);
  });

  it('uses inherit when cardStyle !== "terminal" (covers all v1 themes)', () => {
    for (const id of getThemeIds()) {
      // No v1 theme actually uses cardStyle === 'terminal'.
      expect(labelTextStyle(getTheme(id)).fontFamily).toBe('inherit');
    }
  });

  it('always renders uppercase', () => {
    for (const id of getThemeIds()) {
      expect(labelTextStyle(getTheme(id)).textTransform).toBe('uppercase');
    }
  });
});

describe('numberStyle', () => {
  for (const id of getThemeIds()) {
    for (const size of SIZES) {
      it(`is stable for ${id} @ size ${size}`, () => {
        expect(numberStyle(getTheme(id), size)).toMatchSnapshot();
      });
    }
  }

  it('uses fontWeight 500 when monoEverything (none of the v1 themes set this)', () => {
    const t = getTheme('calcgrinder');
    expect(numberStyle({ ...t, monoEverything: true }, 18).fontWeight).toBe(
      500,
    );
  });

  it('uses fontWeight 600 when not monoEverything', () => {
    for (const id of getThemeIds()) {
      expect(numberStyle(getTheme(id), 18).fontWeight).toBe(600);
    }
  });

  it('uses tabular-nums and lineHeight 1', () => {
    for (const id of getThemeIds()) {
      const css = numberStyle(getTheme(id), 18);
      expect(css.fontVariantNumeric).toBe('tabular-nums');
      expect(css.lineHeight).toBe(1);
    }
  });

  it('scales letterSpacing by size', () => {
    const t = getTheme('calcgrinder');
    expect(numberStyle(t, 18).letterSpacing).toBe(-0.3);
    expect(numberStyle(t, 28).letterSpacing).toBe(-0.5);
    expect(numberStyle(t, 40).letterSpacing).toBe(-1.2);
  });

  it('uses theme.fontMono and theme.ink', () => {
    for (const id of getThemeIds() as ThemeId[]) {
      const t = getTheme(id);
      const css = numberStyle(t, 28);
      expect(css.fontFamily).toBe(t.fontMono);
      expect(css.color).toBe(t.ink);
    }
  });
});
