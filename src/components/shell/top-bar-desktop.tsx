'use client';

// PROJ-4 — Desktop top bar.
// Layout: Wordmark → divider → tab nav → flex spacer →
//         optional rightExtras → "+ New calculator" (disabled, tooltip) →
//         Avatar (opens AvatarPopover).
//
// Tab assembly is delegated to the pure helper `buildBreadcrumbTabs` so
// it can be unit-tested in isolation. PROJ-8 will pass `editorTitle` to
// override the second segment for `/editor/*` routes.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { Avatar } from './avatar';
import { deriveInitials } from './avatar-initials';
import { AvatarPopover, type AvatarPopoverUser } from './avatar-popover';
import { Icons } from './icons';
import { Wordmark } from './wordmark';

export interface BreadcrumbTab {
  label: string;
  /** When set, the segment renders as a Link; when omitted it's the active page. */
  href?: string;
  active: boolean;
}

/**
 * Pure helper: pathname → tab list. PROJ-8 passes `editorTitle` once the
 * live calculator name is available so the override seam doesn't change
 * the helper's shape.
 */
export function buildBreadcrumbTabs(
  pathname: string,
  options: { editorTitle?: string } = {},
): BreadcrumbTab[] {
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return [{ label: 'Dashboard', active: true }];
  }
  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return [
      { label: 'Dashboard', href: '/dashboard', active: false },
      { label: 'Settings', active: true },
    ];
  }
  if (pathname.startsWith('/editor/')) {
    return [
      { label: 'Dashboard', href: '/dashboard', active: false },
      { label: options.editorTitle ?? 'Untitled calculator', active: true },
    ];
  }
  // Unmatched routes (the not-found surface uses this branch too).
  return [{ label: 'Dashboard', href: '/dashboard', active: false }];
}

export interface TopBarDesktopProps {
  user: AvatarPopoverUser;
  rightExtras?: React.ReactNode;
  editorTitle?: string;
  className?: string;
}

export function TopBarDesktop({
  user,
  rightExtras,
  editorTitle,
  className,
}: TopBarDesktopProps) {
  const pathname = usePathname() ?? '';
  const tabs = buildBreadcrumbTabs(pathname, { editorTitle });
  const initials = deriveInitials({ name: user.name, email: user.email });

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-12 w-full shrink-0 items-center gap-4 border-b border-cg-border bg-cg-surface px-4',
        className,
      )}
    >
      <Link
        href="/dashboard"
        aria-label="Calcgrinder home"
        className="-mx-1 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
      >
        <Wordmark />
      </Link>

      <span className="mx-1 h-[18px] w-px bg-cg-border" aria-hidden="true" />

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-[2px]">
        {tabs.map((tab, i) => (
          <React.Fragment key={`${i}-${tab.label}`}>
            {i > 0 ? (
              <span
                className="px-[2px] text-[13px] text-cg-text-subtle"
                aria-hidden="true"
              >
                /
              </span>
            ) : null}
            {tab.href ? (
              <Link
                href={tab.href}
                className="h-[30px] rounded-md px-[10px] text-[13px] font-medium leading-[30px] tracking-[-0.1px] text-cg-text-muted transition-colors hover:bg-cg-surface-2 hover:text-cg-text"
              >
                {tab.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="block max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-cg-surface-2 px-[10px] text-[13px] font-medium leading-[30px] tracking-[-0.1px] text-cg-text"
              >
                {tab.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex-1" />

      {rightExtras}

      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                size="sm"
                variant="outline"
                disabled
                aria-disabled="true"
                className="h-8 gap-1 text-[13px]"
              >
                <Icons.Plus size={14} />
                <span>New calculator</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Coming soon — calculator creation ships with PROJ-10
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AvatarPopover user={user}>
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
