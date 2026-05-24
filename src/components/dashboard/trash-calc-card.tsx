'use client';

// PROJ-13 — Trash section card.
//
// Visually mirrors PROJ-10's <CalcCard> (icon badge + title + kebab),
// but with three behavioural differences:
//   1. Card-wide click and Enter are inert — there's no `/c/<token>`
//      to navigate to (it would 410). Only the kebab is interactive.
//   2. The footer drops the Edit / Public-view / Duplicate icon row.
//   3. The kebab contains just two actions: Restore + Delete
//      permanently. The "Deleted" pill replaces Published/Draft.
//
// The footer carries the recovery countdown: "Deleted N days ago ·
// Purges in M days" (with sensible relative wording for the
// boundary cases — today, yesterday, tomorrow, any moment now).

import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  CalculatorApiError,
  restoreCalculator,
} from '@/lib/calculators/client';
import type { TrashedCalculatorRow } from '@/lib/calculators/server';
import { Icons } from '@/components/shell/icons';
import { Pill } from '@/components/shell/pill';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { DeletePermanentlySheet } from './delete-permanently-sheet';

export interface TrashCalcCardProps {
  calculator: TrashedCalculatorRow;
  retentionPeriodDays: number;
}

export function TrashCalcCard({
  calculator,
  retentionPeriodDays,
}: TrashCalcCardProps) {
  const router = useRouter();
  const [row, setRow] = React.useState<TrashedCalculatorRow>(calculator);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setRow(calculator);
  }, [calculator]);

  async function handleRestore(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const restored = await restoreCalculator(row.id, row.updated_at);
      const { toast } = await import('sonner');
      if (restored.renamed) {
        toast.success(
          `Restored as «${restored.title}» — a calculator with the original name already exists.`,
        );
      } else {
        toast.success(`Restored «${restored.title}».`);
      }
      router.refresh();
    } catch (err) {
      const { toast } = await import('sonner');
      if (err instanceof CalculatorApiError && err.status === 409) {
        toast.error('Calculator was updated elsewhere — refreshed.');
        router.refresh();
        return;
      }
      toast.error("Couldn't restore — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const footerLeft = formatTrashFooter(row.soft_delete_at, retentionPeriodDays);
  const tooltipAbsolute = formatAbsolute(row.soft_delete_at);

  return (
    <>
      <div
        aria-label={`${row.title}, deleted. ${footerLeft}`}
        className="group/trash-calc-card relative flex min-h-[128px] flex-col gap-3 rounded-[10px] border border-cg-border bg-cg-surface p-4 text-left"
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
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
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
                  void handleRestore();
                }}
                className="gap-2 text-[13px]"
              >
                <Icons.RotateCcw size={14} aria-hidden />
                Restore
              </DropdownMenuItem>
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
            title={tooltipAbsolute}
            className="truncate text-[11.5px] text-cg-text-subtle"
          >
            {footerLeft}
          </span>
          <Pill kind="draft">Deleted</Pill>
        </div>
      </div>

      <DeletePermanentlySheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        calculatorId={row.id}
        calculatorTitle={row.title}
        updatedAt={row.updated_at}
        onDeleted={() => {
          router.refresh();
        }}
      />
    </>
  );
}

// Footer text: "Deleted <when> · Purges <when>".
// Edge cases (deleted today / yesterday, purges today / tomorrow /
// any moment) get explicit phrasing per spec.
export function formatTrashFooter(
  softDeleteAt: string,
  retentionPeriodDays: number,
): string {
  const deletedAt = Date.parse(softDeleteAt);
  if (Number.isNaN(deletedAt)) {
    return `Deleted · Purges in ${retentionPeriodDays} days`;
  }
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const ageDays = Math.floor((now - deletedAt) / DAY_MS);
  const purgeAt = deletedAt + retentionPeriodDays * DAY_MS;
  const remainingMs = purgeAt - now;
  const remainingDays = Math.ceil(remainingMs / DAY_MS);

  let deletedLabel: string;
  if (ageDays <= 0) deletedLabel = 'Deleted today';
  else if (ageDays === 1) deletedLabel = 'Deleted yesterday';
  else deletedLabel = `Deleted ${ageDays} days ago`;

  // PROJ-13 BUG-L1 fix — the boundary between "today" and "any moment"
  // is on remainingMs, not remainingDays: M=0 (purge due today) reads
  // "Purges today"; M<0 (window elapsed, cron hasn't fired yet) reads
  // "Purges any moment". Swapping the branch order naively would
  // misclassify overdue cards as "today" because Math.ceil maps any
  // negative fraction-of-a-day down to 0.
  let purgesLabel: string;
  if (remainingMs < 0) purgesLabel = 'Purges any moment';
  else if (remainingDays === 0) purgesLabel = 'Purges today';
  else if (remainingDays === 1) purgesLabel = 'Purges tomorrow';
  else purgesLabel = `Purges in ${remainingDays} days`;

  return `${deletedLabel} · ${purgesLabel}`;
}

function formatAbsolute(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}
