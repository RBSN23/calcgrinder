# PROJ-3: Authentication & Account Approval Flow

## Status: Planned
**Created:** 2026-05-22
**Last Updated:** 2026-05-22

## Dependencies

- **PROJ-1** — uses the `profiles` table, the SSR
  Supabase client modules, the `is_sysadmin(uuid)` helper,
  the root `middleware.ts`, and the
  `SYSADMIN_NOTIFICATION_EMAIL` env var. Extends the
  middleware with route gating.
- **PROJ-2** — calls `sendMail()` and the `signupNotification`
  + `approvalConfirmation` templates from PROJ-2's library.
  Relies on Supabase Auth Custom SMTP being configured
  (PROJ-2 ships the deployer instructions and the three
  Supabase Auth email templates: Confirm signup, Reset
  password, Change email).

## User Stories

- As a visitor, I want to sign up via the signup form with
  name, email, and password, so that my account is queued
  for sysadmin approval.
- As a verified registered user, I want to log in with email
  and password after verification and approval, so that I
  get access to the Builder and Dashboard.
- As a user who has forgotten their password, I want to
  request a reset link via the forgot-password form, so
  that I can reset my password on my own.
- As a sysadmin, I want to receive a notification with
  approve and decline links for every new signup, so that
  I can decide directly with one click in my mail client
  without logging into the dashboard.
- As a pending or declined user, I want to see a neutral
  "Waiting for approval" screen on login attempt, so that
  neither my status nor the decline decision is disclosed.
- As a pending or declined user, I want to sign out from
  that waiting screen, so that I'm not stuck in a limbo
  state with a valid session.
- As an approved user, I want to be automatically redirected
  to the dashboard when I open `/auth/login` (if already
  signed in), so that I don't have to walk through an empty
  auth screen.
- As a sysadmin, I want a friendly "Already approved/declined
  on …" landing when I accidentally double-click the approve
  or decline link, instead of a 500 error page.

## Out of Scope

PROJ-3 ships the pre-auth surface and the approve/decline
mechanism. Adjacent concerns belong to later features:

- **App shell / avatar popover / top bar / sign-out
  trigger UI.** PROJ-4. PROJ-3 ships the sign-out
  *endpoint* (used by the waiting-for-approval link); the
  in-app avatar-popover sign-out button that PROJ-4 adds
  hits the same endpoint.
- **Dashboard surfaces** (My Calculators, Presets,
  Scenarios, Trash). PROJ-5 / PROJ-13 / PROJ-18.
- **Settings page** — name / email change, password change,
  delete account, preferences. PROJ-14. PROJ-3 does **not**
  expose name, email, or password editing anywhere outside
  the signup form, the forgot-password flow, and Supabase
  Auth's native email-change verification mail.
- **Sysadmin moderation UI** — listing all users, flipping
  status from `declined` back to `pending` / `approved`,
  moderating calculators. PROJ-19. Between PROJ-3 ship and
  PROJ-19 ship, the deployer's recourse for an accidental
  decline is direct DB inspection via the Supabase Cloud
  Dashboard's table editor (status update on the
  `profiles` row). This is a deliberate trade — see
  Product Decisions.
- **Account deletion flow** (`account-deletion-confirmation`
  template integration). PROJ-14.
- **Calculator visitor surface** `/c/<token>`. PROJ-11.
  PROJ-3's route gating must explicitly *not* gate this
  namespace.
- **Captcha / signup rate-limiting / bot defence beyond
  Supabase Auth's built-in rate limits.** Out of scope for
  v1; v1 is invite-only with a low expected signup volume
  and the sysadmin acts as a human filter. Documented as a
  v2 candidate.
- **OAuth providers / Magic Link / SMS.** Explicitly
  email + password only per PRD constraint.
- **First-user-bootstrap on signup.** PROJ-1's seed script
  is the only path to a sysadmin account. PROJ-3's signup
  never promotes.
- **Demote sysadmin to registered.** Out of scope per PRD
  v1 non-goal.
- **Profile auto-completion** beyond `name` (avatar, bio,
  etc.). Not in v1.
- **Email-change flow surfaces** (the Settings inline-edit
  on the email field, the pending-email state, the
  `/auth/email-confirmed` landing). PROJ-14 owns the
  Settings entry point; the `/auth/confirm` callback handler
  built in PROJ-3 covers all Supabase Auth email-action
  callbacks (signup confirm, password reset, email change)
  uniformly, but its non-signup-confirm branches are
  exercised by PROJ-14 + the password reset flow.
- **Approve/decline token expiry, time-based revocation,
  email re-send.** Tokens are single-use, never expire;
  re-clicking returns a friendly read-back. See Product
  Decisions for rationale.
- **Logging / metrics on signup / login / approve events
  beyond Vercel + Supabase defaults.** No analytics SDKs.
- **Internationalisation.** English only per PRD non-goal.
  All user-facing copy in the implemented pages is English
  (matches the auth.jsx prototype).

## Acceptance Criteria

**Format:** Given [precondition] / When [action] /
Then [result]

### Signup — happy path

- [ ] Given an anonymous visitor opens `/auth/signup` with a working network connection, when they submit name, a new valid email address, and a password that satisfies Supabase Auth's default policy, then the server responds with a 302 redirect to `/auth/sent-confirmation`, a Supabase Auth verification email has been sent to the given address, and a new row exists in the `profiles` table with `role='registered'`, `status='pending'`, `name=<submitted name>`.
- [ ] Given a new signup has just been committed, when the server executes the follow-up `sendMail()` call, then an email lands at the `SYSADMIN_NOTIFICATION_EMAIL` recipient with subject `"New Calcgrinder signup — <email>"`, and the body contains the new user's name and email plus two full URL lines `<APP_URL>/auth/admin/<token>/approve` and `<APP_URL>/auth/admin/<token>/decline`.
- [ ] Given the signup-notification `sendMail()` call throws (Cyon 5xx, TCP timeout, etc.), when the server action catches the exception, then the auth user and the `signup_approvals` row are NOT rolled back, a `console.error` log including the user ID appears in the Vercel log, and the user still sees the `/auth/sent-confirmation` page.
- [ ] Given `/auth/sent-confirmation` is shown after a successful signup with `?type=signup`, when the page renders, then it shows the mail glyph + "Check your email" headline + body "We've sent a verification link to `<email>`. Once you confirm, you'll be reviewed for approval." — the signup email address is explicitly echoed in the body.

### Signup — error states & enumeration

- [ ] Given a visitor submits the signup form with an email address for which an `auth.users` entry already exists, when the server detects the conflict, then it responds with status 422 (no 302 redirect), the form page re-renders with an `AuthErrorBanner` "An account with this email already exists. Sign in or reset your password." (with inline links to `/auth/login` and `/auth/forgot-password`), and **no** additional verification email and **no** additional signup notification is sent.
- [ ] Given a visitor submits the signup form with an empty name, email, or password field, when client-side Zod validation fires, then the form is not submitted and the first missing field gets an `error` state (red border + hint text) — the page sends no request to Supabase.
- [ ] Given a visitor submits a password that violates Supabase Auth's configured policy (e.g. < 6 characters), when the server action processes the Supabase Auth error, then the Supabase Auth error message appears verbatim as an `AuthErrorBanner` above the form, and the user retains name + email in the form (only the password fields are cleared).
- [ ] Given a visitor submits a syntactically invalid email address, when client-side Zod validation fires, then an inline hint appears under the email field and the form is not submitted.

### Email verification (Supabase Auth native flow)

- [ ] Given Supabase Auth is configured with Custom SMTP and the "Confirm signup" template has been installed by PROJ-2, when a new user signs up, then they receive a plain-text email with the PROJ-2-documented wording, sent from the `EMAIL_FROM` sender, with a confirm link of the form `<APP_URL>/auth/confirm?token_hash=…&type=signup`.
- [ ] Given the user clicks the verification link, when the `/auth/confirm` route handler validates the `token_hash` parameter via `supabase.auth.verifyOtp()`, then Supabase Auth sets `auth.users.email_confirmed_at` to the current timestamp; on success the user is redirected to `/auth/waiting-for-approval` (status is still `pending`); on token failure the user is redirected to a generic "This link is no longer valid" error variant.
- [ ] Given a user whose `email_confirmed_at` is still `NULL` and who is `approved` (sysadmin approval was faster than the verify click), when they log in at `/auth/login`, then login fails with "Please confirm your email first" (Supabase Auth error surface), no redirect to the dashboard.

### Login — happy path

- [ ] Given a user with `email_confirmed_at != NULL` and `profiles.status='approved'` opens `/auth/login` and submits correct email + password, when the server action calls `supabase.auth.signInWithPassword()` and it succeeds, then the user is redirected via 302 to `/dashboard` and a valid Supabase session cookie is set.
- [ ] Given a user with `status='pending'` (or `declined'`) logs in with valid credentials, when the login server action checks the profile status after the sign-in call, then the user is not redirected to `/dashboard` but to `/auth/waiting-for-approval` — the session cookies are set so the sign-out link on the waiting screen works.

### Login — error states

- [ ] Given a user submits an email address for which no `auth.users` entry exists, when the server action analyses the Supabase Auth error, then an `AuthErrorBanner` appears with the wording "No account exists with this email." plus an inline "Sign up" link to `/auth/signup`.
- [ ] Given a user submits an existing email with a wrong password, when the server action processes the Supabase Auth error, then an `AuthErrorBanner` appears with the wording "Wrong password." plus an inline "Forgot password?" link to `/auth/forgot-password`.
- [ ] Given a user submits an empty email or password field, when client-side Zod validation fires, then the form is not submitted (inline hint only).
- [ ] Given a user submits the login form multiple times in quick succession with the same wrong password, when Supabase Auth returns the rate limit (HTTP 429), then the Supabase Auth rate-limit error appears verbatim as an `AuthErrorBanner` and the `Submit` button is briefly disabled (≥ 1 s) until another attempt is allowed.

### Forgot password (Supabase Auth native flow)

- [ ] Given an anonymous visitor opens `/auth/forgot-password` and submits an existing email address, when the server action successfully calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<APP_URL>/auth/confirm?next=/auth/reset-password' })`, then the user is redirected to `/auth/sent-confirmation?type=reset` and sees the mail glyph + "Check your email" headline + body "We've sent a password reset link to `<email>`." — the email address is explicitly echoed in the body.
- [ ] Given an anonymous visitor submits at `/auth/forgot-password` an email for which no account exists, when the server action checks this beforehand, then it responds with 422 (no redirect, no Supabase email send), and the page re-renders with `AuthErrorBanner` "No account exists with this email." plus an inline "Sign up" link to `/auth/signup`.
- [ ] Given Supabase's "Reset password" template (installed by PROJ-2) has been triggered, when the user receives the email and clicks the reset link, then they land via `/auth/confirm` with OTP verification on `/auth/reset-password` with an active recovery session.
- [ ] Given the user submits a new password + confirmation password on `/auth/reset-password`, both identical and policy-compliant, when the server action calls `supabase.auth.updateUser({ password })`, then the password is set and the user is redirected to `/auth/reset-success`, where "Sign in" leads back to `/auth/login`.
- [ ] Given the two password fields on `/auth/reset-password` contain different values, when the user clicks "Set new password", then the inline banner "Passwords do not match." appears, both inputs get the `error` state (red border), and no Supabase call is made.
- [ ] Given a user submits a new password that violates Supabase Auth's policy, when the server action catches the Supabase Auth error, then the Supabase Auth error message appears verbatim as an `AuthErrorBanner`.
- [ ] Given a declined user runs the forgot-password flow, when they successfully set a new password, then the password is changed, the user is redirected to `/auth/reset-success`, but a login attempt still lands on `/auth/waiting-for-approval` (reset does not change any status).

### Waiting-for-approval screen

- [ ] Given a logged-in user with `status='pending'` opens `/auth/waiting-for-approval`, when the page renders, then it shows the clock glyph (`AuthIcons.Clock`) + headline "Waiting for approval" + body "Your request is being reviewed. You'll receive an email when your account is approved." + a "Sign out" link (no app chrome).
- [ ] Given a logged-in user with `status='declined'` opens `/auth/waiting-for-approval`, when the page renders, then it is pixel-identical to the `pending` variant (silent rejection — the decline decision is not disclosed).
- [ ] Given a user on the waiting screen clicks "Sign out", when the submit action fires against `/auth/sign-out` (POST), then the action calls `supabase.auth.signOut()`, deletes the session cookie, and responds with 302 to `/auth/login`.
- [ ] Given a user has been approved by the sysadmin in the meantime (while the waiting screen is open in the browser), when the user reloads the page, then they are redirected to `/dashboard` (refresh = re-auth check; explicit no auto-polling in v1 — see Product Decisions).
- [ ] Given an anonymous visitor (no session cookie) opens `/auth/waiting-for-approval` directly, when the page is about to render, then they are redirected to `/auth/login` (no logged-in state → no waiting-screen authorization).
- [ ] Given a user with `status='approved'` opens `/auth/waiting-for-approval` directly, when the page is about to render, then they are redirected to `/dashboard`.

### Approve / decline tokens — DB & migration

- [ ] Given a Supabase Cloud project with the PROJ-3 migration applied, when `signup_approvals` is inspected, then the table exists with columns `id` (UUID PK), `user_id` (UUID FK → `auth.users.id`, ON DELETE CASCADE), `token` (TEXT NOT NULL UNIQUE — 32-byte base64url), `created_at` (TIMESTAMPTZ DEFAULT now()), `consumed_at` (TIMESTAMPTZ NULL), `outcome` (TEXT NULL, CHECK constraint `outcome IN ('approved', 'declined')`).
- [ ] Given `signup_approvals` has RLS enabled, when an authenticated non-sysadmin user attempts SELECT/INSERT/UPDATE/DELETE, then every operation fails with an RLS error (no user-facing policies — the table is read exclusively by the server via the service role and by the anonymous `/auth/admin/<token>/<action>` handler via token lookup).
- [ ] Given a new user has just been registered via `/auth/signup`, when the server action inserts a `signup_approvals` row with a freshly generated random token (`crypto.randomBytes(32).toString('base64url')`), then `user_id` is the `auth.users.id` of the new user, and `consumed_at` and `outcome` are NULL.

### Approve / decline — single-use, idempotent

- [ ] Given a sysadmin clicks the approve link `<APP_URL>/auth/admin/<token>/approve` for the first time, when the server handler looks up the token and finds `consumed_at IS NULL`, then in a single transaction it sets: (1) `profiles.status='approved'` for the associated `user_id`, (2) `signup_approvals.consumed_at=now()`, (3) `signup_approvals.outcome='approved'`; afterwards `sendMail()` fires with the `approvalConfirmation` template to the user's email address and the admin-landing variant renders with the check glyph + "Account approved" + user name + user email.
- [ ] Given a sysadmin clicks the decline link `<APP_URL>/auth/admin/<token>/decline` for the first time, when the server handler looks up the token and finds `consumed_at IS NULL`, then it sets `profiles.status='declined'` + `signup_approvals.consumed_at=now()` + `signup_approvals.outcome='declined'`; afterwards **no** mail is sent to the user (silent rejection) and the admin-landing variant renders with the X glyph + "Account declined" + the note "… has been declined and will not be notified".
- [ ] Given a token has already been consumed with `outcome='approved'` and `consumed_at='2026-05-22 14:30 UTC'`, when the sysadmin clicks either the approve OR the decline link a second time, then the handler detects the `consumed_at != NULL` state, writes nothing to the DB, sends no mail, and renders an "Already approved on 2026-05-22" landing variant (same AuthShell, info text instead of action confirmation).
- [ ] Given a token has already been consumed with `outcome='declined'`, when either link is clicked again, then the handler renders an analogous "Already declined on YYYY-MM-DD" with the X glyph and no DB write.
- [ ] Given a non-existent token is requested (e.g. from an old link or deliberate URL manipulation), when the handler finds no row, then it responds with HTTP 404 and renders the generic `EmptyOrErrorState` error variant "This approval link is not valid." with no sysadmin-specific information.
- [ ] Given `<action>` in the URL is neither `approve` nor `decline`, when the handler matches the route, then it responds with HTTP 404 (Next.js dynamic-segment mismatch).
- [ ] Given the `approvalConfirmation` `sendMail()` call throws (Cyon down), when the approve handler catches the exception, then the DB transaction (`profiles.status='approved'` + `consumed_at`) is already committed and stays committed, a `console.error` log appears in the Vercel log, and the admin landing still renders with "Account approved" plus an additional `AuthErrorBanner` note "We couldn't send the confirmation email — the user is approved but won't be notified automatically. They can sign in directly."

### Admin landing — auth & access

- [ ] Given an anonymous browser without a session cookie requests `/auth/admin/<valid-token>/approve`, when the handler processes the request, then it performs the approve action normally — knowing the token IS the auth proof, no additional sysadmin session check is needed.
- [ ] Given a normal logged-in (non-sysadmin) user accidentally clicks a leaked / forwarded admin URL with a valid token, when the handler processes the request, then it still performs the action (token = auth; PROJ-3 explicitly does not take the position of checking a sysadmin session as an additional layer — see Product Decisions). The token is consumed.
- [ ] Given `/auth/admin/<token>/<action>` is rendered, when the page is inspected, then it shows **no** app chrome (no TopBar, no avatar) — `AuthShell` with wordmark and centred card like all other auth surfaces.

### Sign-out endpoint

- [ ] Given a logged-in user with a valid session cookie sends POST to `/auth/sign-out`, when the handler calls `supabase.auth.signOut()`, then it responds with 302 to `/auth/login` and the session cookie is cleared in the response.
- [ ] Given an anonymous browser sends POST to `/auth/sign-out`, when the handler checks the missing session, then it still responds with 302 to `/auth/login` (idempotent — signing out of nothing is not an error).

### Route gating — middleware + layouts

- [ ] Given an anonymous browser opens `/dashboard`, `/editor/<id>`, `/settings`, or a private API route, when the middleware/layout layer detects the missing user, then it responds with 302 to `/auth/login?next=<original-path>` and the `next` parameter is used as the redirect target after successful login.
- [ ] Given a logged-in user with `status='pending'` or `status='declined'` opens `/dashboard`, `/editor/<id>`, or `/settings`, when the gate reads the profile status, then it 302s to `/auth/waiting-for-approval`.
- [ ] Given a logged-in approved user opens `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/sent-confirmation`, `/auth/reset-password`, or `/auth/reset-success`, when the gate determines the approved status, then it 302s to `/dashboard`.
- [ ] Given an anonymous visitor opens `/c/<token>` (visitor surface, PROJ-11), when the middleware sees this path, then it grants unrestricted access (no auth check, no status check).
- [ ] Given an anonymous visitor opens `/auth/admin/<token>/approve` or `/auth/admin/<token>/decline`, when the middleware sees this path, then it grants unrestricted access (token = auth).
- [ ] Given a browser opens `/auth/confirm?token_hash=…&type=…`, when the middleware sees this path, then it grants unrestricted access (Supabase Auth callback needs no existing session).

### Auth UI primitives

- [ ] Given the primitives defined in the `docs/design/auth.jsx` prototype (`AuthShell`, `AuthField`, `AuthInput`, `AuthSubmit`, `AuthLink`, `AuthDivider`, `AuthFootLine`, `AuthHelpText`, `AuthErrorBanner`, `AuthGlyph`, `AuthMessage`, `AuthIcons`) are ported as Next.js React components under `src/components/auth/`, when each of the eight auth pages uses them, then the visual appearance (wordmark, max-width 360 desktop / 100% mobile, spacing, typography) matches the design source; pixel identity is not required, but layout fidelity is.
- [ ] Given the auth surfaces use the app theme (Light/Dark/System) from the `next-themes` provider (or the configured app-theme mechanism from PROJ-4), when the user switches the system theme, then background, text, border, and accent adapt correctly.

### Env vars & documentation

- [ ] Given `.env.local.example` is inspected, when the diff against PROJ-2 is viewed, then exactly one new entry has been added: `NEXT_PUBLIC_APP_URL="http://localhost:3000"` with an inline comment "Used as base URL for absolute links in transactional emails. In production: https://<your-domain>."
- [ ] Given `docs/production/auth.md` exists, when the deployer follows the file, then they find, in this order: (1) Supabase Auth settings (keep email confirmation enabled, password-policy recommendation "≥ 8 characters recommended", leave rate-limit defaults as-is), (2) the `NEXT_PUBLIC_APP_URL` env var setup per environment, (3) a pointer to `docs/production/email.md` (PROJ-2) for SMTP and Auth template configuration, (4) a "What to do if you decline a user by mistake" section with a Supabase Dashboard SQL snippet as the interim recovery path until PROJ-19.

### Tests

- [ ] Given `src/app/auth/signup/actions.test.ts` contains tests for: (1) happy-path signup → auth user + profile + approval row + notification email, (2) existing-email conflict → 422 + banner, (3) Zod validation fail (empty fields, invalid email) → 422 without Supabase call, (4) notification `sendMail()` throw → auth-user commit is preserved + error log, when `npm test` runs, then all tests pass (the Supabase Admin client + `sendMail` are mocked via `vi.mock`; no live calls).
- [ ] Given `src/app/auth/admin/[token]/[action]/process.test.ts` contains tests for: (1) fresh approve token → status update + outcome=approved + confirmation email, (2) fresh decline token → status update + outcome=declined + NO mail, (3) re-click already-consumed token → no DB write + "Already …" landing, (4) unknown token → 404, (5) invalid action → 404, (6) `sendMail()` throws on approve → state is persisted + warning banner, when `npm test` runs, then all tests pass.
- [ ] Given `src/lib/auth/route-gate.test.ts` (module path finalised in /architecture) contains tests that fully cover the gate matrix: (1) anonymous browser × `/dashboard` → 302 `/auth/login?next=/dashboard`, (2) anonymous browser × `/editor/abc` → 302 `/auth/login?next=/editor/abc`, (3) anonymous browser × `/settings` → 302 `/auth/login?next=/settings`, (4) anonymous browser × `/c/<token>` → no redirect, (5) anonymous browser × `/auth/admin/<token>/approve` → no redirect, (6) anonymous browser × `/auth/confirm?token_hash=x&type=signup` → no redirect, (7) anonymous browser × `/auth/login` → no redirect, (8) `pending` × `/dashboard` → 302 `/auth/waiting-for-approval`, (9) `declined` × `/dashboard` → 302 `/auth/waiting-for-approval` (identical to pending), (10) `pending` × `/auth/login` → 302 `/auth/waiting-for-approval` (a signed-in pending user has no business on the login screen), (11) `pending` × `/auth/waiting-for-approval` → no redirect, (12) `approved` × `/auth/login` → 302 `/dashboard`, (13) `approved` × `/auth/signup` → 302 `/dashboard`, (14) `approved` × `/auth/waiting-for-approval` → 302 `/dashboard`, (15) `approved` × `/dashboard` → no redirect, when `npm test` runs, then all 15 cases pass.
- [ ] Given `src/app/auth/confirm/route.test.ts` contains tests for: (1) `type=signup` + valid `token_hash` → `verifyOtp({ type: 'signup', token_hash })` is called with the right parameters + redirect to `/auth/waiting-for-approval`, (2) `type=recovery` + valid `token_hash` → `verifyOtp({ type: 'recovery', token_hash })` + redirect to the `next` param (default `/auth/reset-password`), (3) `verifyOtp` throws (expired or already-consumed token) → redirect to a generic `EmptyOrErrorState` variant with the wording "This link is no longer valid.", (4) missing `token_hash` or unknown `type` → redirect to the same error variant. The `type=email_change` branch is deliberately not covered and will be added in PROJ-14. When `npm test` runs, then all four cases pass.
- [ ] Given `tests/PROJ-3-auth-flow.spec.ts` (Playwright E2E) covers the full click sequence: signup → sent-confirmation → (mock-)verify → login attempt → waiting-for-approval → admin-approve via directly invoked token URL → re-login → dashboard, when `npm run test:e2e` runs, then the test passes in Chromium and Mobile Safari (same multi-project setup as PROJ-1).

## Edge Cases

- **Signup race: trigger creates profile row before signup
  handler inserts approval row.** PROJ-1's
  `handle_new_user` trigger creates the `profiles` row on
  `auth.users` INSERT. PROJ-3's signup server action then
  inserts a `signup_approvals` row referencing the just-
  created user. Both writes happen in the same request; if
  the trigger fails the auth.users INSERT also fails and
  the server action sees the error. No application-level
  retry; surface the Supabase-Auth-error to the user.
- **Signup with an email that matches a declined user.**
  Supabase Auth detects the duplicate-email constraint and
  rejects; the server action handles it as "email already
  exists" (silent to the would-be re-applicant).
- **Verification email never clicked.** User stays
  `pending` with `email_confirmed_at = NULL` indefinitely.
  Sysadmin can still approve via the link; the user just
  can't log in until they verify. No automatic cleanup
  job in v1.
- **Sysadmin clicks approve on a user whose `auth.users`
  row was deleted in the interim (e.g. PROJ-1 cascade from
  a manual DB op).** `signup_approvals.user_id` references
  `auth.users.id` with ON DELETE CASCADE — the approval
  row is gone too; the link hits 404 "not valid".
- **Sysadmin clicks approve, then in a follow-up email
  clicks decline.** Idempotent re-click: second click sees
  `consumed_at` set and shows "Already approved on …".
  The first-click outcome is final.
- **User's session expires while on `/auth/waiting-for-
  approval`.** Refresh redirects to `/auth/login` (gate
  sees no session). User logs back in; if approved in
  the meantime, lands on `/dashboard`.
- **Forgot-password reset link clicked twice.** Supabase
  Auth's recovery tokens are single-use by default;
  second click hits the `/auth/confirm` handler with an
  already-consumed token and shows the generic "link no
  longer valid" error landing.
- **Password reset for a user whose email is unverified.**
  Supabase Auth permits this; the user's email is
  effectively verified by completing the reset flow. Status
  (pending/declined/approved) is independent.
- **`NEXT_PUBLIC_APP_URL` misconfigured (e.g. trailing
  slash, missing scheme).** Server-side validation at the
  point of signup-notification mail rendering: throw a
  clear error if `APP_URL` isn't a valid absolute origin.
  Surfaces deployer config errors loudly at first signup.
- **A user signs up twice (same browser, refresh between
  submits).** Second submit → "email already exists" path.
  The first signup_approvals row remains valid; the user
  doesn't get a duplicate notification.
- **Sysadmin's mail client clicked Approve and Decline
  simultaneously (concurrent requests with the same
  token).** Database-level: the UPDATE on `signup_approvals`
  uses `WHERE consumed_at IS NULL` so only one of the two
  transactions writes; the other sees zero rows affected
  and renders the "Already …" landing.
- **A user signs up, never gets approved, and the sysadmin
  later decides to delete them entirely.** Out of scope for
  PROJ-3 — manual DB op via Supabase Dashboard. PROJ-19 may
  add this UI.
- **`/auth/confirm?type=email_change` (used by PROJ-14
  email-change later).** PROJ-3's confirm handler is built
  generically over all `type` values that Supabase Auth
  supports; only the redirect target differs. PROJ-3 only
  exercises `type=signup` (verification) and
  `type=recovery` (password reset); the `email_change`
  branch is dormant until PROJ-14.
- **A non-sysadmin gets hold of the approve URL** (e.g.
  email forwarded). They can approve/decline. v1 accepts
  this risk: the email is sent to `SYSADMIN_NOTIFICATION_
  EMAIL`, whose mailbox controls the trust boundary. No
  additional in-app session gating on the admin landing.
- **Mail-client / spam-scanner / link-preview prefetch of
  the approve/decline GET URL.** Some mail clients
  (Outlook SafeLinks, corporate spam scanners, Slack
  unfurls if the URL is shared) fetch URLs in the body
  server-side before the human clicks. This can fire the
  approve or decline action ahead of the sysadmin reading
  the email. The single-use + idempotent re-click design
  already mitigates the consequence: the action commits
  once, further clicks render the read-back landing.
  Decisions made by a prefetcher are reversible via
  PROJ-19's moderation UI (or interim Dashboard SQL).
  v1 explicitly accepts the risk under the trusted-
  deployer mailbox model; named here so it doesn't get
  rediscovered as a bug later.

## Technical Requirements

- **Stack:** Next.js 16 App Router server actions + route
  handlers for all signup/login/forgot/reset/approve
  endpoints. shadcn/ui-style Tailwind primitives for the
  auth UI components, ported from `docs/design/auth.jsx`.
- **DB:** one new migration adds the `signup_approvals`
  table with the columns + RLS as documented in
  Acceptance Criteria; regenerate `src/lib/supabase/types.ts`
  via `npx supabase gen types typescript --linked` after
  push (per CLAUDE.md convention).
- **New env var:** `NEXT_PUBLIC_APP_URL` (used for absolute
  URLs in transactional emails). Existing
  `SYSADMIN_NOTIFICATION_EMAIL` is consumed.
- **Email integration:** import `signupNotification`,
  `approvalConfirmation` from `@/lib/email/templates` and
  call `sendMail()` from `@/lib/email/send` — both shipped
  by PROJ-2. PROJ-3 introduces no new email templates.
- **Auth callback `/auth/confirm`:** single route handler
  that handles all `supabase.auth.verifyOtp({ type, token_hash })`
  flows — signup confirmation, password recovery, future
  email-change. Reads `type` and `next` query params;
  redirects to the right post-callback page.
- **Token format:** `crypto.randomBytes(32).toString('base64url')`
  = 43 chars URL-safe. Stored as TEXT, UNIQUE index.
- **Validation:** Zod schemas for every form input
  (server-side enforcement is the source of truth; clients
  enforce too for UX). No Supabase-Auth password policy
  re-implementation; pass through to Supabase and surface
  its error.
- **Form library:** `react-hook-form` + Zod resolvers per
  CLAUDE.md.
- **Sign-out endpoint:** POST `/auth/sign-out` route
  handler (not server action) so it can be invoked via a
  plain `<form action="/auth/sign-out" method="post">`
  without JS.
- **Middleware:** extend PROJ-1's `updateSession` to read
  the user's `profiles.status` once per request (only when
  the path needs it) and redirect accordingly. Public
  paths (`/c/*`, `/auth/admin/*`, `/auth/confirm`) bypass
  the gate. The exact split between middleware and layout
  enforcement is a /architecture decision.
- **Performance:** the route gate must add ≤ one Supabase
  DB round-trip per request. Profile-status check should
  be cached per-request (not per-session — status can
  change between requests).
- **Tests:** unit tests for the signup action and the
  approve/decline process; E2E covering signup → verify →
  waiting → approve → login → dashboard. No tests on the
  Supabase Auth library itself.
- **Security:**
  - Session cookies set by Supabase Auth with
    `Secure`, `HttpOnly`, `SameSite=Lax` (already the
    Supabase default).
  - All sensitive operations (signup, login, sign-out,
    reset, admin approve/decline) are POST.
  - CSRF: Next.js server actions ship CSRF protection
    built-in via origin checks. Route handlers
    (`/auth/sign-out`, `/auth/confirm`) verify the request
    origin matches `NEXT_PUBLIC_APP_URL`.
  - Approve/decline endpoints are GET to make sysadmin's
    email-client click work without form submission — this
    is a deliberate spec deviation from "POST for state-
    changing operations" because (a) the token is the auth,
    (b) idempotent re-click is part of the design, (c) every
    mainstream sysadmin-approval-via-link service does the
    same. Documented in Product Decisions.
  - `NEXT_PUBLIC_APP_URL` validated at signup-handler
    boundary (Zod URL parse) to prevent open-redirect or
    malformed URLs in outgoing mail.

## Open Questions

- [ ] /architecture: split between middleware-level and
      layout-level route gating (single DB query per
      request budget). Recommendation will likely be
      "middleware checks session + user.id; layout group
      `(app)` checks status; layout group `(auth)` checks
      approved-redirects-out".
- [ ] /architecture: where to put the AuthShell + primitives
      — `src/components/auth/` is the working assumption;
      may be revised if it clashes with shadcn-ui patterns
      established in PROJ-4.
- [ ] /architecture: server actions vs route handlers per
      endpoint. PROJ-3 spec assumes server actions for
      most form posts; final decision in /architecture.
- [ ] /architecture: caching strategy for the per-request
      `profiles.status` lookup (React `cache()` vs request
      header propagation vs explicit per-route reads).

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Email verification (Supabase Auth native) AND sysadmin approval — both required for login, either order | Filters typo'd / fake emails out of the sysadmin's queue without making the deployer wait on the user's verification click; signup-notification fires immediately so sysadmin can act in parallel; matches the wording PROJ-2 already shipped in the "Confirm signup" Supabase template | 2026-05-22 |
| Single token + two URL paths (`/approve`, `/decline`) over two-tokens-per-row | One row per signup, smaller DB surface; both URLs ship in the same email anyway so attacker-control of one giving access to the other has no real-world impact; matches the v1 spec phrasing "approve / decline path variants" literally | 2026-05-22 |
| Tokens single-use, never expire, idempotent re-click renders "Already …" landing | Sysadmin may check mail after weeks; no UX win to expiry in a single-deployer trusted context; re-click idempotency is friendlier than a 404 | 2026-05-22 |
| Notification-email failure does not roll back signup; user sees the regular success page | At-least-once dashboard semantics (matches PROJ-2's design: dashboard is source of truth, email is push trigger); rolling back on transient SMTP errors would create hostile UX for the legitimate user | 2026-05-22 |
| Enumeration defense is explicitly NOT a v1 goal — signup, login, and forgot-password all surface "this email is / is not registered" distinctions in their error copy | Private invite-only deployment, handful of trusted users, sysadmin already has the full user list; UX win of clear messaging ("no account with that email" / "wrong password" / "reset link sent to <you>") outweighs the small enumeration risk; consistency between the three auth-entry surfaces avoids the impression of confused threat-modelling. Deviation from the `auth.jsx` prototype copy ("Invalid email or password" / "If an account exists …") which was authored under an enumeration-safe assumption — PROJ-3 explicitly overrides the prototype copy on this point | 2026-05-22 |
| Privileged un-decline path deferred entirely to PROJ-19; interim recourse is Supabase Dashboard table-editor | Mistake rate estimated < 2/year for a solo deployer with handful of trusted users; CLI tooling for that volume is unjustified surface | 2026-05-22 |
| Waiting-for-approval screen does not auto-poll; user re-attempts login or refreshes manually | Auto-polling adds JS + a recurring DB read for a state change that happens at most once per user; refresh-on-action is plenty for v1 | 2026-05-22 |
| Password policy: pass through to Supabase Auth's configured policy (default 6 chars; deployer should raise to 8+ in dashboard); surface Supabase's error verbatim | Avoids duplicate-policy drift between app code and Supabase; docs/production/auth.md recommends 8+ for deployers | 2026-05-22 |
| Approve/decline endpoints are GET (token in URL) rather than POST | Standard pattern for click-from-email; token-knowledge IS the auth; idempotent re-click is part of the design; every mainstream tool does this. CSRF irrelevant when there's no session-based action | 2026-05-22 |
| Admin landing does not require a sysadmin session — token is the only credential | Sysadmin clicks link in their mail client without logging into the app first; adding session-required would force a roundabout login flow before approving | 2026-05-22 |
| Sign-out endpoint shipped by PROJ-3 even though the UI trigger lives in PROJ-4 | Waiting-for-approval needs sign-out (per design); shipping just the endpoint here lets PROJ-4 wire the avatar popover to it later without an interim placeholder | 2026-05-22 |
| New env var `NEXT_PUBLIC_APP_URL` for absolute URLs in outgoing mail | Mail bodies need full URLs; reading from request headers in a server action is brittle and breaks for cron-triggered or background sends; one env var per deploy environment is the standard pattern | 2026-05-22 |
| Single `/auth/confirm` callback for all Supabase Auth email actions (signup, recovery, email-change) | Supabase's documented App Router pattern; one handler handles all `verifyOtp` types via the `type` query param | 2026-05-22 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| _To be added by /architecture_ | | |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
