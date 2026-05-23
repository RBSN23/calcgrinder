'use client';

// PROJ-11 — Interactivity mode boundary.
//
// Single source of truth for whether the rendering tree is editable
// (the Builder canvas) or read-only (the public /c/<token> view).
// Edit-affordance components (hover pencil, drag handle, toolbar,
// "+ Add" picker, hidden-cell dot, section delete menu, EditableText,
// etc.) read this once at their top and short-circuit to `null` for
// the wrong mode — no per-leaf `if (visitor)` branches.
//
// The default (no provider) is 'builder' so any test that mounts a
// component outside a provider preserves the pre-refactor behaviour.

import * as React from 'react';

export type InteractivityMode = 'builder' | 'visitor';

const InteractivityContext = React.createContext<InteractivityMode>('builder');

export function InteractivityProvider({
  mode,
  children,
}: {
  mode: InteractivityMode;
  children: React.ReactNode;
}) {
  return (
    <InteractivityContext.Provider value={mode}>
      {children}
    </InteractivityContext.Provider>
  );
}

export function useInteractivity(): InteractivityMode {
  return React.useContext(InteractivityContext);
}

export function useIsBuilder(): boolean {
  return useInteractivity() === 'builder';
}

export function useIsVisitor(): boolean {
  return useInteractivity() === 'visitor';
}
