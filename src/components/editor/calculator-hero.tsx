'use client';

// PROJ-9 / PROJ-10 — Calculator hero with hover-edit affordance for
// title + description. Title rename uses the checked variant that
// surfaces `title_taken` inline (per-user uniqueness constraint
// landed in PROJ-10); description still uses the fire-and-forget
// path. Both commits enroll in undo / redo via the editor store.

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';
import { MAX_TITLE_LENGTH, validateTitle } from '@/lib/calculators/types';
import { cardSurface, getTheme } from '@/lib/themes';

import { EditableText } from './editable-text';

interface CalculatorHeroProps {
  themeId: string;
  title: string;
}

const TITLE_TAKEN_MESSAGE = 'A calculator with this title already exists.';
const TITLE_REQUIRED_MESSAGE = 'Title is required.';
const TITLE_TOO_LONG_MESSAGE = `Titles can be at most ${MAX_TITLE_LENGTH} characters.`;

export function CalculatorHero({ themeId, title }: CalculatorHeroProps) {
  const { state, renameCalculatorChecked, setDescription } = useEditor();
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
        onCommit={async (next) => {
          const result = await renameCalculatorChecked(next);
          if (result.ok) return { ok: true };
          if (result.code === 'title_taken') {
            return { ok: false, error: TITLE_TAKEN_MESSAGE };
          }
          if (result.code === 'title_required') {
            return { ok: false, error: TITLE_REQUIRED_MESSAGE };
          }
          if (result.code === 'title_too_long') {
            return { ok: false, error: TITLE_TOO_LONG_MESSAGE };
          }
          // Stale-write or unknown error — the store already toasted.
          return { ok: true };
        }}
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
