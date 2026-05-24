'use server';

import { revalidatePath } from 'next/cache';

import { appUrl } from '@/lib/auth/app-url';
import { clearPendingEmailChange } from '@/lib/auth/email-change';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { createClient } from '@/lib/supabase/server';

import { updateEmailSchema } from './schemas';
import type { ActionResult } from './types';

export async function updateEmailAction(
  rawEmail: string,
): Promise<ActionResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== 'approved') {
    return { ok: false, error: "Couldn't save — try again." };
  }

  const parsed = updateEmailSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Enter a valid email address.',
    };
  }

  const newEmail = parsed.data.email.toLowerCase();
  const currentEmail = (current.user.email ?? '').toLowerCase();

  // No-op when the user submits their existing email.
  if (newEmail === currentEmail) {
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: appUrl('/auth/confirm?type=email_change') },
  );

  if (error) {
    const code = (error as { code?: string }).code;
    const message = error.message ?? '';
    if (
      code === 'email_exists' ||
      /already (registered|exists|in use)/i.test(message)
    ) {
      return {
        ok: false,
        error: 'An account with this email already exists.',
      };
    }
    if (/invalid/i.test(message)) {
      return { ok: false, error: 'Enter a valid email address.' };
    }
    console.error('updateEmailAction failed', error);
    return { ok: false, error: "Couldn't update — try again." };
  }

  revalidatePath('/settings');
  return { ok: true };
}

/**
 * Cancel a pending email change. Clears the Supabase Auth fields that
 * track the in-flight change without emitting an additional email to
 * the original address.
 */
export async function cancelEmailChangeAction(): Promise<ActionResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== 'approved') {
    return { ok: false, error: "Couldn't update — try again." };
  }

  try {
    await clearPendingEmailChange(current.user.id);
  } catch (err) {
    console.error('cancelEmailChangeAction failed', err);
    return { ok: false, error: "Couldn't update — try again." };
  }

  revalidatePath('/settings');
  return { ok: true };
}
