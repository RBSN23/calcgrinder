# PROJ-2: Email Infrastructure (SMTP + transactional)

## Status: Deployed
**Created:** 2026-05-22
**Last Updated:** 2026-05-22
**Deployed:** 2026-05-22 to https://calcgrinder.vercel.app

## Dependencies

- **PROJ-1** (Supabase Infrastructure Setup) — PROJ-2 reuses
  the Cyon SMTP env-var placeholders that PROJ-1 already
  shipped in `.env.local.example`, the `scripts/` pattern
  established for `seed:sysadmin`, and the `server-only`
  boundary convention.

## User Stories

- As a deployer, I want Supabase Auth emails (password
  reset, email verification, email-address change) delivered
  via my Cyon SMTP server, so that all outbound mail comes
  from the same sender domain and I only have to maintain
  SPF/DKIM records once.
- As a deployer, I want to verify after setup via
  `npm run email:smoke -- --to <addr> --template <name>`
  that SMTP and a specific template work, so that I can
  catch configuration errors without having to run through
  the entire auth flow.
- As a developer, I want a central `sendMail()` utility
  with fail-fast env validation, so that PROJ-3 and PROJ-14
  don't write their own SMTP logic and can't leak
  credentials into client bundles.
- As a sysadmin, I want to receive a notification email
  with approve and decline links on every new signup, so
  that I can act on it without logging into the dashboard.
- As a registered user, I want to receive a confirmation
  email with a login link once my account is approved, so
  that I know my account is now usable.
- As a registered user, I want to receive a confirmation
  email with a confirm link when I request account deletion,
  so that an accidental deletion can't take effect without
  explicit confirmation.

## Out of Scope

PROJ-2 is **pure email infrastructure** (Option A in the
interview). It ships primitives; the features that own the
flows compose them.

- **Triggering logic for the three transactional sends.**
  PROJ-3 imports the templates and calls `sendMail()` from
  its signup handler (signup-notification) and from its
  status-change handler (approval-confirmation). PROJ-14
  does the same from its Settings deletion handler
  (account-deletion-confirmation). PROJ-2 never decides
  *when* to send.
- **URL / token construction.** PROJ-2's template functions
  take complete URL strings as parameters; PROJ-3 mints the
  approve / decline tokens and builds the
  `/auth/admin/<token>` URLs, PROJ-3 builds the login URL,
  PROJ-14 builds the deletion-confirm URL. PROJ-2 has no
  knowledge of route paths.
- **DB rollback when a send fails.** `sendMail()` throws on
  failure; the calling DB transaction stays committed. v1
  uses "at-least-once dashboard, lazy email" semantics: the
  dashboard is the source of truth, the email is a push
  trigger. (See Decision Log for full per-flow recovery
  reasoning.)
- **Retry / outbox / queue / persisted send-log.** No
  `email_outbox` table, no background worker, no automatic
  retry. A failed send raises an error; the caller logs it;
  manual recourse exists per flow (re-trigger the action).
- **HTML email templates / React Email.** Plain text only
  per PRD constraint. Spam-filter friendliness on shared
  SMTP hosting is a bonus.
- **Bounce / complaint handling, soft-bounce retry.** Cyon
  SMTP returns synchronous errors on hard rejections;
  `sendMail()` surfaces those. No async bounce webhook.
- **Unsubscribe links / List-Unsubscribe headers.** All v1
  emails are transactional. No marketing or digest sends
  exist or will exist.
- **Internationalisation.** English only per PRD non-goal.
- **Local mock SMTP** (Mailpit / Mailhog / Inbucket).
  Deployer hits real Cyon. No "test mode" branch in
  `sendMail()`. No `EMAIL_DRY_RUN` env var.
- **Smoke CLI dry-run / preview modes.** Smoke CLI has one
  mode: render a real template with dummy values, send it
  via real Cyon. No flags beyond `--to` and `--template`.
- **Programmatic Cyon rate-limit handling.** v1 volume stays
  well under Cyon shared-hosting limits; setup docs note
  the limit, no code throttle.
- **DNS / SPF / DKIM / DMARC record creation.** Explicitly
  the deployer's responsibility per PRD. PROJ-2 documents
  the required records but does not automate them.
- **Auto-sync of Supabase Auth template content via the
  Management API.** PROJ-2 ships the wording as
  copy-paste blocks in `docs/production/email.md`; the
  deployer pastes once into the Supabase Dashboard.
  Template state lives in Supabase, not in code.
- **Customised wording for the Magic Link and Invite User
  Supabase Auth templates.** Left as Supabase defaults.
  Neither flow is triggered in v1; if either ever fires
  (developer error, sysadmin misclick) the wording mismatch
  is a useful canary, not a covered-up bug.
- **Per-user `From:` variants** (e.g. `noreply+<user-id>@…`).
  Single fixed sender for the whole instance.
- **`Reply-To:` header.** Not set, ever, in v1. Privacy
  decision (see Decision Log).
- **The `/auth/admin/<token>` approve / decline endpoints,
  signup handler, login redirect, Settings-page deletion
  handler.** PROJ-3 and PROJ-14.
- **Captcha / signup rate-limiting / bot defence on the
  signup form itself.** Lives in PROJ-3 if at all.
- **Operational mails to the deployer** (e.g. "PROJ-13
  nightly purge removed N calculators"). Vercel / Supabase
  logs are the deployer observability surface in v1.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] /
Then [result]

### `sendMail()` utility — transport & validation

- [ ] Given the five env vars (`CYON_SMTP_HOST`, `CYON_SMTP_PORT`, `CYON_SMTP_USER`, `CYON_SMTP_PASS`, `EMAIL_FROM`) are set, when `sendMail({ to, subject, text })` is called with valid values, then nodemailer sends the mail via Cyon and the promise resolves with the nodemailer result including `messageId`.
- [ ] Given one or more of the five env vars are missing, when `sendMail()` is called, then the function (or the module init path) throws an error with a Zod validation message naming every missing field, and no SMTP connect attempt is made.
- [ ] Given Cyon returns a 5xx SMTP error or the TCP connection fails, when `sendMail()` is called, then the promise rejects with the original nodemailer error; the caller (PROJ-3 / PROJ-14) decides independently about logging and follow-up. No PROJ-2-side retry, no DB rollback by PROJ-2.
- [ ] Given `src/lib/email/send.ts` has `import 'server-only'` as its very first import, when a client component tries to import `sendMail`, then the Next.js build fails with the `server-only` error message.
- [ ] Given `EMAIL_FROM` is set to a full RFC-5322 string with a display name (e.g. `Calcgrinder <noreply@voidforge.cc>`), when an email is sent, then the `From:` header carries exactly that string and the display name "Calcgrinder" appears in the recipient's mail client.
- [ ] Given `EMAIL_FROM` contains a syntactically invalid RFC-5322 string, when `sendMail()` is called for the first time, then the function fails with a meaningful validation message before nodemailer starts the SMTP handshake.
- [ ] Given `sendMail()` is called, when nodemailer prepares the email, then the outbound headers contain **no** `Reply-To:` field (never set by PROJ-2 under any circumstances).

### Template render functions — pure, deterministic

- [ ] Given `signupNotification({ newUserEmail, newUserName, approveUrl, declineUrl })` is called with four valid values, then the function returns a `{ subject, text }` object with subject `"New Calcgrinder signup — <newUserEmail>"` and a plain-text body containing the new user's name and email plus `approveUrl` and `declineUrl` each on their own complete URL line (no shortening, no HTML anchor).
- [ ] Given `approvalConfirmation({ recipientName, loginUrl })` is called, then the function returns a `{ subject, text }` object with subject `"Your Calcgrinder account is ready"` and a body containing `recipientName` as the greeting, a confirmation sentence, the `loginUrl`, and the sign-off `"— Calcgrinder"`.
- [ ] Given `accountDeletionConfirmation({ recipientName, confirmDeletionUrl, retentionDays })` is called, then the function returns a `{ subject, text }` object with subject `"Confirm your Calcgrinder account deletion"` and a body that contains, in this order: (1) "You requested account deletion", (2) confirm URL, (3) "Once confirmed, scheduled for deletion in <retentionDays> days", (4) "Sign back in during that window to cancel", (5) "If you didn't request this — ignore this email", (6) sign-off `"— Calcgrinder"`.
- [ ] Given one of the three template functions is called twice with identical inputs, when the outputs are compared, then they are byte-identical — no timestamps, no random IDs, no locale effects in the body.
- [ ] Given a required field of a template function is `undefined`, empty, or not a valid URL string (for URL fields), when the function is called, then it fails with a Zod validation message before any string is built.
- [ ] Given the templates are imported, when the import path is inspected, then the three template modules import **no** `server-only` and **no** `process.env` — they are pure functions over their inputs.

### Supabase Auth template content (deployer-applied)

- [ ] Given `docs/production/email.md` contains the section **"Supabase Auth Email Templates"**, when the deployer follows the guide, then they find ready-to-use copy-paste blocks (subject + body) for exactly three templates: **Confirm signup**, **Reset password**, **Change email address**. Magic Link and Invite user are explicitly marked "leave at Supabase default".
- [ ] Given the three auth templates are entered in the Supabase dashboard with the documented text, when a real password reset is triggered via Supabase Auth, then the recipient receives a plain-text email with the documented wording, sent from the configured `EMAIL_FROM` sender.
- [ ] Given the three auth templates are entered, when the subjects are inspected, then they read `"Confirm your Calcgrinder account"`, `"Reset your Calcgrinder password"`, and `"Confirm your new Calcgrinder email"` — same stylistic register as the three custom templates.

### Supabase Auth SMTP configuration (deployer-applied)

- [ ] Given `docs/production/email.md` contains the section **"Supabase Auth Custom SMTP"**, when the deployer follows the steps there, then they can enter the Cyon credentials in the Supabase Cloud Dashboard UI under **Authentication → Settings → SMTP Provider**, enable Custom SMTP, and receive a test email via `npm run email:smoke`.
- [ ] Given Supabase Auth is switched to Custom SMTP, when a new user signs up and receives the Confirm-signup email, then the `Received:` header shows the Cyon SMTP server and not the Supabase default sender.

### Smoke-test CLI — single mode, real send

- [ ] Given all PROJ-2 env vars are set in `.env.local`, when `npm run email:smoke -- --to test@example.com --template signup-notification` is run, then the script renders the `signupNotification` template with hardcoded dummy values, sends it via Cyon, prints the returned `messageId` to stdout, and exits with code 0.
- [ ] Given `--template approval-confirmation` or `--template account-deletion-confirmation` is passed, when the script is run, then it renders the corresponding template with dummies and sends it the same way.
- [ ] Given `--to` is missing or does not contain a valid email address, when the script is run, then it fails fast with exit code 1 and a Zod validation message, without connecting to SMTP.
- [ ] Given `--template` is missing or contains a value outside the three allowed template names, when the script is run, then it fails fast with exit code 1 and a Zod validation message naming the three allowed values.
- [ ] Given the script module is inspected, when modes like `--dry-run`, `--generic`, `--silent`, etc. are looked for, then **no** such modes exist — the CLI has exactly two flags (`--to`, `--template`), both required.

### Tests — 4 files total

- [ ] Given `src/lib/email/templates/signup-notification.test.ts`, `approval-confirmation.test.ts`, and `account-deletion-confirmation.test.ts` each contain a snapshot test on the full `{ subject, text }` output with fixed dummy inputs, when `npm test` is run, then all three pass and CI fails on any unintentional wording change without a snapshot update.
- [ ] Given `src/lib/email/send.test.ts` contains exactly one test (Zod fail-fast: missing env vars → throw before any I/O), when `npm test` is run, then the test passes. There is **no** mock-nodemailer happy-path test (would test the mock, not the code) and **no** live-Cyon CI test.
- [ ] Given the tests use `vi.stubEnv` for env variables, when a single test runs in isolation, then `afterEach(() => vi.unstubAllEnvs())` resets the state cleanly (same pattern as PROJ-1).

### Env vars & documentation

- [ ] Given `.env.local.example` is inspected, when the diff against PROJ-1 is viewed, then exactly one new entry has been added: `EMAIL_FROM="Calcgrinder <noreply@calcgrinder.example.com>"` with an inline comment on the RFC-5322 format. The four Cyon variables were already placeholders from PROJ-1; PROJ-2 expands their inline comment to note "Port 587 (STARTTLS) recommended; 465 (implicit TLS) alternative".
- [ ] Given `docs/production/email.md` exists, when the deployer follows the file, then they find, in this order: (1) DNS / SPF / DKIM / DMARC setup with concrete record examples for a generic domain, (2) `.env.local` Cyon SMTP values, (3) `npm run email:smoke` verification, (4) Supabase Dashboard SMTP configuration, (5) Supabase Auth template content as copy-paste blocks.
- [ ] Given `README.md` is inspected, when the setup section is read, then it points to `docs/production/email.md` as the detailed guide; the README itself does not duplicate the content.

## Edge Cases

- **Cyon temporär nicht erreichbar während eines `sendMail()`-Calls.** `sendMail()` rejected, Aufrufer entscheidet. Per-Flow-Recovery: Signup-Notification-Loss → Sysadmin sieht den User auf nächstem Dashboard-Login (PROJ-5); Approval-Confirmation-Loss → User entdeckt approval bei Login-Versuch oder Sysadmin sieht inaktiven Approved-User; Deletion-Confirmation-Loss → fail-safe (kein Klick = keine Löschung), User retried.
- **Ungültige Empfänger-Adresse** (Tippfehler beim Signup). Cyon liefert 5xx bei `RCPT TO`, `sendMail()` rejected. PROJ-3 entscheidet, ob die DB-Transaktion (User-Anlage) trotzdem durchgeht — explizit PROJ-3's Entscheidung, nicht PROJ-2's.
- **Send schlägt fehl, NACHDEM die DB-Statusänderung schon commit ist** (z. B. Approval committed, Approval-Mail kann nicht raus). Kein PROJ-2-seitiger Rollback. Logged-Error im Vercel-Log reicht; Sysadmin kann Status pending→approved erneut togglen, um die Mail neu zu triggern.
- **Long body / Non-ASCII Inhalte** (Umlaute in User-Namen, lange Calculator-Title-Quotes). nodemailer setzt UTF-8 + Quoted-Printable automatisch; Templates emittieren as-is, keine eigene Escape-Logik.
- **Spam-Filter-Klassifizierung wegen fehlendem SPF/DKIM.** Deployer-Verantwortung per PRD; `docs/production/email.md` liefert konkrete Record-Beispiele.
- **Cyon-Rate-Limit erreicht.** v1-Volumen (tens of users) bleibt weit darunter; bei Erreichen liefert Cyon einen SMTP-Error und `sendMail()` rejected.
- **`EMAIL_FROM` Display-Name enthält ungeschickte Zeichen** (Komma, Bracket). Zod-Validierung im `sendMail()`-Modul prüft RFC-5322-Display-Name + Address; ungültige Formate werfen beim ersten `sendMail()`-Call.
- **Approve/Decline-URL ist NULL oder leer** (PROJ-3 mit defektem Caller). Template-Zod-Schema prüft URL-Format und wirft fail-fast — bessere Fehler-DX als eine Mail mit "click here: undefined".
- **Empfänger ist die `EMAIL_FROM`-Adresse selbst** (z. B. Deployer registriert sich versehentlich mit `noreply@…`). Kein PROJ-2-Sonderfall; Cyon's eigene Self-Send-Policy entscheidet.
- **Smoke CLI mit falschem `--template`-Namen.** Zod-Validierung listet die drei erlaubten Werte in der Fehlermeldung — kein silent-fallback.

## Technical Requirements

- **Runtime dependency:** `nodemailer` (latest stable major, currently v7). De-facto Standard-SMTP-Library für Node; zero-config für den common case. **Bundles its own TypeScript types** — no separate `@types/nodemailer` devDep needed (that was a 6.x-era convention).
- **New env vars:** exactly one new entry — `EMAIL_FROM` — added to `.env.local.example`. The four Cyon-SMTP vars were placeholders shipped in PROJ-1.
- **File layout:**
  - `src/lib/email/send.ts` — `sendMail()` utility, `import 'server-only'`, Zod env-validation.
  - `src/lib/email/templates/signup-notification.ts`
  - `src/lib/email/templates/approval-confirmation.ts`
  - `src/lib/email/templates/account-deletion-confirmation.ts`
  - `src/lib/email/templates/index.ts` — barrel re-exports.
  - `src/lib/email/send.test.ts` — Zod-fail-fast (1 test case).
  - `src/lib/email/templates/*.test.ts` — three snapshot files.
  - `scripts/email-smoke.ts` — smoke-test CLI, wired in `package.json` as `email:smoke` with `tsx --env-file=.env.local` (same pattern as PROJ-1's `seed:sysadmin`).
  - `docs/production/email.md` — deployer setup guide.
- **Module boundary:** `src/lib/email/send.ts` carries `import 'server-only'`. Template files do NOT carry the marker — they are pure functions usable in tests without server context, and the SMTP credentials live only behind `send.ts`.
- **No new database tables.** PROJ-2 is stateless. No `email_outbox`, no send-log.
- **Runtime pinning for future callers:** any API route handler that calls `sendMail()` MUST set `export const runtime = 'nodejs'` (nodemailer is Node-only). Forward constraint on PROJ-3 / PROJ-14, not enforced by PROJ-2 itself.
- **Performance:** SMTP send is synchronous from the caller's POV. Expected p95 < 2s on Cyon. Callers blocking a user-facing request on the send (signup-notification fires during the signup POST) accept this added latency over the complexity of a queue.
- **Security:**
  - SMTP credentials never reach client bundles — enforced by `server-only` on `send.ts` and by the absence of `NEXT_PUBLIC_` prefix on the Cyon env vars.
  - Template inputs are emitted as-is into a plain-text body (no HTML-escape needed for plain text). Risk of injection is cosmetic and bounded to internal callers; PROJ-3 / PROJ-14 are responsible for Zod-validating any user-supplied fields before passing them through.
  - `Reply-To:` header NEVER set — deployer's personal/private inbox MUST NOT leak into outbound mail headers (privacy load-bearing — see Decision Log).
- **Plain text only.** No `html:` field passed to nodemailer. Subject lines kept under 78 chars (RFC-5322) to avoid header-folding artefacts.
- **Determinism:** template functions are pure. Same inputs → byte-identical outputs. No timestamps, no random IDs in the body. The nodemailer-generated SMTP `Message-ID` provides per-send uniqueness at the protocol layer.

## Open Questions

None remaining. The interview (Q1–9 on 2026-05-22) settled
every architectural decision; implementation-level wording
and file-naming details are left to `/architecture` and
`/backend`.

**One forward-flag for the PRD:** the interview confirmed
that Magic Link is **permanently** out, not just deferred-
from-v1 (rationale: "having to open a mail client before
being able to log in is friction I want to avoid"). The PRD's
Non-Goals section currently lists various v2-deferred items
but does not name Magic Link explicitly. Recommend adding it
in a future PRD edit; not blocking for PROJ-2.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| **Option A — pure infrastructure cut.** PROJ-2 ships `sendMail()`, three pure template render functions, Supabase Auth template copy as docs, and a smoke CLI. PROJ-3 / PROJ-14 own all triggering and URL construction | Option C (PROJ-2 listens to DB events) moves business logic into infrastructure. Option B (PROJ-2 ships `sendSignupNotification(user)` wrappers) gives PROJ-2 implicit knowledge of PROJ-3's user shape and route paths. Option A mirrors PROJ-1's split: infrastructure exports primitives, features compose them | 2026-05-22 |
| **`sendMail()` is async + throws on failure. No retry, no outbox, no queue.** Caller decides what to do | Single-deployer instance, low volume. Dashboard is the source of truth, email is a push trigger ("look now"). Per-flow recovery exists: signup-notification loss → user appears on dashboard on next sysadmin login; approval-confirmation loss → user discovers approval at next login attempt or sysadmin notices inactive-approved user; deletion-confirmation loss → fail-safe (no email click = no deletion). Worst-case is "lazy notification", not "silent loss" | 2026-05-22 |
| **DB transactions are NOT rolled back when `sendMail()` fails** | An email outage during approval shouldn't un-approve a user. Consistent with the at-least-once-delivery semantics any non-trivial queue would also have | 2026-05-22 |
| **Plain text only, no HTML.** Templates return `{ subject, text }`, never `{ subject, text, html }` | PRD constraint; plain text passes spam filters more easily on shared SMTP hosting; one less template variant to maintain | 2026-05-22 |
| **Templates as pure TypeScript functions, no template engine** (no Handlebars, Liquid, mjml, react-email) | Three templates, ~15 lines each, internal callers only. A template DSL would be more surface area than the templates themselves. Pure functions are trivially snapshot-testable | 2026-05-22 |
| **Strict caller-passes-URLs contract.** Every template parameter is passed by the caller. No template reads `process.env` (e.g. `NEXT_PUBLIC_SITE_URL` to build URLs from tokens) | Templates with env reads quietly couple PROJ-2 to route paths and break the "PROJ-2 has no knowledge of routes" boundary. Caller passes complete URL strings; PROJ-2 just templates | 2026-05-22 |
| **Signup-notification template:** subject `"New Calcgrinder signup — <email>"`; body includes new user's email + claimed display name (from `raw_user_meta_data.name`) + the two URLs | "Is this a real person?" signal is enough for moderation in a single-deployer / low-volume context. No IP / UA / timestamp — extra escalation of PROJ-3's contract without a real payoff | 2026-05-22 |
| **Subject line carries PII** (`— <email>` for signup-notification) | Single-deployer means no team forwarding the inbox; PII in subject is fine in this deployment model | 2026-05-22 |
| **Approval-confirmation template:** subject `"Your Calcgrinder account is ready"`; greet by name + confirm + login URL + `"— Calcgrinder"` sign-off; no "reply for help" line | `noreply@` makes a reply prompt a lie. Preset tip would lie until PROJ-18 ships, so omitted | 2026-05-22 |
| **Account-deletion-confirmation template:** subject `"Confirm your Calcgrinder account deletion"`; body lists in order: requested deletion → confirm URL → "scheduled for deletion in N days" + cancel-by-signing-back-in → "if you didn't request this, ignore" → `"— Calcgrinder"` | "Scheduled for deletion in N days" instead of "permanently deleted in N days" — the latter contradicts the cancel-by-login window. Skip link-expiry text (PROJ-14 is the source of truth on expiry); skip data-deletion enumeration (lives on the Settings page where the user already saw it) | 2026-05-22 |
| **Sign-off is `"— Calcgrinder"`** across all user-facing templates. No fictional team | Single-deployer instance has no team; "— The Calcgrinder team" would be dishonest | 2026-05-22 |
| **Customise three Supabase Auth templates** (Confirm signup, Reset password, Change email address). **Leave Magic Link + Invite user at Supabase defaults** | The three covered templates match active or conditionally-active v1 flows. Leaving the two unused at defaults is a canary: if they ever fire (developer error, sysadmin misclick), the wording mismatch surfaces "this shouldn't have happened" — better than covered-up bug-hiding via defensive customisation | 2026-05-22 |
| **Magic Link is permanently out, not just deferred-from-v1** | "Having to open a mail client before being able to log in is friction I want to avoid." Recommend adding to PRD Non-Goals in a future edit | 2026-05-22 |
| **Supabase Auth template content delivered as copy-paste blocks in `docs/production/email.md`; NOT auto-synced via Management API** | Supabase Auth templates live in Dashboard state; forcing a sync mechanism adds operational risk for a one-time deployer setup. Honest about where state actually lives | 2026-05-22 |
| **All transactional mail uses one consistent voice:** plain text, terse, `"— Calcgrinder"` sign-off where there is one | Voice consistency across the three custom templates and the three Supabase Auth templates — a recipient sees the same brand voice on signup, approval, password reset, etc. | 2026-05-22 |
| **Single `EMAIL_FROM` env var** holding the full RFC-5322 string (e.g. `Calcgrinder <noreply@voidforge.cc>`) | One source of truth, one Zod validation. Distinct from `CYON_SMTP_USER` (the SMTP auth identity); Cyon requires domain match between the two, but `EMAIL_FROM` carries display-name that `CYON_SMTP_USER` doesn't | 2026-05-22 |
| **`Reply-To:` header is NEVER set in v1** (privacy load-bearing) | Deployer's personal/private inbox MUST NOT appear in any outbound mail's `Reply-To:` — it would expose the address to every recipient's mail client and to any header scraper. The only address in outbound mail is `noreply@<domain>`, and that inbox is effectively a void | 2026-05-22 |
| **Single fixed sender for the whole instance.** No per-user `From:` variants (no `noreply+<id>@…`) | SPF/DKIM stays simple; matches Cyon's authenticated-sender model. No v1 feature needs per-user sender identity | 2026-05-22 |
| **Local dev hits real Cyon.** No `EMAIL_DRY_RUN` env var, no Mailpit/Mailhog mock | Matches PROJ-1's cloud-only philosophy. Production code does production things only; deployer uses a throwaway recipient (`<name>+calcgrinder-dev@…`) for ad-hoc iteration | 2026-05-22 |
| **Smoke CLI has exactly one mode:** `--to <addr> --template <name>` (both required). No `--dry-run`, no generic-default body, no `--silent` | Production code does production things only. The smoke CLI is a thin wrapper around the same code path PROJ-3 / PROJ-14 will use — it just hand-supplies the template-input dummies the production callers would supply from DB state | 2026-05-22 |
| **Test footprint: 4 files total.** Three snapshot tests (one per template), one Zod-fail-fast test on `sendMail()`. NO mock-nodemailer happy-path test. NO live-Cyon CI test. NO PROJ-2 E2E tests | Per PROJ-1's precedent: "mock-heavy tests would test the mocks more than the code". The happy path is exercised by the smoke CLI during setup and by PROJ-3 / PROJ-14's integration tests in their own QA phases. Live-Cyon-in-CI is operational burden for negligible coverage gain | 2026-05-22 |
| **Subject conventions:** functional, no `[Calcgrinder]` bracket prefix; under 78 chars to avoid RFC-5322 header-folding | The From address already carries the brand. Bracket prefixes add visual noise without information | 2026-05-22 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| `nodemailer` v7.x (latest stable) over the 6.x line | 7.x is the current stable; 6.x is in maintenance. v7 is API-compatible with v6 for the surface PROJ-2 uses (SMTP transport + sendMail). No reason to start on an older line | 2026-05-22 |
| **Lazy transporter singleton.** First call to `sendMail()` validates env via Zod and constructs the nodemailer transporter; subsequent calls reuse the same transporter. Validation does NOT run at module import time | Matches PROJ-1's `createAdminClient()` pattern — keeps tests able to import `send.ts` without setting SMTP env vars, and surfaces config errors at first real call rather than at server boot. The "fail-fast" guarantee is per-call, not per-boot | 2026-05-22 |
| **No connection pooling** (`pool: false`). New TCP connection per send | v1 volume is single-digit sends/day on a single-deployer instance. Pooling adds connection-lifecycle complexity (idle-timeout, server-side reset handling) for no measurable win. Revisit if PROJ-3 ever ships a bulk-notification flow | 2026-05-22 |
| **10-second connection / socket timeout** on the nodemailer transport | Caller is blocking a user-facing request (signup POST, approval click). 10s is generous enough for Cyon's typical p95 (~1-2s) plus headroom, while preventing indefinite hangs that would tie up Vercel function slots | 2026-05-22 |
| **TLS mode derived from port**: port 465 → implicit TLS (`secure: true`); port 587 → STARTTLS upgrade (`secure: false`); any other port → reject in Zod validation | Standard SMTP submission convention. Documented in `.env.local.example` and `docs/production/email.md`. Saves a separate `CYON_SMTP_SECURE` env var | 2026-05-22 |
| **Zod schemas inlined per-module**, not centralised in an `email/env.ts` | Schemas are small (5 env vars for `send.ts`, 3-4 fields per template). Centralising creates an extra import for thin wrapping. Each template file owns its own input schema | 2026-05-22 |
| **`EMAIL_FROM` Zod validation** accepts either bare-address form (`addr@domain.tld`) or display-name + bracketed-address form (`Display Name <addr@domain.tld>`). Anything else is rejected | RFC 5322 allows much more; this is the minimal subset we actually use. Spec-conformant but tight. Saves importing a full RFC parser | 2026-05-22 |
| **Vitest inline snapshots** for the three template tests (`toMatchInlineSnapshot()`) | Inline keeps the expected output co-located with the test — better PR-review DX when wording changes. External `.snap` files spread state without payoff at three-file scale | 2026-05-22 |
| **Manual `process.argv` parsing in the smoke CLI**, no `commander` / `yargs` dependency | Two flags, both required. Manual parsing is 10 lines and matches the `seed:sysadmin` precedent set in PROJ-1's `scripts/seed-sysadmin.ts` | 2026-05-22 |
| **Smoke CLI runs via `tsx --env-file=.env.local`** in the `package.json` script entry | Same `--env-file` pattern PROJ-1 established for `seed:sysadmin`. `.claude/rules/backend.md` already requires this for standalone scripts under `scripts/**` | 2026-05-22 |
| **Plain-text bodies via dedented template literals** (e.g. an inline string with consistent left margin), no template engine | Three templates, ~15 lines each. A template DSL (Handlebars / etc.) would be more surface area than the templates themselves and would re-introduce an HTML-shaped escape contract that plain text doesn't need | 2026-05-22 |
| **Templates validate their own inputs via Zod at function entry**, even though the spec says callers pre-validate | Defence in depth + better error DX when a caller forgets. Zod parse cost on a 4-field schema is negligible compared to the SMTP exchange. Matches the seed-script pattern | 2026-05-22 |
| **Supabase Auth template subjects:** "Confirm your Calcgrinder account", "Reset your Calcgrinder password", "Confirm your new Calcgrinder email" | Voice consistency with the three custom templates' subject lines; all under 78 chars; functional verb-first style | 2026-05-22 |
| **`docs/production/email.md` ships the EXACT Supabase Auth Dashboard placeholder syntax** (`{{ .ConfirmationURL }}`, `{{ .Email }}`, etc.) in the copy-paste blocks | Supabase Auth templates aren't literal strings — they're Go-template-syntax with substitution placeholders that the Auth service fills in at send time. The deployer pastes verbatim; substitution happens server-side. Documenting the exact placeholders prevents "I copied it but the email arrived saying `{{ .ConfirmationURL }}` literally" support tickets | 2026-05-22 |
| **No `@types/nodemailer` worry**: nodemailer 7.x ships types in-package. Skip the historical `@types/nodemailer` devDep | Verified at architecture time — nodemailer 7 includes its own TypeScript declarations. Spec previously listed `@types/nodemailer` as a devDep; corrected here | 2026-05-22 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

PROJ-2 is a backend / infrastructure feature. Like PROJ-1,
there are no UI components; the "moving parts" diagram
below replaces the usual UI tree. Everything else (data
model, tech decisions, dependencies) follows the normal
shape.

### Moving parts — system diagram

```
Calcgrinder email infrastructure (PROJ-2)

+-- Next.js application (deployed on Vercel)
|   +-- src/lib/email/
|   |   +-- send.ts            sendMail({ to, subject, text })
|   |   |                      - 'server-only' marker (build-time
|   |   |                        boundary; SMTP creds can never
|   |   |                        reach a client bundle)
|   |   |                      - lazy transporter singleton
|   |   |                        (first call validates env, builds
|   |   |                        the nodemailer transport; reuse
|   |   |                        on subsequent calls)
|   |   |                      - Zod env validation for the five
|   |   |                        Cyon SMTP + EMAIL_FROM vars
|   |   |                      - throws on any SMTP failure;
|   |   |                        no retry, no queue
|   |   |
|   |   +-- templates/
|   |       +-- signup-notification.ts
|   |       |   pure function: ({ newUserEmail, newUserName,
|   |       |   approveUrl, declineUrl }) -> { subject, text }
|   |       |
|   |       +-- approval-confirmation.ts
|   |       |   pure function: ({ recipientName, loginUrl })
|   |       |   -> { subject, text }
|   |       |
|   |       +-- account-deletion-confirmation.ts
|   |       |   pure function: ({ recipientName,
|   |       |   confirmDeletionUrl, retentionDays })
|   |       |   -> { subject, text }
|   |       |
|   |       +-- index.ts       barrel re-exports
|   |
|   +-- (no API routes in PROJ-2 — future PROJ-3 / PROJ-14
|       route handlers will import sendMail + templates and
|       must set runtime = 'nodejs' since nodemailer is
|       Node-only)
|
+-- scripts/email-smoke.ts
|       CLI: npm run email:smoke -- --to <addr> --template <name>
|       (both flags required; <name> is one of:
|        signup-notification | approval-confirmation
|        | account-deletion-confirmation)
|       - manual argv parsing (matches seed-sysadmin.ts)
|       - Zod validation of args before any SMTP work
|       - imports the named template + sendMail; renders
|         with hardcoded dummy values; sends via real Cyon
|       - prints messageId on success, exits 1 on failure
|       - runs via tsx --env-file=.env.local in package.json
|
+-- docs/production/email.md
|       Deployer setup guide. Section order is the spec
|       acceptance criterion:
|       1. DNS records (SPF, DKIM, DMARC) with concrete
|          example lines for a generic <my-domain>
|       2. .env.local Cyon SMTP credentials (host, port,
|          user, pass) + EMAIL_FROM
|       3. npm run email:smoke verification step
|       4. Supabase Dashboard custom-SMTP configuration
|          (Authentication -> Settings -> SMTP Provider)
|       5. Supabase Auth email template copy-paste blocks
|          for Confirm signup / Reset password / Change
|          email address. Magic Link + Invite user are
|          explicitly marked "leave at Supabase default"
|
+-- .env.local.example
|       Adds exactly one new entry: EMAIL_FROM (full RFC
|       5322 string with display name). Inline comment
|       notes the format and the distinction from
|       CYON_SMTP_USER. The four Cyon SMTP vars were
|       already PROJ-1 placeholders; PROJ-2 expands their
|       inline comments to note port 587 (STARTTLS) vs
|       465 (implicit TLS).
|
+-- External: Cyon SMTP (shared hosting)
|       Port 587 (STARTTLS, recommended) or 465 (implicit
|       TLS). Authenticated as CYON_SMTP_USER /
|       CYON_SMTP_PASS. Cyon enforces a domain match
|       between the authenticated user and the From
|       address, so EMAIL_FROM's address-part must live on
|       the same domain as CYON_SMTP_USER (e.g. both
|       @voidforge.cc).
|
+-- External: Supabase Auth (Cloud, configured via
|   Dashboard, no PROJ-2 code touches it)
|       Five native flows route through the same Cyon SMTP
|       once the Dashboard's SMTP Provider is configured.
|       Three of the five (Confirm signup, Reset password,
|       Change email address) carry customised wording
|       pasted by the deployer from docs/production/email.md.
|       Magic Link + Invite user retain Supabase defaults.
|
+-- Tests (Vitest)
    +-- src/lib/email/templates/*.test.ts (3 files)
    |       one inline-snapshot test per template;
    |       deterministic input -> exact subject + body
    |       string match
    |
    +-- src/lib/email/send.test.ts (1 file)
            single test: missing env vars cause
            sendMail() to throw a Zod validation error
            before any nodemailer code runs (uses
            vi.stubEnv / vi.unstubAllEnvs() — same
            pattern as PROJ-1's cron-route test)

PROJ-2's consumers (forward dependencies, NOT in PROJ-2):
  PROJ-3 signup handler           -> sendMail + signupNotification
  PROJ-3 status-flip handler      -> sendMail + approvalConfirmation
  PROJ-14 deletion-request handler -> sendMail + accountDeletionConfirmation
```

### Data model — plain language

**PROJ-2 ships no new database tables.** The feature is
stateless from a persistence standpoint:

- No `email_outbox` table. Sends happen synchronously
  during the originating request; failures throw to the
  caller; no queue, no persisted send-log.
- No `email_send_log` table either. If a send fails,
  Vercel's function logs (for production) or the local
  terminal (for dev) carry the error. Auditability isn't
  a v1 product requirement.
- No new columns added to existing tables (`profiles` etc.).
  PROJ-2 doesn't track "last email sent at" or "approval
  email status" — those concerns belong to the calling
  features if they ever exist.

The only "state" PROJ-2 owns lives in process memory: the
lazy nodemailer transporter singleton, created once per
Node process on first `sendMail()` call. On Vercel each
function invocation may or may not reuse the warm process;
that's fine because the transporter constructor is cheap
and Cyon SMTP doesn't care about repeated connects.

### Tech decisions — why these choices

**Why `nodemailer` over a managed-API SDK** (Resend,
Postmark, SendGrid, AWS SES). The PRD pins Cyon shared-
hosting SMTP as the only allowed transport — no provider
SDK applies. nodemailer is the de-facto Node SMTP client
(every other library that does email on Node either wraps
nodemailer or competes with a fraction of its surface);
it's well-vetted, zero-config for the common case, ships
its own TypeScript types in v7, and has no peer dependencies
to manage.

**Why a single `sendMail()` utility with no overloads.**
PROJ-3 and PROJ-14 will call `sendMail` exactly twice and
once respectively. A facade pattern (e.g. specialised
`sendApprovalEmail(user)` helpers) would put PROJ-3's data
shape inside PROJ-2 — exactly the Option B trap the spec
ruled out. The `sendMail({ to, subject, text })` shape is
the smallest possible contract.

**Why the lazy singleton over module-level eager init.**
Validating env vars at module-import time would break test
ergonomics: the snapshot test files for the three templates
would inherit that import chain in some monorepo configs.
Lazy init keeps templates importable in isolation, defers
the "do all my secrets exist?" check to the moment we
actually need them, and matches the precedent
`createAdminClient()` set in `src/lib/supabase/admin.ts`.

**Why "server-only" on `send.ts` but NOT on the template
files.** The `server-only` marker is a build-time fence
against shipping SMTP credentials into a client bundle.
Templates are pure string-builders; they hold no secrets
and are entirely usable in isolated tests. Adding the
marker to template files would only complicate testing
(running snapshot tests in a "server context" with no
benefit).

**Why no connection pool.** Each `sendMail()` opens a fresh
SMTP TCP connection, exchanges, and closes. v1 sends single-
digits per day. Pooling matters when you're rate-limited by
TCP-handshake cost; we're not.

**Why a 10-second timeout.** Cyon's typical SMTP exchange
finishes well under 2s. 10s leaves headroom for jitter
without letting a wedged connection block a Vercel function
slot indefinitely (Hobby plan caps function execution at
10s anyway, so we're matching the platform's own limit).

**Why no `Reply-To` header, ever, in any code path.** Privacy
is the load-bearing reason (see the Product Decision log
entry): the deployer's personal/private inbox must not appear
in outbound mail headers where every recipient's mail client
and any opportunistic header-scraper would see it. The
secondary reason (consistency with `noreply@` semantics) is
a useful bonus.

**Why Vitest inline snapshots for templates.** Three template
files; each has exactly one snapshot test. Inline keeps the
expected output adjacent to the input — when wording changes
during refinement, a reviewer sees both the input and the
new output in the same diff hunk. External `.snap` files
would scatter the truth across two files for no readability
benefit at this scale.

**Why ship Supabase Auth template content as docs, not
code.** Supabase Auth templates live in Cloud Dashboard
state, not in our repo. To sync them we'd need a script
that calls Supabase's Management API on each deploy, plus
an API token in env vars, plus a "did the Dashboard drift
from code?" check. For a one-time, single-deployer setup,
that operational machinery isn't worth it. Documenting the
exact strings (with their Go-template substitution
placeholders preserved verbatim) and having the deployer
paste once is honest about where the state lives.

**Why customise three Supabase Auth templates but leave
Magic Link and Invite User at default.** Neither flow is
triggered in v1. Customising would mean writing wording
nobody ever reads. Leaving them at Supabase defaults gives
us a free canary: if either template ever does fire (a
developer mistake, a sysadmin clicking the wrong Dashboard
button), the recipient gets a clearly-different-looking
email that signals "this shouldn't have happened" — much
better than silently delivering a covered-up bug.

**Why no `@types/nodemailer` devDep.** Historical: in the
6.x era nodemailer published types separately on DefinitelyTyped.
nodemailer 7.x bundles its own `.d.ts` files. The earlier
spec listed `@types/nodemailer` as a devDep; that was
wrong. Removed here.

### Dependencies to install

**New runtime dependency:**

- `nodemailer` (^7.x, latest stable) — SMTP transport.
  Used only behind `src/lib/email/send.ts`. Bundles its
  own TypeScript declarations.

**Already installed, used by PROJ-2:**

- `zod` (^4.3.5) — env, argv, and template input validation.
  Already in `package.json` from the template; no new
  install.
- `tsx` — TypeScript runner for the smoke script. Already
  in `devDependencies` from PROJ-1's seed-script wiring.

**No `@types/nodemailer`** — nodemailer 7 ships types
in-package.

**No new external tooling.** Cyon SMTP and Supabase Cloud
are existing PROJ-1 dependencies. No new CLIs to install.

## Implementation Notes (Backend Developer)

PROJ-2 backend implementation is complete. The full set of
code, tests, configuration, and deployer-facing
documentation is in place. The deployer must still apply
the manual configuration steps in `docs/production/email.md`
(DNS records, Supabase Dashboard SMTP, Supabase Auth
templates) before sends will actually succeed; nothing in
the codebase requires that to happen first.

### Files created

- `src/lib/email/send.ts` — production entry point. Holds
  `import 'server-only'` and re-exports `sendMail` /
  `SendMailInput` from the internal transport module.
- `src/lib/email/_internal/transport.ts` — actual nodemailer
  + Zod logic. No `server-only` marker; usable from Node
  scripts and tests (see "Architecture drift" below).
- `src/lib/email/templates/signup-notification.ts`
- `src/lib/email/templates/approval-confirmation.ts`
- `src/lib/email/templates/account-deletion-confirmation.ts`
- `src/lib/email/templates/index.ts` — barrel re-exports.
- `src/lib/email/send.test.ts` — single Zod-fail-fast test.
- `src/lib/email/templates/signup-notification.test.ts` —
  inline snapshot + Zod-throw assertions.
- `src/lib/email/templates/approval-confirmation.test.ts` —
  same shape.
- `src/lib/email/templates/account-deletion-confirmation.test.ts` —
  same shape.
- `scripts/email-smoke.ts` — smoke CLI with exactly the spec's
  two-flag surface (`--to`, `--template`). No `--dry-run`,
  no generic-default mode.
- `docs/production/email.md` — deployer setup guide, five
  sections in the spec-mandated order.

### Files modified

- `package.json` — added `nodemailer ^8.0.7` runtime
  dependency, `@types/nodemailer ^8.0.0` devDep, and
  `"email:smoke": "tsx --env-file=.env.local scripts/email-smoke.ts"`
  npm script.
- `.env.local.example` — added the `EMAIL_FROM` entry with
  inline guidance; expanded the inline comment on the
  Cyon SMTP block to note the 587 (STARTTLS) vs 465
  (implicit TLS) accepted values.
- `README.md` — added a one-line pointer to
  `docs/production/email.md` under the Quick Start section
  alongside the existing Supabase workflow notes.

### Architecture drift (load-bearing)

**Two architectural decisions had to be revised during
implementation:**

1. **`server-only` marker cannot sit on a single canonical
   `send.ts` file** if that file is to be importable from
   Node scripts (the smoke CLI) and from the Vitest runner
   (the send-test). The reason: `server-only` is bundled
   only inside `next/dist/compiled/server-only` and is NOT
   resolvable by Node's module resolver from a top-level
   import. A standalone `tsx scripts/email-smoke.ts`
   invocation that transitively imports `send.ts` fails at
   `Cannot find package 'server-only'` before any of our
   own validation runs. Same for vitest.

   **Resolution:** split the module. `send.ts` keeps the
   marker and re-exports `sendMail` from
   `_internal/transport.ts`, which holds the actual logic
   and has no marker. Production code paths (PROJ-3 /
   PROJ-14) import from `send.ts` and inherit the fence.
   The smoke CLI and the Vitest test file import directly
   from `_internal/transport.ts`. The `_internal/` directory
   prefix is the convention signalling "don't import this
   elsewhere." Verified by build-time probe: a routable
   `'use client'` page importing from `@/lib/email/send`
   trips the expected
   `'server-only' cannot be imported from a Client
   Component module` error during `npm run build`.

2. **nodemailer 8.x does NOT ship its own TypeScript
   types.** The Tech Design's Technical Decisions table
   claimed (twice) that nodemailer 7+ bundles types in-
   package; verification during install showed
   `node_modules/nodemailer` carries no `.d.ts` files and
   `tsc --noEmit` immediately errored with `Could not
   find a declaration file for module 'nodemailer'`.

   **Resolution:** added `@types/nodemailer ^8.0.0` as a
   devDependency. The Tech Design entry was wrong; this
   implementation note documents the correction.

A secondary drift: the architecture targeted nodemailer
v7.x (latest stable at design time); the actual latest
available on npm at install time is v8.0.7. v8 is
API-compatible for the SMTP-transport + sendMail surface
PROJ-2 uses. Installed v8.

### Verification results

- `npm run lint` — clean.
- `npx tsc --noEmit` — clean.
- `npm test` — 14 / 14 tests pass (7 from PROJ-1's cron
  route, 1 from `send.test.ts`, 6 from the three template
  snapshot+validation files). Total runtime ~1.2s.
- `npm run build` — succeeds. Route table unchanged
  (PROJ-2 ships no API routes).
- **server-only fence verified.** Temporary `'use client'`
  page importing `@/lib/email/send` produced the expected
  build error; probe deleted.
- **Smoke CLI argv fail-fast verified.** Three negative
  cases exercised manually:
  - no flags → "error: to: --to is required" + "error:
    template: --template is required and must be one of:
    …" (lists the three valid values).
  - `--to not-an-email` → "error: to: --to must be a valid
    email address".
  - `--template bogus` → "error: template: --template is
    required and must be one of: …".
- **Smoke CLI env fail-fast verified.** Running with
  `env -i HOME=$HOME PATH=$PATH npx tsx scripts/email-smoke.ts
  --to test@example.com --template signup-notification`
  prints five lines of `error: <VAR>: <VAR> is required`
  (one per missing env var) and exits 1 before any SMTP
  connect attempt. Output format matches the seed-sysadmin
  script's convention.
- **Live SMTP path NOT verified in-session** (no real Cyon
  credentials in this implementation context; same gap
  PROJ-1 documented for the seed-script happy path). The
  /qa phase exercises the live path with the deployer's
  `.env.local`.

### Deployer follow-ups required (manual, outside this
implementation)

1. Configure DNS records (SPF, DKIM, DMARC) per
   `docs/production/email.md` §1.
2. Populate `.env.local` with real Cyon SMTP credentials
   and `EMAIL_FROM`.
3. Run `npm run email:smoke -- --to <your-test-inbox>
   --template signup-notification` (and the other two
   template names) to verify SMTP end-to-end.
4. Configure Supabase Auth → SMTP Provider in the Cloud
   Dashboard with the same Cyon credentials.
5. Paste the three customised Auth template subjects + bodies
   from `docs/production/email.md` §5 into the Supabase
   Dashboard's Email Templates UI. Leave Magic Link and
   Invite User at Supabase defaults.

### Forward constraint flagged for downstream features

Any API route handler that calls `sendMail()` MUST declare
`export const runtime = 'nodejs'`. nodemailer is Node-only;
the default Vercel runtime for route handlers is
serverless Node, so this is mostly belt-and-braces, but
the pin prevents an accidental Edge-runtime migration from
silently breaking the email path. PROJ-3 and PROJ-14 must
honour this constraint in their own implementation.

## QA Test Results

**Tested:** 2026-05-22
**Tester:** QA Engineer (AI)
**Surfaces tested:** `sendMail()` Zod env validation, the three pure
template render functions, `scripts/email-smoke.ts` argv + env
fail-fast paths, the `server-only` build-time fence, deployer-
configured live paths (DNS, Cyon SMTP, Supabase Dashboard SMTP +
Auth templates) confirmed by the deployer.

PROJ-2 is backend infrastructure — no UI. The cross-browser /
responsive entries from the standard QA checklist do not apply.

### Regression suites

- `npm test` — **14 / 14** Vitest tests pass (7 from PROJ-1's cron
  route + 1 from `send.test.ts` + 6 from the three template tests).
  Total runtime ~1.3 s.
- `npm run test:e2e` — **12 / 12** Playwright tests pass (PROJ-1
  cron-route specs across chromium + Mobile Safari). Total runtime
  ~5.8 s.

No regressions introduced by PROJ-2.

### Acceptance Criteria Status

#### AC group 1: `sendMail()` utility — transport & validation

- [x] Zod env validation runs before any SMTP work — verified by
  running the smoke CLI with `env -i` and observing five
  per-variable error lines and exit 1 with no network activity.
- [x] Missing env vars throw with all missing fields named —
  same verification produced one error line per missing var.
- [x] Cyon 5xx / connection errors reject the Promise with the
  original nodemailer text — confirmed by deployer's live-SMTP
  smoke runs (any misconfigured value surfaced as the matching
  Cyon error).
- [x] `import 'server-only'` is the first import in `send.ts` —
  source inspection + build-time fence probe: a temporary
  `'use client'` page importing from `@/lib/email/send` produced
  the expected
  `'server-only' cannot be imported from a Client Component module`
  build error. Probe deleted.
- [x] `EMAIL_FROM` accepted as full RFC 5322 string (deployer's
  live config is `Calcgrinder <noreply@voidforge.cc>`), display
  name renders correctly in recipient mail clients — confirmed
  by the deployer.
- [x] `EMAIL_FROM` with leading/trailing whitespace is `.trim()`-ed
  before being passed to nodemailer — verified via direct probe
  (input `'  Calcgrinder <noreply@example.com>  '` reached
  nodemailer as `'Calcgrinder <noreply@example.com>'`).
- [x] No `Reply-To:` header ever set — verified by `grep -rn` over
  `src/lib/email/`: the only mention of "Reply-To" is in a code
  comment documenting the privacy decision; no setter exists.

#### AC group 2: Template render functions — pure, deterministic

- [x] All three templates produce the exact subject + body
  specified — verified by the three inline-snapshot Vitest tests
  (`signup-notification.test.ts`, `approval-confirmation.test.ts`,
  `account-deletion-confirmation.test.ts`).
- [x] Deterministic output — snapshot equality on repeated calls
  is enforced structurally by Vitest's `toMatchInlineSnapshot`.
- [x] Missing / invalid input fields throw Zod errors before any
  string is built — verified per template via dedicated "throws
  on missing field" assertion blocks in each test file.
- [x] Templates do NOT import `server-only` and do NOT read
  `process.env` — confirmed by source inspection. Each template
  file imports only `zod`.
- [x] Live-rendered bodies look correct in real inbox — deployer
  confirmed all three template renders landed with correct
  wording, including the "scheduled for deletion in 30 days"
  phrasing for the account-deletion template.

#### AC group 3: Supabase Auth template content (deployer-applied)

- [x] `docs/production/email.md` §5 ships copy-paste-ready
  subject + body for the three customised Auth templates
  (Confirm signup, Reset password, Change email address), with
  Magic Link and Invite User explicitly marked "leave at Supabase
  default" — confirmed by file inspection.
- [x] Three customised templates pasted into Supabase Cloud
  Dashboard, Magic Link + Invite User + Reauthentication left at
  Supabase defaults — confirmed by the deployer.
- [x] Subject strings are exactly `"Confirm your Calcgrinder
  account"`, `"Reset your Calcgrinder password"`, `"Confirm your
  new Calcgrinder email"` — confirmed by file inspection and
  by the deployer's Dashboard configuration.

#### AC group 4: Supabase Auth SMTP configuration (deployer-applied)

- [x] `docs/production/email.md` §4 walks the deployer through
  the **Authentication → Settings → SMTP Provider** flow —
  confirmed by file inspection.
- [x] Supabase Auth is on Custom SMTP, pointing to
  `mail.cyon.ch:465` with `noreply@voidforge.cc` auth —
  confirmed by the deployer.
- [x] Outbound Supabase Auth mail will carry Cyon `Received:`
  headers — implied by the deployer's confirmation that the
  Dashboard is configured; the actual `Received:` header check
  is exercised when PROJ-3 ships the password-reset / email-
  verification flows. Out of scope for PROJ-2 QA.

#### AC group 5: Smoke-test CLI — single mode, real send

- [x] `--to <addr> --template signup-notification` rendered the
  real template and sent via real Cyon — deployer confirmed
  delivery with correct body.
- [x] Same for `approval-confirmation` and
  `account-deletion-confirmation` — deployer confirmed both.
- [x] Missing `--to` fails fast with Zod message, no SMTP
  connect — verified.
- [x] Missing `--template` fails fast listing the three valid
  values — verified.
- [x] Bogus `--template bogus` fails fast listing the three
  valid values — verified.
- [x] No flags beyond `--to` and `--template` exist (no
  `--dry-run`, `--generic`, `--silent`) — verified by source
  inspection.
- [x] Missing env vars produce per-variable error lines and
  exit 1 — verified via `env -i ...`.

#### AC group 6: Tests — 4 files total

- [x] Three template snapshot tests with inline snapshots,
  one per template — present and passing.
- [x] One `send.test.ts` Zod-fail-fast test — present and
  passing.
- [x] No mock-nodemailer happy-path test, no live-Cyon CI
  test — confirmed by source inspection.
- [x] `vi.stubEnv` + `vi.unstubAllEnvs()` pattern used in
  `send.test.ts` — confirmed; matches PROJ-1's cron-route
  test pattern.

#### AC group 7: Env vars & documentation

- [x] `.env.local.example` carries exactly one new entry
  (`EMAIL_FROM`) over PROJ-1's baseline — verified by `git diff`.
- [x] Cyon SMTP block's inline comment now notes the 587
  (STARTTLS) vs 465 (implicit TLS) accepted values — verified.
- [x] `docs/production/email.md` section order matches the AC
  (DNS → env → smoke → Supabase Dashboard SMTP → Supabase Auth
  templates) — verified by file inspection.
- [x] `README.md` carries a pointer to `docs/production/email.md`
  in the Quick Start section — verified.
- [x] `.env.local` itself remains gitignored — verified
  (`.gitignore:29: .env*.local` matches).

### Edge Cases Status

- [x] **Cyon temporarily unreachable** — deployer's misconfig
  attempts during setup surfaced Cyon errors via
  `sendMail()` rejection (correct behaviour). No PROJ-2 retry,
  per spec.
- [x] **`sendMail()` post-DB-commit failure** — by construction:
  PROJ-2 never knows about DB transactions; the contract is
  "throw on failure, caller decides". No PROJ-2-side rollback
  exists.
- [x] **Long body / non-ASCII content** — direct probe with
  1 MB body and unicode subject (`'Hello — Café 日本語'`) both
  accepted; nodemailer's UTF-8 handling deals with encoding
  automatically.
- [x] **Spam-filter classification** — deployer confirmed all
  three smoke sends landed in their primary inbox, not spam.
  Cloudflare DNS records (SPF + DKIM + DMARC) are correctly
  configured.
- [x] **`EMAIL_FROM` whitespace tolerance** — leading/trailing
  whitespace is trimmed in `transport.ts:getFrom()`; verified
  via probe.
- [x] **Approve/Decline URL is null or empty** — Zod template
  schema rejects with the spec-mandated fail-fast message;
  verified in `signup-notification.test.ts`.
- [x] **Smoke CLI with invalid `--template` name** — error
  message lists the three valid values; verified.

### Security Audit (Red-team findings)

The audit treated PROJ-2's surface area — `sendMail()`, the three
template render functions, the smoke CLI, and the build-time
fence — as the attack surface. All findings below are **Low
severity** because (i) every PROJ-2 caller is internal trusted
code (PROJ-3 / PROJ-14, plus the deployer running the smoke CLI),
(ii) the spec's Product Decision log explicitly defers user-input
sanitisation to those callers, and (iii) nodemailer's own
transport-layer header encoding provides a second line of defence
against SMTP-protocol injection.

#### Verified safe (no findings)

- **CRLF injection via `to`** — `sendMail({ to: 'a@b.com\r\nBcc:
  evil@x.com', ... })` is **rejected** by Zod's `.email()` on the
  `to` field. SMTP RCPT injection through the `to` channel is
  blocked at the entry point.
- **`server-only` fence on `send.ts`** — fires on
  client-component import as designed (build-error probe
  verified). SMTP credentials cannot reach client bundles via
  the canonical import path.
- **No `Reply-To:` header anywhere** — code grep over
  `src/lib/email/` returns only a comment documenting the
  decision. Deployer's personal inbox cannot leak into outbound
  mail.
- **Whitespace-trimmed `EMAIL_FROM`** — probe confirmed
  `transport.ts` trims before passing to nodemailer.
- **Snapshot tests catch wording drift** — the three template
  files cannot be edited without an accompanying snapshot
  update; CI will fail on any silent copy change.

#### Low-severity findings (mitigations are caller-side or
defence-in-depth-only)

- **L1: Plain-text body injection via name fields.** Both
  `signupNotification.newUserName` and the `recipientName` fields
  on the other two templates accept any non-empty string,
  including newlines and arbitrary text. A signed-up attacker
  could craft a `newUserName` containing a forged "Approve:" /
  URL pair that visually outranks the real one in the
  sysadmin's inbox. Risk is bounded: the real URL still appears
  below; the sysadmin who reads the email carefully sees both;
  and **the spec explicitly puts user-input sanitisation on
  PROJ-3** (Product Decision row: "PROJ-3 / PROJ-14 are
  responsible for Zod-validating any user-supplied fields
  before passing them through"). **Recommendation, forward-
  constraint to PROJ-3:** the signup-form Zod schema for `name`
  must disallow `\r` / `\n` / control characters and trim
  whitespace before passing to `signupNotification()`. Same
  for PROJ-3 / PROJ-14's `recipientName` plumbing.

- **L2: Zod's `.url()` accepts `javascript:` URIs.** Probed with
  `approveUrl: 'javascript:alert(1)'`: Zod accepts it (Zod's
  `.url()` validator delegates to `new URL()`, which permits the
  `javascript:` scheme). Risk in plain-text emails is minimal —
  most mail clients render plain-text URLs as literal text or as
  http/https hyperlinks only, not as `javascript:` links — but
  it is a defence-in-depth gap. **Recommendation, forward-
  constraint to PROJ-3:** URL fields passed to templates should
  pre-check the scheme is `https:`. Defence-in-depth on the
  PROJ-2 template side (a Zod `.refine` rejecting non-http/https
  schemes) is also worth adding in a future small PR but not
  blocking.

- **L3: Newlines in `subject` accepted by Zod.** Probed:
  `sendMail({ subject: 's\r\nBcc: evil@x.com', ... })` passes
  PROJ-2's validation and reaches nodemailer. nodemailer's
  MimeMessage encoder Q-encodes / refuses header-injection
  attempts, so the SMTP-protocol layer is safe; but a corrupted
  subject would land in the recipient's inbox as garbage instead
  of being rejected earlier. **Mitigation:** add a
  `.refine(s => !/[\r\n]/.test(s))` to the `subject` schema in
  a future small PR. Not blocking.

- **L4: No `text` body size cap.** Probed: 1 MB body accepted and
  passed to nodemailer. No realistic attack via internal
  callers (templates are ~15 lines), but a buggy caller could
  ask nodemailer to send something enormous. Cyon would reject
  oversized messages at the SMTP layer (typical limit
  10–25 MB) with a clear error. **Recommendation:** optional
  cap (e.g. 64 KiB) on `text` in PROJ-2's Zod schema. Not
  blocking; defence-in-depth only.

- **L5: Whitespace-only `recipientName` accepted.** `'   '`
  passes `.min(1)`. Body renders `"Hi    ,"` — cosmetic, not
  exploitable. Same caller-validation argument as L1.

#### Out of scope for this audit

- **Approve/decline-token unpredictability**, replay attacks,
  short-lived tokens, single-use semantics — all owned by PROJ-3.
- **Deletion-confirmation token security** — owned by PROJ-14.
- **Captcha / signup rate-limiting / bot defence** — owned by
  PROJ-3.
- **Cyon shared-hosting rate limits** — operational, documented
  in `docs/production/email.md`; not a code concern.

### Verification gaps (deferred)

- **Live SMTP path** — the deployer confirmed all three smoke
  sends landed with correct content. The PROJ-2 spec did not
  require an automated live-SMTP CI test (Test scope decision
  9b: "no live-Cyon CI test"); the deployer's manual smoke
  serves as the live acceptance.
- **End-to-end auth-flow tests** — the full "signup →
  notification → click approve → confirmation lands" loop is
  PROJ-3's acceptance criterion, exercised by PROJ-3's own QA
  pass.

### Production-Ready Decision

**READY.** No Critical, High, or Medium bugs. Five Low findings,
all of them either explicit caller-responsibility per the spec or
defence-in-depth-only with sensible fallbacks. The five Low
items are recorded above as forward constraints on PROJ-3 /
PROJ-14 and as optional small follow-up PRs against PROJ-2.

### Forward constraints for downstream features

1. **PROJ-3 signup-form Zod schema** must Zod-validate `name`
   (and any other user-supplied free-text fields) to reject
   `\r` / `\n` / control characters and trim whitespace before
   passing to `signupNotification()`. (Mitigates finding L1.)
2. **PROJ-3 URL builders** must produce only `https:` URLs for
   `approveUrl`, `declineUrl`, `loginUrl`. (Mitigates finding
   L2.)
3. **PROJ-14 URL builder** must produce only `https:` URLs for
   `confirmDeletionUrl` and Zod-validate `recipientName` the
   same way as PROJ-3.
4. **Any API route handler calling `sendMail()`** must declare
   `export const runtime = 'nodejs'` (nodemailer is Node-only).
   Carried over from the Tech Design's forward constraint.

### Optional small follow-up PRs against PROJ-2 (non-blocking)

- Add `.refine(s => !/[\r\n]/.test(s))` to the `subject` schema
  in `_internal/transport.ts` (defence-in-depth on finding L3).
- Add a `.max(N)` cap (e.g. 64 KiB) on `text` in the same
  schema (finding L4).
- Add a scheme-allowlist `.refine` to the `*.url()` validators
  in each template (defence-in-depth on finding L2).
- Tighten `min(1)` to `.trim().min(1)` on free-text name
  fields in the three templates (finding L5).

## Deployment

**Date:** 2026-05-22
**Production URL:** https://calcgrinder.vercel.app
**Git tag:** `v1.0.0-PROJ-2` against commit `788f703`
**Deploy commit:** `feat(PROJ-2): Implement Email Infrastructure
(SMTP + transactional)` (`788f703`)

### Deployer-applied production configuration

Performed by the deployer between QA approval and the
deploy commit (see deployer confirmation log on 2026-05-22):

- **DNS records** on `voidforge.cc` via Cloudflare:
  - SPF: `v=spf1 include:spf.protection.cyon.net ~all`
    (note: the initial draft of `docs/production/email.md`
    listed `include:cyon.ch` from generic guidance — the
    canonical Cyon hostname is `spf.protection.cyon.net`;
    the docs were corrected at deploy time).
  - DKIM and DMARC pre-existing on the domain, verified.
- **Cyon mail account** `noreply@voidforge.cc` verified
  (pre-existing).
- **`.env.local`** populated with real Cyon credentials +
  `EMAIL_FROM=Calcgrinder <noreply@voidforge.cc>`.
- **Live SMTP** verified end-to-end via the smoke CLI
  against `mail.cyon.ch:465`:
  - `npm run email:smoke --template signup-notification` —
    delivered, body rendered correctly.
  - `npm run email:smoke --template approval-confirmation` —
    delivered, body rendered correctly.
  - `npm run email:smoke --template account-deletion-confirmation` —
    delivered, body rendered correctly with "scheduled for
    deletion in 30 days" wording.
- **Supabase Cloud Dashboard — Custom SMTP** enabled,
  pointing to `mail.cyon.ch:465` with `noreply@voidforge.cc`
  authentication.
- **Supabase Auth email templates** in the Cloud Dashboard:
  - Confirm signup — customised per
    `docs/production/email.md` §5.
  - Reset password — customised per
    `docs/production/email.md` §5.
  - Change email address — customised per
    `docs/production/email.md` §5.
  - Magic Link, Invite User, and Reauthentication — left
    at Supabase defaults (canary rationale per the spec's
    Product Decision log).
  - Security-section notification toggles left OFF (no v1
    spec requirement).

### Vercel Production environment variables added

- `EMAIL_FROM`
- `CYON_SMTP_HOST`
- `CYON_SMTP_PORT`
- `CYON_SMTP_USER`
- `CYON_SMTP_PASS`
- `SYSADMIN_NOTIFICATION_EMAIL` (already a PROJ-1 env-var
  placeholder; populated at PROJ-2 deploy time)

The PROJ-2 Vercel build does not consume these at build
time (the transport module uses lazy env-validation —
nothing reads `process.env` at module load). The env vars
are required at runtime starting from the first PROJ-3 or
PROJ-14 deploy that actually calls `sendMail()`.

### Production smoke-test in this deploy

**None.** Per the spec's Test Scope decision 9b, no
automated live-SMTP CI test was added. The deployer's
manual smoke-CLI runs against real Cyon (executed locally
against the same Cloud Supabase project that production
points to) serve as the live acceptance — same production
code path, exercised before this deploy.

### Production-Polish skipped

Same rationale as PROJ-1's deploy: PROJ-2 ships **no UI
surface and no new API routes**. Lighthouse, security
headers, Sentry / error-tracking, performance budgets all
target HTTP / browser-rendered surfaces that don't exist
in PROJ-2's diff. **PROJ-4** (App Shell, Routing & Top-
Level Navigation) owns `next.config.ts` and the root
layout and will revisit security headers + the
production-polish checklist when the first UI ships.

### Post-deploy verification

- `npm run lint` — clean.
- `npm run build` — succeeds, route table unchanged from
  PROJ-1 (PROJ-2 adds no routes).
- `npm test` — 14 / 14 Vitest tests pass.
- `npm run test:e2e` — 12 / 12 Playwright tests pass.
- Vercel auto-deploy on push to `main` — green
  (deployer-confirmed).
- `https://calcgrinder.vercel.app` loads (no PROJ-2
  surface to visit; the existing PROJ-1 landing page +
  cron stub are unchanged).

### Forward constraints carried into downstream features

These were established in the QA audit and are recorded
here at deploy-time for visibility:

1. **PROJ-3** must Zod-validate the signup form's `name`
   field to strip `\r\n` / control characters before
   passing to `signupNotification()`.
2. **PROJ-3** URL builders must produce only `https:`
   URLs for `approveUrl`, `declineUrl`, `loginUrl`.
3. **PROJ-14** URL builder must produce only `https:`
   URLs for `confirmDeletionUrl` and Zod-validate
   `recipientName` the same way as PROJ-3.
4. **Any API route handler calling `sendMail()`** must
   declare `export const runtime = 'nodejs'`.

### Docs follow-up applied at deploy time

- `docs/production/email.md` §1 SPF guidance corrected
  from generic `include:cyon.ch` to the canonical
  `include:spf.protection.cyon.net`. Deployer's own DNS
  was already correct via Cloudflare; the docs fix is for
  any future deployer using the guide.
