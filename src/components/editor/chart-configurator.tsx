'use client';

// PROJ-15 — Chart configurator.
//
// Three-tab settings panel hosted INSIDE the chart card (Builder only).
// Type / Data / Style tabs map to spec sections 3 §Configurator. Patches
// flow through `useEditor().patchChart()` which serialises against
// PROJ-8's calculator-level optimistic-concurrency token.

import * as React from 'react';

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DragHandle,
  SortableItem,
  useEditorDndSensors,
} from './dnd-helpers';
import {
  carryForwardBindings,
  defaultBindings,
  type ChartBindings,
  type LineBindingsT,
  type PieBindingsT,
  type DonutBindingsT,
  type ComparisonBarBindingsT,
  type SeriesRowT,
  type SparklineBindingsT,
  type WaterfallBindingsT,
  type BulletBindingsT,
  type HeatmapBindingsT,
  type RadialProgressBindingsT,
} from '@/lib/charts/bindings';
import { CHART_MAX_SERIES } from '@/lib/charts/limits';
import {
  AXISLESS_TYPES,
  CHART_TYPES,
  CHART_TYPE_LABELS,
  type AxisLabelsMode,
  type ChartCardBackgroundTint,
  type ChartCardBorder,
  type ChartCardSizeHint,
  type ChartRow,
  type ChartType,
  type LegendMode,
} from '@/lib/charts/types';
import { ALLOWED_COLOR_TOKENS, resolveChartToken, type ChartPalette } from '@/lib/themes';
import type { CellRow } from '@/lib/cells/types';
import type { EvaluationResult } from '@/lib/formula';
import { cn } from '@/lib/utils';

interface ChartConfiguratorProps {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  palette: ChartPalette;
  defaultTab?: 'type' | 'data' | 'style';
  onPatch: (body: Partial<ChartRow>) => void | Promise<unknown>;
  onRemove: () => void;
  onCollapse: () => void;
}

export function ChartConfigurator({
  chart,
  cells,
  evaluation,
  palette,
  defaultTab = 'type',
  onPatch,
  onRemove,
  onCollapse,
}: ChartConfiguratorProps) {
  const [tab, setTab] = React.useState<'type' | 'data' | 'style'>(defaultTab);

  return (
    <div className="mt-3 rounded-md border border-cg-border bg-cg-surface p-3 text-cg-text">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-cg-text-muted">
          Chart settings
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRemove}
            className="rounded px-2 py-1 text-[11.5px] font-medium text-red-600 hover:bg-red-50"
          >
            Delete chart
          </button>
          <button
            type="button"
            aria-label="Collapse chart settings"
            onClick={onCollapse}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
          >
            ▾
          </button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'type' | 'data' | 'style')}>
        <TabsList className="mb-3 grid w-full grid-cols-3">
          <TabsTrigger value="type">Type</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>
        <TabsContent value="type">
          <ChartTypeTab chart={chart} onPatch={onPatch} />
        </TabsContent>
        <TabsContent value="data">
          <ChartDataTab
            chart={chart}
            cells={cells}
            evaluation={evaluation}
            palette={palette}
            onPatch={onPatch}
          />
        </TabsContent>
        <TabsContent value="style">
          <ChartStyleTab chart={chart} palette={palette} onPatch={onPatch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Type tab ────────────────────────────────────────────────────────────────

function ChartTypeTab({
  chart,
  onPatch,
}: {
  chart: ChartRow;
  onPatch: (body: Partial<ChartRow>) => void | Promise<unknown>;
}) {
  const [pendingSwitch, setPendingSwitch] = React.useState<{
    toType: ChartType;
    dropped: string[];
    next: ChartBindings;
  } | null>(null);

  const onTileClick = (next: ChartType) => {
    if (next === chart.chart_type) {
      setPendingSwitch(null);
      return;
    }
    const result = carryForwardBindings(chart.chart_type, next, chart.bindings);
    if (result.kind === 'destructive') {
      setPendingSwitch({ toType: next, dropped: result.dropped, next: result.next });
      return;
    }
    void onPatch({ chart_type: next, bindings: result.next });
    setPendingSwitch(null);
  };

  return (
    <div>
      {pendingSwitch ? (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50/60 p-3 text-[12px] text-amber-900">
          <p className="font-medium">
            Switching to {CHART_TYPE_LABELS[pendingSwitch.toType]} drops some bindings.
          </p>
          <ul className="ml-3 list-disc">
            {pendingSwitch.dropped.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void onPatch({
                  chart_type: pendingSwitch.toType,
                  bindings: pendingSwitch.next,
                });
                setPendingSwitch(null);
              }}
              className="rounded-md bg-amber-700 px-2 py-1 text-[11.5px] font-medium text-white hover:bg-amber-800"
            >
              Confirm switch
            </button>
            <button
              type="button"
              onClick={() => setPendingSwitch(null)}
              className="text-[11.5px] text-amber-900 underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-4 gap-2">
        {CHART_TYPES.map((t) => {
          const isActive = t === chart.chart_type;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onTileClick(t)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border p-2 text-[11.5px] font-medium transition-colors',
                isActive
                  ? 'border-cg-accent bg-cg-accent/10 text-cg-accent'
                  : 'border-cg-border bg-cg-surface text-cg-text-muted hover:bg-cg-surface-2',
              )}
            >
              <ChartTypeGlyph type={t} />
              <span>{CHART_TYPE_LABELS[t]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartTypeGlyph({ type }: { type: ChartType }) {
  // Tiny inline silhouette per chart type. Kept simple — design polish lives
  // in QA. All glyphs occupy a 28×16 viewBox.
  const stroke = 'currentColor';
  const fill = 'currentColor';
  switch (type) {
    case 'line':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
          <path
            d="M2 12 L8 6 L14 9 L20 4 L26 7"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'bar':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16">
          {[3, 9, 15, 21].map((x, i) => (
            <rect key={i} x={x} y={16 - (i % 2 === 0 ? 10 : 6)} width="4" height={i % 2 === 0 ? 10 : 6} fill={fill} />
          ))}
        </svg>
      );
    case 'area':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16">
          <path d="M2 12 L8 6 L14 9 L20 4 L26 7 L26 16 L2 16 Z" fill={fill} fillOpacity={0.5} />
        </svg>
      );
    case 'pie':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16">
          <circle cx="14" cy="8" r="7" fill={fill} fillOpacity={0.4} />
          <path d="M14 1 A7 7 0 0 1 21 8 L14 8 Z" fill={fill} />
        </svg>
      );
    case 'donut':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
          <circle cx="14" cy="8" r="6" stroke={stroke} strokeWidth="2.5" strokeDasharray="20 30" />
        </svg>
      );
    case 'stacked_bar':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16">
          {[4, 12, 20].map((x, i) => (
            <g key={i}>
              <rect x={x} y={3} width="4" height="3" fill={fill} fillOpacity={0.5} />
              <rect x={x} y={6} width="4" height="4" fill={fill} fillOpacity={0.7} />
              <rect x={x} y={10} width="4" height={6} fill={fill} />
            </g>
          ))}
        </svg>
      );
    case 'comparison_bar':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16">
          <rect x="4" y="6" width="3" height="10" fill={fill} />
          <rect x="8" y="9" width="3" height="7" fill={fill} fillOpacity={0.5} />
          <rect x="16" y="3" width="3" height="13" fill={fill} />
          <rect x="20" y="7" width="3" height="9" fill={fill} fillOpacity={0.5} />
        </svg>
      );
    case 'sparkline':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
          <path d="M2 10 L6 6 L10 9 L14 5 L18 7 L22 4 L26 8" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case 'waterfall':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16">
          <rect x="2" y="10" width="4" height="6" fill={fill} />
          <rect x="8" y="6" width="4" height="4" fill={fill} />
          <rect x="14" y="9" width="4" height="3" fill={fill} fillOpacity={0.5} />
          <rect x="20" y="4" width="4" height="5" fill={fill} />
        </svg>
      );
    case 'bullet':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16">
          <rect x="2" y="6" width="24" height="4" fill={fill} fillOpacity={0.25} />
          <rect x="2" y="6" width="14" height="4" fill={fill} />
          <line x1="20" y1="4" x2="20" y2="12" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'heatmap':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16">
          {[0, 1, 2].map((y) =>
            [0, 1, 2, 3].map((x) => (
              <rect
                key={`${x}-${y}`}
                x={2 + x * 6}
                y={1 + y * 5}
                width="5"
                height="4"
                fill={fill}
                fillOpacity={0.15 + ((x + y) % 4) * 0.2}
              />
            )),
          )}
        </svg>
      );
    case 'radial_progress':
      return (
        <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
          <circle cx="14" cy="8" r="6" stroke={stroke} strokeWidth="1.5" strokeOpacity={0.3} />
          <circle
            cx="14"
            cy="8"
            r="6"
            stroke={stroke}
            strokeWidth="2"
            strokeDasharray="20 40"
            transform="rotate(-90 14 8)"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

// ─── Data tab ────────────────────────────────────────────────────────────────

interface DataTabProps {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  palette: ChartPalette;
  onPatch: (body: Partial<ChartRow>) => void | Promise<unknown>;
}

function ChartDataTab({ chart, cells, evaluation, palette, onPatch }: DataTabProps) {
  const updateBindings = (next: ChartBindings) => onPatch({ bindings: next });
  switch (chart.chart_type) {
    case 'line':
    case 'bar':
    case 'area':
    case 'stacked_bar':
      return (
        <XAxisNSeriesDataTab
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          palette={palette}
          onChangeBindings={updateBindings}
        />
      );
    case 'pie':
    case 'donut':
      return (
        <PieDonutDataTab
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          onChangeBindings={updateBindings}
        />
      );
    case 'comparison_bar':
      return (
        <ComparisonBarDataTab
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          onChangeBindings={updateBindings}
        />
      );
    case 'sparkline':
      return (
        <SingleArrayDataTab
          label="Values"
          placeholder="Choose which value to plot"
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          slotKey="values"
          shape="array"
          onChangeBindings={updateBindings}
        />
      );
    case 'waterfall':
      return (
        <TwoArrayDataTab
          labels={['Steps', 'Change at each step']}
          slotKeys={['steps', 'changes']}
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          onChangeBindings={updateBindings}
        />
      );
    case 'bullet':
      return (
        <BulletDataTab
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          onChangeBindings={updateBindings}
        />
      );
    case 'heatmap':
      return (
        <HeatmapDataTab
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          onChangeBindings={updateBindings}
        />
      );
    case 'radial_progress':
      return (
        <RadialProgressDataTab
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          onChangeBindings={updateBindings}
        />
      );
  }
}

interface PickerProps {
  cells: CellRow[];
  evaluation: EvaluationResult;
  shape: 'array' | 'scalar';
  value: string | null;
  placeholder: string;
  onChange: (cell_id: string | null) => void;
}

function CellPicker({ cells, evaluation, shape, value, placeholder, onChange }: PickerProps) {
  const candidates = cells.filter((c) => {
    const res = evaluation[c.name];
    if (!res || res.error) return false;
    if (shape === 'array') return res.shape === 'array_of_scalars';
    return res.shape === 'scalar';
  });
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-md border border-cg-border bg-cg-surface px-2 py-1.5 text-[12px] text-cg-text outline-none focus:border-cg-accent"
    >
      <option value="">{candidates.length === 0 ? 'No values available' : placeholder}</option>
      {candidates.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label || c.name} ({c.name})
        </option>
      ))}
    </select>
  );
}

function emptyHintForArray(cells: CellRow[], evaluation: EvaluationResult): string | null {
  const hasArrayCandidate = cells.some(
    (c) => evaluation[c.name]?.shape === 'array_of_scalars',
  );
  return hasArrayCandidate
    ? null
    : 'No values to plot yet — add an Output cell whose formula returns multiple values.';
}

function ColorSwatch({
  palette,
  tokenId,
  index,
  onChange,
}: {
  palette: ChartPalette;
  tokenId: string | null | undefined;
  index: number;
  onChange: (tokenId: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const current =
    tokenId && resolveChartToken(palette, tokenId)
      ? resolveChartToken(palette, tokenId)!
      : palette.series[index % palette.series.length];
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Series colour"
        onClick={() => setOpen((v) => !v)}
        className="h-5 w-5 rounded-sm ring-1 ring-cg-border"
        style={{ backgroundColor: current }}
      />
      {open ? (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-cg-border bg-cg-surface p-2 shadow-lg">
          <ul className="grid grid-cols-1 gap-1">
            {ALLOWED_COLOR_TOKENS.map((tok) => {
              const hex = resolveChartToken(palette, tok);
              if (!hex) return null;
              return (
                <li key={tok}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(tok);
                      setOpen(false);
                    }}
                    title={COLOR_TOKEN_LABELS[tok] ?? tok}
                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11.5px] text-cg-text hover:bg-cg-surface-2"
                  >
                    <span
                      aria-hidden
                      className="h-4 w-4 rounded-sm ring-1 ring-cg-border"
                      style={{ backgroundColor: hex }}
                    />
                    {COLOR_TOKEN_LABELS[tok] ?? tok}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="mt-1 w-full rounded px-1 py-0.5 text-left text-[11px] text-cg-text-muted hover:bg-cg-surface-2"
          >
            Reset to auto
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── X-axis + N-series Data tab (Line/Bar/Area/Stacked Bar) ──────────────────

function XAxisNSeriesDataTab({
  chart,
  cells,
  evaluation,
  palette,
  onChangeBindings,
}: {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  palette: ChartPalette;
  onChangeBindings: (b: ChartBindings) => void;
}) {
  const seriesKey =
    chart.chart_type === 'line'
      ? 'lines'
      : chart.chart_type === 'bar'
        ? 'bars'
        : chart.chart_type === 'area'
          ? 'areas'
          : 'stack_layers';
  const addLabel =
    chart.chart_type === 'line'
      ? '+ Add a line'
      : chart.chart_type === 'bar'
        ? '+ Add a bar'
        : chart.chart_type === 'area'
          ? '+ Add an area'
          : '+ Add a layer';
  const seriesLabelNoun =
    chart.chart_type === 'line'
      ? 'Lines'
      : chart.chart_type === 'bar'
        ? 'Bars'
        : chart.chart_type === 'area'
          ? 'Areas'
          : 'Stack layers';
  const bindings = chart.bindings as LineBindingsT;
  const series = React.useMemo(
    () =>
      ((chart.bindings as unknown) as Record<string, SeriesRowT[]>)[
        seriesKey
      ] ?? [],
    [chart.bindings, seriesKey],
  );

  const updateSeries = (next: SeriesRowT[]) =>
    onChangeBindings({ ...(bindings as object), [seriesKey]: next } as unknown as ChartBindings);

  const hint = emptyHintForArray(cells, evaluation);
  const atMax = series.length >= CHART_MAX_SERIES;
  const sensors = useEditorDndSensors();
  const orderedIds = React.useMemo(() => series.map((s) => s.id), [series]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = series.findIndex((s) => s.id === active.id);
    const to = series.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    const next = [...series];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateSeries(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-[11.5px] font-medium text-cg-text-muted">
        X-axis
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={bindings.x_axis}
          placeholder="Choose which value to plot"
          onChange={(id) =>
            onChangeBindings({ ...(bindings as object), x_axis: id } as unknown as ChartBindings)
          }
        />
      </label>

      <div>
        <p className="mb-1 text-[11.5px] font-medium text-cg-text-muted">{seriesLabelNoun}</p>
        {series.length === 0 ? (
          <p className="text-[11.5px] text-cg-text-subtle">Choose a value with multiple entries</p>
        ) : null}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {series.map((s, i) => (
                <SortableItem key={s.id} id={s.id}>
                  {({ setNodeRef, style, dragHandleProps, isDragging }) => (
                    <li
                      ref={setNodeRef}
                      style={style}
                      className={cn(
                        'flex items-center gap-2',
                        isDragging && 'ring-1 ring-cg-accent/40',
                      )}
                    >
                      <DragHandle
                        ariaLabel={`Reorder ${s.label || `series ${i + 1}`}`}
                        {...dragHandleProps}
                      />
                      <ColorSwatch
                        palette={palette}
                        tokenId={s.color_token_id}
                        index={i}
                        onChange={(tok) => {
                          const next = series.map((x, j) =>
                            j === i ? { ...x, color_token_id: tok } : x,
                          );
                          updateSeries(next);
                        }}
                      />
                      <input
                        type="text"
                        aria-label="Series label"
                        value={s.label}
                        placeholder={`${seriesLabelNoun.slice(0, -1)} ${i + 1}`}
                        onChange={(e) => {
                          const next = series.map((x, j) =>
                            j === i ? { ...x, label: e.target.value } : x,
                          );
                          updateSeries(next);
                        }}
                        className="w-32 rounded-md border border-cg-border bg-cg-surface px-2 py-1 text-[12px]"
                      />
                      <CellPicker
                        cells={cells}
                        evaluation={evaluation}
                        shape="array"
                        value={s.cell_id}
                        placeholder="Pick a series"
                        onChange={(id) => {
                          const next = series.map((x, j) =>
                            j === i ? { ...x, cell_id: id } : x,
                          );
                          updateSeries(next);
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${s.label || `series ${i + 1}`}`}
                        onClick={() => updateSeries(series.filter((_, j) => j !== i))}
                        className="text-[12px] text-cg-text-muted hover:text-red-600"
                      >
                        ×
                      </button>
                    </li>
                  )}
                </SortableItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <button
          type="button"
          disabled={atMax}
          aria-disabled={atMax || undefined}
          title={atMax ? 'Maximum 8 series per chart.' : undefined}
          onClick={() => {
            if (atMax) return;
            const id = `s_${Math.random().toString(36).slice(2, 8)}`;
            updateSeries([
              ...series,
              {
                id,
                label: `${seriesLabelNoun.slice(0, -1)} ${series.length + 1}`,
                cell_id: null,
                color_token_id: null,
              },
            ]);
          }}
          className={cn(
            'mt-2 text-[12px] font-medium',
            atMax ? 'text-cg-text-subtle' : 'text-cg-accent hover:underline',
          )}
        >
          {addLabel}
        </button>
        {hint ? <p className="mt-2 text-[11px] italic text-cg-text-subtle">{hint}</p> : null}
      </div>
    </div>
  );
}

// ─── Pie / Donut Data tab ────────────────────────────────────────────────────

function PieDonutDataTab({
  chart,
  cells,
  evaluation,
  onChangeBindings,
}: {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  onChangeBindings: (b: ChartBindings) => void;
}) {
  const isDonut = chart.chart_type === 'donut';
  const b = chart.bindings as PieBindingsT | DonutBindingsT;
  return (
    <div className="flex flex-col gap-3">
      <FieldRow label="Slice labels">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={b.slice_labels}
          placeholder="Choose label values"
          onChange={(id) => onChangeBindings({ ...(b as object), slice_labels: id } as ChartBindings)}
        />
      </FieldRow>
      <FieldRow label="Slice sizes">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={b.slice_sizes}
          placeholder="Choose size values"
          onChange={(id) => onChangeBindings({ ...(b as object), slice_sizes: id } as ChartBindings)}
        />
      </FieldRow>
      {isDonut ? (
        <>
          <FieldRow label="Centre label">
            <input
              type="text"
              defaultValue={(b as DonutBindingsT).centre_label}
              onBlur={(e) =>
                onChangeBindings({
                  ...(b as object),
                  centre_label: e.target.value,
                } as ChartBindings)
              }
              className="w-full rounded-md border border-cg-border bg-cg-surface px-2 py-1.5 text-[12px]"
            />
          </FieldRow>
          <FieldRow label="Centre value">
            <CellPicker
              cells={cells}
              evaluation={evaluation}
              shape="scalar"
              value={(b as DonutBindingsT).centre_value}
              placeholder="Pick a scalar value"
              onChange={(id) =>
                onChangeBindings({
                  ...(b as object),
                  centre_value: id,
                } as ChartBindings)
              }
            />
          </FieldRow>
        </>
      ) : null}
    </div>
  );
}

// ─── Comparison Bar Data tab ─────────────────────────────────────────────────

function ComparisonBarDataTab({
  chart,
  cells,
  evaluation,
  onChangeBindings,
}: {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  onChangeBindings: (b: ChartBindings) => void;
}) {
  const b = chart.bindings as ComparisonBarBindingsT;
  return (
    <div className="flex flex-col gap-3">
      <FieldRow label="X-axis">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={b.x_axis}
          placeholder="Choose category labels"
          onChange={(id) => onChangeBindings({ ...b, x_axis: id })}
        />
      </FieldRow>
      <FieldRow label="Series A">
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label="Series A label"
            placeholder="Series A"
            value={b.series_a.label}
            onChange={(e) =>
              onChangeBindings({
                ...b,
                series_a: { ...b.series_a, label: e.target.value },
              })
            }
            className="w-24 rounded-md border border-cg-border bg-cg-surface px-2 py-1 text-[12px]"
          />
          <CellPicker
            cells={cells}
            evaluation={evaluation}
            shape="array"
            value={b.series_a.cell_id}
            placeholder="Pick a series"
            onChange={(id) =>
              onChangeBindings({
                ...b,
                series_a: { ...b.series_a, cell_id: id },
              })
            }
          />
        </div>
      </FieldRow>
      <FieldRow label="Series B">
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label="Series B label"
            placeholder="Series B"
            value={b.series_b.label}
            onChange={(e) =>
              onChangeBindings({
                ...b,
                series_b: { ...b.series_b, label: e.target.value },
              })
            }
            className="w-24 rounded-md border border-cg-border bg-cg-surface px-2 py-1 text-[12px]"
          />
          <CellPicker
            cells={cells}
            evaluation={evaluation}
            shape="array"
            value={b.series_b.cell_id}
            placeholder="Pick a series"
            onChange={(id) =>
              onChangeBindings({
                ...b,
                series_b: { ...b.series_b, cell_id: id },
              })
            }
          />
        </div>
      </FieldRow>
      <FieldRow label="Labels (optional)">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={b.labels}
          placeholder="Optional per-pair caption"
          onChange={(id) => onChangeBindings({ ...b, labels: id })}
        />
      </FieldRow>
    </div>
  );
}

// ─── Single-array / two-array / scalar Data tabs ─────────────────────────────

function SingleArrayDataTab({
  label,
  placeholder,
  chart,
  cells,
  evaluation,
  slotKey,
  shape,
  onChangeBindings,
}: {
  label: string;
  placeholder: string;
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  slotKey: string;
  shape: 'array' | 'scalar';
  onChangeBindings: (b: ChartBindings) => void;
}) {
  const value = (chart.bindings as unknown as Record<string, string | null>)[slotKey] ?? null;
  return (
    <FieldRow label={label}>
      <CellPicker
        cells={cells}
        evaluation={evaluation}
        shape={shape}
        value={value}
        placeholder={placeholder}
        onChange={(id) =>
          onChangeBindings({
            ...(chart.bindings as object),
            [slotKey]: id,
          } as unknown as ChartBindings)
        }
      />
    </FieldRow>
  );
}

function TwoArrayDataTab({
  labels,
  slotKeys,
  chart,
  cells,
  evaluation,
  onChangeBindings,
}: {
  labels: [string, string];
  slotKeys: [string, string];
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  onChangeBindings: (b: ChartBindings) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {labels.map((label, idx) => (
        <SingleArrayDataTab
          key={idx}
          label={label}
          placeholder={`Choose ${label.toLowerCase()}`}
          chart={chart}
          cells={cells}
          evaluation={evaluation}
          slotKey={slotKeys[idx]}
          shape="array"
          onChangeBindings={onChangeBindings}
        />
      ))}
    </div>
  );
}

function BulletDataTab({
  chart,
  cells,
  evaluation,
  onChangeBindings,
}: {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  onChangeBindings: (b: ChartBindings) => void;
}) {
  const b = chart.bindings as BulletBindingsT;
  return (
    <div className="flex flex-col gap-3">
      <FieldRow label="Actual value">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="scalar"
          value={b.actual}
          placeholder="Pick a scalar value"
          onChange={(id) => onChangeBindings({ ...b, actual: id })}
        />
      </FieldRow>
      <FieldRow label="Target">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="scalar"
          value={b.target}
          placeholder="Pick a scalar value"
          onChange={(id) => onChangeBindings({ ...b, target: id })}
        />
      </FieldRow>
      <FieldRow label="Performance bands (optional)">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={b.performance_bands}
          placeholder="Pick 2-3 thresholds"
          onChange={(id) => onChangeBindings({ ...b, performance_bands: id })}
        />
      </FieldRow>
    </div>
  );
}

function HeatmapDataTab({
  chart,
  cells,
  evaluation,
  onChangeBindings,
}: {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  onChangeBindings: (b: ChartBindings) => void;
}) {
  const b = chart.bindings as HeatmapBindingsT;
  return (
    <div className="flex flex-col gap-3">
      <FieldRow label="Columns">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={b.columns}
          placeholder="Pick column labels"
          onChange={(id) => onChangeBindings({ ...b, columns: id })}
        />
      </FieldRow>
      <FieldRow label="Rows">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={b.rows}
          placeholder="Pick row labels"
          onChange={(id) => onChangeBindings({ ...b, rows: id })}
        />
      </FieldRow>
      <FieldRow label="Cell colours">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="array"
          value={b.cell_colours}
          placeholder="Pick a value with rows × columns entries"
          onChange={(id) => onChangeBindings({ ...b, cell_colours: id })}
        />
      </FieldRow>
    </div>
  );
}

function RadialProgressDataTab({
  chart,
  cells,
  evaluation,
  onChangeBindings,
}: {
  chart: ChartRow;
  cells: CellRow[];
  evaluation: EvaluationResult;
  onChangeBindings: (b: ChartBindings) => void;
}) {
  const b = chart.bindings as RadialProgressBindingsT;
  return (
    <div className="flex flex-col gap-3">
      <FieldRow label="Current value">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="scalar"
          value={b.current}
          placeholder="Pick a scalar value"
          onChange={(id) => onChangeBindings({ ...b, current: id })}
        />
      </FieldRow>
      <FieldRow label="Goal">
        <CellPicker
          cells={cells}
          evaluation={evaluation}
          shape="scalar"
          value={b.goal}
          placeholder="Pick a scalar value"
          onChange={(id) => onChangeBindings({ ...b, goal: id })}
        />
      </FieldRow>
      <FieldRow label="Centre label">
        <input
          type="text"
          defaultValue={b.centre_label}
          onBlur={(e) => onChangeBindings({ ...b, centre_label: e.target.value })}
          className="w-full rounded-md border border-cg-border bg-cg-surface px-2 py-1.5 text-[12px]"
        />
      </FieldRow>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11.5px] font-medium text-cg-text-muted">
      {label}
      {children}
    </label>
  );
}

// ─── Style tab ───────────────────────────────────────────────────────────────

const LEGEND_OPTIONS: LegendMode[] = ['auto', 'always', 'hide'];
const AXIS_OPTIONS: AxisLabelsMode[] = ['auto', 'always', 'hide'];
const TINT_OPTIONS: ChartCardBackgroundTint[] = ['none', 'soft', 'strong'];
const BORDER_OPTIONS: ChartCardBorder[] = ['none', 'hairline', 'strong'];
const SIZE_OPTIONS: ChartCardSizeHint[] = ['narrow', 'wide', 'full'];

function ChartStyleTab({
  chart,
  palette,
  onPatch,
}: {
  chart: ChartRow;
  palette: ChartPalette;
  onPatch: (body: Partial<ChartRow>) => void | Promise<unknown>;
}) {
  const axisless = AXISLESS_TYPES.has(chart.chart_type);
  const smoothable = chart.chart_type === 'line' || chart.chart_type === 'area';
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="col-span-2 flex flex-col gap-1 text-[11.5px] font-medium text-cg-text-muted">
        Title
        <input
          type="text"
          defaultValue={chart.title}
          maxLength={200}
          onBlur={(e) => onPatch({ title: e.target.value })}
          className="rounded-md border border-cg-border bg-cg-surface px-2 py-1.5 text-[12px]"
        />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-[11.5px] font-medium text-cg-text-muted">
        Subtitle
        <input
          type="text"
          defaultValue={chart.subtitle}
          maxLength={200}
          onBlur={(e) => onPatch({ subtitle: e.target.value })}
          className="rounded-md border border-cg-border bg-cg-surface px-2 py-1.5 text-[12px]"
        />
      </label>

      <SegmentedField
        label="Legend"
        value={chart.style.legend}
        options={LEGEND_OPTIONS}
        onChange={(v) => onPatch({ style: { ...chart.style, legend: v as LegendMode } })}
      />
      <SegmentedField
        label="Axis labels"
        value={chart.style.axis_labels}
        options={AXIS_OPTIONS}
        disabled={axisless}
        onChange={(v) =>
          onPatch({ style: { ...chart.style, axis_labels: v as AxisLabelsMode } })
        }
      />

      <ToggleField
        label="Animation"
        checked={chart.style.animation}
        onChange={(v) => onPatch({ style: { ...chart.style, animation: v } })}
      />
      {smoothable ? (
        <ToggleField
          label="Smooth lines"
          checked={chart.style.smooth_lines}
          onChange={(v) => onPatch({ style: { ...chart.style, smooth_lines: v } })}
        />
      ) : (
        <div />
      )}

      <div className="col-span-2 my-1 border-t border-cg-border" />

      <AccentField
        palette={palette}
        value={chart.card_accent}
        onChange={(v) => onPatch({ card_accent: v })}
      />
      <SegmentedField
        label="Background tint"
        value={chart.card_background_tint}
        options={TINT_OPTIONS}
        onChange={(v) => onPatch({ card_background_tint: v as ChartCardBackgroundTint })}
      />
      <SegmentedField
        label="Border"
        value={chart.card_border}
        options={BORDER_OPTIONS}
        onChange={(v) => onPatch({ card_border: v as ChartCardBorder })}
      />
      <SegmentedField
        label="Size"
        value={chart.card_size_hint}
        options={SIZE_OPTIONS}
        onChange={(v) => onPatch({ card_size_hint: v as ChartCardSizeHint })}
      />
    </div>
  );
}

function SegmentedField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 text-[11.5px] font-medium text-cg-text-muted">
      {label}
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          'inline-flex rounded-md border border-cg-border bg-cg-surface p-0.5',
          disabled && 'opacity-50',
        )}
      >
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={value === opt}
            disabled={disabled}
            onClick={() => !disabled && onChange(opt)}
            className={cn(
              'flex-1 rounded-sm px-2 py-1 text-[11.5px] capitalize transition-colors',
              value === opt ? 'bg-cg-accent text-cg-accent-fg' : 'text-cg-text-muted hover:bg-cg-surface-2',
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// PROJ-15 — Display labels for the 11 theme-palette tokens used in
// the swatch popovers (Accent picker on Style tab + per-series colour
// picker on Data tab). AC mandates these visible labels.
const COLOR_TOKEN_LABELS: Record<string, string> = {
  'series.0': 'Series 1',
  'series.1': 'Series 2',
  'series.2': 'Series 3',
  'series.3': 'Series 4',
  'series.4': 'Series 5',
  'series.5': 'Series 6',
  'series.6': 'Series 7',
  'series.7': 'Series 8',
  pos: 'Positive',
  neg: 'Negative',
  neutral: 'Neutral',
};

function AccentField({
  palette,
  value,
  onChange,
}: {
  palette: ChartPalette;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const isTheme = !value || value === 'theme';
  const currentHex = isTheme
    ? palette.series[0]
    : resolveChartToken(palette, value) ?? palette.series[0];
  const currentLabel = isTheme
    ? 'Theme default'
    : COLOR_TOKEN_LABELS[value] ?? value;
  return (
    <div className="relative flex flex-col gap-1 text-[11.5px] font-medium text-cg-text-muted">
      Accent
      <button
        type="button"
        aria-label="Accent colour"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-cg-border bg-cg-surface px-2 py-1 text-[11.5px] text-cg-text hover:bg-cg-surface-2"
      >
        <span
          aria-hidden
          className="h-4 w-4 rounded-sm ring-1 ring-cg-border"
          style={{ backgroundColor: currentHex }}
        />
        <span className="truncate">{currentLabel}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-cg-border bg-cg-surface p-2 shadow-lg">
          <ul className="grid grid-cols-1 gap-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange('theme');
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11.5px] text-cg-text hover:bg-cg-surface-2"
              >
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-sm ring-1 ring-cg-border"
                  style={{ backgroundColor: palette.series[0] }}
                />
                Theme default
              </button>
            </li>
            {ALLOWED_COLOR_TOKENS.map((tok) => {
              const hex = resolveChartToken(palette, tok);
              if (!hex) return null;
              return (
                <li key={tok}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(tok);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11.5px] text-cg-text hover:bg-cg-surface-2"
                  >
                    <span
                      aria-hidden
                      className="h-4 w-4 rounded-sm ring-1 ring-cg-border"
                      style={{ backgroundColor: hex }}
                    />
                    {COLOR_TOKEN_LABELS[tok]}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between text-[11.5px] font-medium text-cg-text-muted">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
          checked ? 'bg-cg-accent' : 'bg-cg-border',
        )}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export { defaultBindings };
