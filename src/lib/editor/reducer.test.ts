import { describe, expect, it } from 'vitest';

import {
  COLLAPSED_GRID_HEIGHT,
  DEFAULT_GRID_HEIGHT,
  MIN_GRID_HEIGHT,
  clampGridHeight,
  editorReducer,
  initialEditorState,
  type EditorState,
  type Operation,
} from './reducer';

const ROW = {
  id: 'row-1',
  title: 'Untitled calculator',
  description: '',
  theme_id: 'calcgrinder',
  updated_at: '2026-05-23T10:00:00.000Z',
  published: false,
  public_token: 'mocked-token-22-char-xx',
};

function makeOp(label = 'op'): Operation {
  return { label, do: () => undefined, undo: () => undefined };
}

function withHistory(...labels: string[]): EditorState {
  return labels.reduce(
    (acc, label) =>
      editorReducer(acc, { type: 'PUSH_OPERATION', op: makeOp(label) }),
    initialEditorState(ROW),
  );
}

describe('editorReducer — calculator slice', () => {
  it('SET_TITLE updates title + updated_at, leaves history intact', () => {
    const start = withHistory('a');
    const next = editorReducer(start, {
      type: 'SET_TITLE',
      title: 'Mortgage',
      updated_at: '2026-05-23T10:01:00.000Z',
    });
    expect(next.calculator.title).toBe('Mortgage');
    expect(next.calculator.updated_at).toBe('2026-05-23T10:01:00.000Z');
    expect(next.past).toHaveLength(1);
  });

  it('SET_THEME updates theme_id + updated_at', () => {
    const next = editorReducer(initialEditorState(ROW), {
      type: 'SET_THEME',
      theme_id: 'vessel',
      updated_at: '2026-05-23T10:02:00.000Z',
    });
    expect(next.calculator.theme_id).toBe('vessel');
    expect(next.calculator.updated_at).toBe('2026-05-23T10:02:00.000Z');
  });

  it('SET_CALCULATOR_UPDATED_AT refreshes only the token, leaves other fields intact', () => {
    const start = withHistory('a');
    const next = editorReducer(start, {
      type: 'SET_CALCULATOR_UPDATED_AT',
      updated_at: '2026-05-23T10:09:00.000Z',
    });
    // Token is refreshed.
    expect(next.calculator.updated_at).toBe('2026-05-23T10:09:00.000Z');
    // Other slices untouched — this is the fix for the post-PROJ-9 409
    // storm where cell/section writes bumped calculators.updated_at via
    // trigger but the client never refreshed its cache.
    expect(next.calculator.title).toBe(start.calculator.title);
    expect(next.calculator.theme_id).toBe(start.calculator.theme_id);
    expect(next.past).toHaveLength(1);
  });

  it('SET_CALCULATOR_UPDATED_AT is a no-op when the value already matches', () => {
    const start = initialEditorState(ROW);
    const next = editorReducer(start, {
      type: 'SET_CALCULATOR_UPDATED_AT',
      updated_at: ROW.updated_at,
    });
    // Returning the same reference keeps useSyncExternalStore from
    // re-rendering subscribers needlessly.
    expect(next).toBe(start);
  });
});

describe('editorReducer — undo / redo', () => {
  it('PUSH_OPERATION adds to past and clears future', () => {
    const seeded = editorReducer(initialEditorState(ROW), {
      type: 'PUSH_OPERATION',
      op: makeOp('a'),
    });
    const withRedoBuffer = editorReducer(seeded, { type: 'UNDO' });
    expect(withRedoBuffer.past).toHaveLength(0);
    expect(withRedoBuffer.future).toHaveLength(1);

    const afterNewOp = editorReducer(withRedoBuffer, {
      type: 'PUSH_OPERATION',
      op: makeOp('b'),
    });
    expect(afterNewOp.past).toHaveLength(1);
    expect(afterNewOp.future).toHaveLength(0);
  });

  it('UNDO on empty past is a no-op', () => {
    const start = initialEditorState(ROW);
    expect(editorReducer(start, { type: 'UNDO' })).toBe(start);
  });

  it('REDO on empty future is a no-op', () => {
    const start = initialEditorState(ROW);
    expect(editorReducer(start, { type: 'REDO' })).toBe(start);
  });

  it('UNDO then REDO restores history to its original shape', () => {
    const start = withHistory('a', 'b');
    const afterUndo = editorReducer(start, { type: 'UNDO' });
    const afterRedo = editorReducer(afterUndo, { type: 'REDO' });
    expect(afterRedo.past.map((o) => o.label)).toEqual(['a', 'b']);
    expect(afterRedo.future).toEqual([]);
  });

  it('CLEAR_HISTORY empties both stacks', () => {
    const start = withHistory('a', 'b');
    const cleared = editorReducer(start, { type: 'CLEAR_HISTORY' });
    expect(cleared.past).toEqual([]);
    expect(cleared.future).toEqual([]);
  });

  it('MARK_STALE flips the flag and clears history', () => {
    const start = withHistory('a', 'b');
    const stale = editorReducer(start, { type: 'MARK_STALE' });
    expect(stale.stale).toBe(true);
    expect(stale.past).toEqual([]);
    expect(stale.future).toEqual([]);
  });
});

describe('editorReducer — layout slice', () => {
  it('SET_GRID_HEIGHT updates height + prevHeight + clears collapsed', () => {
    const start = initialEditorState(ROW);
    const collapsed = editorReducer(start, { type: 'TOGGLE_GRID_COLLAPSED' });
    expect(collapsed.gridCollapsed).toBe(true);
    expect(collapsed.gridHeight).toBe(COLLAPSED_GRID_HEIGHT);

    const resized = editorReducer(collapsed, {
      type: 'SET_GRID_HEIGHT',
      height: 240,
    });
    expect(resized.gridCollapsed).toBe(false);
    expect(resized.gridHeight).toBe(240);
    expect(resized.prevGridHeight).toBe(240);
  });

  it('TOGGLE_GRID_COLLAPSED stashes height and restores on second toggle', () => {
    const start = editorReducer(initialEditorState(ROW), {
      type: 'SET_GRID_HEIGHT',
      height: 220,
    });
    const collapsed = editorReducer(start, { type: 'TOGGLE_GRID_COLLAPSED' });
    expect(collapsed.gridCollapsed).toBe(true);
    expect(collapsed.gridHeight).toBe(COLLAPSED_GRID_HEIGHT);
    expect(collapsed.prevGridHeight).toBe(220);
    const restored = editorReducer(collapsed, { type: 'TOGGLE_GRID_COLLAPSED' });
    expect(restored.gridCollapsed).toBe(false);
    expect(restored.gridHeight).toBe(220);
  });

  it('SET_VIEWPORT swaps viewport mode', () => {
    const next = editorReducer(initialEditorState(ROW), {
      type: 'SET_VIEWPORT',
      mode: 'tablet',
    });
    expect(next.viewportMode).toBe('tablet');
  });

  it('SET_DRAWER_OPEN flips drawer flag', () => {
    const start = initialEditorState(ROW);
    expect(editorReducer(start, { type: 'SET_DRAWER_OPEN', open: true }).gridDrawerOpen).toBe(true);
  });

  it('TOGGLE_GRID_SETTINGS toggles gridSettingsExpanded', () => {
    const start = initialEditorState(ROW);
    expect(start.gridSettingsExpanded).toBe(false);
    const expanded = editorReducer(start, { type: 'TOGGLE_GRID_SETTINGS' });
    expect(expanded.gridSettingsExpanded).toBe(true);
    const collapsed = editorReducer(expanded, { type: 'TOGGLE_GRID_SETTINGS' });
    expect(collapsed.gridSettingsExpanded).toBe(false);
  });

  it('initial state uses DEFAULT_GRID_HEIGHT', () => {
    expect(initialEditorState(ROW).gridHeight).toBe(DEFAULT_GRID_HEIGHT);
  });
});

describe('clampGridHeight', () => {
  it('clamps below MIN_GRID_HEIGHT up to the minimum', () => {
    expect(clampGridHeight(20, 1000)).toBe(MIN_GRID_HEIGHT);
  });

  it('clamps above 60% of available to that ceiling', () => {
    expect(clampGridHeight(900, 1000)).toBe(600);
  });

  it('rounds in-range values', () => {
    expect(clampGridHeight(200.7, 1000)).toBe(201);
  });

  it('respects minimum even when 60% of available is smaller', () => {
    // 60% of 100 = 60 < MIN. The clamp keeps MIN as the floor.
    expect(clampGridHeight(20, 100)).toBe(MIN_GRID_HEIGHT);
  });
});

describe('editorReducer — RECONCILE_CELL', () => {
  const TEMP_CELL = {
    id: '__temp_1',
    calculator_id: ROW.id,
    section_id: 'sec-1',
    kind: 'input' as const,
    name: 'cell_1',
    label: 'New cell',
    description: '',
    description_render: 'caption' as const,
    value_type: 'number' as const,
    visibility: 'visible' as const,
    editability: 'editable' as const,
    default_value: null,
    formula: null,
    display_widget: 'number_field' as const,
    display_format: 'auto',
    display_emphasis: 'plain' as const,
    unit: null,
    numeric_min: null,
    numeric_max: null,
    numeric_step: null,
    select_options: null,
    currency_code: null,
    card_accent: 'theme',
    card_background_tint: 'none' as const,
    card_border: 'none' as const,
    card_size_hint: 'narrow' as const,
    text_size: 'm',
    text_colour: 'default',
    tabular_columns: [],
    display_order: 0,
    created_at: '2026-05-25T10:00:00.000Z',
    updated_at: '2026-05-25T10:00:00.000Z',
  };

  const REAL_CELL = {
    ...TEMP_CELL,
    id: 'real-uuid-1234',
    updated_at: '2026-05-25T10:00:01.000Z',
  };

  it('replaces the temp cell with the real cell', () => {
    const state = editorReducer(initialEditorState(ROW), {
      type: 'UPSERT_CELL',
      cell: TEMP_CELL,
    });
    expect(state.cells).toHaveLength(1);
    expect(state.cells[0].id).toBe('__temp_1');

    const next = editorReducer(state, {
      type: 'RECONCILE_CELL',
      tempId: '__temp_1',
      cell: REAL_CELL,
    });
    expect(next.cells).toHaveLength(1);
    expect(next.cells[0].id).toBe('real-uuid-1234');
    expect(next.cells[0].updated_at).toBe('2026-05-25T10:00:01.000Z');
  });

  it('does nothing when tempId is not found', () => {
    const state = editorReducer(initialEditorState(ROW), {
      type: 'UPSERT_CELL',
      cell: TEMP_CELL,
    });
    const next = editorReducer(state, {
      type: 'RECONCILE_CELL',
      tempId: '__temp_99',
      cell: REAL_CELL,
    });
    expect(next.cells).toHaveLength(1);
    expect(next.cells[0].id).toBe('__temp_1');
  });

  it('preserves other cells when reconciling', () => {
    let state = editorReducer(initialEditorState(ROW), {
      type: 'UPSERT_CELL',
      cell: { ...TEMP_CELL, id: 'existing', name: 'price', display_order: 0 },
    });
    state = editorReducer(state, {
      type: 'UPSERT_CELL',
      cell: { ...TEMP_CELL, display_order: 1 },
    });
    expect(state.cells).toHaveLength(2);

    const next = editorReducer(state, {
      type: 'RECONCILE_CELL',
      tempId: '__temp_1',
      cell: { ...REAL_CELL, display_order: 1 },
    });
    expect(next.cells).toHaveLength(2);
    expect(next.cells.find((c) => c.id === 'existing')).toBeTruthy();
    expect(next.cells.find((c) => c.id === 'real-uuid-1234')).toBeTruthy();
  });
});
