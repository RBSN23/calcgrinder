'use client';

// PROJ-9 / PROJ-23 — Grid column (one per cell).
//
// Header strip (name + kind pill + visibility chip + chevron toggle) +
// data row (value preview for Inputs, formula text for Outputs) +
// global expand-in-place settings panel.
//
// PROJ-23 changes:
// - Per-column `expanded` replaced by global `gridSettingsExpanded`.
// - Kebab ⋮ replaced by a chevron toggle.
// - Double-click on name text triggers inline rename (Issue 2).

import * as React from 'react';

import {
  computeTabularActionPatch,
  evaluateSpeculative,
} from '@/lib/cells/tabular-action';
import type { CellRow } from '@/lib/cells/types';
import { validateCellName } from '@/lib/cells/types';
import { useEditor } from '@/lib/editor/EditorProvider';
import { useEvaluationContext } from '@/lib/editor/EvaluationContext';
import { cn } from '@/lib/utils';

import { Icons } from '../shell/icons';

import { CellDataModelPanel } from './cell-data-model-panel';

interface GridColumnProps {
  cell: CellRow;
}

export function GridColumn({ cell }: GridColumnProps) {
  const [editingFormula, setEditingFormula] = React.useState(false);
  const [editingValue, setEditingValue] = React.useState(false);
  const [editingName, setEditingName] = React.useState(false);
  const [draftName, setDraftName] = React.useState(cell.name);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [draftFormula, setDraftFormula] = React.useState(cell.formula ?? '');
  const [draftValue, setDraftValue] = React.useState(
    cell.default_value === null || cell.default_value === undefined
      ? ''
      : String(cell.default_value),
  );
  const { patchCell, state, dispatch } = useEditor();
  const { getResult, inputs } = useEvaluationContext();
  const result = getResult(cell.name);
  const errorMsg = result?.error?.message ?? null;
  const expanded = state.gridSettingsExpanded;

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
  React.useEffect(() => setDraftName(cell.name), [cell.name]);

  const commitName = React.useCallback(async () => {
    if (draftName === cell.name) {
      setEditingName(false);
      setNameError(null);
      return;
    }
    const v = validateCellName(draftName);
    if (!v.ok) {
      setNameError(
        v.reason === 'name_invalid'
          ? 'Lowercase letters, digits, underscores. Starts with a letter.'
          : v.reason === 'name_reserved'
            ? `"${v.reservedWord}" is reserved.`
            : 'Name required.',
      );
      return;
    }
    const existing = state.cells.find(
      (c) => c.id !== cell.id && c.name === v.value,
    );
    if (existing) {
      setNameError('Name already in use.');
      return;
    }
    setNameError(null);
    await patchCell(cell.id, { name: v.value });
    setEditingName(false);
  }, [draftName, cell.name, cell.id, patchCell, state.cells]);

  return (
    <div
      data-grid-cell-id={cell.id}
      className="flex w-[200px] shrink-0 flex-col border-r border-cg-border bg-cg-surface"
    >
      {/* Header strip */}
      <header className="flex items-center gap-1 border-b border-cg-border px-2 py-1.5">
        <div className="flex min-w-0 flex-1 flex-col">
          {editingName ? (
            <div className="flex flex-col">
              <input
                autoFocus
                type="text"
                value={draftName}
                maxLength={40}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  setNameError(null);
                }}
                onBlur={() => void commitName()}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void commitName();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setDraftName(cell.name);
                    setEditingName(false);
                    setNameError(null);
                  }
                }}
                aria-label="Rename cell"
                aria-invalid={nameError ? true : undefined}
                className={cn(
                  'w-full truncate border-none bg-transparent font-mono text-[11px] font-medium text-cg-text outline-none ring-1 rounded px-0.5',
                  nameError ? 'ring-red-500' : 'ring-cg-accent/40',
                )}
              />
              {nameError ? (
                <p className="mt-0.5 text-[9.5px] text-red-600">{nameError}</p>
              ) : null}
            </div>
          ) : (
            <span
              className="cursor-text truncate font-mono text-[11px] font-medium text-cg-text"
              onDoubleClick={() => {
                setDraftName(cell.name);
                setEditingName(true);
              }}
            >
              {cell.name}
            </span>
          )}
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
          aria-label={expanded ? 'Collapse cell settings' : 'Expand cell settings'}
          aria-expanded={expanded}
          onClick={() => dispatch({ type: 'TOGGLE_GRID_SETTINGS' })}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-cg-text-muted hover:bg-cg-surface-2"
        >
          <span
            className={cn(
              'inline-flex transition-transform duration-150',
              expanded ? 'rotate-180' : 'rotate-0',
            )}
            aria-hidden
          >
            <Icons.ChevD size={12} />
          </span>
        </button>
      </header>

      {/* Data row */}
      <div
        className={cn(
          'px-2 py-2 text-[12px]',
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

      {/* PROJ-23 — Expand-in-place settings panel (global toggle) */}
      {expanded ? (
        <div className="border-t border-cg-border bg-cg-surface-2">
          <CellDataModelPanel
            cell={cell}
            onPatch={commitCellPatch}
          />
        </div>
      ) : null}
    </div>
  );
}
