// PROJ-8 — Editor reducer.
//
// Pure state machine for the calculator editor. The provider layer wraps
// every "do" callback with a synchronous dispatch so the reducer remains
// trivially testable. Async PATCH plumbing lives in the provider, not here.
//
// Three slices share a single reducer:
//   - calculator: { id, title, description, theme_id, updated_at }
//   - undo/redo : { past, future } of inverse operation descriptors
//   - layout    : { gridHeight, gridCollapsed, viewportMode, gridDrawerOpen }
//
// PROJ-9 will add a cell slice alongside these three with no reshuffle.

import type { CalculatorRow } from '@/lib/calculators/types';

/**
 * One enrolled history entry. The provider is responsible for running
 * `do` / `undo` (which may PATCH the server); the reducer only moves the
 * descriptor between the past and future stacks.
 *
 * `label` exists for accessibility / future "Undo Rename calculator" tooltips
 * — it is intentionally not surfaced in PROJ-8.
 */
export interface Operation {
  label: string;
  do: () => Promise<void> | void;
  undo: () => Promise<void> | void;
}

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface EditorState {
  calculator: CalculatorRow;
  past: Operation[];
  future: Operation[];
  gridHeight: number;
  prevGridHeight: number;
  gridCollapsed: boolean;
  viewportMode: ViewportMode;
  gridDrawerOpen: boolean;
  /** Set to true after a 409 stale-write. Disables further commits until reload. */
  stale: boolean;
}

export const DEFAULT_GRID_HEIGHT = 164;
export const COLLAPSED_GRID_HEIGHT = 40;
export const MIN_GRID_HEIGHT = 80;
/** Computed against the editor's available vertical space at clamp time. */
export const MAX_GRID_HEIGHT_FRACTION = 0.6;

export type EditorAction =
  | { type: 'SET_CALCULATOR'; row: CalculatorRow }
  | { type: 'SET_TITLE'; title: string; updated_at: string }
  | { type: 'SET_DESCRIPTION'; description: string; updated_at: string }
  | { type: 'SET_THEME'; theme_id: string; updated_at: string }
  | { type: 'PUSH_OPERATION'; op: Operation }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_GRID_HEIGHT'; height: number }
  | { type: 'TOGGLE_GRID_COLLAPSED' }
  | { type: 'SET_VIEWPORT'; mode: ViewportMode }
  | { type: 'SET_DRAWER_OPEN'; open: boolean }
  | { type: 'MARK_STALE' };

export function initialEditorState(row: CalculatorRow): EditorState {
  return {
    calculator: row,
    past: [],
    future: [],
    gridHeight: DEFAULT_GRID_HEIGHT,
    prevGridHeight: DEFAULT_GRID_HEIGHT,
    gridCollapsed: false,
    viewportMode: 'desktop',
    gridDrawerOpen: false,
    stale: false,
  };
}

export function clampGridHeight(
  raw: number,
  availableHeight: number,
): number {
  const max = Math.max(MIN_GRID_HEIGHT, Math.floor(availableHeight * MAX_GRID_HEIGHT_FRACTION));
  if (raw < MIN_GRID_HEIGHT) return MIN_GRID_HEIGHT;
  if (raw > max) return max;
  return Math.round(raw);
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'SET_CALCULATOR':
      return { ...state, calculator: action.row };
    case 'SET_TITLE':
      return {
        ...state,
        calculator: {
          ...state.calculator,
          title: action.title,
          updated_at: action.updated_at,
        },
      };
    case 'SET_DESCRIPTION':
      return {
        ...state,
        calculator: {
          ...state.calculator,
          description: action.description,
          updated_at: action.updated_at,
        },
      };
    case 'SET_THEME':
      return {
        ...state,
        calculator: {
          ...state.calculator,
          theme_id: action.theme_id,
          updated_at: action.updated_at,
        },
      };
    case 'PUSH_OPERATION':
      // New operations clear the redo stack — standard undo-stack semantics.
      return { ...state, past: [...state.past, action.op], future: [] };
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const op = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        future: [...state.future, op],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const op = state.future[state.future.length - 1];
      return {
        ...state,
        future: state.future.slice(0, -1),
        past: [...state.past, op],
      };
    }
    case 'CLEAR_HISTORY':
      return { ...state, past: [], future: [] };
    case 'SET_GRID_HEIGHT':
      return {
        ...state,
        gridHeight: action.height,
        gridCollapsed: false,
        prevGridHeight: action.height,
      };
    case 'TOGGLE_GRID_COLLAPSED':
      if (state.gridCollapsed) {
        return {
          ...state,
          gridCollapsed: false,
          gridHeight: state.prevGridHeight,
        };
      }
      return {
        ...state,
        gridCollapsed: true,
        prevGridHeight: state.gridHeight,
        gridHeight: COLLAPSED_GRID_HEIGHT,
      };
    case 'SET_VIEWPORT':
      return { ...state, viewportMode: action.mode };
    case 'SET_DRAWER_OPEN':
      return { ...state, gridDrawerOpen: action.open };
    case 'MARK_STALE':
      // Once stale, freeze the history so undo cannot replay against a 409 server.
      return { ...state, stale: true, past: [], future: [] };
    default:
      return state;
  }
}
