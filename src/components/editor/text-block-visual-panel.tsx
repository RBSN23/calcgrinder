'use client';

// PROJ-16 — Text-block card-level visual settings strip.
//
// Sits below the editor surface in the expanded card. Mirrors the cell
// card's visual panel layout: a row of segmented buttons + (later) an
// accent swatch picker. PATCH fires immediately on every change.

import * as React from 'react';

import type { Theme } from '@/lib/themes';
import {
  TEXT_BLOCK_BORDER_OPTIONS,
  TEXT_BLOCK_SIZE_OPTIONS,
  TEXT_BLOCK_TEXT_COLOUR_OPTIONS,
  TEXT_BLOCK_TEXT_SIZE_OPTIONS,
  TEXT_BLOCK_TINT_OPTIONS,
  type TextBlockCardBackgroundTint,
  type TextBlockCardBorder,
  type TextBlockCardSizeHint,
  type TextBlockRow,
  type TextBlockTextColour,
  type TextBlockTextSize,
} from '@/lib/text-blocks/types';
import { cn } from '@/lib/utils';

interface TextBlockVisualPanelProps {
  textBlock: TextBlockRow;
  theme: Theme;
  onPatch: (body: Record<string, unknown>) => Promise<unknown>;
}

export function TextBlockVisualPanel({
  textBlock,
  theme,
  onPatch,
}: TextBlockVisualPanelProps) {
  return (
    <div className="rounded-md border border-cg-border bg-cg-surface p-3 text-cg-text">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-cg-text-muted">
          Appearance
        </h3>
        <span className="text-[11.5px] text-cg-text-muted">
          Active theme: {theme.displayName}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SegmentedField
          label="Text size"
          value={textBlock.text_size}
          options={TEXT_BLOCK_TEXT_SIZE_OPTIONS}
          onChange={(v) => onPatch({ text_size: v as TextBlockTextSize })}
        />
        <SegmentedField
          label="Text colour"
          value={textBlock.text_colour}
          options={TEXT_BLOCK_TEXT_COLOUR_OPTIONS}
          onChange={(v) => onPatch({ text_colour: v as TextBlockTextColour })}
        />
        <SegmentedField
          label="Background tint"
          value={textBlock.card_background_tint}
          options={TEXT_BLOCK_TINT_OPTIONS}
          onChange={(v) =>
            onPatch({ card_background_tint: v as TextBlockCardBackgroundTint })
          }
        />
        <SegmentedField
          label="Border"
          value={textBlock.card_border}
          options={TEXT_BLOCK_BORDER_OPTIONS}
          onChange={(v) => onPatch({ card_border: v as TextBlockCardBorder })}
        />
        <SegmentedField
          label="Size"
          value={textBlock.card_size_hint}
          options={TEXT_BLOCK_SIZE_OPTIONS}
          onChange={(v) =>
            onPatch({ card_size_hint: v as TextBlockCardSizeHint })
          }
        />
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

function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] font-semibold uppercase tracking-wide text-cg-text-muted">
        {label}
      </label>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex rounded-md border border-cg-border bg-cg-surface-2 p-0.5"
      >
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
