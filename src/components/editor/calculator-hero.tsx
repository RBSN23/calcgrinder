'use client';

// PROJ-9 / PROJ-10 / PROJ-11 — Calculator hero (shared by Builder and
// Visitor). Reads title / description / theme from the shared
// `useCalculatorState()` context; the editable inputs are mounted only
// when `useInteractivity() === 'builder'`. In visitor mode the hero
// renders plain heading + paragraph elements.

import * as React from 'react';

import {
  useCalculatorState,
  useIsBuilder,
} from '@/components/calculator';
import { useEditor } from '@/lib/editor/EditorProvider';
import { MAX_TITLE_LENGTH, validateTitle } from '@/lib/calculators/types';
import { cardSurface, getTheme } from '@/lib/themes';

import { EditableText } from './editable-text';

const TITLE_TAKEN_MESSAGE = 'A calculator with this title already exists.';
const TITLE_REQUIRED_MESSAGE = 'Title is required.';
const TITLE_TOO_LONG_MESSAGE = `Titles can be at most ${MAX_TITLE_LENGTH} characters.`;

export function CalculatorHero() {
  const { calculator } = useCalculatorState();
  const theme = getTheme(calculator.theme_id);
  const heroSurface = cardSurface(theme, 'hero');
  const heroColor = theme.cardTints?.heroFg ?? theme.ink;
  const isBuilder = useIsBuilder();

  return (
    <header
      style={{
        ...heroSurface,
        padding: theme.padding,
        fontFamily: theme.font,
      }}
      className="flex w-full flex-col gap-2"
    >
      {isBuilder ? (
        <BuilderHeroEditors heroColor={heroColor} themeUppercase={theme.uppercase} themeFont={theme.font} />
      ) : (
        <VisitorHeroDisplay
          title={calculator.title}
          description={calculator.description}
          heroColor={heroColor}
          themeUppercase={theme.uppercase}
          themeFont={theme.font}
        />
      )}
    </header>
  );
}

interface VisitorHeroDisplayProps {
  title: string;
  description: string;
  heroColor: string;
  themeUppercase: boolean | undefined;
  themeFont: string;
}

function VisitorHeroDisplay({
  title,
  description,
  heroColor,
  themeUppercase,
  themeFont,
}: VisitorHeroDisplayProps) {
  return (
    <>
      <h1
        style={{
          color: heroColor,
          fontFamily: themeFont,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: themeUppercase ? 1 : -0.4,
          textTransform: themeUppercase ? 'uppercase' : 'none',
          lineHeight: 1.15,
        }}
      >
        {title}
      </h1>
      {description ? (
        <p
          style={{
            color: heroColor,
            fontFamily: themeFont,
            fontSize: 14,
            lineHeight: 1.45,
            opacity: 0.85,
            whiteSpace: 'pre-wrap',
          }}
        >
          {description}
        </p>
      ) : null}
    </>
  );
}

interface BuilderHeroEditorsProps {
  heroColor: string;
  themeUppercase: boolean | undefined;
  themeFont: string;
}

function BuilderHeroEditors({
  heroColor,
  themeUppercase,
  themeFont,
}: BuilderHeroEditorsProps) {
  const { state, renameCalculatorChecked, setDescription } = useEditor();
  const title = state.calculator.title;
  const description = state.calculator.description;
  return (
    <>
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
              fontFamily: themeFont,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: themeUppercase ? 1 : -0.4,
              textTransform: themeUppercase ? 'uppercase' : 'none',
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
              fontFamily: themeFont,
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
    </>
  );
}
