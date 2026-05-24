# Product Requirements Document

## Vision

Calcgrinder is a webapp where users build interactive
calculators in a builder UI (spreadsheet-style grid + live
themed preview), then publish them at public URLs where
visitors enter values and watch results recompute in real time.
Visitors can save scenarios — input snapshots with a title and
description — and share them via URL. Registered users can
clone any published calculator into their account as a
starting point for variations.

## Target Users

**Calculator authors (Registered Users)** — finance
professionals, consultants, educators, product marketers,
indie experts. They need to build interactive calculators
without writing code, with a familiar spreadsheet-grid feel
plus a live themed preview, and ship them as branded URLs they
can put in a blog post, a sales doc, or a social share. Their
pain today: spreadsheets aren't shareable as live calculators;
form builders don't do formulas; coding a one-off calculator
in React is overkill. They want the speed of a spreadsheet
with the polish of a hand-coded calculator page.

**Visitors (Public Users)** — the calculator author's
audience: customers exploring pricing, students working through
a financial model, readers playing with what-if scenarios. They
arrive via a public URL, type values, see results recompute,
and can optionally save the values they tried. They never
create an account unless they want to author their own.

**Sysadmins** — the deployer and a small set of trusted curators.
They run the instance, approve signups, moderate user
calculators, and publish curated **Presets** that appear
automatically in every Registered User's dashboard for inspiration
and cloning.

## Core Features (Roadmap)

| Priority | Feature                                              | Status   |
|----------|------------------------------------------------------|----------|
| P0 (MVP) | Supabase Infrastructure Setup                        | Deployed    |
| P0 (MVP) | Email Infrastructure (SMTP + transactional)          | Deployed |
| P0 (MVP) | Authentication & Account Approval Flow               | Deployed |
| P0 (MVP) | App Shell, Routing & Top-Level Navigation            | Deployed |
| P0 (MVP) | Account Dashboard                                    | Deployed |
| P0 (MVP) | Calculator Theme System (8 themes as runtime tokens) | Deployed |
| P0 (MVP) | Formula Engine                                       | Deployed |
| P0 (MVP) | Editor — Grid + Builder Two-Panel Split              | Deployed |
| P0 (MVP) | Cell Authoring & Section Management                  | Deployed |
| P0 (MVP) | Calculator Lifecycle — Publish, Sharing, Token Regen | Deployed |
| P0 (MVP) | Visitor View — Calculator Interface                  | Deployed |
| P0 (MVP) | Scenarios — Save, Load, Share                        | Deployed |
| P0 (MVP) | Soft-Delete & Trash Recovery                         | Deployed |
| P0 (MVP) | Settings Page                                        | Deployed |
| P1       | Charts (12-type vocabulary)                          | Roadmap  |
| P1       | Text Blocks (Markdown)                               | Roadmap  |
| P1       | Tabular Output Cells                                 | Roadmap  |
| P1       | Cloning & Preset Discoverability                     | Roadmap  |
| P1       | Sysadmin Moderation                                  | Roadmap  |
| P1       | Concurrent Editing — Optimistic Concurrency          | Roadmap  |
| P1       | Code-Import (Smart merge / Append / Replace all)     | Roadmap  |
| P2       | JSON Export / Import                                 | Roadmap  |

P0 = end-to-end authoring + sharing loop for a single user.
P1 = v1 completion (multi-user curation, full presentation
vocabulary, productivity accelerators). P2 = power-user backup.

## Success Metrics

Stage 1 — workflow viability:
- A registered user can sign up, get approved, build a 10-cell
  calculator with formulas, publish it, and share the URL in
  under 15 minutes from first signup.
- The Calculator Theme System renders a published calculator
  pixel-identically in the Builder preview and on the public
  `/c/<token>` URL across the 8 shipped themes.

Stage 2 — sharing loop:
- Visitor scenario-save rate: % of visitors arriving on a
  shared calculator URL who save at least one scenario.
- Calculator share-URL distribution depth: number of unique
  visitors per published calculator within 30 days of publish.

Stage 3 — retention:
- Author 30-day retention: % of approved users who edit at
  least one calculator in their second week.

## Constraints

**Tech stack** (template-driven):
- Frontend: Next.js 16 (App Router) + TypeScript + Tailwind +
  shadcn/ui
- Backend: Supabase (PostgreSQL + Auth + Storage; Storage
  unused in v1, available for v2 features)
- Validation: Zod + react-hook-form
- Deployment target: Vercel

**Email**: custom SMTP via cyon shared hosting. Both Supabase
Auth's native flows (password reset, email verification) and
the app's custom transactional sends (sysadmin signup-
notification, approval confirmation to user, account-deletion
confirmation) route through the same SMTP server. Plain-text
templates, no React Email. Sender:
`noreply@calcgrinder.<my-domain>`. DNS / SPF / DKIM setup is
the deployer's responsibility.

**Env vars** (deployer-configured):
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the
  `sb_publishable_…` key — new key format, not the legacy
  anon key),
  `SUPABASE_SECRET_KEY` (the `sb_secret_…` key — new key
  format, not the legacy service-role key)
- Cyon SMTP: `CYON_SMTP_HOST`, `CYON_SMTP_PORT`,
  `CYON_SMTP_USER`, `CYON_SMTP_PASS`
- Sysadmin bootstrap (idempotent `npm run seed:sysadmin`):
  `SYSADMIN_EMAIL`, `SYSADMIN_INITIAL_PASSWORD`
- Sysadmin notifications: `SYSADMIN_NOTIFICATION_EMAIL`
  (distinct from `SYSADMIN_EMAIL`)
- Soft-delete retention: `RETENTION_PERIOD_DAYS` (default 30)
- Cron auth: `CRON_SECRET` (any random string; Vercel sends
  it as `Authorization: Bearer <secret>` automatically when
  invoking the scheduled `/api/cron/*` endpoints)

**Cron scheduling** — Vercel Cron Jobs declared in
`vercel.json`. Vercel raised the per-project cron limit to
100 across all plans (January 2026); on Hobby each
individual cron still fires once per day, and the exact
execution time can drift within the specified hour (e.g.
`0 4 * * *` runs anywhere between 04:00 and 04:59 UTC) —
acceptable for daily background jobs.

**Design system & spec**: see `docs/Calcgrinder-spec.md` (the
v1 specification) and `docs/design/` (the JSX prototype package
— canonical visual reference for layout, spacing, typography,
theme tokens, and interaction patterns). Production is
re-implemented in the template's Next.js + Tailwind + shadcn
stack with design fidelity, not literal pixel identity. The 8
calculator themes are ported as runtime token data, not
hardcoded into components.

**Single-deployer, low-volume v1**: assumed audience is one
deployer running one instance for a small user community
(tens-to-hundreds, not thousands). Real-time collaboration,
sharded multi-tenant scaling, custom domains, and white-label
branding are post-v1.

## Non-Goals

Explicitly not in v1 (deferred or out-of-scope):

- **Compare Mode** — visitors overlaying two scenarios on any
  chart type. Comparison Bar chart (single calculator, two
  cell-array series) is in v1; cross-scenario overlay is v2.
- **Datasets** — CSV-imported lookup tables. The dataset
  entity and lookup formulas are v2.
- **Real-time collaborative editing** — multiple users editing
  the same calculator with live cursors. v1 uses optimistic
  concurrency with a refresh-banner instead.
- **Bookmarking arbitrary other users' calculators** — the
  curated Presets surface (sysadmin-published calculators)
  covers the inspiration / starting-point case in v1.
- **Custom domains / white-label calculator URLs** — every
  calculator lives at `/c/<token>` on the deployer's domain.
- **Public scenario URL regeneration / revocation** — once a
  scenario's share token is minted, it persists for the
  scenario's lifetime. To "revoke", delete the scenario.
- **Multi-token / multi-link sharing per calculator** — one
  `public_token` per calculator at any time.
- **Slug-based public URLs** (e.g. `/c/<token>/mortgage`) —
  token-only URLs in v1; no SEO/readability rewrite.
- **Email to denied signups** — declined users see the same
  "Waiting for approval" screen as pending users.
- **Calculator version history** — only session-scoped
  Undo/Redo in v1. Publishing does not snapshot.
- **WYSIWYG markdown editor** for text-blocks — plain-text
  markdown source with live preview only.
- **Code-block syntax highlighting** in text-blocks.
- **File-upload for images** in text-blocks (external HTTPS
  URLs only; Supabase Storage path post-v1).
- **Math / LaTeX rendering**, **Mermaid diagrams**, and
  **third-party embeds** (YouTube, X/Twitter) in text-blocks.
- **CSV / JSON export of tabular output cells** — display-
  only in v1.
- **Per-column width override** and **per-row config** (row
  striping, row selection, drill-down) in tabular outputs.
- **Cell-level concurrency locking** — calculator-level
  `updated_at` only.
- **First-user-bootstrap on signup** — sysadmins are
  provisioned out-of-band via the seed script. No
  promote-on-empty-database behaviour.
- **Per-element visual overrides for cells / text-blocks
  beyond the documented Card-level + element-specific set** —
  no arbitrary CSS, no per-cell theme overrides outside the
  shipped vocabulary.
- **Analytics / telemetry** — no view counts on calculators
  or scenarios, no aggregate user-count metrics, no analytics
  SDKs (e.g. Plausible, PostHog, Segment) wired in v1. Logs
  stay at the Supabase / Vercel default level.
- **Internationalisation / locale support** — v1 is English-
  only. No i18n infrastructure (no message catalogues, no
  locale routing, no per-user language pref). Currency
  formatting per cell stays (selectable from the cell's
  display format), but app chrome, error pages, email
  templates, and Builder copy are all hardcoded in English.

---

Use `/write-spec <feature-name-or-PROJ-X>` to create detailed
feature specifications for each item in the roadmap above.
