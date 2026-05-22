import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'error' | 'warning';

type Props = {
  children: ReactNode;
  variant?: Variant;
};

export function AuthErrorBanner({ children, variant = 'error' }: Props) {
  const isWarning = variant === 'warning';
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-[7px] border px-3 py-2.5',
        'text-[13px] font-medium leading-snug',
        isWarning
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
          : 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',
      )}
    >
      <span
        className={cn(
          'mt-px inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full',
          'text-[11px] font-bold',
          isWarning
            ? 'bg-amber-500 text-white dark:bg-amber-300 dark:text-amber-950'
            : 'bg-red-600 text-white dark:bg-red-300 dark:text-red-950',
        )}
        aria-hidden="true"
      >
        !
      </span>
      <span>{children}</span>
    </div>
  );
}
