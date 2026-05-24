'use client';

// PROJ-15 — Register the chart renderer with the polymorphic SlotRenderer.
//
// The forward-compat seam (per INDEX.md): adding a new element type is a
// `registerDisplayElementRenderer('chart', ChartCard)` call — no dispatch
// rewrite. Today the chart rendering path goes through SectionBlock's
// SectionChartList helper for simplicity, but registration here keeps the
// seam wired so PROJ-16 / PROJ-17 follow the same pattern.

import * as React from 'react';

import type { ChartRow } from '@/lib/charts/types';
import { useCalculatorState } from '@/components/calculator';
import { getTheme } from '@/lib/themes';

import { ChartCard } from './chart-card';
import {
  registerDisplayElementRenderer,
  type DisplayElement,
} from './slot-renderer';

interface ChartElement extends DisplayElement {
  type: 'chart';
  chart: ChartRow;
}

function ChartSlot({ element }: { element: ChartElement }) {
  const { calculator } = useCalculatorState();
  const theme = getTheme(calculator.theme_id);
  return <ChartCard chart={element.chart} theme={theme} />;
}

let registered = false;

/** Idempotent registration — safe to call from a top-level effect. */
export function registerChartSlotRenderer(): void {
  if (registered) return;
  registerDisplayElementRenderer<ChartElement>('chart', ChartSlot);
  registered = true;
}

// Register at module import so any consumer that imports from
// `@/components/editor` picks up the chart renderer transparently.
registerChartSlotRenderer();
