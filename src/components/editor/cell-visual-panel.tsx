'use client';

// PROJ-9 / PROJ-24 — Cell visual-presentation panel.
//
// Contains card-level and cell-specific visual settings with compact
// icon-based toggles. Used inside the cell settings flyout (PROJ-24
// Item 8) and shared between cell, chart, and text-block cards.

import * as React from 'react';

import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-3 text-cg-text">
        <header className="flex items-center justify-between">
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

        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label !== cell.label) onPatch({ label });
          }}
          placeholder="Label (optional)"
          className="h-8 text-[12px]"
        />

        <div className="grid grid-cols-2 gap-3">
          <IconSegmentedField
            label="Text size"
            value={cell.text_size}
            options={TEXT_SIZE_OPTIONS}
            onChange={(v) => onPatch({ text_size: v })}
            renderOption={(opt) => (
              <span style={{ fontSize: textSizeGlyphPx(opt), fontWeight: 600, lineHeight: 1 }}>T</span>
            )}
            tooltips={['Small', 'Medium', 'Large', 'Extra large']}
          />
          <IconSegmentedField
            label="Border"
            value={cell.card_border}
            options={BORDER_OPTIONS}
            onChange={(v) => onPatch({ card_border: v as CellCardBorder })}
            renderOption={(opt) => <BorderIcon kind={opt as CellCardBorder} />}
            tooltips={['None', 'Hairline', 'Strong']}
          />
          <IconSegmentedField
            label="Text colour"
            value={cell.text_colour}
            options={TEXT_COLOUR_OPTIONS}
            onChange={(v) => onPatch({ text_colour: v })}
            renderOption={(opt) => (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-cg-border"
                style={{ backgroundColor: textColourSwatch(opt, theme) }}
              />
            )}
            tooltips={['Default', 'Accent 1', 'Accent 2']}
          />
          <IconSegmentedField
            label="Background tint"
            value={cell.card_background_tint}
            options={TINT_OPTIONS}
            onChange={(v) => onPatch({ card_background_tint: v as CellCardBackgroundTint })}
            renderOption={(opt) => <TintIcon kind={opt as CellCardBackgroundTint} theme={theme} />}
            tooltips={['None', 'Soft', 'Strong']}
          />
          <IconSegmentedField
            label="Size"
            value={cell.card_size_hint}
            options={SIZE_OPTIONS}
            onChange={(v) => onPatch({ card_size_hint: v as CellCardSizeHint })}
            renderOption={(opt) => <SizeIcon kind={opt as CellCardSizeHint} />}
            tooltips={['Narrow', 'Wide', 'Full']}
          />
          <WidgetPicker
            cell={cell}
            onChange={(w) => onPatch({ display_widget: w })}
          />
        </div>

        {cell.kind === 'output' ? (
          <div>
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

        <div className="flex items-center justify-between">
          <span className="text-[11.5px] text-cg-text-muted">Active theme: {theme.displayName}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

function textSizeGlyphPx(opt: string): number {
  switch (opt) {
    case 's': return 10;
    case 'm': return 13;
    case 'l': return 16;
    case 'xl': return 20;
    default: return 13;
  }
}

function textColourSwatch(opt: string, theme: Theme): string {
  switch (opt) {
    case 'accent_1': return theme.accent;
    case 'accent_2': return theme.accentSoft;
    default: return theme.text;
  }
}

function BorderIcon({ kind }: { kind: CellCardBorder }) {
  const border =
    kind === 'none' ? 'none' : kind === 'hairline' ? '1px solid currentColor' : '2px solid currentColor';
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-[2px] bg-cg-surface-2"
      style={{ border }}
    />
  );
}

function TintIcon({ kind, theme }: { kind: CellCardBackgroundTint; theme: Theme }) {
  if (kind === 'none') {
    return (
      <span className="inline-block h-3.5 w-3.5 rounded-[2px] border border-cg-border bg-transparent" />
    );
  }
  const opacity = kind === 'soft' ? 0.15 : 0.4;
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-[2px] border border-cg-border"
      style={{ backgroundColor: theme.accent, opacity }}
    />
  );
}

function SizeIcon({ kind }: { kind: CellCardSizeHint }) {
  const w = kind === 'narrow' ? '33%' : kind === 'wide' ? '66%' : '100%';
  return (
    <span className="inline-flex h-3.5 w-full items-center">
      <span
        className="block h-2 rounded-[1px] bg-cg-text-muted/60"
        style={{ width: w }}
      />
    </span>
  );
}

interface IconSegmentedFieldProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  renderOption: (opt: string) => React.ReactNode;
  tooltips: string[];
}

function IconSegmentedField({ label, value, options, onChange, renderOption, tooltips }: IconSegmentedFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
        {label}
      </label>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-cg-border bg-cg-surface-2 p-0.5">
        {options.map((opt, i) => {
          const selected = opt === value;
          return (
            <Tooltip key={opt}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={tooltips[i] ?? opt}
                  onClick={() => onChange(opt)}
                  className={cn(
                    'flex flex-1 items-center justify-center rounded px-1.5 py-1 transition-colors',
                    selected
                      ? 'bg-cg-accent text-cg-accent-fg shadow-sm'
                      : 'text-cg-text-muted hover:text-cg-text',
                  )}
                >
                  {renderOption(opt)}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {tooltips[i] ?? opt}
              </TooltipContent>
            </Tooltip>
          );
        })}
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

export function SegmentedField<T extends string>({ label, value, options, onChange }: SegmentedFieldProps<T>) {
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
                  ? 'bg-cg-accent text-cg-accent-fg shadow-sm'
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
