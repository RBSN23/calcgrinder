'use client';

// PROJ-9 — Mobile editor footer nav.
//
// Spec-mandated layout: undo/redo group (left) · Grid drawer toggle (centre) ·
// "+ Add cell" button (right). The +Add affordance is enabled in PROJ-9.

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';

import { Icons } from '../shell/icons';

import { GridDrawerToggle } from './grid-drawer-toggle';
import { UndoRedoButtons } from './undo-redo-buttons';

export function MobileFooterNav() {
  const { state, addCell, addSection } = useEditor();
  const handleAddCell = () => {
    const last = state.sections[state.sections.length - 1];
    if (last) {
      void addCell(last.id);
    } else {
      void addSection().then((section) => {
        if (section) void addCell(section.id);
      });
    }
  };
  return (
    <nav
      aria-label="Editor actions"
      className="sticky bottom-0 z-20 flex h-14 shrink-0 items-center gap-2 border-t border-cg-border bg-cg-surface px-3"
    >
      <UndoRedoButtons />
      <span className="flex-1" />
      <GridDrawerToggle />
      <span className="flex-1" />
      <button
        type="button"
        aria-label="Add cell"
        onClick={handleAddCell}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cg-accent text-cg-accent-fg"
      >
        <Icons.Plus size={16} />
      </button>
    </nav>
  );
}
