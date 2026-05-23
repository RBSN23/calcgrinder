'use client';

// PROJ-9 — Layout-pattern picker.
//
// Anchored popover listing every pattern from the active theme's
// `layoutPatterns` array. Each row shows a tiny visual representation
// (rectangles per columnSpan), display name, and description; the
// current pattern carries a checkmark.

import * as React from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { LayoutPattern } from '@/lib/themes';

interface LayoutPatternPickerProps {
  patterns: readonly LayoutPattern[];
  activeId: string;
  onPick: (id: string) => void;
  /** Trigger label / aria-label. Default "Change layout". */
  ariaLabel?: string;
}

export function LayoutPatternPicker({
  patterns,
  activeId,
  onPick,
  ariaLabel = 'Change layout',
}: LayoutPatternPickerProps) {
  const [open, setOpen] = React.useState(false);
  const active = patterns.find((p) => p.id === activeId) ?? patterns[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-cg-border bg-cg-surface px-2 text-[12px] text-cg-text-muted transition-colors hover:bg-cg-surface-2"
        >
          <LayoutPatternIcon pattern={active} />
          <span className="font-medium">{active?.displayName ?? 'Layout'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[280px] border-cg-border bg-cg-surface p-1"
      >
        <ul role="menu" className="flex flex-col">
          {patterns.map((p) => {
            const selected = p.id === activeId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    setOpen(false);
                    if (!selected) onPick(p.id);
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-[12.5px] transition-colors',
                    'text-cg-text hover:bg-cg-surface-2 focus:bg-cg-surface-2 focus:outline-none',
                  )}
                >
                  <span aria-hidden className="mt-0.5 inline-flex h-5 w-7 shrink-0">
                    <LayoutPatternIcon pattern={p} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium leading-tight">{p.displayName}</span>
                    <span className="text-[11px] text-cg-text-muted leading-tight">
                      {p.description}
                    </span>
                  </span>
                  {selected ? (
                    <span aria-hidden className="ml-1 text-cg-accent">✓</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function LayoutPatternIcon({ pattern }: { pattern: LayoutPattern | undefined }) {
  if (!pattern) return null;
  const total = pattern.columnSpans.reduce((sum, n) => sum + n, 0);
  return (
    <span className="inline-flex h-4 w-7 items-stretch gap-[2px]">
      {pattern.columnSpans.map((span, i) => (
        <span
          key={i}
          className="block rounded-[2px] bg-cg-text-muted/40"
          style={{ flexGrow: span / total }}
        />
      ))}
    </span>
  );
}
