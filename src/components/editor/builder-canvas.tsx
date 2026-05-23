'use client';

// PROJ-8 / PROJ-9 — Builder canvas (themed preview area).
//
// PROJ-8 owned the chrome (hero, viewport-constrained surface, fallback
// theme banner). PROJ-9 fills the body with section + cell rendering.

import * as React from 'react';

import { EmptyOrErrorState } from '@/components/shell';
import { useEditor } from '@/lib/editor/EditorProvider';
import { getTheme, getThemeIds } from '@/lib/themes';

import { CalculatorHero } from './calculator-hero';
import { SectionList } from './section-list';
import { viewportMaxWidth } from './viewport-picker';

export function BuilderCanvas() {
  const { state } = useEditor();
  const { calculator, viewportMode, sections } = state;
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
          {sections.length > 0 ? <SectionList theme={theme} /> : <EmptyBuilder />}
        </div>
      </div>
    </div>
  );
}

function EmptyBuilder() {
  return (
    <EmptyOrErrorState
      variant="empty"
      title="Add a section to get started"
      body="Use the “Add” button in the Builder toolbar to create your first section."
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
