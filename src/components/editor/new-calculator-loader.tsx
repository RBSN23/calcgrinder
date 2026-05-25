'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import {
  cloneCalculator,
  createCalculator,
  duplicateCalculator,
} from '@/lib/calculators/client';

import { EditorSkeleton } from './editor-skeleton';

export function NewCalculatorLoader() {
  const router = useRouter();
  const params = useSearchParams();
  const started = React.useRef(false);
  const [slow, setSlow] = React.useState(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;

    const cloneId = params.get('clone');
    const cloneToken = params.get('token');
    const duplicateId = params.get('duplicate');

    const slowTimer = window.setTimeout(() => setSlow(true), 3000);

    async function run() {
      try {
        let newId: string;
        if (cloneId && cloneToken) {
          const res = await cloneCalculator(cloneId, cloneToken);
          newId = res.id;
        } else if (duplicateId) {
          const res = await duplicateCalculator(duplicateId);
          newId = res.id;
        } else {
          const res = await createCalculator();
          newId = res.id;
        }
        router.replace(`/editor/${newId}`);
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
