'use server';

import { redirect } from 'next/navigation';

import { getCurrentProfile } from '@/lib/auth/getCurrentProfile';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PROJ-14 — Cancel deletion server action.
 *
 * Re-reads the current profile inside the action (the page-level read is
 * not authoritative for mutations). If the user is no longer in the
 * grace window — e.g. the cron has already purged them — the action
 * silently redirects them out without writing anything.
 *
 * Mutation:
 *   - `profiles.status = 'approved'`
 *   - `profiles.pending_deletion_at = NULL`
 *   - `account_deletion_requests.cancelled_at = NOW()` (most recent
 *     consumed row — defence in depth alongside the profile mutation).
 */
export async function cancelDeletionAction(): Promise<void> {
  const current = await getCurrentProfile();
  if (!current) {
    redirect('/auth/login');
  }
  if (current.profile.status !== 'pending_deletion') {
    redirect('/dashboard');
  }

  const admin = createAdminClient();

  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      status: 'approved',
      pending_deletion_at: null,
    })
    .eq('id', current.user.id);

  if (profileErr) {
    console.error('cancelDeletionAction: profile revert failed', profileErr);
    return;
  }

  await admin
    .from('account_deletion_requests')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('user_id', current.user.id)
    .is('cancelled_at', null);

  redirect('/dashboard?cancelled_deletion=1');
}
