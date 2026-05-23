'use client';

// PROJ-8 — Mobile editor footer nav.
//
// Spec-mandated layout: undo/redo group (left) · Grid drawer toggle (centre) ·
// "+ Add cell" button (right). The right slot is the +Add affordance instead
// of Preview because Preview ships with PROJ-10.

import * as React from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { Icons } from '../shell/icons';

import { GridDrawerToggle } from './grid-drawer-toggle';
import { UndoRedoButtons } from './undo-redo-buttons';

export function MobileFooterNav() {
  return (
    <nav
      aria-label="Editor actions"
      className="sticky bottom-0 z-20 flex h-14 shrink-0 items-center gap-2 border-t border-cg-border bg-cg-surface px-3"
    >
      <UndoRedoButtons />
      <span className="flex-1" />
      <GridDrawerToggle />
      <span className="flex-1" />
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <button
                type="button"
                aria-label="Add cell"
                disabled
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cg-accent text-cg-accent-fg opacity-60"
              >
                <Icons.Plus size={16} />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">Cell authoring ships next.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </nav>
  );
}
