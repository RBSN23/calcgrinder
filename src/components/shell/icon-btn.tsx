// PROJ-4 — IconBtn (chrome primitive ported from docs/design/chrome.jsx).
// Square 28px icon-only button. Used by future chrome surfaces; shipped
// now so the chrome design language lives in one place.

import * as React from 'react';

import type { IconName } from './icons';
import { Icons } from './icons';

export interface IconBtnProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  ariaLabel: string;
  size?: number;
  active?: boolean;
}

export const IconBtn = React.forwardRef<HTMLButtonElement, IconBtnProps>(function IconBtn(
  { icon, ariaLabel, size = 14, active = false, className, ...rest },
  ref,
) {
  const Icon = Icons[icon];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
        active
          ? 'border-cg-border bg-cg-surface-2 text-cg-text'
          : 'border-transparent bg-transparent text-cg-text-muted hover:text-cg-text'
      } ${className ?? ''}`}
      {...rest}
    >
      <Icon size={size} />
    </button>
  );
});
