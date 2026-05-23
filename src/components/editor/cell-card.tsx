'use client';

// PROJ-9 / PROJ-11 — Cell card (shared by Builder and Visitor).
//
// Renders one visible cell: label, description, input widget (for
// Inputs) or computed value (for Outputs), error states, card-level
// visuals. The hover-pencil edit affordance + visual panel + drag
// handle render ONLY in builder mode — gated by `useInteractivity()`.

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
import type { CellRow } from '@/lib/cells/types';
import { useEditor } from '@/lib/editor/EditorProvider';
import { cardSurface, labelTextStyle, numberStyle, type Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { isEmpty } from '@/lib/formula';

import { CellInputWidget } from './cell-input-widget';
import { CellVisualPanel } from './cell-visual-panel';
import { DragHandle } from './dnd-helpers';

interface CellCardProps {
  cell: CellRow;
  theme: Theme;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
}

export function CellCard({ cell, theme, dragHandleProps, isDragging }: CellCardProps) {
  const { getResult, inputs, setInput } = useCalculatorState();
  const isBuilder = useIsBuilder();

  const result = getResult(cell.name);
  const tintKind = cell.kind === 'output' ? 'results' : 'inputs';
  const surface = cardSurface(theme, tintKind);

  const cardStyle: React.CSSProperties = {
    ...surface,
    padding: 14,
    position: 'relative',
  };

  if (cell.card_border === 'hairline') {
    cardStyle.border = `1px solid ${theme.border}`;
  } else if (cell.card_border === 'strong') {
    cardStyle.border = `2px solid ${theme.borderStr}`;
  }
  if (cell.card_background_tint === 'soft') {
    cardStyle.background = theme.cardAlt;
  } else if (cell.card_background_tint === 'strong') {
    cardStyle.background = theme.accentSoft;
  }

  const errorMsg = result?.error?.message ?? null;
  const isError = !!errorMsg;
  const isArrayResult =
    result &&
    !result.error &&
    (result.shape === 'array_of_scalars' || result.shape === 'array_of_objects');

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2',
        isError && 'ring-1 ring-red-500/60 ring-offset-1',
        isDragging && 'ring-2 ring-cg-accent/40',
      )}
      style={cardStyle}
      data-cell-id={cell.id}
    >
      {isBuilder && dragHandleProps ? (
        <div className="pointer-events-none absolute left-1.5 top-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <DragHandle
            ariaLabel={`Reorder cell: ${cell.label || cell.name}`}
            {...dragHandleProps}
          />
        </div>
      ) : null}
      {isBuilder ? <CellEditAffordance cell={cell} theme={theme} /> : null}

      <div className="flex items-baseline justify-between gap-2">
        <span style={labelTextStyle(theme, theme.muted)}>{cell.label || cell.name}</span>
        {isBuilder ? <CellKindPill kind={cell.kind} /> : null}
      </div>

      {cell.description && cell.description_render === 'caption' ? (
        <p className="text-[11.5px] leading-snug" style={{ color: theme.subtle }}>
          {cell.description}
        </p>
      ) : null}

      {cell.kind === 'input' ? (
        <CellInputWidget
          cell={cell}
          theme={theme}
          value={inputs[cell.name] ?? cell.default_value ?? undefined}
          onChange={(v) => setInput(cell.name, v)}
          readOnly={cell.editability === 'readonly'}
        />
      ) : (
        <OutputDisplay
          cell={cell}
          theme={theme}
          result={result}
          isArrayResult={Boolean(isArrayResult)}
          errorMsg={errorMsg}
        />
      )}

      {cell.kind === 'input' && cell.description && cell.description_render === 'tooltip' ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="self-start text-[11px] text-cg-text-muted underline decoration-dotted">
                ?
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{cell.description}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}

interface CellEditAffordanceProps {
  cell: CellRow;
  theme: Theme;
}

function CellEditAffordance({ cell, theme }: CellEditAffordanceProps) {
  const { patchCell, removeCell } = useEditor();
  const [panelOpen, setPanelOpen] = React.useState(false);
  return (
    <>
      <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          type="button"
          aria-label="Edit cell appearance"
          onClick={() => setPanelOpen((v) => !v)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cg-surface/90 text-cg-text-muted shadow-sm ring-1 ring-cg-border hover:text-cg-text"
        >
          <PencilIcon />
        </button>
      </div>
      {panelOpen ? (
        <CellVisualPanel
          cell={cell}
          theme={theme}
          onClose={() => setPanelOpen(false)}
          onPatch={(body) => patchCell(cell.id, body)}
          onRemove={() => {
            setPanelOpen(false);
            void removeCell(cell.id);
          }}
        />
      ) : null}
    </>
  );
}

function CellKindPill({ kind }: { kind: 'input' | 'output' }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-[1px] font-mono text-[9.5px] font-medium uppercase tracking-wide',
        kind === 'input'
          ? 'bg-blue-500/10 text-blue-700'
          : 'bg-emerald-500/10 text-emerald-700',
      )}
    >
      {kind}
    </span>
  );
}

interface OutputDisplayProps {
  cell: CellRow;
  theme: Theme;
  result: ReturnType<typeof Object> | undefined; // CellResult | undefined (avoid import cycle)
  isArrayResult: boolean;
  errorMsg: string | null;
}

function OutputDisplay({ cell, theme, result, isArrayResult, errorMsg }: OutputDisplayProps) {
  if (errorMsg) {
    return (
      <p className="text-[12.5px] font-medium text-red-600" role="alert">
        {errorMsg}
      </p>
    );
  }
  if (isArrayResult && cell.display_emphasis !== 'kpi') {
    return (
      <p
        className="text-[12px] italic"
        style={{ color: theme.muted }}
      >
        Array result — tabular display ships in v1.1.
      </p>
    );
  }
  // Best-effort scalar render
  const value = (result as { value?: unknown } | undefined)?.value;
  const formatted = formatValue(cell, value);
  const sizeMap = { s: 18, m: 28, l: 28, xl: 40 } as const;
  const size = (sizeMap[cell.text_size as keyof typeof sizeMap] ?? 28) as 18 | 28 | 40;
  return (
    <div style={numberStyle(theme, size)}>{formatted}</div>
  );
}

function formatValue(cell: CellRow, raw: unknown): string {
  if (raw === undefined || raw === null) return '—';
  if (isEmpty(raw)) return '—';
  const format = cell.display_format;
  const num = typeof raw === 'number' ? raw : Number(raw);

  try {
    if (cell.value_type === 'currency' || format === 'currency') {
      const code = cell.currency_code || 'USD';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 2,
      }).format(num);
    }
    if (cell.value_type === 'percent' || format === 'percent_0' || format === 'percent_2') {
      const fractionDigits = format === 'percent_0' ? 0 : 2;
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: fractionDigits,
      }).format(num);
    }
    if (cell.value_type === 'date' || format === 'date_short' || format === 'date_long') {
      const date = raw instanceof Date ? raw : new Date(String(raw));
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    }
    if (cell.value_type === 'boolean') {
      return raw ? 'Yes' : 'No';
    }
    if (cell.value_type === 'text') {
      return String(raw);
    }
    if (Number.isFinite(num)) {
      if (format === 'number_integer') {
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
      }
      if (format === 'number_decimal_2') {
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
      }
      if (format === 'number_decimal_4') {
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(num);
      }
      return new Intl.NumberFormat('en-US').format(num);
    }
    return String(raw);
  } catch {
    return String(raw);
  }
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
