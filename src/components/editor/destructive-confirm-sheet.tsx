'use client';

// PROJ-9 — Destructive confirm bottom-sheet.
//
// Used for "Delete section «X»? Its N elements will be removed too." and
// any other destructive-with-children flows PROJ-9+ adds.

import * as React from 'react';

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

interface DestructiveConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export function DestructiveConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
}: DestructiveConfirmSheetProps) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="border-cg-border bg-cg-surface p-4">
        <SheetTitle className="text-base font-semibold text-cg-text">{title}</SheetTitle>
        <SheetDescription className="mt-1 text-[13px] text-cg-text-muted">
          {description}
        </SheetDescription>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-md border border-cg-border bg-cg-surface px-3 text-[13px] font-medium text-cg-text hover:bg-cg-surface-2"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex h-9 items-center rounded-md bg-red-600 px-3 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
