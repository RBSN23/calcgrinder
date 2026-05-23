'use client';

// PROJ-9 — Hidden-cells toolbar pill + popover.
//
// Only visible when at least one cell on the calculator has
// visibility = 'hidden'. Pill text uses singular / plural correctly.
// Click → popover listing every hidden cell by label (fallback name);
// each row scrolls to the corresponding dot.

import * as React from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEditor } from '@/lib/editor/EditorProvider';
import { useEvaluationContext } from '@/lib/editor/EvaluationContext';
import { cn } from '@/lib/utils';

export function HiddenCellsPill() {
  const { state } = useEditor();
  const { results } = useEvaluationContext();
  const hidden = React.useMemo(
    () => state.cells.filter((c) => c.visibility === 'hidden'),
    [state.cells],
  );
  const [open, setOpen] = React.useState(false);
  if (hidden.length === 0) return null;

  const hasError = hidden.some((c) => Boolean(results[c.name]?.error));
  const labelText =
    hidden.length === 1 ? '1 hidden cell' : `${hidden.length} hidden cells`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${labelText}. Show list.`}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11.5px] font-medium transition-colors',
            'border-cg-border bg-cg-surface text-cg-text hover:bg-cg-surface-2',
            hasError && 'ring-1 ring-red-500/60',
          )}
        >
          <DotIcon />
          {labelText}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[240px] border-cg-border bg-cg-surface p-1"
      >
        <ul role="menu" className="flex flex-col">
          {hidden.map((cell) => {
            const error = results[cell.name]?.error;
            return (
              <li key={cell.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    const el = document.querySelector(
                      `[data-hidden-cell-id="${cell.id}"]`,
                    ) as HTMLElement | null;
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.click();
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-cg-text hover:bg-cg-surface-2"
                >
                  <span className="truncate">{cell.label || cell.name}</span>
                  {error ? (
                    <span className="text-[10px] text-red-600" aria-label="has error">
                      !
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function DotIcon() {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 rounded-full bg-cg-accent"
      style={{ boxShadow: '0 0 4px var(--cg-accent)' }}
    />
  );
}
