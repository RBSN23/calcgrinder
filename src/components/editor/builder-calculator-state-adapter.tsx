'use client';

// PROJ-11 — Builder adapter: forwards `useEditor()` + `useEvaluationContext()`
// to the shared `<CalculatorStateProvider>` so editor + visitor consume
// the calculator tree via the same hook (`useCalculatorState`).

import * as React from 'react';

import {
  CalculatorStateProvider,
  type CalculatorStateValue,
} from '@/components/calculator';
import { useEditor } from '@/lib/editor/EditorProvider';
import { useEvaluationContext } from '@/lib/editor/EvaluationContext';

export function BuilderCalculatorStateAdapter({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = useEditor();
  const { inputs, setInput, results, getResult } = useEvaluationContext();
  const value = React.useMemo<CalculatorStateValue>(
    () => ({
      calculator: {
        id: state.calculator.id,
        title: state.calculator.title,
        description: state.calculator.description,
        theme_id: state.calculator.theme_id,
        updated_at: state.calculator.updated_at,
      },
      sections: state.sections,
      cells: state.cells,
      inputs,
      setInput,
      results,
      getResult,
    }),
    [state.calculator, state.sections, state.cells, inputs, setInput, results, getResult],
  );
  return (
    <CalculatorStateProvider value={value}>{children}</CalculatorStateProvider>
  );
}
