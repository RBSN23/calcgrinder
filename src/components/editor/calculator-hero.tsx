'use client';

// PROJ-8 — Calculator hero (read-only in PROJ-8; PROJ-9 adds the
// hover-edit affordance + description block on the same subcomponent).

import * as React from 'react';

import { cardSurface, getTheme } from '@/lib/themes';

interface CalculatorHeroProps {
  themeId: string;
  title: string;
}

export function CalculatorHero({ themeId, title }: CalculatorHeroProps) {
  const theme = getTheme(themeId);
  const heroSurface = cardSurface(theme, 'hero');

  return (
    <header
      style={{
        ...heroSurface,
        padding: theme.padding,
        fontFamily: theme.font,
      }}
      className="flex w-full flex-col gap-1"
    >
      <h1
        style={{
          color: theme.cardTints?.heroFg ?? theme.ink,
          fontFamily: theme.font,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: theme.uppercase ? 1 : -0.4,
          textTransform: theme.uppercase ? 'uppercase' : 'none',
          lineHeight: 1.15,
        }}
      >
        {title || 'Untitled calculator'}
      </h1>
    </header>
  );
}
