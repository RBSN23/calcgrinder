'use client';

import type { ButtonHTMLAttributes } from 'react';
import { useFormStatus } from 'react-dom';

import { cn } from '@/lib/utils';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
};

export function AuthSubmit({
  children,
  pendingLabel,
  className,
  disabled,
  ...props
}: Props) {
  const status = useFormStatus();
  const isPending = status.pending;

  return (
    <button
      type="submit"
      disabled={disabled || isPending}
      className={cn(
        'mt-1 inline-flex h-[42px] w-full items-center justify-center rounded-[7px]',
        'bg-auth-accent text-auth-accent-foreground',
        'border border-auth-accent',
        'text-sm font-semibold tracking-[-0.1px]',
        'transition-opacity hover:opacity-95',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-auth-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      {...props}
    >
      {isPending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
