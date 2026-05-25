'use client';

// PROJ-9 — Cell visual-presentation panel.
//
// Opens from the hover edit-icon on a cell card. Contains card-level
// and cell-specific visual settings. Output cells get the
// display_emphasis picker (Plain / KPI — Tabular is hidden in P0).
// PATCH fires immediately on every change (incremental save).

import * as React from 'react';

import { Input } from '@/components/ui/input';
import type {
  CellCardBackgroundTint,
  CellCardBorder,
  CellCardSizeHint,
  CellDisplayEmphasis,
  CellRow,
  CellWidget,
  TabularColumn,
} from '@/lib/cells/types';
import type { PatchCellBody } from '@/lib/cells/client';
import type { Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';

import { TabularColumnConfig } from './tabular-column-config';

interface CellVisualPanelProps {
  cell: CellRow;
  theme: Theme;
  onClose: () => void;
  onPatch: (body: Omit<PatchCellBody, 'updated_at'>) => void | Promise<unknown>;
  onRemove: () => void;
}

const TINT_OPTIONS: CellCardBackgroundTint[] = ['none', 'soft', 'strong'];
const BORDER_OPTIONS: CellCardBorder[] = ['none', 'hairline', 'strong'];
const SIZE_OPTIONS: CellCardSizeHint[] = ['narrow', 'wide', 'full'];
const TEXT_SIZE_OPTIONS: string[] = ['s', 'm', 'l', 'xl'];
const TEXT_COLOUR_OPTIONS: string[] = ['default', 'accent_1', 'accent_2'];

export function CellVisualPanel({ cell, theme, onClose, onPatch, onRemove }: CellVisualPanelProps) {
  const [label, setLabel] = React.useState(cell.label);
  React.useEffect(() => setLabel(cell.label), [cell.label]);

  return (
    <div className="mt-2 rounded-md border border-cg-border bg-cg-surface p-3 text-cg-text">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-cg-text-muted">
          Appearance
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRemove}
            className="rounded px-2 py-1 text-[11.5px] font-medium text-red-600 hover:bg-red-50"
          >
            Delete cell
          </button>
          <button
            type="button"
            aria-label="Close appearance panel"
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-cg-text-muted hover:bg-cg-surface-2"
          >
            ✕
          </button>
        </div>
      </header>

      {/* PROJ-23 Issue 3 — Label field at top of Visual Panel */}
      <div className="mb-3 flex flex-col gap-1">
        <label className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
          Label
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label !== cell.label) onPatch({ label });
          }}
          placeholder={cell.name}
          className="h-8 text-[12px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SegmentedField
          label="Background tint"
          value={cell.card_background_tint}
          options={TINT_OPTIONS}
          onChange={(v) => onPatch({ card_background_tint: v as CellCardBackgroundTint })}
        />
        <SegmentedField
          label="Border"
          value={cell.card_border}
          options={BORDER_OPTIONS}
          onChange={(v) => onPatch({ card_border: v as CellCardBorder })}
        />
        <SegmentedField
          label="Size"
          value={cell.card_size_hint}
          options={SIZE_OPTIONS}
          onChange={(v) => onPatch({ card_size_hint: v as CellCardSizeHint })}
        />
        <SegmentedField
          label="Text size"
          value={cell.text_size}
          options={TEXT_SIZE_OPTIONS}
          onChange={(v) => onPatch({ text_size: v })}
        />
        <SegmentedField
          label="Text colour"
          value={cell.text_colour}
          options={TEXT_COLOUR_OPTIONS}
          onChange={(v) => onPatch({ text_colour: v })}
        />
        <WidgetPicker
          cell={cell}
          onChange={(w) => onPatch({ display_widget: w })}
        />
      </div>

      {cell.kind === 'output' ? (
        <div className="mt-3">
          <SegmentedField
            label="Emphasis"
            value={cell.display_emphasis}
            options={['plain', 'kpi', 'tabular'] as CellDisplayEmphasis[]}
            onChange={(v) => onPatch({ display_emphasis: v as CellDisplayEmphasis })}
          />
          {cell.display_emphasis === 'tabular' ? (
            <TabularColumnConfig
              columns={cell.tabular_columns ?? []}
              fallbackCurrencyCode={cell.currency_code || 'USD'}
              hasShapeMatch={(cell.tabular_columns ?? []).length > 0}
              onChange={(next: TabularColumn[]) =>
                onPatch({ tabular_columns: next })
              }
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11.5px] text-cg-text-muted">Active theme: {theme.displayName}</span>
      </div>
    </div>
  );
}

interface SegmentedFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}

function SegmentedField<T extends string>({ label, value, options, onChange }: SegmentedFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
        {label}
      </label>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-cg-border bg-cg-surface-2 p-0.5">
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <button
              type="button"
              key={opt}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt)}
              className={cn(
                'flex-1 rounded px-2 py-1 text-[11.5px] capitalize transition-colors',
                selected
                  ? 'bg-cg-surface text-cg-text shadow-sm'
                  : 'text-cg-text-muted hover:text-cg-text',
              )}
            >
              {opt.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WidgetPicker({ cell, onChange }: { cell: CellRow; onChange: (w: CellWidget) => void }) {
  const widgets = widgetsFor(cell);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
        Widget
      </label>
      <div role="radiogroup" aria-label="Widget" className="inline-flex flex-wrap gap-1">
        {widgets.map(({ id, label, disabled, reason }) => {
          const selected = cell.display_widget === id || (!cell.display_widget && id === widgets[0].id);
          return (
            <button
              type="button"
              key={id}
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              title={disabled ? reason : undefined}
              onClick={() => !disabled && onChange(id)}
              className={cn(
                'rounded border px-2 py-1 text-[11.5px] capitalize transition-colors',
                selected
                  ? 'border-cg-accent bg-cg-accent/10 text-cg-text'
                  : 'border-cg-border text-cg-text-muted hover:bg-cg-surface-2',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function widgetsFor(cell: CellRow): { id: CellWidget; label: string; disabled?: boolean; reason?: string }[] {
  switch (cell.value_type) {
    case 'number':
    case 'currency':
    case 'percent':
      return [
        { id: 'number_field', label: 'Number field' },
        {
          id: 'slider',
          label: 'Slider',
          disabled: cell.numeric_min == null || cell.numeric_max == null,
          reason: 'Set min and max in the Grid to use a slider.',
        },
        {
          id: 'stepper',
          label: 'Stepper',
          disabled: cell.numeric_step == null,
          reason: 'Set a step in the Grid to use a stepper.',
        },
      ];
    case 'date':
      return [{ id: 'date_picker', label: 'Date picker' }];
    case 'boolean':
      return [
        { id: 'toggle_switch', label: 'Toggle' },
        { id: 'radio_pair', label: 'Radio pair' },
      ];
    case 'select':
      return [
        { id: 'dropdown', label: 'Dropdown' },
        { id: 'radio_buttons', label: 'Radio buttons' },
      ];
    case 'text':
      return [{ id: 'text_field', label: 'Text field' }];
  }
}
