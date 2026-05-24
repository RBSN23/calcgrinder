'use client';

// PROJ-17 — Tabular column configurator.
//
// Renders the per-column controls (label / format / alignment /
// currency_code / visibility / drag-reorder) inside the Builder
// cell-card's visual-presentation panel, gated on the cell's
// `display_emphasis === 'tabular'`.
//
// The configurator is purely auto-populated: rows mirror the cell's
// `tabular_columns` array, which itself is seeded from the formula's
// first row and reconciled on formula commit. The maintainer cannot
// add or delete rows from here — the info-tooltip explains.

import * as React from 'react';

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DISPLAY_FORMATS, type DisplayFormat } from '@/lib/cells/format';
import type { TabularColumn } from '@/lib/cells/types';
import { cn } from '@/lib/utils';

import { SortableItem, useEditorDndSensors } from './dnd-helpers';

interface TabularColumnConfigProps {
  columns: TabularColumn[];
  // Resolved fallback currency code (cell-level currency_code or 'USD').
  // Shown as the placeholder in the per-column currency input when the
  // column inherits.
  fallbackCurrencyCode: string;
  // Whether the formula currently returns array_of_objects. Affects the
  // "no rows yet" placeholder copy when the array is empty but the
  // emphasis is already 'tabular'.
  hasShapeMatch: boolean;
  onChange: (next: TabularColumn[]) => void;
}

const FORMAT_LABELS: Record<DisplayFormat, string> = {
  auto: 'Auto',
  number_integer: 'Number (integer)',
  number_decimal_2: 'Number (2 decimals)',
  number_decimal_4: 'Number (4 decimals)',
  currency: 'Currency',
  percent_0: 'Percent (0 decimals)',
  percent_2: 'Percent (2 decimals)',
  date_short: 'Date (short)',
  date_long: 'Date (long)',
  text_plain: 'Plain text',
};

const ALIGNMENTS: TabularColumn['alignment'][] = ['left', 'center', 'right'];

export function TabularColumnConfig({
  columns,
  fallbackCurrencyCode,
  hasShapeMatch,
  onChange,
}: TabularColumnConfigProps) {
  const sensors = useEditorDndSensors();
  const ids = React.useMemo(() => columns.map((c) => c.id), [columns]);

  const updateAt = React.useCallback(
    (index: number, patch: Partial<TabularColumn>) => {
      const next = columns.map((col, i) =>
        i === index ? { ...col, ...patch } : col,
      );
      onChange(next);
    },
    [columns, onChange],
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = columns.slice();
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      onChange(next);
    },
    [columns, onChange],
  );

  if (columns.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-cg-border bg-cg-surface-2/40 p-3">
        <ConfigHeader />
        <p className="mt-2 text-[11.5px] italic text-cg-text-muted">
          {hasShapeMatch
            ? 'Your formula returned an empty array — columns will appear here once a row arrives.'
            : "Your formula hasn't returned any rows yet. Columns appear here once it does."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-cg-border bg-cg-surface-2/40 p-3">
      <ConfigHeader />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="mt-2 flex flex-col gap-2">
            {columns.map((col, index) => (
              <SortableItem key={col.id} id={col.id}>
                {({ setNodeRef, style, dragHandleProps }) => (
                  <li
                    ref={setNodeRef}
                    style={style}
                    className={cn(
                      'flex flex-col gap-2 rounded-md border border-cg-border bg-cg-surface p-2',
                      col.visibility === 'hidden' && 'opacity-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Reorder column ${col.id}`}
                        className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-cg-text-muted transition-colors hover:bg-cg-surface-2 hover:text-cg-text active:cursor-grabbing"
                        onDragStart={(e) => e.preventDefault()}
                        {...dragHandleProps}
                      >
                        <GripIcon />
                      </button>
                      <span className="font-mono text-[10.5px] text-cg-text-muted">
                        {col.id}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-[10.5px] uppercase tracking-wide text-cg-text-muted">
                          Show
                        </span>
                        <Switch
                          checked={col.visibility === 'visible'}
                          onCheckedChange={(checked) =>
                            updateAt(index, {
                              visibility: checked ? 'visible' : 'hidden',
                            })
                          }
                          aria-label={`Visibility for column ${col.id}`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldLabel label="Label">
                        <Input
                          defaultValue={col.label}
                          placeholder={col.id}
                          maxLength={100}
                          onBlur={(e) => {
                            if (e.target.value !== col.label) {
                              updateAt(index, { label: e.target.value });
                            }
                          }}
                          className="h-8 text-[12px]"
                        />
                      </FieldLabel>
                      <FieldLabel label="Format">
                        <Select
                          value={col.format}
                          onValueChange={(value) =>
                            updateAt(index, { format: value })
                          }
                        >
                          <SelectTrigger className="h-8 text-[12px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DISPLAY_FORMATS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {FORMAT_LABELS[opt]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldLabel>
                      <FieldLabel label="Alignment">
                        <div
                          role="radiogroup"
                          aria-label={`Alignment for column ${col.id}`}
                          className="inline-flex rounded-md border border-cg-border bg-cg-surface-2 p-0.5"
                        >
                          {ALIGNMENTS.map((opt) => {
                            const selected = col.alignment === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() =>
                                  updateAt(index, { alignment: opt })
                                }
                                className={cn(
                                  'flex-1 rounded px-2 py-1 text-[11.5px] capitalize transition-colors',
                                  selected
                                    ? 'bg-cg-surface text-cg-text shadow-sm'
                                    : 'text-cg-text-muted hover:text-cg-text',
                                )}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </FieldLabel>
                      {col.format === 'currency' ? (
                        <FieldLabel label="Currency code">
                          <Input
                            defaultValue={col.currency_code ?? ''}
                            placeholder={fallbackCurrencyCode}
                            maxLength={6}
                            onBlur={(e) => {
                              const raw = e.target.value.trim();
                              const normalised = raw === '' ? null : raw.toUpperCase();
                              if (normalised !== (col.currency_code ?? null)) {
                                updateAt(index, { currency_code: normalised });
                              }
                            }}
                            className="h-8 font-mono text-[12px] uppercase"
                          />
                        </FieldLabel>
                      ) : null}
                    </div>
                  </li>
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function ConfigHeader() {
  return (
    <div className="flex items-center gap-1.5">
      <h4 className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
        Columns
      </h4>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              aria-label="About columns"
              className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-cg-border text-[9px] text-cg-text-muted"
            >
              i
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-[11.5px]">
            Columns mirror the first row of your formula&apos;s result. To
            add or remove a column, change the formula.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
