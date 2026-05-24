'use client';

// PROJ-18 — CloneController.
//
// Parallels SaveScenarioController. Mounted by `/c/[token]/page.tsx`
// next to SaveScenarioController on the happy-path render so the
// header's CloneHeaderButton has the calculator + approved-user
// context it needs. Error shells (404 / 410) don't mount the
// provider, so the button vanishes automatically — same lifecycle
// pattern the Save Scenario icon uses.

import * as React from 'react';

import type { AvatarPopoverUser } from '@/components/shell';
import type { PublicCalculator } from '@/lib/calculators/types';

interface CloneControllerValue {
  calculator: PublicCalculator;
  approvedUser: AvatarPopoverUser | null;
}

const CloneControllerContext =
  React.createContext<CloneControllerValue | null>(null);

interface CloneControllerProps {
  calculator: PublicCalculator;
  approvedUser: AvatarPopoverUser | null;
  children: React.ReactNode;
}

export function CloneController({
  calculator,
  approvedUser,
  children,
}: CloneControllerProps) {
  const value = React.useMemo<CloneControllerValue>(
    () => ({ calculator, approvedUser }),
    [calculator, approvedUser],
  );
  return (
    <CloneControllerContext.Provider value={value}>
      {children}
    </CloneControllerContext.Provider>
  );
}

/** Optional hook — returns null when not inside the controller. Used
 * by the VisitorHeader Clone button so it can hide on error shells
 * (404 / 410) that don't wrap with the controller. */
export function useOptionalCloneController(): CloneControllerValue | null {
  return React.useContext(CloneControllerContext);
}
