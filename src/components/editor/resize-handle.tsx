'use client';

// PROJ-8 — Drag-resize handle between the Grid panel and the Builder.
//
// Hand-rolled Pointer Events instead of a split-pane library: one horizontal
// handle, two clamps. The handle owns its own pointer-capture, ARIA wiring,
// and keyboard support (↑ / ↓ adjust by 24px increments).

import * as React from 'react';

import { useEditor } from '@/lib/editor/EditorProvider';
import { clampGridHeight, MIN_GRID_HEIGHT } from '@/lib/editor/reducer';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  /** Pixel height of the editor frame the panels share. Drives the clamp. */
  containerHeight: number;
  className?: string;
}

const KEYBOARD_STEP = 24;

export function ResizeHandle({ containerHeight, className }: ResizeHandleProps) {
  const { state, dispatch } = useEditor();
  const dragStartRef = React.useRef<{
    startHeight: number;
    startY: number;
  } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (state.gridCollapsed) return;
    e.preventDefault();
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startHeight: state.gridHeight,
      startY: e.clientY,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    const delta = e.clientY - start.startY;
    const next = clampGridHeight(start.startHeight + delta, containerHeight);
    if (next !== state.gridHeight) {
      dispatch({ type: 'SET_GRID_HEIGHT', height: next });
    }
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current) {
      (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
      dragStartRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (state.gridCollapsed) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      dispatch({
        type: 'SET_GRID_HEIGHT',
        height: clampGridHeight(state.gridHeight - KEYBOARD_STEP, containerHeight),
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      dispatch({
        type: 'SET_GRID_HEIGHT',
        height: clampGridHeight(state.gridHeight + KEYBOARD_STEP, containerHeight),
      });
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize Grid panel"
      aria-valuemin={MIN_GRID_HEIGHT}
      aria-valuemax={Math.floor(containerHeight * 0.6)}
      aria-valuenow={state.gridHeight}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative flex h-2 w-full shrink-0 cursor-row-resize items-center justify-center',
        'border-y border-cg-border bg-cg-surface-2 outline-none',
        'focus-visible:ring-2 focus-visible:ring-cg-accent',
        state.gridCollapsed && 'cursor-default',
        className,
      )}
    >
      <span
        aria-hidden
        className="block h-[2px] w-10 rounded-full bg-cg-border-strong transition-colors group-hover:bg-cg-text-muted"
      />
    </div>
  );
}
