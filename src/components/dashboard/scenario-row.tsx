'use client';

// PROJ-12 — One row of the dashboard My Scenarios list.
//
// Rows (NOT cards) per spec line 668. Each row shows scenario title +
// parent calc title + "saved <relative>" date + two icon buttons
// (Edit pencil → same-tab, Public-view external → new-tab) + a kebab
// menu (Copy link, Rename, Delete).

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Icons } from '@/components/shell/icons';
import { DestructiveConfirmSheet } from '@/components/editor/destructive-confirm-sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  deleteScenario,
  MAX_SCENARIO_TITLE_LENGTH,
  ScenarioApiError,
  shareScenario,
  updateScenario,
  validateScenarioTitle,
  type ScenarioRowWithCalc,
} from '@/lib/scenarios';

interface ScenarioRowProps {
  row: ScenarioRowWithCalc;
}

export function ScenarioRow({ row: initialRow }: ScenarioRowProps) {
  const router = useRouter();
  const [row, setRow] = React.useState<ScenarioRowWithCalc>(initialRow);
  const [renaming, setRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(initialRow.title);
  const [renameError, setRenameError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const calcAvailable =
    row.calculator !== null &&
    row.calculator.id !== null &&
    row.calculator.public_token !== null &&
    row.calculator.soft_delete_at === null;
  const calcSoftDeleted =
    row.calculator !== null &&
    row.calculator.soft_delete_at !== null;
  const calcHardDeleted = row.calculator === null || row.calculator.id === null;

  async function lazyMintAndCopy(action: 'copy' | 'edit' | 'public') {
    const { toast } = await import('sonner');
    try {
      // Ensure we have a share_token; mint via POST if null.
      let token = row.share_token;
      if (!token) {
        const res = await shareScenario(row.id);
        token = res.share_token;
        setRow((prev) => ({ ...prev, share_token: token }));
      }
      const calcToken = row.calculator?.public_token;
      if (!calcToken) {
        toast.error('Calculator is no longer available.');
        return;
      }
      const url = `${window.location.origin}/c/${calcToken}?s=${token}`;
      if (action === 'copy') {
        await copyToClipboard(url, toast);
      } else if (action === 'edit') {
        window.location.href = url;
      } else if (action === 'public') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      if (err instanceof ScenarioApiError && err.status === 429) {
        toast.error('Slow down — try again in a minute.');
      } else {
        toast.error("Couldn't generate share link — please try again.");
      }
    }
  }

  async function commitRename(next: string): Promise<void> {
    const v = validateScenarioTitle(next);
    if (!v.ok) {
      setRenameError(
        v.reason === 'title_required'
          ? 'Title is required.'
          : `Max ${MAX_SCENARIO_TITLE_LENGTH} characters.`,
      );
      return;
    }
    if (v.value === row.title) {
      setRenaming(false);
      setRenameError(null);
      return;
    }
    try {
      const updated = await updateScenario(row.id, { title: v.value });
      setRow((prev) => ({ ...prev, title: updated.title }));
      setRenaming(false);
      setRenameError(null);
      router.refresh();
    } catch (err) {
      const { toast } = await import('sonner');
      if (err instanceof ScenarioApiError && err.status === 429) {
        toast.error('Slow down — try again in a minute.');
      } else {
        toast.error("Couldn't rename — please try again.");
      }
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteScenario(row.id);
      const { toast } = await import('sonner');
      toast.success(`Deleted «${row.title}».`);
      router.refresh();
    } catch {
      const { toast } = await import('sonner');
      toast.error("Couldn't delete — please try again.");
      throw new Error('delete-failed');
    } finally {
      setBusy(false);
    }
  }

  const calcSubtitle = calcHardDeleted ? (
    <span className="italic text-cg-text-subtle">
      Calculator deleted permanently
    </span>
  ) : (
    <span
      className={
        calcSoftDeleted ? 'text-cg-text-subtle' : 'text-cg-text-muted'
      }
      style={calcSoftDeleted ? { opacity: 0.6 } : undefined}
    >
      {row.calculator?.title ?? ''}
      {calcSoftDeleted ? (
        <span className="ml-1 text-cg-text-subtle">· calculator deleted</span>
      ) : null}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 rounded-md border border-cg-border bg-cg-surface px-3 py-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-cg-surface-2 text-cg-text-muted"
        >
          <Icons.Bookmark size={14} />
        </span>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex flex-col gap-1">
              <input
                ref={inputRef}
                type="text"
                value={renameValue}
                maxLength={MAX_SCENARIO_TITLE_LENGTH + 20}
                aria-label="Rename scenario"
                aria-invalid={renameError ? 'true' : 'false'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void commitRename(renameValue);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setRenaming(false);
                    setRenameError(null);
                    setRenameValue(row.title);
                  }
                }}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => {
                  if (renaming) void commitRename(renameValue);
                }}
                className="w-full rounded-[6px] border border-cg-border bg-cg-surface px-2 py-1 text-[13px] font-medium text-cg-text outline-none focus:border-cg-border-strong"
              />
              {renameError ? (
                <p role="alert" className="text-[12px] font-medium text-red-600">
                  {renameError}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="m-0 truncate text-[13px] font-medium text-cg-text">
              {row.title}
            </p>
          )}
          <p className="m-0 truncate text-[11.5px]">{calcSubtitle}</p>
        </div>
        <span
          title={formatAbsolute(row.updated_at)}
          className="hidden truncate text-[11.5px] text-cg-text-subtle sm:inline"
        >
          Saved {formatRelative(row.updated_at)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Edit scenario"
            disabled={!calcAvailable}
            onClick={() => void lazyMintAndCopy('edit')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 disabled:opacity-40"
          >
            <Icons.Pencil size={14} />
          </button>
          <button
            type="button"
            aria-label="Open in new tab"
            disabled={!calcAvailable}
            onClick={() => void lazyMintAndCopy('public')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 disabled:opacity-40"
          >
            <Icons.External size={14} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
              >
                <Icons.Kebab size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[160px] bg-cg-surface"
            >
              <DropdownMenuItem
                disabled={!calcAvailable}
                onSelect={() => void lazyMintAndCopy('copy')}
                className="gap-2 text-[13px]"
              >
                <Icons.Share size={14} aria-hidden /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setRenameValue(row.title);
                  setRenameError(null);
                  setRenaming(true);
                }}
                className="gap-2 text-[13px]"
              >
                <Icons.Pencil size={14} aria-hidden /> Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
              >
                <Icons.Trash size={14} aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <DestructiveConfirmSheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete «${row.title}»?`}
        description="This cannot be undone."
        onConfirm={handleDelete}
      />
    </>
  );
}

async function copyToClipboard(
  text: string,
  toast: {
    success: (msg: string) => void;
    message: (msg: string, opts?: { description?: string }) => void;
  },
): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied to clipboard');
      return;
    }
  } catch {
    // fall through
  }
  toast.message("Couldn't copy — long-press the URL", { description: text });
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const diffMs = Math.max(0, now - then);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  if (day < 14) return 'last week';
  if (day < 30) return `${Math.floor(day / 7)} weeks ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  return new Date(then).toISOString().slice(0, 10);
}

function formatAbsolute(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}
