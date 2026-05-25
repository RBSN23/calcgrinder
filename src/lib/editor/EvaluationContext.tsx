'use client';

// PROJ-9 — Editor-wide evaluation context.
//
// Holds the in-Builder input scratch values keyed by cell name. Output
// cells consume the precomputed evaluation map to render their value
// previews. Inputs are NOT persisted — they live for the editor session
// only (visitor scenarios are PROJ-12's concern).

import * as React from 'react';

import { useEditor } from './EditorProvider';
import { useWorkerEvaluation } from './useWorkerEvaluation';
import type { CellResult, EvaluationResult, Inputs } from '@/lib/formula';

interface EvaluationContextValue {
  inputs: Inputs;
  setInput: (name: string, value: unknown) => void;
  results: EvaluationResult;
  getResult: (name: string) => CellResult | undefined;
}

const EvaluationContext = React.createContext<EvaluationContextValue | null>(null);

export function EvaluationProvider({ children }: { children: React.ReactNode }) {
  const { state } = useEditor();
  const [inputs, setInputs] = React.useState<Inputs>({});

  const setInput = React.useCallback((name: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const results = useWorkerEvaluation(state.cells, inputs);
  const getResult = React.useCallback(
    (name: string) => results[name],
    [results],
  );

  const value = React.useMemo<EvaluationContextValue>(
    () => ({ inputs, setInput, results, getResult }),
    [inputs, setInput, results, getResult],
  );

  return <EvaluationContext.Provider value={value}>{children}</EvaluationContext.Provider>;
}

export function useEvaluationContext(): EvaluationContextValue {
  const ctx = React.useContext(EvaluationContext);
  if (!ctx) {
    throw new Error('useEvaluationContext must be used inside <EvaluationProvider>');
  }
  return ctx;
}
