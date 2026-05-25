import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-[18px] px-4 pb-8 pt-5 md:max-w-[960px] md:gap-7 md:px-8 md:pb-12 md:pt-8">
      {/* Welcome line (desktop only) */}
      <div className="hidden md:block">
        <Skeleton className="mb-[6px] h-3 w-16" />
        <Skeleton className="h-7 w-64" />
      </div>

      {/* New calculator hero */}
      <div className="flex flex-col items-start gap-3 rounded-[10px] border border-cg-border bg-cg-surface p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[10px] border border-cg-border bg-cg-surface p-4"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-1 h-5 w-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
