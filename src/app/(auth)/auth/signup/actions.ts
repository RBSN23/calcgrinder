'use server';

import { redirect } from 'next/navigation';

import { APP_URL, appUrl } from '@/lib/auth/app-url';
import { type FormState } from '@/lib/auth/form-state';
import { randomToken } from '@/lib/auth/token';
import { sendMail } from '@/lib/email/send';
import { signupNotification } from '@/lib/email/templates';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { signupSchema } from './schema';

/**
 * PROJ-3 signup server action.
 *
 * Flow:
 *   1. Validate name/email/password (caller-side Zod, PROJ-2 L1 mitigation).
 *   2. Reject if `auth.users` already has the email (silent — no enumeration
 *      diff vs. login surface is intentional per PRD).
 *   3. Call `supabase.auth.signUp()` so Supabase Auth's "Confirm signup"
 *      template fires (PROJ-2 wiring).
 *   4. Insert a `signup_approvals` row with a fresh 32-byte token.
 *   5. Send the sysadmin notification mail. SMTP failure does NOT roll
 *      back the signup — dashboard is source of truth.
 *   6. Redirect to /auth/sent-confirmation?type=signup.
 */
export async function signupAction(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      fieldErrors,
      values: { name: raw.name, email: raw.email },
    };
  }

  const { name, email, password } = parsed.data;
  const admin = createAdminClient();
  const supabase = await createClient();

  // Pre-flight: detect existing email so the user gets a friendly error
  // banner instead of the Supabase-generated 422 with leaked details.
  // RLS denies anon SELECT on profiles, so use the admin client.
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      error: 'An account with this email already exists.',
      errorLink: { href: '/auth/login', label: 'Sign in' },
      values: { name, email },
    };
  }

  // Trigger the Supabase Auth signup (sends verification email).
  // The handle_new_user trigger fires the profiles INSERT atomically.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: appUrl('/auth/confirm?next=/auth/waiting-for-approval'),
      data: { name },
    },
  });

  if (signUpError) {
    const code = (signUpError as { code?: string }).code;
    const message = signUpError.message ?? 'Signup failed';

    if (code === 'user_already_exists' || /already registered/i.test(message)) {
      return {
        ok: false,
        error: 'An account with this email already exists.',
        errorLink: { href: '/auth/login', label: 'Sign in' },
        values: { name, email },
      };
    }
    return {
      ok: false,
      error: message,
      values: { name, email },
    };
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    return {
      ok: false,
      error: 'Signup failed. Try again.',
      values: { name, email },
    };
  }

  // Make sure the trigger-created profile carries the submitted name
  // (the trigger uses raw_user_meta_data.name when present).
  await admin
    .from('profiles')
    .update({ name })
    .eq('id', userId);

  const token = randomToken();
  const { error: approvalError } = await admin
    .from('signup_approvals')
    .insert({ user_id: userId, token });

  if (approvalError) {
    console.error('signup_approvals insert failed', {
      userId,
      message: approvalError.message,
    });
    return {
      ok: false,
      error: 'Something went wrong creating your account. Try again.',
      values: { name, email },
    };
  }

  const notificationEmail = process.env.SYSADMIN_NOTIFICATION_EMAIL;
  if (!notificationEmail) {
    console.error(
      'SYSADMIN_NOTIFICATION_EMAIL is not configured — signup proceeded but no notification will be sent',
      { userId },
    );
  } else {
    try {
      const { subject, text } = signupNotification({
        newUserEmail: email,
        newUserName: name,
        approveUrl: `${APP_URL}/auth/admin/${token}/approve`,
        declineUrl: `${APP_URL}/auth/admin/${token}/decline`,
      });
      await sendMail({ to: notificationEmail, subject, text });
    } catch (err) {
      console.error('signupNotification send failed', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  redirect(`/auth/sent-confirmation?type=signup&email=${encodeURIComponent(email)}`);
}
