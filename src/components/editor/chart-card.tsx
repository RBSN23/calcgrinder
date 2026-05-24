'use client';

// PROJ-15 — Chart card (Builder + Visitor).
//
// Mounted via the SlotRenderer chart registration. Renders the chart in
// resting state. In the Builder, hover affordances expose a drag handle +
// edit-icon; clicking edit expands the ChartConfigurator inside the card.
//
// The visitor surface has no EditorProvider, so all Builder-only state
// (useEditor, configurator open/close, fresh-chart auto-expand, custom
// event listener) lives in the `<ChartEditAffordance>` child that only
// renders when `isBuilder` is true. Mirrors the `CellEditAffordance`
// split in cell-card.tsx (PROJ-15 QA BUG-C4 fix).

import * as React from 'react';

import {
  useCalculatorState,
  useIsBuilder,
} from '@/components/calculator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ChartRow, ChartType } from '@/lib/charts/types';
import { defaultBindings, type ChartBindings } from '@/lib/charts/bindings';
import { getChartStructuralErrors } from '@/lib/charts/structural-errors';
import { animateNode, prefersReducedMotion } from '@/lib/charts/animate';
import { useEditor } from '@/lib/editor/EditorProvider';
import { cardSurface, type Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';

import { ChartBrokenBindingPanel } from './chart-broken-binding-panel';
import { ChartConfigurator } from './chart-configurator';
import {
  ChartRendererDispatch,
  chartHasTruncation,
} from './chart-renderer-dispatch';
import type { ChartThemeBundle } from './chart-renderers';
import { DragHandle } from './dnd-helpers';

interface ChartCardProps {
  chart: ChartRow;
  theme: Theme;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
}

export function ChartCard({ chart, theme, dragHandleProps, isDragging }: ChartCardProps) {
  const { cells, results } = useCalculatorState();
  const isBuilder = useIsBuilder();

  const themeBundle = React.useMemo<ChartThemeBundle>(
    () => ({
      surface: theme.card,
      text: theme.text,
      muted: theme.muted,
      subtle: theme.subtle,
      border: theme.border,
      palette: theme.chartPalette,
      glow: theme.cardStyle === 'glow',
    }),
    [theme],
  );

  // Structural errors → broken-binding placeholder (zero-valid-binding state
  // shows the placeholder; partial-binding state lets the renderer render
  // and only flags the missing slot in the Data tab).
  const cellMeta = React.useMemo(
    () => cells.map((c) => ({ id: c.id, name: c.name })),
    [cells],
  );
  const errors = React.useMemo(
    () => getChartStructuralErrors([chart], results, cellMeta),
    [chart, results, cellMeta],
  );
  const isPlaceholder = errors.length > 0 && shouldShowPlaceholder(chart, errors);

  // Animate value-change recomputes (NOT initial mount). Per Decision Log
  // entry 6, animations stay on transform/opacity (SVG attribute animation
  // — `d`, `x`, `y` — has spotty browser support). We animate every
  // first-level SVG mark group so the effect reads as "marks moving to
  // their new positions" instead of a flat container fade.
  const chartBodyRef = React.useRef<HTMLDivElement>(null);
  const firstPaintRef = React.useRef(true);
  React.useEffect(() => {
    if (firstPaintRef.current) {
      firstPaintRef.current = false;
      return;
    }
    if (!chart.style.animation) return;
    if (prefersReducedMotion()) return;
    const root = chartBodyRef.current;
    if (!root) return;
    const svg = root.querySelector('svg');
    if (svg) {
      // Animate the SVG itself with a subtle scaleY + opacity dip so axes
      // and marks all rebound together.
      animateNode(
        svg,
        [
          { transform: 'scaleY(0.94)', opacity: 0.45, transformOrigin: 'center bottom' },
          { transform: 'scaleY(1)', opacity: 1, transformOrigin: 'center bottom' },
        ],
      );
      // Stagger each top-level group so the marks read as "redrawing".
      const groups = svg.querySelectorAll<SVGGElement>(':scope > g');
      groups.forEach((g, i) => {
        animateNode(
          g,
          [
            { opacity: 0.2, transform: 'translateY(2px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 320, easing: `cubic-bezier(0.2, 0.7, 0.2, 1)` },
        );
        // Wave the start so successive groups don't all settle in lockstep.
        if (i > 0) g.style.animationDelay = `${i * 20}ms`;
      });
    } else {
      // No SVG yet (e.g. broken-binding placeholder) — fall back to the
      // container fade so the state change is still perceptible.
      animateNode(root, [{ opacity: 0.6 }, { opacity: 1 }]);
    }
    // Re-trigger animation when result data changes.
  }, [results, chart.style.animation]);

  const surface = cardSurface(theme, 'chart');
  const cardStyle: React.CSSProperties = {
    ...surface,
    padding: 14,
    position: 'relative',
  };
  if (chart.card_border === 'hairline') cardStyle.border = `1px solid ${theme.border}`;
  else if (chart.card_border === 'strong') cardStyle.border = `2px solid ${theme.borderStr}`;
  if (chart.card_background_tint === 'soft') cardStyle.background = theme.cardAlt;
  else if (chart.card_background_tint === 'strong') cardStyle.background = theme.accentSoft;

  const truncation = React.useMemo(
    () => chartHasTruncation(chart, cells, results),
    [chart, cells, results],
  );

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2',
        isDragging && 'ring-2 ring-cg-accent/40',
      )}
      style={cardStyle}
      data-chart-id={chart.id}
      aria-label={`${chart.chart_type} chart: ${chart.title || chart.name}`}
      tabIndex={0}
    >
      {isBuilder && dragHandleProps ? (
        <div className="pointer-events-none absolute left-1.5 top-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <DragHandle
            ariaLabel={`Reorder chart: ${chart.title || chart.name}`}
            {...dragHandleProps}
          />
        </div>
      ) : null}

      {isBuilder ? (
        <ChartEditAffordance chart={chart} theme={theme} />
      ) : null}

      <header className="flex items-baseline justify-between gap-2 pr-6">
        <div className="flex flex-col">
          {chart.title ? (
            <span className="text-[13px] font-semibold leading-tight" style={{ color: theme.text }}>
              {chart.title}
            </span>
          ) : null}
          {chart.subtitle ? (
            <span className="text-[11.5px] leading-snug" style={{ color: theme.muted }}>
              {chart.subtitle}
            </span>
          ) : null}
        </div>
        {isBuilder ? (
          <span className="rounded-full bg-purple-500/10 px-1.5 py-[1px] font-mono text-[9.5px] font-medium uppercase tracking-wide text-purple-700">
            Chart
          </span>
        ) : null}
      </header>

      <div ref={chartBodyRef} className="flex flex-col">
        {isPlaceholder ? (
          <ChartBrokenBindingPanel errors={errors} />
        ) : (
          <ChartRendererDispatch
            chart={chart}
            cells={cells}
            evaluation={results}
            theme={themeBundle}
          />
        )}
      </div>

      {!isPlaceholder && errors.length > 0 ? (
        <p
          role="alert"
          className="text-[11px] italic"
          style={{ color: theme.muted }}
        >
          {errors.length === 1
            ? errors[0].message
            : `${errors.length} bindings need attention — see Data tab.`}
        </p>
      ) : null}

      {truncation.truncated ? (
        <p className="text-[11px] italic" style={{ color: theme.muted }}>
          Showing first 500 of {truncation.from} — chart is meant for
          visualisation, use Tabular for full data.
        </p>
      ) : null}
    </div>
  );
}

interface ChartEditAffordanceProps {
  chart: ChartRow;
  theme: Theme;
}

// Builder-only sub-tree. Encapsulates every hook + state that depends on
// the EditorProvider (`useEditor`, configurator open/close, fresh-chart
// auto-expand, the cross-card `cg:open-chart-configurator` listener).
// The visitor surface never mounts this — `<ChartCard>` only renders it
// behind `{isBuilder ? <ChartEditAffordance .../> : null}`.
function ChartEditAffordance({ chart, theme }: ChartEditAffordanceProps) {
  const { cells, results } = useCalculatorState();
  const { patchChart, removeChart } = useEditor();

  // Auto-expand the configurator on fresh (never-edited) charts. PROJ-15
  // QA BUG-L5 — guard on default-bindings rather than timestamp equality
  // so saved-then-reloaded charts don't re-open their configurator on
  // every page load.
  const isFresh = React.useMemo(
    () =>
      chart.title === '' &&
      chart.subtitle === '' &&
      isDefaultBindings(chart.chart_type, chart.bindings),
    [chart.chart_type, chart.bindings, chart.title, chart.subtitle],
  );
  const [configOpen, setConfigOpen] = React.useState(isFresh);

  // PROJ-15 — Grid-column kebab dispatches `cg:open-chart-configurator`
  // with the chart id so this card can OPEN (not toggle) its configurator
  // — QA BUG-L2. Toggling via the hover edit-icon was fragile because the
  // Grid kebab can't tell whether the card is already expanded.
  React.useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== chart.id) return;
      setConfigOpen(true);
    }
    window.addEventListener('cg:open-chart-configurator', onOpen);
    return () => window.removeEventListener('cg:open-chart-configurator', onOpen);
  }, [chart.id]);

  return (
    <>
      <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={configOpen ? 'Close chart settings' : 'Edit chart'}
                onClick={() => setConfigOpen((v) => !v)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cg-surface/90 text-cg-text-muted shadow-sm ring-1 ring-cg-border hover:text-cg-text"
              >
                <PencilIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Configure chart</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {configOpen ? (
        <ChartConfigurator
          chart={chart}
          cells={cells}
          evaluation={results}
          palette={theme.chartPalette}
          defaultTab={isFresh ? 'type' : 'data'}
          onPatch={(body) => patchChart(chart.id, body)}
          onRemove={() => {
            setConfigOpen(false);
            void removeChart(chart.id);
          }}
          onCollapse={() => setConfigOpen(false)}
        />
      ) : null}
    </>
  );
}

function shouldShowPlaceholder(
  chart: ChartRow,
  errors: { reason: string }[],
): boolean {
  // For single-binding chart types or no-bindings, any error → placeholder.
  // For multi-series, the renderer prefers to render the working series and
  // leave the broken slot to its Data-tab inline error; we approximate by
  // showing placeholder only when ALL series-slots are broken (no_bindings,
  // or every series_* slot reported broken).
  if (errors.some((e) => e.reason === 'no_bindings')) return true;
  switch (chart.chart_type) {
    case 'line':
    case 'bar':
    case 'area':
    case 'stacked_bar':
      // If x_axis is broken, no series can render meaningfully.
      return errors.some((e) =>
        /^X-axis:/.test((e as { message?: string }).message ?? ''),
      );
    default:
      // Singletons / pie / donut: any structural error → placeholder.
      return true;
  }
}

function isDefaultBindings(t: ChartType, b: ChartBindings): boolean {
  // Structural equality with the factory-default empty bindings shape
  // for the chart's type. Compares via JSON round-trip — bindings are
  // plain JSON values (no functions, no symbols) so this is safe.
  try {
    return JSON.stringify(b) === JSON.stringify(defaultBindings(t));
  } catch {
    return false;
  }
}

function PencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
