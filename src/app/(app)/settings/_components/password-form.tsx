'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { updatePasswordAction } from '../_actions/update-password';

type FieldErrors = Partial<
  Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>
>;

type Caption =
  | { kind: 'none' }
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string };

const AUTO_DISMISS_MS = 3000;

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setCaption({ kind: 'none' });

    startTransition(async () => {
      const result = await updatePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (result.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setCaption({ kind: 'success', text: 'Password updated.' });
        scheduleDismiss();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setCaption({ kind: 'error', text: result.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <PasswordField
        id="settings-current-password"
        label="Current password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
        error={fieldErrors.currentPassword}
        disabled={pending}
      />
      <PasswordField
        id="settings-new-password"
        label="New password"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        error={fieldErrors.newPassword}
        disabled={pending}
      />
      <PasswordField
        id="settings-confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={fieldErrors.confirmPassword}
        disabled={pending}
      />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {pending ? 'Updating…' : 'Update password'}
        </Button>
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
    </form>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  disabled?: boolean;
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  error,
  disabled,
}: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-cg-text">
          {label}
        </label>
        {error ? (
          <span
            className="text-xs leading-5 text-cg-danger-text"
            role="alert"
          >
            {error}
          </span>
        ) : null}
      </div>
      <Input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        disabled={disabled}
        className={cn(
          error && 'border-cg-danger focus-visible:ring-cg-danger',
        )}
      />
    </div>
  );
}
