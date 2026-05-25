'use client';

// PROJ-9 / PROJ-11 — Cell card (shared by Builder and Visitor).
//
// Renders one visible cell: label, description, input widget (for
// Inputs) or computed value (for Outputs), error states, card-level
// visuals. The hover-pencil edit affordance + visual panel + drag
// handle render ONLY in builder mode — gated by `useInteractivity()`.

import * as React from 'react';

import {
  useCalculatorState,
  useIsBuilder,
  useIsVisitor,
} from '@/components/calculator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CellLockToggle } from '@/components/visitor/cell-lock-toggle';
import { useOptionalVisitorInputStore } from '@/components/visitor/visitor-input-store';
import { formatCellValue } from '@/lib/cells/format';
import { computeTabularActionPatch } from '@/lib/cells/tabular-action';
import {
  reconcileTabularColumns,
  seedTabularColumns,
} from '@/lib/cells/tabular-reconcile';
import type { CellRow, TabularColumn } from '@/lib/cells/types';
import { useEditor, useOptionalEditor } from '@/lib/editor/EditorProvider';
import { cardSurface, labelTextStyle, numberStyle, type Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';
import type { CellResult } from '@/lib/formula';

import { CellInputWidget } from './cell-input-widget';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CellVisualPanel } from './cell-visual-panel';
import { DragHandle } from './dnd-helpers';
import { TabularRenderer } from './tabular-renderer';

interface CellCardProps {
  cell: CellRow;
  theme: Theme;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
}

export function CellCard({ cell, theme, dragHandleProps, isDragging }: CellCardProps) {
  const { getResult, inputs, setInput } = useCalculatorState();
  const isBuilder = useIsBuilder();
  const isVisitor = useIsVisitor();
  const visitorStore = useOptionalVisitorInputStore();
  // PROJ-12 — per-cell lock state. Only applies to visitor mode AND
  // to editable cells; readonly cells skip the lock toggle entirely
  // (they're inherently non-interactive).
  const isEditable = cell.editability === 'editable';
  const lockToggleVisible =
    isVisitor && isEditable && cell.visibility !== 'hidden';
  const isLocked = lockToggleVisible
    ? visitorStore?.isLocked(cell.name) ?? false
    : false;

  const result = getResult(cell.name);
  const tintKind = cell.kind === 'output' ? 'results' : 'inputs';
  const surface = cardSurface(theme, tintKind);

  // PROJ-17 — Lazy first-Tabular-activation. Fires once per cell, on
  // either (a) emphasis explicitly switched to 'tabular', or (b) the
  // auto-fallback path (default 'plain' emphasis + array_of_objects
  // formula + empty config). The PATCH carries the seed columns AND
  // the narrow→wide card_size_hint bump (one-time). Builder-only —
  // visitors never mutate cell config.
  useTabularAutoPopulation(cell, result, isBuilder);

  const cardStyle: React.CSSProperties = {
    ...surface,
    padding: 14,
    position: 'relative',
  };

  if (cell.card_border === 'hairline') {
    cardStyle.border = `1px solid ${theme.border}`;
  } else if (cell.card_border === 'strong') {
    cardStyle.border = `2px solid ${theme.borderStr}`;
  }
  if (cell.card_background_tint === 'soft') {
    cardStyle.background = theme.cardAlt;
  } else if (cell.card_background_tint === 'strong') {
    cardStyle.background = theme.accentSoft;
  }

  const errorMsg = result?.error?.message ?? null;
  const isError = !!errorMsg;
  const isArrayResult =
    result &&
    !result.error &&
    (result.shape === 'array_of_scalars' || result.shape === 'array_of_objects');

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2',
        isError && 'ring-1 ring-red-500/60 ring-offset-1',
        isDragging && 'ring-2 ring-cg-accent/40',
      )}
      style={cardStyle}
      data-cell-id={cell.id}
    >
      {isBuilder && dragHandleProps ? (
        <div className="pointer-events-none absolute left-1.5 top-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <DragHandle
            ariaLabel={`Reorder cell: ${cell.label || cell.name}`}
            {...dragHandleProps}
          />
        </div>
      ) : null}
      {isBuilder ? <CellEditAffordance cell={cell} theme={theme} /> : null}
      {lockToggleVisible ? (
        <div className="absolute right-2 top-2">
          <CellLockToggle cellName={cell.name} cellLabel={cell.label || cell.name} />
        </div>
      ) : null}

      <div className="flex items-baseline justify-between gap-2">
        <span style={labelTextStyle(theme, theme.muted)}>{cell.label || cell.name}</span>
        {isBuilder ? <CellKindPill kind={cell.kind} /> : null}
      </div>

      {cell.description && cell.description_render === 'caption' ? (
        <p className="text-[11.5px] leading-snug" style={{ color: theme.subtle }}>
          {cell.description}
        </p>
      ) : null}

      {cell.kind === 'input' ? (
        <CellInputWidget
          cell={cell}
          theme={theme}
          value={inputs[cell.name] ?? cell.default_value ?? undefined}
          onChange={(v) => setInput(cell.name, v)}
          readOnly={cell.editability === 'readonly'}
          locked={isLocked}
        />
      ) : (
        <OutputDisplay
          cell={cell}
          theme={theme}
          result={result}
          isArrayResult={Boolean(isArrayResult)}
          errorMsg={errorMsg}
        />
      )}

      {cell.kind === 'input' && cell.description && cell.description_render === 'tooltip' ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="self-start text-[11px] text-cg-text-muted underline decoration-dotted">
                ?
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{cell.description}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}

interface CellEditAffordanceProps {
  cell: CellRow;
  theme: Theme;
}

function CellEditAffordance({ cell, theme }: CellEditAffordanceProps) {
  const { patchCell, removeCell } = useEditor();
  const { getResult } = useCalculatorState();
  const [panelOpen, setPanelOpen] = React.useState(false);
  // BUG-M1 fix — intercept emphasis switches that flip TO 'tabular' on
  // a default-emphasis cell. Bundle the first-time seed (+ size_hint
  // bump) into the SAME patchCell so the user's "click Tabular" maps
  // to one undo entry, not two. All other PATCHes pass through
  // unchanged. (Emphasis switches AWAY from 'tabular' don't trigger
  // any tabular_columns mutation by design — the persisted config
  // survives cycling per spec.)
  const handlePatch = React.useCallback(
    (body: Parameters<typeof patchCell>[1]) => {
      const next = body as { display_emphasis?: CellRow['display_emphasis'] };
      if (
        next.display_emphasis &&
        next.display_emphasis !== cell.display_emphasis
      ) {
        const tabularPatch = computeTabularActionPatch({
          cell,
          nextEmphasis: next.display_emphasis,
          result: getResult(cell.name),
        });
        return patchCell(cell.id, { ...body, ...tabularPatch });
      }
      return patchCell(cell.id, body);
    },
    [cell, getResult, patchCell],
  );
  return (
    <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
      <Popover open={panelOpen} onOpenChange={setPanelOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Edit cell appearance"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cg-surface/90 text-cg-text-muted shadow-sm ring-1 ring-cg-border hover:text-cg-text"
          >
            <PencilIcon />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-[320px] border-cg-border bg-cg-surface p-3"
        >
          <CellVisualPanel
            cell={cell}
            theme={theme}
            onClose={() => setPanelOpen(false)}
            onPatch={handlePatch}
            onRemove={() => {
              setPanelOpen(false);
              void removeCell(cell.id);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CellKindPill({ kind }: { kind: 'input' | 'output' }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-[1px] font-mono text-[9.5px] font-medium uppercase tracking-wide',
        kind === 'input'
          ? 'bg-blue-500/10 text-blue-700'
          : 'bg-emerald-500/10 text-emerald-700',
      )}
    >
      {kind}
    </span>
  );
}

interface OutputDisplayProps {
  cell: CellRow;
  theme: Theme;
  result: CellResult | undefined;
  isArrayResult: boolean;
  errorMsg: string | null;
}

function OutputDisplay({ cell, theme, result, isArrayResult, errorMsg }: OutputDisplayProps) {
  if (errorMsg) {
    return (
      <p className="text-[12.5px] font-medium text-red-600" role="alert">
        {errorMsg}
      </p>
    );
  }
  // PROJ-17 — Tabular dispatch.
  //
  // Render the shared TabularRenderer when:
  //   * emphasis is explicitly 'tabular' (the authoritative signal —
  //     either the maintainer picked it, OR the auto-pop effect
  //     promoted the cell on first array_of_objects evaluation); OR
  //   * emphasis is the default 'plain' AND the formula returns
  //     array_of_objects AND tabular_columns is empty (auto-fallback
  //     bootstrap-paint — only true for one render in builder mode,
  //     between mount and the auto-pop PATCH landing; visitor surfaces
  //     never enter this branch because they never get the chance to
  //     mutate the cell, but the renderer still paints correctly
  //     against the empty config).
  const tabularBranch = isTabularBranchActive(cell, result);
  if (tabularBranch === 'tabular') {
    if (result?.shape === 'array_of_scalars') {
      return (
        <p className="text-[12.5px] font-medium text-red-600" role="alert">
          Expected array of objects, got array of scalars.
        </p>
      );
    }
    const rows = extractTabularRows(result);
    return (
      <TabularRenderer
        columns={cell.tabular_columns ?? []}
        rows={rows}
        theme={theme}
        cellCurrencyCode={cell.currency_code}
      />
    );
  }
  // Best-effort scalar render (also covers PROJ-9 KPI fallback for
  // array results once tabular_columns is non-empty AND emphasis is
  // 'plain' — see Edge Cases in spec).
  const rawValue = result?.value;
  const value = isArrayResult ? extractFirstScalar(rawValue) : rawValue;
  const formatted = formatCellValue(cell, value);
  const sizeMap = { s: 18, m: 28, l: 28, xl: 40 } as const;
  const size = (sizeMap[cell.text_size as keyof typeof sizeMap] ?? 28) as 18 | 28 | 40;
  return (
    <div style={numberStyle(theme, size)}>{formatted}</div>
  );
}

/**
 * Decide whether the cell renders via the TabularRenderer or via the
 * scalar/KPI path.
 *
 * Returns `'tabular'` when:
 *   1. `display_emphasis === 'tabular'` — the authoritative signal.
 *      This covers both the explicit maintainer choice and the post-
 *      auto-pop state (the seed effect promotes default-plain cells to
 *      explicit tabular emphasis in the same PATCH that seeds the
 *      columns, so subsequent renders enter this branch unambiguously
 *      via the explicit field). The renderer surfaces shape errors
 *      inline so the config isn't lost across temporary formula breaks.
 *   2. The bootstrap-paint case: `display_emphasis === 'plain'` AND
 *      `tabular_columns` is empty AND the formula returns
 *      `array_of_objects`. In builder mode this is true only between
 *      mount and the auto-pop PATCH landing (the PATCH flips emphasis
 *      to 'tabular', moving the cell into branch 1). In visitor mode
 *      the auto-pop hook is gated off, so a cell that was never opened
 *      in the builder lands here — the renderer paints against the
 *      empty config and the table shows headers + "No data" if rows
 *      exist for unknown keys.
 *
 * After auto-pop runs once, `display_emphasis` is the durable signal —
 * never the implicit `tabular_columns.length === 0` flag. A maintainer
 * who explicitly flips emphasis back to 'plain' lands neither branch
 * and renders the scalar/KPI first-value fallback (Edge Case spec line
 * 750-766 "plain means plain").
 */
function isTabularBranchActive(
  cell: CellRow,
  result: CellResult | undefined,
): 'tabular' | 'scalar' {
  if (cell.display_emphasis === 'tabular') return 'tabular';
  if (
    cell.display_emphasis === 'plain' &&
    (cell.tabular_columns ?? []).length === 0 &&
    result?.shape === 'array_of_objects'
  ) {
    return 'tabular';
  }
  return 'scalar';
}

function extractTabularRows(result: CellResult | undefined): unknown[] {
  if (!result || result.error) return [];
  if (Array.isArray(result.value)) return result.value;
  return [];
}

function extractFirstScalar(raw: unknown): unknown {
  if (!Array.isArray(raw) || raw.length === 0) return raw;
  const first = raw[0];
  if (first === null || first === undefined) return undefined;
  if (typeof first === 'object') {
    for (const v of Object.values(first as Record<string, unknown>)) {
      return v;
    }
    return undefined;
  }
  return first;
}

// BUG-M2 — module-level "we've already seeded this cell's first-row
// keys in this page session" cache. Keyed by `${cellId}::${firstRowKeysSig}`
// so a formula edit that changes the row shape can still re-seed once
// (in practice it never has to — the handler-driven seed bundles into
// the formula commit PATCH via the BUG-M1 path).
//
// Lives at module scope on purpose: React strict-mode double-mounts
// reset every `useRef`/`useState` in the component, so a per-mount
// flag wasn't enough to prevent the second mount from re-firing the
// seed PATCH against the (still-empty) pre-PATCH state. A module-level
// Set survives the unmount/remount and lets the second mount short-
// circuit naturally. Cleared on hard reload by virtue of being module
// state.
const seededAutoPopBootstraps = new Set<string>();

/**
 * PROJ-17 — Side-effect that auto-populates `tabular_columns`, promotes
 * `display_emphasis` from 'plain' to 'tabular' on the auto-fallback
 * path, and bumps `card_size_hint` narrow → wide on first activation.
 * Fires once per cell at the moment its formula starts returning
 * array_of_objects AND the cell is in the tabular branch (explicit
 * 'tabular' emphasis OR auto-fallback "default plain + empty config").
 * Subsequent emphasis cycling does NOT re-trigger the seed — once
 * `tabular_columns` is non-empty we drop into the smart-merge branch
 * instead.
 */
function useTabularAutoPopulation(
  cell: CellRow,
  result: CellResult | undefined,
  isBuilder: boolean,
): void {
  const editor = useOptionalEditor();
  const lastFirstRowKeysRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!isBuilder || !editor) return;
    if (cell.kind !== 'output') return;
    if (!result || result.error) return;
    if (result.shape !== 'array_of_objects') {
      lastFirstRowKeysRef.current = null;
      return;
    }
    const rows = Array.isArray(result.value) ? result.value : [];
    if (rows.length === 0) return;
    const firstRow = rows[0];
    if (!firstRow || typeof firstRow !== 'object') return;
    const firstRowAsRecord = firstRow as Record<string, unknown>;
    const firstRowKeysSig = Object.keys(firstRowAsRecord).join('|');

    const tabularBranchActive =
      cell.display_emphasis === 'tabular' ||
      (cell.display_emphasis === 'plain' &&
        (cell.tabular_columns ?? []).length === 0);
    if (!tabularBranchActive) {
      lastFirstRowKeysRef.current = null;
      return;
    }
    const existing = cell.tabular_columns ?? [];
    const existingIds = existing.map((c) => c.id);
    const sig = `${existingIds.join('|')}::${firstRowKeysSig}`;

    // First-time seed: empty config → seed from the row.
    //
    // After BUG-M1 the formula-commit handler (in `grid-column.tsx`)
    // and the emphasis-switch interceptor (in `CellEditAffordance`)
    // both bundle their own seed into the user-action PATCH. This
    // branch's remaining responsibility is the LOAD-TIME bootstrap:
    // a cell mounted with empty columns + array_of_objects formula
    // that the user has NOT acted on this session (e.g. an existing
    // calculator opened fresh, or an admin-seeded fixture in tests).
    //
    // BUG-M2 fix — the bootstrap is a passive initialization, NOT a
    // user action. It runs via `patchCellSilent` so it bypasses
    // `recordOperation` and never lands an undo entry the user
    // can't sensibly revert. (User-action-driven seeds STILL bundle
    // into their action's undo entry via the BUG-M1 path; only the
    // load-time bootstrap is silent.) The two guards below also
    // prevent the effect from issuing duplicate silent PATCHes within
    // a single mount; React strict-mode double-mount is naturally
    // handled because each mount sees the post-PATCH state on its
    // second pass, dropping into the smart-merge no-op branch.
    if (existing.length === 0) {
      const bootstrapKey = `${cell.id}::${firstRowKeysSig}`;
      if (seededAutoPopBootstraps.has(bootstrapKey)) return;
      if (lastFirstRowKeysRef.current === sig) return;
      lastFirstRowKeysRef.current = sig;
      seededAutoPopBootstraps.add(bootstrapKey);
      const seeded = seedTabularColumns(firstRowAsRecord);
      const patch: Parameters<typeof editor.patchCellSilent>[1] = {
        tabular_columns: seeded,
      };
      // BUG-H1 fix — promote the cell to explicit tabular emphasis
      // in the same PATCH. `display_emphasis` is the durable,
      // authoritative tabular signal; the length-based gate only
      // survives as the bootstrap-paint trigger.
      if (cell.display_emphasis === 'plain') {
        patch.display_emphasis = 'tabular';
      }
      // One-time card_size_hint bump (narrow → wide) on first
      // Tabular activation. Spec: subsequent maintainer changes to
      // size_hint are respected; the empty-columns check is also
      // the one-time activation flag.
      if (cell.card_size_hint === 'narrow') {
        patch.card_size_hint = 'wide';
      }
      void editor.patchCellSilent(cell.id, patch);
      return;
    }

    // Smart-merge: existing config + new first-row keys → reconcile.
    //
    // After BUG-M1, the formula-commit handler bundles its own
    // reconciliation, so this branch typically observes a config
    // that's already in sync (sameColumnIdsAndOrder returns true →
    // no PATCH). The branch survives as a safety-net for state
    // drift not driven by the formula-commit handler (e.g. a future
    // server-driven update path or concurrent-edit refresh) — in
    // those cases it issues ONE PATCH for the reconciliation, which
    // creates ONE undo entry. Maintainer label / format / alignment
    // edits never trigger because their cell row already carries
    // the change.
    if (lastFirstRowKeysRef.current === sig) return;
    lastFirstRowKeysRef.current = sig;
    const reconciled = reconcileTabularColumns({
      prev: existing,
      firstRow: firstRowAsRecord,
    });
    if (sameColumnIdsAndOrder(existing, reconciled)) return;
    void editor.patchCell(cell.id, { tabular_columns: reconciled });
  }, [
    isBuilder,
    editor,
    cell.id,
    cell.kind,
    cell.display_emphasis,
    cell.card_size_hint,
    cell.tabular_columns,
    result,
  ]);
}

function sameColumnIdsAndOrder(
  a: TabularColumn[],
  b: TabularColumn[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
