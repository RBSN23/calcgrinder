'use client';

// PROJ-12 — Save Scenario icon button mounted in `VisitorHeader`.
//
// Always visible (anonymous, pending/declined-authenticated,
// registered) when a SaveScenarioController is present in the tree —
// i.e. on the `/c/<token>` page. Renders nothing on the visitor error
// shells (404 / 410) where the controller isn't mounted.

import * as React from 'react';

import { Icons } from '@/components/shell/icons';

import { useOptionalSaveScenarioController } from './save-scenario-controller';

export function SaveScenarioHeaderButton() {
  const controller = useOptionalSaveScenarioController();
  if (!controller) return null;
  return (
    <button
      type="button"
      aria-label="Save scenario"
      onClick={controller.openSheet}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2 hover:text-cg-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent"
    >
      <Icons.Bookmark size={16} />
    </button>
  );
}
