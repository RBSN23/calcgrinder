'use client';

// PROJ-4 — AppShell (top-level Client Component for the `(app)` route group).
// Wrapped by `src/app/(app)/layout.tsx` around any page (including
// `not-found.tsx`). Consumes the `profile` row fetched server-side and
// renders the desktop + mobile top bars plus the page body.
//
// PROJ-8 added a slot registry so deeper pages (the editor) can inject
// rightExtras / editorTitle / onEditorTitleCommit / mobile slots without
// restructuring the layout. Props still work for callers that prefer them.

import * as React from 'react';

import { TopBarDesktop } from './top-bar-desktop';
import { TopBarMobile } from './top-bar-mobile';
import { TopBarSlotsProvider } from './top-bar-slots';

export interface AppShellUser {
  name: string | null;
  email: string;
  role: 'registered' | 'sysadmin';
}

export interface AppShellProps {
  user: AppShellUser;
  children: React.ReactNode;
  rightExtras?: React.ReactNode;
  mobileLeftSlot?: React.ReactNode;
  mobileCenter?: React.ReactNode;
  editorTitle?: string;
  onEditorTitleCommit?: (next: string) => Promise<void> | void;
}

export function AppShell({
  user,
  children,
  rightExtras,
  mobileLeftSlot,
  mobileCenter,
  editorTitle,
  onEditorTitleCommit,
}: AppShellProps) {
  return (
    <TopBarSlotsProvider>
      <div className="flex min-h-screen flex-col bg-cg-bg text-cg-text">
        <TopBarDesktop
          user={user}
          rightExtras={rightExtras}
          editorTitle={editorTitle}
          onEditorTitleCommit={onEditorTitleCommit}
          className="hidden md:flex"
        />
        <TopBarMobile
          user={user}
          mobileLeftSlot={mobileLeftSlot}
          mobileCenter={mobileCenter}
          className="flex md:hidden"
        />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </TopBarSlotsProvider>
  );
}
