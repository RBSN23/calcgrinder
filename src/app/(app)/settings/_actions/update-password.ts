'use server';

import { createClient as createPlainClient } from '@supabase/supabase-js';

import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

import { updatePasswordSchema } from './schemas';

type Raw = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type UpdatePasswordResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<
        Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>
      >;
    };

export async function updatePasswordAction(
  raw: Raw,
): Promise<UpdatePasswordResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== 'approved') {
    return { ok: false, error: "Couldn't update — try again." };
  }

  const parsed = updatePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<
      Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>
    > = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (
        (key === 'currentPassword' ||
          key === 'newPassword' ||
          key === 'confirmPassword') &&
        !fieldErrors[key]
      ) {
        fieldErrors[key] = issue.message;
      }
    }
    const firstError =
      parsed.error.issues[0]?.message ?? 'Check your inputs.';
    return { ok: false, error: firstError, fieldErrors };
  }

  const { currentPassword, newPassword } = parsed.data;

  // Re-auth check: use a short-lived non-persisting client so the user's
  // active session cookie isn't rewritten by the verification sign-in.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    return { ok: false, error: "Couldn't update — try again." };
  }
  const verifier = createPlainClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: reauthError } = await verifier.auth.signInWithPassword({
    email: current.user.email,
    password: currentPassword,
  });

  if (reauthError) {
    return {
      ok: false,
      error: 'Current password is incorrect.',
      fieldErrors: { currentPassword: 'Current password is incorrect.' },
    };
  }

  // Re-auth succeeded — now rotate the password on the session-bound
  // client. This writes a new session cookie so the user stays signed in.
  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    const status = (updateError as { status?: number }).status;
    if (status === 429) {
      return {
        ok: false,
        error: updateError.message || 'Too many attempts. Try again shortly.',
      };
    }
    return {
      ok: false,
      error: updateError.message || "Couldn't update — try again.",
      fieldErrors: {
        newPassword: updateError.message || "Couldn't update — try again.",
      },
    };
  }

  return { ok: true };
}
