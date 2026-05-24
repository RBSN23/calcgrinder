'use client';

// PROJ-16 — Debounce hook for text-block PATCH save.
//
// Returns a stable invoker + flush handle. Calling the invoker schedules
// the wrapped callback after `delay` ms of idle. `flush()` clears the
// pending timer and fires immediately (used on blur, configurator
// collapse, undo enrolment per the save-timing AC).
//
// Coalescing rule: every invocation captures the latest args. When a
// PATCH is in-flight and the user keeps typing, the next debounced fire
// uses the most recent body, so we never send stale text.

import * as React from 'react';

export interface DebouncedCallback<TArgs extends unknown[]> {
  (...args: TArgs): void;
  flush: () => void;
  cancel: () => void;
}

export function useDebouncedCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number,
): DebouncedCallback<TArgs> {
  const fnRef = React.useRef(fn);
  React.useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = React.useRef<TArgs | null>(null);

  const debounced = React.useMemo(() => {
    const invoke = ((...args: TArgs) => {
      pendingArgsRef.current = args;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const a = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (a) fnRef.current(...a);
      }, delay);
    }) as DebouncedCallback<TArgs>;

    invoke.flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const a = pendingArgsRef.current;
      pendingArgsRef.current = null;
      if (a) fnRef.current(...a);
    };

    invoke.cancel = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingArgsRef.current = null;
    };

    return invoke;
  }, [delay]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounced;
}
