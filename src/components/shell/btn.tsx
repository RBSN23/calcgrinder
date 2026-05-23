// PROJ-4 — Btn (chrome primitive ported from docs/design/chrome.jsx).
// Bespoke port used only on chrome surfaces where exact design fidelity
// to the prototype matters. Body content keeps using shadcn `Button`.

import * as React from 'react';

import type { IconName } from './icons';
import { Icons } from './icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-cg-accent text-cg-accent-fg border border-cg-accent hover:bg-cg-accent-hov hover:border-cg-accent-hov',
  secondary:
    'bg-cg-surface text-cg-text border border-cg-border-strong hover:bg-cg-surface-2',
  ghost:
    'bg-transparent text-cg-text border border-transparent hover:bg-cg-surface-2',
  soft: 'bg-cg-surface-2 text-cg-text border border-cg-border hover:bg-cg-surface-3',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-7 px-[10px] text-[12px]',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-10 px-4 text-[13px]',
};

export interface BtnProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  children: React.ReactNode;
}

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = 'secondary', size = 'md', icon, children, className, ...rest },
  ref,
) {
  const Icon = icon ? Icons[icon] : null;
  const iconSize = size === 'sm' ? 13 : 14;
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-md font-medium tracking-tight transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
      {...rest}
    >
      {Icon ? <Icon size={iconSize} /> : null}
      {children}
    </button>
  );
});
