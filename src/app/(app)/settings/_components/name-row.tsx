'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { updateNameAction } from '../_actions/update-name';

type Caption =
  | { kind: 'none' }
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string };

const AUTO_DISMISS_MS = 3000;

export function NameRow({ initialName }: { initialName: string | null }) {
  const [value, setValue] = React.useState(initialName ?? '');
  const [caption, setCaption] = React.useState<Caption>({ kind: 'none' });
  const [pending, startTransition] = React.useTransition();
  const dismissTimer = React.useRef<number | undefined>(undefined);
  const lastSaved = React.useRef<string>(initialName ?? '');

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

  function handleSave() {
    if (pending) return;
    const trimmed = value.trim();
    if (trimmed === lastSaved.current) return;

    startTransition(async () => {
      const result = await updateNameAction(value);
      if (result.ok) {
        lastSaved.current = trimmed;
        setCaption({ kind: 'success', text: result.message ?? 'Saved' });
        scheduleDismiss();
      } else {
        setCaption({ kind: 'error', text: result.error });
      }
    });
  }

  const isError = caption.kind === 'error';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="settings-name" className="text-sm font-medium text-cg-text">
          Name
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
      <Input
        id="settings-name"
        name="name"
        type="text"
        autoComplete="name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        aria-invalid={isError || undefined}
        disabled={pending}
        className={cn(isError && 'border-cg-danger focus-visible:ring-cg-danger')}
        maxLength={120}
      />
      <p className="text-xs leading-5 text-cg-text-muted">
        Shown on your account menu.
      </p>
    </div>
  );
}
