'use server';

import { revalidatePath } from 'next/cache';

import { APP_URL } from '@/lib/auth/app-url';
import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { randomToken } from '@/lib/auth/token';
import { sendMail } from '@/lib/email/send';
import { accountDeletionConfirmation } from '@/lib/email/templates';
import { createAdminClient } from '@/lib/supabase/admin';

import type { ActionResult } from './types';

const RETENTION_DAYS = Number(process.env.RETENTION_PERIOD_DAYS) || 30;

function recipientGreeting(name: string | null): string {
  if (!name) return 'there';
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'there';
}

/**
 * PROJ-14 — Initial "Send deletion link" action.
 *
 * Refuses sysadmin requests with HTTP 403-equivalent semantics.
 * UPSERTs a row into `account_deletion_requests` (one active row per
 * user) with a fresh token, then sends the confirmation email. If the
 * email fails, the upserted row is rolled back so the UI doesn't enter
 * the pending variant.
 */
export async function requestDeletionAction(): Promise<ActionResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== 'approved') {
    return { ok: false, error: "Couldn't send — try again." };
  }
  if (current.profile.role === 'sysadmin') {
    return {
      ok: false,
      error: 'sysadmin_self_delete_forbidden',
      message: "Sysadmin accounts can't be deleted from Settings.",
    };
  }

  const admin = createAdminClient();
  const token = randomToken();

  const { data: upserted, error: upsertErr } = await admin
    .from('account_deletion_requests')
    .upsert(
      {
        user_id: current.user.id,
        token,
        consumed_at: null,
        cancelled_at: null,
      },
      { onConflict: 'user_id' },
    )
    .select('id')
    .single();

  if (upsertErr || !upserted) {
    console.error('requestDeletionAction: upsert failed', upsertErr);
    return { ok: false, error: "Couldn't send — try again." };
  }

  try {
    const { subject, text } = accountDeletionConfirmation({
      recipientName: recipientGreeting(current.profile.name),
      confirmDeletionUrl: `${APP_URL}/auth/account/${token}/confirm-delete`,
      retentionDays: RETENTION_DAYS,
    });
    await sendMail({ to: current.user.email, subject, text });
  } catch (err) {
    console.error('requestDeletionAction: sendMail failed', err);
    // Roll back the row so the UI doesn't render the pending state.
    await admin
      .from('account_deletion_requests')
      .delete()
      .eq('id', upserted.id);
    return {
      ok: false,
      error: "Couldn't send the confirmation email — try again.",
    };
  }

  revalidatePath('/settings');
  return { ok: true };
}

/**
 * Re-send the same un-consumed deletion link (no new token, same row).
 */
export async function resendDeletionAction(): Promise<ActionResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== 'approved') {
    return { ok: false, error: "Couldn't send — try again." };
  }
  if (current.profile.role === 'sysadmin') {
    return {
      ok: false,
      error: 'sysadmin_self_delete_forbidden',
      message: "Sysadmin accounts can't be deleted from Settings.",
    };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('account_deletion_requests')
    .select('token, consumed_at, cancelled_at')
    .eq('user_id', current.user.id)
    .maybeSingle();

  if (error || !row || row.consumed_at || row.cancelled_at) {
    return {
      ok: false,
      error: 'No pending deletion request to resend.',
    };
  }

  try {
    const { subject, text } = accountDeletionConfirmation({
      recipientName: recipientGreeting(current.profile.name),
      confirmDeletionUrl: `${APP_URL}/auth/account/${row.token}/confirm-delete`,
      retentionDays: RETENTION_DAYS,
    });
    await sendMail({ to: current.user.email, subject, text });
  } catch (err) {
    console.error('resendDeletionAction: sendMail failed', err);
    return { ok: false, error: "Couldn't resend — try again." };
  }

  return { ok: true };
}

/**
 * Cancel a not-yet-clicked deletion request (Danger-zone banner). After
 * the user has clicked the email link, this action is unreachable — the
 * user is locked out of /settings and uses /auth/cancel-deletion instead.
 */
export async function cancelPendingDeletionAction(): Promise<ActionResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== 'approved') {
    return { ok: false, error: "Couldn't cancel — try again." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('account_deletion_requests')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('user_id', current.user.id)
    .is('consumed_at', null)
    .is('cancelled_at', null);

  if (error) {
    console.error('cancelPendingDeletionAction failed', error);
    return { ok: false, error: "Couldn't cancel — try again." };
  }

  revalidatePath('/settings');
  return { ok: true };
}
