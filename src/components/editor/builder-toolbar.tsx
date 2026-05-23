'use client';

// PROJ-8 — Builder toolbar (desktop).
//
// Layout: Undo · Redo · separator · ViewportPicker · spacer · AddPicker.
// Preview, hidden-cells pill and code-import sparkles are intentionally
// omitted — they ship with PROJ-10 / PROJ-9 / PROJ-21 respectively.

import * as React from 'react';

import { AddPicker, PROJ_8_OPTIONS } from './add-picker';
import { UndoRedoButtons } from './undo-redo-buttons';
import { ViewportPicker } from './viewport-picker';

export function BuilderToolbar() {
  return (
    <div
      role="toolbar"
      aria-label="Builder toolbar"
      className="flex h-11 shrink-0 items-center gap-2 border-b border-cg-border bg-cg-surface px-3"
    >
      <UndoRedoButtons />
      <span className="mx-1 h-5 w-px bg-cg-border" aria-hidden />
      <ViewportPicker />
      <span className="flex-1" />
      <AddPicker options={PROJ_8_OPTIONS} />
    </div>
  );
}
