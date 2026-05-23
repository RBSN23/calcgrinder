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
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
  type Operation,
  type ViewportMode,
} from './reducer';

type PatchFn = typeof patchCalculator;
type ToastReporter = (message: string) => void;

const GENERIC_STALE_MESSAGE = 'Save failed — reload to retry.';
const GENERIC_NETWORK_MESSAGE = "Couldn't save — please try again.";

export interface EditorApi {
  state: EditorState;
  dispatch: (action: EditorAction) => void;
  /** Commit a title change. Records an undo entry on success. */
  renameCalculator: (next: string) => Promise<void>;
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
  removeCell: (id: string) => Promise<void>;
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
    opts: { sections?: SectionRow[]; cells?: CellRow[] } = {},
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

  // ── PROJ-9 — section mutations ───────────────────────────────────────────

  addSection = async (body: CreateSectionBody = {}): Promise<SectionRow | null> => {
    const calcId = this.state.calculator.id;
    let createdId: string | null = null;
    return this.recordOperation<SectionRow>({
      label: 'Add section',
      doFn: async () => {
        // On redo, forward the original id so the recreated row keeps the
        // same UUID (PROJ-9 spec AC line 985-989).
        const row = await createSectionApi(calcId, {
          ...body,
          ...(createdId ? { id: createdId } : {}),
        });
        createdId = row.id;
        this.dispatch({ type: 'UPSERT_SECTION', section: row });
        return row;
      },
      undoFn: async () => {
        if (!createdId) return;
        await deleteSectionApi(createdId, { confirmDeleteWithChildren: true });
        this.dispatch({ type: 'REMOVE_SECTION', id: createdId });
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
    return this.recordOperation<SectionRow>({
      label: 'Update section',
      doFn: async () => {
        const row = await patchSectionApi(id, {
          ...body,
          updated_at: this.state.calculator.updated_at,
        });
        this.dispatch({ type: 'UPSERT_SECTION', section: row });
        // Section writes bump calculator.updated_at via trigger; refresh it.
        this.dispatch({
          type: 'SET_TITLE',
          title: this.state.calculator.title,
          updated_at: row.updated_at,
        });
        return row;
      },
      undoFn: async () => {
        const row = await patchSectionApi(id, {
          ...inverse,
          updated_at: this.state.calculator.updated_at,
        });
        this.dispatch({ type: 'UPSERT_SECTION', section: row });
        this.dispatch({
          type: 'SET_TITLE',
          title: this.state.calculator.title,
          updated_at: row.updated_at,
        });
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
        await deleteSectionApi(id, opts);
        this.dispatch({ type: 'REMOVE_SECTION', id });
      },
      undoFn: async () => {
        // Restore the section AND its children with their original UUIDs so
        // anything else that referenced those ids (formulas referencing
        // cell names by the recreated row, scroll anchors, in-flight
        // selection state) keeps working. PROJ-9 spec AC line 985-989
        // mandates id restoration; the API accepts an optional `id` for
        // exactly this case.
        const row = await createSectionApi(this.state.calculator.id, {
          id: previous.id,
          title: previous.title,
          description: previous.description,
          layout_pattern_id: previous.layout_pattern_id,
        });
        this.dispatch({ type: 'UPSERT_SECTION', section: row });
        for (const cell of previousCells) {
          const recreated = await createCellApi(row.id, {
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
          this.dispatch({ type: 'UPSERT_CELL', cell: recreated });
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
        const cell = await createCellApi(sectionId, {
          ...body,
          ...(createdId ? { id: createdId } : {}),
        });
        createdId = cell.id;
        this.dispatch({ type: 'UPSERT_CELL', cell });
        return cell;
      },
      undoFn: async () => {
        if (!createdId) return;
        await deleteCellApi(createdId);
        this.dispatch({ type: 'REMOVE_CELL', id: createdId });
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
    return this.recordOperation<CellRow>({
      label: 'Update cell',
      doFn: async () => {
        const res = await patchCellApi(id, {
          ...body,
          updated_at: this.state.calculator.updated_at,
        });
        this.dispatch({ type: 'UPSERT_CELL', cell: res.cell });
        if (isRename && newName && res.rewritten_cell_ids.length > 0) {
          // Apply the same rewrite the server applied. Using
          // rewriteFormulaReference from @/lib/formula guarantees parity
          // with the server-side transform (same code path), so the
          // resulting formula text matches the row on disk exactly.
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
        this.dispatch({
          type: 'SET_TITLE',
          title: this.state.calculator.title,
          updated_at: res.cell.updated_at,
        });
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
        this.dispatch({
          type: 'SET_TITLE',
          title: this.state.calculator.title,
          updated_at: res.cell.updated_at,
        });
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
          if (e.code === 'cross_section_move_unsupported') {
            return `Cross-section moves aren't supported yet.`;
          }
          if (e.code === 'formula_too_long_after_rewrite') {
            return `Rename would exceed the formula length limit.`;
          }
        }
        return undefined;
      },
    });
  };

  removeCell = async (id: string): Promise<void> => {
    const previous = this.state.cells.find((c) => c.id === id);
    if (!previous) return;
    await this.recordOperation<void>({
      label: 'Delete cell',
      doFn: async () => {
        await deleteCellApi(id);
        this.dispatch({ type: 'REMOVE_CELL', id });
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
        this.dispatch({ type: 'UPSERT_CELL', cell: recreated });
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
    setDescription: store.setDescription,
    setTheme: store.setTheme,
    undo: store.undo,
    redo: store.redo,
    addSection: store.addSection,
    patchSection: store.patchSection,
    removeSection: store.removeSection,
    addCell: store.addCell,
    patchCell: store.patchCell,
    removeCell: store.removeCell,
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
  /** Initial sections / cells loaded server-side. */
  initialSections?: SectionRow[];
  initialCells?: CellRow[];
  children: React.ReactNode;
}

export function EditorProvider({
  initialRow,
  patchFn = patchCalculator,
  onError,
  initialSections,
  initialCells,
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
