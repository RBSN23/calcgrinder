import type { ComponentType } from 'react';

import { cn } from '@/lib/utils';

type IconComp = ComponentType<{ size?: number; className?: string }>;

type Variant = 'muted' | 'accent' | 'destructive';

type Props = {
  icon: IconComp;
  variant?: Variant;
  size?: number;
};

export function AuthGlyph({ icon: Icon, variant = 'muted', size = 32 }: Props) {
  const variantClasses: Record<Variant, string> = {
    muted: 'bg-muted text-muted-foreground',
    accent: 'bg-auth-accent-soft text-auth-accent',
    destructive: 'bg-muted text-muted-foreground',
  };
  return (
    <div className="mx-auto">
      <div
        className={cn(
          'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
          variantClasses[variant],
        )}
      >
        <Icon size={size} />
      </div>
    </div>
  );
}
