'use client';

// PROJ-12 — SaveScenarioController.
//
// Hoists the Save Scenario sheet's open / close state above the
// visitor header AND the visitor body so the header button (in
// `VisitorHeader`) and the sheet itself (mounted inside
// `PublicCalculatorPage`, where the visitor input store and scenario
// context live) can both reach it.
//
// Carries the calculator + approved-user data the sheet needs to
// branch between localStorage (anonymous) and server (registered)
// save flows.

import * as React from 'react';

import type { AvatarPopoverUser } from '@/components/shell';
import type { PublicCalculator } from '@/lib/calculators/types';

interface SaveScenarioControllerValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openSheet: () => void;
  closeSheet: () => void;
  calculator: PublicCalculator;
  approvedUser: AvatarPopoverUser | null;
}

const SaveScenarioControllerContext =
  React.createContext<SaveScenarioControllerValue | null>(null);

interface SaveScenarioControllerProps {
  calculator: PublicCalculator;
  approvedUser: AvatarPopoverUser | null;
  children: React.ReactNode;
}

export function SaveScenarioController({
  calculator,
  approvedUser,
  children,
}: SaveScenarioControllerProps) {
  const [open, setOpen] = React.useState(false);
  const openSheet = React.useCallback(() => setOpen(true), []);
  const closeSheet = React.useCallback(() => setOpen(false), []);
  const value = React.useMemo<SaveScenarioControllerValue>(
    () => ({ open, setOpen, openSheet, closeSheet, calculator, approvedUser }),
    [open, openSheet, closeSheet, calculator, approvedUser],
  );
  return (
    <SaveScenarioControllerContext.Provider value={value}>
      {children}
    </SaveScenarioControllerContext.Provider>
  );
}

/** Required hook — throws if the surrounding tree didn't mount a
 * `SaveScenarioController`. Use from the SaveScenarioSheet (always
 * inside the controller for visitor responses). */
export function useSaveScenarioController(): SaveScenarioControllerValue {
  const ctx = React.useContext(SaveScenarioControllerContext);
  if (!ctx) {
    throw new Error(
      'useSaveScenarioController must be used inside <SaveScenarioController>',
    );
  }
  return ctx;
}

/** Optional hook — returns null when not inside the controller. Used
 * by the VisitorHeader save button so it can hide on error pages
 * (404 / 410) that don't wrap with the controller. */
export function useOptionalSaveScenarioController(): SaveScenarioControllerValue | null {
  return React.useContext(SaveScenarioControllerContext);
}
