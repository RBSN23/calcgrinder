'use client';

// PROJ-9 — Input widget renderer.
//
// Renders the right input control for a cell based on its value_type
// and display_widget. The widget catalogue lives in the PROJ-9 spec.

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CellRow } from '@/lib/cells/types';
import type { Theme } from '@/lib/themes';

interface CellInputWidgetProps {
  cell: CellRow;
  theme: Theme;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
  /** PROJ-12 — Visitor-side per-field padlock. When true, the widget
   * renders normally but is non-interactive (disabled) and gets a
   * slight desaturation on widgets where the spec calls for it
   * (slider / toggle / dropdown). Number/currency/percent/text fields
   * stay full opacity per spec line 1073. */
  locked?: boolean;
}

export function CellInputWidget({
  cell,
  value,
  onChange,
  readOnly,
  locked,
}: CellInputWidgetProps) {
  const widget = cell.display_widget ?? defaultWidgetFor(cell.value_type);
  // Coerce display value
  const strValue =
    value === undefined || value === null
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

  if (readOnly) {
    return (
      <p className="text-[14px] font-medium" data-readonly="true">
        {strValue || '—'}
      </p>
    );
  }

  const disabled = locked === true;

  if (cell.value_type === 'boolean') {
    return (
      <Switch
        checked={value === true || value === 'true'}
        onCheckedChange={onChange}
        disabled={disabled}
        className={disabled ? 'opacity-60' : undefined}
      />
    );
  }

  if (cell.value_type === 'select') {
    const options = cell.select_options ?? [];
    return (
      <Select
        value={strValue || undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={
            'h-9 w-full text-[13px]' + (disabled ? ' opacity-60' : '')
          }
        >
          <SelectValue placeholder="Pick an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (widget === 'slider' && cell.numeric_min != null && cell.numeric_max != null) {
    return (
      <input
        type="range"
        min={cell.numeric_min}
        max={cell.numeric_max}
        step={cell.numeric_step ?? 1}
        value={Number.isFinite(Number(strValue)) ? Number(strValue) : cell.numeric_min}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={'w-full' + (disabled ? ' opacity-40' : '')}
      />
    );
  }

  if (cell.value_type === 'date') {
    return (
      <Input
        type="date"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 text-[13px]"
      />
    );
  }

  if (cell.value_type === 'number' || cell.value_type === 'currency' || cell.value_type === 'percent') {
    return (
      <Input
        type="number"
        value={strValue}
        min={cell.numeric_min ?? undefined}
        max={cell.numeric_max ?? undefined}
        step={cell.numeric_step ?? undefined}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        disabled={disabled}
        className="h-9 text-[14px] font-medium"
        placeholder={cell.unit ?? undefined}
      />
    );
  }

  return (
    <Input
      type="text"
      value={strValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 text-[13px]"
    />
  );
}

function defaultWidgetFor(value_type: CellRow['value_type']): string {
  switch (value_type) {
    case 'number':
    case 'currency':
    case 'percent':
      return 'number_field';
    case 'date':
      return 'date_picker';
    case 'boolean':
      return 'toggle_switch';
    case 'select':
      return 'dropdown';
    default:
      return 'text_field';
  }
}
