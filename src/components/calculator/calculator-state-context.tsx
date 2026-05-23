'use client';

// PROJ-11 — Generic read-only calculator-state context.
//
// The shared <CalculatorRenderer> consumes this context exclusively
// for display data. Both the Builder (PROJ-9) and the Visitor view
// (PROJ-11) provide it from their own state stores:
//
//   - Builder → <BuilderCalculatorStateAdapter> forwards from
//     `useEditor()` + `useEvaluationContext()`.
//   - Visitor → <VisitorCalculatorStateAdapter> forwards from a
//     static `PublicCalculator` payload + `<VisitorInputProvider>`.
//
// Edit mutations (patchCell, addCell, addSection, removeSection,
// etc.) are NOT exposed here. They live on `useEditor()` and are
// only callable from edit-affordance components rendered when
// `useInteractivity() === 'builder'`.

import * as React from 'react';

import type { CellRow } from '@/lib/cells/types';
import type { SectionRow } from '@/lib/sections/types';
import type { CellResult, EvaluationResult, Inputs } from '@/lib/formula';

export interface CalculatorStateCalculator {
  id: string;
  title: string;
  description: string;
  theme_id: string;
  updated_at: string;
}

export interface CalculatorStateValue {
  calculator: CalculatorStateCalculator;
  sections: SectionRow[];
  cells: CellRow[];
  inputs: Inputs;
  setInput: (name: string, value: unknown) => void;
  results: EvaluationResult;
  getResult: (name: string) => CellResult | undefined;
}

const CalculatorStateContext =
  React.createContext<CalculatorStateValue | null>(null);

export function CalculatorStateProvider({
  value,
  children,
}: {
  value: CalculatorStateValue;
  children: React.ReactNode;
}) {
  return (
    <CalculatorStateContext.Provider value={value}>
      {children}
    </CalculatorStateContext.Provider>
  );
}

export function useCalculatorState(): CalculatorStateValue {
  const ctx = React.useContext(CalculatorStateContext);
  if (!ctx) {
    throw new Error(
      'useCalculatorState must be used inside <CalculatorStateProvider> ' +
        '(BuilderCanvas or PublicCalculatorPage)',
    );
  }
  return ctx;
}
