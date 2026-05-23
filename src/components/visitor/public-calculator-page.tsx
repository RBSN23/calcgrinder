'use client';

// PROJ-11 — Public calculator page body.
//
// Wraps the shared `<CalculatorRenderer>` (refactored PROJ-9 components)
// with the visitor providers: `InteractivityProvider mode="visitor"`,
// `<VisitorInputProvider>` for ephemeral input overrides, and the
// `<VisitorCalculatorStateAdapter>` that exposes the static public
// payload + the live input map via the shared `useCalculatorState()`
// hook. Edit affordances (hover pencil, drag handle, "+ Add" buttons,
// section toolbar, hidden-cell dot, EditableText) short-circuit at
// their tops because `useIsBuilder()` returns `false`.

import * as React from 'react';

import {
  CalculatorRenderer,
  InteractivityProvider,
} from '@/components/calculator';
import type { PublicCalculator } from '@/lib/calculators/types';

import { VisitorCalculatorStateAdapter } from './visitor-calculator-state-adapter';
import { VisitorInputProvider } from './visitor-input-store';

interface PublicCalculatorPageProps {
  calculator: PublicCalculator;
}

export function PublicCalculatorPage({ calculator }: PublicCalculatorPageProps) {
  return (
    <InteractivityProvider mode="visitor">
      <VisitorInputProvider>
        <VisitorCalculatorStateAdapter calculator={calculator}>
          <div className="flex-1 overflow-auto bg-cg-bg">
            <div className="mx-auto flex h-full max-w-[1200px] flex-col gap-3 p-4 md:p-6">
              <CalculatorRenderer />
            </div>
          </div>
        </VisitorCalculatorStateAdapter>
      </VisitorInputProvider>
    </InteractivityProvider>
  );
}
