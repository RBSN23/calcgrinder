'use client';

// PROJ-10 — My Calculators card primitive.
//
// Card structure (matches docs/design/dashboard.jsx):
//   ┌─────────────────────────────────────────────────┐
//   │ [icon] Title                       [kebab ⋮]    │
//   │        2-line description body                  │
//   │ ─────────────────────────────────────────────── │
//   │ Edited <relative>       [✎] [↗] [⎘]  [Pill]    │
//   └─────────────────────────────────────────────────┘
//
// The whole card is an <a target="_blank"> so Cmd-click / middle-click /
// drag-to-tab work natively. The kebab, the inline-rename input, and
// the three footer icon-buttons all sit inside the anchor and call
// `event.stopPropagation() + event.preventDefault()` to suppress the
// card-wide navigation (HTML5 allows nested-clickable when the inner
// controls are <button>s, not anchors).

import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  CalculatorApiError,
  duplicateCalculator,
  patchCalculator,
  softDeleteCalculator,
} from '@/lib/calculators/client';
import { MAX_TITLE_LENGTH, validateTitle } from '@/lib/calculators/types';
import type { CalculatorRow } from '@/lib/calculators/types';
import { Icons } from '@/components/shell/icons';
import { Pill } from '@/components/shell/pill';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { DeleteCalcSheet } from './delete-calc-sheet';

export type CalcCardVariant = 'mine' | 'preset';

export interface CalcCardProps {
  calculator: CalculatorRow;
  /** PROJ-10 retention countdown for the delete sheet copy. Required
   * for `variant='mine'`; ignored when `variant='preset'`. */
  retentionPeriodDays: number;
  /** PROJ-18 — `'mine'` keeps the kebab + Status pill + Edit/Duplicate
   * icons (owner affordances). `'preset'` strips them and swaps in
   * the Clone icon next to Public-view. */
  variant?: CalcCardVariant;
}

const TITLE_TAKEN_MESSAGE = 'A calculator with this title already exists.';
const TITLE_REQUIRED_MESSAGE = 'Title is required.';
const TITLE_TOO_LONG_MESSAGE = `Titles can be at most ${MAX_TITLE_LENGTH} characters.`;

export function CalcCard({
  calculator,
  retentionPeriodDays,
  variant = 'mine',
}: CalcCardProps) {
  const isPreset = variant === 'preset';
  const router = useRouter();
  const [row, setRow] = React.useState<CalculatorRow>(calculator);
  const [renaming, setRenaming] = React.useState(false);
  const [renameError, setRenameError] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState(calculator.title);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [navigating, startNavigation] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Refresh state from prop whenever the server-fetched calculator changes
  // (after a router.refresh() in the parent list).
  React.useEffect(() => {
    setRow(calculator);
  }, [calculator]);

  React.useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const publicHref = `/c/${row.public_token}`;
  const editorHref = `/editor/${row.id}`;

  // Wrap any inner-button handler so it never bubbles up to the
  // card-wide anchor (which would also open the public URL).
  function stop<E extends React.SyntheticEvent>(e: E): void {
    e.preventDefault();
    e.stopPropagation();
  }

  async function commitRename(next: string): Promise<void> {
    const validation = validateTitle(next);
    if (!validation.ok) {
      setRenameError(
        validation.reason === 'title_required'
          ? TITLE_REQUIRED_MESSAGE
          : TITLE_TOO_LONG_MESSAGE,
      );
      return;
    }
    if (validation.value === row.title) {
      setRenaming(false);
      setRenameError(null);
      return;
    }
    try {
      const fresh = await patchCalculator(row.id, {
        updated_at: row.updated_at,
        title: validation.value,
      });
      setRow(fresh);
      setRenaming(false);
      setRenameError(null);
      router.refresh();
    } catch (err) {
      if (err instanceof CalculatorApiError) {
        if (err.code === 'title_taken') {
          setRenameError(TITLE_TAKEN_MESSAGE);
          return;
        }
        if (err.code === 'title_required') {
          setRenameError(TITLE_REQUIRED_MESSAGE);
          return;
        }
        if (err.code === 'title_too_long') {
          setRenameError(TITLE_TOO_LONG_MESSAGE);
          return;
        }
      }
      const { toast } = await import('sonner');
      toast.error("Couldn't rename — please try again.");
    }
  }

  function handleDuplicate(navigate: boolean): void {
    if (busy) return;
    if (navigate) {
      router.push(`/editor/new?duplicate=${encodeURIComponent(row.id)}`);
    } else {
      setBusy(true);
      duplicateCalculator(row.id)
        .then(async () => {
          const { toast } = await import('sonner');
          toast.success(`Duplicated «${row.title}»`);
          router.refresh();
        })
        .catch(async () => {
          const { toast } = await import('sonner');
          toast.error("Couldn't duplicate — please try again.");
        })
        .finally(() => setBusy(false));
    }
  }

  function handleClone(): void {
    if (busy) return;
    router.push(
      `/editor/new?clone=${encodeURIComponent(row.id)}&token=${encodeURIComponent(row.public_token)}`,
    );
  }

  async function handlePublishToggle(): Promise<void> {
    if (busy) return;
    const next = !row.published;
    setBusy(true);
    try {
      const fresh = await patchCalculator(row.id, {
        updated_at: row.updated_at,
        published: next,
      });
      setRow(fresh);
      router.refresh();
    } catch {
      const { toast } = await import('sonner');
      toast.error(
        next
          ? "Couldn't publish — please try again."
          : "Couldn't unpublish — please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm(): Promise<void> {
    try {
      await softDeleteCalculator(row.id, row.updated_at);
      const { toast } = await import('sonner');
      toast.success(`Moved «${row.title}» to Trash.`);
      router.refresh();
    } catch (err) {
      const { toast } = await import('sonner');
      if (err instanceof CalculatorApiError && err.status === 409) {
        toast.error('Calculator was updated elsewhere — refreshed.');
        setDeleteOpen(false);
        router.refresh();
        return;
      }
      toast.error("Couldn't move to Trash — please try again.");
      throw err; // re-throw so the sheet stays open
    }
  }

  function handleCardClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    // Suppress card-wide navigation while inline rename is in progress.
    if (renaming) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  const editedRelative = formatRelative(row.updated_at);
  const editedAbsolute = formatAbsolute(row.updated_at);

  return (
    <>
      <a
        href={publicHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleCardClick}
        aria-label={
          isPreset
            ? `${row.title}. Open public view in new tab.`
            : `${row.title}, ${row.published ? 'Published' : 'Draft'}. Open public view in new tab.`
        }
        className="group/calc-card relative flex min-h-[128px] flex-col gap-3 rounded-[10px] border border-cg-border bg-cg-surface p-4 text-left no-underline outline-none transition-colors hover:border-cg-border-strong hover:bg-cg-surface-2 focus-visible:ring-2 focus-visible:ring-cg-border"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-cg-surface-2 text-cg-text-muted"
          >
            <Icons.Calc size={16} />
          </span>
          <div className="min-w-0 flex-1">
            {renaming ? (
              <div className="flex flex-col gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={renameValue}
                  maxLength={MAX_TITLE_LENGTH + 20}
                  aria-label="Rename calculator"
                  aria-invalid={renameError ? 'true' : 'false'}
                  onClick={stop}
                  onMouseDown={stop}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      void commitRename(renameValue);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setRenaming(false);
                      setRenameError(null);
                      setRenameValue(row.title);
                    }
                  }}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    // Blur commits unless the user pressed Esc (which
                    // already toggled `renaming` off).
                    if (renaming) void commitRename(renameValue);
                  }}
                  className="w-full rounded-[6px] border border-cg-border bg-cg-surface px-2 py-1 text-[14.5px] font-semibold tracking-[-0.15px] text-cg-text outline-none focus:border-cg-border-strong"
                />
                {renameError ? (
                  <p
                    role="alert"
                    className="text-[12px] font-medium text-red-600"
                  >
                    {renameError}
                  </p>
                ) : null}
              </div>
            ) : (
              <h3 className="m-0 truncate text-[14.5px] font-semibold tracking-[-0.15px] text-cg-text">
                {row.title}
              </h3>
            )}
            {row.description ? (
              <p
                className="mt-1 text-[12.5px] leading-[1.45] text-cg-text-muted"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {row.description}
              </p>
            ) : null}
          </div>
          {isPreset ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More actions"
                  onClick={stop}
                  onMouseDown={stop}
                  className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-cg-text-muted outline-none hover:bg-cg-surface-2 focus-visible:ring-2 focus-visible:ring-cg-border"
                >
                  <Icons.Kebab size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[180px] bg-cg-surface"
              >
                <DropdownMenuItem
                  onSelect={() => {
                    window.open(publicHref, '_blank', 'noopener,noreferrer');
                  }}
                  className="gap-2 text-[13px]"
                >
                  <Icons.External size={14} aria-hidden />
                  Public Link
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameValue(row.title);
                    setRenameError(null);
                    setRenaming(true);
                  }}
                  className="gap-2 text-[13px]"
                >
                  <Icons.Pencil size={14} aria-hidden />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void handleDuplicate(false);
                  }}
                  className="gap-2 text-[13px]"
                >
                  <Icons.Copy size={14} aria-hidden />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void handlePublishToggle();
                  }}
                  className="gap-2 text-[13px]"
                >
                  {row.published ? (
                    <>
                      <Icons.EyeOff size={14} aria-hidden />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Icons.Eye size={14} aria-hidden />
                      Publish
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setDeleteOpen(true);
                  }}
                  className="gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
                >
                  <Icons.Trash size={14} aria-hidden />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span
            title={editedAbsolute}
            className="truncate text-[11.5px] text-cg-text-subtle"
          >
            Edited {editedRelative}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {isPreset ? (
              <>
                <button
                  type="button"
                  aria-label="Open public view in new tab"
                  onClick={(e) => {
                    stop(e);
                    window.open(publicHref, '_blank', 'noopener,noreferrer');
                  }}
                  onMouseDown={stop}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
                >
                  <Icons.External size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Clone this calculator into your account"
                  title="Clone this calculator into your account"
                  aria-busy={busy ? 'true' : undefined}
                  disabled={busy}
                  onClick={(e) => {
                    stop(e);
                    void handleClone();
                  }}
                  onMouseDown={stop}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 disabled:opacity-70"
                >
                  {busy ? <CardSpinner /> : <Icons.Copy size={14} />}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  aria-label="Edit calculator"
                  onClick={(e) => {
                    stop(e);
                    startNavigation(() => { router.push(editorHref); });
                  }}
                  onMouseDown={stop}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
                >
                  {navigating ? <CardSpinner /> : <Icons.Pencil size={14} />}
                </button>
                <button
                  type="button"
                  aria-label="Open public view in new tab"
                  onClick={(e) => {
                    stop(e);
                    window.open(publicHref, '_blank', 'noopener,noreferrer');
                  }}
                  onMouseDown={stop}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
                >
                  <Icons.External size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Duplicate calculator"
                  disabled={busy || navigating}
                  onClick={(e) => {
                    stop(e);
                    void handleDuplicate(true);
                  }}
                  onMouseDown={stop}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 disabled:opacity-50"
                >
                  <Icons.Copy size={14} />
                </button>
                <span className="ml-1">
                  <Pill kind={row.published ? 'published' : 'draft'}>
                    {row.published ? 'Published' : 'Draft'}
                  </Pill>
                </span>
              </>
            )}
          </div>
        </div>
      </a>

      {isPreset ? null : (
        <DeleteCalcSheet
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={row.title}
          retentionPeriodDays={retentionPeriodDays}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}

// PROJ-18 — inline spinner used by the Preset card's Clone icon-button
// (the My Calculators "Duplicate" icon stays static — its router.push
// happens fast enough that the icon flicker is the lesser evil compared
// to swapping in a spinner for a sub-100ms transition).
function CardSpinner() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

// Render a short "2 hours ago" / "Yesterday" / "last week" / "2026-05-10"
// label. Kept inline because the dashboard is the only consumer for
// this exact label format. The tooltip on the rendered span shows the
// absolute timestamp for precision.
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
