'use client';

// PROJ-9 — Grid column (one per cell).
//
// Header strip (name + kind pill + visibility chip + kebab) + data row
// (value preview for Inputs, formula text for Outputs) + kebab-expand
// data-model panel.

import * as React from 'react';

import {
  computeTabularActionPatch,
  evaluateSpeculative,
} from '@/lib/cells/tabular-action';
import type { CellRow } from '@/lib/cells/types';
import { useEditor } from '@/lib/editor/EditorProvider';
import { useEvaluationContext } from '@/lib/editor/EvaluationContext';
import { cn } from '@/lib/utils';

import { CellDataModelPanel } from './cell-data-model-panel';

interface GridColumnProps {
  cell: CellRow;
  defaultExpanded?: boolean;
}

export function GridColumn({ cell, defaultExpanded = false }: GridColumnProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [editingFormula, setEditingFormula] = React.useState(false);
  const [editingValue, setEditingValue] = React.useState(false);
  const [draftFormula, setDraftFormula] = React.useState(cell.formula ?? '');
  const [draftValue, setDraftValue] = React.useState(
    cell.default_value === null || cell.default_value === undefined
      ? ''
      : String(cell.default_value),
  );
  const { patchCell, state } = useEditor();
  const { getResult, inputs } = useEvaluationContext();
  const result = getResult(cell.name);
  const errorMsg = result?.error?.message ?? null;

  // BUG-M1 fix — single patchCell wrapper shared between the Grid
  // panel's formula input and the data-model panel's formula input.
  // When the body carries a `formula` change, speculatively evaluate
  // the new formula and bundle the resulting `tabular_columns` delta
  // (seed-on-first-fire OR smart-merge) into the SAME PATCH. One
  // PATCH → one `recordOperation` → one undo entry that reverts
  // formula + emphasis + columns + size_hint atomically.
  const commitCellPatch = React.useCallback(
    (body: Parameters<typeof patchCell>[1]) => {
      const next = body as { formula?: string | null };
      if (typeof next.formula === 'string' && next.formula !== (cell.formula ?? '')) {
        const speculativeResult = evaluateSpeculative(
          state.cells,
          inputs,
          cell.id,
          next.formula,
        );
        const tabularPatch = computeTabularActionPatch({
          cell,
          nextEmphasis: cell.display_emphasis,
          result: speculativeResult,
        });
        return patchCell(cell.id, { ...body, ...tabularPatch });
      }
      return patchCell(cell.id, body);
    },
    [cell, inputs, patchCell, state.cells],
  );

  React.useEffect(() => setDraftFormula(cell.formula ?? ''), [cell.formula]);
  React.useEffect(
    () =>
      setDraftValue(
        cell.default_value === null || cell.default_value === undefined
          ? ''
          : String(cell.default_value),
      ),
    [cell.default_value],
  );

  return (
    <div
      data-grid-cell-id={cell.id}
      className="flex w-[200px] shrink-0 flex-col border-r border-cg-border bg-cg-surface"
    >
      {/* Header strip */}
      <header className="flex items-center gap-1 border-b border-cg-border px-2 py-1.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-mono text-[11px] font-medium text-cg-text">
            {cell.name}
          </span>
          <div className="flex items-center gap-1">
            <span
              className={cn(
                'rounded px-1 py-0 text-[9.5px] font-medium uppercase tracking-wide',
                cell.kind === 'input'
                  ? 'bg-blue-500/10 text-blue-700'
                  : 'bg-emerald-500/10 text-emerald-700',
              )}
            >
              {cell.kind}
            </span>
            {cell.visibility === 'hidden' ? (
              <span className="rounded bg-cg-surface-2 px-1 text-[9.5px] uppercase text-cg-text-muted">
                hidden
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label={expanded ? 'Collapse cell details' : 'Expand cell details'}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-cg-text-muted hover:bg-cg-surface-2"
        >
          ⋮
        </button>
      </header>

      {/* Data row */}
      <div
        className={cn(
          'flex-1 px-2 py-2 text-[12px]',
          errorMsg && 'text-red-700',
        )}
      >
        {cell.kind === 'input' ? (
          editingValue ? (
            <input
              autoFocus
              type="text"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={async () => {
                setEditingValue(false);
                if (draftValue !== String(cell.default_value ?? '')) {
                  const coerced =
                    draftValue === ''
                      ? undefined
                      : cell.value_type === 'number' ||
                          cell.value_type === 'currency' ||
                          cell.value_type === 'percent'
                        ? Number(draftValue)
                        : draftValue;
                  await patchCell(cell.id, { default_value: coerced });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingValue(false);
                }
              }}
              className="w-full border-b border-cg-accent bg-transparent outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingValue(true)}
              className="w-full text-left hover:bg-cg-surface-2"
            >
              {cell.default_value === null || cell.default_value === undefined
                ? <span className="text-cg-text-subtle">—</span>
                : String(cell.default_value)}
            </button>
          )
        ) : editingFormula ? (
          <input
            autoFocus
            type="text"
            value={draftFormula}
            onChange={(e) => setDraftFormula(e.target.value)}
            onBlur={async () => {
              setEditingFormula(false);
              if (draftFormula !== (cell.formula ?? '')) {
                await commitCellPatch({ formula: draftFormula });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditingFormula(false);
              }
            }}
            className={cn(
              'w-full border-b border-cg-accent bg-transparent font-mono outline-none',
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingFormula(true)}
            className={cn(
              'w-full text-left font-mono hover:bg-cg-surface-2',
              errorMsg && 'underline decoration-red-500 decoration-dotted',
            )}
            title={errorMsg ?? undefined}
          >
            {cell.formula
              ? `= ${cell.formula}`
              : <span className="text-cg-text-subtle">= …</span>}
          </button>
        )}
        {errorMsg ? (
          <p className="mt-0.5 truncate text-[10.5px] text-red-600" title={errorMsg}>
            {errorMsg}
          </p>
        ) : null}
      </div>

      {/* Expand panel */}
      {expanded ? (
        <div className="border-t border-cg-border bg-cg-surface-2">
          <CellDataModelPanel
            cell={cell}
            onPatch={commitCellPatch}
            onClose={() => setExpanded(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
