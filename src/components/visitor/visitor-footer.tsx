// PROJ-11 — Visitor footer.
//
// "Built with Calcgrinder" brand attribution only. No calculator name,
// no publish date, no version string (per Decision Log).

import * as React from 'react';

import { Wordmark } from '@/components/shell';

export function VisitorFooter() {
  return (
    <footer className="border-t border-cg-border bg-cg-surface">
      <div className="mx-auto flex max-w-[1200px] items-center justify-center px-4 py-4">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[12px] text-cg-text-muted transition-colors hover:text-cg-text"
        >
          <span aria-hidden="true">Built with</span>
          <Wordmark />
        </a>
      </div>
    </footer>
  );
}
