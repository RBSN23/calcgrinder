'use client';

// PROJ-8 / PROJ-25 — Dashboard Hero "Build a new calculator" button.
//
// PROJ-25: navigates immediately to `/editor/new` (skeleton editor) instead
// of waiting for the POST response. The skeleton page handles creation.

import Link from 'next/link';

import { Icons } from '@/components/shell';
import { Button } from '@/components/ui/button';

export function NewCalculatorHero() {
  return (
    <section
      aria-label="Build a new calculator"
      className="flex flex-col items-start gap-3 rounded-[10px] border border-cg-border bg-cg-surface p-5 md:flex-row md:items-center md:justify-between md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-semibold tracking-[-0.15px] text-cg-text md:text-[18px]">
          Build a new calculator
        </h2>
        <p className="max-w-prose text-[13px] text-cg-text-muted">
          Start with a blank canvas — add cells, pick a theme, and publish when
          you&rsquo;re ready.
        </p>
      </div>
      <Button
        size="sm"
        variant="default"
        asChild
        className="h-10 gap-1.5 bg-cg-accent px-4 text-[13px] font-semibold text-cg-accent-fg hover:bg-cg-accent-hov"
      >
        <Link href="/editor/new" prefetch={false}>
          <Icons.Plus size={16} />
          <span>Build a new calculator</span>
        </Link>
      </Button>
    </section>
  );
}
