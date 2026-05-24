'use client';

// PROJ-12 — Structure-drift banner.
//
// Non-modal, dismissible. Renders above the scenario header block when
// at least one saved scenario value was skipped due to rename / removal
// / type-change on the parent calculator. Dismissal is per-page-load
// only — reload re-applies the banner per the Decision Log.

import * as React from 'react';

interface StructureDriftBannerProps {
  hasDrift: boolean;
}

export function StructureDriftBanner({ hasDrift }: StructureDriftBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);
  if (!hasDrift || dismissed) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
    >
      <span className="flex-1 leading-snug">
        Some of this scenario&apos;s values couldn&apos;t be applied because
        the calculator was updated.
      </span>
      <button
        type="button"
        aria-label="Dismiss notice"
        onClick={() => setDismissed(true)}
        className="-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-amber-700 hover:bg-amber-100"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
