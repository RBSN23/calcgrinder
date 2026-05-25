// PROJ-8 — Editor reducer.
//
// Pure state machine for the calculator editor. The provider layer wraps
// every "do" callback with a synchronous dispatch so the reducer remains
// trivially testable. Async PATCH plumbing lives in the provider, not here.
//
// Slices share a single reducer:
//   - calculator: { id, title, description, theme_id, updated_at }
//   - undo/redo : { past, future } of inverse operation descriptors
//   - layout    : { gridHeight, gridCollapsed, viewportMode, gridDrawerOpen }
//   - sections  : SectionRow[] (PROJ-9)
//   - cells     : CellRow[]    (PROJ-9)

import type { CalculatorRow } from '@/lib/calculators/types';
import type { CellRow } from '@/lib/cells/types';
import type { ChartRow } from '@/lib/charts/types';
import type { SectionRow } from '@/lib/sections/types';
import type { TextBlockRow } from '@/lib/text-blocks/types';

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
  /** PROJ-23 — global expand/collapse for cell/chart settings in the grid panel. Session-only. */
  gridSettingsExpanded: boolean;
  sections: SectionRow[];
  cells: CellRow[];
  // PROJ-15 — charts attached to this calculator's sections.
  charts: ChartRow[];
  // PROJ-16 — text blocks (markdown prose) per section.
  text_blocks: TextBlockRow[];
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
  // Parent calculators.updated_at is bumped by a DB trigger on every
  // cell/section write. Mutation responses echo the fresh value so the
  // next optimistic-concurrency check sends a non-stale token.
  | { type: 'SET_CALCULATOR_UPDATED_AT'; updated_at: string }
  // PROJ-10 — lifecycle column edits surfaced by the toolbar.
  | { type: 'SET_PUBLISHED'; published: boolean; updated_at: string }
  | { type: 'SET_PUBLIC_TOKEN'; public_token: string; updated_at: string }
  | { type: 'PUSH_OPERATION'; op: Operation }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_GRID_HEIGHT'; height: number }
  | { type: 'TOGGLE_GRID_COLLAPSED' }
  | { type: 'SET_VIEWPORT'; mode: ViewportMode }
  | { type: 'SET_DRAWER_OPEN'; open: boolean }
  | { type: 'TOGGLE_GRID_SETTINGS' }
  | { type: 'MARK_STALE' }
  | { type: 'SET_SECTIONS'; sections: SectionRow[] }
  | { type: 'SET_CELLS'; cells: CellRow[] }
  | { type: 'UPSERT_SECTION'; section: SectionRow }
  | { type: 'REMOVE_SECTION'; id: string }
  | { type: 'UPSERT_CELL'; cell: CellRow }
  | { type: 'UPSERT_CELLS'; cells: CellRow[] }
  | { type: 'RECONCILE_CELL'; tempId: string; cell: CellRow }
  | { type: 'REMOVE_CELL'; id: string }
  // PROJ-15 — chart mutations.
  | { type: 'SET_CHARTS'; charts: ChartRow[] }
  | { type: 'UPSERT_CHART'; chart: ChartRow }
  | { type: 'REMOVE_CHART'; id: string }
  // PROJ-16 — text-block mutations.
  | { type: 'SET_TEXT_BLOCKS'; text_blocks: TextBlockRow[] }
  | { type: 'UPSERT_TEXT_BLOCK'; text_block: TextBlockRow }
  | { type: 'REMOVE_TEXT_BLOCK'; id: string };

export function initialEditorState(
  row: CalculatorRow,
  opts: {
    sections?: SectionRow[];
    cells?: CellRow[];
    charts?: ChartRow[];
    text_blocks?: TextBlockRow[];
  } = {},
): EditorState {
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
    gridSettingsExpanded: false,
    sections: opts.sections ?? [],
    cells: opts.cells ?? [],
    charts: opts.charts ?? [],
    text_blocks: opts.text_blocks ?? [],
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
    case 'SET_CALCULATOR_UPDATED_AT':
      if (state.calculator.updated_at === action.updated_at) return state;
      return {
        ...state,
        calculator: {
          ...state.calculator,
          updated_at: action.updated_at,
        },
      };
    case 'SET_PUBLISHED':
      return {
        ...state,
        calculator: {
          ...state.calculator,
          published: action.published,
          updated_at: action.updated_at,
        },
      };
    case 'SET_PUBLIC_TOKEN':
      return {
        ...state,
        calculator: {
          ...state.calculator,
          public_token: action.public_token,
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
    case 'TOGGLE_GRID_SETTINGS':
      return { ...state, gridSettingsExpanded: !state.gridSettingsExpanded };
    case 'MARK_STALE':
      // Once stale, freeze the history so undo cannot replay against a 409 server.
      return { ...state, stale: true, past: [], future: [] };
    case 'SET_SECTIONS':
      return { ...state, sections: sortSections(action.sections) };
    case 'SET_CELLS':
      return { ...state, cells: sortCells(action.cells) };
    case 'UPSERT_SECTION': {
      const idx = state.sections.findIndex((s) => s.id === action.section.id);
      const next =
        idx === -1
          ? [...state.sections, action.section]
          : state.sections.map((s) => (s.id === action.section.id ? action.section : s));
      return { ...state, sections: sortSections(next) };
    }
    case 'REMOVE_SECTION':
      return {
        ...state,
        sections: state.sections.filter((s) => s.id !== action.id),
        cells: state.cells.filter((c) => c.section_id !== action.id),
        charts: state.charts.filter((c) => c.section_id !== action.id),
        text_blocks: state.text_blocks.filter(
          (t) => t.section_id !== action.id,
        ),
      };
    case 'UPSERT_CELL': {
      const idx = state.cells.findIndex((c) => c.id === action.cell.id);
      const next =
        idx === -1
          ? [...state.cells, action.cell]
          : state.cells.map((c) => (c.id === action.cell.id ? action.cell : c));
      return { ...state, cells: sortCells(next) };
    }
    case 'UPSERT_CELLS': {
      const byId = new Map(action.cells.map((c) => [c.id, c]));
      const merged = state.cells.map((c) => byId.get(c.id) ?? c);
      const newOnes = action.cells.filter(
        (c) => !state.cells.some((existing) => existing.id === c.id),
      );
      return { ...state, cells: sortCells([...merged, ...newOnes]) };
    }
    case 'RECONCILE_CELL': {
      const next = state.cells.map((c) =>
        c.id === action.tempId ? action.cell : c,
      );
      return { ...state, cells: sortCells(next) };
    }
    case 'REMOVE_CELL':
      return { ...state, cells: state.cells.filter((c) => c.id !== action.id) };
    case 'SET_CHARTS':
      return { ...state, charts: sortCharts(action.charts) };
    case 'UPSERT_CHART': {
      const idx = state.charts.findIndex((c) => c.id === action.chart.id);
      const next =
        idx === -1
          ? [...state.charts, action.chart]
          : state.charts.map((c) => (c.id === action.chart.id ? action.chart : c));
      return { ...state, charts: sortCharts(next) };
    }
    case 'REMOVE_CHART':
      return { ...state, charts: state.charts.filter((c) => c.id !== action.id) };
    case 'SET_TEXT_BLOCKS':
      return { ...state, text_blocks: sortTextBlocks(action.text_blocks) };
    case 'UPSERT_TEXT_BLOCK': {
      const idx = state.text_blocks.findIndex(
        (t) => t.id === action.text_block.id,
      );
      const next =
        idx === -1
          ? [...state.text_blocks, action.text_block]
          : state.text_blocks.map((t) =>
              t.id === action.text_block.id ? action.text_block : t,
            );
      return { ...state, text_blocks: sortTextBlocks(next) };
    }
    case 'REMOVE_TEXT_BLOCK':
      return {
        ...state,
        text_blocks: state.text_blocks.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

function sortTextBlocks(rows: TextBlockRow[]): TextBlockRow[] {
  return [...rows].sort((a, b) => {
    if (a.section_id < b.section_id) return -1;
    if (a.section_id > b.section_id) return 1;
    return a.display_order - b.display_order;
  });
}

function sortCharts(rows: ChartRow[]): ChartRow[] {
  return [...rows].sort((a, b) => {
    if (a.section_id < b.section_id) return -1;
    if (a.section_id > b.section_id) return 1;
    return a.display_order - b.display_order;
  });
}

function sortSections(rows: SectionRow[]): SectionRow[] {
  return [...rows].sort((a, b) => a.display_order - b.display_order);
}

function sortCells(rows: CellRow[]): CellRow[] {
  // Primary key is section_id (UUID string compare), secondary is
  // display_order within a section. This is NOT the same order as
  // section.display_order then cell.display_order — the reducer
  // intentionally has no access to the sections slice (sortCells must
  // run on a single slice in isolation).
  //
  // Every cross-section consumer re-sorts or filters per section
  // before rendering, so the in-store order isn't user-visible:
  //   - GridPanel + GridDrawerToggle re-sort via a section_id →
  //     section.display_order map.
  //   - SectionList + SectionBlock filter by section_id and use the
  //     within-section display_order (which IS correct here).
  //   - useEvaluation maps each cell by name; order-insensitive.
  // The only consumer that walks state.cells cross-section without a
  // re-sort is HiddenCellsPill's popover list, and its sort order is
  // an explicit Open Question in PROJ-9's spec (defer to feedback).
  // If a future consumer needs section-then-cell display_order it
  // must select-and-sort with `state.sections` in hand.
  return [...rows].sort((a, b) => {
    if (a.section_id < b.section_id) return -1;
    if (a.section_id > b.section_id) return 1;
    return a.display_order - b.display_order;
  });
}
