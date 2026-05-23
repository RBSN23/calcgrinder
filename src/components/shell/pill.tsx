// PROJ-4 — Pill (chrome primitive ported from docs/design/chrome.jsx).
// Lozenge with a leading dot + uppercase label. Used by future features
// (PROJ-10 publish state, PROJ-21 import-preview diff) — shipped now to
// land the chrome design language in one place.

import * as React from 'react';

type Kind = 'published' | 'draft' | 'input' | 'output' | 'new' | 'replaced' | 'unchanged';

const KIND_CLASSES: Record<Kind, { wrap: string; dot: string }> = {
  published: {
    wrap: 'bg-cg-accent-soft text-cg-accent-text',
    dot: 'bg-cg-accent',
  },
  draft: {
    wrap: 'bg-cg-surface-3 text-cg-text-muted',
    dot: 'bg-cg-text-subtle',
  },
  input: {
    wrap: 'bg-cg-surface-3 text-cg-text-muted',
    dot: 'bg-cg-text-subtle',
  },
  output: {
    wrap: 'bg-cg-accent-soft text-cg-accent-text',
    dot: 'bg-cg-accent',
  },
  new: {
    wrap: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    dot: 'bg-emerald-600',
  },
  replaced: {
    wrap: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  unchanged: {
    wrap: 'bg-cg-surface-3 text-cg-text-muted',
    dot: 'bg-cg-text-subtle',
  },
};

export interface PillProps {
  kind?: Kind;
  children: React.ReactNode;
  className?: string;
}

export function Pill({ kind = 'draft', children, className }: PillProps) {
  const { wrap, dot } = KIND_CLASSES[kind];
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-full px-[7px] py-[1px] text-[10.5px] font-medium uppercase leading-[15px] tracking-[0.1px] ${wrap} ${className ?? ''}`}
    >
      <span className={`h-1 w-1 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}
