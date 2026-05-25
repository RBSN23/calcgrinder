'use client';

// PROJ-15 / PROJ-23 — Grid panel chart column.
//
// PROJ-23 changes: kebab replaced with chevron toggle that participates
// in the global gridSettingsExpanded state. When expanded, shows a
// compact chart-type summary + "Open in Builder" button. Pulse-on-click
// (scrolling to the chart card in the canvas) is preserved.

import * as React from 'react';

import type { ChartRow } from '@/lib/charts/types';
import { useEditor } from '@/lib/editor/EditorProvider';
import { useEvaluationContext } from '@/lib/editor/EvaluationContext';
import { cn } from '@/lib/utils';

import { Icons } from '../shell/icons';

import { chartTypeSummary } from './chart-data-resolver';

interface ChartGridColumnProps {
  chart: ChartRow;
}

export function ChartGridColumn({ chart }: ChartGridColumnProps) {
  const [pulsing, setPulsing] = React.useState(false);
  const { state, dispatch } = useEditor();
  const { results } = useEvaluationContext();
  const summary = chartTypeSummary(chart, state.cells, results);
  const expanded = state.gridSettingsExpanded;

  const scrollToChart = () => {
    setPulsing(true);
    setTimeout(() => setPulsing(false), 600);
    const target = document.querySelector(
      `[data-chart-id="${chart.id}"]`,
    ) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    }
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
          aria-label={expanded ? 'Collapse chart settings' : 'Expand chart settings'}
          aria-expanded={expanded}
          onClick={() => dispatch({ type: 'TOGGLE_GRID_SETTINGS' })}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-cg-text-muted hover:bg-cg-surface-2"
        >
          <span
            className={cn(
              'inline-flex transition-transform duration-150',
              expanded ? 'rotate-180' : 'rotate-0',
            )}
            aria-hidden
          >
            <Icons.ChevD size={12} />
          </span>
        </button>
      </header>
      <div className="px-2 py-2 text-[11px] text-cg-text-muted">{summary}</div>
      {expanded ? (
        <div className="border-t border-cg-border bg-cg-surface-2 p-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-cg-text-muted">
            Type: {chart.chart_type}
          </p>
          <button
            type="button"
            onClick={scrollToChart}
            className="rounded border border-cg-border bg-cg-surface px-2 py-1 text-[10.5px] font-medium text-cg-text-muted hover:bg-cg-surface-2 hover:text-cg-text"
          >
            Open in Builder
          </button>
        </div>
      ) : null}
    </div>
  );
}
