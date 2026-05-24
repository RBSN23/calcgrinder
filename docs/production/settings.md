# Settings page (PROJ-14)

This guide walks the deployer through what PROJ-14 ships,
how to operate it, and how to recover from accidental state
introduced via direct DB ops. Read this once before
running `supabase db push` for the
`20260528000000_settings_page.sql` migration in production.

---

## 1. What's on the page

`/settings` renders inside the existing `(app)` AppShell
(behind the same approved-user route gate as `/dashboard`)
and is laid out as a single-column max-w-640 page with four
sections, separated by 1-px dividers:

1. **Profile** — inline-edit name + email (on blur);
   read-only Role row (Sysadmin pill when applicable).
2. **Security** — current password / new password / confirm
   new password, with a re-auth check on the server before
   the password is rotated.
3. **Preferences** — App theme (Light / Dark / System,
   shared `next-themes` localStorage key with the avatar
   popover); Default calculator theme (dropdown over the 8
   shipped themes; persisted to
   `profiles.default_calculator_theme`).
4. **Danger zone** — Delete-account flow with a
   confirmation email + grace window. Variant changes when
   a deletion request is pending; sysadmin accounts see a
   permanently disabled button.

The avatar popover continues to expose the theme toggle —
both surfaces read and write the same `next-themes` key, so
they stay in sync with zero divergence.

## 2. Email-change flow

The Email row uses Supabase Auth's native "Change Email
Address" flow:

- On blur, the server action calls
  `supabase.auth.updateUser({ email: <new> })`. Supabase
  records `email_change_token_new` on `auth.users` and
  sends the **Change Email Address** template (installed
  by PROJ-2) to the **new** address.
- The Settings page enters the "pending" variant: the
  input snaps back to the **old** email with a yellow
  `Pending` pill; helper text reads "A verification link
  was sent to `<new-email>`. Your email will change once
  you confirm. Cancel change."
- When the user clicks the link, they land at
  `/auth/confirm?token_hash=…&type=email_change` —
  PROJ-3's existing handler, now with the dormant
  `email_change` branch activated. On success, Supabase
  swaps `auth.users.email` to the new value and the user
  is redirected to `/auth/email-confirmed`.
- If the user clicks "Cancel change" before the link is
  confirmed, the server action invokes
  `clearPendingEmailChange()`
  (`src/lib/auth/email-change.ts`) which calls the
  SECURITY DEFINER RPC `fn_clear_pending_email_change` —
  the **only** raw `auth.users` write in the codebase
  outside Supabase's managed paths. The old verification
  link is rendered invalid.

There is **no "Resend link" affordance** for email change.
Supabase's GoTrue does not expose a public resend-email-
change endpoint, and re-calling `updateUser({ email })`
with the same address invalidates the prior token. The
helper text instructs the user to cancel and start over if
the link didn't arrive. The standalone "Account-deletion"
banner does have a Resend link — they're different flows
(account-deletion stores the token in our own table; email
change stores it inside `auth.users`).

If the deployer needs to force-clear a stuck pending email
change for a user (e.g. they're locked out and the support
inbox is the new address that's bouncing), the manual
recovery is:

```sql
SELECT public.fn_clear_pending_email_change(
  (SELECT id FROM auth.users WHERE email = 'stuck-user@example.com')
);
```

That clears the five email-change fields atomically.
EXECUTE on the function is granted only to `service_role`,
so it must be run from the Supabase Cloud Dashboard SQL
Editor (which runs as `service_role`).

## 3. Account deletion + grace window

The Danger-zone flow:

1. User clicks "Delete account" → confirmation dialog
   explains the grace-window mechanic.
2. User clicks "Send deletion link" → server action upserts
   a row in `account_deletion_requests` (43-char base64url
   token; `consumed_at` / `cancelled_at` cleared on
   re-request) and calls `sendMail` with the existing
   `accountDeletionConfirmation` template (installed by
   PROJ-2). Email is sent to the user's current address;
   the link target is `<APP_URL>/auth/account/<token>/confirm-delete`.
3. The page re-renders in the "pending" variant: yellow
   banner with **Resend link** + **Cancel deletion**
   actions.
4. User clicks the link in their inbox → the route handler
   transactionally writes
   `profiles.status='pending_deletion'`,
   `profiles.pending_deletion_at=NOW()`,
   `account_deletion_requests.consumed_at=NOW()`. The
   landing reads "Deletion scheduled — sign back in to
   cancel".
5. **Grace window:** for `RETENTION_PERIOD_DAYS` days
   (default 30), the user can sign back in at `/auth/login`
   with their normal credentials. The login action detects
   the `pending_deletion` status and redirects to
   `/auth/cancel-deletion`, which surfaces a one-button
   "Cancel deletion & keep account" form. Submitting it
   flips `status` back to `approved`, clears
   `pending_deletion_at`, and stamps `cancelled_at` on the
   relevant `account_deletion_requests` row.
6. **Hard purge:** the daily cron at `/api/cron/purge`
   selects all profiles where `status='pending_deletion'`
   AND `pending_deletion_at < NOW() -
   make_interval(days => RETENTION_PERIOD_DAYS)`, and calls
   `supabaseAdmin.auth.admin.deleteUser(id)` for each. The
   existing FK CASCADE chains (auth.users → profiles →
   calculators → sections / cells / scenarios → account_
   deletion_requests) clean everything up.

Visitor behaviour during the grace window: every calculator
owned by a `pending_deletion` user becomes invisible at
`/c/<token>` — the same UX as a per-calculator
soft-delete. The visitor sees no information that
distinguishes "soft-deleted calc" from "owner in grace
window".

### Token shape & posture

- 43-char base64url from
  `crypto.randomBytes(32).toString('base64url')`.
- Tokens never expire — the grace window is the only
  time-bound mechanic.
- One active row per user (`UNIQUE(user_id)`). Re-requests
  UPSERT over the existing row and invalidate the prior
  link.
- RLS is enabled on `account_deletion_requests` with **zero
  policies** — service-role-only posture, mirroring
  `signup_approvals`. The handler reads/writes the table
  exclusively via the admin client.

### Sysadmin self-delete

Refused at three layers:

1. UI: button is permanently disabled with explanatory
   copy.
2. Danger-zone dialog short-circuits — sysadmins never see
   the confirmation sheet.
3. Server action `requestDeletionAction` returns
   `{ ok: false, error: 'sysadmin_self_delete_forbidden', … }`
   for any caller whose role is `sysadmin` (defence in
   depth; URL-crafting attempts get HTTP-200-with-error,
   no DB write).

If you need to delete a sysadmin's account in v1, do it
directly in the Supabase Cloud Dashboard:

```sql
-- 1. Confirm you have at least one other sysadmin first.
SELECT email FROM public.profiles
 WHERE role = 'sysadmin' AND status = 'approved';

-- 2. Delete the auth user. Cascade handles the rest.
DELETE FROM auth.users
 WHERE id = (SELECT id FROM public.profiles WHERE email = 'former-admin@example.com');
```

PROJ-19 (sysadmin moderation) will eventually expose this
as a UI button.

## 4. Database & RLS

The PROJ-14 migration (`supabase/migrations/20260528000000_settings_page.sql`)
applies these changes:

| # | Object | Change |
|---|--------|--------|
| 1 | `profiles.default_calculator_theme` | New nullable TEXT column. NULL means "use the system default at create time". |
| 2 | `profiles.status` CHECK | Extended to allow `'pending_deletion'` (was 3 values, now 4). |
| 3 | `account_deletion_requests` | New table — RLS ON + zero policies; `UNIQUE(user_id)`; FK to `auth.users(id) ON DELETE CASCADE`. |
| 4 | `fn_clear_pending_email_change(p_user_id UUID)` | SECURITY DEFINER, search_path pinned to `''`, EXECUTE granted only to `service_role`. |
| 5 | `fn_get_public_calculator` + `fn_get_scenario_by_share_token` | Re-defined with an inner JOIN to `profiles` requiring `status = 'approved'`. |

After `supabase db push` lands:

```
npx supabase gen types typescript --linked > src/lib/supabase/types.ts
```

…then re-deploy. The frontend type widening for
`account_deletion_requests` and `default_calculator_theme`
must be backed by the regenerated types.

`profiles.pending_deletion_at` was already in PROJ-1's init
migration — PROJ-14 is the first feature that actually
writes to it.

GRANTs on `profiles` were intentionally **not** extended
for `default_calculator_theme`. All Settings server actions
use the admin client (which bypasses RLS and column
GRANTs); authenticated users still have only
`GRANT UPDATE (name)`. This is the least-privilege posture
for the authenticated role.

## 5. Cron — daily purge

PROJ-13 already shipped `/api/cron/purge` for calculator
soft-deletes. PROJ-14 extends the **same endpoint** with a
second pass that hard-purges expired `pending_deletion`
accounts. The `vercel.json` cron entry is unchanged — one
job runs once per day at `0 4 * * *` (anywhere between
04:00 and 04:59 UTC on the Hobby plan; acceptable for
daily background work).

Auth posture is unchanged from PROJ-13: the handler
requires `Authorization: Bearer <CRON_SECRET>` with a
`timingSafeEqual` comparison. Wrong / missing bearer → 401
with no work performed. Vercel injects the header
automatically for declared crons.

Response shape after PROJ-14:

```json
{
  "ok": true,
  "purged": 2,                  // legacy key, equals purged_calculators
  "purged_calculators": 2,
  "purged_accounts": 1,
  "retention_days": 30
}
```

Per-user `deleteUser` failures are logged and skipped —
one bad row doesn't poison the batch (next cron tick
retries the survivors).

Manual invocation for verification (replace
`<CRON_SECRET>`):

```bash
curl -i -H "Authorization: Bearer <CRON_SECRET>" \
  https://<your-domain>/api/cron/purge
```

## 6. Environment variables

PROJ-14 adds **no new env vars**. The feature reuses:

| Var | Owner | Purpose |
|-----|-------|---------|
| `RETENTION_PERIOD_DAYS` | PROJ-13 (shared) | Days a `pending_deletion` profile remains recoverable. Default 30. Same value drives calculator soft-delete and account hard-purge. |
| `CRON_SECRET` | PROJ-13 (shared) | Bearer credential for `/api/cron/purge`. |
| `APP_URL` | PROJ-3 (shared) | Base URL for absolute links in the account-deletion confirmation email. |
| `CYON_SMTP_*`, `EMAIL_FROM` | PROJ-2 (shared) | SMTP transport for the deletion-confirmation email. |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` | PROJ-1 (shared) | Settings actions use the admin client. |

If the deployer changes `RETENTION_PERIOD_DAYS` mid-flight
(e.g. 30 → 7), the cron reads the env on each invocation;
the next cron tick uses the new value, which may purge
users whose prior expectation was longer. Same caveat as
PROJ-13's calculator soft-delete window.

## 7. Recovery from accidental state

### "I set someone to pending_deletion via a manual UPDATE"

Revert the status and clear the timestamp:

```sql
UPDATE public.profiles
   SET status = 'approved',
       pending_deletion_at = NULL
 WHERE email = 'the-affected-user@example.com';

-- Also clear any lingering active deletion request:
UPDATE public.account_deletion_requests
   SET cancelled_at = NOW()
 WHERE user_id = (SELECT id FROM public.profiles
                   WHERE email = 'the-affected-user@example.com')
   AND cancelled_at IS NULL;
```

After this, the user can log in normally; the route gate
sees `status='approved'` and lets them through.

### "I want to manually trigger the cron"

See § 5. The cron is idempotent — running it twice in the
same minute is safe.

### "I want to confirm deletion will fire tomorrow for a specific user"

```sql
SELECT email, status, pending_deletion_at,
       pending_deletion_at + make_interval(days => 30) AS scheduled_purge_at,
       NOW() > pending_deletion_at + make_interval(days => 30) AS expired
  FROM public.profiles
 WHERE email = 'the-affected-user@example.com';
```

(Replace `30` with the current `RETENTION_PERIOD_DAYS` if
you've changed it.)

### "A user's confirm-delete link returns 404"

Either the token has been consumed and the request was
later cancelled (in which case the row is gone — FK
CASCADE), or the token never existed. Check:

```sql
SELECT user_id, consumed_at, cancelled_at
  FROM public.account_deletion_requests
 WHERE token = '<token from the URL>';
```

If the row is missing, the user must request deletion
again from Settings. There's no way to recover a stale
token — the system treats stale/unknown the same to avoid
information leaks.

## 8. Troubleshooting

### "The Settings page renders a 500 on the Danger zone"

Most likely the PROJ-14 migration hasn't been applied to
the linked Cloud project. Confirm:

```sql
SELECT 1 FROM pg_constraint
 WHERE conname = 'profiles_status_check'
   AND pg_get_constraintdef(oid) ILIKE '%pending_deletion%';

SELECT 1 FROM pg_class WHERE relname = 'account_deletion_requests';
```

Both should return one row. If either is empty, run
`supabase db push` and regenerate types.

### "User reports they confirmed the email change but Settings still shows the old email"

The most common cause is reading the page from a different
session (the verification link doesn't update the session
of the original device automatically — Supabase rotates the
auth.users.email but the user's current JWT still encodes
the old one until refresh). Have the user sign out and
back in.

### "Cron logs show `purged_accounts: 0` but I expect a purge today"

Check the profile's `pending_deletion_at`. The cron filter
is strict (`< NOW() - make_interval(days => :retention)`),
so a request from exactly `RETENTION_PERIOD_DAYS` days ago
won't purge until the next tick. With the daily cron at
`0 4 * * *` UTC, expect day-N+1 purges, not day-N.

---

PROJ-14 is the final P0 feature. With it shipped, the
end-to-end loop for the v1 single-author audience is
complete: signup → approval → build → publish → share →
scenarios → trash → account management.
