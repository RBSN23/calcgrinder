'use client';

// PROJ-12 — UnsavedChangesGuard.
//
// Mounted ONLY on `?s=` URLs (the parent renders it conditionally).
// Two protections:
//   1. Browser-level: a `beforeunload` listener triggers the native
//      confirm when the visitor tries to close the tab or type a new
//      URL.
//   2. In-app: an event listener captures anchor clicks that would
//      route away (any <a href> click bubbling up to the document)
//      and shows a JS confirm dialog before allowing the nav.
//
// Both protections short-circuit when `isModified === false` (the
// hook re-derives on every render, so a Save / Reset / value-flip
// back to baseline silently turns the guard off).

import * as React from 'react';

import { useVisitorInputStore } from './visitor-input-store';

export function UnsavedChangesGuard() {
  const { isModified } = useVisitorInputStore();
  const ref = React.useRef(isModified);
  React.useEffect(() => {
    ref.current = isModified;
  }, [isModified]);

  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!ref.current) return;
      e.preventDefault();
      // Older browsers required returnValue; modern browsers ignore.
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);

    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      // Walk up to find the anchor (covers nested span / svg targets).
      let target: HTMLElement | null = e.target as HTMLElement | null;
      while (target && target.tagName !== 'A') target = target.parentElement;
      if (!target) return;
      const anchor = target as HTMLAnchorElement;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.target && anchor.target !== '_self') return;
      // Only guard same-origin navigations.
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Skip if it's the same URL (no real navigation).
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }
      const proceed = window.confirm(
        'You have unsaved changes. Leave anyway?',
      );
      if (!proceed) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return null;
}
