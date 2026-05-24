'use client';

// PROJ-11 — Shared calculator renderer.
//
// Single render pipeline used by BOTH the Builder canvas (PROJ-8 / PROJ-9)
// and the Visitor view (PROJ-11). The same JSX renders on both surfaces;
// edit affordances are short-circuited by `useInteractivity() === 'visitor'`
// at each affordance's top, not by per-leaf branches inside this tree.
//
// The renderer reads its display data from `useCalculatorState()` and
// renders the themed surface containing the hero + section list. The
// Builder wraps this with viewport-picker chrome + fallback-theme banner;
// the Visitor wraps it with the public layout chrome. The renderer
// itself is shell-agnostic.

import * as React from 'react';

import { CalculatorHero } from '@/components/editor/calculator-hero';
import { SectionList } from '@/components/editor/section-list';
import { EmptyOrErrorState } from '@/components/shell';
import { getTheme } from '@/lib/themes';

import { useCalculatorState } from './calculator-state-context';
import { useIsBuilder } from './interactivity-context';

interface CalculatorRendererProps {
  /** PROJ-12 — Optional slot rendered between the hero and the first
   * section. The visitor surface uses this for the scenario header
   * block + structure-drift banner. Default: no slot. */
  afterHero?: React.ReactNode;
}

export function CalculatorRenderer({ afterHero }: CalculatorRendererProps = {}) {
  const { calculator, sections } = useCalculatorState();
  const theme = getTheme(calculator.theme_id);
  const isBuilder = useIsBuilder();

  return (
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
      <CalculatorHero />
      {afterHero}
      {sections.length > 0 ? (
        <SectionList theme={theme} />
      ) : isBuilder ? (
        <EmptyOrErrorState
          variant="empty"
          title="Add a section to get started"
          body="Use the “Add” button in the Builder toolbar to create your first section."
        />
      ) : null}
    </div>
  );
}
