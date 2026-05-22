'use client';

import { useActionState } from 'react';

import {
  AuthErrorBanner,
  AuthField,
  AuthInput,
  AuthMessage,
  AuthSubmit,
} from '@/components/auth';
import { initialFormState } from '@/lib/auth/form-state';

import { resetPasswordAction } from './actions';

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <AuthMessage title="Set a new password" align="left">
        Choose a new password for your Calcgrinder account.
      </AuthMessage>

      {state.error && <AuthErrorBanner>{state.error}</AuthErrorBanner>}

      <AuthField
        label="New password"
        htmlFor="reset-password"
        hint={
          state.fieldErrors?.password && state.fieldErrors.password.trim()
            ? state.fieldErrors.password
            : undefined
        }
      >
        <AuthInput
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={Boolean(state.fieldErrors?.password)}
        />
      </AuthField>

      <AuthField
        label="Confirm new password"
        htmlFor="reset-confirm-password"
        hint={state.fieldErrors?.confirmPassword}
      >
        <AuthInput
          id="reset-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={Boolean(state.fieldErrors?.confirmPassword)}
        />
      </AuthField>

      <AuthSubmit pendingLabel="Updating…">Set new password</AuthSubmit>
    </form>
  );
}
