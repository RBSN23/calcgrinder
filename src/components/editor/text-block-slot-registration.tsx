'use client';

// PROJ-16 — Register the text-block renderer with the polymorphic
// SlotRenderer.
//
// Forward-compat seam (per INDEX.md): adding a new element type is a
// `registerDisplayElementRenderer('text_block', TextBlockCard)` call —
// no dispatch rewrite. The chart registration set the precedent
// (chart-slot-registration.tsx); PROJ-17 (Tabular) follows the same
// pattern.
//
// Today the section-block renders text blocks alongside cells / charts
// directly inside its layout grid (so they participate in the same
// drag-reorder context). The registration here keeps the seam wired so
// any consumer iterating `display_elements` polymorphically picks up
// text_block without further code changes.

import * as React from 'react';

import { useCalculatorState } from '@/components/calculator';
import type { TextBlockRow } from '@/lib/text-blocks/types';
import { getTheme } from '@/lib/themes';

import { TextBlockCard } from './text-block-card';
import {
  registerDisplayElementRenderer,
  type DisplayElement,
} from './slot-renderer';

interface TextBlockElement extends DisplayElement {
  type: 'text_block';
  text_block: TextBlockRow;
}

function TextBlockSlot({ element }: { element: TextBlockElement }) {
  const { calculator } = useCalculatorState();
  const theme = getTheme(calculator.theme_id);
  return <TextBlockCard textBlock={element.text_block} theme={theme} />;
}

let registered = false;

/** Idempotent registration — safe to call from a top-level effect. */
export function registerTextBlockSlotRenderer(): void {
  if (registered) return;
  registerDisplayElementRenderer<TextBlockElement>('text_block', TextBlockSlot);
  registered = true;
}

// Register at module import so any consumer that imports from
// `@/components/editor` picks up the text-block renderer transparently.
registerTextBlockSlotRenderer();
