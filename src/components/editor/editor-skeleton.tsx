'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function EditorSkeleton() {
  return (
    <>
      {/* Desktop skeleton */}
      <div
        className="hidden flex-1 flex-col md:flex"
        style={{ height: 'calc(100vh - 48px)' }}
      >
        {/* Grid panel skeleton */}
        <div className="flex h-[164px] shrink-0 flex-col border-b border-cg-border bg-cg-surface">
          <div className="flex h-9 items-center gap-2 border-b border-cg-border px-3">
            <Skeleton className="h-4 w-24" />
            <div className="flex-1" />
            <Skeleton className="h-5 w-5 rounded" />
          </div>
          <div className="flex-1 space-y-2 p-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        </div>

        {/* Toolbar skeleton */}
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-cg-border bg-cg-surface px-3">
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-6 w-20 rounded" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-28 rounded" />
        </div>

        {/* Builder canvas skeleton */}
        <div className="flex flex-1 items-start justify-center overflow-y-auto bg-cg-canvas p-6">
          <div className="w-full max-w-[720px] space-y-4">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>

      {/* Mobile skeleton */}
      <div className="flex flex-1 flex-col md:hidden">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-cg-border bg-cg-surface px-3">
          <Skeleton className="h-6 w-24 rounded" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
        <div className="flex flex-1 items-start justify-center overflow-y-auto bg-cg-canvas p-4">
          <div className="w-full space-y-4">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </>
  );
}
