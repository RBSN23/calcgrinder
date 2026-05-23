'use client';

// PROJ-8 — Undo / Redo buttons. Mirror the keyboard handlers in
// EditorProvider; visible in both the desktop toolbar and the mobile footer.

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';
import { cn } from '@/lib/utils';

interface UndoRedoButtonsProps {
  className?: string;
  compact?: boolean;
}

export function UndoRedoButtons({ className, compact = false }: UndoRedoButtonsProps) {
  const { state, undo, redo } = useEditor();
  const canUndo = state.past.length > 0 && !state.stale;
  const canRedo = state.future.length > 0 && !state.stale;

  const size = compact ? 'h-8 w-8' : 'h-8 w-8';

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={() => void undo()}
        className={cn(
          'inline-flex items-center justify-center rounded-md text-cg-text-muted outline-none transition-colors',
          'hover:bg-cg-surface-2 hover:text-cg-text focus-visible:ring-2 focus-visible:ring-cg-accent',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
          size,
        )}
      >
        <UndoGlyph />
      </button>
      <button
        type="button"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={() => void redo()}
        className={cn(
          'inline-flex items-center justify-center rounded-md text-cg-text-muted outline-none transition-colors',
          'hover:bg-cg-surface-2 hover:text-cg-text focus-visible:ring-2 focus-visible:ring-cg-accent',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
          size,
        )}
      >
        <RedoGlyph />
      </button>
    </div>
  );
}

function UndoGlyph() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 1 0 3-6.7L3 9" />
    </svg>
  );
}

function RedoGlyph() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 7v6h-6" />
      <path d="M21 13a9 9 0 1 1-3-6.7L21 9" />
    </svg>
  );
}
