import type { ReactNode } from 'react';

export function AuthHelpText({ children }: { children: ReactNode }) {
  return (
    <p className="mx-0.5 mt-0.5 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
