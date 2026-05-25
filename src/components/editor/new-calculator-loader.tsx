'use client';

// PROJ-25 — Loader for /editor/new, /editor/new?duplicate=…, /editor/new?clone=…
//
// For the plain "new calculator" case, the POST response contains everything
// needed to render the editor (calculator row + default_section_id). Instead
// of router.replace() → full server RSC round-trip → getEditorBundle, we
// hydrate the EditorProvider directly from the POST response and update the
// URL with history.replaceState. This eliminates a ~1.5s server round-trip.
//
// Clone and duplicate still use router.replace() because their bundles may
// contain cells/charts/text_blocks that the POST response doesn't include.

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import {
  cloneCalculator,
  createCalculator,
  duplicateCalculator,
} from '@/lib/calculators/client';
import type { CreateCalculatorResponse } from '@/lib/calculators/client';
import type { SectionRow } from '@/lib/sections/types';
import { EditorProvider } from '@/lib/editor/EditorProvider';

import { EditorBody } from './editor-body';
import { EditorSkeleton } from './editor-skeleton';

export function NewCalculatorLoader() {
  const router = useRouter();
  const params = useSearchParams();
  const started = React.useRef(false);
  const [slow, setSlow] = React.useState(false);
  const [bundle, setBundle] = React.useState<{
    row: CreateCalculatorResponse;
    section: SectionRow;
  } | null>(null);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;

    const cloneId = params.get('clone');
    const cloneToken = params.get('token');
    const duplicateId = params.get('duplicate');

    const slowTimer = window.setTimeout(() => setSlow(true), 3000);

    async function run() {
      try {
        if (cloneId && cloneToken) {
          const res = await cloneCalculator(cloneId, cloneToken);
          router.replace(`/editor/${res.id}`);
        } else if (duplicateId) {
          const res = await duplicateCalculator(duplicateId);
          router.replace(`/editor/${res.id}`);
        } else {
          const res = await createCalculator();
          const section: SectionRow = {
            id: res.default_section_id,
            calculator_id: res.id,
            title: 'Section 1',
            description: '',
            layout_pattern_id: 'single_column',
            display_order: 0,
            created_at: res.updated_at,
            updated_at: res.updated_at,
          };
          window.history.replaceState(null, '', `/editor/${res.id}`);
          setBundle({ row: res, section });
        }
      } catch {
        const { toast } = await import('sonner');
        toast.error("Couldn't create calculator — please try again.");
        router.replace('/dashboard');
      } finally {
        clearTimeout(slowTimer);
      }
    }

    void run();

    return () => clearTimeout(slowTimer);
  }, [router, params]);

  if (bundle) {
    return (
      <EditorProvider
        initialRow={bundle.row}
        initialSections={[bundle.section]}
        initialCells={[]}
        initialCharts={[]}
        initialTextBlocks={[]}
      >
        <EditorBody />
      </EditorProvider>
    );
  }

  return (
    <div className="relative">
      <EditorSkeleton />
      {slow && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-cg-surface-2 px-3 py-1.5 text-[13px] text-cg-text-muted shadow-sm">
          Still creating…
        </div>
      )}
    </div>
  );
}
