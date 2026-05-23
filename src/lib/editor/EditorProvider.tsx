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
  /** Commit a theme change. Records an undo entry on success. */
  setTheme: (next: string) => Promise<void>;
  /** Run the top undo entry, if any. Safe to call when stack is empty. */
  undo: () => Promise<void>;
  /** Run the top redo entry, if any. Safe to call when stack is empty. */
  redo: () => Promise<void>;
}

class EditorStore {
  state: EditorState;
  private listeners = new Set<() => void>();
  private patchFn: PatchFn;
  private toast?: ToastReporter;

  constructor(initialRow: CalculatorRow, patchFn: PatchFn, toast?: ToastReporter) {
    this.state = initialEditorState(initialRow);
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

  private reportError(e: unknown): void {
    const message =
      e instanceof CalculatorApiError && e.status === 409
        ? GENERIC_STALE_MESSAGE
        : GENERIC_NETWORK_MESSAGE;
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

  private async recordOperation(op: {
    label: string;
    doFn: () => Promise<void>;
    undoFn: () => Promise<void>;
  }): Promise<void> {
    if (this.state.stale) {
      this.reportError(new CalculatorApiError(409, 'stale'));
      return;
    }
    try {
      await op.doFn();
    } catch (e) {
      if (e instanceof CalculatorApiError && e.status === 409) {
        this.dispatch({ type: 'MARK_STALE' });
      }
      this.reportError(e);
      return;
    }
    const operation: Operation = {
      label: op.label,
      do: op.doFn,
      undo: op.undoFn,
    };
    this.dispatch({ type: 'PUSH_OPERATION', op: operation });
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
    setTheme: store.setTheme,
    undo: store.undo,
    redo: store.redo,
  };
}

export interface EditorProviderProps {
  initialRow: CalculatorRow;
  /** Optional injection seam used by tests to bypass `fetch`. */
  patchFn?: typeof patchCalculator;
  /** Toast callback. Defaults to sonner.toast.error in browser, no-op in SSR. */
  onError?: (message: string) => void;
  children: React.ReactNode;
}

export function EditorProvider({
  initialRow,
  patchFn = patchCalculator,
  onError,
  children,
}: EditorProviderProps) {
  // Create the store once per mount. `useState`'s lazy initializer runs
  // synchronously during the first render — before children render — so
  // `useEditor()` calls in slot JSX (which renders after the registration
  // effect fires) always see a registered store.
  const [store] = React.useState(() => new EditorStore(initialRow, patchFn, onError));

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
