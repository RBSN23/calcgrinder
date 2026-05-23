'use client';

// PROJ-11 — Visitor error boundary.
//
// Standard Next.js error.tsx that catches unexpected runtime errors
// (e.g. RPC throw past the typed null-handling path, hydration
// failure). Renders a visitor-side fallback with a Try again button.

import * as React from 'react';

import { EmptyOrErrorState } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { VisitorFooter, VisitorHeader } from '@/components/visitor';

export default function VisitorError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <VisitorHeader token={null} approvedUser={null} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyOrErrorState
            variant="error"
            title="Something went wrong"
            body="Try reloading. If the problem keeps happening, the calculator's author may have changed something."
            action={
              <Button onClick={reset} size="sm">
                Try again
              </Button>
            }
          />
        </div>
      </main>
      <VisitorFooter />
    </>
  );
}
