'use client';

// PROJ-10 — Calculator "Move to Trash" confirm sheet.
//
// Thin wrapper over the editor's `<DestructiveConfirmSheet>` primitive
// (PROJ-9) so the destructive UX surface — bottom sheet, danger button,
// Esc / outside-click semantics — stays consistent with section delete
// and the regenerate-URL confirm. PROJ-12 will extend this wrapper to
// optionally append "N scenarios will become orphan." once the
// scenarios entity exists.

import * as React from 'react';

import { DestructiveConfirmSheet } from '@/components/editor/destructive-confirm-sheet';

export interface DeleteCalcSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  retentionPeriodDays: number;
  onConfirm: () => void | Promise<void>;
}

export function DeleteCalcSheet({
  open,
  onOpenChange,
  title,
  retentionPeriodDays,
  onConfirm,
}: DeleteCalcSheetProps) {
  const description = `Move «${title}» to Trash? You can restore it within ${retentionPeriodDays} days from the Trash section.`;
  return (
    <DestructiveConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Move calculator to Trash"
      description={description}
      confirmLabel="Move to Trash"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
    />
  );
}
