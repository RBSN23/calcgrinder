'use client';

// PROJ-4 — Mobile top bar.
// Layout: mobileLeftSlot (default: mini Wordmark linking to /dashboard) →
//         mobileCenter (default: pathname-derived title) → Avatar.
//
// Slots are present from day one so PROJ-8 can mount the Grid drawer
// toggle on the left and the live calculator title in the centre
// without restructuring the bar.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { Avatar } from './avatar';
import { deriveInitials } from './avatar-initials';
import { AvatarPopover, type AvatarPopoverUser } from './avatar-popover';
import { useTopBarSlots } from './top-bar-slots';
import { Wordmark } from './wordmark';

export interface TopBarMobileProps {
  user: AvatarPopoverUser;
  mobileLeftSlot?: React.ReactNode;
  mobileCenter?: React.ReactNode;
  className?: string;
}

export function TopBarMobile({
  user,
  mobileLeftSlot,
  mobileCenter,
  className,
}: TopBarMobileProps) {
  const pathname = usePathname() ?? '';
  const slots = useTopBarSlots();
  const effectiveLeftSlot = slots.mobileLeftSlot ?? mobileLeftSlot;
  const effectiveCenter = slots.mobileCenter ?? mobileCenter;
  const initials = deriveInitials({ name: user.name, email: user.email });

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-12 w-full shrink-0 items-center gap-2 border-b border-cg-border bg-cg-surface px-3',
        className,
      )}
    >
      <div className="flex shrink-0 items-center">
        {effectiveLeftSlot ?? (
          <Link
            href="/dashboard"
            aria-label="Calcgrinder home"
            className="-ml-1 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
          >
            <Wordmark mini />
          </Link>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-[6px] text-[14px] font-semibold tracking-tight text-cg-text">
        {effectiveCenter ?? <DefaultMobileCenter pathname={pathname} />}
      </div>

      <AvatarPopover user={user} align="end">
        <button
          type="button"
          aria-label="Open account menu"
          className="rounded-full outline-none ring-offset-2 ring-offset-cg-surface focus-visible:ring-2 focus-visible:ring-cg-accent data-[state=open]:ring-2 data-[state=open]:ring-cg-accent"
        >
          <Avatar initials={initials} />
        </button>
      </AvatarPopover>
    </header>
  );
}

function DefaultMobileCenter({ pathname }: { pathname: string }) {
  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return <span>Settings</span>;
  }
  if (pathname.startsWith('/editor/')) {
    return <span>Calculator</span>;
  }
  // Dashboard + anything unmatched falls back to the brand title.
  return (
    <>
      <Wordmark mini />
      <span>Calcgrinder</span>
    </>
  );
}
