'use client';

// PROJ-10 — Sharing popover in the editor toolbar.
//
// Contents:
//   - The full `/c/<token>` URL, monospace, truncated with ellipsis.
//   - "Copy URL" primary button → navigator.clipboard.writeText.
//   - "Regenerate URL" ghost destructive button → opens a confirm
//     bottom sheet; on confirm, calls the regenerate-token endpoint.
//
// Always available regardless of `published` state (the URL is a
// property of the row, not of the publish status). The popover is a
// Radix Popover via shadcn so Escape / outside-click semantics + focus
// trapping are inherited.

import * as React from 'react';

import {
  CalculatorApiError,
  regenerateCalculatorToken,
} from '@/lib/calculators/client';
import { useEditor } from '@/lib/editor/EditorProvider';
import { Icons } from '@/components/shell/icons';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { DestructiveConfirmSheet } from './destructive-confirm-sheet';

const COPIED_FLASH_MS = 2000;

export function SharingPopover() {
  const { state, dispatch } = useEditor();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const token = state.calculator.public_token;
  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/c/${token}`
      : `/c/${token}`;

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FLASH_MS);
    } catch {
      const { toast } = await import('sonner');
      toast.error("Couldn't copy URL — please copy it manually.");
    }
  }

  async function handleRegenerate(): Promise<void> {
    try {
      const fresh = await regenerateCalculatorToken(
        state.calculator.id,
        state.calculator.updated_at,
      );
      dispatch({
        type: 'SET_PUBLIC_TOKEN',
        public_token: fresh.public_token,
        updated_at: fresh.updated_at,
      });
      const { toast } = await import('sonner');
      toast.success('New URL — previous links now broken.');
    } catch (err) {
      const { toast } = await import('sonner');
      if (err instanceof CalculatorApiError && err.status === 409) {
        toast.error('Calculator was updated elsewhere — refreshed.');
        return;
      }
      toast.error("Couldn't regenerate URL — please try again.");
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Sharing options"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 focus-visible:ring-2 focus-visible:ring-cg-border"
          >
            <Icons.Share size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-[320px] border-cg-border bg-cg-surface p-3"
        >
          <p className="text-[11.5px] font-medium uppercase tracking-wide text-cg-text-subtle">
            Public link
          </p>
          <div
            title={publicUrl}
            className="mt-1.5 truncate rounded-md border border-cg-border bg-cg-surface-2 px-2 py-1.5 font-mono text-[12px] text-cg-text"
          >
            {publicUrl}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-cg-accent px-3 text-[12.5px] font-semibold text-cg-accent-fg hover:bg-cg-accent-hov"
            >
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-cg-border bg-cg-surface px-3 text-[12.5px] font-medium text-red-600 hover:bg-red-50"
            >
              Regenerate URL
            </button>
          </div>
          <p className="mt-2 text-[11px] text-cg-text-subtle">
            Anyone with this link can view the calculator.
          </p>
        </PopoverContent>
      </Popover>

      <DestructiveConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Regenerate URL"
        description="Regenerate URL? All previously-shared links will stop working."
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        onConfirm={handleRegenerate}
      />
    </>
  );
}
