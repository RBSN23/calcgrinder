'use client';

// PROJ-8 — Grid panel scaffold (desktop).
//
// PROJ-8 owns the chrome: header strip with a chevron-collapse, an empty
// element-listing area, and the height/collapsed wiring from the editor
// reducer. PROJ-9 will fill the body with cell columns + the data-model
// expand. The header always shows "0 cells" because the cells array is
// empty in PROJ-8.

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';
import { cn } from '@/lib/utils';

import { Icons } from '../shell/icons';

export function GridPanel() {
  const { state, dispatch } = useEditor();
  const { gridHeight, gridCollapsed } = state;

  return (
    <section
      aria-label="Grid panel"
      style={{ height: gridHeight }}
      className="relative flex shrink-0 flex-col overflow-hidden border-b border-cg-border bg-cg-surface"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-cg-border px-3">
        <button
          type="button"
          aria-label={gridCollapsed ? 'Expand Grid panel' : 'Collapse Grid panel'}
          aria-expanded={!gridCollapsed}
          onClick={() => dispatch({ type: 'TOGGLE_GRID_COLLAPSED' })}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-cg-text-muted outline-none transition-colors hover:bg-cg-surface-2 hover:text-cg-text focus-visible:ring-2 focus-visible:ring-cg-accent"
        >
          <span
            className={cn(
              'inline-flex transition-transform duration-150',
              gridCollapsed ? 'rotate-180' : 'rotate-0',
            )}
            aria-hidden
          >
            <Icons.ChevD size={14} />
          </span>
        </button>
        <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.6px] text-cg-text-muted">
          Grid
        </h2>
        <span className="rounded-full border border-cg-border bg-cg-surface-2 px-[7px] py-[1px] font-mono text-[10.5px] font-medium text-cg-text-muted">
          0
        </span>
        <span className="flex-1" />
      </header>
      {!gridCollapsed ? (
        <div className="flex flex-1 items-center justify-center bg-cg-bg px-4 text-[12.5px] text-cg-text-subtle">
          No cells yet — use “Add” in the Builder to create the first cell.
        </div>
      ) : null}
    </section>
  );
}
