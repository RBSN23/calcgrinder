'use client';

// PROJ-13 — Delete-permanently confirm sheet.
//
// Two-phase open:
//   1. The TrashCalcCard kebab triggers `setOpen(true)` and immediately
//      kicks off a server fetch for the orphan-scenarios count.
//   2. Once the count returns, the sheet renders with body copy that
//      mentions the orphan count: "Permanently delete «<title>»? This
//      cannot be undone. {N} scenario(s) that reference this calculator
//      will become orphan."
//
// Graceful degradation: if the count fetch errors, the sheet still
// opens with "Some scenarios may become orphan." copy — we never
// block a destructive action on an optional warning fetch.

import * as React from 'react';

import { DestructiveConfirmSheet } from '@/components/editor/destructive-confirm-sheet';
import {
  CalculatorApiError,
  getScenariosCount,
  hardDeleteCalculator,
} from '@/lib/calculators/client';

export interface DeletePermanentlySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculatorId: string;
  calculatorTitle: string;
  updatedAt: string;
  onDeleted: () => void;
}

type CountState =
  | { kind: 'loading' }
  | { kind: 'ok'; count: number }
  | { kind: 'unknown' };

export function DeletePermanentlySheet({
  open,
  onOpenChange,
  calculatorId,
  calculatorTitle,
  updatedAt,
  onDeleted,
}: DeletePermanentlySheetProps) {
  const [countState, setCountState] = React.useState<CountState>({
    kind: 'loading',
  });

  // Fetch the orphan count each time the sheet is opened. We reset to
  // 'loading' on close so a stale "5 orphans" warning from the
  // previous open doesn't flash on a fresh open.
  React.useEffect(() => {
    if (!open) {
      setCountState({ kind: 'loading' });
      return;
    }
    let cancelled = false;
    setCountState({ kind: 'loading' });
    getScenariosCount(calculatorId)
      .then((res) => {
        if (!cancelled) setCountState({ kind: 'ok', count: res.count });
      })
      .catch(() => {
        // Graceful degradation — never block the destructive action on
        // a count-fetch failure.
        if (!cancelled) setCountState({ kind: 'unknown' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, calculatorId]);

  async function handleConfirm(): Promise<void> {
    try {
      await hardDeleteCalculator(calculatorId, updatedAt);
      const { toast } = await import('sonner');
      toast.success(`Permanently deleted «${calculatorTitle}».`);
      onDeleted();
    } catch (err) {
      const { toast } = await import('sonner');
      if (err instanceof CalculatorApiError && err.status === 409) {
        toast.error('Calculator was updated elsewhere — refreshed.');
        onDeleted();
        return;
      }
      toast.error("Couldn't delete — please try again.");
      // Re-throw so the sheet stays open per shared DestructiveConfirmSheet
      // semantics.
      throw err;
    }
  }

  const description = buildDescription(calculatorTitle, countState);

  return (
    <DestructiveConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Delete permanently"
      description={description}
      confirmLabel="Delete permanently"
      cancelLabel="Cancel"
      onConfirm={handleConfirm}
    />
  );
}

function buildDescription(title: string, state: CountState): string {
  const base = `Permanently delete «${title}»? This cannot be undone.`;
  if (state.kind === 'loading') return base;
  if (state.kind === 'unknown') {
    return `${base} Some scenarios may become orphan.`;
  }
  if (state.count === 0) return base;
  const noun = state.count === 1 ? 'scenario' : 'scenarios';
  const verb = state.count === 1 ? 'references' : 'reference';
  return `${base} ${state.count} ${noun} that ${verb} this calculator will become orphan.`;
}
