'use client';

// PROJ-9 — Cell data-model panel.
//
// Inline expansion from the Grid column kebab. Owns the identity +
// data-model settings (name, label, value_type, visibility, editability,
// description text + render, default value or formula, numeric
// constraints, select options, currency code).

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { validateCellName } from '@/lib/cells/types';
import type { PatchCellBody } from '@/lib/cells/client';

interface CellDataModelPanelProps {
  cell: CellRow;
  onPatch: (body: Omit<PatchCellBody, 'updated_at'>) => Promise<unknown>;
  onClose: () => void;
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

export function CellDataModelPanel({ cell, onPatch, onClose }: CellDataModelPanelProps) {
  const [name, setName] = React.useState(cell.name);
  const [label, setLabel] = React.useState(cell.label);
  const [description, setDescription] = React.useState(cell.description);
  const [formula, setFormula] = React.useState(cell.formula ?? '');
  const [defaultValue, setDefaultValue] = React.useState(
    cell.default_value === null || cell.default_value === undefined
      ? ''
      : String(cell.default_value),
  );
  const [nameError, setNameError] = React.useState<string | null>(null);

  React.useEffect(() => setName(cell.name), [cell.name]);
  React.useEffect(() => setLabel(cell.label), [cell.label]);
  React.useEffect(() => setDescription(cell.description), [cell.description]);
  React.useEffect(() => setFormula(cell.formula ?? ''), [cell.formula]);
  React.useEffect(
    () =>
      setDefaultValue(
        cell.default_value === null || cell.default_value === undefined
          ? ''
          : String(cell.default_value),
      ),
    [cell.default_value],
  );

  const commitName = async () => {
    if (name === cell.name) return;
    const v = validateCellName(name);
    if (!v.ok) {
      if (v.reason === 'name_invalid') {
        setNameError(
          'Lowercase letters, digits, and underscores only. Must start with a letter.',
        );
      } else if (v.reason === 'name_reserved') {
        setNameError(`${v.reservedWord} is a built-in function — pick another name.`);
      } else {
        setNameError('Name required.');
      }
      return;
    }
    setNameError(null);
    await onPatch({ name: v.value });
  };

  return (
    <div className="rounded-md border border-cg-border bg-cg-surface p-3 text-[12.5px] text-cg-text">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold uppercase tracking-wide text-cg-text-muted">
          Data model
        </h3>
        <button
          type="button"
          aria-label="Collapse data-model panel"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-cg-text-muted hover:bg-cg-surface-2"
        >
          ✕
        </button>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name (formula identifier)">
          <Input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commitName();
              }
            }}
            aria-invalid={nameError ? true : undefined}
            className="h-8 font-mono text-[12px]"
          />
          {nameError ? (
            <p className="mt-0.5 text-[11px] text-red-600">{nameError}</p>
          ) : null}
        </Field>
        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => {
              if (label !== cell.label) onPatch({ label });
            }}
            className="h-8 text-[12px]"
          />
        </Field>
        <Field label="Kind">
          <Select
            value={cell.kind}
            onValueChange={(v) =>
              onPatch({
                kind: v as 'input' | 'output',
                formula: v === 'output' ? cell.formula ?? '' : undefined,
              })
            }
          >
            <SelectTrigger className="h-8 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="input">Input</SelectItem>
              <SelectItem value="output">Output</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Value type">
          <Select
            value={cell.value_type}
            onValueChange={(v) => onPatch({ value_type: v as CellValueType })}
          >
            <SelectTrigger className="h-8 text-[12px]">
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
        </Field>
        <Field label="Visibility">
          <Select
            value={cell.visibility}
            onValueChange={(v) => onPatch({ visibility: v as CellVisibility })}
          >
            <SelectTrigger className="h-8 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visible">Visible</SelectItem>
              {/* The DB check constraint forbids visibility=hidden with
                  default_value IS NULL — hidden cells must still feed
                  formulas with a real value. Disable the option here
                  so the user gets a clear hint instead of a 422 toast. */}
              <SelectItem
                value="hidden"
                disabled={
                  cell.default_value === null || cell.default_value === undefined
                }
              >
                Hidden
                {(cell.default_value === null || cell.default_value === undefined) && (
                  <span className="ml-2 text-[10px] text-cg-text-subtle">
                    set default value first
                  </span>
                )}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Editability">
          <Select
            value={cell.editability}
            onValueChange={(v) => onPatch({ editability: v as CellEditability })}
          >
            <SelectTrigger className="h-8 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editable">Editable</SelectItem>
              <SelectItem value="readonly">Readonly</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description" full>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== cell.description) onPatch({ description });
            }}
            className="min-h-[60px] text-[12px]"
          />
        </Field>
        <Field label="Description render">
          <Select
            value={cell.description_render}
            onValueChange={(v) =>
              onPatch({ description_render: v as CellDescriptionRender })
            }
          >
            <SelectTrigger className="h-8 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="caption">Caption</SelectItem>
              <SelectItem value="tooltip">Tooltip</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {cell.kind === 'input' ? (
          <Field label="Default value">
            <Input
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              onBlur={() => {
                const coerced = coerceDefault(defaultValue, cell.value_type);
                onPatch({ default_value: coerced });
              }}
              className="h-8 text-[12px]"
            />
          </Field>
        ) : (
          <Field label="Formula" full>
            <Input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              onBlur={() => {
                if (formula !== (cell.formula ?? '')) onPatch({ formula });
              }}
              className="h-8 font-mono text-[12px]"
              placeholder="= …"
            />
          </Field>
        )}
        {(cell.value_type === 'number' ||
          cell.value_type === 'currency' ||
          cell.value_type === 'percent') && (
          <>
            <Field label="Min">
              <Input
                type="number"
                defaultValue={cell.numeric_min ?? ''}
                onBlur={(e) =>
                  onPatch({
                    numeric_min: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className="h-8 text-[12px]"
              />
            </Field>
            <Field label="Max">
              <Input
                type="number"
                defaultValue={cell.numeric_max ?? ''}
                onBlur={(e) =>
                  onPatch({
                    numeric_max: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className="h-8 text-[12px]"
              />
            </Field>
            <Field label="Step">
              <Input
                type="number"
                defaultValue={cell.numeric_step ?? ''}
                onBlur={(e) =>
                  onPatch({
                    numeric_step: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className="h-8 text-[12px]"
              />
            </Field>
            <Field label="Unit">
              <Input
                defaultValue={cell.unit ?? ''}
                onBlur={(e) => onPatch({ unit: e.target.value })}
                className="h-8 text-[12px]"
              />
            </Field>
          </>
        )}
        {cell.value_type === 'currency' && (
          <Field label="Currency code">
            <Input
              defaultValue={cell.currency_code ?? 'USD'}
              maxLength={3}
              onBlur={(e) => onPatch({ currency_code: e.target.value.toUpperCase() })}
              className="h-8 font-mono text-[12px] uppercase"
            />
          </Field>
        )}
        {cell.value_type === 'select' && (
          <Field label="Options" full>
            <SelectOptionsEditor
              options={cell.select_options ?? []}
              onChange={(next) => onPatch({ select_options: next })}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'col-span-2 flex flex-col gap-1' : 'flex flex-col gap-1'}>
      <label className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function coerceDefault(raw: string, value_type: CellValueType): unknown {
  if (raw === '') return undefined;
  switch (value_type) {
    case 'number':
    case 'currency':
    case 'percent': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    case 'boolean':
      return raw === 'true';
    default:
      return raw;
  }
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

