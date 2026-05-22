'use server';

import { redirect } from 'next/navigation';

import { appUrl } from '@/lib/auth/app-url';
import { type FormState } from '@/lib/auth/form-state';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { forgotPasswordSchema } from './schema';

/**
 * PROJ-3 forgot-password server action.
 *
 * Per the PRD, enumeration defense is explicitly NOT a v1 goal — we
 * surface the "no account exists" distinction so the user can self-
 * correct without contacting support. Otherwise delegate to Supabase
 * Auth's native reset flow.
 */
export async function forgotPasswordAction(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { email: String(formData.get('email') ?? '') };

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors, values: { email: raw.email } };
  }

  const { email } = parsed.data;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    return {
      ok: false,
      error: 'No account exists with this email.',
      errorLink: { href: '/auth/signup', label: 'Sign up' },
      values: { email },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl('/auth/confirm?next=/auth/reset-password'),
  });

  if (error) {
    return {
      ok: false,
      error: error.message ?? 'Could not send reset link.',
      values: { email },
    };
  }

  redirect(`/auth/sent-confirmation?type=reset&email=${encodeURIComponent(email)}`);
}
