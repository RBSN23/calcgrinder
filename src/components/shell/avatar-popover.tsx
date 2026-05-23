'use client';

// PROJ-4 — Avatar popover.
// Composes shadcn's `Popover` (outside-click / Esc / focus return / portal)
// around a chrome-styled body: header (avatar + name + email + optional
// SYSADMIN pill) · theme picker · (optional Admin row, PROJ-19) ·
// Settings link · Sign-out form (no JS required).
//
// The popover is the single component that consumes the user profile. It
// stays open after a theme click so the user can see the transition.

import Link from 'next/link';
import { useTheme } from 'next-themes';
import * as React from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { Avatar } from './avatar';
import { deriveInitials } from './avatar-initials';
import { Icons } from './icons';
import { SysadminPill } from './sysadmin-pill';

export interface AvatarPopoverUser {
  name: string | null;
  email: string;
  role: 'registered' | 'sysadmin';
}

export interface AvatarPopoverProps {
  user: AvatarPopoverUser;
  /** Admin entry visibility. PROJ-19 will flip to `true` for sysadmins. */
  isAdmin?: boolean;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function AvatarPopover({ user, isAdmin = false, children, align = 'end' }: AvatarPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          'w-[264px] rounded-[10px] border border-cg-border bg-cg-surface p-[6px] text-cg-text shadow-cg-lg',
        )}
      >
        <AvatarPopoverContent user={user} isAdmin={isAdmin} />
      </PopoverContent>
    </Popover>
  );
}

export interface AvatarPopoverContentProps {
  user: AvatarPopoverUser;
  isAdmin?: boolean;
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', Icon: Icons.Sun },
  { value: 'dark', label: 'Dark', Icon: Icons.Moon },
  { value: 'system', label: 'System', Icon: Icons.Monitor },
] as const;

export function AvatarPopoverContent({ user, isAdmin = false }: AvatarPopoverContentProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const initials = deriveInitials({ name: user.name, email: user.email });
  const displayName = user.name?.trim() || '—';

  return (
    <div role="menu" aria-label="Account menu">
      <div className="flex items-center gap-[10px] px-2 pb-3 pt-[10px]">
        <Avatar initials={initials} size={36} />
        <div className="min-w-0">
          <div className="flex items-center gap-[6px] text-[13px] font-semibold leading-[1.3] text-cg-text">
            <span className="truncate">{displayName}</span>
            {user.role === 'sysadmin' ? <SysadminPill /> : null}
          </div>
          <div
            title={user.email}
            className="max-w-[200px] truncate text-[12px] leading-[1.3] text-cg-text-muted"
          >
            {user.email}
          </div>
        </div>
      </div>

      <div className="mx-[2px] mb-[6px] h-px bg-cg-border" aria-hidden="true" />

      <div
        id="cg-theme-label"
        className="px-2 pb-[6px] pt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-cg-text-subtle"
      >
        Theme
      </div>
      <div
        role="radiogroup"
        aria-labelledby="cg-theme-label"
        className="grid grid-cols-3 gap-1 px-1 pb-2"
      >
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              data-state={active ? 'on' : 'off'}
              onClick={() => setTheme(value)}
              className={cn(
                'flex h-10 flex-col items-center justify-center gap-[3px] rounded-md border text-[11px] font-medium transition-colors',
                active
                  ? 'border-cg-accent bg-cg-accent-soft text-cg-accent-text'
                  : 'border-cg-border bg-cg-surface text-cg-text hover:bg-cg-surface-2',
              )}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-[2px] mb-[6px] h-px bg-cg-border" aria-hidden="true" />

      {isAdmin ? (
        <Link
          href="#admin"
          role="menuitem"
          className="flex h-9 items-center gap-[10px] rounded-md px-[10px] text-[13px] font-medium text-cg-text hover:bg-cg-surface-2"
        >
          <Icons.Shield size={14} />
          <span className="flex-1">Admin</span>
        </Link>
      ) : null}

      <Link
        href="/settings"
        role="menuitem"
        className="flex h-9 items-center gap-[10px] rounded-md px-[10px] text-[13px] font-medium text-cg-text hover:bg-cg-surface-2"
      >
        <Icons.Settings size={14} />
        <span className="flex-1">Settings</span>
      </Link>

      <div className="mx-[2px] my-[6px] h-px bg-cg-border" aria-hidden="true" />

      <form action="/auth/sign-out" method="post">
        <button
          type="submit"
          role="menuitem"
          className="flex h-9 w-full items-center gap-[10px] rounded-md px-[10px] text-left text-[13px] font-medium text-cg-text-muted hover:bg-cg-surface-2 hover:text-cg-text"
        >
          <Icons.Logout size={14} />
          <span className="flex-1">Sign out</span>
        </button>
      </form>
    </div>
  );
}
