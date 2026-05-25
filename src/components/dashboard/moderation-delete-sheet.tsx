'use client';

import * as React from 'react';

import { DestructiveConfirmSheet } from '@/components/editor/destructive-confirm-sheet';
import {
  CalculatorApiError,
  adminDeleteCalculator,
  getAdminScenariosCount,
} from '@/lib/calculators/client';

export interface ModerationDeleteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculatorId: string;
  calculatorTitle: string;
  onDeleted: () => void;
}

type CountState =
  | { kind: 'loading' }
  | { kind: 'ok'; count: number }
  | { kind: 'unknown' };

export function ModerationDeleteSheet({
  open,
  onOpenChange,
  calculatorId,
  calculatorTitle,
  onDeleted,
}: ModerationDeleteSheetProps) {
  const [countState, setCountState] = React.useState<CountState>({
    kind: 'loading',
  });

  React.useEffect(() => {
    if (!open) {
      setCountState({ kind: 'loading' });
      return;
    }
    let cancelled = false;
    setCountState({ kind: 'loading' });
    getAdminScenariosCount(calculatorId)
      .then((res) => {
        if (!cancelled) setCountState({ kind: 'ok', count: res.count });
      })
      .catch(() => {
        if (!cancelled) setCountState({ kind: 'unknown' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, calculatorId]);

  async function handleConfirm(): Promise<void> {
    try {
      await adminDeleteCalculator(calculatorId);
      const { toast } = await import('sonner');
      toast.success(`Permanently deleted «${calculatorTitle}».`);
      onDeleted();
    } catch (err) {
      const { toast } = await import('sonner');
      if (err instanceof CalculatorApiError && err.status === 404) {
        toast.error('Calculator not found — it may have already been deleted.');
        onDeleted();
        return;
      }
      toast.error("Couldn't delete — please try again.");
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
  const base = `Permanently delete «${title}»? This will also delete all scenarios linked to this calculator. This cannot be undone.`;
  if (state.kind === 'loading') return base;
  if (state.kind === 'unknown') return base;
  if (state.count === 0) return base;
  const noun = state.count === 1 ? 'scenario' : 'scenarios';
  return `${base} ${state.count} ${noun} will be permanently deleted.`;
}
