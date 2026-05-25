'use client';

// PROJ-9 — Shared @dnd-kit primitives for the editor.
//
// Two sortable surfaces share these helpers:
//   1. SectionList — vertical reorder of sections within a calculator.
//   2. SectionBlock's children — reorder of cells within a section.
//
// Touch drag uses a 300ms long-press activation (spec line 615-616) so
// accidental drags during mobile scroll are filtered out. Keyboard
// sensor is enabled by default so screen-reader users can re-order via
// the arrow keys.

import * as React from 'react';

import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '@/lib/utils';

/** Shared sensor configuration for every sortable surface in the editor. */
export function useEditorDndSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      // Tiny tolerance so a click on the drag handle doesn't auto-fire a
      // drag when the user releases without moving.
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      // Spec lines 614-616 — touch drag requires a 300ms long-press so a
      // user scrolling the Builder canvas on phone/tablet doesn't
      // accidentally pick up a card.
      activationConstraint: { delay: 300, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}

interface SortableItemProps {
  id: string;
  children: (api: {
    setNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
    isDragging: boolean;
    dragHandleProps: React.HTMLAttributes<HTMLElement>;
  }) => React.ReactNode;
  /** Optional className applied to the outermost element. */
  className?: string;
  /** Section-level sortable data (for cross-section DnD). */
  data?: Record<string, unknown>;
}

export function SortableItem({ id, children, data }: SortableItemProps) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id, data });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 5 : undefined,
  };

  return (
    <>
      {children({
        setNodeRef,
        style,
        isDragging,
        dragHandleProps: {
          ...attributes,
          ...listeners,
        } as React.HTMLAttributes<HTMLElement>,
      })}
    </>
  );
}

/** Inline drag-handle button glyph used by both Section and Cell handles. */
export function DragHandle({
  className,
  ariaLabel,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-cg-text-muted transition-colors hover:bg-cg-surface-2 hover:text-cg-text active:cursor-grabbing',
        className,
      )}
      // Browser default for buttons inside draggable parents — block the
      // implicit drag-image so @dnd-kit owns the visual lift.
      onDragStart={(e) => e.preventDefault()}
      {...rest}
    >
      <DotsIcon />
    </button>
  );
}

function DotsIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
