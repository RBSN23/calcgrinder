// Pure helpers: theme tokens → React CSSProperties.
//
// These are the side-effect-free primitives PROJ-11's visitor renderer
// (and PROJ-8's Builder preview) will compose against. Inline `style`
// objects are intentional here — see PROJ-6 spec for the architectural
// exception to .claude/rules/frontend.md's no-inline-style rule.

import type {
  CardTintKind,
  CardTints,
  CSSProperties,
  NumberSize,
  Theme,
} from './types';

function tintFor(theme: Theme, kind: CardTintKind): string | undefined {
  if (!theme.cardTints) return undefined;
  if (kind === 'generic') return undefined;
  return (theme.cardTints as CardTints)[kind];
}

export function cardSurface(
  theme: Theme,
  kind: CardTintKind = 'generic',
): CSSProperties {
  if (theme.cardStyle === 'terminal') {
    return {
      background: theme.card,
      border: `1px solid ${theme.border}`,
      borderRadius: 0,
      boxShadow: 'none',
    };
  }
  if (theme.cardStyle === 'glass') {
    const tint = tintFor(theme, kind);
    return {
      background: tint ?? theme.card,
      border: `1px solid ${theme.borderStr}`,
      borderRadius: theme.radius,
      boxShadow: theme.cardShadow,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
    };
  }
  if (theme.cardStyle === 'tinted') {
    const tint = tintFor(theme, kind);
    if (tint) {
      return {
        background: tint,
        border: 'none',
        borderRadius: theme.radius,
        boxShadow: theme.cardShadow,
      };
    }
    // Fall through to flat default for generic kinds on tinted themes.
  }
  return {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius,
    boxShadow: theme.cardShadow,
  };
}

export function labelTextStyle(
  theme: Theme,
  color?: string,
): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    color: color ?? theme.muted,
    letterSpacing: theme.uppercase ? 1.2 : 0.6,
    textTransform: 'uppercase',
    fontFamily: theme.cardStyle === 'terminal' ? theme.fontMono : 'inherit',
  };
}

export function numberStyle(theme: Theme, size: NumberSize): CSSProperties {
  return {
    fontFamily: theme.fontMono,
    fontSize: size,
    fontWeight: theme.monoEverything ? 500 : 600,
    color: theme.ink,
    letterSpacing: size > 30 ? -1.2 : size > 20 ? -0.5 : -0.3,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  };
}
