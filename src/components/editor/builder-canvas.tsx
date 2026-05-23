'use client';

// PROJ-8 — Builder canvas (themed preview area).
//
// Wraps the calculator hero, the polymorphic slot renderer (empty in PROJ-8),
// and the "Add cells to get started" empty-state card. Constrained by the
// session-scoped viewport mode from the editor reducer.

import * as React from 'react';

import { EmptyOrErrorState } from '@/components/shell';
import { useEditor } from '@/lib/editor/EditorProvider';
import { getTheme, getThemeIds } from '@/lib/themes';

import { CalculatorHero } from './calculator-hero';
import { SlotRenderer, type DisplayElement } from './slot-renderer';
import { viewportMaxWidth } from './viewport-picker';

const EMPTY_ELEMENTS: DisplayElement[] = [];

export function BuilderCanvas() {
  const { state } = useEditor();
  const { calculator, viewportMode } = state;
  const theme = getTheme(calculator.theme_id);
  const isFallback = !getThemeIds().includes(calculator.theme_id as never);

  return (
    <div
      role="region"
      aria-label="Calculator preview"
      className="flex-1 overflow-auto bg-cg-bg"
    >
      <div className="mx-auto flex h-full flex-col gap-3 p-6" style={{ maxWidth: viewportMaxWidth(viewportMode) }}>
        {isFallback ? <FallbackThemeBanner /> : null}
        <div
          style={{
            background: theme.bg,
            color: theme.text,
            fontFamily: theme.font,
            borderRadius: theme.radius,
            border: `1px solid ${theme.border}`,
            padding: theme.padding,
          }}
          className="flex flex-col gap-4"
        >
          <CalculatorHero themeId={calculator.theme_id} title={calculator.title} />
          <SlotRenderer elements={EMPTY_ELEMENTS} />
          <EmptyBuilder />
        </div>
      </div>
    </div>
  );
}

function EmptyBuilder() {
  return (
    <EmptyOrErrorState
      variant="empty"
      title="Add cells to get started"
      body="This calculator has no cells yet. Use the “Add” button in the Builder toolbar to add the first input."
    />
  );
}

export function FallbackThemeBanner() {
  return (
    <EmptyOrErrorState
      variant="error"
      framed={false}
      title="Theme no longer available"
      body="This calculator's theme is no longer available — using Calcgrinder · Light. Pick a new theme to dismiss."
    />
  );
}
