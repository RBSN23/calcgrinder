'use client';

// PROJ-12 — Responsive Sheet wrapper.
//
// Picks between shadcn `<Sheet side="bottom">` (mobile, ≤md) and
// `<Dialog>` (desktop). Both forward open/close state via the same
// `open` + `onOpenChange` props so callers don't need to branch.

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Limit the desktop-dialog width. Defaults to ~520px. */
  desktopMaxWidthClass?: string;
  children: React.ReactNode;
}

export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  desktopMaxWidthClass = 'sm:max-w-[520px]',
  children,
}: ResponsiveSheetProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto border-cg-border bg-cg-surface p-4"
        >
          <SheetHeader>
            <SheetTitle className="text-base font-semibold text-cg-text">
              {title}
            </SheetTitle>
            {description ? (
              <SheetDescription className="text-[13px] text-cg-text-muted">
                {description}
              </SheetDescription>
            ) : null}
          </SheetHeader>
          <div className="mt-3">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'border-cg-border bg-cg-surface p-4',
          desktopMaxWidthClass,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-cg-text">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-[13px] text-cg-text-muted">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="mt-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
