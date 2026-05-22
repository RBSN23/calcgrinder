import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

function AuthWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md',
          'bg-foreground text-background',
          'font-mono text-base font-semibold',
        )}
      >
        c
      </div>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Calcgrinder
      </span>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex min-h-screen w-full flex-col items-center bg-background text-foreground',
        'px-6 pb-8 pt-14 sm:px-6 sm:pb-14 sm:pt-[88px]',
        'overflow-auto',
      )}
    >
      <div className="mb-9 sm:mb-12">
        <AuthWordmark />
      </div>
      <div className="flex w-full max-w-full flex-col gap-5 sm:max-w-[360px]">
        {children}
      </div>
    </div>
  );
}
