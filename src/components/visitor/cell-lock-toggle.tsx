'use client';

// PROJ-12 — Per-cell padlock toggle.
//
// Rendered by `CellCard`'s top-right "edit-icon slot" when the
// surrounding tree is in `visitor` mode (the Builder's edit-pencil
// occupies the same slot in `builder` mode — they swap, never
// overlap). Open padlock = field interactive; closed padlock =
// non-interactive widget rendered desaturated (handled inside
// CellInputWidget via the `readOnly` prop the parent already passes).

import * as React from 'react';

import { Icons } from '@/components/shell/icons';

import { useVisitorInputStore } from './visitor-input-store';

interface CellLockToggleProps {
  cellName: string;
  cellLabel: string;
}

export function CellLockToggle({ cellName, cellLabel }: CellLockToggleProps) {
  const { isLocked, toggleLock } = useVisitorInputStore();
  const locked = isLocked(cellName);
  return (
    <button
      type="button"
      aria-label={
        locked ? `Unlock field ${cellLabel}` : `Lock field ${cellLabel}`
      }
      aria-pressed={locked}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLock(cellName);
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cg-surface/90 text-cg-text-muted shadow-sm ring-1 ring-cg-border transition-colors hover:text-cg-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
    >
      {locked ? <Icons.Lock size={12} /> : <Icons.Unlock size={12} />}
    </button>
  );
}
