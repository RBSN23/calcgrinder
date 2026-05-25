'use client';

// PROJ-4 / PROJ-8 — Desktop top bar.
// Layout: Wordmark → divider → tab nav → flex spacer →
//         optional rightExtras → "+ New calculator" → Avatar.
//
// PROJ-4 shipped the chrome with a disabled "+ New calculator" button
// behind a "Coming soon" tooltip. PROJ-8 retires the wrapper and enables
// the button — the calculator-create endpoint now exists.
//
// PROJ-8 also adds an inline-rename affordance on the active breadcrumb
// segment when the page passes `editorTitle` + `onEditorTitleCommit`.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_TITLE_LENGTH, validateTitle } from '@/lib/calculators/types';
import { cn } from '@/lib/utils';

import { Avatar } from './avatar';
import { deriveInitials } from './avatar-initials';
import { AvatarPopover, type AvatarPopoverUser } from './avatar-popover';
import { Icons } from './icons';
import { useTopBarSlots } from './top-bar-slots';
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
  /**
   * When the active breadcrumb segment should be inline-renameable, the
   * editor page passes a commit callback. The trimmed title is validated
   * before the callback fires; the callback is responsible for the PATCH.
   */
  onEditorTitleCommit?: (next: string) => Promise<void> | void;
  className?: string;
}

export function TopBarDesktop({
  user,
  rightExtras,
  editorTitle,
  onEditorTitleCommit,
  className,
}: TopBarDesktopProps) {
  const pathname = usePathname() ?? '';
  const slots = useTopBarSlots();
  // Context slots take precedence — they're page-scoped and update reactively.
  const effectiveEditorTitle = slots.editorTitle ?? editorTitle;
  const effectiveOnCommit = slots.onEditorTitleCommit ?? onEditorTitleCommit;
  const effectiveRightExtras = slots.rightExtras ?? rightExtras;
  const tabs = buildBreadcrumbTabs(pathname, { editorTitle: effectiveEditorTitle });
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
        prefetch={false}
        aria-label="Calcgrinder home"
        className="-mx-1 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
      >
        <Wordmark />
      </Link>

      <span className="mx-1 h-[18px] w-px bg-cg-border" aria-hidden="true" />

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-[2px]">
        {tabs.map((tab, i) => {
          const isLast = i === tabs.length - 1;
          const editable = isLast && tab.active && Boolean(effectiveOnCommit);
          return (
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
              ) : editable ? (
                <BreadcrumbEditableSegment
                  label={tab.label}
                  onCommit={effectiveOnCommit!}
                />
              ) : (
                <span
                  aria-current="page"
                  className="block max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-cg-surface-2 px-[10px] text-[13px] font-medium leading-[30px] tracking-[-0.1px] text-cg-text"
                >
                  {tab.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="flex-1" />

      {effectiveRightExtras}

      <NewCalculatorButton />

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

function NewCalculatorButton() {
  return (
    <Button size="sm" variant="outline" asChild className="h-8 gap-1 text-[13px]">
      <Link href="/editor/new">
        <Icons.Plus size={14} />
        <span>New calculator</span>
      </Link>
    </Button>
  );
}

interface BreadcrumbEditableSegmentProps {
  label: string;
  onCommit: (next: string) => Promise<void> | void;
}

function BreadcrumbEditableSegment({
  label,
  onCommit,
}: BreadcrumbEditableSegmentProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(label);
  const [invalid, setInvalid] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  React.useEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      el.select();
    }
  }, [editing]);

  async function commit() {
    const result = validateTitle(draft);
    if (!result.ok) {
      setInvalid(true);
      // Re-focus and re-select for the user to correct.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      window.setTimeout(() => setInvalid(false), 600);
      return;
    }
    setEditing(false);
    if (result.value === label) return;
    await onCommit(result.value);
  }

  function cancel() {
    setDraft(label);
    setEditing(false);
    setInvalid(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        aria-current="page"
        aria-label={`Rename calculator (current title: ${label})`}
        onClick={() => setEditing(true)}
        className="block max-w-[280px] cursor-text overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-cg-surface-2 px-[10px] text-left text-[13px] font-medium leading-[30px] tracking-[-0.1px] text-cg-text outline-none transition-colors hover:bg-cg-surface-3 focus-visible:ring-2 focus-visible:ring-cg-accent"
      >
        {label}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      }}
      maxLength={MAX_TITLE_LENGTH}
      aria-label="Rename calculator"
      aria-invalid={invalid || undefined}
      className={cn(
        'h-[30px] max-w-[280px] rounded-md border-cg-border bg-cg-surface px-[10px] text-[13px] font-medium leading-[30px] tracking-[-0.1px] text-cg-text shadow-none focus-visible:ring-2 focus-visible:ring-cg-accent',
        invalid && 'border-cg-danger ring-2 ring-cg-danger animate-pulse',
      )}
    />
  );
}
