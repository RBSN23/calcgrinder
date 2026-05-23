'use client';

// PROJ-9 — Calculator hero with hover-edit affordance for title +
// description. Both commits route through the editor store
// (renameCalculator / setDescription) so they enroll in undo / redo.

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';
import { validateTitle } from '@/lib/calculators/types';
import { cardSurface, getTheme } from '@/lib/themes';

import { EditableText } from './editable-text';

interface CalculatorHeroProps {
  themeId: string;
  title: string;
}

export function CalculatorHero({ themeId, title }: CalculatorHeroProps) {
  const { state, renameCalculator, setDescription } = useEditor();
  const theme = getTheme(themeId);
  const heroSurface = cardSurface(theme, 'hero');
  const heroColor = theme.cardTints?.heroFg ?? theme.ink;
  const description = state.calculator.description;

  return (
    <header
      style={{
        ...heroSurface,
        padding: theme.padding,
        fontFamily: theme.font,
      }}
      className="flex w-full flex-col gap-2"
    >
      <EditableText
        value={title}
        placeholder="Untitled calculator"
        ariaLabel="Calculator title"
        maxLength={100}
        validate={(next) => ({ ok: validateTitle(next).ok })}
        onCommit={(next) => renameCalculator(next)}
        renderResting={({ displayValue, isPlaceholder }) => (
          <h1
            style={{
              color: heroColor,
              fontFamily: theme.font,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: theme.uppercase ? 1 : -0.4,
              textTransform: theme.uppercase ? 'uppercase' : 'none',
              lineHeight: 1.15,
              opacity: isPlaceholder ? 0.5 : 1,
            }}
          >
            {displayValue}
          </h1>
        )}
        inputClassName="w-full font-bold tracking-tight"
      />
      <EditableText
        value={description}
        placeholder="Add a short description"
        ariaLabel="Calculator description"
        multiline
        onCommit={(next) => setDescription(next)}
        renderResting={({ displayValue, isPlaceholder }) => (
          <p
            style={{
              color: heroColor,
              fontFamily: theme.font,
              fontSize: 14,
              lineHeight: 1.45,
              opacity: isPlaceholder ? 0.5 : 0.85,
              whiteSpace: 'pre-wrap',
            }}
            className={isPlaceholder ? 'italic' : ''}
          >
            {displayValue}
          </p>
        )}
        inputClassName="w-full text-sm"
      />
    </header>
  );
}
