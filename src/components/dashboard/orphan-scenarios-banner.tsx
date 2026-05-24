'use client';

// PROJ-13 — Orphan-scenarios bulk-cleanup banner.
//
// Renders inside the My Scenarios section above the row list when the
// current user has ≥ 1 orphan scenario (parent calculator hard-
// deleted, not soft-deleted). Confirms via the shared destructive
// bottom-sheet pattern; on success the dashboard refreshes which
// removes the orphans from the row list and the banner.

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { DestructiveConfirmSheet } from '@/components/editor/destructive-confirm-sheet';
import { bulkDeleteOrphanScenarios } from '@/lib/scenarios/client';

export interface OrphanScenariosBannerProps {
  count: number;
}

export function OrphanScenariosBanner({ count }: OrphanScenariosBannerProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  if (count <= 0) return null;

  const noun = count === 1 ? 'scenario' : 'scenarios';
  const verb = count === 1 ? 'references' : 'reference';
  const message = `${count} ${noun} ${verb} deleted calculators.`;
  const confirmCopy = `Permanently delete ${count} orphan ${noun}? This cannot be undone.`;

  async function handleConfirm(): Promise<void> {
    try {
      await bulkDeleteOrphanScenarios();
      const { toast } = await import('sonner');
      toast.success(
        `Deleted ${count} orphan ${count === 1 ? 'scenario' : 'scenarios'}.`,
      );
      router.refresh();
    } catch {
      const { toast } = await import('sonner');
      toast.error("Couldn't delete orphans — please try again.");
      throw new Error('bulk-delete-failed');
    }
  }

  return (
    <>
      <div
        role="status"
        className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-cg-border bg-cg-surface-2 px-3 py-2.5 text-[13px] text-cg-text-muted"
      >
        <span className="min-w-0">{message}</span>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="inline-flex h-8 shrink-0 items-center rounded-md bg-red-600 px-3 text-[12.5px] font-semibold text-white hover:bg-red-700"
        >
          Delete all orphans
        </button>
      </div>
      <DestructiveConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete orphan scenarios"
        description={confirmCopy}
        confirmLabel="Delete all"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
      />
    </>
  );
}
