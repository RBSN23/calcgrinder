import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 pb-8 pt-5 md:px-8 md:pb-12 md:pt-8">
      <Skeleton className="h-7 w-24" />

      {/* Settings sections */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-[10px] border border-cg-border bg-cg-surface p-5"
        >
          <Skeleton className="mb-4 h-4 w-28" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
