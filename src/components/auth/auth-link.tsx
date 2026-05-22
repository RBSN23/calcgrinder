import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
    strong?: boolean;
  };

export function AuthLink({ children, strong = false, className, ...props }: Props) {
  return (
    <Link
      className={cn(
        'text-auth-link transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:underline',
        strong ? 'font-semibold' : 'font-medium',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
