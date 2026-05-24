'use client';

// PROJ-12 — Reset button.
//
// Conditionally visible (hidden when no inputs differ from the loaded
// baseline). Clicking restores `inputs` to baseline AND re-applies the
// URL-derived lock defaults (closed for `?s=` URLs, open for bare).
// Anchored to the right of the calculator title — the visitor surface
// mounts it floating in the top-right corner of the calculator card.

import * as React from 'react';

import { Button } from '@/components/ui/button';

import { useVisitorInputStore } from './visitor-input-store';

export function ResetButton() {
  const { isModified, reset } = useVisitorInputStore();
  if (!isModified) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={reset}
      className="absolute right-4 top-4 z-10 h-7 px-2 text-[12px]"
    >
      Reset
    </Button>
  );
}
