'use client';

// PROJ-15 — Grid panel chart column (listing-only).
//
// Narrower than a Cell column. The kebab does NOT inline-expand; instead
// it jumps focus to the Builder canvas, scrolls the corresponding chart
// card into view, expands the configurator there, and briefly pulses
// the Grid column for ~600ms.

import * as React from 'react';

import type { ChartRow } from '@/lib/charts/types';
import { useEditor } from '@/lib/editor/EditorProvider';
import { useEvaluationContext } from '@/lib/editor/EvaluationContext';
import { cn } from '@/lib/utils';

import { chartTypeSummary } from './chart-data-resolver';

interface ChartGridColumnProps {
  chart: ChartRow;
}

export function ChartGridColumn({ chart }: ChartGridColumnProps) {
  const [pulsing, setPulsing] = React.useState(false);
  const { state } = useEditor();
  const { results } = useEvaluationContext();
  const summary = chartTypeSummary(chart, state.cells, results);

  const onKebabClick = () => {
    setPulsing(true);
    setTimeout(() => setPulsing(false), 600);
    const target = document.querySelector(
      `[data-chart-id="${chart.id}"]`,
    ) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    }
    // PROJ-15 QA BUG-L2 — dispatch an OPEN signal (not a toggle). The
    // chart card's listener idempotently opens its configurator; if it's
    // already open the kebab is a no-op, matching the spec ("kebab jumps
    // to the Builder, scrolls in, expands").
    window.dispatchEvent(
      new CustomEvent('cg:open-chart-configurator', {
        detail: { id: chart.id },
      }),
    );
  };

  return (
    <div
      data-grid-chart-id={chart.id}
      className={cn(
        'flex w-[160px] shrink-0 flex-col border-r border-cg-border bg-cg-surface',
        pulsing && 'ring-2 ring-cg-accent ring-offset-1 transition-shadow',
      )}
    >
      <header className="flex items-center gap-1 border-b border-cg-border px-2 py-1.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-mono text-[11px] font-medium text-cg-text">
            {chart.name}
          </span>
          <div className="flex items-center gap-1">
            <span className="rounded bg-purple-500/10 px-1 py-0 text-[9.5px] font-medium uppercase tracking-wide text-purple-700">
              chart
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Open chart settings in Builder"
          onClick={onKebabClick}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-cg-text-muted hover:bg-cg-surface-2"
        >
          <KebabIcon />
        </button>
      </header>
      <div className="px-2 py-2 text-[11px] text-cg-text-muted">{summary}</div>
    </div>
  );
}

function KebabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
