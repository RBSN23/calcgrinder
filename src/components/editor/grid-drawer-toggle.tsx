'use client';

// PROJ-9 — Mobile Grid drawer.
//
// Rotated layout: one row per cell. Tap a row to focused-expand:
// the row's data-model panel takes over and other rows collapse
// out of view. Tap the chevron-down inside the expanded panel to
// return to the full list at the same scroll position.

import * as React from 'react';

import { EmptyOrErrorState } from '@/components/shell';
import { Icons } from '@/components/shell/icons';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { CellRow } from '@/lib/cells/types';
import { useEditor } from '@/lib/editor/EditorProvider';
import { cn } from '@/lib/utils';

import { CellDataModelPanel } from './cell-data-model-panel';

export function GridDrawerToggle() {
  const { state, dispatch, addSection, addCell, patchCell } = useEditor();
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  const orderedCells = React.useMemo(() => {
    const bySection = new Map(state.sections.map((s) => [s.id, s.display_order]));
    return [...state.cells].sort((a, b) => {
      const sa = bySection.get(a.section_id) ?? 0;
      const sb = bySection.get(b.section_id) ?? 0;
      if (sa !== sb) return sa - sb;
      return a.display_order - b.display_order;
    });
  }, [state.cells, state.sections]);

  const focusedCell = orderedCells.find((c) => c.id === focusedId) ?? null;

  React.useEffect(() => {
    if (!state.gridDrawerOpen) setFocusedId(null);
  }, [state.gridDrawerOpen]);

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
    <>
      <button
        type="button"
        aria-label="Toggle Grid drawer"
        aria-expanded={state.gridDrawerOpen}
        onClick={() =>
          dispatch({ type: 'SET_DRAWER_OPEN', open: !state.gridDrawerOpen })
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cg-border bg-cg-surface px-3 text-[12.5px] font-medium text-cg-text"
      >
        <Icons.LayoutGrid size={14} />
        <span>Grid</span>
        {orderedCells.length > 0 ? (
          <span className="rounded-full bg-cg-surface-2 px-1.5 font-mono text-[10px]">
            {orderedCells.length}
          </span>
        ) : null}
      </button>
      <Sheet
        open={state.gridDrawerOpen}
        onOpenChange={(open) => dispatch({ type: 'SET_DRAWER_OPEN', open })}
      >
        <SheetContent
          side="bottom"
          className="max-h-[70vh] overflow-y-auto border-cg-border bg-cg-surface p-3"
        >
          <SheetTitle className="text-base font-semibold text-cg-text">
            Grid
          </SheetTitle>
          {orderedCells.length === 0 ? (
            <div className="mt-4">
              <EmptyOrErrorState
                variant="empty"
                title="No cells yet"
                body="Tap “+ Add cell” to create the first cell."
              />
              <button
                type="button"
                onClick={handleAddCell}
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-cg-accent text-[13px] font-semibold text-cg-accent-fg"
              >
                + Add cell
              </button>
            </div>
          ) : focusedCell ? (
            <FocusedExpand
              cell={focusedCell}
              onPatch={(body) => patchCell(focusedCell.id, body)}
              onClose={() => setFocusedId(null)}
            />
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {orderedCells.map((cell) => (
                <DrawerRow key={cell.id} cell={cell} onFocus={() => setFocusedId(cell.id)} />
              ))}
              <button
                type="button"
                onClick={handleAddCell}
                className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-dashed border-cg-border text-[12.5px] font-medium text-cg-text-muted hover:bg-cg-surface-2"
              >
                + Add cell
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

interface DrawerRowProps {
  cell: CellRow;
  onFocus: () => void;
}

function DrawerRow({ cell, onFocus }: DrawerRowProps) {
  const preview =
    cell.kind === 'input'
      ? cell.default_value === null || cell.default_value === undefined
        ? '—'
        : String(cell.default_value)
      : cell.formula
        ? `= ${cell.formula}`
        : '= …';
  return (
    <button
      type="button"
      onClick={onFocus}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-cg-border bg-cg-surface px-3 py-2 text-left text-[13px] hover:bg-cg-surface-2"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[12px] font-medium">{cell.name}</span>
          <span
            className={cn(
              'rounded px-1.5 py-[1px] text-[9.5px] font-medium uppercase',
              cell.kind === 'input'
                ? 'bg-blue-500/10 text-blue-700'
                : 'bg-emerald-500/10 text-emerald-700',
            )}
          >
            {cell.kind}
          </span>
          {cell.visibility === 'hidden' ? (
            <span className="rounded bg-cg-surface-2 px-1.5 text-[9.5px] uppercase text-cg-text-muted">
              hidden
            </span>
          ) : null}
        </div>
        <span className="mt-0.5 truncate text-[11.5px] text-cg-text-muted">{preview}</span>
      </div>
      <Icons.ChevR size={14} className="text-cg-text-muted" />
    </button>
  );
}

function FocusedExpand({
  cell,
  onPatch,
  onClose,
}: {
  cell: CellRow;
  onPatch: React.ComponentProps<typeof CellDataModelPanel>['onPatch'];
  onClose: () => void;
}) {
  return (
    <div className="mt-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] text-cg-text-muted">
          Editing <span className="font-mono">{cell.name}</span>
        </span>
        <button
          type="button"
          aria-label="Back to cell list"
          onClick={onClose}
          className="inline-flex h-7 items-center gap-1 rounded text-[12px] text-cg-text hover:bg-cg-surface-2"
        >
          <Icons.ChevD size={14} />
          Back
        </button>
      </div>
      <CellDataModelPanel cell={cell} onPatch={onPatch} />
    </div>
  );
}
