# PROJ-3: Authentication & Account Approval Flow

## Status: In Progress
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

- [ ] Given `.env.local.example` is inspected, when the diff against PROJ-2 is viewed, then exactly one new entry has been added: `APP_URL="http://localhost:3000"` with an inline comment "Used as base URL for absolute links in transactional emails and server-action redirects. Server-side only — no `NEXT_PUBLIC_` prefix. In production: https://<your-domain>."
- [ ] Given `docs/production/auth.md` exists, when the deployer follows the file, then they find, in this order: (1) Supabase Auth settings (keep email confirmation enabled, password-policy recommendation "≥ 8 characters recommended", leave rate-limit defaults as-is), (2) the `APP_URL` env var setup per environment, (3) a pointer to `docs/production/email.md` (PROJ-2) for SMTP and Auth template configuration, (4) a "What to do if you decline a user by mistake" section with a Supabase Dashboard SQL snippet as the interim recovery path until PROJ-19.

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
- **`APP_URL` misconfigured (e.g. trailing
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
- **New env var:** `APP_URL` (used for absolute
  URLs in transactional emails and for the route-handler
  origin check). **No `NEXT_PUBLIC_` prefix** — the value
  is consumed exclusively server-side (email builders,
  server-action redirects, origin verification). Existing
  `SYSADMIN_NOTIFICATION_EMAIL` is consumed.
- **Runtime pin:** every route handler and server action
  that calls `sendMail()` declares `export const runtime =
  'nodejs'` at the module top. Mandatory per PROJ-2's
  forward constraint (nodemailer is Node-only; Edge runtime
  would break the send). Affected modules in PROJ-3:
  `src/app/auth/admin/[token]/[action]/route.ts`,
  `src/app/(auth)/auth/signup/actions.ts`. (The forgot-
  password server action does NOT call `sendMail()` — it
  delegates to Supabase Auth's native flow — so no pin is
  required.)
- **HTTPS-only URL policy for outgoing mail:** `APP_URL` is
  validated at module-load with a Zod schema that requires
  `protocol === 'https:'` in any non-development
  environment (`NODE_ENV !== 'development'`). Local dev
  permits `http://localhost:*` so the signup flow works
  without TLS termination on the dev machine. This is the
  single enforcement point for PROJ-2 finding L2 (caller
  must produce `https:` URLs only for `approveUrl`,
  `declineUrl`, `loginUrl`); since every URL passed to a
  PROJ-2 template in PROJ-3 is constructed from `APP_URL`,
  the protocol check on the base URL covers all three.
- **Signup-form name sanitisation (PROJ-2 finding L1
  mitigation):** the `/auth/signup` Zod schema rejects
  `\r`, `\n`, and other ASCII control characters in the
  `name` field and `.trim()`s leading/trailing whitespace
  before passing to `signupNotification()`. Enforced
  server-side as the source of truth; client-side hint
  text shown on rejection.
- **Caller-side Zod validation of template inputs:** PROJ-2's
  templates already `.parse()` their input schemas
  internally, but PROJ-3 still re-validates every value
  passed to them at the caller boundary (form-input Zod
  schema for user-supplied fields; URL Zod schema for
  generated URLs). Belt-and-braces: the template's parse is
  the last line of defence; PROJ-3's caller-side check
  produces user-actionable error messages instead of an
  uncaught template throw.
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
    origin matches `APP_URL`.
  - Approve/decline endpoints are GET to make sysadmin's
    email-client click work without form submission — this
    is a deliberate spec deviation from "POST for state-
    changing operations" because (a) the token is the auth,
    (b) idempotent re-click is part of the design, (c) every
    mainstream sysadmin-approval-via-link service does the
    same. Documented in Product Decisions.
  - `APP_URL` validated at signup-handler
    boundary (Zod URL parse) to prevent open-redirect or
    malformed URLs in outgoing mail.

## Open Questions

- [x] /architecture: split between middleware-level and
      layout-level route gating. **Resolved** — hybrid:
      middleware handles session refresh + public-path
      bypass + "no-user → /auth/login" redirects for
      private paths; `(app)` and `(auth)` route-group
      layouts handle status-based redirects. See Tech
      Design § Route gating.
- [x] /architecture: where to put the AuthShell + primitives.
      **Resolved** — `src/components/auth/`. Keeps
      `src/components/ui/` reserved for the official
      shadcn copy-paste set.
- [x] /architecture: server actions vs route handlers per
      endpoint. **Resolved** — actions for form posts;
      route handlers for GET callbacks (`/auth/confirm`,
      `/auth/admin/[token]/[action]`) and the no-JS
      `/auth/sign-out` POST.
- [x] /architecture: caching strategy for per-request
      `profiles.status`. **Resolved** — React `cache()`-
      wrapped helper `getCurrentProfile()` at
      `src/lib/auth/`.

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
| New env var `APP_URL` for absolute URLs in outgoing mail | Mail bodies need full URLs; reading from request headers in a server action is brittle and breaks for cron-triggered or background sends; one env var per deploy environment is the standard pattern | 2026-05-22 |
| Single `/auth/confirm` callback for all Supabase Auth email actions (signup, recovery, email-change) | Supabase's documented App Router pattern; one handler handles all `verifyOtp` types via the `type` query param | 2026-05-22 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Hybrid route gating: middleware enforces session presence + public-path bypass; `(app)` and `(auth)` route-group layouts enforce status-based redirects | Extends PROJ-1's existing `updateSession` middleware naturally; keeps approval-state logic colocated with the areas it gates; lets public paths (`/c/*`, `/auth/admin/*`, `/auth/confirm`) skip the per-request `profiles` lookup entirely | 2026-05-22 |
| `getCurrentProfile()` helper at `src/lib/auth/`, wrapped in React `cache()` for per-request memoisation | One DB roundtrip per request even if middleware + layout + page all need the profile; standard Next.js App Router pattern; parallel to `src/lib/supabase/` and `src/lib/email/` folder convention | 2026-05-22 |
| Auth UI primitives live in `src/components/auth/`, separate from `src/components/ui/` (shadcn) | Keeps the shadcn copy-paste set untouched and regenerable via the shadcn CLI; auth primitives are bespoke ports of `docs/design/auth.jsx`, not shadcn components | 2026-05-22 |
| Server actions for form posts; route handlers for GET callbacks and the no-JS sign-out POST | Server actions ship CSRF protection and integrate with `useActionState` for error reporting; route handlers cover the GET callbacks Supabase Auth dictates (`/auth/confirm`) and the sysadmin click-from-email (`/auth/admin/[token]/[action]`); `/auth/sign-out` is a POST route handler so a plain `<form>` works without JS on the waiting screen | 2026-05-22 |
| Two route groups under `src/app/`: `(app)` for protected app surfaces, `(auth)` for pre-auth screens; admin landing pages live outside both groups under `src/app/auth/admin/` | Route groups let each layout enforce its own redirect rule once, instead of every page repeating the check; admin landings need neither rule (token = auth) so they sit outside the groups | 2026-05-22 |
| Single `signup_approvals` row keyed by `user_id`; both approve and decline paths consume the same row | Matches the product decision "one token, two URL paths"; race-safe via `UPDATE … WHERE consumed_at IS NULL` returning row count for idempotency | 2026-05-22 |
| Token generation centralised in a tiny `src/lib/auth/token.ts` module (`crypto.randomBytes(32).toString('base64url')`) | One canonical implementation; future tokens (scenario share tokens, calculator publish tokens) can reuse the same primitive | 2026-05-22 |
| Origin check on route handlers compares `request.headers.get('origin')` against `APP_URL`; server actions inherit Next.js's built-in origin check | Defence-in-depth for the POST handlers without re-implementing CSRF; URL is already required for outgoing mail so no additional config surface | 2026-05-22 |
| The `/auth/confirm` route handler dispatches on `type` query param to the right post-callback page; unknown `type` and missing `token_hash` fall through to a single generic "link no longer valid" error landing | One handler for all Supabase Auth callbacks (signup, recovery, future email-change); failure modes converge to one user-facing screen | 2026-05-22 |
| Form-validation Zod schemas live next to each server action (`src/app/auth/signup/schema.ts` etc.), not in a shared `src/lib/validation/` barrel | Schemas are owned by a single feature surface; co-location keeps them discoverable and avoids a shared-types module that grows unmaintained | 2026-05-22 |
| `APP_URL` env var has no `NEXT_PUBLIC_` prefix (downgraded from the spec's working name `NEXT_PUBLIC_APP_URL`) | Value is consumed exclusively server-side (email URL builders, server-action redirects, route-handler origin check); shipping it in the client bundle would violate the project convention "anything `NEXT_PUBLIC_` ships to the browser, so don't prefix what doesn't need to" and would needlessly expose the deployment hostname in client JS | 2026-05-22 |
| `signup_approvals` ships with RLS enabled and zero policies (intentional service-role-only posture) | Token-knowledge is the authentication model — an end-user RLS path can't make a correct decision. Migration carries a SQL comment calling this out so it doesn't get misread as a missing policy in future reviews. Mirrors the pattern PROJ-1 uses for server-managed tables | 2026-05-22 |
| Runtime pin `export const runtime = 'nodejs'` on every PROJ-3 module that calls `sendMail()` (signup server action + admin GET handler) | Forward constraint from PROJ-2 (nodemailer is Node-only); pin prevents an accidental Edge migration from silently breaking transactional email | 2026-05-22 |
| HTTPS-only enforcement for outgoing-mail URLs done once at the `APP_URL` Zod boundary, not at each call site | `APP_URL` is the sole base for `approveUrl` / `declineUrl` / `loginUrl` in PROJ-3, so one protocol check on the base value covers PROJ-2 finding L2 for all three. Localhost http allowed in `NODE_ENV=development` only | 2026-05-22 |
| Signup-form `name` field Zod schema strips control characters (`\r`, `\n`, etc.) and trims whitespace before any template call | Mitigates PROJ-2 finding L1 (plain-text body injection via name); server-side enforcement is authoritative, client hint is cosmetic | 2026-05-22 |
| Caller-side Zod validation of template inputs is standing practice across PROJ-3, even though PROJ-2 templates re-`.parse()` internally | Belt-and-braces: caller-side check produces user-actionable error messages and surfaces bad data at the form-handling boundary; template-side parse remains the last line of defence | 2026-05-22 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A. Routes and pages — the full surface

Two route groups under `src/app/`:

```
src/app/
├── (auth)/                    ← layout enforces: approved users → /dashboard
│   ├── layout.tsx             ← AuthShell wrapper + redirect-if-approved
│   └── auth/
│       ├── login/             ← server action: signInWithPassword
│       ├── signup/            ← server action: signUp + insert signup_approvals + sendMail
│       ├── forgot-password/   ← server action: resetPasswordForEmail
│       ├── reset-password/    ← server action: updateUser({ password })
│       ├── reset-success/     ← static confirmation page
│       ├── sent-confirmation/ ← static confirmation page (?type=signup|reset)
│       └── waiting-for-approval/  ← shown to pending + declined users
├── (app)/                     ← layout enforces: only approved users; else redirect
│   ├── layout.tsx             ← AppShell stub (real shell ships in PROJ-4)
│   ├── dashboard/             ← placeholder until PROJ-5
│   ├── editor/                ← placeholder until PROJ-8
│   └── settings/              ← placeholder until PROJ-14
└── auth/                      ← outside both groups; no status gating
    ├── confirm/               ← route handler: dispatches all Supabase OTP callbacks
    ├── sign-out/              ← POST route handler
    └── admin/
        └── [token]/
            └── [action]/      ← GET route handler + landing page (approve | decline)
```

The `/c/<token>` visitor surface (PROJ-11) lives elsewhere and
is bypassed by middleware entirely.

### B. Component tree — auth pages

```
AuthShell (full-bleed, theme-aware, wordmark header)
└── single column, max-width 360 desktop / 100% mobile
    ├── (optional) AuthErrorBanner — server-action errors
    ├── AuthMessage — title + body (confirmation/waiting screens)
    ├── AuthGlyph — Clock | Mail | Check | X (icon-in-circle)
    ├── form
    │   ├── AuthField (label + AuthInput)
    │   └── AuthSubmit
    ├── AuthHelpText / AuthDivider / AuthFootLine
    └── AuthLink — navigation between auth surfaces
```

These primitives are ports of `docs/design/auth.jsx` into
shadcn-style Tailwind components. They live in
`src/components/auth/`. The eight page-level components
(`LoginScreen`, `RequestAccessScreen`, etc.) become the
default exports of `src/app/(auth)/auth/<slug>/page.tsx`.

### C. Data model — `signup_approvals`

One row per signup, owned by the server.

```
signup_approvals
├── id            UUID PK (default gen_random_uuid)
├── user_id       UUID FK → auth.users.id, ON DELETE CASCADE, UNIQUE
├── token         TEXT NOT NULL UNIQUE (43-char base64url, 32 random bytes)
├── created_at    TIMESTAMPTZ DEFAULT NOW()
├── consumed_at   TIMESTAMPTZ NULL  (set on first click)
└── outcome       TEXT NULL CHECK (outcome IN ('approved','declined'))
```

`UNIQUE(user_id)` enforces "one approval row per user" — a
repeat signup attempt would have already been rejected by
Supabase Auth's duplicate-email constraint, but the unique
index is a defence-in-depth backstop.

RLS is **enabled and intentionally policy-free** for the
`authenticated` and `anon` roles. This is not a
misconfiguration — it is the explicit posture for a
service-role-only table whose authentication model is
"knowledge of the token = right to consume the row". No
end-user RLS path can produce a correct authorisation
decision here (the token-as-credential model collapses if
queried from a logged-in user context), so we deny all
direct access and route every read/write through the
server's admin client. The table is touched only by:

1. The signup server action (service-role insert).
2. The `/auth/admin/[token]/[action]` route handler (service-
   role lookup + update, gated by token-knowledge as
   authentication).

Both run on the server with the `SUPABASE_SECRET_KEY` client
(PROJ-1's `createAdminClient`) so they bypass RLS. End-users
never read or write this table. The migration includes a
SQL comment on the table calling out this posture so a
future reviewer doesn't misread the empty policy list as a
gap.

Idempotent consume is enforced at the DB level: the UPDATE
filters `WHERE consumed_at IS NULL`. If the row count returned
is zero, the handler renders the "Already …" landing instead
of writing again.

### D. Route gating — three-layer hybrid

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: middleware.ts                                       │
│   • Refreshes Supabase session (existing PROJ-1 behaviour)   │
│   • Public paths bypass: /c/*, /auth/admin/*, /auth/confirm, │
│     /auth/sign-out (POST), _next/*, static assets            │
│   • If path is private AND no user: 302 /auth/login?next=…   │
│   • No DB lookup beyond the session refresh                  │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│ Layer 2a: (app)/layout   │   │ Layer 2b: (auth)/layout  │
│   • getCurrentProfile()  │   │   • getCurrentProfile()  │
│   • If status≠approved:  │   │   • If status=approved:  │
│       302 /auth/         │   │       302 /dashboard     │
│       waiting-for-       │   │   • Else render <Auth-   │
│       approval           │   │       Shell> wrapper     │
│   • Else render children │   │                          │
└──────────────────────────┘   └──────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: page-level — pages don't gate; they trust layout   │
│   (Except /auth/waiting-for-approval which has its own       │
│    pending-or-declined check since it must accept that       │
│    state instead of redirecting away from it.)               │
└─────────────────────────────────────────────────────────────┘
```

The `getCurrentProfile()` helper is wrapped in React's
`cache()` — calling it from middleware, layout, and a page
within the same request only triggers one DB query.

The 15-case route-gate test matrix in Acceptance Criteria
maps directly onto this three-layer architecture: middleware
covers cases 1–7 (anonymous redirects + public bypasses);
`(app)/layout` covers cases 8–9 + 15 (status-based blocks);
`(auth)/layout` covers cases 10, 12–14 (status-based
redirects-out); the waiting page covers case 11.

### E. Server-side endpoints — actions vs handlers

| Endpoint                          | Type           | Reason |
|-----------------------------------|----------------|--------|
| `/auth/signup` (POST)             | Server action  | Form post, useActionState for inline errors, built-in CSRF |
| `/auth/login` (POST)              | Server action  | Same |
| `/auth/forgot-password` (POST)    | Server action  | Same |
| `/auth/reset-password` (POST)     | Server action  | Same |
| `/auth/sign-out` (POST)           | Route handler  | No-JS `<form action="/auth/sign-out">` on waiting screen needs a public POST endpoint |
| `/auth/confirm` (GET)             | Route handler  | Supabase OTP callback link clicked from email; dispatches on `?type=…` |
| `/auth/admin/[token]/[action]` (GET) | Route handler | Sysadmin clicks link from email client; GET-as-state-change is intentional (idempotent, token-authed) |

All server-side modules import from `@/lib/supabase/server`
(SSR client) or `@/lib/supabase/admin` (service-role client).
The admin client is used only inside the signup action's
notification path and the approve/decline handler.

### F. Library code

```
src/lib/auth/
├── getCurrentProfile.ts   ← React-cached helper returning { user, profile } | null
├── route-gate.ts          ← Pure function: (path, user, status) → redirect | pass
├── route-gate.test.ts     ← The 15-case matrix from Acceptance Criteria
└── token.ts               ← randomToken() = base64url(32 random bytes)

src/components/auth/
├── auth-shell.tsx
├── auth-field.tsx
├── auth-input.tsx
├── auth-submit.tsx
├── auth-error-banner.tsx
├── auth-glyph.tsx
├── auth-icons.tsx         ← Clock | Mail | Check | X (inline SVG)
├── auth-message.tsx
├── auth-link.tsx
├── auth-divider.tsx
├── auth-foot-line.tsx
└── auth-help-text.tsx

src/app/auth/admin/[token]/[action]/
├── route.ts               ← GET handler: lookup, consume, redirect to landing
├── page.tsx               ← Landing UI (approved | declined | already-… | invalid)
└── process.test.ts        ← All five branches from Acceptance Criteria

src/app/auth/confirm/
├── route.ts
└── route.test.ts
```

The route handler at `route.ts` performs the DB transaction
then **renders** the landing by setting a flash cookie or
short-lived signed cookie that the `page.tsx` reads on next
GET — alternatively, the handler can render the page directly
with the result encoded in a redirect to a query-string
variant (`?result=approved|declined|already-approved|invalid`).
The `/backend` skill picks the concrete shape; both satisfy
the AC. (The query-string variant is simpler and is the
working preference.)

### G. Middleware extension — concrete behaviour

Middleware (`middleware.ts` at repo root) keeps PROJ-1's
`updateSession` call and adds, after the session refresh:

1. If `pathname` starts with any of: `/c/`, `/auth/admin/`,
   `/auth/confirm`, `/auth/sign-out`, `/api/cron/`, or
   matches the existing static-asset exclusions → return
   unchanged.
2. If `pathname` starts with `/auth/` (any non-public auth
   path) → return unchanged (the `(auth)` layout handles
   redirects).
3. Otherwise (private path: `/dashboard`, `/editor/*`,
   `/settings`, `/api/*` not under `/api/cron/`):
   - If user is null → 302 `/auth/login?next=<pathname>`.
   - Else → return unchanged; `(app)` layout will run the
     status check next.

The middleware never reads `profiles` — it only inspects the
Supabase user from `getUser()`. This keeps the public-path
hot paths (visitor URLs, admin clicks) free of database
roundtrips.

### H. Email integration

The signup action calls `sendMail()` with the
`signupNotification` template (PROJ-2). It uses
`APP_URL` to construct two absolute URLs:
`${APP_URL}/auth/admin/${token}/approve` and
`.../decline`. URL validity is enforced via a Zod URL parse
at the boundary — a malformed `APP_URL` throws a clear
deployer-config error at the first signup attempt rather
than producing broken links silently.

The approve handler calls `sendMail()` with the
`approvalConfirmation` template after the DB transaction
commits. The mail send is wrapped in `try/catch`; failure
logs `console.error` and the landing page surfaces a warning
banner ("approved but email failed"). The decline path sends
no mail (silent rejection per Product Decisions).

### I. Migration

One new migration: `supabase/migrations/<ts>_signup_approvals.sql`.

After `supabase db push`, regenerate types per CLAUDE.md
convention:

```
npx supabase gen types typescript --linked > src/lib/supabase/types.ts
```

### J. New dependencies

None expected. The stack already includes:
- `@supabase/ssr` + `@supabase/supabase-js` (PROJ-1)
- `react-hook-form` + `@hookform/resolvers` + `zod` (template)
- Node's built-in `crypto` for token generation

If `react-hook-form` is not yet installed in the template,
the `/frontend` skill installs it before building the forms.

### K. Environment variables

One new entry in `.env.local.example`:

```
APP_URL="http://localhost:3000"
# Used as base URL for absolute links in transactional emails.
# In production: https://<your-domain>.
```

`docs/production/auth.md` documents the per-environment
setup, the password-policy recommendation (≥ 8 chars in
Supabase Dashboard), and the "I declined someone by mistake"
recovery SQL snippet.

### L. Tech decisions justified for PM (plain language)

- **Why a separate `signup_approvals` table** instead of
  columns on `profiles`? Approval is a one-time, single-
  use event with its own token; mixing it into `profiles`
  would couple two unrelated lifecycles (the user's permanent
  account and the one-time approval click). Separate table
  makes the "consumed yet?" check trivially safe under
  concurrent clicks and lets the row be deleted later
  without disturbing `profiles`.

- **Why hybrid middleware + layout gating** instead of one
  or the other? Middleware sees every request and is the
  cheapest place to redirect anonymous users away from
  protected paths. But middleware shouldn't read `profiles`
  on every request — that would hit the DB on public URLs
  like `/c/<token>` (the visitor surface) and add latency.
  Layouts only run when a request reaches them; doing the
  `profiles.status` check there means we pay the DB cost
  only on app-area requests, where we'd be paying it anyway.

- **Why React `cache()` for the profile lookup**? Multiple
  server components in the same request may need the
  current user (layout, page header, page body). Without
  caching, each call hits the DB. React's request-scoped
  cache deduplicates them automatically. It's the standard
  Next.js App Router pattern.

- **Why GET for approve/decline** instead of POST? The
  click happens in the sysadmin's email client. Email
  clients don't submit forms — they open links. GET is the
  only option that works. The design absorbs the trade-offs
  (idempotent re-click, no session needed, token-as-auth)
  intentionally; every signup-approval-by-link service uses
  the same pattern.

- **Why server actions for the four form posts** instead of
  route handlers? Server actions ship CSRF protection
  automatically and pair cleanly with `useActionState` for
  inline form errors. Route handlers force us to re-
  implement both. Where Next.js doesn't give us a server
  action (GET callbacks, no-JS POST), we drop to route
  handlers.

### M. PROJ-2 forward-constraint compliance matrix

PROJ-2 exited QA with five Low findings that the QA review
declared "caller-responsibility per spec". Four of them
land in PROJ-3 (the fifth, `recipientName` validation in
the deletion template, lands in PROJ-14). This section is
the consolidated answer for the `/frontend` and `/backend`
implementers — every box must be ticked by the time
PROJ-3 hits QA.

| PROJ-2 finding | PROJ-3 mitigation | Module where enforced |
|----------------|-------------------|-----------------------|
| **L1** Plain-text body injection via `name` field | Signup-form Zod schema strips ASCII control characters (`\r`, `\n`, etc.) and trims whitespace before passing `newUserName` to `signupNotification()`. Server-side validation is authoritative. | `src/app/(auth)/auth/signup/schema.ts` |
| **L2** Caller must produce `https:` URLs only | `APP_URL` validated at module load with a Zod schema that requires `protocol === 'https:'` outside `NODE_ENV=development`. All outgoing-mail URLs (`approveUrl`, `declineUrl`, `loginUrl`) are derived from `APP_URL`, so the one boundary check covers all three. | `src/lib/auth/app-url.ts` (single source of `APP_URL`) |
| **Runtime pin** `export const runtime = 'nodejs'` on every caller of `sendMail()` | Top-of-module pin on the two modules that call `sendMail()` in PROJ-3. (Forgot-password action delegates to Supabase Auth's native flow and is unaffected.) | `src/app/(auth)/auth/signup/actions.ts` and `src/app/auth/admin/[token]/[action]/route.ts` |
| **Caller-side Zod re-validation** of template inputs | Standing practice. Every PROJ-3 call site that invokes `signupNotification()` or `approvalConfirmation()` passes values that have already been Zod-parsed at the caller boundary (form schema for user input, URL schema for generated URLs). | All `sendMail()` call sites in PROJ-3 |

The `app-url.ts` module owns one named export — the
validated absolute URL string — and is the only allowed
reader of `process.env.APP_URL` in PROJ-3 code. This
prevents accidental bypass of the protocol check by
inlining `process.env.APP_URL` elsewhere.

## Implementation Notes — Frontend (2026-05-22)

`/frontend` completed the UI surface and form wiring. Backend
work (DB migration, route handlers for the admin landing and
`/auth/confirm`, the no-JS `/auth/sign-out` POST, and the
middleware extension) is handed off to `/backend`.

### Shipped

- **Env scaffolding.** Added `APP_URL` to `.env.local.example`
  with the documented inline comment. New module
  `src/lib/auth/app-url.ts` is the single source of truth — Zod-
  validated at module load, rejects trailing slashes, requires
  `https:` outside `NODE_ENV=development` (PROJ-2 finding L2,
  single boundary).
- **Auth UI primitives** ported from `docs/design/auth.jsx` into
  `src/components/auth/` (Tailwind + shadcn-style):
  `AuthShell`, `AuthField`, `AuthInput`, `AuthSubmit` (uses
  `useFormStatus` for pending state), `AuthLink`, `AuthDivider`,
  `AuthFootLine`, `AuthHelpText`, `AuthErrorBanner` (error +
  warning variants), `AuthGlyph` (muted / accent variants),
  `AuthMessage`, `AuthIcons` (Clock / Mail / Check / X inline
  SVG). Re-exported via `src/components/auth/index.ts`.
- **Theme.** Wired `next-themes` via
  `src/components/theme-provider.tsx`; root layout uses
  `attribute="class"` + `defaultTheme="system"`. Added
  `--auth-accent / --auth-accent-foreground / --auth-link /
  --auth-accent-soft / --auth-surface-muted` CSS vars and the
  corresponding Tailwind colour aliases.
- **Route groups.**
  - `src/app/(auth)/layout.tsx` — wraps children in `AuthShell`
    and 302s approved users to `/dashboard`.
  - `src/app/(app)/layout.tsx` — 302s anonymous users to
    `/auth/login` and non-approved users to
    `/auth/waiting-for-approval` (PROJ-4 will replace the
    placeholder shell with the real top bar).
- **Auth pages (8).** Login, signup, forgot-password,
  reset-password, reset-success, sent-confirmation,
  waiting-for-approval — each as a Server Component page
  rendering a client form component that uses `useActionState`.
  Pages match the layout fidelity of the prototype (wordmark,
  ~360px column, glyphs, dividers, foot-lines). Visual identity
  uses Tailwind tokens + the new `--auth-accent*` vars so
  light / dark / system theme switching works.
- **Server actions and schemas.**
  - `loginAction` — Supabase `signInWithPassword`, then status-
    based redirect (`approved` → `?next` / `/dashboard`,
    `pending|declined` → `/auth/waiting-for-approval`). Returns
    "No account exists" vs. "Wrong password" inline based on a
    profile-table probe (PRD: enumeration defense not a v1 goal).
  - `signupAction` — pre-flight email-exists probe, Supabase
    `signUp`, profile name update, insert into `signup_approvals`
    with a fresh 32-byte token, fire `signupNotification` mail.
    At-least-once: SMTP failure is logged but does NOT roll back
    the signup (PROJ-2 design).
  - `forgotPasswordAction` — profile probe (returns "No account
    exists" for unknown emails), then Supabase
    `resetPasswordForEmail`.
  - `resetPasswordAction` — Zod schema with `refine` for matching
    passwords; Supabase `updateUser({ password })` on success.
  - All actions invoke `signupSchema` / `loginSchema` / etc.
    co-located next to each action (per Tech Design).
  - Signup schema strips ASCII control chars (`\x00–\x1F`,
    `\x7F`) from `name` and trims whitespace — PROJ-2 finding L1
    mitigation.
- **Token helper.** `src/lib/auth/token.ts` exports `randomToken()`
  (`randomBytes(32).toString('base64url')`). The signup action
  consumes it directly; the route handler at `route.ts` will
  consume it after `/backend` builds it.
- **Profile helper.** `src/lib/auth/getCurrentProfile.ts` —
  React-cached `getCurrentProfile()` returning
  `{ user, profile } | null`. Middleware + layout + page share a
  single Supabase round-trip per request.
- **Form-state contract.** Shared `FormState` and
  `initialFormState` from `src/lib/auth/form-state.ts` —
  field-level errors, banner-level error, optional inline-link
  CTA, echoed values for re-render.
- **Admin landing page** at
  `src/app/auth/admin/[token]/[action]/page.tsx` — renders the
  five result variants (`approved`, `declined`, `already-approved`,
  `already-declined`, `invalid`) via `?result=…` query param
  (with `name`, `email`, `date`, `mailError` companions). 404s on
  any `action` other than `approve` / `decline`. The page is
  pure UI; `/backend` adds the sibling `route.ts` that performs
  the DB transaction and redirects here.
- **App stub pages.** `/dashboard`, `/editor/[id]`, `/settings`
  exist as protected placeholders (gated by `(app)/layout`).
  Real implementations land in PROJ-5 / PROJ-8 / PROJ-14.
- **Root redirect.** `src/app/page.tsx` redirects based on
  current profile state (approved → `/dashboard`, signed-in →
  `/auth/waiting-for-approval`, anonymous → `/auth/login`),
  replacing the template scaffolding.
- **Types stub.** Added a manual `signup_approvals` entry to
  `src/lib/supabase/types.ts` with a comment noting `/backend`
  will overwrite it on the next `supabase gen types` run.

### Deferred to `/backend`

- `signup_approvals` migration + RLS posture (table + UNIQUE +
  policy-free RLS comment).
- `src/app/auth/admin/[token]/[action]/route.ts` GET handler —
  lookup, idempotent consume (`WHERE consumed_at IS NULL`),
  `profiles.status` update, conditional `approvalConfirmation`
  send, redirect to landing with `?result=…`.
- `src/app/auth/confirm/route.ts` GET handler — dispatches on
  `type` (signup / recovery / future email_change) and verifies
  the OTP.
- `src/app/auth/sign-out/route.ts` POST handler.
- Middleware extension — public-path bypass + 302 to
  `/auth/login?next=…` for private paths.
- `src/lib/auth/route-gate.ts` (pure function + the 15-case test
  matrix).
- Test files: `signup/actions.test.ts`,
  `admin/[token]/[action]/process.test.ts`,
  `auth/confirm/route.test.ts`,
  `tests/PROJ-3-auth-flow.spec.ts` (Playwright).
- `docs/production/auth.md`.

### Build & lint status

- `npm run build` → green (13 routes generated, including all 8
  auth surfaces and the admin landing).
- `npm run lint` → no errors, no warnings.
- Manual smoke: all auth surfaces return 200; root, `/dashboard`,
  and `/auth/waiting-for-approval` correctly 307 anonymous
  visitors to `/auth/login`.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
