'use client';

import { useActionState } from 'react';

import {
  AuthDivider,
  AuthErrorBanner,
  AuthField,
  AuthFootLine,
  AuthHelpText,
  AuthInput,
  AuthLink,
  AuthSubmit,
} from '@/components/auth';
import { initialFormState } from '@/lib/auth/form-state';

import { signupAction } from './actions';

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
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

      <AuthField label="Name" htmlFor="signup-name" hint={state.fieldErrors?.name}>
        <AuthInput
          id="signup-name"
          name="name"
          autoComplete="name"
          required
          defaultValue={state.values?.name ?? ''}
          error={Boolean(state.fieldErrors?.name)}
        />
      </AuthField>

      <AuthField
        label="Email"
        htmlFor="signup-email"
        hint={state.fieldErrors?.email}
      >
        <AuthInput
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ''}
          error={Boolean(state.fieldErrors?.email)}
        />
      </AuthField>

      <AuthField
        label="Password"
        htmlFor="signup-password"
        hint={state.fieldErrors?.password}
      >
        <AuthInput
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={Boolean(state.fieldErrors?.password)}
        />
      </AuthField>

      <AuthSubmit pendingLabel="Requesting access…">Request access</AuthSubmit>

      <AuthHelpText>
        Calcgrinder is invite-only. The admin will review your request and
        you&apos;ll get an email when approved.
      </AuthHelpText>

      <AuthDivider />

      <AuthFootLine>
        Already have an account?{' '}
        <AuthLink href="/auth/login" strong>
          Sign in
        </AuthLink>
      </AuthFootLine>
    </form>
  );
}
