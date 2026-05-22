import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
};

export function AuthFootLine({ children, align = 'center' }: Props) {
  return (
    <div
      className={cn(
        'text-[13px] leading-relaxed text-muted-foreground',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        align === 'right' && 'text-right',
      )}
    >
      {children}
    </div>
  );
}
