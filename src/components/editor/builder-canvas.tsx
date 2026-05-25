'use client';

// PROJ-8 / PROJ-9 / PROJ-11 — Builder canvas.
//
// PROJ-8 owned the chrome (viewport picker constraint, fallback theme
// banner, aria region label). PROJ-9 filled the body with section +
// cell rendering. PROJ-11 extracted the body into a shared
// `<CalculatorRenderer>` consumed by both the Builder and the Visitor
// surface; this canvas now wraps that renderer with builder-specific
// chrome (viewport wrapper + fallback banner) and the builder context
// providers (`InteractivityProvider mode="builder"` +
// `BuilderCalculatorStateAdapter`).

import * as React from 'react';

import {
  CalculatorRenderer,
  InteractivityProvider,
} from '@/components/calculator';
import { EmptyOrErrorState } from '@/components/shell';
import { useEditor } from '@/lib/editor/EditorProvider';
import { getTheme, getThemeIds } from '@/lib/themes';

import { BuilderCalculatorStateAdapter } from './builder-calculator-state-adapter';
import { viewportMaxWidth } from './viewport-picker';

export function BuilderCanvas() {
  const { state } = useEditor();
  const { calculator, viewportMode } = state;
  const isFallback = !getThemeIds().includes(calculator.theme_id as never);
  const theme = getTheme(calculator.theme_id);

  return (
    <div
      role="region"
      aria-label="Calculator preview"
      className="cg-force-light flex-1 overflow-auto"
      style={{ background: theme.bg }}
    >
      <div
        className="mx-auto flex h-full flex-col gap-3 p-4 md:p-6"
        style={{ maxWidth: viewportMaxWidth(viewportMode) }}
      >
        {isFallback ? <FallbackThemeBanner /> : null}
        <InteractivityProvider mode="builder">
          <BuilderCalculatorStateAdapter>
            <CalculatorRenderer />
          </BuilderCalculatorStateAdapter>
        </InteractivityProvider>
      </div>
    </div>
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
