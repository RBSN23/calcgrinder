'use client';

// PROJ-8 — Viewport-width picker (Desktop / Tablet / Mobile).
//
// Session-scoped: selection lives in the editor reducer (state.viewportMode)
// and resets on reload. The Builder canvas constrains its preview width to
// match.

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';
import type { ViewportMode } from '@/lib/editor/reducer';
import { cn } from '@/lib/utils';

import { Icons } from '../shell/icons';

interface ViewportOption {
  mode: ViewportMode;
  label: string;
  icon: React.ReactNode;
}

const OPTIONS: ViewportOption[] = [
  { mode: 'desktop', label: 'Desktop', icon: <Icons.Monitor size={14} /> },
  { mode: 'tablet', label: 'Tablet', icon: <Icons.LayoutGrid size={14} /> },
  { mode: 'mobile', label: 'Mobile', icon: <Icons.Menu size={14} /> },
];

export function ViewportPicker({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useEditor();
  return (
    <div
      role="radiogroup"
      aria-label="Builder preview width"
      className="inline-flex h-8 items-center rounded-md border border-cg-border bg-cg-surface p-0.5"
    >
      {OPTIONS.map((opt) => {
        const selected = state.viewportMode === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            onClick={() => dispatch({ type: 'SET_VIEWPORT', mode: opt.mode })}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded px-2 text-[12.5px] font-medium transition-colors',
              selected
                ? 'bg-cg-surface-2 text-cg-text'
                : 'text-cg-text-muted hover:text-cg-text',
            )}
          >
            {opt.icon}
            {!compact ? <span>{opt.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function viewportMaxWidth(mode: ViewportMode): string {
  switch (mode) {
    case 'tablet':
      return '768px';
    case 'mobile':
      return '390px';
    case 'desktop':
    default:
      return '1200px';
  }
}
