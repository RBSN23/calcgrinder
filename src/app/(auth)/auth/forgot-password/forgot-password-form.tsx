'use client';

import { useActionState } from 'react';

import {
  AuthErrorBanner,
  AuthField,
  AuthInput,
  AuthLink,
  AuthMessage,
  AuthSubmit,
} from '@/components/auth';
import { initialFormState } from '@/lib/auth/form-state';

import { forgotPasswordAction } from './actions';

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <AuthMessage title="Reset your password" align="left">
        Enter the email you signed up with. We&apos;ll send you a link to set
        a new password.
      </AuthMessage>

      {state.error && (
        <AuthErrorBanner>
          {state.error}
          {state.errorLink && (
            <>
              {' '}
              <AuthLink href={state.errorLink.href} strong>
                {state.errorLink.label}
              </AuthLink>
            </>
          )}
        </AuthErrorBanner>
      )}

      <AuthField
        label="Email"
        htmlFor="forgot-email"
        hint={state.fieldErrors?.email}
      >
        <AuthInput
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ''}
          error={Boolean(state.fieldErrors?.email)}
        />
      </AuthField>

      <AuthSubmit pendingLabel="Sending…">Send reset link</AuthSubmit>

      <div className="-mt-1 text-center text-[13px] text-muted-foreground">
        <AuthLink href="/auth/login">Back to sign in</AuthLink>
      </div>
    </form>
  );
}
