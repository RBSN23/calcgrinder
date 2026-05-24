'use client';

// PROJ-15 — Chart broken-binding placeholder.
//
// Rendered when a chart has any zero-valid-binding state (all bindings broken,
// or freshly-created with no bindings). Lists the per-slot errors inline.

import * as React from 'react';

import type { ChartStructuralError } from '@/lib/charts/structural-errors';

export function ChartBrokenBindingPanel({
  errors,
  compact = false,
}: {
  errors: ChartStructuralError[];
  compact?: boolean;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className={
        compact
          ? 'rounded-md border border-amber-300/60 bg-amber-50/60 p-2 text-[11.5px] text-amber-900'
          : 'flex h-full min-h-[120px] flex-col items-start justify-center gap-1 rounded-md border border-dashed border-amber-300/70 bg-amber-50/40 p-4 text-[12px] text-amber-900'
      }
    >
      <p className="font-medium">
        {errors[0].reason === 'no_bindings'
          ? 'No values to plot yet'
          : 'Chart can\'t render until each slot has a valid value'}
      </p>
      <ul className="ml-3 list-disc space-y-0.5">
        {errors.map((e, i) => (
          <li key={i}>{e.message}</li>
        ))}
      </ul>
    </div>
  );
}
