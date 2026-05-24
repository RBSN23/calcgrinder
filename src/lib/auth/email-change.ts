import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Clear the in-flight Supabase Auth email-change state for a user.
 *
 * Per PROJ-14 Tech Design: a service-role mutation on `auth.users` is
 * the only way to invalidate a pending email change without emitting a
 * notification email to the original address (which the SDK-friendly
 * alternative `updateUserById({ email: currentEmail })` would do).
 *
 * The GoTrue admin REST endpoint (`PUT /auth/v1/admin/users/<id>`) is
 * NOT a viable path: its `AdminUserAttributes` surface (email, phone,
 * password, email_confirm, phone_confirm, user_metadata, app_metadata,
 * ban_duration, role) does not include any of the `email_change_*`
 * fields — passing them in the body is silently ignored by GoTrue.
 *
 * Since `supabase-js` exposes no direct SQL execution path, the only
 * way to issue a targeted raw UPDATE on `auth.users` from the
 * application is via a SECURITY DEFINER Postgres function installed by
 * the PROJ-14 migration. This helper is that function's single named
 * call-site so reviewers can grep for the raw-`auth.users` touch-point.
 *
 * The RPC clears all five canonical fields involved in an in-flight
 * email change:
 *   - `email_change`              (the pending target address)
 *   - `email_change_token_new`    (the OTP hash sent to the new address)
 *   - `email_change_token_current`(the OTP hash sent to the current addr;
 *                                  Supabase mints this when "Secure email
 *                                  change" is enabled)
 *   - `email_change_sent_at`      (timestamp of the change attempt)
 *   - `email_change_confirm_status` (integer counter; reset to 0)
 *
 * @throws on any RPC error.
 */
export async function clearPendingEmailChange(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('fn_clear_pending_email_change', {
    p_user_id: userId,
  });
  if (error) {
    throw new Error(`clearPendingEmailChange: ${error.message}`);
  }
}
