import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/types';

/**
 * PROJ-3 — Pure(-ish) business logic for the admin approve/decline
 * click. Decoupled from the Next.js route handler so tests can wire in
 * mocked deps.
 */

export type ApprovalAction = 'approve' | 'decline';

export type ApprovalResult =
  | { result: 'invalid' }
  | {
      result:
        | 'approved'
        | 'declined'
        | 'already-approved'
        | 'already-declined';
      name?: string;
      email?: string;
      date?: string; // ISO date (consumed_at)
      mailError?: boolean;
    };

export type ApprovalDeps = {
  admin: SupabaseClient<Database>;
  sendApprovalEmail: (args: {
    recipientName: string;
    recipientEmail: string;
  }) => Promise<void>;
};

export async function processApproval(input: {
  token: string;
  action: ApprovalAction;
  deps: ApprovalDeps;
}): Promise<ApprovalResult> {
  const { token, action, deps } = input;
  const { admin } = deps;

  // 1. Look up the approval row by token.
  const { data: approval } = await admin
    .from('signup_approvals')
    .select('id, user_id, consumed_at, outcome')
    .eq('token', token)
    .maybeSingle();

  if (!approval) return { result: 'invalid' };

  // 2. Pull the associated profile for name/email (used in the landing).
  const { data: profile } = await admin
    .from('profiles')
    .select('name, email')
    .eq('id', approval.user_id)
    .maybeSingle();

  if (!profile) {
    // user_id references auth.users with ON DELETE CASCADE, and the
    // handle_new_user trigger keeps profiles in sync — a missing profile
    // here means the row was deleted out-of-band. Same UX as an unknown
    // token.
    return { result: 'invalid' };
  }

  // 3. Already consumed? Show the "Already …" landing without writing.
  if (approval.consumed_at) {
    const wasApproved = approval.outcome === 'approved';
    return {
      result: wasApproved ? 'already-approved' : 'already-declined',
      name: profile.name,
      email: profile.email,
      date: approval.consumed_at,
    };
  }

  // 4. Fresh click → consume the row atomically. The WHERE consumed_at
  // IS NULL guard is race-safe: a concurrent click sees zero rows
  // affected and falls through to the already-consumed branch on its
  // next read.
  const outcome: 'approved' | 'declined' =
    action === 'approve' ? 'approved' : 'declined';

  const consumedAt = new Date().toISOString();

  const { data: updatedRows, error: updateErr } = await admin
    .from('signup_approvals')
    .update({ consumed_at: consumedAt, outcome })
    .eq('id', approval.id)
    .is('consumed_at', null)
    .select('id');

  if (updateErr) {
    // DB-level failure — surface as invalid to the user but log for ops.
    console.error('signup_approvals consume failed', {
      token,
      action,
      error: updateErr.message,
    });
    return { result: 'invalid' };
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Lost the race with a concurrent click. Re-read to render the
    // appropriate "Already …" landing.
    const { data: winner } = await admin
      .from('signup_approvals')
      .select('outcome, consumed_at')
      .eq('id', approval.id)
      .maybeSingle();
    const wasApproved = winner?.outcome === 'approved';
    return {
      result: wasApproved ? 'already-approved' : 'already-declined',
      name: profile.name,
      email: profile.email,
      date: winner?.consumed_at ?? consumedAt,
    };
  }

  // 5. Update the profile's status to match the outcome.
  const newStatus = outcome === 'approved' ? 'approved' : 'declined';
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ status: newStatus })
    .eq('id', approval.user_id);

  if (profileErr) {
    console.error('profiles status update failed', {
      userId: approval.user_id,
      newStatus,
      error: profileErr.message,
    });
    // We've already consumed the approval row, so re-clicks won't fix
    // this. Surface the user-facing "approved/declined" landing anyway
    // — the deployer can recover via SQL per docs/production/auth.md.
  }

  // 6. Send the confirmation mail on approve. Decline is silent.
  let mailError = false;
  if (outcome === 'approved') {
    try {
      await deps.sendApprovalEmail({
        recipientName: profile.name,
        recipientEmail: profile.email,
      });
    } catch (err) {
      mailError = true;
      console.error('approvalConfirmation send failed', {
        userId: approval.user_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    result: outcome === 'approved' ? 'approved' : 'declined',
    name: profile.name,
    email: profile.email,
    date: consumedAt,
    mailError: mailError || undefined,
  };
}
