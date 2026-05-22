'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { type FormState } from '@/lib/auth/form-state';
import { loginSchema } from './schema';

/**
 * PROJ-3 login server action.
 *
 * Validates the form server-side, signs in via Supabase Auth, then
 * inspects `profiles.status`:
 *   - approved  → redirect to `next` query param (default /dashboard)
 *   - pending   → redirect to /auth/waiting-for-approval
 *   - declined  → redirect to /auth/waiting-for-approval (silent)
 *
 * Errors are surfaced as inline `FormState` for the page form. The
 * action does not throw — it returns shape that the client form
 * renders via `useActionState`.
 */
export async function loginAction(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };
  const nextPath = String(formData.get('next') ?? '/dashboard');

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      fieldErrors,
      values: { email: raw.email },
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const code = (error as { code?: string }).code;
    const message = error.message ?? 'Sign in failed';

    if (
      code === 'invalid_credentials' ||
      /invalid login credentials/i.test(message)
    ) {
      const { data: probe } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', parsed.data.email)
        .maybeSingle();
      if (!probe) {
        return {
          ok: false,
          error: 'No account exists with this email.',
          errorLink: { href: '/auth/signup', label: 'Sign up' },
          values: { email: parsed.data.email },
        };
      }
      return {
        ok: false,
        error: 'Wrong password.',
        errorLink: { href: '/auth/forgot-password', label: 'Forgot password?' },
        values: { email: parsed.data.email },
      };
    }

    if (code === 'email_not_confirmed' || /confirm/i.test(message)) {
      return {
        ok: false,
        error: 'Please confirm your email first.',
        values: { email: parsed.data.email },
      };
    }

    return {
      ok: false,
      error: message,
      values: { email: parsed.data.email },
    };
  }

  if (!data.session) {
    return {
      ok: false,
      error: 'Sign in failed. Try again.',
      values: { email: parsed.data.email },
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', data.user.id)
    .single();

  const safeNext =
    nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? nextPath
      : '/dashboard';

  if (profile?.status === 'approved') {
    redirect(safeNext);
  }
  redirect('/auth/waiting-for-approval');
}
