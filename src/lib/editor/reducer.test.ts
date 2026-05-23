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
