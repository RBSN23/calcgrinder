'use client';

// PROJ-12 — Scenario presentation context.
//
// The visitor surface uses this when a `?s=<token>` URL has resolved
// to a scenario row. Components that need scenario-aware behaviour
// (header block, drift banner, copy-link button, unsaved-changes
// guard) read from it. Bare `/c/<token>` URLs simply don't mount the
// provider — `useScenario()` returns null.

import * as React from 'react';

export interface ScenarioInfo {
  /** Server scenario row id. Used by the share-token mint endpoint
   * and the owner Copy-link button. */
  id: string;
  title: string;
  description: string;
  ownerName: string;
  /** ISO timestamp of last save. Powers the "saved <relative>"
   * sub-line on the scenario header. */
  updatedAt: string;
  /** True when the signed-in session belongs to the scenario's owner.
   * Drives the visibility of the Copy link button on the header. */
  isOwner: boolean;
  /** True when at least one saved value was skipped due to
   * rename / removal / type-change drift. */
  hasDrift: boolean;
}

interface ScenarioContextValue extends ScenarioInfo {
  /** Most-recently-known share token. Starts at the server-returned
   * value (may be null pre-mint). Updated when the owner presses
   * Copy link and the lazy-mint resolves. */
  shareToken: string | null;
  setShareToken: (token: string) => void;
}

const ScenarioContext = React.createContext<ScenarioContextValue | null>(null);

interface ScenarioProviderProps {
  scenario: ScenarioInfo;
  initialShareToken: string | null;
  children: React.ReactNode;
}

export function ScenarioProvider({
  scenario,
  initialShareToken,
  children,
}: ScenarioProviderProps) {
  const [shareToken, setShareToken] = React.useState<string | null>(
    initialShareToken,
  );
  const value = React.useMemo<ScenarioContextValue>(
    () => ({ ...scenario, shareToken, setShareToken }),
    [scenario, shareToken],
  );
  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario(): ScenarioContextValue | null {
  return React.useContext(ScenarioContext);
}
