'use client';

import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { updateDefaultCalculatorThemeAction } from '../_actions/update-default-calculator-theme';

type Caption =
  | { kind: 'none' }
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string };

const AUTO_DISMISS_MS = 3000;

export interface ThemeOption {
  id: string;
  displayName: string;
}

interface Props {
  options: ThemeOption[];
  currentValue: string;
}

export function DefaultCalcThemeRow({ options, currentValue }: Props) {
  const [value, setValue] = React.useState(currentValue);
  const [caption, setCaption] = React.useState<Caption>({ kind: 'none' });
  const [pending, startTransition] = React.useTransition();
  const dismissTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    return () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    };
  }, []);

  function scheduleDismiss() {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    dismissTimer.current = window.setTimeout(() => {
      setCaption({ kind: 'none' });
    }, AUTO_DISMISS_MS);
  }

  function handleChange(next: string) {
    if (next === value || pending) return;
    const previous = value;
    setValue(next);

    startTransition(async () => {
      const result = await updateDefaultCalculatorThemeAction(next);
      if (result.ok) {
        setCaption({ kind: 'success', text: result.message ?? 'Saved' });
        scheduleDismiss();
      } else {
        setValue(previous);
        setCaption({ kind: 'error', text: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor="settings-default-theme"
          className="text-sm font-medium text-cg-text"
        >
          Default calculator theme for new calculators
        </label>
        {caption.kind !== 'none' ? (
          <span
            className={cn(
              'text-xs leading-5',
              caption.kind === 'success'
                ? 'text-cg-accent-text'
                : 'text-cg-danger-text',
            )}
            role={caption.kind === 'error' ? 'alert' : undefined}
          >
            {caption.text}
          </span>
        ) : null}
      </div>
      <Select value={value} onValueChange={handleChange} disabled={pending}>
        <SelectTrigger
          id="settings-default-theme"
          className="w-full max-w-xs bg-cg-surface"
        >
          <SelectValue placeholder="Pick a theme" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs leading-5 text-cg-text-muted">
        Applied to any new calculator you create. Existing calculators keep
        their current theme.
      </p>
    </div>
  );
}
