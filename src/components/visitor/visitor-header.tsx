// PROJ-11 / PROJ-12 / PROJ-18 — Visitor header.
//
// Brand mark on the left; on the right:
//   - Save Scenario icon (always-visible on /c/<token> via
//     SaveScenarioController, hidden on 404 / 410 error shells)
//   - Clone icon (PROJ-18 — visible to approved users via
//     CloneController, hidden on error shells / for anonymous)
//   - anonymous / unapproved / expired-session → "Log in" + "Sign up"
//   - registered + approved → AvatarPopover
//
// Mobile breakpoint uses Tailwind `md:` per existing top-bar-mobile
// pattern; on mobile the anonymous header shows only "Sign up" to
// preserve space.

import Link from 'next/link';
import * as React from 'react';

import {
  AvatarPopover,
  Avatar,
  Icons,
  Wordmark,
  deriveInitials,
  type AvatarPopoverUser,
} from '@/components/shell';
import { Button } from '@/components/ui/button';

import { CloneHeaderButton } from './clone-header-button';
import { SaveScenarioHeaderButton } from './save-scenario-header-button';

interface VisitorHeaderProps {
  token: string | null;
  approvedUser: AvatarPopoverUser | null;
  isAdmin?: boolean;
  isOwner?: boolean;
  calculatorId?: string;
}

export function VisitorHeader({ token, approvedUser, isAdmin, isOwner, calculatorId }: VisitorHeaderProps) {
  const loginHref = token
    ? `/auth/login?next=${encodeURIComponent(`/c/${token}`)}`
    : '/auth/login';
  return (
    <header className="border-b border-cg-border bg-cg-surface">
      <div className="mx-auto flex h-[60px] items-center justify-between gap-3 px-4 md:h-[68px] md:gap-4 md:px-6 max-w-[1200px]">
        <Link href="/" aria-label="Calcgrinder home" className="inline-flex shrink-0 items-center">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1.5 md:gap-2">
          <SaveScenarioHeaderButton />
          <CloneHeaderButton />
          {isOwner && calculatorId ? (
            <Link
              href={`/editor/${calculatorId}`}
              aria-label="Edit this calculator"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
            >
              <Icons.Pencil size={14} />
            </Link>
          ) : null}
          {approvedUser ? (
            <AvatarPopover user={approvedUser} isAdmin={isAdmin}>
              <button
                type="button"
                aria-label="Account menu"
                className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
              >
                <Avatar
                  initials={deriveInitials({
                    name: approvedUser.name,
                    email: approvedUser.email,
                  })}
                  size={32}
                />
              </button>
            </AvatarPopover>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link href={loginHref}>Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
