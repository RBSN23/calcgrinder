import type { CSSProperties } from 'react';

import { cardSurface } from './helpers';
import type { Theme } from './types';

interface ThemeSwatchProps {
  theme: Theme;
  /** Outer square size in px. Defaults to 56. */
  size?: number;
  /** Optional className for layout integration. */
  className?: string;
}

function initialsFor(theme: Theme): string {
  // Derive 1–2 character initials from the theme displayName, e.g.
  // "Calcgrinder · Light" → "CL", "Vessel" → "V". Falls back to the
  // first two letters of the id if no caps are found.
  const parts = theme.displayName
    .split(/[\s·.\-/]+/u)
    .filter(Boolean)
    .map((p) => p.charAt(0));
  const initials = parts.slice(0, 2).join('').toUpperCase();
  if (initials) return initials;
  return theme.id.slice(0, 2).toUpperCase();
}

/**
 * Pure preview tile for a calculator theme. No state, no effects, no DOM
 * subscriptions — safe to render on the server. Designed to drop into a
 * dropdown row alongside the theme's `displayName`.
 */
export function ThemeSwatch({ theme, size = 56, className }: ThemeSwatchProps) {
  const outerStyle: CSSProperties = {
    width: size,
    height: size,
    background: theme.bg,
    borderRadius: Math.min(theme.radius, 10),
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: theme.font,
  };

  const innerPad = Math.max(4, Math.round(size * 0.12));
  const innerStyle: CSSProperties = {
    ...cardSurface(theme, 'generic'),
    position: 'absolute',
    inset: innerPad,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${Math.max(4, Math.round(size * 0.14))}px`,
    overflow: 'hidden',
  };

  const accentStyle: CSSProperties = {
    width: Math.max(6, Math.round(size * 0.14)),
    height: Math.max(6, Math.round(size * 0.14)),
    borderRadius: '50%',
    background: theme.accent,
    flexShrink: 0,
  };

  const labelStyle: CSSProperties = {
    fontFamily: theme.font,
    fontSize: Math.max(9, Math.round(size * 0.2)),
    fontWeight: 600,
    color: theme.ink,
    letterSpacing: theme.uppercase ? 1 : -0.2,
    textTransform: theme.uppercase ? 'uppercase' : 'none',
    lineHeight: 1,
  };

  return (
    <div
      className={className}
      style={outerStyle}
      role="img"
      aria-label={`${theme.displayName} theme preview`}
      data-theme-id={theme.id}
    >
      <div style={innerStyle}>
        <span style={accentStyle} aria-hidden="true" />
        <span style={labelStyle}>{initialsFor(theme)}</span>
      </div>
    </div>
  );
}
