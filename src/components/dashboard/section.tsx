'use client';

// PROJ-5 — Dashboard section primitive.
//
// Collapsible card with a chevron + title + count pill + optional hint in
// the header, and a content body that scrolls internally past 304px so
// long sections never grow without bound. Built on shadcn's Radix
// `Collapsible` so a11y wiring (aria-expanded, aria-controls, focus) is
// inherited rather than hand-rolled.
//
// Forward-compat: `tint="danger"` washes the frame red for the sysadmin
// "User Calculators" section PROJ-19 will mount; `hint` shows only when
// collapsed (the design's convention). Downstream features (PROJ-10 /
// PROJ-12 / PROJ-13 / PROJ-18 / PROJ-19) pass their content as children.

import * as React from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Icons } from '@/components/shell';

// Threshold = 2 card-rows (128 + 12 + 128 = 268) + section content
// padding (18 top + 18 bottom = 36) ≈ 304. Past this, the inner
// container becomes a scroll container. Promote to a `maxHeight?: number`
// prop only when a real consumer needs a different value.
export const SECTION_SCROLL_MAX_PX = 304;

export interface SectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  hint?: string;
  tint?: 'danger';
}

export function Section({
  title,
  count,
  children,
  defaultExpanded = false,
  hint,
  tint,
}: SectionProps) {
  const [open, setOpen] = React.useState(defaultExpanded);

  const frame =
    tint === 'danger'
      ? 'bg-cg-danger-soft border-cg-danger-border'
      : 'bg-cg-surface border-cg-border';
  const divider =
    tint === 'danger' ? 'border-cg-danger-border' : 'border-cg-border';

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className={`overflow-hidden rounded-[10px] border [contain:inline-size] ${frame}`}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex h-[52px] w-full items-center gap-[10px] bg-transparent pl-[14px] pr-4 text-left text-cg-text outline-none focus-visible:ring-2 focus-visible:ring-cg-border"
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center text-cg-text-muted transition-transform duration-150 ${
                open ? 'rotate-0' : '-rotate-90'
              }`}
              aria-hidden="true"
            >
              <Icons.ChevD size={16} />
            </span>
            <h2 className="m-0 text-[14.5px] font-semibold tracking-[-0.15px]">
              {title}
            </h2>
            <span className="rounded-full border border-cg-border bg-cg-surface-2 px-[7px] py-[2px] font-mono text-[11.5px] font-medium tracking-normal text-cg-text-muted">
              {count}
            </span>
            {hint && !open ? (
              <span className="ml-1 text-[12px] font-normal text-cg-text-subtle">
                · {hint}
              </span>
            ) : null}
            <span className="flex-1" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className={`overflow-y-auto border-t px-4 py-[18px] ${divider}`}
            style={{ maxHeight: SECTION_SCROLL_MAX_PX }}
          >
            {children}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
