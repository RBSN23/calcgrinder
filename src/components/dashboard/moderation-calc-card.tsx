'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import type { ModerationCalculatorRow } from '@/lib/calculators/server';
import { Icons } from '@/components/shell/icons';
import { Pill } from '@/components/shell/pill';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ModerationDeleteSheet } from './moderation-delete-sheet';

export interface ModerationCalcCardProps {
  calculator: ModerationCalculatorRow;
}

export function ModerationCalcCard({ calculator }: ModerationCalcCardProps) {
  const router = useRouter();
  const [row, setRow] = React.useState<ModerationCalculatorRow>(calculator);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setRow(calculator);
  }, [calculator]);

  const publicHref = `/c/${row.public_token}`;
  const editedRelative = formatRelative(row.updated_at);
  const editedAbsolute = formatAbsolute(row.updated_at);

  function stop<E extends React.SyntheticEvent>(e: E): void {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <>
      <a
        href={publicHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${row.title} by ${row.owner_name}, ${row.published ? 'Published' : 'Draft'}. Open public view in new tab.`}
        className="group/mod-card relative flex min-h-[128px] flex-col gap-3 rounded-[10px] border border-cg-border bg-cg-surface p-4 text-left no-underline outline-none transition-colors hover:border-cg-border-strong hover:bg-cg-surface-2 focus-visible:ring-2 focus-visible:ring-cg-border"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-cg-surface-2 text-cg-text-muted"
          >
            <Icons.Calc size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 truncate text-[14.5px] font-semibold tracking-[-0.15px] text-cg-text">
              {row.title}
            </h3>
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
            <p className="mt-1 truncate text-[11.5px] text-cg-text-subtle">
              by {row.owner_name}
            </p>
          </div>
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
                  setDeleteOpen(true);
                }}
                className="gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
              >
                <Icons.Trash size={14} aria-hidden />
                Delete permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span
            title={editedAbsolute}
            className="truncate text-[11.5px] text-cg-text-subtle"
          >
            Edited {editedRelative}
          </span>
          <div className="flex shrink-0 items-center gap-1">
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
            <span className="ml-1">
              <Pill kind={row.published ? 'published' : 'draft'}>
                {row.published ? 'Published' : 'Draft'}
              </Pill>
            </span>
          </div>
        </div>
      </a>

      <ModerationDeleteSheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        calculatorId={row.id}
        calculatorTitle={row.title}
        onDeleted={() => {
          router.refresh();
        }}
      />
    </>
  );
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
