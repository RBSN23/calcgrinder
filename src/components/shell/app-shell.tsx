'use client';

// PROJ-4 — AppShell (top-level Client Component for the `(app)` route group).
// Wrapped by `src/app/(app)/layout.tsx` around any page (including
// `not-found.tsx`). Consumes the `profile` row fetched server-side and
// renders the desktop + mobile top bars plus the page body.
//
// Forward-compat seams:
//   - rightExtras: PROJ-6 / PROJ-8 will mount the calculator-theme picker
//   - mobileLeftSlot: PROJ-8 will mount the Grid drawer toggle on mobile
//   - mobileCenter: PROJ-8 will inject the live calculator title on mobile
//   - editorTitle: PROJ-8 will override the desktop breadcrumb's 2nd segment

import * as React from 'react';

import { TopBarDesktop } from './top-bar-desktop';
import { TopBarMobile } from './top-bar-mobile';

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
}

export function AppShell({
  user,
  children,
  rightExtras,
  mobileLeftSlot,
  mobileCenter,
  editorTitle,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-cg-bg text-cg-text">
      <TopBarDesktop
        user={user}
        rightExtras={rightExtras}
        editorTitle={editorTitle}
        className="hidden md:flex"
      />
      <TopBarMobile
        user={user}
        mobileLeftSlot={mobileLeftSlot}
        mobileCenter={mobileCenter}
        className="flex md:hidden"
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
