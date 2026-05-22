import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
};

export function AuthField({ label, htmlFor, children, hint }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className={cn(
          'text-[11px] font-medium uppercase tracking-[0.4px]',
          'text-muted-foreground',
        )}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-0.5 px-0.5 text-xs leading-snug text-destructive">
          {hint}
        </p>
      )}
    </div>
  );
}
