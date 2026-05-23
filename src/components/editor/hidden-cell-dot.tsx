'use client';

// PROJ-9 — Hidden-cell dot.
//
// A small glowing accent dot rendered at the between-cards seam for
// every hidden cell. Click expands the cell's edit panel inline. The
// dot is keyboard-focusable and has an aria-label including the cell
// name.

import * as React from 'react';

import { useIsBuilder } from '@/components/calculator';
import type { CellRow } from '@/lib/cells/types';
import { useEditor } from '@/lib/editor/EditorProvider';
import { cn } from '@/lib/utils';

interface HiddenCellDotProps {
  cell: CellRow;
  accent: string;
}

export function HiddenCellDot({ cell, accent }: HiddenCellDotProps) {
  const isBuilder = useIsBuilder();
  if (!isBuilder) return null;
  return <HiddenCellDotInner cell={cell} accent={accent} />;
}

function HiddenCellDotInner({ cell, accent }: HiddenCellDotProps) {
  const { patchCell, removeCell } = useEditor();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Hidden cell: ${cell.label || cell.name}`}
        onClick={() => setOpen((v) => !v)}
        data-hidden-cell-id={cell.id}
        className={cn(
          'inline-block h-2 w-2 rounded-full transition-transform hover:scale-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cg-accent',
        )}
        style={{
          background: accent,
          boxShadow: `0 0 6px ${accent}`,
        }}
      />
      {open ? (
        <div className="basis-full rounded-md border border-cg-border bg-cg-surface p-3 text-cg-text">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-cg-text-muted">
                Hidden cell
              </span>
              <span className="text-[13px] font-medium">{cell.label || cell.name}</span>
              <span className="text-[11.5px] text-cg-text-muted">
                {cell.kind === 'input' ? 'Input' : 'Output'} · {cell.value_type}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded px-2 py-1 text-[11.5px] font-medium hover:bg-cg-surface-2"
                onClick={() =>
                  patchCell(cell.id, { visibility: 'visible' })
                }
              >
                Make visible
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-[11.5px] font-medium text-red-600 hover:bg-red-50"
                onClick={() => removeCell(cell.id)}
              >
                Delete
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-cg-text-muted hover:bg-cg-surface-2"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
