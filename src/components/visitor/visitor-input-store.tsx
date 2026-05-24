'use client';

// PROJ-11 / PROJ-12 — Ephemeral visitor-input store with per-field
// locks, loaded-baseline tracking, and isModified derivation.
//
// Holds the visitor's typed-in values keyed by cell name. Lives in
// React state for the page session only; reloading the page or
// navigating away resets every input to its calculator default
// (anonymous localStorage saves and authenticated server-side
// scenarios are PROJ-12 — both seed `initialInputs` here on mount).
//
// PROJ-12 additions:
//   - `locks`: per-cell padlock state. Open = interactive, Closed =
//     non-interactive. URL-derived default (closed for ?s= URLs,
//     open for bare URLs) is supplied via `initialLocks`.
//   - `loadedBaseline`: the values applied at initial mount (scenario
//     values on ?s=, defaults on bare URLs). Used to derive
//     `isModified`.
//   - `reset()`: restores `inputs` to baseline AND re-applies the
//     URL-derived lock defaults. Drives the calculator-hero Reset
//     button.

import * as React from 'react';

import type { Inputs } from '@/lib/formula';
import { isInputsModifiedFromBaseline } from '@/lib/scenarios';

export type LocksMap = Record<string, boolean>;

interface VisitorInputContextValue {
  inputs: Inputs;
  getInput: (name: string) => unknown;
  setInput: (name: string, value: unknown) => void;
  locks: LocksMap;
  isLocked: (name: string) => boolean;
  toggleLock: (name: string) => void;
  loadedBaseline: Inputs;
  isModified: boolean;
  reset: () => void;
}

const VisitorInputContext =
  React.createContext<VisitorInputContextValue | null>(null);

interface VisitorInputProviderProps {
  /** Values to seed the input map with on mount (scenario apply on
   * ?s= URLs, empty `{}` on bare URLs). */
  initialInputs?: Inputs;
  /** Per-cell lock defaults. Use `defaultLocksClosed` to mass-set
   * closed for `?s=` URLs; empty `{}` means everything starts open
   * for bare URLs. */
  initialLocks?: LocksMap;
  children: React.ReactNode;
}

export function VisitorInputProvider({
  initialInputs,
  initialLocks,
  children,
}: VisitorInputProviderProps) {
  const baseline = React.useMemo<Inputs>(
    () => initialInputs ?? {},
    [initialInputs],
  );
  const baselineLocks = React.useMemo<LocksMap>(
    () => initialLocks ?? {},
    [initialLocks],
  );

  const [inputs, setInputs] = React.useState<Inputs>(baseline);
  const [locks, setLocks] = React.useState<LocksMap>(baselineLocks);

  // If the seeded baseline / locks change (e.g. parent re-mounts with
  // a different `?s=` URL), reset state to the new baseline.
  React.useEffect(() => {
    setInputs(baseline);
    setLocks(baselineLocks);
  }, [baseline, baselineLocks]);

  const setInput = React.useCallback((name: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const getInput = React.useCallback(
    (name: string) => inputs[name],
    [inputs],
  );

  const isLocked = React.useCallback(
    (name: string) => locks[name] === true,
    [locks],
  );

  const toggleLock = React.useCallback((name: string) => {
    setLocks((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const reset = React.useCallback(() => {
    setInputs(baseline);
    setLocks(baselineLocks);
  }, [baseline, baselineLocks]);

  const isModified = React.useMemo(
    () => isInputsModifiedFromBaseline(baseline, inputs),
    [baseline, inputs],
  );

  const value = React.useMemo<VisitorInputContextValue>(
    () => ({
      inputs,
      getInput,
      setInput,
      locks,
      isLocked,
      toggleLock,
      loadedBaseline: baseline,
      isModified,
      reset,
    }),
    [
      inputs,
      getInput,
      setInput,
      locks,
      isLocked,
      toggleLock,
      baseline,
      isModified,
      reset,
    ],
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

/** Optional consumer — returns null when not inside a provider. Used
 * by `CellLockToggle` so the Builder mount (no provider) silently
 * falls back to the existing edit-pencil rather than crashing. */
export function useOptionalVisitorInputStore(): VisitorInputContextValue | null {
  return React.useContext(VisitorInputContext);
}

/** Build a `LocksMap` that marks every supplied cell name as closed. */
export function defaultLocksClosed(names: Iterable<string>): LocksMap {
  const out: LocksMap = {};
  for (const n of names) out[n] = true;
  return out;
}
