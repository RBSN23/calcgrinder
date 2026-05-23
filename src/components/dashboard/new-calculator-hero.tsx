'use client';

// PROJ-8 — Dashboard Hero "Build a new calculator" button.
//
// Always visible on /dashboard (the PROJ-5 visibility deferral is retired).
// Uses the same create handler as the top-bar "+ New calculator" button.

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Icons } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { createCalculator } from '@/lib/calculators/client';

export function NewCalculatorHero() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  async function handleClick() {
    if (creating) return;
    setCreating(true);
    try {
      const row = await createCalculator();
      router.push(`/editor/${row.id}`);
    } catch {
      const { toast } = await import('sonner');
      toast.error("Couldn't create calculator — please try again.");
    } finally {
      setCreating(false);
    }
  }

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
        onClick={handleClick}
        disabled={creating}
        className="h-10 gap-1.5 bg-cg-accent px-4 text-[13px] font-semibold text-cg-accent-fg hover:bg-cg-accent-hov"
      >
        <Icons.Plus size={16} />
        <span>Build a new calculator</span>
      </Button>
    </section>
  );
}
