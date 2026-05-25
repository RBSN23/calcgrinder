// PROJ-11 — Visitor surface chrome wrapper.
//
// Composes <VisitorHeader> + body + <VisitorFooter>. Reused by the
// happy-path page, the 404 not-found page, and the 410 gone page so
// every visitor-facing response shares the same chrome.

import * as React from 'react';

import type { AvatarPopoverUser } from '@/components/shell';

import { VisitorFooter } from './visitor-footer';
import { VisitorHeader } from './visitor-header';

interface VisitorShellProps {
  token: string | null;
  approvedUser: AvatarPopoverUser | null;
  isAdmin?: boolean;
  isOwner?: boolean;
  calculatorId?: string;
  children: React.ReactNode;
}

export function VisitorShell({
  token,
  approvedUser,
  isAdmin,
  isOwner,
  calculatorId,
  children,
}: VisitorShellProps) {
  return (
    <>
      <VisitorHeader
        token={token}
        approvedUser={approvedUser}
        isAdmin={isAdmin}
        isOwner={isOwner}
        calculatorId={calculatorId}
      />
      <main className="flex flex-1 flex-col">{children}</main>
      <VisitorFooter />
    </>
  );
}
