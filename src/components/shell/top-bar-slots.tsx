'use client';

// PROJ-8 — Top-bar slot registry.
//
// PROJ-4's AppShell sits at the `(app)` layout level, so the editor page can't
// directly pass props (rightExtras, editorTitle, onEditorTitleCommit, mobile
// slots) into the top bar via component props. The slot registry is a small
// client-side context the AppShell wraps everything in: pages register their
// slot content on mount and the top bars read from the context.
//
// Direct props on TopBarDesktop / TopBarMobile still work for non-editor
// callers — context entries take precedence when set.

import * as React from 'react';

export interface TopBarSlots {
  rightExtras?: React.ReactNode;
  editorTitle?: string;
  onEditorTitleCommit?: (next: string) => Promise<void> | void;
  mobileLeftSlot?: React.ReactNode;
  mobileCenter?: React.ReactNode;
}

interface TopBarSlotsContextValue {
  slots: TopBarSlots;
  setSlots: (next: TopBarSlots) => void;
}

const TopBarSlotsContext = React.createContext<TopBarSlotsContextValue | null>(
  null,
);

export function TopBarSlotsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [slots, setSlots] = React.useState<TopBarSlots>({});
  const value = React.useMemo(() => ({ slots, setSlots }), [slots]);
  return (
    <TopBarSlotsContext.Provider value={value}>
      {children}
    </TopBarSlotsContext.Provider>
  );
}

/**
 * Read-only view of currently registered slots — safe to call outside a
 * provider (returns an empty object). Used by the top bar components.
 */
export function useTopBarSlots(): TopBarSlots {
  const ctx = React.useContext(TopBarSlotsContext);
  return ctx?.slots ?? {};
}

/**
 * Page-level hook: register a set of slots while the calling component is
 * mounted. The slots clear automatically on unmount so navigating between
 * pages returns the top bar to its default chrome.
 */
export function useRegisterTopBarSlots(slots: TopBarSlots): void {
  const ctx = React.useContext(TopBarSlotsContext);
  // Re-register whenever any of the slot values change.
  React.useEffect(() => {
    if (!ctx) return;
    ctx.setSlots(slots);
    return () => ctx.setSlots({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ctx,
    slots.rightExtras,
    slots.editorTitle,
    slots.onEditorTitleCommit,
    slots.mobileLeftSlot,
    slots.mobileCenter,
  ]);
}
