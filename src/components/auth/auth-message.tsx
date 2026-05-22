import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  title: string;
  children?: ReactNode;
  align?: 'left' | 'center';
};

export function AuthMessage({ title, children, align = 'center' }: Props) {
  return (
    <div className={cn(align === 'center' ? 'text-center' : 'text-left')}>
      <h1 className="m-0 mb-2 text-[22px] font-semibold leading-[1.2] tracking-[-0.3px] text-foreground">
        {title}
      </h1>
      {children && (
        <p className="m-0 text-sm leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}
