// PROJ-11 — Visitor header.
//
// Brand mark on the left; on the right either:
//   - anonymous / unapproved / expired-session → "Log in" + "Sign up"
//   - registered + approved → AvatarPopover
//
// No Save icon (PROJ-12), no Clone icon (PROJ-18). Mobile breakpoint
// uses Tailwind `md:` per existing top-bar-mobile pattern; on mobile
// the anonymous header shows only "Sign up" to preserve space.

import Link from 'next/link';
import * as React from 'react';

import {
  AvatarPopover,
  Avatar,
  Wordmark,
  deriveInitials,
  type AvatarPopoverUser,
} from '@/components/shell';
import { Button } from '@/components/ui/button';

interface VisitorHeaderProps {
  /** Token for the calculator being viewed; threaded into the Log in
   * deep-link (`?next=/c/<token>`). Pass null/empty (e.g. 404 page)
   * to drop the `?next=` param. Sign up has no `?next=` (PROJ-3
   * deep-link chain is broken — documented in Out of Scope). */
  token: string | null;
  /** Approved, registered user that should see the avatar popover.
   * Null for anonymous visitors and for users whose status is
   * pending/declined/expired (they fall back to the anonymous CTAs). */
  approvedUser: AvatarPopoverUser | null;
  /** True if the approved user is a sysadmin (shows the Admin row in
   * the popover when PROJ-19 lights it up). */
  isAdmin?: boolean;
}

export function VisitorHeader({ token, approvedUser, isAdmin }: VisitorHeaderProps) {
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
