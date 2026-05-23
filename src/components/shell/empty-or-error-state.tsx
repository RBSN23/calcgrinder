// PROJ-4 — Shared empty/error state primitive.
// Used by the per-group not-found surface in PROJ-4 and (by inheritance)
// PROJ-5 (Presets empty), PROJ-11 (visitor 404/410), PROJ-13 (Trash empty).

import * as React from 'react';

export interface EmptyOrErrorStateProps {
  variant?: 'empty' | 'error';
  framed?: boolean;
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyOrErrorState({
  variant = 'empty',
  framed = true,
  icon,
  title,
  body,
  action,
  className,
}: EmptyOrErrorStateProps) {
  const frame = framed
    ? variant === 'empty'
      ? 'border border-dashed border-cg-border bg-cg-surface-2 rounded-lg'
      : 'border border-cg-border bg-cg-surface rounded-lg'
    : '';
  return (
    <div
      role={variant === 'error' ? 'alert' : undefined}
      className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${frame} ${className ?? ''}`}
    >
      {icon ? (
        <div className="text-cg-text-subtle" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-semibold text-cg-text">{title}</h2>
      {body ? <p className="max-w-md text-sm text-cg-text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
