'use client';

// PROJ-9 / PROJ-23 — Cell data-model panel (compact settings).
//
// PROJ-23 redesigned this panel: removed NAME (now inline rename in
// column header, Issue 2), removed LABEL (moved to Visual Panel,
// Issue 3), removed FORMULA (stays in the grid data row). Binary
// fields use segmented toggles; VALUE TYPE is an inline select.
// DESCRIPTION renamed to NOTES. Conditional sub-fields appear based
// on value_type.

import * as React from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CellDescriptionRender,
  CellEditability,
  CellRow,
  CellValueType,
  CellVisibility,
} from '@/lib/cells/types';
import type { PatchCellBody } from '@/lib/cells/client';
import { cn } from '@/lib/utils';

interface CellDataModelPanelProps {
  cell: CellRow;
  onPatch: (body: Omit<PatchCellBody, 'updated_at'>) => Promise<unknown>;
}

const VALUE_TYPES: CellValueType[] = [
  'number',
  'currency',
  'percent',
  'date',
  'boolean',
  'select',
  'text',
];

const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD',
  'CNY', 'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'KRW', 'INR',
  'BRL', 'MXN', 'ZAR', 'PLN', 'CZK', 'HUF', 'TRY', 'THB',
  'IDR', 'MYR', 'PHP', 'TWD', 'ILS', 'AED', 'SAR', 'RUB',
] as const;

export function CellDataModelPanel({ cell, onPatch }: CellDataModelPanelProps) {
  const [notes, setNotes] = React.useState(cell.description);

  React.useEffect(() => setNotes(cell.description), [cell.description]);

  return (
    <div className="flex flex-col gap-1.5 p-2 text-[11.5px] text-cg-text">
      <SegmentedToggle
        ariaLabel="Kind"
        value={cell.kind}
        options={[
          { value: 'input', label: 'Input' },
          { value: 'output', label: 'Output' },
        ]}
        onChange={(v) =>
          onPatch({
            kind: v as 'input' | 'output',
            formula: v === 'output' ? cell.formula ?? '' : undefined,
          })
        }
      />
      <SegmentedToggle
        ariaLabel="Visibility"
        value={cell.visibility}
        options={[
          { value: 'visible', label: 'Visible' },
          {
            value: 'hidden',
            label: 'Hidden',
            disabled: cell.default_value === null || cell.default_value === undefined,
          },
        ]}
        onChange={(v) => onPatch({ visibility: v as CellVisibility })}
      />
      {cell.kind === 'input' ? (
        <SegmentedToggle
          ariaLabel="Editability"
          value={cell.editability}
          options={[
            { value: 'editable', label: 'Editable' },
            { value: 'readonly', label: 'Readonly' },
          ]}
          onChange={(v) => onPatch({ editability: v as CellEditability })}
        />
      ) : null}
      <SegmentedToggle
        ariaLabel="Description render"
        value={cell.description_render}
        options={[
          { value: 'caption', label: 'Caption' },
          { value: 'tooltip', label: 'Tooltip' },
        ]}
        onChange={(v) => onPatch({ description_render: v as CellDescriptionRender })}
      />
      <Select
        value={cell.value_type}
        onValueChange={(v) => onPatch({ value_type: v as CellValueType })}
      >
        <SelectTrigger className="h-7 text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VALUE_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(cell.value_type === 'number' ||
        cell.value_type === 'currency' ||
        cell.value_type === 'percent') && (
        <div className="grid grid-cols-3 gap-1.5">
          <CompactField label="Min">
            <Input
              type="number"
              defaultValue={cell.numeric_min ?? ''}
              onBlur={(e) =>
                onPatch({
                  numeric_min: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              className="h-7 text-[11px]"
            />
          </CompactField>
          <CompactField label="Max">
            <Input
              type="number"
              defaultValue={cell.numeric_max ?? ''}
              onBlur={(e) =>
                onPatch({
                  numeric_max: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              className="h-7 text-[11px]"
            />
          </CompactField>
          <CompactField label="Step">
            <Input
              type="number"
              defaultValue={cell.numeric_step ?? ''}
              onBlur={(e) =>
                onPatch({
                  numeric_step: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              className="h-7 text-[11px]"
            />
          </CompactField>
        </div>
      )}
      {cell.value_type === 'currency' && (
        <Select
          value={cell.currency_code ?? 'USD'}
          onValueChange={(v) => onPatch({ currency_code: v })}
        >
          <SelectTrigger className="h-7 font-mono text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {cell.value_type === 'select' && (
        <SelectOptionsEditor
          options={cell.select_options ?? []}
          onChange={(next) => onPatch({ select_options: next })}
        />
      )}
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== cell.description) onPatch({ description: notes });
        }}
        placeholder="Author-only notes…"
        className="h-7 text-[11px]"
      />
    </div>
  );
}

function CompactField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

interface ToggleOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function SegmentedToggle({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: ToggleOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-md border border-cg-border bg-cg-surface-2 p-0.5">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={cn(
              'flex-1 rounded px-1.5 py-0.5 text-[10.5px] capitalize transition-colors',
              selected
                ? 'bg-cg-accent text-cg-accent-fg shadow-sm'
                : 'text-cg-text-muted hover:text-cg-text',
              opt.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface SelectOption {
  id: string;
  label: string;
}

function SelectOptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (next: SelectOption[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-1">
          <Input
            value={opt.id}
            onBlur={(e) => {
              const next = [...options];
              next[i] = { ...next[i], id: e.target.value };
              onChange(next);
            }}
            placeholder="id"
            className="h-7 w-24 font-mono text-[11px]"
            defaultValue={opt.id}
          />
          <Input
            value={opt.label}
            onBlur={(e) => {
              const next = [...options];
              next[i] = { ...next[i], label: e.target.value };
              onChange(next);
            }}
            placeholder="Label"
            className="h-7 flex-1 text-[11px]"
            defaultValue={opt.label}
          />
          <button
            type="button"
            aria-label="Remove option"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            className="text-cg-text-muted hover:text-red-600"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="self-start rounded border border-dashed border-cg-border px-2 py-1 text-[11px] text-cg-text-muted hover:bg-cg-surface-2"
        onClick={() =>
          onChange([
            ...options,
            { id: `opt_${options.length + 1}`, label: `Option ${options.length + 1}` },
          ])
        }
      >
        + Add option
      </button>
    </div>
  );
}

