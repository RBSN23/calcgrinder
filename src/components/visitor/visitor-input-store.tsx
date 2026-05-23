'use client';

// PROJ-11 — Ephemeral visitor-input store.
//
// Holds the visitor's typed-in values keyed by cell name. Lives in
// React state for the page session only; reloading the page or
// navigating away resets every input to its calculator default
// (PROJ-11 explicitly does NOT persist visitor state — anonymous
// localStorage saves and authenticated server-side scenarios are
// PROJ-12).
//
// PROJ-12 will reuse `setInput` to seed initial values from a
// scenario when the URL carries `?s=<scenario-token>`.

import * as React from 'react';

import type { Inputs } from '@/lib/formula';

interface VisitorInputContextValue {
  inputs: Inputs;
  getInput: (name: string) => unknown;
  setInput: (name: string, value: unknown) => void;
}

const VisitorInputContext =
  React.createContext<VisitorInputContextValue | null>(null);

export function VisitorInputProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [inputs, setInputs] = React.useState<Inputs>({});

  const setInput = React.useCallback((name: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const getInput = React.useCallback(
    (name: string) => inputs[name],
    [inputs],
  );

  const value = React.useMemo<VisitorInputContextValue>(
    () => ({ inputs, getInput, setInput }),
    [inputs, getInput, setInput],
  );

  return (
    <VisitorInputContext.Provider value={value}>
      {children}
    </VisitorInputContext.Provider>
  );
}

export function useVisitorInputStore(): VisitorInputContextValue {
  const ctx = React.useContext(VisitorInputContext);
  if (!ctx) {
    throw new Error(
      'useVisitorInputStore must be used inside <VisitorInputProvider>',
    );
  }
  return ctx;
}
