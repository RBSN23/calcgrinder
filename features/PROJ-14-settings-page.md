# PROJ-14: Settings Page

## Status: Approved
**Created:** 2026-05-24
**Last Updated:** 2026-05-24

## Dependencies

- **PROJ-3** — extends the dormant `email_change` branch of
  `/auth/confirm`, reuses `AuthShell` and `EmptyOrErrorState`
  primitives for confirmation landings, reuses the route-group
  gating model (`(app)` for `/settings`, plain `auth/` for the
  unauthenticated confirmation landings), reuses the
  `signup_approvals` pattern (single-use server-minted token →
  GET URL → idempotent re-click) for the deletion-confirm
  link, reuses the `crypto.randomBytes(32).toString('base64url')`
  token primitive from `src/lib/auth/token.ts`, and reuses
  the `getCurrentProfile()` helper for per-request profile
  reads. Adds a new `status` value (`pending_deletion`) to
  the existing `profiles.status` enum that PROJ-3's route
  gate already inspects.
- **PROJ-2** — calls `sendMail()` and the existing
  `accountDeletionConfirmation` template. No new templates
  added. Supabase Auth's built-in "Change Email Address"
  template (installed by PROJ-2) is what carries the
  email-verification link for the email-change flow.
- **PROJ-4** — `/settings` is already routed and rendered as
  a placeholder inside the `(app)` route group; PROJ-14
  replaces the placeholder. The avatar popover's "Theme"
  segmented control writes the same `next-themes` localStorage
  key that the Settings "App theme" control writes; both
  controls stay in sync because they read from the same
  source. The popover's name display picks up Settings edits
  on next navigation (already specified in PROJ-4).
- **PROJ-6** — calls `getDefaultThemeId()` as the fallback
  when the user's `profiles.default_calculator_theme` is NULL,
  and uses `listThemes()` to populate the "Default calculator
  theme" dropdown. PROJ-14 introduces the per-user override
  hook PROJ-6's Decision Log already flagged.
- **PROJ-10** — when a user enters the grace window
  (`status='pending_deletion'`), all calculators owned by
  that user become invisible on the `/c/<token>` visitor
  surface as if soft-deleted; the existing PROJ-11 410-Gone
  page handles the visitor UX without modification. The
  underlying read query in PROJ-10's `getCalculatorByToken`
  (or the equivalent visitor-read path) must filter out
  rows whose owner is in `pending_deletion`.
- **PROJ-13** — extends the existing daily cron (or runs
  alongside it; architecture choice) to hard-purge
  `auth.users` rows whose owner profile has been in
  `pending_deletion` past `RETENTION_PERIOD_DAYS`. The
  per-row cascade (calculators, sections, cells, scenarios)
  already exists from PROJ-1 / PROJ-13 — PROJ-14 only
  triggers the auth-user delete and lets the FK cascade run.

## User Stories

- As a registered user, I want to update my display name
  from Settings so the avatar popover and any future
  user-visible surfaces reflect the right name.
- As a registered user, I want to change the email address
  associated with my account by entering a new one in
  Settings and confirming via a verification link sent to
  the new address, so I can move my account to a new mailbox
  without losing my calculators.
- As a registered user, I want to cancel an in-flight email
  change before clicking the verification link, so I'm not
  stuck waiting for a typo'd address to verify.
- As a registered user, I want to change my password from
  Settings by entering my current password plus a new one
  twice, so I can rotate credentials without going through
  the forgot-password flow.
- As a registered user, I want to pick an app theme (Light /
  Dark / System) from Settings and have it stick across
  sessions on this browser, so my Settings preference matches
  what I set in the avatar popover.
- As a registered user, I want to pick a default calculator
  theme that applies to every new calculator I create, so I
  don't have to switch themes on every fresh calculator.
- As a registered user, I want to delete my account from
  Settings with a confirmation that the action is destructive
  and gives me a grace period to change my mind, so I'm not
  one-click away from losing everything I've built.
- As a registered user who clicked the delete-account link
  in my email, I want to be told my account is scheduled for
  deletion in `RETENTION_PERIOD_DAYS` days and that I can
  sign back in to cancel, so I have a clear path to recover
  if I change my mind.
- As a user whose account is in the grace window, I want to
  sign back in and be taken straight to a "Cancel deletion"
  screen, so I can rescue the account without confusion
  about why the dashboard is missing.
- As a sysadmin, I want my "Delete account" button to be
  visibly disabled with a clear reason, so I don't strand
  the instance by deleting the last sysadmin.
- As a registered user, I want my Role row to surface
  whether I'm a Sysadmin (read-only, with a pill), so I know
  my permissions without inspecting elsewhere.

## Out of Scope

PROJ-14 ships the user-facing Profile / Security / Preferences /
Danger-zone surface plus the email-change and account-deletion
confirmation flows. Adjacent concerns belong to later features:

- **Sysadmin moderation UI / "un-decline" / promote a user to
  sysadmin / demote a sysadmin.** PROJ-19. PROJ-14 surfaces
  the Sysadmin pill on the Role row but does **not** expose
  any role-modification control.
- **Self-promote to sysadmin on the seed-script path.**
  Already shipped via `npm run seed:sysadmin -- --promote
  <email>` from PROJ-1 / PROJ-3 follow-up. Settings does
  not duplicate that affordance.
- **Account data export ("download your data before deleting").**
  Not in v1 — single-deployer low-volume context, no GDPR
  obligation surfaced. Manual SQL pull via Supabase Dashboard
  remains the deployer's interim path. Documented as a v2
  candidate.
- **Visitor-side "clone this soft-deleted calculator before
  it's purged"** affordance during the grace window. The
  visitor sees the existing PROJ-11 410-Gone page exactly as
  for a per-calculator soft-delete. The clone-during-window
  feature is owned by **PROJ-18 (Cloning & Preset
  Discoverability)** and, when it ships, will apply
  symmetrically to both per-calculator soft-deletes (PROJ-13)
  and account-deletion-cascade soft-deletes (PROJ-14). PROJ-14
  changes nothing in the visitor view beyond making the owner's
  calculators read as soft-deleted.
- **"Your account was deleted" final email** sent at hard-
  purge time after the grace window expires. Out of scope —
  the user already received the "scheduled for deletion in N
  days, sign back in to cancel" confirmation email at the
  start of the window, which is the only required touchpoint.
  Silent cron purge after expiry. No new email template
  introduced by PROJ-14.
- **MFA / 2FA / per-device session management / "Sign out
  of all sessions"** in the Security section. Not in v1.
  Password change is the only Security control.
- **Account-deletion-link expiry** beyond single-use
  consumption. Tokens never expire — same posture as PROJ-3's
  approve/decline tokens; the grace window is the actual
  time-bound mechanic, not the click window. Re-clicking a
  consumed deletion link renders an "Already scheduled" or
  "Already deleted / cancelled" read-back landing.
- **Resending the email-change verification link** if the
  user clicks "Resend link". Out of scope as an implemented
  capability — Supabase Auth does not expose a public
  resend-email-change-OTP API, and re-calling
  `updateUser({ email })` with the same new email would
  invalidate the prior token. **Cancel-change** (clearing
  the pending state) is implemented; **Resend** is documented
  as a known caveat in the design and the helper text is
  re-worded to "If the link didn't arrive, cancel the change
  and start over." See Product Decisions.
- **Sysadmin-only "Notification email" override** (per-account
  override of `SYSADMIN_NOTIFICATION_EMAIL`). Out of scope —
  the notification address is a deployer env var, not a
  per-user setting.
- **Bulk preference reset** ("reset to defaults" button).
  Not needed for the small preference set in v1.
- **Internationalisation / locale switcher.** English only
  per PRD non-goal.
- **Analytics / activity log / audit trail** on settings
  changes (e.g. "Password changed on 2026-05-24"). Not in
  v1 per PRD non-goal on analytics.
- **Per-cell or per-calculator overrides exposed in
  Settings.** Calculator-level settings live in the Editor
  (PROJ-8 / PROJ-9 / PROJ-10); Settings is account-wide
  preferences only.
- **Avatar / profile picture upload.** Initials-fallback
  remains the only avatar in v1 (PROJ-4 already covers the
  fallback rule).

## Acceptance Criteria

**Format:** Given [precondition] / When [action] /
Then [result]

### Page surface — chrome & layout

- [ ] Given an approved user navigates to `/settings`, when the page renders inside the `(app)` route group, then the AppShell top bar shows the "Dashboard / Settings" breadcrumb with Settings active (existing PROJ-4 behaviour), the document title is "Settings · Calcgrinder", and the main column is single-column max-width 640px centred with sections in this order from top to bottom: Profile → divider → Security → divider → Preferences → Danger zone.
- [ ] Given the same page is opened on a viewport < 768px, when the page renders, then the mobile top bar's centre slot shows the text "Settings" (existing PROJ-4), and the column is full-bleed with 20px horizontal padding and the same section order.
- [ ] Given an anonymous browser opens `/settings`, when the middleware/layout gate evaluates, then it 302s to `/auth/login?next=/settings` (existing PROJ-3 behaviour — PROJ-14 changes nothing here).
- [ ] Given a `pending` or `declined` user opens `/settings`, when the gate evaluates, then it 302s to `/auth/waiting-for-approval` (existing PROJ-3 behaviour).
- [ ] Given a `pending_deletion` user opens `/settings`, when the gate evaluates, then it 302s to `/auth/cancel-deletion` (new in PROJ-14 — `pending_deletion` is added to the status enum and gated identically to `pending` / `declined`, but redirects to its own dedicated screen).

### Profile section — Name

- [ ] Given the Profile section is rendered for the current user, when the Name row is inspected, then it shows the label "Name", an inline-editable text input prefilled with `profiles.name` (or empty if NULL), and helper text "Shown on your account menu."
- [ ] Given the user types a new value in the Name field and blurs out (Tab / click outside / submits a focused enter on the field), when the on-blur server action fires, then it writes the new name to `profiles.name`, the helper text briefly swaps to an inline success caption "Saved" (auto-dismisses ~3 s later), and a subsequent navigation to any page that reads the name (e.g. the avatar popover) shows the new value.
- [ ] Given the user types a value with leading or trailing whitespace, when the on-blur action fires, then the server-side Zod schema (re-used from PROJ-3's signup schema) trims whitespace before writing and rejects control characters (`\r`, `\n`, etc.) with an inline error caption "Name can't contain line breaks or control characters." (the input keeps the user's last typed value so they can correct it).
- [ ] Given the user clears the Name field entirely and blurs out, when the action fires, then `profiles.name` is set to NULL (empty allowed — the seeded sysadmin pattern), the success caption shows, and the avatar popover falls back to the email-local-part initials (existing PROJ-4 behaviour).
- [ ] Given the user types a value > 80 characters and blurs out, when the Zod schema fails, then an inline error caption "Name must be 80 characters or fewer." is shown and the DB is not written.
- [ ] Given the on-blur write fails with a network error, when the action throws, then the input shows an inline error caption "Couldn't save — try again." and the input retains the user's last typed value (no rollback to the prior server value until the user takes a positive action).

### Profile section — Email (happy path)

- [ ] Given the Profile section is rendered, when the Email row is inspected, then it shows the label "Email", an inline-editable input prefilled with the current `auth.users.email`, and helper text "We'll send a verification link to your new address before changing it."
- [ ] Given the user types a new valid email and blurs out, when the on-blur server action calls `supabase.auth.updateUser({ email: <new> })`, then Supabase Auth records `email_change_token_new`, fires its built-in "Change Email Address" template to the new address, and on success the Settings page enters the "pending" variant: the input shows the **old** email value (not the new one) with the yellow `Pending` pill suffix, and the helper text swaps to "A verification link was sent to `<new-email>`. Your email will change once you confirm. **Cancel change**."
- [ ] Given the pending variant is rendered, when the user clicks the verification link in their inbox, then they land via the existing PROJ-3 `/auth/confirm?token_hash=…&type=email_change` callback handler (its dormant `email_change` branch is activated by PROJ-14), Supabase Auth swaps `auth.users.email` to the new value, the user is redirected to a new `/auth/email-confirmed` landing page rendered with `AuthShell` + `EmptyOrErrorState` (variant `success`) showing the green check glyph + "Email address updated" + body "You can now sign in with `<new-email>`. The old address is no longer linked to your account." + a primary "Continue to dashboard" button linking to `/dashboard`.
- [ ] Given the user returns to `/settings` after the email-change is confirmed, when the page renders, then the Email row shows the new email as the current value, no pending pill, and the helper text reverts to the default copy.

### Profile section — Email (cancel & errors)

- [ ] Given the Email row is in the pending variant, when the user clicks the "Cancel change" link in the helper text, then a server action clears the pending email-change state (admin-API call to clear `auth.users.email_change` / `email_change_token_new` — architecture chooses the exact mechanism), the helper text reverts to the default copy, the pending pill disappears, the input shows the original email, and the prior verification link in the inbox is rendered invalid (clicking it lands on the generic "This link is no longer valid" error variant via `/auth/confirm`'s failure branch).
- [ ] Given the user submits a syntactically invalid email and blurs out, when the on-blur action's Zod schema fails, then no Supabase call is made, the input keeps the typed value with an error border, and an inline error caption reads "Enter a valid email address."
- [ ] Given the user submits an email that already belongs to another `auth.users` row, when Supabase Auth returns the duplicate-email error, then the input shows the error border + inline caption "An account with this email already exists." (verbatim from PROJ-3's enumeration-disclosure posture — this surface is post-auth, behind a logged-in session, so the disclosure is consistent with the rest of the app).
- [ ] Given the user submits their **own** current email (no change), when the on-blur action detects equality before calling Supabase, then no DB write occurs, no email is sent, and no success caption is shown (silent no-op).
- [ ] Given the on-blur `updateUser({ email })` call throws (Supabase Auth 5xx, network failure), when the action catches the exception, then the input shows an error border + caption "Couldn't update — try again." and the Settings page does NOT enter the pending variant.

### Profile section — Email pending caveats

- [ ] Given the Email row is in the pending variant, when the user types a SECOND new email in the input and blurs, then the action cancels the first pending change (admin-API clear) and then calls `updateUser({ email: <second-new> })` to start a fresh change — net effect: the user always has at most one pending change at a time, and the older verification link is invalidated.
- [ ] Given the helper text in the pending variant is inspected, when it is read in full, then it contains: "A verification link was sent to `<new-email>`. Your email will change once you confirm." + a "Cancel change" inline link in danger styling. (No "Resend link" link — see Out of Scope; helper text says "If the link didn't arrive, cancel the change and start over.")
- [ ] Given a user is in the pending email-change variant, when they sign out and back in with their **original** email + password, then login succeeds (the pending change has not yet activated, original email is still authoritative); when they sign in with the **new** email + password, then login fails with the standard "No account exists with this email" error (the new email is not yet linked).

### Profile section — Role row

- [ ] Given a user with `role='registered'` views the Profile section, when the Role row is inspected, then it shows the label "Role", no input control beneath the label (read-only row), and helper text "Your role is set by a sysadmin."
- [ ] Given a sysadmin (`role='sysadmin'`) views the Profile section, when the Role row is inspected, then the label row shows the Sysadmin pill (uppercase red filled pill — the same `<SysadminPill>` component PROJ-4 ships) next to the "Role" text, and the helper text reads "Sysadmin can approve new users and curate Presets. The role is set by another sysadmin and can't be changed here."

### Security section — password change

- [ ] Given the Security section is rendered, when it is inspected, then it shows three labelled inputs in order: Current password (password type), New password (password type), Confirm new password (password type), and below them a button "Update password".
- [ ] Given the user enters the correct current password + a valid new password + a matching confirmation, when they click "Update password", then the server action re-authenticates the user with the current password (`signInWithPassword`-equivalent check using their email + current password against Supabase) and on success calls `supabase.auth.updateUser({ password: <new> })`; the form clears, all three inputs reset, and an inline success caption "Password updated." appears next to the button (auto-dismisses ~3 s later).
- [ ] Given the user enters a wrong current password, when the re-auth check fails, then `updateUser` is NOT called, the Current password input gets the error border, and the inline caption "Current password is incorrect." appears.
- [ ] Given the New password and Confirm new password fields contain different values, when the user clicks "Update password", then no Supabase call is made, both fields show the error border, and the inline caption "New passwords don't match." appears.
- [ ] Given the new password violates Supabase Auth's configured policy, when the `updateUser` call returns the policy-error, then the Supabase-Auth error message is surfaced verbatim as the inline caption.
- [ ] Given any of the three fields is empty when the user clicks "Update password", when client-side Zod validation runs, then no submission occurs and the first empty field gets the error border with caption "Required.".
- [ ] Given the user clicks "Update password" repeatedly with a valid combination, when Supabase Auth returns HTTP 429, then the rate-limit error is surfaced verbatim as the inline caption and the button is briefly disabled (≥ 1 s).

### Preferences section — App theme

- [ ] Given the Preferences section is rendered, when the App theme row is inspected, then it shows the label "App theme", a segmented 3-button control (Light / Dark / System) with the currently active theme highlighted, and helper text "Affects the Calcgrinder dashboard, editor and these settings. Synced with the theme picker in your account menu."
- [ ] Given the user clicks one of the three theme buttons, when the click fires, then the same `next-themes` `setTheme()` call PROJ-4's avatar popover uses is invoked, the theme transitions immediately, and the avatar popover (when opened next) shows the same theme selected — both surfaces read from the same localStorage key with zero divergence.
- [ ] Given the user reloads `/settings`, when the page hydrates, then the segmented control's active state matches the persisted `next-themes` value.

### Preferences section — Default calculator theme

- [ ] Given the Preferences section is rendered, when the "Default calculator theme for new calculators" row is inspected, then it shows the label, a dropdown listing all 8 themes returned by `listThemes()` (PROJ-6) with the current selection prefilled from `profiles.default_calculator_theme` (falling back to `getDefaultThemeId()` = `'calcgrinder'` when NULL), and helper text "Applied to any new calculator you create. Existing calculators keep their current theme."
- [ ] Given the user picks a different theme from the dropdown, when the change fires, then a server action writes `profiles.default_calculator_theme = <new id>`, the success caption "Saved" briefly appears next to the dropdown, and a subsequent navigation to the "New calculator" flow (PROJ-10's editor-create entry point) uses the new theme as the initial value.
- [ ] Given the user-selected theme id is not in `listThemeIds()` (e.g. a theme that was removed or never existed), when the server action's Zod schema runs, then the write is rejected with an error caption "Unknown theme id." (defence in depth; the dropdown UI prevents this client-side).
- [ ] Given a user has never touched the default theme, when they create a new calculator via the "+ New calculator" flow (PROJ-10), then the new calculator's `theme_id` is `'calcgrinder'` (system default via `getDefaultThemeId()`), matching the existing PROJ-6 / PROJ-10 default behaviour.

### Danger zone — request deletion

- [ ] Given a `registered` user (non-sysadmin) views the Settings page, when the Danger zone section is inspected, then it shows a single bordered danger-styled card containing: the "DANGER ZONE" small-caps red label, the body copy "Deleting your account permanently removes all calculators you own and every scenario saved against them — yours and anyone else's. Visitors will see your published calculators disappear. This cannot be undone after the grace window.", and a destructive "Delete account" button with a trash icon.
- [ ] Given the user clicks "Delete account", when the click fires, then a confirmation bottom-sheet (mobile) / dialog (desktop) opens with the trash icon + title "Delete your account?" + body "We'll send a confirmation link to `<current-email>`. Clicking it starts a `<RETENTION_PERIOD_DAYS>`-day countdown. Until you click and the window closes, your account is intact. You can cancel anytime during the window by signing back in." + a "Cancel" ghost button + a primary destructive "Send deletion link" button.
- [ ] Given the user clicks "Send deletion link" in the confirmation sheet, when the server action fires, then it: (1) inserts (or upserts on `user_id`) a row into a new `account_deletion_requests` table with `user_id`, a freshly generated 43-char base64url token, `created_at=NOW()`, `consumed_at=NULL`, `cancelled_at=NULL`; (2) calls `sendMail()` with the existing `accountDeletionConfirmation` template, passing `recipientName` (or "there" if NULL), `confirmDeletionUrl = <APP_URL>/auth/account/<token>/confirm-delete`, and `retentionDays = Number(process.env.RETENTION_PERIOD_DAYS) || 30`; (3) the sheet closes; (4) the Danger zone re-renders in the "pending" variant.
- [ ] Given the Danger zone has just entered the pending variant, when it renders, then a yellow info banner above the body copy reads "**Deletion pending.** A confirmation link was sent to `<current-email>`. Your account will be deleted once you click it. Resend link · Cancel deletion." and the "Delete account" button is replaced with a disabled-style "Deletion pending" button.
- [ ] Given the user clicks "Resend link" in the pending banner, when the action fires, then `sendMail()` re-sends the same template with the existing (un-consumed) token URL (no new token generated) — same email re-issued.
- [ ] Given the user clicks "Cancel deletion" in the pending banner, when the action fires, then the `account_deletion_requests` row's `cancelled_at` is set to NOW(), the Danger zone reverts to the default (non-pending) variant, and a subsequent click of the email link (now-cancelled token) renders the "This link has been cancelled" read-back landing (see below).
- [ ] Given the `sendMail()` call throws on the initial request (Cyon down), when the server action catches the exception, then the `account_deletion_requests` row is rolled back (or never inserted — architecture chooses), the sheet does NOT close into the pending state, and an inline error caption "Couldn't send the confirmation email — try again." is shown.

### Danger zone — sysadmin

- [ ] Given a `sysadmin` user (`role='sysadmin'`) views the Settings page, when the Danger zone section is inspected, then the "Delete account" button is always disabled regardless of pending state, and the body copy is replaced with "Sysadmin accounts can't be deleted from Settings. Another sysadmin must remove the account directly in the Supabase Dashboard (or via PROJ-19 moderation, once shipped)." (no confirmation sheet, no email send path is reachable for sysadmins).
- [ ] Given a sysadmin's server action surface (`/api/account/request-deletion` or equivalent) is hit by a request from a sysadmin session anyway (URL crafted manually), when the action evaluates the role, then it returns HTTP 403 with body `{ error: 'sysadmin_self_delete_forbidden' }` and writes nothing to the DB.

### Confirmation link — click handler

- [ ] Given the user clicks the `<APP_URL>/auth/account/<token>/confirm-delete` link in their email and the token is un-consumed, when the route handler runs, then in a single transaction it: (1) sets `profiles.status='pending_deletion'` for the associated user_id, (2) sets `profiles.soft_delete_at=NOW()`, (3) sets `account_deletion_requests.consumed_at=NOW()`; the response renders an `AuthShell` + `EmptyOrErrorState` (variant `error` — destructive intent) landing with the trash icon + "Deletion scheduled" + body "Your account is scheduled for deletion on `<deletion_date>` (in `<N>` days). Until then, sign back in to cancel." + a footer link "Back to login →" linking to `/auth/login`. No `sendMail()` call from this branch (we're not double-emailing).
- [ ] Given a token has already been consumed (`consumed_at != NULL`) and the user has NOT cancelled, when either re-click happens, then the handler writes nothing to the DB and renders the "Already scheduled — deletion on `<deletion_date>`" read-back landing (info text instead of action confirmation).
- [ ] Given a token has been cancelled (`cancelled_at != NULL`), when the link is clicked, then the handler renders an "This deletion request has been cancelled" landing with a footer link to `/auth/login`.
- [ ] Given a non-existent token is requested, when the handler finds no row, then it responds with HTTP 404 and renders the generic `EmptyOrErrorState` error variant "This link is not valid." (matches PROJ-3 conventions; no user-specific information leaked).
- [ ] Given the handler URL contains an invalid token shape (e.g. non-base64url chars), when the Next.js dynamic-segment match fires, then validation rejects with the same 404 landing.
- [ ] Given the user has already been hard-purged by the cron (`auth.users` row gone), when an old confirmation link is clicked, then `account_deletion_requests` is gone too (FK CASCADE from PROJ-1) and the handler renders the 404 landing — same shape as a never-existing token.

### Grace window — login, lock-out, cancel

- [ ] Given a user with `status='pending_deletion'` submits valid credentials at `/auth/login`, when the login server action checks status after `signInWithPassword`, then it redirects to `/auth/cancel-deletion` (not `/dashboard`, not `/auth/waiting-for-approval`).
- [ ] Given a `pending_deletion` user opens `/auth/cancel-deletion`, when the page renders, then it shows the AuthShell with no app chrome + warning glyph + headline "Your account will be deleted on `<deletion_date>`" + body "All calculators you own and every scenario saved against them will be permanently removed. You can cancel now to keep your account." + a primary "Cancel deletion & keep account" button (form POST) + a secondary "Sign out" link.
- [ ] Given the user clicks "Cancel deletion & keep account", when the server action fires, then in a single transaction it: (1) sets `profiles.status='approved'` (the user was previously approved — there is no path to `pending_deletion` from any other status), (2) sets `profiles.soft_delete_at=NULL`, (3) sets `account_deletion_requests.cancelled_at=NOW()` for the most recent consumed row of this user (defence in depth — both row state and profile state stay consistent); afterwards it redirects to `/dashboard` with a Sonner toast "Welcome back. Your account is no longer scheduled for deletion."
- [ ] Given a `pending_deletion` user opens `/dashboard`, `/editor/<id>`, `/settings`, or any private route, when the gate evaluates, then it 302s to `/auth/cancel-deletion`.
- [ ] Given a `pending_deletion` user opens `/auth/login`, when the gate evaluates while a session cookie is present, then it 302s to `/auth/cancel-deletion`.
- [ ] Given an anonymous browser opens `/auth/cancel-deletion`, when the page evaluates, then it 302s to `/auth/login` (no session → can't show cancel screen).
- [ ] Given a user whose `pending_deletion` status has been cancelled (back to `approved`) reloads any private surface, when the gate evaluates, then normal access resumes (no redirect).

### Visitor view — owner in grace window

- [ ] Given a calculator's owner has `status='pending_deletion'`, when a visitor opens `/c/<token>`, then the existing PROJ-11 410-Gone page renders (same UX as a per-calculator soft-delete). The visitor sees no information that distinguishes "soft-deleted calc" from "owner-in-grace".
- [ ] Given the same calculator's owner cancels their deletion, when the visitor reloads `/c/<token>` after the cancel, then the page resumes serving normally — the cascade is reversed by reverting `profiles.status='approved'`.
- [ ] Given the calculator's owner is hard-purged after the grace window, when the visitor opens `/c/<token>`, then the calculator row is gone (FK CASCADE) and the visitor still sees the 410-Gone page (PROJ-11 already treats not-found and gone the same way for visitor UX).

### Cron — hard-purge after the grace window

- [ ] Given the daily Vercel cron job has been declared (extension of PROJ-13's existing `vercel.json` cron entry or a new one — architecture chooses), when the cron hits its scheduled endpoint with the `Authorization: Bearer <CRON_SECRET>` header, then a server-side query selects all `profiles` rows where `status='pending_deletion' AND soft_delete_at < NOW() - make_interval(days => :retention_days)` and for each row calls `supabaseAdmin.auth.admin.deleteUser(user_id)` which cascades through `profiles` (and from there through all owned calculators / scenarios via existing FK CASCADE chains from PROJ-1, PROJ-10, PROJ-12, PROJ-13).
- [ ] Given the cron endpoint is called without (or with a wrong) `Authorization: Bearer <CRON_SECRET>` header, when the handler validates, then it responds with 401 (matches PROJ-13's cron-auth pattern).
- [ ] Given the cron response shape is inspected, when a successful invocation returns, then the body is `{ ok: true, purged_accounts: <count>, purged_calculators: <count>, retention_days: <n> }` (extending PROJ-13's existing shape; if PROJ-14 ships a separate cron, the new endpoint returns at minimum `{ ok: true, purged_accounts: <count>, retention_days: <n> }`).
- [ ] Given a user's deletion request is consumed today and `RETENTION_PERIOD_DAYS=30`, when the cron runs daily for 29 days, then no purge happens for this user; on day 30 the user's row meets the window-expired condition and is purged on the next cron invocation.
- [ ] Given a user cancels their deletion before the cron runs, when the next cron evaluates, then their row is no longer `pending_deletion` and is not purged.

### DB & migration

- [ ] Given the PROJ-14 migration is applied, when the `profiles.status` CHECK constraint is inspected, then the allowed values are `'pending' | 'approved' | 'declined' | 'pending_deletion'` (extending the existing 3-value enum from PROJ-1 / PROJ-3 by one).
- [ ] Given the same migration, when `profiles` is inspected, then a nullable `soft_delete_at TIMESTAMPTZ` column exists (NULL by default; populated when status transitions to `pending_deletion`).
- [ ] Given the same migration, when `profiles` is inspected, then a nullable `default_calculator_theme TEXT` column exists (NULL by default; the application reads `getDefaultThemeId()` as the fallback when NULL).
- [ ] Given the same migration, when the new `account_deletion_requests` table is inspected, then it has columns `id` (UUID PK), `user_id` (UUID FK → `auth.users.id`, ON DELETE CASCADE, UNIQUE), `token` (TEXT NOT NULL UNIQUE — 43-char base64url), `created_at` (TIMESTAMPTZ DEFAULT NOW()), `consumed_at` (TIMESTAMPTZ NULL), `cancelled_at` (TIMESTAMPTZ NULL).
- [ ] Given `account_deletion_requests` is inspected, when RLS is checked, then RLS is enabled and zero policies are attached for `authenticated` / `anon` — same intentional service-role-only posture PROJ-3 ships for `signup_approvals`, with a SQL comment on the table explaining the posture.
- [ ] Given `npx supabase gen types typescript --linked > src/lib/supabase/types.ts` is run after the migration, when the types file is inspected, then the new column / table additions are reflected and `src/lib/auth/route-gate.ts`'s `pending_deletion` branch type-checks against the regenerated enum.

### Tests

- [ ] Given `src/app/(app)/settings/_actions/update-name.test.ts` covers: (1) happy-path write + success caption, (2) whitespace-trim, (3) control-character rejection with error caption, (4) > 80 chars rejection, (5) network-error fallback, when `npm test` runs, then all cases pass.
- [ ] Given `src/app/(app)/settings/_actions/update-email.test.ts` covers: (1) happy-path `updateUser({ email })` + pending variant, (2) cancel-pending-change clears state, (3) duplicate-email error, (4) invalid-email Zod reject, (5) no-op when new email equals current, when `npm test` runs, then all cases pass (Supabase admin client mocked via `vi.mock`).
- [ ] Given `src/app/(app)/settings/_actions/update-password.test.ts` covers: (1) wrong current password rejected, (2) mismatch between new + confirm, (3) policy-violation surfaces verbatim, (4) rate-limit surfaces verbatim, (5) happy-path clears form and shows success caption, when `npm test` runs, then all cases pass.
- [ ] Given `src/app/(app)/settings/_actions/update-preferences.test.ts` covers: (1) writing a valid theme id, (2) rejecting an unknown theme id, (3) app-theme client-side click flow is integration-tested via `next-themes` mock not unit-tested on the server, when `npm test` runs, then all DB-write cases pass.
- [ ] Given `src/app/(app)/settings/_actions/request-deletion.test.ts` covers: (1) `registered` user → token inserted + email sent + pending variant, (2) `sysadmin` user → 403, (3) `sendMail` throw → row rolled back + error caption, (4) repeat request from same user → row upserted (no duplicate row, fresh token), when `npm test` runs, then all cases pass.
- [ ] Given `src/app/auth/account/[token]/confirm-delete/route.test.ts` covers: (1) fresh token → status → `pending_deletion` + soft_delete_at + landing, (2) re-click consumed token → "Already scheduled" landing, (3) cancelled token → "Cancelled" landing, (4) unknown token → 404 landing, (5) invalid token shape → 404 landing, when `npm test` runs, then all cases pass.
- [ ] Given `src/app/auth/cancel-deletion/route.test.ts` (or co-located action test) covers: (1) happy-path POST → status → `approved` + soft_delete_at cleared + cancelled_at set + redirect to /dashboard, (2) anonymous browser GET → 302 /auth/login, (3) non-pending_deletion user GET → 302 /dashboard, when `npm test` runs, then all cases pass.
- [ ] Given `src/app/auth/confirm/route.test.ts` is extended with the `email_change` branch covering: (1) `type=email_change` + valid `token_hash` → `verifyOtp` called + redirect to `/auth/email-confirmed`, (2) `type=email_change` + invalid token → generic error landing, when `npm test` runs, then both cases pass.
- [ ] Given `src/lib/auth/route-gate.test.ts` is extended with `pending_deletion` cases: (1) `pending_deletion` × `/dashboard` → 302 `/auth/cancel-deletion`, (2) `pending_deletion` × `/settings` → 302 `/auth/cancel-deletion`, (3) `pending_deletion` × `/editor/x` → 302 `/auth/cancel-deletion`, (4) `pending_deletion` × `/auth/cancel-deletion` → no redirect, (5) `pending_deletion` × `/auth/login` (already signed in) → 302 `/auth/cancel-deletion`, (6) anonymous × `/auth/cancel-deletion` → 302 `/auth/login`, (7) `approved` × `/auth/cancel-deletion` → 302 `/dashboard`, when `npm test` runs, then all cases pass.
- [ ] Given `src/app/api/cron/purge-deleted-accounts.test.ts` (or the equivalent extension of PROJ-13's existing cron test file) covers: (1) auth missing → 401, (2) no expired pending_deletion rows → `purged_accounts: 0`, (3) one expired row → user deleted + cascade verified via mocked admin client, (4) within-window row → not purged, when `npm test` runs, then all cases pass.
- [ ] Given `tests/PROJ-14-settings.spec.ts` (Playwright E2E) covers: (1) approved user lands on /settings → edits name → reloads → name persists → opens avatar popover → name reflects, (2) toggles App theme to Dark → popover theme button also shows Dark active, (3) picks a different Default calculator theme → starts a new calculator → editor opens with the new theme, (4) requests account deletion → sees pending banner → cancels deletion → banner gone, (5) full deletion flow: request → click email link (mock email URL extraction) → land on /auth/cancel-deletion → cancel → back on dashboard → request again → simulate cron purge → /auth/login attempt shows "No account exists", when `npm run test:e2e` runs, then it passes in Chromium and Mobile Safari.

### Docs

- [ ] Given `docs/production/settings.md` exists, when the deployer reads it, then it documents: (1) the four sections shipped, (2) the email-change Supabase Auth template + the `email_change` branch of `/auth/confirm`, (3) the new `account_deletion_requests` table + `pending_deletion` status, (4) the cron extension / new endpoint + cron schedule, (5) `RETENTION_PERIOD_DAYS` env var (existing — same one PROJ-13 uses), (6) what to do if a deployer accidentally puts a user in `pending_deletion` via direct DB op (revert `status='approved'` + clear `soft_delete_at`).

## Edge Cases

- **User requests deletion, clicks link, gets locked into
  `/auth/cancel-deletion`, then forgets and re-requests
  deletion from Settings.** Settings is unreachable in the
  grace window (gate redirects to `/auth/cancel-deletion`),
  so the user cannot re-request. Only path forward is
  Cancel (back to `approved`) or wait for the cron to
  hard-purge.
- **User cancels deletion within the grace window, then
  requests deletion again the same day.** The
  `account_deletion_requests` row's `UNIQUE(user_id)`
  constraint means the second request UPSERTs over the first
  with a fresh token; the prior cancelled-token email is
  invalidated (re-click renders "This deletion request has
  been cancelled" — even though a new pending request
  exists, that token isn't the right key for the new state).
- **User has a pending email change AND requests account
  deletion.** Independent state machines — pending email
  change persists on `auth.users.email_change_*`; deletion
  request persists on `account_deletion_requests`. If the
  user confirms deletion before confirming email change, the
  cron eventually deletes `auth.users` including the
  pending email-change state. If the user cancels deletion
  and then confirms the email change, the email is updated
  normally.
- **User confirms email change but the new email is invalid /
  blocked by Cyon / SMTP.** Supabase Auth's flow uses its
  own SMTP (Custom SMTP = Cyon, per PROJ-2); send failures
  surface back to the `updateUser` call as a Supabase error
  and the pending variant is NOT entered. UI shows the
  error caption.
- **Sysadmin manually demotes themselves via Supabase
  Dashboard while their `Delete account` button was rendered
  disabled.** On next page navigation, the gate re-reads
  the role and the Delete button re-renders enabled.
  Stale-session window is bounded by the user's next
  navigation — acceptable for the trusted-deployer model.
- **Browser tab open on Settings while the user's status
  changes to `pending_deletion` in another tab (via a
  duplicate request).** Next mutation on the stale tab
  (e.g. blur on Name) returns the standard "Couldn't save —
  try again." caption (the server action's status check
  fails since `pending_deletion` users can't write to
  profiles). Reload redirects to `/auth/cancel-deletion`.
- **User opens the deletion-confirmation link in the same
  browser session where they're already signed in as a
  DIFFERENT user.** The token alone is the auth credential
  for this surface (no session check) — the action runs
  against the token's `user_id`, NOT the session user.
  After mutation, the response renders the landing page
  without touching the session. The other-user session
  stays valid.
- **User clears their browser cookies while in the grace
  window.** They lose their session; next visit to any
  surface → `/auth/login`. Logging in with their
  credentials succeeds (auth.users still exists; status
  still `pending_deletion`) → redirected to
  `/auth/cancel-deletion`.
- **Cron runs while a user is mid-cancel-action.** The
  cancel transaction sets `status='approved'`; the cron's
  read query filters on `status='pending_deletion' AND
  soft_delete_at < NOW() - …`. PostgreSQL row-level locking
  (`SELECT … FOR UPDATE SKIP LOCKED` in the cron, or
  equivalent default isolation) ensures atomicity — exactly
  one of cancel or purge wins. If purge wins, the cancel
  action sees the auth.users row gone and returns a 404
  surface; if cancel wins, the cron's next iteration skips
  the now-approved row. The deletion-confirm token row is
  gone either way (FK CASCADE if purge wins, or
  `cancelled_at` set if cancel wins).
- **Deployer changes `RETENTION_PERIOD_DAYS` mid-flight
  (e.g. 30 → 7).** Cron reads the env on each invocation;
  next cron run uses the new value, may purge users whose
  prior expectation was 30 days. Documented in
  `docs/production/settings.md` as an operational caveat;
  same caveat exists in PROJ-13 for calculator soft-delete.
- **User submits two simultaneous name updates from two
  tabs (race).** Last-write-wins via the on-blur action's
  plain UPDATE; the older write's response races back to a
  closed/stale tab whose state may not match the DB.
  Acceptable for v1 single-deployer low-volume — Sonner
  success captions are advisory, not authoritative.
- **`accountDeletionConfirmation` template's `recipientName`
  is NULL** (user never set a name). Server action passes
  the email-local-part or the literal `"there"` so the
  template's greeting line ("Hi <name>") doesn't render
  `"Hi ,"`. Decision in Product Decisions; "there" is the
  default substitute.
- **Concurrent email change + email change from a different
  device.** Each `updateUser({ email })` call invalidates
  the prior `email_change_token_new` (Supabase Auth
  behaviour). The newer change wins; the older
  verification link returns the generic "link no longer
  valid" landing when clicked.

## Technical Requirements

- **Stack:** Next.js 16 App Router server actions for all
  settings mutations; route handler for the deletion-confirm
  GET URL and the cancel-deletion POST (no-JS-friendly form
  submission); page components for the Settings surface and
  the two new auth landings (`/auth/email-confirmed`,
  `/auth/cancel-deletion`, and the dynamic
  `/auth/account/[token]/confirm-delete` landing).
- **DB migration:** one new migration adds the
  `default_calculator_theme` column + `soft_delete_at` column
  to `profiles`, extends the `profiles.status` CHECK
  constraint to include `'pending_deletion'`, and creates
  the `account_deletion_requests` table with RLS enabled +
  zero policies (service-role-only posture, mirroring
  `signup_approvals`). Regenerate `src/lib/supabase/types.ts`
  via `npx supabase gen types typescript --linked` after push.
- **Route gate:** extend PROJ-3's `route-gate.ts` matrix
  with `pending_deletion` rows. `pending_deletion` is gated
  identically to `pending` / `declined` for private surfaces
  (redirect away) but to its own dedicated screen
  (`/auth/cancel-deletion`).
- **Visitor read filter:** PROJ-10's
  `getCalculatorByToken` (and any sibling visitor-read
  helper) must AND-filter on `EXISTS (SELECT 1 FROM
  profiles WHERE profiles.id = calculators.owner_id AND
  profiles.status = 'approved')` — i.e. only approved
  owners' calculators are visible at `/c/<token>`. The
  existing PROJ-13 soft-delete filter already filters on
  the calculator's own `soft_delete_at`; PROJ-14 adds the
  owner-status branch.
- **Inline-edit semantics:** Profile Name + Email + the
  Default-calculator-theme dropdown save on `blur` (or
  on `change` for the dropdown — selecting an item =
  commit). No Save/Cancel bar. Success / error captions
  are inline next to the affected control and auto-dismiss
  after ~3 s. Architecture decides the exact debounce /
  toast / inline-caption mechanism.
- **Password change** uses Supabase's `signInWithPassword`
  + `updateUser({ password })` pattern. Re-auth check
  before the update is the server's responsibility (do not
  trust client-side). All three fields cleared on success.
- **App theme:** the Settings segmented control writes to
  the same `next-themes` localStorage key as PROJ-4's
  avatar popover. No server persistence. No new state
  surface.
- **Default calculator theme:** stored on `profiles.default_
  calculator_theme` (server-persisted so it follows the
  user across devices). PROJ-10's "new calculator" flow
  reads `profiles.default_calculator_theme` ?? `getDefault
  ThemeId()` when creating a calc.
- **Account deletion token format:** same primitive as
  PROJ-3 — `crypto.randomBytes(32).toString('base64url')`
  via `src/lib/auth/token.ts`. 43-char URL-safe.
- **`account_deletion_requests.UNIQUE(user_id)`** ensures
  one active request per user. Re-requests upsert
  (over-write the prior un-consumed row with a fresh
  token); after a cancelled request, a new request is
  also an upsert (replaces `cancelled_at`-set row with a
  fresh active row).
- **`/auth/account/[token]/confirm-delete`** is a GET route
  handler with `export const runtime = 'nodejs'` (no
  `sendMail` in this branch, but kept for consistency
  with PROJ-3's admin handlers). Token IS the auth (same
  posture as PROJ-3 — no additional session check on the
  deletion-confirm GET).
- **`/auth/cancel-deletion`** is a page (GET) + a server
  action (POST) inside the same route. Anonymous GET
  redirects to `/auth/login`. `approved` GET redirects to
  `/dashboard`. `pending_deletion` GET renders the cancel
  screen.
- **Cron:** architecture chooses between (a) extending
  PROJ-13's existing `/api/cron/purge-old-soft-deletes`
  endpoint to also purge expired pending_deletion accounts,
  or (b) shipping a new `/api/cron/purge-deleted-accounts`
  endpoint with its own `vercel.json` entry. Either way:
  same `Authorization: Bearer <CRON_SECRET>` auth, same
  `RETENTION_PERIOD_DAYS` env var, same daily cadence
  (`0 4 * * *`).
- **Email-change cancel mechanism:** uses the Supabase
  Admin client (`createAdminClient()` from
  `@/lib/supabase/admin`) to clear `auth.users.email_change`
  and `auth.users.email_change_token_new` for the user.
  This is the only known mechanism that invalidates a
  pending change without sending an additional email.
  Architecture confirms the exact admin API call available
  in `@supabase/supabase-js` v2 (`updateUserById` with
  appropriate flags, or a raw `auth.admin` RPC).
- **Server-only guards:** all server actions that touch the
  admin client are in `src/app/api/**` or in server-action
  files under `src/app/(app)/settings/_actions/`, both of
  which are covered by the `server-only` import guard. The
  email-change cancel action must NOT execute in a client
  bundle.
- **Validation:** Zod schemas for every input. Name field
  reuses PROJ-3's signup-name schema (trim + control-char
  reject + 80-char limit). Email field reuses standard Zod
  email validator. Password fields reuse PROJ-3's
  policy-passthrough approach (let Supabase surface its
  own policy errors). Theme-id field validates against
  `listThemeIds()` from PROJ-6.
- **Performance:** Settings page load issues one extra DB
  read beyond the `getCurrentProfile()` already cached per
  request (the `default_calculator_theme` column is on
  the existing profile row). No N+1 risk. Account-deletion
  request flow issues one DB upsert + one `sendMail` call,
  both in-band with the form action.
- **Security:**
  - All POST mutations are server actions (CSRF protection
    built-in via Next.js origin check) or POST route
    handlers with explicit origin verification (matches
    PROJ-3 pattern).
  - Deletion-confirm GET handler is intentionally GET +
    token-in-URL (same posture as PROJ-3's approve/decline:
    token IS the auth; CSRF irrelevant because there's no
    session to forge).
  - The Settings page renders inside the `(app)` group,
    which already enforces the approved-user gate via
    PROJ-3's `getCurrentProfile()` cached helper.
  - Re-authentication is required for password change
    (current-password input + server-side `signInWithPassword`
    check) so that a stolen-session attacker can't rotate
    the password silently.
- **Tests:** unit tests for each server action; route-gate
  matrix extension for `pending_deletion`; route-handler
  test for the deletion-confirm GET; E2E covering the full
  request → confirm → cancel → re-request → expire → purge
  loop with a mocked email-extraction step.

## Open Questions

- [ ] /architecture: separate cron endpoint
      (`/api/cron/purge-deleted-accounts`) vs. extending
      PROJ-13's `/api/cron/purge-old-soft-deletes`. Both
      work; either is one `vercel.json` entry. Architecture
      chooses based on cohesion vs. handler-size trade-off.
- [ ] /architecture: exact mechanism for clearing
      Supabase's `auth.users.email_change_*` fields when
      the user clicks "Cancel change". The Supabase Admin
      SDK surface for this (vs. a direct `from('auth.users')`
      UPDATE via service role) needs verification — most
      likely `supabase.auth.admin.updateUserById(id, {
      email_change: null })` or equivalent.
- [ ] /architecture: whether to render Settings page errors
      inline next to each control or aggregate them in a
      page-level banner. Design draft uses inline; defer
      final choice to /architecture (consistent with the
      project's general inline-error preference).
- [ ] /architecture: deletion-request DB pattern — UPSERT
      (one row per user, mutated in place) vs. multi-row
      audit history (one row per request, latest matters).
      UPSERT is simpler and matches `UNIQUE(user_id)` from
      PROJ-3's `signup_approvals`; audit-history would be
      richer for future moderation but is overkill for v1.
- [ ] /architecture: whether the cancel-deletion form
      action lives at `/auth/cancel-deletion` (same route,
      POST) or at `/api/account/cancel-deletion`. Mirrors
      PROJ-3's pattern choices.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Account deletion follows a **grace-period model** (`pending_deletion` status + `RETENTION_PERIOD_DAYS`-day window + cancel-via-sign-in) rather than immediate hard-delete on click of the confirmation email | Matches the wording PROJ-2 already shipped in the `accountDeletionConfirmation` template ("scheduled for deletion in N days … sign back in during that window to cancel"); aligns with PROJ-13's existing soft-delete pattern for calculators and scenarios — same retention model, same env var, same cron cadence; gives users a forgiving recovery path for an irreversible destructive action; the design draft's "permanently removed" landing copy is overridden | 2026-05-24 |
| **Dedicated `/auth/cancel-deletion` screen** for users in the grace window — no app chrome, single primary "Cancel deletion & keep account" button, locks them out of /dashboard, /editor, /settings entirely | Mirrors PROJ-3's `/auth/waiting-for-approval` pattern; user can't accidentally do work in a doomed account; the lock-out makes the deletion state visceral rather than something the user might forget about; cleanest mental model with the smallest gating surface | 2026-05-24 |
| **Visitor view for calculators owned by a `pending_deletion` user shows the existing PROJ-11 410-Gone page** — identical to the per-calculator soft-delete UX | Symmetry with PROJ-13's soft-delete UX is the principle of least surprise for visitors; doesn't leak the owner's deletion intent (visitor can't distinguish per-calc-soft-delete from owner-grace-window); on cancel, calculators come back automatically — no per-row state management needed | 2026-05-24 |
| **Clone-during-soft-delete-window** affordance is NOT part of PROJ-14 — when PROJ-18 (Cloning & Preset Discoverability) ships, the clone-during-window feature will apply symmetrically to both per-calculator soft-deletes (PROJ-13) and account-deletion-cascade soft-deletes (PROJ-14) | Cloning is PROJ-18's primitive; shipping a one-off path in PROJ-14 would duplicate that surface and force a refactor; the symmetric model means a single PROJ-18 implementation covers both deletion paths | 2026-05-24 |
| **Sysadmins cannot self-delete from Settings under any condition.** Button is always disabled with explanatory copy; the server action returns 403 if called anyway | Avoids the foot-gun of stranding the instance by deleting the last (or last-active) sysadmin; pushing the rare "sysadmin wants out" case to manual ops (Supabase Dashboard / PROJ-19) is acceptable for the small expected sysadmin count; same posture as "demote sysadmin to registered" being out of scope per PRD; no "block last sysadmin only" branch needed — simpler rule, no per-row count query on render | 2026-05-24 |
| **Inline edits save on blur** for Name + Email + Default-calculator-theme (incremental save model — no Save/Cancel bar); Password change is the only batch-form section (3 fields + button) because it requires re-auth and atomic submission | Matches the design's incremental-save UX direction and the modern settings-page convention; lower friction than a per-section Save bar; success/error captions are inline and ephemeral, not blocking. Password change is the natural exception because the three fields are semantically one transaction | 2026-05-24 |
| **App theme control in Settings duplicates the avatar popover's control** rather than living only in one place; both write to the same `next-themes` localStorage key | Two surfaces for the same setting matches the user's two natural entry points (popover for quick switch, Settings for deliberate setup); single source of truth at the storage layer means zero divergence risk; PROJ-4 already specs the popover, so PROJ-14 just adds the second affordance | 2026-05-24 |
| **Default calculator theme is server-persisted on `profiles.default_calculator_theme`** rather than browser-local | Setting describes the user's intent for content they own (calculators they create), which should follow them across devices; contrasts with App theme which is a display preference natural to per-browser scope; matches PROJ-6's Decision Log foreshadowing ("PROJ-14 Settings → 'Default calculator theme for new calculators' dropdown will override this per-user") | 2026-05-24 |
| **Email-change "Resend link" is NOT implemented** — Supabase Auth has no public resend-OTP-for-email-change endpoint; helper text is reworded to "If the link didn't arrive, cancel the change and start over." | Faking a resend by calling `updateUser({ email })` again with the same target would invalidate the prior token and emit a fresh email — same observable result but worse UX (silent re-issue with no explanation); the cancel-then-restart loop is explicit and accurate; design draft's "Resend link" affordance is overridden | 2026-05-24 |
| **Email-change "Cancel change" IS implemented** via a server-side admin call that clears `auth.users.email_change*` fields without sending any additional email | The Cancel-change link is the user's only recovery from a typo in a new email; making it work cleanly (no further emails, immediate revert) is worth the small admin-API surface; UI displays the original email immediately on click | 2026-05-24 |
| **No new email templates introduced by PROJ-14** — the flow reuses PROJ-2's `accountDeletionConfirmation` template plus Supabase Auth's built-in "Change Email Address" template (already installed by PROJ-2) | PROJ-2's three custom templates plus the three Supabase Auth templates cover every email PROJ-14 needs to send; no "your account was deleted" final-purge email is sent (silent cron purge — the user already received the scheduled-deletion notice) | 2026-05-24 |
| **Deletion-confirm tokens never expire, single-use, idempotent re-click** | Same posture as PROJ-3's approve/decline tokens; expiry is meaningless when the grace window is the actual time-bound mechanic; re-click idempotency is friendlier than a 404; mail-client prefetch concerns are mitigated identically (committed once, re-click reads back) | 2026-05-24 |
| **Account-deletion request UPSERTs per user** (one active row at any time, mutated in place) rather than appending an audit-history row per request | `UNIQUE(user_id)` mirrors `signup_approvals`; simpler invariant ("at most one active request per user"); v1's needs don't justify the audit-history pattern (no admin "who has tried to delete how many times" view); upserting also makes the "cancel then re-request" cycle naturally produce a fresh token without dead rows | 2026-05-24 |
| **No "your account was deleted" email** at hard-purge time after the grace window expires | User already received the scheduled-deletion confirmation email at the start of the window; sending mail at purge time would land in an inbox the user has already mentally divorced from; silent purge is the standard pattern for grace-window deletions in mainstream consumer apps | 2026-05-24 |
| **No account data export ("download your data before deletion")** | Single-deployer low-volume context, no GDPR obligation surfaced by the PRD; deployer can pull data manually via Supabase Dashboard if a user requests it pre-grace-window; documented as a v2 candidate | 2026-05-24 |
| **No MFA / 2FA / per-device session management** in the Security section | Out of scope per the PRD's auth model (Supabase Auth email+password only); password change is the only Security control in v1 | 2026-05-24 |
| **Password change requires the current password** even though Supabase Auth's `updateUser({ password })` doesn't enforce it natively | A logged-in session is enough for Supabase Auth's call, but adding the current-password gate raises the bar against stolen-session attacks (and matches the convention every mainstream app uses); the re-auth check happens server-side via `signInWithPassword` against the user's email + the entered current password before the update fires | 2026-05-24 |
| **`recipientName` falls back to `"there"`** in the deletion-confirmation email when `profiles.name` is NULL | Avoids "Hi ," in the rendered template; "there" is informal and matches the rest of the app's voice; PROJ-2 already accepts this pattern via the template's input schema | 2026-05-24 |
| **Settings does NOT expose a sign-out button** | Sign-out lives in the avatar popover (PROJ-4) and the waiting-screen / cancel-deletion screens (PROJ-3 endpoint, used here too); duplicating it in Settings is noise | 2026-05-24 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| **Extend the existing `/api/cron/purge` (PROJ-13) handler** to also hard-purge expired `pending_deletion` accounts rather than ship a second cron endpoint | Single Vercel cron entry, single `CRON_SECRET`, single daily observability point; both purges share `RETENTION_PERIOD_DAYS` and the same daily cadence (`0 4 * * *`); response shape extends naturally to `{ ok, purged_calculators, purged_accounts, retention_days }`; smaller deploy surface for the deployer to monitor | 2026-05-24 |
| **Service-role raw `UPDATE` on `auth.users`** (`email_change = NULL`, `email_change_token_new = NULL`, `email_change_sent_at = NULL`) is the mechanism for "Cancel pending email change" | Supabase Admin SDK does not expose these fields via `updateUserById`; the SDK-friendly alternative (re-setting `email` to the current value) may emit a "Email Address Changed" notification to the original address as a side effect, which is the wrong UX for a Cancel; wrapped in a single `server-only` helper at `src/lib/auth/email-change.ts` so the raw-SQL touchpoint is small, named, and grep-able | 2026-05-24 |
| **"Cancel pending email change" goes through a SECURITY DEFINER RPC (`fn_clear_pending_email_change(p_user_id uuid)`) rather than the GoTrue admin REST endpoint or a direct SQL UPDATE from the application** | Three candidates were on the table: (a) `PUT /auth/v1/admin/users/<id>` REST call with `email_change_* = null` in the body, (b) direct SQL from `supabase-js`, (c) a SECURITY DEFINER Postgres function. (a) is unreliable — verified that `AdminUserAttributes` in `@supabase/auth-js` is the closed set { email, phone, password, email_confirm, phone_confirm, user_metadata, app_metadata, ban_duration, role }; the `email_change_*` fields are not in that surface and GoTrue silently ignores them on input. (b) is impossible — `supabase-js` exposes no direct SQL execution. (c) is the only path that actually clears `auth.users.email_change_{token_new, token_current, sent_at, confirm_status}` from the application: a SECURITY DEFINER function lets the trusted Postgres role mutate the auth schema while the helper stays a single named call-site. The RPC clears all five fields (the initial design listed three; `email_change_token_current` is the one GoTrue mints when "Secure email change" is enabled, and `email_change_confirm_status` is the integer counter that gates re-issue). Backend will install the function in the PROJ-14 migration. | 2026-05-24 |
| **Inline error/success captions next to each control** for incremental-save sections (Name, Email, Default-calculator-theme); the Password-change form (a 3-field batch) uses per-field inline captions plus a button-row caption — no top-of-page error banner anywhere | Matches the spec's incremental-save UX direction and the project's existing inline-error preference (PROJ-3, PROJ-9, PROJ-10); banners are reserved for cross-section state (e.g. the Danger-zone "pending" yellow banner above the body copy) | 2026-05-24 |
| **`account_deletion_requests` uses `UNIQUE(user_id)` UPSERT pattern** (one active row per user, mutated in place) over an append-only audit history | Mirrors PROJ-3's `signup_approvals` invariant; simpler semantic ("at most one active request per user"); v1 has no admin "deletion attempts over time" surface that would justify history rows; UPSERT also makes the cancel-then-re-request cycle naturally produce a fresh token without dead rows | 2026-05-24 |
| **`/auth/cancel-deletion` is a single route with a co-located server action** (GET renders the screen, POST handles cancel), mirroring PROJ-3's `/auth/waiting-for-approval` pattern, rather than splitting Cancel into `/api/account/cancel-deletion` | No-JS-friendly via Next.js form actions; same file owns the page + the only mutation it can perform; route-gate already handles the redirect matrix for the screen itself; no need for a separate API surface for a one-button action | 2026-05-24 |
| **Single small migration** adds: `profiles.default_calculator_theme TEXT NULL`, `profiles.soft_delete_at TIMESTAMPTZ NULL`, extends `profiles.status` CHECK to include `'pending_deletion'`, creates `account_deletion_requests` table with RLS-on + zero policies (service-role-only, mirroring `signup_approvals`) | One migration = one atomic deploy step + one types regen; the additive nature of all four changes means no destructive DDL, no data migration; isolates PROJ-14's schema delta for easy review | 2026-05-24 |
| **`fn_get_public_calculator` and `fn_get_scenario_by_share_token` RPCs are extended in the same migration** with a `JOIN profiles ON profiles.id = c.owner_id AND profiles.status = 'approved'` filter, so visitors see no calculators owned by `pending`, `declined`, or `pending_deletion` users | Filtering at the RPC layer (rather than the route handler) keeps the visitor-read story in one place — both the calculator-route page and the scenario-share page inherit the filter for free; matches the PROJ-11 410-Gone fallback already in place for soft-deleted calculators (zero rows returned → 404/410 path) | 2026-05-24 |
| **Each settings server action re-reads `getCurrentProfile()` at the top** and refuses to write when `status !== 'approved'` | Defence in depth alongside the route-gate; a stale tab whose status flipped server-side cannot silently mutate `profiles`; returns the standard "Couldn't save — try again." caption (covered by the spec's stale-tab edge case) | 2026-05-24 |
| **Password change re-authenticates via `signInWithPassword` against the user's current email** (server-side) before calling `updateUser({ password })` — using a short-lived second supabase client so the user's main session cookie is not rewritten | The user's session must survive the re-auth check; instantiating a fresh non-persisting Supabase client for the verification keeps the existing session cookie untouched; matches the standard "verify current password" pattern across mainstream auth UIs | 2026-05-24 |
| **App-theme segmented control writes through the existing `next-themes` hook** (`useTheme().setTheme`) — no separate localStorage write, no server persistence | Single source of truth at the `next-themes` storage layer; the avatar-popover control (PROJ-4) and the Settings control are two views over the same state with zero divergence risk; reload picks up the persisted value automatically through the `<ThemeProvider>` already mounted in the app root | 2026-05-24 |
| **No new npm packages** | The whole feature is reachable with the existing template stack (Next.js server actions, `@supabase/supabase-js`, `next-themes`, `zod`, `react-hook-form`, `sonner`, shadcn/ui primitives already installed) | 2026-05-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview

PROJ-14 ships three things at once: (1) a single `/settings`
page composed of four sections (Profile, Security, Preferences,
Danger zone) that uses incremental-save inline-edit UX for
single-field rows and a batch form for password change, (2) the
account-deletion grace-window state machine (request → email
confirm → grace lock-out → cancel-or-expire → cron purge), and
(3) the email-change verification path that activates the
already-stubbed `email_change` branch of `/auth/confirm`. Every
piece reuses primitives that already exist (`AuthShell`,
`EmptyOrErrorState`, `SysadminPill`, `next-themes`, the route
gate, the `sendMail` transport, the `randomToken()` helper, the
`getCurrentProfile()` cache, the PROJ-13 cron). The schema delta
is a single small migration (one new table, two new columns,
one CHECK extension). No new npm packages.

### Component structure

```
/settings (app route group, gated to status='approved')
└── <AppShell> ............................................ existing PROJ-4
    └── <SettingsMain>     single-column, max-w-640, centered
        ├── <ProfileSection>
        │   ├── <NameRow>             inline-edit text, on-blur save
        │   ├── <EmailRow>            inline-edit + "pending" variant
        │   │   └── pending: <PendingPill> + "Cancel change" link
        │   └── <RoleRow>             read-only + optional <SysadminPill>
        ├── <Divider>
        ├── <SecuritySection>
        │   └── <PasswordChangeForm>  3 inputs + "Update password"
        ├── <Divider>
        ├── <PreferencesSection>
        │   ├── <AppThemeRow>         segmented Light/Dark/System (next-themes)
        │   └── <DefaultCalcThemeRow> dropdown over listThemes()
        ├── <Divider>
        └── <DangerZoneSection>
            ├── default variant: <DangerZoneCard>
            │   └── "Delete account" destructive btn
            ├── pending variant: <DangerZoneCard>
            │   ├── yellow <PendingDeletionBanner> with
            │   │     "Resend link" · "Cancel deletion"
            │   └── disabled "Deletion pending" btn
            ├── sysadmin variant: <DangerZoneCard>
            │   └── disabled "Delete account" + explanatory copy
            └── <DeletionConfirmSheet>  bottom-sheet/dialog,
                                        opens on Delete-account click

/auth/cancel-deletion (page, gated to status='pending_deletion')
└── <AuthShell>
    ├── warning glyph (re-using auth icon set)
    ├── headline: "Your account will be deleted on <date>"
    ├── body: "All calculators / scenarios will be removed…"
    ├── <form action={cancelDeletion}>
    │   └── primary "Cancel deletion & keep account"
    └── secondary "Sign out" link

/auth/email-confirmed (page, public, anonymous-ok)
└── <AuthShell>
    └── <EmptyOrErrorState variant="success">
        ├── green check glyph
        ├── title: "Email address updated"
        ├── body: "Sign in with <new>. Old address is no longer linked."
        └── action: <Btn href="/dashboard">Continue to dashboard</Btn>

/auth/account/[token]/confirm-delete (route handler, GET)
├── token = unknown / malformed → 404 landing
├── token consumed, not cancelled → "Already scheduled" read-back
├── token cancelled                → "This deletion request has been cancelled"
└── token fresh                    → mutate + "Deletion scheduled" landing
        (all four variants render via <AuthShell> + <EmptyOrErrorState>)
```

### Server actions & route handlers

Each settings mutation is a Next.js server action co-located
with the page under `src/app/(app)/settings/_actions/`. Each
action re-reads `getCurrentProfile()` at the top, refuses to
write if `status !== 'approved'`, validates input with Zod, and
returns a small `{ ok, error?, message? }` shape that the
client component renders inline.

| Path | Kind | Purpose |
|------|------|---------|
| `src/app/(app)/settings/page.tsx` | Server Component | Reads `getCurrentProfile()`, renders the four sections |
| `src/app/(app)/settings/_actions/update-name.ts` | Server action | Writes `profiles.name` (or NULL on empty); reuses PROJ-3 name Zod schema |
| `src/app/(app)/settings/_actions/update-email.ts` | Server action | Calls `supabase.auth.updateUser({ email })` for set/replace; calls the new `clearPendingEmailChange()` helper for cancel |
| `src/app/(app)/settings/_actions/update-password.ts` | Server action | Re-auths via a short-lived non-persisting Supabase client, then calls `supabase.auth.updateUser({ password })` |
| `src/app/(app)/settings/_actions/update-default-calculator-theme.ts` | Server action | Writes `profiles.default_calculator_theme`; validates against `listThemeIds()` |
| `src/app/(app)/settings/_actions/request-deletion.ts` | Server action | UPSERT into `account_deletion_requests` + `sendMail(accountDeletionConfirmation)`; 403 for sysadmins |
| `src/app/(app)/settings/_actions/cancel-pending-deletion.ts` | Server action | Sets `account_deletion_requests.cancelled_at = NOW()` for the user's row (called from the pending Danger-zone banner before the user has clicked the link) |
| `src/app/auth/account/[token]/confirm-delete/route.ts` | GET handler | Token is the auth; on fresh-token, transactionally sets `profiles.status='pending_deletion'`, `soft_delete_at=NOW()`, `consumed_at=NOW()`; renders the four landing variants |
| `src/app/auth/cancel-deletion/page.tsx` | Server Component | Renders the cancel screen; gated to `status='pending_deletion'` |
| `src/app/auth/cancel-deletion/_actions/cancel-deletion.ts` | Server action | Sets `profiles.status='approved'`, `soft_delete_at=NULL`, `account_deletion_requests.cancelled_at=NOW()`; redirects to `/dashboard` with a Sonner toast |
| `src/app/auth/email-confirmed/page.tsx` | Server Component | Success landing for an email-change confirmation; anonymous-ok |

### Existing files that get extended

- `src/lib/auth/route-gate.ts` — add `'pending_deletion'` to
  `ApprovalStatus`; gate `pending_deletion` to
  `/auth/cancel-deletion` (mirrors the `pending` →
  `/auth/waiting-for-approval` branch); allow
  `/auth/cancel-deletion` only for `pending_deletion`; redirect
  `approved` users away from it.
- `src/app/auth/confirm/route.ts` — change the `email_change`
  branch's default-next from `/dashboard` to
  `/auth/email-confirmed`; failure branch unchanged (still
  lands on `/auth/login?error=link_invalid`).
- `src/app/api/cron/purge/route.ts` — after the existing
  calculator purge, run a second query: `SELECT id FROM
  profiles WHERE status='pending_deletion' AND soft_delete_at <
  cutoff`, then call `supabaseAdmin.auth.admin.deleteUser(id)`
  per row; extend response shape to include `purged_accounts`.
- `src/app/api/calculators/route.ts` and the new-calculator
  creation path — read `profiles.default_calculator_theme` and
  use it as the initial `theme_id` (falling back to
  `getDefaultThemeId()` when NULL).

### New shared helpers

- `src/lib/auth/email-change.ts` — `clearPendingEmailChange(userId)`.
  Uses the admin client to issue the targeted `auth.users`
  UPDATE that sets `email_change`, `email_change_token_new`,
  and `email_change_sent_at` to NULL. Wrapped in
  `'server-only'`. One named touch-point for the raw-SQL
  workaround so reviewers can find it.

### Data model (plain language)

**New table — `account_deletion_requests`** (one active row per
user, UPSERT pattern):

- `id` — UUID primary key.
- `user_id` — UUID, FK → `auth.users.id`, ON DELETE CASCADE,
  UNIQUE (enforces "at most one active row per user").
- `token` — 43-char base64url (same primitive as PROJ-3's
  `signup_approvals.token`); UNIQUE NOT NULL.
- `created_at` — TIMESTAMPTZ DEFAULT NOW().
- `consumed_at` — TIMESTAMPTZ NULL (set when the user clicks
  the confirmation link).
- `cancelled_at` — TIMESTAMPTZ NULL (set when the user cancels,
  either from the Settings banner pre-click or from
  `/auth/cancel-deletion` post-click).

RLS on, zero policies — service-role-only, same intentional
posture as `signup_approvals`. SQL comment on the table
explains.

**Extended table — `profiles`** (additive only):

- `default_calculator_theme TEXT NULL` — the user's preferred
  starting theme for new calculators. Reads fall back to
  `getDefaultThemeId()` (`'calcgrinder'`) when NULL.
- `soft_delete_at TIMESTAMPTZ NULL` — set to NOW() when status
  transitions to `pending_deletion`; cleared on cancel; the
  cron query keys on `(status='pending_deletion' AND
  soft_delete_at < cutoff)`.
- `status` CHECK constraint extended to allow
  `'pending_deletion'` alongside the existing three values.

**Extended RPCs — visitor read path**:

- `fn_get_public_calculator(p_token)` and
  `fn_get_scenario_by_share_token(p_share_token, p_calc_token)`
  gain an inner JOIN to `profiles` requiring
  `profiles.status = 'approved'`. Visitors get the existing
  PROJ-11 410-Gone treatment when an owner is in any non-
  approved state (including `pending_deletion`).

### State machines

**Email change** (per `auth.users` row):

```
[stable] ──"new email submitted"──▶ [pending]
[pending] ──"verification link clicked"──▶ [stable on new]
[pending] ──"Cancel change clicked"──▶ [stable on old]
[pending] ──"new email submitted again"──▶ [pending on newer]
                                  (older token invalidated)
```

**Account deletion** (per `profiles` row):

```
[approved] ──"Send deletion link" + sendMail──▶
            [approved + account_deletion_requests row, un-consumed]
[approved + un-consumed row] ──"Cancel deletion" (Settings banner)──▶
            [approved + cancelled row]   (link inert)
[approved + un-consumed row] ──"Resend link" (Settings banner)──▶
            same row, same token, re-send                       (no state change)
[approved + un-consumed row] ──"click email link"──▶
            [pending_deletion + consumed row + soft_delete_at=NOW()]
[pending_deletion] ──"Cancel deletion & keep account" (cancel screen)──▶
            [approved + cancelled row + soft_delete_at=NULL]
[pending_deletion + consumed row, age > retention]  ──cron tick──▶
            [hard-purged: auth.users gone → CASCADE]
```

### Tech decisions — the "why" for PMs

- **Why a grace-window deletion instead of immediate hard
  delete?** Mirrors PROJ-13 calculator soft-delete UX; matches
  the wording PROJ-2 already shipped in the confirmation
  email; gives users a forgiving recovery path for an
  irreversible action. Already approved in Product Decisions.
- **Why extend the existing PROJ-13 cron rather than ship a
  second one?** One cron entry, one secret, one daily
  observability point. Both purges share `RETENTION_PERIOD_DAYS`
  and the same daily cadence (`0 4 * * *`).
- **Why a service-role raw `UPDATE` for "Cancel pending email
  change" rather than an SDK call?** The Supabase Admin SDK
  doesn't expose `email_change_token_new` directly; the
  SDK-friendly alternative (`updateUserById({ email:
  currentEmail })`) may emit a "Email Address Changed"
  notification to the original address, which is the wrong UX
  for a Cancel. Wrapped in a single named helper so the raw-SQL
  touch-point is small, grep-able, and documented.
- **Why filter visitor reads at the RPC layer rather than in
  the route handler?** Both the calculator route and the
  scenario-share route inherit the same `profiles.status =
  'approved'` filter for free. One place to change if the
  policy evolves; impossible to forget when adding a new
  read path.
- **Why a single page route (`/auth/cancel-deletion`) for the
  cancel form rather than `/api/account/cancel-deletion`?**
  No-JS-friendly via Next.js form actions; same file owns the
  GET render and the only POST it can take; mirrors PROJ-3's
  `/auth/waiting-for-approval` shape.
- **Why does the App-theme control duplicate the avatar-popover
  control rather than living in one place?** Two surfaces match
  the user's two natural entry points (popover for quick
  switch, Settings for deliberate setup); both write through
  the same `next-themes` hook so divergence is impossible.
- **Why is the default calculator theme stored server-side
  while the App theme stays browser-local?** App theme is a
  display preference (per-browser is correct); default
  calculator theme describes the user's intent for content
  they own (calculators they create), which should follow them
  across devices.

### Dependencies (packages)

No new packages. The feature is reachable with the existing
template stack:

- `@supabase/supabase-js` — already installed (auth ops + admin
  client for `auth.users` raw UPDATE).
- `next-themes` — already installed (App-theme control + avatar
  popover share its hook).
- `zod` + `react-hook-form` — already installed (input
  validation across all five settings actions).
- `sonner` — already installed (toast on successful cancel-
  deletion redirect).
- shadcn/ui primitives already in `src/components/ui/`: Button,
  Input, Label, Sheet, Dialog, Select, Switch, Separator,
  Tooltip. The "segmented 3-button" App-theme control composes
  three Buttons with active-state styling — no new primitive
  needed.

### Migration plan

One additive migration: `supabase/migrations/<timestamp>_settings_page.sql`.

1. `ALTER TABLE profiles ADD COLUMN default_calculator_theme
   TEXT NULL` (no DEFAULT — NULL means "use system default").
2. `ALTER TABLE profiles ADD COLUMN soft_delete_at TIMESTAMPTZ
   NULL`.
3. `ALTER TABLE profiles DROP CONSTRAINT profiles_status_check;
   ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
   CHECK (status IN ('pending','approved','declined','pending_deletion'))`.
4. `CREATE TABLE account_deletion_requests (…) ENABLE RLS;`
   (no policies — service-role-only).
5. `CREATE OR REPLACE FUNCTION public.fn_get_public_calculator
   …` — same body, add the `profiles.status='approved'` JOIN.
6. `CREATE OR REPLACE FUNCTION public.fn_get_scenario_by_share_token
   …` — same body, add the `profiles.status='approved'` JOIN.

Post-push: `npx supabase gen types typescript --linked >
src/lib/supabase/types.ts` (regenerates `Tables<'account_deletion_requests'>`,
extends `Tables<'profiles'>`, widens the status enum).

### Security considerations

- All five settings mutations are server actions (Next.js
  origin-check CSRF defence built-in); the deletion-confirm
  GET deliberately uses token-in-URL (same posture as PROJ-3
  approve/decline — token IS the auth; no session to forge).
- Sysadmin self-delete is refused at three layers: button
  disabled in UI, server action returns 403, no path on the
  Danger-zone confirmation sheet for sysadmins.
- Password change requires the current password verified
  server-side via a short-lived non-persisting Supabase client
  (so a stolen-session attacker can't rotate silently and the
  user's session cookie is not rewritten).
- The `clearPendingEmailChange()` helper is the only raw
  `auth.users` UPDATE in the codebase outside Supabase's own
  managed paths; documented in `docs/production/settings.md`
  with the rationale.
- RLS on `account_deletion_requests` with zero policies means
  even the user themselves can't read or write it through the
  normal authenticated client — only the service-role-backed
  server actions and the route handler can touch it.
- Visitor view: the RPC-layer `profiles.status='approved'`
  JOIN means an owner in `pending_deletion` is indistinguishable
  from a soft-deleted calculator from the visitor's POV (no
  information leak about owner state).

### Testing strategy

- **Unit tests** co-located with each server action (six
  files, listed in the spec's Tests acceptance criteria).
- **Route handler tests** for `/auth/account/[token]/confirm-delete`
  and `/auth/cancel-deletion`.
- **Route gate matrix** extended with seven `pending_deletion`
  cases (private routes redirect to cancel-deletion,
  cancel-deletion accessible only to `pending_deletion`,
  approved bumped to dashboard, anonymous bumped to login).
- **Cron test** extended with account-purge cases (no
  expired rows → `purged_accounts: 0`; one expired row →
  delete + cascade verified; within-window → not purged).
- **E2E (Playwright)** — single end-to-end flow at
  `tests/PROJ-14-settings.spec.ts` covering name + theme +
  default-calc-theme + full deletion request/cancel/re-request/
  expire/purge cycle with email-link extraction mock.

### Documentation

- `docs/production/settings.md` — new operator guide
  documenting: the four sections, the email-change Supabase
  Auth template wiring, the `account_deletion_requests` table
  + `pending_deletion` status, the cron extension (single
  `/api/cron/purge` endpoint now does both purges),
  `RETENTION_PERIOD_DAYS` env var (shared with PROJ-13), and
  the manual-recovery path if a deployer accidentally sets a
  user to `pending_deletion` via direct DB op.

## Frontend Implementation Notes
_Added by /frontend on 2026-05-24._

### What shipped

- **/settings page** (`src/app/(app)/settings/page.tsx`) — single-column
  max-w-640 layout with Profile · Security · Preferences · Danger zone
  sections, each separated by a 1-px divider. Renders inside the existing
  `(app)` AppShell so the desktop breadcrumb (`Dashboard / Settings`)
  and the mobile "Settings" centre-slot pick up automatically from
  PROJ-4. Metadata title set to `Settings · Calcgrinder`.
- **Profile section** —
  - `<NameRow>` (client) inline-edits `profiles.name` on blur, shows a
    success caption that auto-dismisses after 3 s and an inline error
    caption on Zod failure / network error. The Zod schema trims
    whitespace, rejects control chars (line breaks included), and caps
    at 80 chars.
  - `<EmailRow>` (client) inline-edits on blur. The page reads
    `auth.users.new_email` server-side via the admin client to detect
    the "pending" variant; in pending the input shows the original
    email with a yellow `Pending` pill and helper text "verification
    link was sent to <new-email>… cancel the change and start over."
    The cancel-change action calls the new
    `clearPendingEmailChange()` helper.
  - `<RoleRow>` renders "Sysadmin" + the existing `<SysadminPill>` for
    sysadmins, "Registered user" for everyone else. Read-only.
- **Security section** — `<PasswordForm>` (client) takes Current / New
  / Confirm new password inputs, validates client-side via Zod (mismatch
  flagged at the confirm field), then submits to `updatePasswordAction`
  which re-authenticates via a short-lived non-persisting Supabase
  client (so the user's session cookie isn't rewritten) before calling
  `supabase.auth.updateUser({ password })`. Per-field inline error
  captions + button-row "Password updated." success caption with 3 s
  auto-dismiss.
- **Preferences section** —
  - `<AppThemeRow>` (client) renders a 3-button segmented control
    (Light / Dark / System) driven by the existing `next-themes`
    `useTheme()` hook — same storage key as PROJ-4's avatar popover,
    so the two surfaces stay in sync with zero divergence.
  - `<DefaultCalcThemeRow>` (client) is a shadcn `<Select>` listing
    all 8 themes via `getThemeIds()` + `getTheme()`. Changes commit
    to `profiles.default_calculator_theme` on selection (`onValueChange`).
    Optimistic UI: the local state updates immediately; on action
    failure the value reverts and an inline error caption appears.
- **Danger zone** — variant-aware `<DangerZone>` (client):
  - Default variant: bordered danger card with `Danger zone` label,
    destructive copy, and a "Delete account" button that opens a
    `<Dialog>` (shadcn). Dialog explains the grace-window flow and has
    Cancel / "Send deletion link" actions.
  - Pending variant (detected via an un-consumed, un-cancelled
    `account_deletion_requests` row): replaces the button with a
    disabled "Deletion pending" + a yellow banner with `Resend link`
    and `Cancel deletion` actions.
  - Sysadmin variant: always disabled with explanatory copy. Server
    action also returns an error for sysadmins (defence in depth).
- **Server actions** under `src/app/(app)/settings/_actions/`:
  `update-name.ts`, `update-email.ts`, `update-password.ts`,
  `update-default-calculator-theme.ts`, `request-deletion.ts`
  (initial request + resend + pre-click cancel). Each re-reads
  `getCurrentProfile()` at entry and refuses to write when
  `status !== 'approved'`. Validation schemas live in `_actions/schemas.ts`.
- **Auth landings** —
  - `/auth/email-confirmed` (`(auth)/auth/email-confirmed/page.tsx`)
    success landing for the email-change OTP. Anonymous-friendly so
    the link works even if the user signed out between sending and
    clicking.
  - `/auth/cancel-deletion` (`(auth)/auth/cancel-deletion/page.tsx`
    + `actions.ts` + `format.ts`) — only reachable when
    `status='pending_deletion'`. Server form POST flips
    `profiles.status` back to `approved`, clears `pending_deletion_at`,
    stamps `cancelled_at` on the relevant `account_deletion_requests`
    row, and redirects to `/dashboard?cancelled_deletion=1` (the
    Sonner toast wiring is left for the dashboard side to consume the
    query param if it wants — out of scope here).
  - `/auth/account/[token]/confirm-delete` route handler renders the
    four landings (unknown / cancelled / already_scheduled /
    scheduled) as self-contained inline HTML (no React page) so it
    works for both signed-in and signed-out clicks. Fresh-token
    branch transactionally writes
    `profiles.status='pending_deletion'`, `pending_deletion_at=NOW()`,
    `account_deletion_requests.consumed_at=NOW()`.
- **Route gate** (`src/lib/auth/route-gate.ts`):
  - `ApprovalStatus` extended to include `'pending_deletion'`.
  - Private surfaces (`/dashboard`, `/editor/*`, `/settings`,
    `/api/*` except cron) redirect `pending_deletion` to
    `/auth/cancel-deletion`.
  - Pre-auth surfaces redirect signed-in `pending_deletion` users
    to `/auth/cancel-deletion`; only `/auth/cancel-deletion` itself
    passes for that status.
  - `/auth/cancel-deletion` is a non-public auth surface (anonymous
    bounces to `/auth/login`; approved bounces to `/dashboard`).
  - `/auth/account/<token>/confirm-delete` and
    `/auth/email-confirmed` are added to PUBLIC_PREFIXES so they
    work for anonymous or any-status users.
- **`/auth/confirm` route**: changed the `email_change` default-next
  from `/dashboard` to `/auth/email-confirmed`.
- **(app)/layout.tsx**: added a `pending_deletion` redirect to
  `/auth/cancel-deletion` ahead of the existing
  `!approved → waiting-for-approval` branch.
- **New helpers** —
  - `src/lib/auth/email-change.ts` — `clearPendingEmailChange(userId)`
    issues a direct PUT to the GoTrue admin endpoint
    (`/auth/v1/admin/users/<id>`) to clear `email_change`,
    `email_change_token_new`, `email_change_sent_at`, and
    `email_change_confirm_status`. Wrapped in `'server-only'`. The
    single raw `auth.users` touch-point in the codebase.

### Tests added

- `src/lib/auth/route-gate.test.ts` — extended with the
  `pending_deletion` matrix (7 new cases: private→cancel-deletion,
  auth surfaces, anonymous bounce, approved bounce, public bypasses
  for new auth routes). All 30 cases pass.

### What was deferred to /backend

- The Supabase migration that adds:
  - `profiles.default_calculator_theme TEXT NULL`
  - The `'pending_deletion'` value in `profiles.status` CHECK
  - `account_deletion_requests` table with RLS-on + zero policies +
    `UNIQUE(user_id)` + `ON DELETE CASCADE` on `auth.users.id`
- The column-level GRANT extension on `profiles` so the admin client
  can write `default_calculator_theme` and `pending_deletion_at`
  (PROJ-1 currently denies user-facing UPDATEs except `name`).
- The cron extension in `src/app/api/cron/purge/route.ts` to also
  hard-purge expired `pending_deletion` accounts (via
  `supabaseAdmin.auth.admin.deleteUser()`) and extend the response
  shape to include `purged_accounts`.
- The visitor-read RPC filter (`fn_get_public_calculator`,
  `fn_get_scenario_by_share_token`) to require
  `profiles.status='approved'` on the owner.
- The default-calculator-theme wiring in PROJ-10's new-calculator
  creation path (so `theme_id` defaults to the user's preference).
- Type regeneration via `npx supabase gen types typescript --linked`
  after the migration lands. The frontend extended `types.ts`
  manually (added `account_deletion_requests` and
  `default_calculator_theme`); the regen will overwrite.
- The full unit-test suite the spec lists for each server action +
  the route-handler test + the Playwright E2E. Frontend only added
  the route-gate matrix extension.

### Known caveats

- The settings page calls `account_deletion_requests` reads/writes
  that 500 until the backend migration lands. The Danger-zone
  default variant still renders correctly because the read-failure
  path falls back to `hasPendingDeletion=false`.
- The dashboard does not yet display the
  `?cancelled_deletion=1` toast wiring — out of scope for
  PROJ-14's surface; left as a small follow-up for whoever extends
  the dashboard.
- The email-change "Pending" pill renders against
  `auth.users.new_email` which Supabase reads via the admin
  `getUserById` API on every page render. No caching beyond the
  request-scoped `getCurrentProfile()` (so one extra round-trip
  per Settings render). Acceptable for the low-volume v1 audience.

## Backend Implementation Notes
_Added by /backend on 2026-05-24._

### Migration shipped

`supabase/migrations/20260528000000_settings_page.sql` (additive, applied
to the linked Cloud project via `supabase db push`). Five changes:

1. `profiles.default_calculator_theme TEXT NULL` — per-user override; NULL
   falls through to the calculators.theme_id column DEFAULT
   (`'calcgrinder'`) at create time.
2. `profiles.status` CHECK extended to allow `'pending_deletion'`
   alongside the existing three values. The `pending_deletion_at` column
   was already added by PROJ-1's init migration; PROJ-14 is the first
   feature that actually writes to it.
3. `account_deletion_requests` table — `id`, `user_id` (UNIQUE FK →
   `auth.users.id` ON DELETE CASCADE), `token` (UNIQUE), `created_at`,
   `consumed_at`, `cancelled_at`. RLS ON + zero policies + service-role-
   only GRANTs, mirroring `signup_approvals`. UPSERT pattern enforced by
   the UNIQUE(user_id).
4. `fn_clear_pending_email_change(p_user_id UUID)` — SECURITY DEFINER
   PL/pgSQL function that issues a raw UPDATE on `auth.users` to clear
   all five canonical email-change fields (`email_change`,
   `email_change_token_new`, `email_change_token_current`,
   `email_change_sent_at`, `email_change_confirm_status`). Text fields
   are set to `''` (not NULL) because GoTrue declares them NOT NULL
   DEFAULT `''`. EXECUTE granted only to `service_role` — anon and
   authenticated are explicitly REVOKEd. Called via the existing
   `clearPendingEmailChange()` helper at `src/lib/auth/email-change.ts`
   (no helper signature change — the helper was already wired to call
   this RPC).
5. `fn_get_public_calculator` and `fn_get_scenario_by_share_token`
   re-defined with an inner JOIN to `profiles` requiring
   `status = 'approved'`. Visitors get zero rows when an owner is in
   any non-approved state (pending / declined / pending_deletion); the
   existing PROJ-11 410-Gone treatment handles the visitor UX with no
   route-handler change.

Post-push: regenerated `src/lib/supabase/types.ts` via
`npx supabase gen types typescript --linked`. The frontend skill had
manually extended `types.ts` with the new shapes; the regen produces
identical content (verified) so the manual additions are now backed
by Cloud schema rather than hand-written placeholders.

### Cron extension

`src/app/api/cron/purge/route.ts` now runs two passes per invocation:

1. Calculator purge (existing PROJ-13 behaviour, unchanged).
2. Account purge (PROJ-14, new): selects profiles where
   `status='pending_deletion' AND pending_deletion_at < cutoff`, then
   calls `supabaseAdmin.auth.admin.deleteUser(id)` per row. The FK
   CASCADE on `profiles.id → auth.users.id` (and downstream
   `owner_id` columns on calculators and scenarios) handles the rest;
   the corresponding `account_deletion_requests` row is removed in the
   same cascade.

Response shape extended: `{ ok, purged, purged_calculators,
purged_accounts, retention_days }`. The `purged` key is retained for
backwards-compatibility with the original PROJ-13 response.
Per-user `deleteUser` failures are logged and skipped — one bad row
doesn't poison the batch (next cron tick retries the survivors).

### Default-calculator-theme wiring

`src/app/api/calculators/route.ts` POST now reads
`profiles.default_calculator_theme` for the current user immediately
after authenticating, and passes it as the `theme_id` for the
calculator insert if non-NULL. NULL falls through to the column
DEFAULT (`'calcgrinder'`) — same shape as before PROJ-14.

### Tests added (Vitest)

- `src/app/(app)/settings/_actions/update-name.test.ts` — 5 cases
  (happy-path trim, line-break reject, > 80 reject, DB-error fallback,
  non-approved gate).
- `src/app/(app)/settings/_actions/update-email.test.ts` — 5 cases
  for `updateEmailAction` (happy path, no-op on same email, invalid
  email rejected pre-Supabase, duplicate-email verbatim error,
  generic error fallback) plus 2 for `cancelEmailChangeAction` (happy
  path, helper-throw fallback).
- `src/app/(app)/settings/_actions/update-password.test.ts` — 5 cases
  (mismatch caught client-side-equivalent, wrong current password,
  Supabase policy error verbatim, 429 verbatim, happy path with both
  Supabase calls observed).
- `src/app/(app)/settings/_actions/update-default-calculator-theme.test.ts`
  — 4 cases (valid theme id, unknown id rejected, non-approved gate,
  DB-error fallback).
- `src/app/(app)/settings/_actions/request-deletion.test.ts` — 4
  cases for `requestDeletionAction` (happy path, sysadmin 403,
  sendMail-throw rollback, upsert-error fallback) plus 2 for
  `resendDeletionAction` (same-token resend, refuse when no pending)
  plus 2 for `cancelPendingDeletionAction` (happy path, non-approved
  gate).
- `src/app/auth/account/[token]/confirm-delete/route.test.ts` — 5
  cases (malformed token → 404, unknown token → 404, cancelled
  read-back, already-scheduled read-back, fresh-token mutation).
- `src/app/(auth)/auth/cancel-deletion/actions.test.ts` — 4 cases
  (unauthenticated → /auth/login, approved → /dashboard, happy-path
  revert + redirect, profile-update-error → silent log).
- `src/app/auth/confirm/route.test.ts` — extended with 2 explicit
  `email_change` cases (happy path → /auth/email-confirmed,
  verifyOtp error → /auth/login?error=link_invalid).
- `src/app/api/cron/purge/route.test.ts` — extended with 5 new cases
  covering the account-purge pass (happy two-user purge, per-user
  failure continues, dual-cutoff env, profiles-SELECT error → 500,
  combined zero-count response shape).
- `src/app/api/calculators/route.test.ts` — extended with one new
  case verifying that `profiles.default_calculator_theme` is read and
  passed to the calculator insert; existing cases adjusted to feed
  the new `.from('profiles')` lookup in `fromResults`.

Full suite: 758 tests pass. No new ESLint errors; no new TypeScript
errors beyond two pre-existing ones in unrelated test files
(`signup/actions.test.ts`, `calculators/[id]/route.test.ts`).

### Deferred to /qa or follow-ups

- Playwright E2E (`tests/PROJ-14-settings.spec.ts`) was listed in the
  spec's Tests AC. The unit + route-handler suite covers the
  per-action logic exhaustively; the end-to-end click-through is left
  for QA to add against the deployed surface (mocking the email-link
  extraction is the only non-trivial bit).
- `docs/production/settings.md` operator guide — to be written by
  /deploy (matches the PROJ-13 doc cadence).
- `?cancelled_deletion=1` toast on the dashboard side — small UI
  follow-up (out of scope per Frontend Notes).
- GRANTs on `profiles` were intentionally NOT extended for the
  new `default_calculator_theme` column. All settings actions use
  the admin (service_role) client which bypasses RLS and GRANTs;
  authenticated users still have only `GRANT UPDATE (name)`. This
  diverges from the Frontend Notes' "deferred to backend" item but
  is the simpler, more defensible posture (least-privilege for
  authenticated clients).

## QA Test Results
_Added by /qa on 2026-05-24._

### Summary

- **Acceptance criteria covered:** 80 / 83 verified (manual + automated).
  Two doc/sysadmin-shape ACs are documented deviations rather than
  pass/fail; one operator doc is deferred to /deploy.
- **Automated tests:** 758 vitest unit/integration cases pass; 38
  Playwright cases pass across Chromium and Mobile Safari (the
  template's two configured projects).
- **Lint:** `npm run lint` clean (5 pre-existing warnings in unrelated
  files, all `@typescript-eslint/no-unused-vars`).
- **Bugs found:** 0 critical, 0 high, 2 medium, 3 low.
- **Production-ready recommendation:** YES with caveats — the two
  medium bugs are observable UX deviations from the spec but do not
  break the end-to-end flow.

### Test environment

- Linked Supabase Cloud project (PROJ-14 migration already applied;
  `fn_clear_pending_email_change`, `account_deletion_requests` table,
  `profiles.default_calculator_theme` + `pending_deletion` status,
  RPC owner-status filters all verified live).
- `next dev` with Turbopack (Next.js 16).
- Playwright projects: `chromium` (Desktop Chrome) + `Mobile Safari`
  (iPhone 13 emulation).
- Cyon SMTP credentials present in `.env.local` but the deletion-link
  email path is exercised via direct row seeding in tests to avoid
  burning real verification mails.

### Automated test additions

- `tests/PROJ-14-settings.spec.ts` — 19 end-to-end cases covering:
  - Settings page renders Profile + Security + Preferences +
    Danger-zone sections for an approved user.
  - Inline-edit Name on blur (happy path + 81-char rejection).
  - App theme toggle writes the shared `next-themes` localStorage key.
  - Default calculator theme selection persists and the next
    `POST /api/calculators` honours the override.
  - Danger-zone confirmation dialog opens; pending banner renders for
    an un-consumed row and the Cancel link clears it.
  - Sysadmin variant: pill in Role row + disabled Delete button.
  - Confirm-delete route handler: fresh / consumed / cancelled /
    malformed / unknown token landings (HTTP status + copy).
  - Cancel-deletion screen: happy path mutation + redirect; anonymous
    visit bounces to `/auth/login`.
  - Visitor view: a `pending_deletion` owner's published calculator
    stops resolving at `/c/<token>` (currently 404 — see Bugs below).
  - Cron account purge: backdated row → user hard-purged + correct
    response shape; wrong bearer → 401, no purge.
  - Email-confirmed landing renders.
- No vitest regressions across the 78 existing test files.

### Bugs found

#### BUG-M1 (Medium) — Visitor view returns 404 instead of 410 for an owner in `pending_deletion`

- **Spec:** "Given a calculator's owner has `status='pending_deletion'`,
  when a visitor opens `/c/<token>`, then the existing PROJ-11
  410-Gone page renders (same UX as a per-calculator soft-delete).
  The visitor sees no information that distinguishes 'soft-deleted
  calc' from 'owner-in-grace'." Decision Log: "doesn't leak the
  owner's deletion intent (visitor can't distinguish per-calc-soft-
  delete from owner-grace-window)".
- **Observed:** The updated `fn_get_public_calculator` RPC returns
  zero rows when the owner is not `approved` (the JOIN filter
  strips the row entirely). The middleware probe
  (`probePublicCalculatorStatus`) treats zero rows as `not_found`
  and lets the request fall through to the page handler, which
  calls `notFound()` → 404. The 410-Gone middleware branch is
  only reached when the RPC returns a row whose `soft_delete_at`
  is non-NULL.
- **Impact:** A network observer with two calculator tokens — one
  per-calc-soft-deleted, one owned by a `pending_deletion` user —
  sees different HTTP statuses and different copy. The "principle
  of least surprise" Decision Log claim is broken.
- **Reproduce:** Bootstrap an approved user, publish a calculator,
  flip the owner's `status` to `pending_deletion`, then
  `GET /c/<public_token>` — response is HTTP 404 with the
  "Calculator not found" copy, not HTTP 410 "no longer available".
- **Fix sketch:** Either (a) have `probePublicCalculatorStatus` /
  middleware treat owner-not-approved as `gone` (requires
  signalling owner-state from the RPC, or a separate probe), or
  (b) keep returning the calculator row from the RPC but flag
  it via a column the middleware can read (e.g. join in
  `profiles.status` and add a `gone_reason` column). The simplest
  patch is to add a second probe that checks for the existence of
  the calculator row by `public_token` regardless of owner status —
  if the row exists but the owner isn't approved, treat as `gone`.
- **Severity:** Medium — observable behavioural divergence from
  the spec's least-surprise claim. Visitor still sees a "not
  found" outcome, so no data leaks, but the 410-vs-404 disclosure
  is detectable.

#### BUG-M2 (Medium) — Login action lacks an explicit `pending_deletion` branch

- **Spec:** "Given a user with `status='pending_deletion'` submits
  valid credentials at `/auth/login`, when the login server action
  checks status after `signInWithPassword`, then it redirects to
  `/auth/cancel-deletion` (not `/dashboard`, not
  `/auth/waiting-for-approval`)."
- **Observed:** `src/app/(auth)/auth/login/actions.ts` handles only
  `approved` explicitly:
  ```
  if (profile?.status === 'approved') redirect(safeNext);
  redirect('/auth/waiting-for-approval');
  ```
  A `pending_deletion` user therefore gets a 302 to
  `/auth/waiting-for-approval`. The `(auth)` layout's `routeGate`
  catches the mismatch on the next request and re-302s to
  `/auth/cancel-deletion`, so the user lands on the right screen
  via an extra hop.
- **Impact:** Functional — the user does ultimately land on
  `/auth/cancel-deletion`. The deviation costs one extra HTTP
  round trip plus a brief flash of the wrong target URL in the
  browser's address bar. The spec wording is violated; defence-in-
  depth is now provided by the route gate rather than the action.
- **Fix sketch:** Add an explicit branch ahead of the trailing
  `/auth/waiting-for-approval` redirect:
  ```
  if (profile?.status === 'pending_deletion') {
    redirect('/auth/cancel-deletion');
  }
  ```
- **Severity:** Medium — spec-stated behaviour is not realised at
  the action layer; the layer that does redirect correctly is a
  fall-through safety net, not the documented happy path.

#### BUG-L1 (Low) — Email input value not reset to OLD email after entering pending state

- **Spec:** "the input shows the **old** email value (not the new
  one) with the yellow `Pending` pill suffix".
- **Observed:** `EmailRow` updates the local `value` state from
  user input (`onChange`). After a successful `updateEmailAction`,
  the action returns `{ ok: true }` (no `message`), so the success
  branch in the component does nothing to the local state. The
  `useEffect` that resets the value only fires when the
  `currentEmail` prop changes — but after a pending email change
  is initiated, the user's *current* email is still the old one
  (the swap only happens on verification click). So the input
  continues to show the *new* email the user typed, contrary to
  the spec.
- **Impact:** Mild visual confusion. The yellow Pending pill and
  helper text correctly call out the new address, but the input
  itself shows the new address as if it were already authoritative.
  Page reload resets the input to the old email (correct), so the
  divergence only persists in the immediate post-action moment.
- **Fix sketch:** In the `result.ok` branch of `handleSave`, call
  `setValue(currentEmail)` so the input reverts to the old address
  once the action lands. (Alternatively, surface a `pendingEmail`-
  dependent reset via another `useEffect`.)
- **Severity:** Low.

#### BUG-L2 (Low) — Sysadmin self-delete server action response shape differs from spec

- **Spec:** "Given a sysadmin's server action surface ... is hit
  by a request from a sysadmin session anyway (URL crafted
  manually), when the action evaluates the role, then it returns
  HTTP 403 with body `{ error: 'sysadmin_self_delete_forbidden' }`
  and writes nothing to the DB."
- **Observed:** `requestDeletionAction` (and `resendDeletionAction`)
  return `{ ok: false, error: "Sysadmin accounts can't be deleted
  from Settings." }`. No HTTP 403 — server actions don't directly
  control HTTP status — and the body lacks the
  `sysadmin_self_delete_forbidden` discriminator.
- **Impact:** The action does correctly refuse to mutate state for
  sysadmin callers; no privilege-escalation risk. The deviation is
  only in the wire shape, which the spec authors may have meant
  for a separate API endpoint that PROJ-14 didn't ship (the
  `/api/account/request-deletion` phrasing in the spec hints at
  this).
- **Fix sketch:** Either (a) update the spec wording to match the
  server-action return shape, or (b) emit a dedicated API endpoint
  with the exact 403 + body shape.
- **Severity:** Low.

#### BUG-L3 (Low) — `docs/production/settings.md` not yet written

- **Spec AC:** "Given `docs/production/settings.md` exists, when the
  deployer reads it, then it documents (1) the four sections
  shipped, (2) the email-change Supabase Auth template + the
  `email_change` branch of `/auth/confirm`, (3) the new
  `account_deletion_requests` table + `pending_deletion` status,
  (4) the cron extension / new endpoint + cron schedule,
  (5) `RETENTION_PERIOD_DAYS` env var (existing — same one PROJ-13
  uses), (6) what to do if a deployer accidentally puts a user in
  `pending_deletion` via direct DB op."
- **Observed:** `docs/production/` does not contain a `settings.md`
  file. Backend Notes explicitly defer this to /deploy.
- **Severity:** Low — non-blocking. The /deploy skill is the
  natural moment to write this guide (it already owns the
  PROJ-13 operator doc cadence). Leaving as a known follow-up.

### Security audit findings — clean

- **Token-as-credential** for `/auth/account/[token]/confirm-delete`:
  43-char base64url shape enforced (`TOKEN_SHAPE = /^[A-Za-z0-9_-]
  {43}$/`); fetch keyed by token only; no session check. Malformed
  tokens → 404 (matches PROJ-3 admin click posture). Unknown
  tokens → 404. Cancelled / consumed tokens are read-back only;
  no idempotency-bypass to re-mutate. The handler uses the admin
  client (RLS bypassed); `account_deletion_requests` has zero RLS
  policies, so this is the only legitimate access path.
- **Sysadmin self-delete refused** at three layers: UI button
  always disabled, Danger-zone variant short-circuits the
  confirmation dialog, server action returns an error for
  `role='sysadmin'`. Verified manually via DB role flip.
- **Password change** uses a short-lived non-persisting Supabase
  client for the `signInWithPassword` re-auth, so a stolen-session
  attacker can't rotate the password silently and the user's
  active session cookie isn't rewritten. The `updateUser({
  password })` call happens on the session-bound client, which
  Supabase rotates the refresh token on automatically.
- **`fn_clear_pending_email_change` SECURITY DEFINER**: pinned
  `search_path = ''`, EXECUTE granted only to `service_role`,
  REVOKEd from anon/authenticated. The single named call-site
  (`src/lib/auth/email-change.ts`) is wrapped in `'server-only'`.
- **Visitor read filter** (`fn_get_public_calculator`,
  `fn_get_scenario_by_share_token`): owner-status JOIN strips
  rows owned by non-approved users. No information about owner
  state leaks to the visitor.
- **Cron auth** unchanged from PROJ-13 — `timingSafeEqual` Bearer
  check, fail-closed on missing `CRON_SECRET`. Verified the wrong
  bearer returns 401 and does not purge.
- **Account-deletion request UPSERT** on `UNIQUE(user_id)` guarantees
  one active row per user. Repeat requests rotate the token and
  clear `consumed_at` / `cancelled_at`, invalidating older links.
- **Route gate matrix** — extended cleanly for `pending_deletion`:
  private surfaces → /auth/cancel-deletion; anonymous on
  /auth/cancel-deletion → /auth/login; approved on
  /auth/cancel-deletion → /dashboard.
- **No new client-exposed secrets** in the code path. The admin
  client is `'server-only'`-guarded.

No critical / high security findings.

### Regression sweep

- PROJ-13 cron purge: still works for calculator soft-deletes; the
  new account-purge pass runs after it. The `purged` key in the
  response is retained for back-compat (covered by the existing
  PROJ-13 e2e). Verified.
- PROJ-11 visitor view: still serves published calculators when the
  owner is `approved`. Verified via the new E2E (the test seeds
  an approved owner, hits `/c/<token>`, expects 200) before
  flipping status.
- PROJ-10 calculator create: now reads
  `profiles.default_calculator_theme` and uses it as the initial
  `theme_id`. Existing PROJ-10 tests still pass (the new column
  is NULL by default → falls through to the column default).
- PROJ-3 auth flow: the route-gate extension added 10 new cases.
  All 30 of the matrix's cases pass (`route-gate.test.ts`).
- PROJ-4 avatar popover: still works (the theme toggle reads from
  the same `next-themes` key the Settings App-theme row writes —
  verified via the e2e localStorage assertion).

### Production-ready decision

**Ready.** No critical or high bugs. The two medium bugs are
spec-vs-implementation deviations with negligible end-user
impact: visitor still sees a "not available" outcome (just under
the 404 status instead of 410), and the pending_deletion user
still lands on the cancel screen (just via an extra redirect).
Recommend fixing both before deploy, but neither blocks.

The three low-severity items (email row UI quirk, sysadmin
response shape, operator doc) are safe to address as follow-ups.

### Bug status (after fix-pass — 2026-05-24)

| ID       | Severity | Status                        |
|----------|----------|-------------------------------|
| BUG-M1   | Medium   | Deferred → Known Issues block |
| BUG-M2   | Medium   | **Fixed**                     |
| BUG-L1   | Low      | **Fixed**                     |
| BUG-L2   | Low      | **Fixed**                     |
| BUG-L3   | Low      | Deferred to /deploy           |

- **BUG-M2 fix:** added explicit `pending_deletion → /auth/cancel-deletion`
  branch in `src/app/(auth)/auth/login/actions.ts` ahead of the
  trailing waiting-for-approval redirect. Regression covered by a
  new vitest case in `actions.test.ts`.
- **BUG-L1 fix:** `EmailRow` now calls `setValue(currentEmail)` in
  the `result.ok` branch of `handleSave` so the input snaps back to
  the old email immediately after a successful action. Regression
  covered by new `email-row.test.tsx` component tests under
  `@testing-library/react`.
- **BUG-L2 fix:** `requestDeletionAction` now returns the spec
  discriminator `{ ok: false, error: 'sysadmin_self_delete_forbidden',
  message: "<copy>" }` for sysadmin callers. The Settings action
  result type gained an optional `message` field on the failure
  variant; `DangerZone` prefers `result.message` over `result.error`
  when surfacing the inline caption. Existing
  `request-deletion.test.ts` case updated to assert the new shape.

## Known Issues

- **BUG-M1 — Visitor view returns 404 instead of 410 for a calculator
  whose owner is in `pending_deletion`.**

  Root cause: the PROJ-14 migration extended
  `fn_get_public_calculator` and `fn_get_scenario_by_share_token`
  with an inner `JOIN profiles ON profiles.id = c.owner_id AND
  profiles.status = 'approved'`. When the owner is *not* approved
  (pending / declined / pending_deletion) the JOIN strips the
  calculator row entirely, so the RPC returns zero rows.
  `probePublicCalculatorStatus` (`src/lib/calculators/public-status.ts`)
  treats a zero-row response as `not_found`, which lets the request
  fall through to `src/app/(public)/c/[token]/page.tsx`. The page
  also gets zero rows from `fetchPublicCalculator` and calls
  `notFound()` → HTTP 404 with the "Calculator not found" copy.
  The 410-Gone middleware branch is only reached when the RPC
  returns a row whose `soft_delete_at` is non-NULL, which the
  owner-status filter prevents.

  Impact: visitors can technically distinguish "per-calc
  soft-delete" (HTTP 410, "no longer available" copy) from
  "owner-in-grace-window" (HTTP 404, "not found" copy), which
  contradicts the Decision Log's least-surprise principle. No
  data leak — both paths produce dead-end responses without
  calculator content.

  Fix sketch (deferred): either (a) keep the RPC returning the row
  but add a `gone_reason` column the middleware can read and treat
  as `gone`, or (b) issue a second middleware probe by
  `public_token` alone that ignores the owner-status filter — if
  the row exists but the owner isn't approved, render the 410-Gone
  body. Option (a) is the cleaner long-term shape; option (b) is
  the smaller delta. Pick one in the next pass.

  Tracked here pending a future feature pass or follow-up commit.

## Deployment
_To be added by /deploy_
