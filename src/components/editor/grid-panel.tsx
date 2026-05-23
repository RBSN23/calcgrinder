'use client';

// PROJ-8 / PROJ-9 — Grid panel.
//
// PROJ-8 owns the chrome (header strip with chevron-collapse +
// height/collapsed wiring). PROJ-9 fills the body with one column per
// cell (in section-then-`display_order` order), each column rendering
// header + data row + optional kebab-expand data-model panel.

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';
import { cn } from '@/lib/utils';

import { Icons } from '../shell/icons';

import { GridColumn } from './grid-column';

export function GridPanel() {
  const { state, dispatch, addSection, addCell } = useEditor();
  const { gridHeight, gridCollapsed, sections, cells } = state;

  // Use section-then-display_order to lay columns out
  const orderedCells = React.useMemo(() => {
    const bySection = new Map(sections.map((s) => [s.id, s.display_order]));
    return [...cells].sort((a, b) => {
      const sa = bySection.get(a.section_id) ?? 0;
      const sb = bySection.get(b.section_id) ?? 0;
      if (sa !== sb) return sa - sb;
      return a.display_order - b.display_order;
    });
  }, [cells, sections]);

  const handleAddCell = React.useCallback(() => {
    const last = sections[sections.length - 1];
    if (last) {
      void addCell(last.id);
    } else {
      void addSection().then((section) => {
        if (section) void addCell(section.id);
      });
    }
  }, [sections, addCell, addSection]);

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
          {orderedCells.length}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          aria-label="Add cell"
          onClick={handleAddCell}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-cg-border bg-cg-surface px-2 text-[12px] text-cg-text-muted hover:bg-cg-surface-2"
        >
          <Icons.Plus size={12} />
          add cell
        </button>
      </header>
      {!gridCollapsed ? (
        orderedCells.length === 0 ? (
          <div className="flex flex-1 items-center justify-center bg-cg-bg px-4 text-[12.5px] text-cg-text-subtle">
            No cells yet — use “+ add cell” to create the first cell.
          </div>
        ) : (
          <div className="flex flex-1 overflow-auto bg-cg-bg">
            {orderedCells.map((cell) => (
              <GridColumn key={cell.id} cell={cell} />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}
