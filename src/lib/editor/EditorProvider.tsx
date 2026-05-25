'use client';

// PROJ-8 — Editor state provider, backed by a module-level singleton store.
//
// The editor's chrome (calculator-theme picker, mobile centre label, etc.) is
// rendered inside the AppShell's top-bar via a slot registry. The slot JSX is
// *created* inside the editor's tree, but *rendered* as a child of TopBarDesktop
// which sits outside this provider in the React tree. React Context lookup
// walks the render parent tree, so a Context-based `useEditor()` would throw
// from any slot JSX rendered up in the top bar (this was bug B4 in PROJ-8's QA).
//
// The fix — the spec's documented alternative ("Zustand store ... implementer's
// choice; either works") — is to back `useEditor()` with a module-level store.
// The Provider component still exists to:
//   - construct + tear down the store for the current calculator
//   - own the document-level Cmd-Z / Cmd-Shift-Z keyboard handler
// but it no longer needs to be an ancestor of every `useEditor()` caller. Any
// component that mounts while a calculator is open can read the store.
//
// PROJ-9's cell mutations attach to the same store — the slice shape is
// additive and the `recordOperation` helper is type-agnostic.

import * as React from 'react';

import {
  CalculatorApiError,
  patchCalculator,
} from '@/lib/calculators/client';
import type { CalculatorRow } from '@/lib/calculators/types';
import {
  CellApiError,
  createCell as createCellApi,
  deleteCell as deleteCellApi,
  patchCell as patchCellApi,
  type CreateCellBody,
  type PatchCellBody,
} from '@/lib/cells/client';
import type { CellRow } from '@/lib/cells/types';
import {
  ChartApiError,
  createChart as createChartApi,
  deleteChart as deleteChartApi,
  patchChart as patchChartApi,
  type CreateChartBody,
  type PatchChartBody,
} from '@/lib/charts/client';
import type { ChartRow } from '@/lib/charts/types';
import { rewriteFormulaReference } from '@/lib/formula';
import {
  SectionApiError,
  createSection as createSectionApi,
  deleteSection as deleteSectionApi,
  patchSection as patchSectionApi,
  type CreateSectionBody,
  type PatchSectionBody,
} from '@/lib/sections/client';
import type { SectionRow } from '@/lib/sections/types';
import {
  TextBlockApiError,
  createTextBlock as createTextBlockApi,
  deleteTextBlock as deleteTextBlockApi,
  patchTextBlock as patchTextBlockApi,
  type CreateTextBlockBody,
  type PatchTextBlockBody,
} from '@/lib/text-blocks/client';
import type { TextBlockRow } from '@/lib/text-blocks/types';

import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
  type Operation,
  type ViewportMode,
} from './reducer';
import { computeReorderUpdates } from './reorder';

type PatchFn = typeof patchCalculator;
type ToastReporter = (message: string) => void;

const GENERIC_STALE_MESSAGE = 'Save failed — reload to retry.';
const GENERIC_NETWORK_MESSAGE = "Couldn't save — please try again.";

export interface EditorApi {
  state: EditorState;
  dispatch: (action: EditorAction) => void;
  /** Commit a title change. Records an undo entry on success. */
  renameCalculator: (next: string) => Promise<void>;
  /**
   * PROJ-10 — Checked rename that returns server-side validation
   * codes (`title_taken`, `title_required`, `title_too_long`) instead
   * of toasting them, so the caller can surface an inline error.
   */
  renameCalculatorChecked: (
    next: string,
  ) => Promise<{ ok: true } | { ok: false; code?: string }>;
  /** Commit a description change. Records an undo entry on success. */
  setDescription: (next: string) => Promise<void>;
  /** Commit a theme change. Records an undo entry on success. */
  setTheme: (next: string) => Promise<void>;
  /** Run the top undo entry, if any. Safe to call when stack is empty. */
  undo: () => Promise<void>;
  /** Run the top redo entry, if any. Safe to call when stack is empty. */
  redo: () => Promise<void>;
  // PROJ-9 — section/cell mutations
  addSection: (body?: CreateSectionBody) => Promise<SectionRow | null>;
  patchSection: (
    id: string,
    body: Omit<PatchSectionBody, 'updated_at'>,
  ) => Promise<SectionRow | null>;
  removeSection: (id: string, opts?: { confirmDeleteWithChildren?: boolean }) => Promise<void>;
  addCell: (sectionId: string, body?: CreateCellBody) => Promise<CellRow | null>;
  patchCell: (
    id: string,
    body: Omit<PatchCellBody, 'updated_at'>,
  ) => Promise<CellRow | null>;
  /**
   * PROJ-17 BUG-M2 — non-undoable cell PATCH for passive initialization
   * effects (the load-time tabular auto-pop bootstrap). Bypasses
   * `recordOperation`, so Cmd-Z doesn't see the change and the effect
   * can fire on every mount (including React strict-mode double-mount)
   * without piling up undo entries the user can't sensibly revert.
   * Intended ONLY for side-effect initializations triggered by mount,
   * not user actions — those go through `patchCell` to preserve the
   * undo trail.
   */
  patchCellSilent: (
    id: string,
    body: Omit<PatchCellBody, 'updated_at'>,
  ) => Promise<CellRow | null>;
  removeCell: (id: string) => Promise<void>;
  // PROJ-15 — chart mutations.
  addChart: (sectionId: string, body?: CreateChartBody) => Promise<ChartRow | null>;
  patchChart: (
    id: string,
    body: Omit<PatchChartBody, 'updated_at'>,
  ) => Promise<ChartRow | null>;
  removeChart: (id: string) => Promise<void>;
  // PROJ-16 — text-block mutations.
  addTextBlock: (
    sectionId: string,
    body?: CreateTextBlockBody,
  ) => Promise<TextBlockRow | null>;
  patchTextBlock: (
    id: string,
    body: Omit<PatchTextBlockBody, 'updated_at'>,
  ) => Promise<TextBlockRow | null>;
  removeTextBlock: (id: string) => Promise<void>;
}

class EditorStore {
  state: EditorState;
  private listeners = new Set<() => void>();
  private patchFn: PatchFn;
  private toast?: ToastReporter;

  constructor(
    initialRow: CalculatorRow,
    patchFn: PatchFn,
    toast?: ToastReporter,
    opts: {
      sections?: SectionRow[];
      cells?: CellRow[];
      charts?: ChartRow[];
      text_blocks?: TextBlockRow[];
    } = {},
  ) {
    this.state = initialEditorState(initialRow, opts);
    this.patchFn = patchFn;
    this.toast = toast;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  dispatch = (action: EditorAction): void => {
    const next = editorReducer(this.state, action);
    if (next !== this.state) {
      this.state = next;
      this.notify();
    }
  };

  private reportError(e: unknown, override?: string): void {
    let message: string;
    if (override) {
      message = override;
    } else if (
      (e instanceof CalculatorApiError ||
        e instanceof CellApiError ||
        e instanceof SectionApiError) &&
      e.status === 409
    ) {
      message = GENERIC_STALE_MESSAGE;
    } else {
      message = GENERIC_NETWORK_MESSAGE;
    }
    if (this.toast) {
      this.toast(message);
      return;
    }
    if (typeof window !== 'undefined') {
      import('sonner')
        .then(({ toast }) => toast.error(message))
        .catch(() => {
          /* swallow — toast is best-effort */
        });
    }
  }

  private isStale(e: unknown): boolean {
    return (
      (e instanceof CalculatorApiError ||
        e instanceof CellApiError ||
        e instanceof SectionApiError) &&
      e.status === 409
    );
  }

  reportToast = (message: string): void => {
    if (this.toast) {
      this.toast(message);
      return;
    }
    if (typeof window !== 'undefined') {
      import('sonner')
        .then(({ toast }) => toast.error(message))
        .catch(() => {
          /* swallow */
        });
    }
  };

  private async recordOperation<T>(op: {
    label: string;
    doFn: () => Promise<T>;
    undoFn: () => Promise<void>;
    errorOverride?: (e: unknown) => string | undefined;
  }): Promise<T | null> {
    if (this.state.stale) {
      this.reportError(new CalculatorApiError(409, 'stale'));
      return null;
    }
    let result: T;
    try {
      result = await op.doFn();
    } catch (e) {
      if (this.isStale(e)) {
        this.dispatch({ type: 'MARK_STALE' });
      }
      this.reportError(e, op.errorOverride?.(e));
      return null;
    }
    const operation: Operation = {
      label: op.label,
      do: async () => {
        await op.doFn();
      },
      undo: op.undoFn,
    };
    this.dispatch({ type: 'PUSH_OPERATION', op: operation });
    return result;
  }

  renameCalculator = async (next: string): Promise<void> => {
    const current = this.state.calculator;
    const previousTitle = current.title;
    if (previousTitle === next) return;
    await this.recordOperation({
      label: `Rename to "${next}"`,
      doFn: async () => {
        const row = await this.patchFn(current.id, {
          updated_at: this.state.calculator.updated_at,
          title: next,
        });
        this.dispatch({
          type: 'SET_TITLE',
          title: row.title,
          updated_at: row.updated_at,
        });
      },
      undoFn: async () => {
        const row = await this.patchFn(current.id, {
          updated_at: this.state.calculator.updated_at,
          title: previousTitle,
        });
        this.dispatch({
          type: 'SET_TITLE',
          title: row.title,
          updated_at: row.updated_at,
        });
      },
    });
  };

  // PROJ-10 — checked rename used by the hero / dashboard kebab.
  // Surfaces validation codes back to the caller instead of toasting
  // them, so the caller can render an inline error below the input.
  // The undo-stack enrollment matches renameCalculator on success.
  renameCalculatorChecked = async (
    next: string,
  ): Promise<{ ok: true } | { ok: false; code?: string }> => {
    const current = this.state.calculator;
    const previousTitle = current.title;
    if (previousTitle === next) return { ok: true };
    if (this.state.stale) {
      this.reportError(new CalculatorApiError(409, 'stale'));
      return { ok: false };
    }
    let row;
    try {
      row = await this.patchFn(current.id, {
        updated_at: this.state.calculator.updated_at,
        title: next,
      });
    } catch (e) {
      if (e instanceof CalculatorApiError) {
        if (
          e.code === 'title_taken' ||
          e.code === 'title_required' ||
          e.code === 'title_too_long'
        ) {
          return { ok: false, code: e.code };
        }
      }
      if (this.isStale(e)) this.dispatch({ type: 'MARK_STALE' });
      this.reportError(e);
      return { ok: false };
    }
    this.dispatch({
      type: 'SET_TITLE',
      title: row.title,
      updated_at: row.updated_at,
    });
    const operation: Operation = {
      label: `Rename to "${next}"`,
      do: async () => {
        const r = await this.patchFn(current.id, {
          updated_at: this.state.calculator.updated_at,
          title: next,
        });
        this.dispatch({
          type: 'SET_TITLE',
          title: r.title,
          updated_at: r.updated_at,
        });
      },
      undo: async () => {
        const r = await this.patchFn(current.id, {
          updated_at: this.state.calculator.updated_at,
          title: previousTitle,
        });
        this.dispatch({
          type: 'SET_TITLE',
          title: r.title,
          updated_at: r.updated_at,
        });
      },
    };
    this.dispatch({ type: 'PUSH_OPERATION', op: operation });
    return { ok: true };
  };

  setDescription = async (next: string): Promise<void> => {
    const current = this.state.calculator;
    const previousDescription = current.description;
    if (previousDescription === next) return;
    await this.recordOperation({
      label: `Update description`,
      doFn: async () => {
        const row = await this.patchFn(current.id, {
          updated_at: this.state.calculator.updated_at,
          description: next,
        });
        this.dispatch({
          type: 'SET_DESCRIPTION',
          description: row.description,
          updated_at: row.updated_at,
        });
      },
      undoFn: async () => {
        const row = await this.patchFn(current.id, {
          updated_at: this.state.calculator.updated_at,
          description: previousDescription,
        });
        this.dispatch({
          type: 'SET_DESCRIPTION',
          description: row.description,
          updated_at: row.updated_at,
        });
      },
    });
  };

  setTheme = async (next: string): Promise<void> => {
    const current = this.state.calculator;
    const previousTheme = current.theme_id;
    if (previousTheme === next) return;
    await this.recordOperation({
      label: `Switch theme to ${next}`,
      doFn: async () => {
        const row = await this.patchFn(current.id, {
          updated_at: this.state.calculator.updated_at,
          theme_id: next,
        });
        this.dispatch({
          type: 'SET_THEME',
          theme_id: row.theme_id,
          updated_at: row.updated_at,
        });
      },
      undoFn: async () => {
        const row = await this.patchFn(current.id, {
          updated_at: this.state.calculator.updated_at,
          theme_id: previousTheme,
        });
        this.dispatch({
          type: 'SET_THEME',
          theme_id: row.theme_id,
          updated_at: row.updated_at,
        });
      },
    });
  };

  // Refresh the cached calculator.updated_at from a mutation response.
  // Every cell/section write bumps the parent via DB trigger, so we
  // must roll the cached token forward in lock-step or the very next
  // mutation will 409. A null `next` is a defensive no-op for the case
  // where the server response omits the field (shouldn't happen post-
  // PROJ-9-bugfix, but cheap insurance).
  private refreshCalculatorUpdatedAt(next: string | null | undefined): void {
    if (!next) return;
    this.dispatch({ type: 'SET_CALCULATOR_UPDATED_AT', updated_at: next });
  }

  // ── PROJ-9 — section mutations ───────────────────────────────────────────

  addSection = async (body: CreateSectionBody = {}): Promise<SectionRow | null> => {
    const calcId = this.state.calculator.id;
    let createdId: string | null = null;
    return this.recordOperation<SectionRow>({
      label: 'Add section',
      doFn: async () => {
        // On redo, forward the original id so the recreated row keeps the
        // same UUID (PROJ-9 spec AC line 985-989).
        const res = await createSectionApi(calcId, {
          ...body,
          ...(createdId ? { id: createdId } : {}),
        });
        createdId = res.section.id;
        this.dispatch({ type: 'UPSERT_SECTION', section: res.section });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
        return res.section;
      },
      undoFn: async () => {
        if (!createdId) return;
        const res = await deleteSectionApi(createdId, { confirmDeleteWithChildren: true });
        this.dispatch({ type: 'REMOVE_SECTION', id: createdId });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
    });
  };

  patchSection = async (
    id: string,
    body: Omit<PatchSectionBody, 'updated_at'>,
  ): Promise<SectionRow | null> => {
    const previous = this.state.sections.find((s) => s.id === id);
    if (!previous) return null;
    const inverse: Omit<PatchSectionBody, 'updated_at'> = {};
    if (body.title !== undefined) inverse.title = previous.title;
    if (body.description !== undefined) inverse.description = previous.description;
    if (body.layout_pattern_id !== undefined) inverse.layout_pattern_id = previous.layout_pattern_id;
    if (body.display_order !== undefined) inverse.display_order = previous.display_order;
    // Optimistic update: paint the new values immediately so controlled
    // inputs (textareas, Select triggers) don't briefly snap back to
    // the prior value while the PATCH is in flight. If the request
    // fails we revert below.
    const optimistic: SectionRow = {
      ...previous,
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.layout_pattern_id !== undefined
        ? { layout_pattern_id: body.layout_pattern_id }
        : {}),
      ...(body.display_order !== undefined ? { display_order: body.display_order } : {}),
    };
    // When the body includes display_order, mirror the server's
    // transactional renumber locally so the dragged section doesn't
    // visually snap back. Without this, the dragged section's order
    // updates but its siblings keep their old orders — two rows
    // collide, the stable sort renders them in original positions,
    // the API response only echoes the dragged row, and the broken
    // sibling orders persist until the next reload.
    //
    // We snapshot the pre-drag rows here so the error-rollback path can
    // restore each sibling to its actual prior display_order rather
    // than its post-optimistic value.
    const renumberPlan =
      body.display_order !== undefined
        ? computeReorderUpdates(this.state.sections, id, body.display_order)
            .filter((u) => u.id !== id)
        : [];
    const siblingsPre: SectionRow[] = renumberPlan
      .map((u) => this.state.sections.find((s) => s.id === u.id))
      .filter((s): s is SectionRow => !!s);
    const siblingsPost: SectionRow[] = renumberPlan.map((u) => {
      const sib = siblingsPre.find((s) => s.id === u.id)!;
      return { ...sib, display_order: u.display_order };
    });
    return this.recordOperation<SectionRow>({
      label: 'Update section',
      doFn: async () => {
        this.dispatch({ type: 'UPSERT_SECTION', section: optimistic });
        for (const sib of siblingsPost) {
          this.dispatch({ type: 'UPSERT_SECTION', section: sib });
        }
        try {
          const res = await patchSectionApi(id, {
            ...body,
            updated_at: this.state.calculator.updated_at,
          });
          this.dispatch({ type: 'UPSERT_SECTION', section: res.section });
          this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
          return res.section;
        } catch (e) {
          // Roll back the optimistic paint so the UI matches the
          // server's last-known state. Restore siblings from the
          // pre-drag snapshot (siblingsPre), not from current state
          // (which holds the post-optimistic values).
          this.dispatch({ type: 'UPSERT_SECTION', section: previous });
          for (const sib of siblingsPre) {
            this.dispatch({ type: 'UPSERT_SECTION', section: sib });
          }
          throw e;
        }
      },
      undoFn: async () => {
        const res = await patchSectionApi(id, {
          ...inverse,
          updated_at: this.state.calculator.updated_at,
        });
        this.dispatch({ type: 'UPSERT_SECTION', section: res.section });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
    });
  };

  removeSection = async (
    id: string,
    opts: { confirmDeleteWithChildren?: boolean } = {},
  ): Promise<void> => {
    const previous = this.state.sections.find((s) => s.id === id);
    if (!previous) return;
    const previousCells = this.state.cells.filter((c) => c.section_id === id);
    await this.recordOperation<void>({
      label: 'Delete section',
      doFn: async () => {
        const res = await deleteSectionApi(id, opts);
        this.dispatch({ type: 'REMOVE_SECTION', id });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      undoFn: async () => {
        // Restore the section AND its children with their original UUIDs so
        // anything else that referenced those ids (formulas referencing
        // cell names by the recreated row, scroll anchors, in-flight
        // selection state) keeps working. PROJ-9 spec AC line 985-989
        // mandates id restoration; the API accepts an optional `id` for
        // exactly this case.
        const res = await createSectionApi(this.state.calculator.id, {
          id: previous.id,
          title: previous.title,
          description: previous.description,
          layout_pattern_id: previous.layout_pattern_id,
        });
        this.dispatch({ type: 'UPSERT_SECTION', section: res.section });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
        for (const cell of previousCells) {
          const recreated = await createCellApi(res.section.id, {
            id: cell.id,
            kind: cell.kind,
            name: cell.name,
            label: cell.label,
            description: cell.description,
            description_render: cell.description_render,
            value_type: cell.value_type,
            visibility: cell.visibility,
            editability: cell.editability,
            default_value: cell.default_value ?? undefined,
            formula: cell.formula ?? undefined,
            display_widget: cell.display_widget ?? undefined,
            display_format: cell.display_format,
            display_emphasis: cell.display_emphasis,
            unit: cell.unit ?? undefined,
            numeric_min: cell.numeric_min ?? undefined,
            numeric_max: cell.numeric_max ?? undefined,
            numeric_step: cell.numeric_step ?? undefined,
            select_options: cell.select_options ?? undefined,
            currency_code: cell.currency_code ?? undefined,
            card_accent: cell.card_accent,
            card_background_tint: cell.card_background_tint,
            card_border: cell.card_border,
            card_size_hint: cell.card_size_hint,
            text_size: cell.text_size,
            text_colour: cell.text_colour,
          });
          this.dispatch({ type: 'UPSERT_CELL', cell: recreated.cell });
          this.refreshCalculatorUpdatedAt(recreated.calculatorUpdatedAt);
        }
      },
    });
  };

  // ── PROJ-9 — cell mutations ──────────────────────────────────────────────

  addCell = async (
    sectionId: string,
    body: CreateCellBody = {},
  ): Promise<CellRow | null> => {
    let createdId: string | null = null;
    return this.recordOperation<CellRow>({
      label: 'Add cell',
      doFn: async () => {
        // On redo, forward the original id so the recreated row keeps the
        // same UUID — selection / scroll-into-view / "added cell" anchors
        // that referenced it stay valid across undo/redo (PROJ-9 spec AC
        // line 985-989: original id is restored).
        const res = await createCellApi(sectionId, {
          ...body,
          ...(createdId ? { id: createdId } : {}),
        });
        createdId = res.cell.id;
        this.dispatch({ type: 'UPSERT_CELL', cell: res.cell });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
        return res.cell;
      },
      undoFn: async () => {
        if (!createdId) return;
        const res = await deleteCellApi(createdId);
        this.dispatch({ type: 'REMOVE_CELL', id: createdId });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      errorOverride: (e) => {
        if (e instanceof CellApiError) {
          if (e.code === 'cell_cap_reached') {
            return `${e.max ?? 200}-cell limit reached. Delete a cell to add more.`;
          }
        }
        return undefined;
      },
    });
  };

  patchCell = async (
    id: string,
    body: Omit<PatchCellBody, 'updated_at'>,
  ): Promise<CellRow | null> => {
    const previous = this.state.cells.find((c) => c.id === id);
    if (!previous) return null;
    // Capture previous values for any fields being updated, so undo can
    // restore them. Use null sentinel for fields whose previous value was null.
    const inverse: Omit<PatchCellBody, 'updated_at'> = {};
    for (const key of Object.keys(body) as (keyof PatchCellBody)[]) {
      if (key === 'rewrite_dependents') continue;
      const prev = (previous as unknown as Record<string, unknown>)[key];
      (inverse as Record<string, unknown>)[key] = prev ?? undefined;
    }
    // For rename → also snapshot dependents so undo can put their formulas
    // back. The server walks every Output cell using the same
    // rewriteFormulaReference helper we use locally; we re-apply the
    // rewrite client-side using the IDs the server confirms it touched.
    const isRename =
      body.name !== undefined &&
      typeof body.name === 'string' &&
      body.name !== previous.name;
    const oldName = previous.name;
    const newName = isRename ? (body.name as string) : null;
    const dependentSnapshot: Map<string, string | null> = new Map();
    if (isRename) {
      for (const cell of this.state.cells) {
        if (cell.id === id) continue;
        if (cell.kind !== 'output') continue;
        if (cell.formula) dependentSnapshot.set(cell.id, cell.formula);
      }
    }
    // Build the optimistic-update row. Painting the new values
    // immediately (before the PATCH resolves) keeps controlled inputs
    // and Select triggers from flashing back to the prior value during
    // the ~500ms request window. We revert below if the PATCH fails.
    const optimistic: CellRow = { ...previous };
    for (const key of Object.keys(body) as (keyof PatchCellBody)[]) {
      if (key === 'rewrite_dependents') continue;
      const next = (body as unknown as Record<string, unknown>)[key];
      // `default_value` of `undefined` is a real clear signal; copy as null.
      (optimistic as unknown as Record<string, unknown>)[key] =
        next === undefined && key === 'default_value' ? null : next;
    }
    // Rename: pre-apply the dependent-formula rewrites locally so the
    // engine never sees an intermediate state where the renamed cell
    // has its new name but dependents still reference the old name —
    // without this, an `unknown_name` red error briefly flashes on
    // every dependent during the ~500ms PATCH window.
    const renameDependentsPre: CellRow[] = [];
    const renameDependentsPost: CellRow[] = [];
    if (isRename && newName) {
      for (const cell of this.state.cells) {
        if (cell.id === id) continue;
        if (cell.kind !== 'output') continue;
        if (!cell.formula) continue;
        const next = rewriteFormulaReference(cell.formula, oldName, newName);
        if (next === cell.formula) continue;
        renameDependentsPre.push(cell);
        renameDependentsPost.push({ ...cell, formula: next });
      }
    }
    // Reorder: mirror the server's renumber so the dragged cell
    // doesn't visually snap back (same bug as patchSection above).
    // Scope is the section the cell currently sits in.
    const renumberPlan =
      body.display_order !== undefined
        ? computeReorderUpdates(
            this.state.cells.filter((c) => c.section_id === previous.section_id),
            id,
            body.display_order,
          ).filter((u) => u.id !== id)
        : [];
    const siblingsPre: CellRow[] = renumberPlan
      .map((u) => this.state.cells.find((c) => c.id === u.id))
      .filter((c): c is CellRow => !!c);
    const siblingsPost: CellRow[] = renumberPlan.map((u) => {
      const sib = siblingsPre.find((c) => c.id === u.id)!;
      return { ...sib, display_order: u.display_order };
    });
    return this.recordOperation<CellRow>({
      label: 'Update cell',
      doFn: async () => {
        this.dispatch({ type: 'UPSERT_CELL', cell: optimistic });
        if (renameDependentsPost.length > 0) {
          this.dispatch({ type: 'UPSERT_CELLS', cells: renameDependentsPost });
        }
        if (siblingsPost.length > 0) {
          this.dispatch({ type: 'UPSERT_CELLS', cells: siblingsPost });
        }
        let res;
        try {
          res = await patchCellApi(id, {
            ...body,
            updated_at: this.state.calculator.updated_at,
          });
        } catch (e) {
          // Roll back the optimistic paint, including dependents and
          // siblings, to their pre-mutation snapshots.
          this.dispatch({ type: 'UPSERT_CELL', cell: previous });
          if (renameDependentsPre.length > 0) {
            this.dispatch({ type: 'UPSERT_CELLS', cells: renameDependentsPre });
          }
          if (siblingsPre.length > 0) {
            this.dispatch({ type: 'UPSERT_CELLS', cells: siblingsPre });
          }
          throw e;
        }
        this.dispatch({ type: 'UPSERT_CELL', cell: res.cell });
        if (isRename && newName && res.rewritten_cell_ids.length > 0) {
          // The server confirms which dependents it rewrote. Re-apply
          // the rewrite via rewriteFormulaReference for parity with
          // the server-side transform (same code path → identical
          // formula text on disk).
          const rewrittenIds = new Set(res.rewritten_cell_ids);
          const updated: CellRow[] = [];
          for (const cell of this.state.cells) {
            if (!rewrittenIds.has(cell.id)) continue;
            if (!cell.formula) continue;
            const next = rewriteFormulaReference(cell.formula, oldName, newName);
            if (next === cell.formula) continue;
            updated.push({ ...cell, formula: next, updated_at: res.cell.updated_at });
          }
          if (updated.length > 0) {
            this.dispatch({ type: 'UPSERT_CELLS', cells: updated });
          }
        }
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
        return res.cell;
      },
      undoFn: async () => {
        const res = await patchCellApi(id, {
          ...inverse,
          updated_at: this.state.calculator.updated_at,
        });
        this.dispatch({ type: 'UPSERT_CELL', cell: res.cell });
        if (isRename && dependentSnapshot.size > 0) {
          // Restore the dependent formulas to their pre-rewrite text. The
          // server's PATCH on `inverse` already restored the name; reusing
          // the rewrite helper with old/new swapped would work too, but
          // the snapshot keeps the source-of-truth at the moment of
          // commit (catches manual edits in between, if any).
          const restored: CellRow[] = [];
          for (const cell of this.state.cells) {
            const prevFormula = dependentSnapshot.get(cell.id);
            if (prevFormula == null) continue;
            if (cell.formula === prevFormula) continue;
            restored.push({ ...cell, formula: prevFormula, updated_at: res.cell.updated_at });
          }
          if (restored.length > 0) {
            this.dispatch({ type: 'UPSERT_CELLS', cells: restored });
          }
        }
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      errorOverride: (e) => {
        if (e instanceof CellApiError) {
          if (e.code === 'name_reserved') {
            return `${e.reservedWord ?? 'That name'} is a built-in function — pick another name.`;
          }
          if (e.code === 'name_collision') {
            return `A cell with that name already exists.`;
          }
          if (e.code === 'name_invalid') {
            return `Lowercase letters, digits, and underscores only. Must start with a letter.`;
          }
          if (e.code === 'hidden_requires_value') {
            return `Hidden cells must have a default value.`;
          }
          if (e.code === 'readonly_input_requires_value') {
            return `Readonly inputs must have a default value.`;
          }
          if (e.code === 'formula_too_long_after_rewrite') {
            return `Rename would exceed the formula length limit.`;
          }
        }
        return undefined;
      },
    });
  };

  // PROJ-17 BUG-M2 — non-undoable cell PATCH (see EditorApi docstring).
  patchCellSilent = async (
    id: string,
    body: Omit<PatchCellBody, 'updated_at'>,
  ): Promise<CellRow | null> => {
    if (this.state.stale) return null;
    const previous = this.state.cells.find((c) => c.id === id);
    if (!previous) return null;
    try {
      const res = await patchCellApi(id, {
        ...body,
        updated_at: this.state.calculator.updated_at,
      });
      this.dispatch({ type: 'UPSERT_CELL', cell: res.cell });
      this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      return res.cell;
    } catch (e) {
      if (this.isStale(e)) {
        this.dispatch({ type: 'MARK_STALE' });
      }
      this.reportError(e);
      return null;
    }
  };

  removeCell = async (id: string): Promise<void> => {
    const previous = this.state.cells.find((c) => c.id === id);
    if (!previous) return;
    await this.recordOperation<void>({
      label: 'Delete cell',
      doFn: async () => {
        const res = await deleteCellApi(id);
        this.dispatch({ type: 'REMOVE_CELL', id });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      undoFn: async () => {
        // Restore with the original id (PROJ-9 spec AC line 985-989).
        const recreated = await createCellApi(previous.section_id, {
          id: previous.id,
          kind: previous.kind,
          name: previous.name,
          label: previous.label,
          description: previous.description,
          description_render: previous.description_render,
          value_type: previous.value_type,
          visibility: previous.visibility,
          editability: previous.editability,
          default_value: previous.default_value ?? undefined,
          formula: previous.formula ?? undefined,
          display_widget: previous.display_widget ?? undefined,
          display_format: previous.display_format,
          display_emphasis: previous.display_emphasis,
          unit: previous.unit ?? undefined,
          numeric_min: previous.numeric_min ?? undefined,
          numeric_max: previous.numeric_max ?? undefined,
          numeric_step: previous.numeric_step ?? undefined,
          select_options: previous.select_options ?? undefined,
          currency_code: previous.currency_code ?? undefined,
          card_accent: previous.card_accent,
          card_background_tint: previous.card_background_tint,
          card_border: previous.card_border,
          card_size_hint: previous.card_size_hint,
          text_size: previous.text_size,
          text_colour: previous.text_colour,
        });
        this.dispatch({ type: 'UPSERT_CELL', cell: recreated.cell });
        this.refreshCalculatorUpdatedAt(recreated.calculatorUpdatedAt);
      },
    });
  };

  // ─── PROJ-15 chart mutations ───────────────────────────────────────────

  addChart = async (
    sectionId: string,
    body: CreateChartBody = {},
  ): Promise<ChartRow | null> => {
    let createdId: string | null = null;
    return this.recordOperation<ChartRow>({
      label: 'Add chart',
      doFn: async () => {
        const res = await createChartApi(sectionId, {
          ...body,
          ...(createdId ? { id: createdId } : {}),
        });
        createdId = res.chart.id;
        this.dispatch({ type: 'UPSERT_CHART', chart: res.chart });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
        return res.chart;
      },
      undoFn: async () => {
        if (!createdId) return;
        const res = await deleteChartApi(createdId);
        this.dispatch({ type: 'REMOVE_CHART', id: createdId });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      errorOverride: (e) => {
        if (e instanceof ChartApiError && e.code === 'chart_cap_reached') {
          return `${e.max ?? 30}-chart limit reached. Delete a chart to add more.`;
        }
        return undefined;
      },
    });
  };

  patchChart = async (
    id: string,
    body: Omit<PatchChartBody, 'updated_at'>,
  ): Promise<ChartRow | null> => {
    const previous = this.state.charts.find((c) => c.id === id);
    if (!previous) return null;
    let next: ChartRow | null = null;
    await this.recordOperation<ChartRow | null>({
      label: 'Edit chart',
      doFn: async () => {
        const res = await patchChartApi(id, {
          ...body,
          updated_at: next?.updated_at ?? this.state.calculator.updated_at,
        });
        next = res.chart;
        this.dispatch({ type: 'UPSERT_CHART', chart: res.chart });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
        return res.chart;
      },
      undoFn: async () => {
        // Restore the previous chart row verbatim.
        const res = await patchChartApi(id, {
          chart_type: previous.chart_type,
          name: previous.name,
          title: previous.title,
          subtitle: previous.subtitle,
          bindings: previous.bindings,
          style: previous.style,
          card_accent: previous.card_accent,
          card_background_tint: previous.card_background_tint,
          card_border: previous.card_border,
          card_size_hint: previous.card_size_hint,
          section_id: previous.section_id,
          display_order: previous.display_order,
          updated_at: next?.updated_at ?? previous.updated_at,
        });
        this.dispatch({ type: 'UPSERT_CHART', chart: res.chart });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      errorOverride: (e) => {
        if (e instanceof ChartApiError) {
          if (e.code === 'name_collision')
            return 'Another chart on this calculator already uses that name.';
          if (e.code === 'name_reserved')
            return `"${e.reservedWord ?? body.name ?? ''}" is reserved — pick a different name.`;
          if (e.code === 'name_invalid')
            return 'Names must start with a letter and contain only lowercase letters, digits, and underscores.';
          if (e.code === 'color_token_invalid')
            return 'Pick a colour from the theme palette.';
        }
        return undefined;
      },
    });
    return next;
  };

  removeChart = async (id: string): Promise<void> => {
    const previous = this.state.charts.find((c) => c.id === id);
    if (!previous) return;
    await this.recordOperation<void>({
      label: 'Delete chart',
      doFn: async () => {
        const res = await deleteChartApi(id);
        this.dispatch({ type: 'REMOVE_CHART', id });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      undoFn: async () => {
        const recreated = await createChartApi(previous.section_id, {
          id: previous.id,
          chart_type: previous.chart_type,
          name: previous.name,
          title: previous.title,
          subtitle: previous.subtitle,
          bindings: previous.bindings,
          style: previous.style,
          card_accent: previous.card_accent,
          card_background_tint: previous.card_background_tint,
          card_border: previous.card_border,
          card_size_hint: previous.card_size_hint,
          display_order: previous.display_order,
        });
        this.dispatch({ type: 'UPSERT_CHART', chart: recreated.chart });
        this.refreshCalculatorUpdatedAt(recreated.calculatorUpdatedAt);
      },
    });
  };

  // ─── PROJ-16 text-block mutations ──────────────────────────────────────

  addTextBlock = async (
    sectionId: string,
    body: CreateTextBlockBody = {},
  ): Promise<TextBlockRow | null> => {
    let createdId: string | null = null;
    return this.recordOperation<TextBlockRow>({
      label: 'Add text block',
      doFn: async () => {
        const res = await createTextBlockApi(sectionId, {
          ...body,
          ...(createdId ? { id: createdId } : {}),
        });
        createdId = res.textBlock.id;
        this.dispatch({ type: 'UPSERT_TEXT_BLOCK', text_block: res.textBlock });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
        return res.textBlock;
      },
      undoFn: async () => {
        if (!createdId) return;
        const res = await deleteTextBlockApi(createdId);
        this.dispatch({ type: 'REMOVE_TEXT_BLOCK', id: createdId });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      errorOverride: (e) => {
        if (
          e instanceof TextBlockApiError &&
          e.code === 'text_block_cap_reached'
        ) {
          return `${e.max ?? 30}-text-block limit reached. Delete a text block to add more.`;
        }
        return undefined;
      },
    });
  };

  patchTextBlock = async (
    id: string,
    body: Omit<PatchTextBlockBody, 'updated_at'>,
  ): Promise<TextBlockRow | null> => {
    const previous = this.state.text_blocks.find((t) => t.id === id);
    if (!previous) return null;
    // Optimistic paint: apply the new values immediately so the
    // textarea / segmented buttons don't flash back to prior values
    // during the ~500ms PATCH window.
    const optimistic: TextBlockRow = { ...previous };
    for (const key of Object.keys(body) as (keyof PatchTextBlockBody)[]) {
      const next = (body as unknown as Record<string, unknown>)[key];
      if (next === undefined) continue;
      (optimistic as unknown as Record<string, unknown>)[key] = next;
    }
    let next: TextBlockRow | null = null;
    await this.recordOperation<TextBlockRow | null>({
      label: 'Update text block',
      doFn: async () => {
        this.dispatch({ type: 'UPSERT_TEXT_BLOCK', text_block: optimistic });
        let res;
        try {
          res = await patchTextBlockApi(id, {
            ...body,
            updated_at: next?.updated_at ?? this.state.calculator.updated_at,
          });
        } catch (e) {
          this.dispatch({ type: 'UPSERT_TEXT_BLOCK', text_block: previous });
          throw e;
        }
        next = res.textBlock;
        this.dispatch({ type: 'UPSERT_TEXT_BLOCK', text_block: res.textBlock });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
        return res.textBlock;
      },
      undoFn: async () => {
        const res = await patchTextBlockApi(id, {
          body: previous.body,
          card_accent: previous.card_accent,
          card_background_tint: previous.card_background_tint,
          card_border: previous.card_border,
          card_size_hint: previous.card_size_hint,
          text_size: previous.text_size,
          text_colour: previous.text_colour,
          section_id: previous.section_id,
          display_order: previous.display_order,
          updated_at: next?.updated_at ?? previous.updated_at,
        });
        this.dispatch({ type: 'UPSERT_TEXT_BLOCK', text_block: res.textBlock });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      errorOverride: (e) => {
        if (e instanceof TextBlockApiError) {
          if (e.code === 'body_too_large') {
            return 'Text too long — keep your block under ~50 KB.';
          }
        }
        return undefined;
      },
    });
    return next;
  };

  removeTextBlock = async (id: string): Promise<void> => {
    const previous = this.state.text_blocks.find((t) => t.id === id);
    if (!previous) return;
    await this.recordOperation<void>({
      label: 'Delete text block',
      doFn: async () => {
        const res = await deleteTextBlockApi(id);
        this.dispatch({ type: 'REMOVE_TEXT_BLOCK', id });
        this.refreshCalculatorUpdatedAt(res.calculatorUpdatedAt);
      },
      undoFn: async () => {
        const recreated = await createTextBlockApi(previous.section_id, {
          id: previous.id,
          body: previous.body,
          card_accent: previous.card_accent,
          card_background_tint: previous.card_background_tint,
          card_border: previous.card_border,
          card_size_hint: previous.card_size_hint,
          text_size: previous.text_size,
          text_colour: previous.text_colour,
          display_order: previous.display_order,
        });
        this.dispatch({
          type: 'UPSERT_TEXT_BLOCK',
          text_block: recreated.textBlock,
        });
        this.refreshCalculatorUpdatedAt(recreated.calculatorUpdatedAt);
      },
    });
  };

  undo = async (): Promise<void> => {
    if (this.state.stale) return;
    const past = this.state.past;
    if (past.length === 0) return;
    const op = past[past.length - 1];
    try {
      await op.undo();
    } catch (e) {
      if (e instanceof CalculatorApiError && e.status === 409) {
        this.dispatch({ type: 'MARK_STALE' });
      }
      this.reportError(e);
      return;
    }
    this.dispatch({ type: 'UNDO' });
  };

  redo = async (): Promise<void> => {
    if (this.state.stale) return;
    const future = this.state.future;
    if (future.length === 0) return;
    const op = future[future.length - 1];
    try {
      await op.do();
    } catch (e) {
      if (e instanceof CalculatorApiError && e.status === 409) {
        this.dispatch({ type: 'MARK_STALE' });
      }
      this.reportError(e);
      return;
    }
    this.dispatch({ type: 'REDO' });
  };
}

// Module-level container. A single editor store is active at a time — the
// editor route mounts the Provider, which registers the store here; navigating
// away unregisters it. Any consumer that mounts while a calculator is open
// sees the same store regardless of React-tree position.
const activeStore: { current: EditorStore | null } = { current: null };
const metaListeners = new Set<() => void>();
let stateUnsub: (() => void) | undefined;

function setActiveStore(store: EditorStore | null): void {
  if (activeStore.current === store) return;
  stateUnsub?.();
  stateUnsub = undefined;
  activeStore.current = store;
  if (store) {
    // Re-emit the store's own state changes to consumers so a single
    // useSyncExternalStore subscription covers both meta + state updates.
    stateUnsub = store.subscribe(() => {
      metaListeners.forEach((l) => l());
    });
  }
  metaListeners.forEach((l) => l());
}

function subscribeToStore(listener: () => void): () => void {
  metaListeners.add(listener);
  return () => {
    metaListeners.delete(listener);
  };
}

function getStateSnapshot(): EditorState | null {
  return activeStore.current?.state ?? null;
}

export function useEditor(): EditorApi {
  // Snapshot is the state itself — a new reference on each dispatch (because
  // the reducer returns a new object). React re-renders whenever the state
  // reference changes, and our `setActiveStore` notification covers the
  // mount/unmount transitions.
  const state = React.useSyncExternalStore(
    subscribeToStore,
    getStateSnapshot,
    getStateSnapshot,
  );
  const store = activeStore.current;
  if (!store || !state) {
    throw new Error('useEditor must be used inside <EditorProvider>');
  }
  return {
    state,
    dispatch: store.dispatch,
    renameCalculator: store.renameCalculator,
    renameCalculatorChecked: store.renameCalculatorChecked,
    setDescription: store.setDescription,
    setTheme: store.setTheme,
    undo: store.undo,
    redo: store.redo,
    addSection: store.addSection,
    patchSection: store.patchSection,
    removeSection: store.removeSection,
    addCell: store.addCell,
    patchCell: store.patchCell,
    patchCellSilent: store.patchCellSilent,
    removeCell: store.removeCell,
    addChart: store.addChart,
    patchChart: store.patchChart,
    removeChart: store.removeChart,
    addTextBlock: store.addTextBlock,
    patchTextBlock: store.patchTextBlock,
    removeTextBlock: store.removeTextBlock,
  };
}

/**
 * Like `useEditor()` but returns `null` when no editor store is
 * mounted (e.g. visitor surfaces that mount the shared cell renderer
 * but never expose mutation hooks). Side-effects gated on builder
 * mode can call this without try/catch.
 */
export function useOptionalEditor(): EditorApi | null {
  const state = React.useSyncExternalStore(
    subscribeToStore,
    getStateSnapshot,
    getStateSnapshot,
  );
  const store = activeStore.current;
  if (!store || !state) return null;
  return {
    state,
    dispatch: store.dispatch,
    renameCalculator: store.renameCalculator,
    renameCalculatorChecked: store.renameCalculatorChecked,
    setDescription: store.setDescription,
    setTheme: store.setTheme,
    undo: store.undo,
    redo: store.redo,
    addSection: store.addSection,
    patchSection: store.patchSection,
    removeSection: store.removeSection,
    addCell: store.addCell,
    patchCell: store.patchCell,
    patchCellSilent: store.patchCellSilent,
    removeCell: store.removeCell,
    addChart: store.addChart,
    patchChart: store.patchChart,
    removeChart: store.removeChart,
    addTextBlock: store.addTextBlock,
    patchTextBlock: store.patchTextBlock,
    removeTextBlock: store.removeTextBlock,
  };
}

export function useEditorToast(): (message: string) => void {
  const store = activeStore.current;
  if (!store) {
    throw new Error('useEditorToast must be used inside <EditorProvider>');
  }
  return store.reportToast;
}

export interface EditorProviderProps {
  initialRow: CalculatorRow;
  /** Optional injection seam used by tests to bypass `fetch`. */
  patchFn?: typeof patchCalculator;
  /** Toast callback. Defaults to sonner.toast.error in browser, no-op in SSR. */
  onError?: (message: string) => void;
  /** Initial sections / cells / charts / text_blocks loaded server-side. */
  initialSections?: SectionRow[];
  initialCells?: CellRow[];
  initialCharts?: ChartRow[];
  initialTextBlocks?: TextBlockRow[];
  children: React.ReactNode;
}

export function EditorProvider({
  initialRow,
  patchFn = patchCalculator,
  onError,
  initialSections,
  initialCells,
  initialCharts,
  initialTextBlocks,
  children,
}: EditorProviderProps) {
  // Create the store once per mount. `useState`'s lazy initializer runs
  // synchronously during the first render — before children render — so
  // `useEditor()` calls in slot JSX (which renders after the registration
  // effect fires) always see a registered store.
  const [store] = React.useState(
    () =>
      new EditorStore(initialRow, patchFn, onError, {
        sections: initialSections,
        cells: initialCells,
        charts: initialCharts,
        text_blocks: initialTextBlocks,
      }),
  );

  // Register the store synchronously during render. Calling a module-level
  // setter in render is the documented pattern for cross-tree state sharing
  // (the same shape Zustand uses). It's idempotent — repeat renders are no-ops.
  if (activeStore.current !== store) {
    setActiveStore(store);
  }

  // Tear down on unmount so the next editor mount registers fresh state.
  // The setup body re-registers the store: in React StrictMode dev, the
  // mount-test runs cleanup then setup once, so an empty setup would leave
  // `activeStore` null afterwards (the bug B4 had survived a first round of
  // fixes for exactly this reason — slot JSX renders only after the
  // child-effect setSlots, which is well after the strict-mode test).
  React.useEffect(() => {
    setActiveStore(store);
    return () => {
      if (activeStore.current === store) {
        setActiveStore(null);
      }
    };
  }, [store]);

  // Document-level Cmd-Z / Cmd-Shift-Z handler. Native input-undo wins when
  // an editable surface holds focus.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key !== 'z' && e.key !== 'Z' && e.key !== 'y' && e.key !== 'Y') {
        return;
      }
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName;
        const editable = (active as HTMLElement).isContentEditable;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) {
          return;
        }
      }
      const isRedo =
        e.key === 'y' || e.key === 'Y' || ((e.key === 'z' || e.key === 'Z') && e.shiftKey);
      e.preventDefault();
      if (isRedo) {
        void store.redo();
      } else {
        void store.undo();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [store]);

  return <>{children}</>;
}

export type { EditorState, ViewportMode };
