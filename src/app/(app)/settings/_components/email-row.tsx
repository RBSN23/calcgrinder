'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import {
  cancelEmailChangeAction,
  updateEmailAction,
} from '../_actions/update-email';

type Caption =
  | { kind: 'none' }
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string };

const AUTO_DISMISS_MS = 3000;

interface EmailRowProps {
  currentEmail: string;
  pendingEmail: string | null;
}

export function EmailRow({ currentEmail, pendingEmail }: EmailRowProps) {
  const [value, setValue] = React.useState(currentEmail);
  const [caption, setCaption] = React.useState<Caption>({ kind: 'none' });
  const [pending, startTransition] = React.useTransition();
  const dismissTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    setValue(currentEmail);
  }, [currentEmail]);

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
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) return;

    startTransition(async () => {
      const result = await updateEmailAction(value);
      if (result.ok) {
        // Snap the input back to the current (= old) email — the new
        // address is shown in the Pending pill helper text instead.
        // Spec: "the input shows the old email value (not the new one)
        // with the yellow Pending pill suffix".
        setValue(currentEmail);
        if (result.message) {
          setCaption({ kind: 'success', text: result.message });
          scheduleDismiss();
        }
      } else {
        setCaption({ kind: 'error', text: result.error });
        setValue(currentEmail);
      }
    });
  }

  function handleCancelChange() {
    if (pending) return;
    startTransition(async () => {
      const result = await cancelEmailChangeAction();
      if (!result.ok) {
        setCaption({ kind: 'error', text: result.error });
      }
    });
  }

  const isPending = Boolean(pendingEmail);
  const isError = caption.kind === 'error';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor="settings-email"
          className="flex items-center gap-2 text-sm font-medium text-cg-text"
        >
          Email
          {isPending ? <PendingPill /> : null}
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
        id="settings-email"
        name="email"
        type="email"
        autoComplete="email"
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
      />
      {isPending ? (
        <p className="text-xs leading-5 text-cg-text-muted">
          A verification link was sent to{' '}
          <span className="font-medium text-cg-text">{pendingEmail}</span>. Your
          email will change once you confirm. If the link didn&apos;t arrive,{' '}
          <button
            type="button"
            onClick={handleCancelChange}
            disabled={pending}
            className="text-cg-danger underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none disabled:opacity-50"
          >
            cancel the change
          </button>{' '}
          and start over.
        </p>
      ) : (
        <p className="text-xs leading-5 text-cg-text-muted">
          We&apos;ll send a verification link to your new address before
          changing it.
        </p>
      )}
    </div>
  );
}

function PendingPill() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-[2px] text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
      Pending
    </span>
  );
}
