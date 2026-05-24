'use client';

// PROJ-18 — Clone icon button in `VisitorHeader`.
//
// Visible to all approved logged-in users (registered + sysadmin)
// including the calculator's own owner. Hidden for anonymous /
// pending / declined / expired-session users (rendered as null
// when `approvedUser` is missing from context) and on visitor
// error shells (no CloneController mounted → null).
//
// On click: optimistic spinner, POST to /duplicate with the
// source token, navigate to /editor/<new-id> on success, restore
// + toast on failure.

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Icons } from '@/components/shell/icons';
import { cloneCalculator } from '@/lib/calculators/client';

import { useOptionalCloneController } from './clone-controller';

export function CloneHeaderButton() {
  const controller = useOptionalCloneController();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  if (!controller) return null;
  if (!controller.approvedUser) return null;

  const { calculator } = controller;

  async function handleClick(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const created = await cloneCalculator(
        calculator.id,
        calculator.public_token,
      );
      // Keep the spinner glyph rendered until the page transitions
      // (prevents the icon-snap-back flicker). The component unmounts
      // on navigation; no need to reset busy state on success.
      router.push(`/editor/${created.id}`);
    } catch {
      const { toast } = await import('sonner');
      toast.error("Couldn't clone — please try again.");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-label="Clone this calculator into your account"
      title="Clone this calculator into your account"
      aria-busy={busy ? 'true' : undefined}
      disabled={busy}
      onClick={handleClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 hover:text-cg-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent disabled:opacity-70"
    >
      {busy ? <Spinner /> : <Icons.Copy size={16} />}
    </button>
  );
}

// 14px rotating spinner — matches the spec's "small inline spinner
// glyph". Kept inline to avoid pulling lucide-react into the header.
function Spinner() {
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
