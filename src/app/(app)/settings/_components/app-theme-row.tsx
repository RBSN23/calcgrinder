'use client';

import { useTheme } from 'next-themes';
import * as React from 'react';

import { Icons } from '@/components/shell/icons';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Icons.Sun },
  { value: 'dark', label: 'Dark', Icon: Icons.Moon },
  { value: 'system', label: 'System', Icon: Icons.Monitor },
] as const;

export function AppThemeRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col gap-2">
      <span id="settings-app-theme" className="text-sm font-medium text-cg-text">
        App theme
      </span>
      <div
        role="radiogroup"
        aria-labelledby="settings-app-theme"
        className="inline-flex w-full max-w-xs items-center gap-1 rounded-md border border-cg-border bg-cg-surface p-1"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-cg-accent-soft text-cg-accent-text shadow-sm'
                  : 'text-cg-text-muted hover:bg-cg-surface-2 hover:text-cg-text',
              )}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-cg-text-muted">
        Affects the Calcgrinder dashboard, editor and these settings. Synced
        with the theme picker in your account menu.
      </p>
    </div>
  );
}
