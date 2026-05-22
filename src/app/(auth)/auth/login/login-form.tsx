'use client';

import { useActionState } from 'react';

import {
  AuthDivider,
  AuthErrorBanner,
  AuthField,
  AuthFootLine,
  AuthInput,
  AuthLink,
  AuthSubmit,
} from '@/components/auth';
import { initialFormState } from '@/lib/auth/form-state';

import { loginAction } from './actions';

type Props = {
  nextPath: string;
};

export function LoginForm({ nextPath }: Props) {
  const [state, formAction] = useActionState(loginAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={nextPath} />

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

      <AuthField label="Email" htmlFor="login-email" hint={state.fieldErrors?.email}>
        <AuthInput
          id="login-email"
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
        htmlFor="login-password"
        hint={state.fieldErrors?.password}
      >
        <AuthInput
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={Boolean(state.fieldErrors?.password)}
        />
      </AuthField>

      <AuthSubmit pendingLabel="Signing in…">Sign in</AuthSubmit>

      <div className="-mt-1 text-center text-[13px] text-muted-foreground">
        <AuthLink href="/auth/forgot-password">Forgot password?</AuthLink>
      </div>

      <AuthDivider />

      <AuthFootLine>
        No account yet?{' '}
        <AuthLink href="/auth/signup" strong>
          Sign up
        </AuthLink>
      </AuthFootLine>
    </form>
  );
}
