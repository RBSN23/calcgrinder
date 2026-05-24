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

import { AddPicker } from './add-picker';
import { ChartGridColumn } from './chart-grid-column';
import { GridColumn } from './grid-column';
import { useAddPickerOptions } from './use-add-picker-options';

interface OrderedColumn {
  kind: 'cell' | 'chart';
  id: string;
  sectionDisplayOrder: number;
  displayOrder: number;
}

export function GridPanel() {
  const { state, dispatch } = useEditor();
  const { gridHeight, gridCollapsed, sections, cells, charts } = state;
  const options = useAddPickerOptions();

  // Interleave cells + charts by section-then-display_order to lay columns out.
  const orderedColumns = React.useMemo<OrderedColumn[]>(() => {
    const bySection = new Map(sections.map((s) => [s.id, s.display_order]));
    const cellCols: OrderedColumn[] = cells.map((c) => ({
      kind: 'cell',
      id: c.id,
      sectionDisplayOrder: bySection.get(c.section_id) ?? 0,
      displayOrder: c.display_order,
    }));
    const chartCols: OrderedColumn[] = charts.map((c) => ({
      kind: 'chart',
      id: c.id,
      sectionDisplayOrder: bySection.get(c.section_id) ?? 0,
      displayOrder: c.display_order,
    }));
    return [...cellCols, ...chartCols].sort((a, b) => {
      if (a.sectionDisplayOrder !== b.sectionDisplayOrder)
        return a.sectionDisplayOrder - b.sectionDisplayOrder;
      return a.displayOrder - b.displayOrder;
    });
  }, [cells, charts, sections]);

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
          {orderedColumns.length}
        </span>
        <span className="flex-1" />
        <AddPicker options={options} />
      </header>
      {!gridCollapsed ? (
        orderedColumns.length === 0 ? (
          <div className="flex flex-1 items-center justify-center bg-cg-bg px-4 text-[12.5px] text-cg-text-subtle">
            No cells yet — use the + Add menu to create the first element.
          </div>
        ) : (
          <div className="flex flex-1 overflow-auto bg-cg-bg">
            {orderedColumns.map((col) => {
              if (col.kind === 'cell') {
                const cell = cells.find((c) => c.id === col.id);
                return cell ? <GridColumn key={cell.id} cell={cell} /> : null;
              }
              const chart = charts.find((c) => c.id === col.id);
              return chart ? <ChartGridColumn key={chart.id} chart={chart} /> : null;
            })}
          </div>
        )
      ) : null}
    </section>
  );
}
