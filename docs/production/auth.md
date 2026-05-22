# Authentication & approval (PROJ-3)

This guide walks the deployer through the auth-flow
configuration once PROJ-1 (Supabase infrastructure) and
PROJ-2 (email + transactional templates) are in place.

Follow the sections in order.

---

## 1. Supabase Auth settings

In the Supabase Cloud Dashboard for your project:
**Authentication → Providers → Email**.

- **Confirm email** — keep enabled. PROJ-3 relies on
  `email_confirmed_at` being `NULL` until the user clicks
  the verification link. Login with an unconfirmed email
  fails with Supabase Auth's native "email not confirmed"
  error, which the login surface displays verbatim.
- **Secure email change** — keep enabled (default). PROJ-3
  doesn't expose an email-change UI; PROJ-14 will.
- **Sign-ups** — keep enabled. Approval is layered on top
  of Supabase Auth's signup, not in place of it.
- **Password policy** — recommended: **≥ 8 characters**
  with at least letters + numbers. The default is 6 chars
  which is too lax. Open
  **Authentication → Sign In / Up → Password Strength**
  and raise the minimum. PROJ-3 does **not** re-implement
  the policy; whatever Supabase enforces is surfaced
  verbatim in the signup and reset-password forms.
- **Rate limits** — leave at defaults. PROJ-3 does not add
  custom rate limiting; v1 is invite-only with low signup
  volume.

The three Supabase Auth email templates — **Confirm signup**,
**Reset password**, **Change email** — were installed by
the PROJ-2 setup guide. If you skipped that, return to
[email.md](./email.md) § 4 before continuing.

## 2. `APP_URL` per environment

PROJ-3 adds one new environment variable. The value is the
public-facing origin of the Calcgrinder instance, used as
the base for absolute URLs in transactional emails
(sysadmin approve/decline links, user approval
confirmation) and for the route-handler origin check.

| Environment | `APP_URL` value |
|-------------|-----------------|
| Local dev   | `http://localhost:3000` |
| Vercel preview | the preview URL Vercel exposes (`https://…-<branch>.vercel.app`) — set per deployment via Vercel's UI or `vercel env add` |
| Production  | `https://<your-domain>` |

Constraints enforced by the app at module load:

- No trailing slash.
- Outside `NODE_ENV=development`, the scheme **must** be
  `https://`. `http://` is rejected with a clear error at
  the first signup attempt. This is the single enforcement
  point for the PROJ-2 "callers must produce `https:`
  URLs" finding — every outgoing-mail URL in PROJ-3 is
  derived from `APP_URL`.

The var is server-side only (no `NEXT_PUBLIC_` prefix). On
Vercel, add it as an Environment Variable scoped to
**Production, Preview, Development** as appropriate.

## 3. Email infrastructure

PROJ-3 doesn't add any new templates — it reuses the
`signupNotification` and `approvalConfirmation` templates
shipped by PROJ-2.

If `SYSADMIN_NOTIFICATION_EMAIL`, `EMAIL_FROM`, and the
`CYON_SMTP_*` vars aren't configured yet, follow
[email.md](./email.md) before signing anyone up. The
signup server action degrades gracefully on a missing
`SYSADMIN_NOTIFICATION_EMAIL` (logs an error and proceeds
with the rest of the flow), but you'll have no way to know
about new signups until you fix it.

## 4. Sysadmin account

PROJ-1 ships `npm run seed:sysadmin`. Run it once per
environment to provision the sysadmin account:

```
npm run seed:sysadmin
```

The script reads `SYSADMIN_EMAIL` and
`SYSADMIN_INITIAL_PASSWORD` from `.env.local` (or the
deployed environment), creates the user in Supabase Auth,
and promotes their profile to `role='sysadmin' status='approved'`.
The script is idempotent — re-running it has no effect if
the sysadmin already exists.

After the first sign-in, change the initial password via
the Settings page (PROJ-14) or by running the seed script
again with a new `SYSADMIN_INITIAL_PASSWORD`.

## 5. "I declined someone by mistake"

PROJ-3 doesn't ship a sysadmin moderation UI — that's
PROJ-19. Until PROJ-19 lands, the recovery path is a
direct SQL update via the Supabase Cloud Dashboard.

1. Open the Supabase Cloud Dashboard for your project.
2. **SQL Editor → New query**.
3. Look up the user:

   ```sql
   SELECT id, email, name, status, role
     FROM public.profiles
    WHERE email = 'the-affected-user@example.com';
   ```

4. Flip their status back:

   ```sql
   UPDATE public.profiles
      SET status = 'approved'  -- or 'pending'
    WHERE email = 'the-affected-user@example.com';
   ```

The user can then log in normally. The
`signup_approvals` row remains consumed — that's fine;
its only purpose is to track the one-click sysadmin
decision, not the user's lifetime status.

If you want the user to receive a confirmation email
(they won't have got one because decline is silent), send
it manually for now. PROJ-19 will fold this into a single
"flip to approved" UI button.

## 6. Troubleshooting

### Signup completes but no notification email arrives

1. Check the Vercel logs for `signupNotification send failed`
   or `SYSADMIN_NOTIFICATION_EMAIL is not configured`.
2. If the env var is missing, set it and redeploy.
3. If SMTP is failing, follow [email.md](./email.md) § 5
   (smoke test).
4. The signup itself is at-least-once delivery: the user
   row exists, the approval token exists. You can find the
   approve URL via SQL:

   ```sql
   SELECT 'https://<your-domain>/auth/admin/' || token || '/approve'
     FROM public.signup_approvals
    WHERE consumed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 5;
   ```

### Approve / decline link returns "not valid"

The token has been consumed (idempotent re-click → "Already
…" landing) or the underlying `auth.users` row has been
deleted (the approval row was cascaded out). Inspect:

```sql
SELECT id, user_id, consumed_at, outcome
  FROM public.signup_approvals
 WHERE token = '<token from the URL>';
```

If the row is missing entirely, the link is no longer
valid. The user must sign up again.
