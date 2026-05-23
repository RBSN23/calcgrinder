'use client';

// PROJ-8 — Slot renderer.
//
// Polymorphic dispatcher for the Builder canvas. PROJ-8 ships it with an
// empty registry — the array of `display_element` is always `[]`. PROJ-9
// will fill it with cells / sections; PROJ-11 will reuse the same component
// with a different data loader for the visitor view.
//
// The forward-compat seam (see INDEX.md) is that adding a new element type
// is a *renderer registration*, not a rewrite — the dispatch lives here.

import * as React from 'react';

// Element shape is intentionally permissive — PROJ-9's cell type and PROJ-15's
// chart type extend `DisplayElement` with their own discriminants.
export interface DisplayElement {
  type: string;
  id: string;
}

export type DisplayElementRenderer<T extends DisplayElement = DisplayElement> =
  React.ComponentType<{ element: T }>;

const REGISTRY: Record<string, DisplayElementRenderer> = {};

export function registerDisplayElementRenderer<T extends DisplayElement>(
  type: string,
  renderer: DisplayElementRenderer<T>,
): void {
  REGISTRY[type] = renderer as DisplayElementRenderer;
}

interface SlotRendererProps {
  elements: DisplayElement[];
}

export function SlotRenderer({ elements }: SlotRendererProps) {
  if (elements.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {elements.map((element) => {
        const Renderer = REGISTRY[element.type];
        if (!Renderer) return null;
        return <Renderer key={element.id} element={element} />;
      })}
    </div>
  );
}
