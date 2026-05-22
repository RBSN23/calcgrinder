import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
  mono?: boolean;
};

export const AuthInput = forwardRef<HTMLInputElement, Props>(function AuthInput(
  { className, error = false, mono = false, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-[38px] w-full items-center rounded-[7px] bg-card px-3',
        'text-[13.5px] text-foreground placeholder:text-muted-foreground/70',
        'border border-border outline-none transition-shadow',
        'focus-visible:ring-2 focus-visible:ring-auth-accent/30 focus-visible:border-auth-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        mono && 'font-mono',
        error &&
          'border-destructive shadow-[0_0_0_3px_rgba(220,38,38,0.10)] focus-visible:ring-destructive/20 focus-visible:border-destructive',
        className,
      )}
      {...props}
    />
  );
});
