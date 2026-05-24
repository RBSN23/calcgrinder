# PROJ-13: Soft-Delete & Trash Recovery

## Status: Deployed
**Created:** 2026-05-24
**Last Updated:** 2026-05-24 (deployed to production after QA approval — BUG-H1 + BUG-L1 fixed and re-verified)

## Dependencies

- **PROJ-5** (Account Dashboard) — PROJ-13 fills the Trash
  slot that PROJ-5 reserved (4th in the canonical section
  order: My Calculators → My Scenarios → Presets → Trash →
  User Calculators). Reuses the `<Section>`,
  `<EmptyOrErrorState>`, `<Pill>`, and `cg.*` tokens
  unchanged. Reuses PROJ-9's bottom-sheet destructive-confirm
  pattern (already in use by PROJ-10's `DeleteCalcSheet`).
- **PROJ-10** (Calculator Lifecycle — Publish, Sharing,
  Token Regen) — PROJ-10 already shipped:
  - The `soft_delete_at TIMESTAMPTZ NULL` column on
    `calculators` (originally added by PROJ-1, opt-out
    filtered by every PROJ-8/10 read query).
  - The `DELETE /api/calculators/:id` endpoint that sets
    `soft_delete_at = NOW()`.
  - The dashboard `<DeleteCalcSheet>` destructive confirm
    that triggers soft-delete from My Calculators.
  - The `(owner_id, title) WHERE soft_delete_at IS NULL`
    partial unique index — relevant because restoring a
    trashed calculator can re-introduce a title collision
    with an active row created since the soft-delete.
  - The `RETENTION_PERIOD_DAYS` env var (default 30),
    already rendered in the Move-to-Trash copy.
  - The `<CalcCard>` primitive and `Icons.Trash` /
    `Icons.RotateCcw` (Restore) glyphs.
- **PROJ-12** (Scenarios — Save, Load, Share) — PROJ-13
  reads from `scenarios.calculator_id` to count orphans
  (scenarios whose parent calculator no longer exists in
  `calculators` after a hard-delete). PROJ-12 already
  renders orphan scenarios inline in **My Scenarios** with
  muted styling and a per-row kebab-Delete; PROJ-13 layers a
  **banner with a bulk-delete-orphans action** on top of
  that section without replacing the per-row behaviour.
- **PROJ-1 → cron infrastructure.** The Vercel cron is
  declared in `vercel.json` as `0 4 * * *` hitting
  `/api/cron/purge`. PROJ-1 shipped the auth stub
  (`CRON_SECRET` bearer compare). PROJ-13 fills in the
  endpoint body — no new cron schedule, no new env var.

PROJ-13 introduces **no new env vars**. It consumes two
existing ones:
- `RETENTION_PERIOD_DAYS` (default 30) — read on the cron
  side to compute the purge cutoff, and on the dashboard
  side to render "Purges in M days".
- `CRON_SECRET` — already used by the stub for the bearer-
  token compare in `/api/cron/purge`.

## Summary

PROJ-13 is the **recovery layer** for soft-deleted
calculators. PROJ-10 shipped the trigger (Move to Trash);
PROJ-13 ships the dashboard surface where the owner can see
what's in Trash, restore it, or hard-delete it now — plus the
daily background job that hard-deletes anything older than
`RETENTION_PERIOD_DAYS`.

Concretely:

1. **Trash section on the dashboard** in the 4th slot per
   PROJ-5 ordering. Hide-when-empty. Lists the current
   user's own soft-deleted calculators ordered by
   `soft_delete_at DESC` (most recently deleted first).
   Defaults to **collapsed** — Trash is "out of the way"
   reference content, not the user's primary workspace.
2. **`<TrashCalcCard>` primitive** — reuses the same
   `<CalcCard>` shell as PROJ-10's My Calculators card,
   parameterized for the Trash variant:
   - Footer text replaces "Edited <relative-time>" with
     "Deleted N days ago · Purges in M days".
   - Status pill is a small grey **"Deleted"** pill
     (replaces Published/Draft).
   - Card-wide click is **inert** — only the kebab is
     interactive. No footer icon-buttons (Edit / Public-view /
     Duplicate are not available from Trash).
   - Kebab contains **two** items: **Restore** and
     **Delete permanently**.
3. **Restore action** — `POST /api/calculators/:id/restore`.
   Sets `soft_delete_at = NULL`. Preserves the calculator's
   prior `published` state and `public_token` (so existing
   shared links work again post-restore). If the original
   title now collides with an active row owned by the same
   user, the restored row's title is auto-resolved to the
   first free suffix (`"Mortgage" → "Mortgage (2)"`) and a
   Sonner toast announces the rename — mirrors the
   `resolveUniqueTitle` pattern PROJ-10 uses for create +
   duplicate. The card disappears from Trash and reappears
   in My Calculators in the same render pass (no reload).
   Scenarios whose `calculator_id` matches automatically
   become live again (the visitor URL stops returning 410).
4. **Delete permanently action** — extends `DELETE
   /api/calculators/:id` with an `?hard=true` query param.
   With the flag, the row is hard-deleted (`DELETE FROM`),
   FK CASCADE removes `sections` and `cells`; `scenarios`
   are **left in place** as orphans per spec. Without the
   flag, the existing soft-delete contract from PROJ-10 is
   unchanged. Hard-delete requires a fresh `updated_at` for
   optimistic concurrency, same shape as soft-delete.
5. **Delete-permanently destructive confirm** — bottom-sheet
   body: *"Permanently delete «<title>»? This cannot be
   undone. {N} scenario(s) that reference this calculator
   will become orphan."* Primary destructive button "Delete
   permanently"; ghost "Cancel". The orphan count is fetched
   server-side at sheet-open and rendered inline. N is the
   COUNT of `scenarios` rows whose `calculator_id = :id`,
   regardless of who owns them.
6. **Auto-purge cron** — extends the existing
   `/api/cron/purge` stub (created in PROJ-1, declared in
   `vercel.json` as `0 4 * * *`). The endpoint now executes
   a single SQL DELETE: `DELETE FROM calculators WHERE
   soft_delete_at IS NOT NULL AND soft_delete_at < NOW() -
   make_interval(days => :retention_days)`. FK CASCADE
   removes sections + cells; scenarios stay as orphans.
   Returns the same `{ ok, purged, retention_days }` shape
   the stub already uses — `purged` becomes the real count.
   Auth contract is unchanged (bearer-token compare against
   `CRON_SECRET`, fail-closed on missing).
7. **Orphan-scenarios banner inside My Scenarios** — when
   the current user has ≥ 1 scenarios whose parent
   calculator no longer exists (hard-deleted, regardless of
   why — owner permanent-delete OR auto-purge), a non-modal
   banner renders at the top of the My Scenarios section:
   *"N scenario(s) reference deleted calculators."* with a
   primary **"Delete all orphans"** button. Clicking opens a
   destructive-confirm bottom-sheet: *"Permanently delete
   N orphan scenario(s)? This cannot be undone."* On
   confirm, `DELETE /api/scenarios?orphans=1` fires; orphans
   disappear from the list; the banner disappears. The
   per-row kebab-Delete from PROJ-12 is preserved unchanged
   for users who want to delete one orphan at a time.
   Orphans count counts only scenarios where the parent
   calculator row no longer exists at all — soft-deleted
   parents (still in Trash, recoverable) are NOT counted as
   orphans for the banner.

8. **Integration touches** (smallest set):
    - PROJ-5's `<Section>` is consumed unchanged.
    - PROJ-10's `<DeleteCalcSheet>` copy is unchanged (the
      Move-to-Trash confirm does not learn anything about
      scenarios — restore is non-destructive to scenarios,
      so the soft-delete consequence on scenarios doesn't
      warrant warning copy).
    - The dashboard page (`src/app/(app)/dashboard/page.tsx`)
      grows a server-fetched list of the current user's
      soft-deleted calculators and renders the Trash
      `<Section>` in slot 4 when count > 0.
    - PROJ-12's `MyScenariosSection` renders the orphan
      banner above its existing list when the orphan count
      > 0.

## User Stories

- **As a calculator author**, I want a Trash section on my
  dashboard so I can see calculators I've recently deleted
  and recover them if I changed my mind.
- **As a calculator author**, I want to restore a trashed
  calculator with one click so I don't have to re-create it
  from scratch if I deleted by mistake.
- **As a calculator author**, I want to hard-delete a
  calculator immediately when I'm sure I no longer want it,
  so I don't have to wait for the retention period to
  expire.
- **As a calculator author**, I want soft-deleted
  calculators to be automatically purged after a configured
  retention window so my Trash doesn't grow forever.
- **As a registered visitor with saved scenarios**, I want
  a quick way to clean up the scenarios I'd saved against
  calculators whose authors have permanently deleted them,
  so my My Scenarios list stays meaningful.
- **As a calculator author about to permanently delete a
  calculator**, I want the confirm dialog to tell me how
  many scenarios will become orphan so I don't surprise
  anyone who'd saved values against it.

## Out of Scope

PROJ-13 ships **the recovery surface for own calculators
and the per-user bulk cleanup of orphan scenarios**.
Everything that needs a different actor, a different
trigger, or a feature that hasn't shipped yet sits in the
downstream features:

- **Clone-to-recover for orphan scenarios** during the
  recovery window (the "your calculator was deleted, here
  are your N orphan scenarios with a Clone option to keep
  using them" flow from the Calcgrinder spec). Deferred to
  **PROJ-18** (Cloning & Preset Discoverability) — clone is
  PROJ-18's primitive and shipping a one-off
  clone-of-a-soft-deleted-calculator path now would
  duplicate that implementation. V1 ships **bulk-delete
  only**; the per-row kebab-Delete from PROJ-12 remains as
  the per-scenario fallback. See Decision Log.
- **Sysadmin "Move to Trash" / "Delete permanently" on
  other users' calculators**, and the corresponding "moved
  by admin" badge on the owner's Trash card. Owned by
  **PROJ-19** (Sysadmin Moderation). PROJ-13 builds the
  Trash list query against the current user's own rows
  only; PROJ-19 can extend it with the admin-trigger
  attribution column later without re-architecture.
- **Restore-to-original-title via dialog.** Decision Log
  records that we use the same `resolveUniqueTitle`
  auto-suffix pattern PROJ-10 uses for create + duplicate,
  with a Sonner toast announcing the rename. A pop-up
  rename dialog or a "rename your active row first" block
  are explicitly NOT in v1.
- **Restoring into a "Restore as draft" workflow.** Restore
  preserves the calculator's prior `published` state by
  spec (so existing shared links work again post-restore).
  We do NOT force-flip restored rows to `published = false`.
  If the user wants the restored row to be private, they
  unpublish it via the existing Status pill.
- **Public-URL preservation on restore.** The `public_token`
  is preserved (not regenerated) so existing shared links
  re-activate when the calculator is restored. To break the
  old links the user must explicitly regenerate the URL
  from the editor's Sharing popover (PROJ-10).
- **Granular per-scenario bulk select / multi-select in
  My Scenarios.** The orphan banner deletes **all** the
  current user's orphans at once. There is no checkbox UI,
  no select-subset, no "delete orphans for one specific
  calculator". Volume assumption per PRD ("tens-to-
  hundreds, not thousands") means a single bulk action is
  sufficient.
- **Multi-step undo of bulk delete.** Once orphans are
  deleted, they're gone — no Sonner-undo toast, no recovery
  window. The destructive-confirm sheet is the only
  protection.
- **Per-calculator email or in-app notification when a
  trashed calculator is about to be auto-purged** ("Heads
  up — «Mortgage Calculator» will be permanently deleted in
  3 days"). Out of scope for v1; the Trash card's "Purges
  in M days" footer is the only signal.
- **Restoring individual sections / cells / scenarios from
  within a soft-deleted calculator.** Trash operates at the
  calculator level only; restore brings everything back at
  once. Cell-level history is out of scope per PRD ("only
  session-scoped Undo/Redo in v1. Publishing does not
  snapshot.").
- **Schedule changes to the auto-purge cron.** The schedule
  stays at the existing `0 4 * * *` from `vercel.json`
  (PROJ-1). Multi-run, smaller-batch, or hourly purge
  schedules are not v1.
- **Manual "Purge expired now" admin trigger.** Sysadmins
  cannot manually fire the purge cron from a UI in v1; the
  daily cron is the only path. The cron endpoint can be
  manually invoked with the bearer token for debugging.
- **Notifying scenario owners that their parent calculator
  was permanently deleted.** Out of scope — the banner in
  My Scenarios is the only signal, surfaced on the
  scenario owner's next dashboard visit.
- **Distinct "soft-deleted by owner" vs. "purged by cron"
  attribution on orphan scenarios.** PROJ-12's per-row
  display does not distinguish; PROJ-13 does not add the
  distinction.
- **Bulk-restore from Trash** (restoring all trashed
  calculators at once). Trash actions are per-card. Mirrors
  PROJ-10's per-card-only My Calculators.
- **Cross-user "your scenario's parent calculator was
  deleted" email**. Out of scope per PRD ("Email to denied
  signups" precedent: no proactive email for system events
  beyond the auth flow).
- **Search / filter / sort controls on Trash.** Ordering is
  fixed `soft_delete_at DESC`. Mirrors PROJ-10's
  My Calculators (no filter UI).
- **Tracking who triggered a hard-delete** (owner vs.
  cron). Hard-delete is irreversible by design; no audit
  log table is added.
- **Pagination of the Trash section.** Single fetch, no
  pagination. Same PRD-volume assumption as My Calculators.
- **A `purged_at` audit column on `scenarios`.** Orphans
  are detected by LEFT JOIN — no new column on `scenarios`.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] /
Then [result]

### Trash section — render & ordering (slot 4)

- [ ] Given an authenticated user with ≥ 1 soft-deleted
  calculator lands on `/dashboard`, when the page renders,
  then a `<Section title="Trash" count={N}>` block renders
  in slot 4 (between Presets and the sysadmin-only User
  Calculators slot per PROJ-5 ordering).
- [ ] Given an authenticated user with 0 soft-deleted
  calculators, when the page renders, then the Trash
  section is **hidden entirely** (no header, no count
  pill, no placeholder) per the PRD hide-when-empty rule.
- [ ] Given Trash renders, when the page first loads,
  then the section is `defaultExpanded={false}` (Trash is
  reference content, not the primary workspace; the count
  pill conveys "there's stuff in here").
- [ ] Given Trash content renders, when card order is
  inspected, then cards appear in `soft_delete_at DESC`
  order (most-recently-deleted first).
- [ ] Given Trash has > 4 cards, when content body exceeds
  the 304px threshold, then PROJ-5's `<Section>`
  internal-scroll kicks in (no PROJ-13 changes to the
  scroll rule).
- [ ] Given the Trash list query runs, when executed,
  then it filters to `owner_id = auth.uid() AND
  soft_delete_at IS NOT NULL`. Soft-deleted rows owned by
  other users are not visible (RLS opacity preserved).

### `<TrashCalcCard>` primitive — visual structure

- [ ] Given `src/components/dashboard/trash-calc-card.tsx`,
  when rendered with required props `{ calculator:
  CalculatorRow, retentionDays: number }`, then it renders:
  - The same icon badge (top-left, `Icons.Calc`, 30×30,
    surface2 background) as PROJ-10's `<CalcCard>`.
  - The calculator title (single line, truncate with
    ellipsis on overflow).
  - A small grey **"Deleted"** pill in the footer right
    (replaces PROJ-10's Published/Draft pill).
  - Footer left text: *"Deleted N days ago · Purges in M
    days"* with a tooltip on hover showing the absolute
    `soft_delete_at` timestamp.
  - The kebab button (top-right, `Icons.Kebab`).
  - **No** footer icon-button row (Edit / Public-view /
    Duplicate are not available in Trash).
- [ ] Given the calculator was deleted today (N < 1 day),
  when the footer renders, then the text reads "Deleted
  today · Purges in M days".
- [ ] Given the calculator was deleted exactly 1 day ago,
  when the footer renders, then the text reads "Deleted
  yesterday · Purges in M days".
- [ ] Given `M = soft_delete_at + RETENTION_PERIOD_DAYS -
  NOW()`, when M is 1, then the footer reads "Purges
  tomorrow"; when M is 0, "Purges today"; when M ≤ 0
  (cron hasn't run yet but the window has elapsed), the
  card is still rendered until the cron purges it; the
  footer reads "Purges any moment".
- [ ] Given the calculator has a multi-line description,
  when rendered, then the description body clamps to 2
  lines with ellipsis (matching PROJ-10's `<CalcCard>`).
- [ ] Given the card is laid out, when inspected, then
  `minHeight: 128px` matches the design source so the
  trash grid stays visually aligned with My Calculators.
- [ ] Given the card has the muted/danger visual treatment,
  when rendered, then it uses the existing `surface2`
  background + `borderStr` styling — no danger tint
  applied at the card level (the "Deleted" pill carries
  the visual state).

### `<TrashCalcCard>` — click behaviour

- [ ] Given the user clicks anywhere on the card **except**
  the kebab, when the click fires, then nothing happens
  (card-wide click is inert in Trash).
- [ ] Given the user tabs to the card and presses Enter,
  when the keypress fires, then nothing happens (Enter is
  also inert — only the kebab is interactive).
- [ ] Given the user clicks the kebab, when the click
  fires, then the kebab popover opens (no navigation).

### Kebab popover — Restore · Delete permanently

- [ ] Given the user opens the kebab, when the popover
  renders, then it contains two rows in this order:
  **Restore**, **Delete permanently**. "Delete
  permanently" renders with danger text colour.
- [ ] Given the kebab popover is open, when the user
  clicks outside it or presses Escape, then it closes
  without taking any action.
- [ ] Given the kebab popover is open and the user clicks
  any row, when the row's action fires, then the popover
  closes immediately.

### `POST /api/calculators/:id/restore`

- [ ] Given the owner sends `POST
  /api/calculators/:id/restore` with `{ updated_at:
  <current> }`, when the row is current and soft-deleted,
  then `soft_delete_at` is set to NULL, the response is
  200, and the body is `{ id, title, public_token,
  published, updated_at }` (the fresh row).
- [ ] Given restore succeeds, when the restored row is
  inspected, then `published` matches its pre-delete
  value (preserved across the soft-delete cycle).
- [ ] Given restore succeeds, when the restored row's
  `public_token` is inspected, then it equals the pre-
  delete token (NOT regenerated). The original
  `/c/<token>` URL becomes accessible again.
- [ ] Given the restored row's title would collide with
  an active calculator owned by the same user, when the
  restore handler runs, then the restored row's title is
  auto-resolved to the first free `"<title> (N)"` suffix
  via the existing `resolveUniqueTitle` helper. The
  response body's `title` carries the new value.
- [ ] Given the title was auto-resolved on restore, when
  the dashboard receives the 200, then a Sonner toast
  appears: *"Restored as «<new-title>» — a calculator
  with the original name already exists."*
- [ ] Given a stale `updated_at`, when the endpoint
  processes the request, then it returns 409 `{ error:
  "conflict", updated_at }` (same shape as PATCH/DELETE
  from PROJ-10).
- [ ] Given the row is NOT soft-deleted (`soft_delete_at
  IS NULL`), when restore is called, then the endpoint
  returns 404 (the read query filters to
  `soft_delete_at IS NOT NULL`; restore-on-active makes
  no sense and is treated as a not-found).
- [ ] Given a non-owner call (different user), when RLS
  rejects, then the endpoint returns 404 (opacity rule).
- [ ] Given an unauthenticated call, when no session
  exists, then the endpoint returns 401.
- [ ] Given restore succeeds, when scenarios reference
  this calculator's `id`, then their visitor URLs
  (`/c/<token>?s=<sc-token>`) stop returning 410 and
  resume serving the scenario page (PROJ-11 contract:
  visibility gated on `soft_delete_at IS NULL`).

### Dashboard Trash card → Restore flow

- [ ] Given the user clicks **Restore** in the Trash card
  kebab, when the click fires, then `POST
  /api/calculators/:id/restore { updated_at }` fires
  immediately (no confirm dialog — restore is non-
  destructive).
- [ ] Given the restore API returns 200, when the response
  is received, then the card disappears from Trash and
  reappears in My Calculators in the same render pass (no
  page reload). A Sonner toast appears: *"Restored
  «<title>»."*
- [ ] Given restore caused a title auto-rename, when the
  response is received, then the toast reads: *"Restored
  as «<new-title>» — a calculator with the original name
  already exists."* (overrides the default success toast).
- [ ] Given the Trash list is now empty post-restore,
  when the page re-renders, then the Trash section
  collapses to hidden (hide-when-empty rule).
- [ ] Given the API call fails (network / 500), when the
  failure surfaces, then a Sonner toast appears:
  *"Couldn't restore — please try again."*; the card
  stays in Trash; the dashboard state is unchanged.
- [ ] Given the API call returns 409 conflict
  (`updated_at` stale), when the failure surfaces, then
  the dashboard refetches the Trash list and a Sonner
  toast appears: *"Calculator was updated elsewhere —
  refreshed."*

### `DELETE /api/calculators/:id?hard=true` (hard-delete)

- [ ] Given the owner sends `DELETE
  /api/calculators/:id?hard=true` with `{ updated_at:
  <current> }`, when the row is current and soft-deleted,
  then the row is hard-deleted (`DELETE FROM calculators
  WHERE id = :id`); FK CASCADE removes `sections` and
  `cells`; `scenarios` are NOT touched (they become
  orphan).
- [ ] Given hard-delete succeeds, when the response is
  inspected, then it is 200 with body `{ ok: true,
  purged_orphan_count: N }` where N is the count of
  scenarios that just became orphan (counted before the
  delete).
- [ ] Given a stale `updated_at`, when the endpoint
  processes the request, then it returns 409 `{ error:
  "conflict", updated_at }`.
- [ ] Given the row is NOT soft-deleted (active row),
  when `?hard=true` is sent, then the endpoint returns
  400 `{ error: "not_in_trash" }` — hard-delete requires
  the row to be in Trash first. (Owners can't skip the
  Move-to-Trash step from the UI; this guard protects the
  API against accidental hard-deletes.)
- [ ] Given the row is already hard-deleted (not in DB
  at all), when `?hard=true` is sent, then the endpoint
  returns 404.
- [ ] Given a non-owner call, when RLS rejects, then the
  endpoint returns 404 (opacity rule).
- [ ] Given an unauthenticated call, when no session
  exists, then the endpoint returns 401.
- [ ] Given the existing `DELETE /api/calculators/:id`
  (no `?hard=true` query) is called, when processed, then
  the existing PROJ-10 soft-delete contract is unchanged
  (200 with `{ updated_at }`, 409 stale, 404 not-found).

### Delete-permanently destructive confirm

- [ ] Given the user clicks **Delete permanently** in the
  Trash kebab, when the click fires, then a server-side
  fetch for the orphan count runs first (`GET
  /api/calculators/:id/scenarios-count`), and on response
  the destructive-confirm bottom-sheet opens.
- [ ] Given the bottom-sheet renders, when N (orphan count)
  is 0, then the body reads: *"Permanently delete
  «<title>»? This cannot be undone."*
- [ ] Given the bottom-sheet renders, when N ≥ 1, then
  the body reads: *"Permanently delete «<title>»? This
  cannot be undone. {N} scenario(s) that reference this
  calculator will become orphan."* The integer is rendered
  with the appropriate singular/plural noun.
- [ ] Given the bottom-sheet renders, when inspected, then
  it has a primary destructive button labelled "Delete
  permanently" and a ghost "Cancel" button. Esc and
  outside-click close without action.
- [ ] Given the user clicks "Delete permanently", when
  the API succeeds (200), then the bottom-sheet closes,
  the card disappears from Trash in the same render pass,
  and a Sonner toast appears: *"Permanently deleted
  «<title>»."*
- [ ] Given the API call fails (network, 500), when the
  failure surfaces, then the bottom-sheet stays open and
  a Sonner toast appears: *"Couldn't delete — please try
  again."*; the card stays in Trash.
- [ ] Given the orphan-count fetch fails before the sheet
  opens, when the failure surfaces, then the sheet opens
  anyway with copy *"Permanently delete «<title>»? This
  cannot be undone. Some scenarios may become orphan."*
  (graceful degradation — never block the destructive
  action on a count-fetch failure).

### `GET /api/calculators/:id/scenarios-count`

- [ ] Given the owner calls the endpoint, when the row is
  current (soft-deleted or active), then the response is
  200 with body `{ count: number }` where count is the
  number of `scenarios` rows whose `calculator_id = :id`,
  regardless of who owns those scenarios.
- [ ] Given the row doesn't exist or is owned by another
  user, when the endpoint is called, then it returns 404
  (opacity rule).
- [ ] Given an unauthenticated call, when no session
  exists, then the endpoint returns 401.

### Auto-purge cron — `/api/cron/purge`

- [ ] Given the existing `vercel.json` cron schedule
  (`0 4 * * *`), when Vercel fires the cron, then `GET
  /api/cron/purge` is invoked with `Authorization:
  Bearer <CRON_SECRET>` (existing PROJ-1 auth contract
  preserved).
- [ ] Given a valid bearer call, when the handler runs,
  then it executes `DELETE FROM calculators WHERE
  soft_delete_at IS NOT NULL AND soft_delete_at <
  NOW() - make_interval(days => :retention_days)` where
  `retention_days = Number(process.env.RETENTION_PERIOD_DAYS) || 30`.
- [ ] Given the DELETE returns a `count`, when the
  response is built, then the body is `{ ok: true,
  purged: <count>, retention_days: <retention_days> }`
  (same shape as the PROJ-1 stub — `purged` is now real).
- [ ] Given the DELETE cascades, when inspected, then
  matching `sections` and `cells` rows are also removed
  (existing FK CASCADE from PROJ-8 schema).
- [ ] Given the DELETE runs, when scenarios reference
  the purged calculators, then `scenarios` rows are
  **not** deleted — the FK `ON DELETE SET NULL`
  (PROJ-12 migration `20260527000000_scenarios.sql`)
  nulls out `scenarios.calculator_id`, leaving the
  scenario rows as orphans for the dashboard banner to
  surface.
- [ ] Given the request has no `Authorization` header,
  when the handler runs, then it returns 401 (PROJ-1
  contract preserved).
- [ ] Given the request has an invalid bearer token,
  when the handler runs, then it returns 401 (PROJ-1
  contract preserved).
- [ ] Given `CRON_SECRET` env var is missing / empty,
  when the handler runs, then it returns 500 (PROJ-1
  fail-closed contract preserved).
- [ ] Given the DELETE statement raises a DB error, when
  the handler runs, then it returns 500 with body `{
  error: "purge_failed" }` and logs the error. Vercel
  will retry on the next scheduled run (no in-handler
  retry loop).
- [ ] Given the cron runs and finds zero rows past the
  retention window, when the DELETE runs, then `purged`
  is 0 and the response is 200 (no-op is a success).
- [ ] Given the cron runs daily but the retention window
  is N days, when a calculator is soft-deleted at time T,
  then the calculator survives until the first cron run
  after `T + N days` (so users get slightly more than N
  full days, never less — the cutoff is `< T + N days`,
  not `≤`).

### Orphan-scenarios banner (My Scenarios section)

- [ ] Given the current user has ≥ 1 scenarios whose
  parent calculator does NOT exist in `calculators`
  (hard-deleted, regardless of source), when the
  dashboard renders, then a non-modal banner renders at
  the top of the My Scenarios section above the row list.
- [ ] Given the orphan count is 0, when the dashboard
  renders, then the banner is hidden entirely.
- [ ] Given the banner renders, when inspected, then it
  contains the copy *"{N} scenario(s) reference deleted
  calculators."* and a primary **"Delete all orphans"**
  button. The integer uses the appropriate singular
  ("scenario references a deleted calculator") or plural
  noun form.
- [ ] Given the banner's count, when computed, then it
  counts ONLY scenarios whose parent calculator row no
  longer exists at all. Scenarios whose parent is
  soft-deleted (still in someone's Trash) are NOT
  counted as orphans for the banner — they're still
  recoverable.
- [ ] Given the orphan-count is computed for the banner,
  when the same scenarios render in the My Scenarios
  list, then PROJ-12's existing per-row inline display
  is preserved (the muted "Calculator deleted
  permanently" label and disabled Edit / Public-view /
  Copy link).
- [ ] Given the user clicks **"Delete all orphans"**,
  when the click fires, then a destructive-confirm
  bottom-sheet opens with body *"Permanently delete
  {N} orphan scenario(s)? This cannot be undone."* and a
  primary destructive button "Delete all" + ghost
  "Cancel".
- [ ] Given the user confirms the bulk delete, when the
  API succeeds, then the bottom-sheet closes, all orphan
  rows disappear from My Scenarios in the same render
  pass, the banner disappears, and a Sonner toast
  appears: *"Deleted {N} orphan scenario(s)."*
- [ ] Given the bulk-delete API fails, when the failure
  surfaces, then the bottom-sheet stays open and a
  Sonner toast appears: *"Couldn't delete orphans —
  please try again."*; the My Scenarios list is
  unchanged.
- [ ] Given the My Scenarios list now has 0 rows total
  post-bulk-delete, when the page re-renders, then the
  entire My Scenarios section collapses to hidden
  (hide-when-empty rule from PROJ-5).

### `DELETE /api/scenarios?orphans=1`

- [ ] Given the owner calls `DELETE
  /api/scenarios?orphans=1`, when authenticated, then
  the handler deletes every `scenarios` row where
  `owner_id = auth.uid() AND calculator_id IS NULL`
  (orphan = parent row hard-deleted, FK SET NULL per
  PROJ-12 migration `20260527000000_scenarios.sql`).
- [ ] Given the delete succeeds, when the response is
  inspected, then it is 200 with body `{ ok: true,
  deleted: <count> }`.
- [ ] Given an unauthenticated call, when no session
  exists, then the endpoint returns 401.
- [ ] Given there are 0 orphans for the caller, when
  the endpoint runs, then it returns 200 with `{
  deleted: 0 }`.
- [ ] Given the DELETE statement raises a DB error, when
  the handler runs, then it returns 500 with body `{
  error: "bulk_delete_failed" }`.

### Title uniqueness on restore — collision interaction

- [ ] Given a user soft-deletes "Mortgage Calculator",
  then creates a new active calculator titled "Mortgage
  Calculator" (allowed because the partial unique index
  excludes soft-deleted rows), when they later restore
  the trashed one, then the restored row's title is
  auto-resolved to "Mortgage Calculator (2)".
- [ ] Given the same user has both "Mortgage Calculator"
  and "Mortgage Calculator (2)" active when they
  restore a trashed "Mortgage Calculator", when the
  restore handler resolves, then the restored row's
  title becomes "Mortgage Calculator (3)" (first free
  slot).
- [ ] Given `resolveUniqueTitle` hits its 100-attempt cap
  (extreme pathological case), when the handler runs,
  then it returns 500 `{ error: "title_resolution_exhausted" }`
  and the row stays in Trash (defensive — should never
  happen in practice).

### Security & RLS

- [ ] Given the three new endpoints (restore, hard-delete,
  bulk-delete-orphans, scenarios-count), when invoked by
  an unauthenticated user, then each returns 401.
- [ ] Given a non-owner user invokes restore /
  hard-delete / scenarios-count against another user's
  row, when RLS rejects, then each returns 404 (opacity
  rule — never 403).
- [ ] Given the `DELETE /api/scenarios?orphans=1`
  handler, when invoked, then it only deletes the
  caller's own orphan scenarios — never another user's
  orphans (`owner_id = auth.uid()` filter in the DELETE
  statement).
- [ ] Given the cron purge endpoint, when invoked
  without the `CRON_SECRET` bearer, then it returns 401
  (PROJ-1 contract preserved).
- [ ] Given the cron purge endpoint, when invoked with a
  bearer that differs from `CRON_SECRET`, then the
  constant-time compare returns false and the response
  is 401.
- [ ] Given the cron purge endpoint runs the DELETE,
  when audited, then it uses the service-role / admin
  Supabase client (no RLS) — the cron is system-level,
  not user-scoped. Import is from `@/lib/supabase/admin`
  per the CLAUDE.md `server-only` rule.
- [ ] Given the orphan-count query joins `scenarios`
  with `calculators`, when audited, then it counts only
  scenarios for the current user's `id` (the route is
  user-scoped; service-role is not used here).

### Tests

- [ ] Given `src/app/api/calculators/[id]/restore/
  route.test.ts`, when `npm test` runs, then unit tests
  cover: owner restore → 200 with NULL `soft_delete_at`;
  title auto-resolve on collision; stale `updated_at` →
  409; active row → 404; non-owner → 404; unauthenticated
  → 401; preserves `published` + `public_token`.
- [ ] Given `src/app/api/calculators/[id]/route.test.ts`
  (extended for `?hard=true`), when `npm test` runs,
  then unit tests cover: hard-delete from Trash → 200
  with orphan count; hard-delete on active row → 400
  `not_in_trash`; stale → 409; non-owner → 404;
  unauthenticated → 401; FK CASCADE removes cells +
  sections (mocked).
- [ ] Given `src/app/api/calculators/[id]/scenarios-count/
  route.test.ts`, when `npm test` runs, then unit tests
  cover: returns the scenarios count; 404 on non-owner;
  401 unauthenticated.
- [ ] Given `src/app/api/scenarios/route.test.ts`
  (extended for `?orphans=1`), when `npm test` runs,
  then unit tests cover: deletes only orphans;
  scopes to the caller; returns the deleted count;
  401 unauthenticated.
- [ ] Given `src/app/api/cron/purge/route.test.ts`
  (extending the PROJ-1 stub tests), when `npm test`
  runs, then unit tests cover: 200 with real purge
  count; respects `RETENTION_PERIOD_DAYS`; FK CASCADE
  cells + sections; scenarios survive; 401 missing
  bearer; 401 bad bearer; 500 missing `CRON_SECRET`;
  500 on DB error.
- [ ] Given `tests/PROJ-13-soft-delete-trash.spec.ts`
  (Playwright E2E), when the suite runs, then it covers:
  soft-delete from My Calculators → row appears in
  Trash; Restore from Trash → row appears in My
  Calculators; Delete permanently from Trash → row
  disappears from both; orphan-banner appears after
  hard-delete with orphan scenarios; bulk-delete-orphans
  clears the banner.

## Edge Cases

- **Title collision on restore.** Handled by
  `resolveUniqueTitle` + Sonner toast. See Decision Log
  Q2.
- **Restore of a published calculator after its visitor
  URL had been 410-ing.** The `public_token` is preserved;
  the URL resumes serving content. The visitor's browser
  cache may show a stale 410 — out of our control, but the
  URL itself is functional again on the next fetch.
- **Restore preserves `public_token` — security analysis.**
  A visitor who knew the token before the soft-delete
  regains access on restore. This is intentional: the
  owner explicitly recovered the calculator. Owners who
  want to break old links should regenerate the URL
  post-restore from the editor's Sharing popover.
- **User auto-purges a calculator while a visitor is
  mid-load.** Visitor sees the existing PROJ-11 410 page
  on the next request. No special handling needed.
- **A calculator is soft-deleted, the owner creates 30
  similarly-titled calculators, then restores.** Restore
  succeeds with title `<original> (31)` (or whatever the
  next free slot is, up to the 100-attempt cap).
- **A user has 0 calculators but the auto-purge cron runs.**
  Cron returns `{ purged: 0 }`. No user-visible effect.
- **Auto-purge runs while a user is actively in the
  editor for an at-the-cusp calculator.** Not possible —
  the editor requires the row to be active (`soft_delete_at
  IS NULL`); a soft-deleted calculator's editor URL
  returns 404. The cron only purges already-soft-deleted
  rows.
- **The orphan-banner count is computed at page render,
  but the user navigates back after a long idle.** The
  banner re-renders on dashboard remount with a fresh
  query — stale count is not a concern.
- **A scenario's owner deletes themselves (account
  deletion).** Out of scope for PROJ-13; whatever PROJ-14
  (Settings) decides about account deletion governs
  scenario cleanup.
- **`RETENTION_PERIOD_DAYS` is changed mid-flight (e.g.
  deployer flips from 30 to 7).** The cron uses the new
  value on its next run; all calculators with
  `soft_delete_at < NOW() - 7 days` get purged on the
  next run. The Trash card's "Purges in M days" footer
  also uses the new value on next page render (read
  server-side from the env var via the page's data
  fetch).
- **The cron fails for a week (Vercel outage).** On
  recovery, the next cron run purges everything past the
  cutoff in one statement. No special "catch-up"
  handling needed.
- **Two browser tabs from the same user: tab A restores a
  trashed calc, tab B still shows it in Trash.** Tab B
  attempts to restore → 404 (already restored). Sonner
  toast: *"Couldn't restore — please try again."* User
  refreshes tab B to see the updated state. (Real-time
  cross-tab sync is post-v1 per PRD.)
- **Hard-delete via `?hard=true` against an already-purged
  row.** Returns 404. Idempotent from the caller's
  perspective.
- **The owner has a calculator in Trash AND the same
  calculator's scenarios in their My Scenarios list (as
  scenario saver too — possible since owners can save
  their own calculator's scenarios).** Scenarios show
  PROJ-12's soft-delete muted styling; the orphan banner
  does NOT count them (parent row still exists, soft-
  deleted). On restore: scenarios revert to fully active
  styling. On hard-delete: scenarios become orphans, the
  banner appears.

## Technical Requirements

- **Performance:** Trash list query bounded by the same
  LIMIT 100 cap as My Calculators (PROJ-10 contract).
  Orphan-count query is a single `COUNT(*) … LEFT JOIN
  calculators ON … WHERE calculators.id IS NULL` on the
  caller's scenarios — bounded by scenario volume per
  user. Cron purge is a single DELETE statement, no
  per-row processing.
- **Security:** All user-facing endpoints honour the same
  RLS / 401 / 404 opacity contract as PROJ-10. The cron
  endpoint uses the admin client (RLS bypass), reading
  from server-only code.
- **Browser support:** Chrome, Firefox, Safari (matches
  PROJ-10 / PROJ-12 baseline).

## Open Questions

- [ ] Should the cron emit a metric / log line per purged
  calculator (for audit / debugging), or only the
  aggregate count? Defaulting to aggregate count + total
  in the response body. Revisit if operations need
  per-row visibility.
- [ ] Should the "Purges in M days" footer link to
  Restore? Defaulting to no — the kebab is the only
  interaction surface on Trash cards per Q4 decision.
  Revisit if user research shows users miss the kebab.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Bulk-delete-orphans only in v1; clone-to-recover deferred to PROJ-18 | Clone is PROJ-18's primitive; shipping a one-off clone-of-a-soft-deleted-calculator path now would duplicate that implementation. The bulk-delete addresses the volume problem (a user with 10 orphan scenarios doesn't want to delete each individually); the per-row kebab-Delete from PROJ-12 remains as the per-scenario fallback. | 2026-05-24 |
| Restore on title collision auto-resolves with a Sonner toast | Mirrors the auto-resolve pattern PROJ-10 already uses for create and duplicate (`resolveUniqueTitle`). Keeps the recovery action one click; the toast communicates the rename without blocking. Blocking restore until the user manually renames the active row would force a context switch back to My Calculators — friction for an action the user has already confirmed they want. | 2026-05-24 |
| Orphan-scenarios banner inside My Scenarios (vs. dedicated section or header button) | Contextual placement next to the orphan rows the user is looking at; one bulk action surfaces alongside the per-row Delete kebab from PROJ-12. A dedicated section would duplicate rows already shown in My Scenarios; a header button would be less discoverable when N is large. | 2026-05-24 |
| Move-to-Trash confirm copy (PROJ-10) is NOT extended to mention scenarios | Soft-delete is reversible; scenarios automatically come back on Restore. The destructive consequence on scenarios only materializes on hard-delete or auto-purge, where the Delete-permanently confirm + bulk-delete-orphans banner explicitly call it out. Each confirm should mention only the consequence specific to that action. | 2026-05-24 |
| Trash card click is inert; kebab is the only interaction surface | Card-wide click on My Calculators opens `/c/<token>` in a new tab — but a Trash card's URL would 410. Mirroring that behaviour would actively take users to an error page; opening Restore confirm on card click would conflict with the established "card-wide click = preview" pattern. Inert is the least-surprising default. | 2026-05-24 |
| Hard-delete is gated to soft-deleted rows only (400 `not_in_trash` on active rows) | Owners can't skip the Move-to-Trash step from the UI; this API guard protects against accidental hard-deletes via direct API calls (e.g. third-party scripts, dev tools). To hard-delete an active calculator, the owner must Move-to-Trash first, then Delete-permanently from Trash. Two-step gating mirrors the OS-level Trash model. | 2026-05-24 |
| `public_token` is preserved on restore (not regenerated) | The spec is explicit: "preserves the calculator's prior Published/Draft state and its public-share token (so existing shared links work again post-restore)". The user explicitly recovered the calculator; assuming they want to break old links would be paternalistic. Users who do want to revoke can regenerate the URL post-restore from the editor's Sharing popover (PROJ-10). | 2026-05-24 |
| Trash section is `defaultExpanded={false}` | Trash is reference content the user visits when they need to recover, not their primary workspace. The count pill conveys "there's stuff in here" without forcing visual space when N is large. Mirrors the PROJ-5 default (`false`); only My Calculators explicitly overrides to `true`. | 2026-05-24 |
| Bulk-delete-orphans deletes ALL of the caller's orphans (no multi-select) | Volume assumption per PRD is "tens-to-hundreds, not thousands". A single bulk action is sufficient; checkbox UI / select-subset is post-v1. The per-row kebab-Delete from PROJ-12 remains as the per-scenario fallback for users who want surgical control. | 2026-05-24 |
| Orphan banner counts ONLY hard-deleted parent (not soft-deleted) | Soft-deleted parent means the calculator is still recoverable; the scenarios may come back to life on restore. Counting them as orphans for bulk-delete would invite the user to destroy data that's still salvageable. PROJ-12's inline muted styling is the right signal for "your parent is in trash"; the orphan banner is specifically for "your parent is gone forever". | 2026-05-24 |
| No per-calculator "about to be purged" email notification | Out of scope for v1. The Trash card's "Purges in M days" footer is the only signal. Adds operational complexity (a second cron, email infrastructure beyond the existing transactional sends) for a feature that users might never need. Easy to add later if usage demands it. | 2026-05-24 |
| Cron stays at the existing `0 4 * * *` (PROJ-1 schedule) | No reason to change the schedule. PROJ-1's daily cadence matches the use case (retention is measured in days, not hours). Vercel's per-cron 24h cadence on Hobby is not a constraint here. | 2026-05-24 |
| Cron uses the admin Supabase client (RLS bypass); user-facing endpoints stay user-scoped | The cron is system-level — it has no `auth.uid()` and should purge across all users. The admin client is the correct primitive (with the `server-only` guard preventing accidental import in client code). User-facing endpoints use the user-scoped client and honour RLS as usual. | 2026-05-24 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| **No new migration.** Reuse `soft_delete_at` (added in PROJ-8 `20260523120000_calculators.sql`), the partial unique index `(owner_id, title) WHERE soft_delete_at IS NULL` (PROJ-10), and the FK `scenarios.calculator_id ON DELETE SET NULL` (PROJ-12 `20260527000000_scenarios.sql`). | All the schema PROJ-13 needs was deliberately laid down by upstream features. Skipping a migration removes a Cloud `db push` + types regen from the release path; failure mode shifts entirely to routes + UI. | 2026-05-24 |
| **Orphan detection via `scenarios.calculator_id IS NULL`** (single-column check, not a LEFT JOIN against `calculators`). | PROJ-12's FK with `ON DELETE SET NULL` does the work for us — the column is `NULL` iff the parent calculator is hard-deleted. Faster query (uses `idx_scenarios_calculator_id`), clearer semantics, no JOIN cost. | 2026-05-24 |
| **Reuse `resolveUniqueTitle(supabase, ownerId, base)` from `src/lib/calculators/server.ts`** for restore title-collision resolution. | The helper is generic — it doesn't care whether the calling context is create, duplicate, or restore. Same algorithm, same 100-attempt cap, same `null`-on-exhaustion contract. Avoids a parallel implementation. | 2026-05-24 |
| **Extend `DELETE /api/calculators/:id` with `?hard=true` query param** instead of introducing a separate `/hard-delete` endpoint. | Same row, same auth, same optimistic-concurrency contract — only the SQL verb changes (UPDATE → DELETE FROM). One handler with a query-flag branch is simpler than two parallel routes. Mirrors how `?mine=1` / `?orphans=1` are used on the scenarios endpoints. | 2026-05-24 |
| **Hard-delete is gated by `soft_delete_at IS NOT NULL`**; active rows return 400 `not_in_trash`. | Defense-in-depth: the UI funnel always goes Move-to-Trash first, but a hand-crafted API call could skip that. Forcing a two-step gate (soft-delete → hard-delete) mirrors OS-level Trash and prevents a single buggy script from nuking a live calculator. | 2026-05-24 |
| **Cron purge uses `createAdminClient()` from `src/lib/supabase/admin.ts`** (RLS-bypass). | System-level job — no `auth.uid()`, must purge across all users. The `server-only` guard at the top of `admin.ts` prevents accidental import from client code (build error, not runtime). All user-facing endpoints continue to use the user-scoped client. | 2026-05-24 |
| **Cron response shape unchanged from PROJ-1 stub**: `{ ok: true, purged: <count>, retention_days: <n> }`. | Stable contract — anything monitoring the cron sees the same shape it always saw. Only the `purged` value changes from 0 to the real count. No version bump needed. | 2026-05-24 |
| **Cron purges in a single `DELETE FROM` statement**; no per-row processing, no batching. | PRD volume assumption is "tens-to-hundreds, not thousands". A single statement is simpler, atomic (all-or-nothing per run), and lets Postgres handle FK CASCADE for sections/cells in one transaction. Batching can be added later if a deployer hits perf issues. | 2026-05-24 |
| **`<TrashCalcCard>` is a new component**, NOT a parametrized variant of `<CalcCard>`. | The trash card has materially different interaction surface (no card-wide click, no footer icon-buttons, different kebab items, different pill) — branching the existing card on a `variant` prop would add conditional logic at every touchpoint. A new ~70-line component is cleaner and lets the My Calculators card evolve independently. | 2026-05-24 |
| **`<OrphanScenariosBanner>` is a new component** inside the existing `MyScenariosSection`, not a prop on the section. | Banner appears only when the orphan-count is > 0, has its own destructive-confirm flow, and doesn't change Section's general API. Keeping it as a sibling element inside the section body is the least invasive integration with PROJ-12's existing component. | 2026-05-24 |
| **Orphan count is fetched server-side** in the same dashboard page load (alongside scenarios + my-calcs + trash), NOT fetched client-side on mount. | The dashboard page is already a server component with multiple parallel reads. Adding one `COUNT(*) WHERE calculator_id IS NULL AND owner_id = uid()` is cheap (uses `idx_scenarios_calculator_id`) and avoids a client-side waterfall. | 2026-05-24 |
| **"Purges in M days" footer text computed at render**, not stored. | M = ceil((`soft_delete_at` + `RETENTION_PERIOD_DAYS` − NOW()) / 1 day). Cheaply derivable on the server at page-render time; the env var is read alongside `listMySoftDeletedCalculators()`. Storing it would require a column that drifts whenever the deployer changes the retention setting. | 2026-05-24 |
| **No retry / dead-letter logic in the cron handler.** On DB error → 500; Vercel retries the cron the next day. | A daily cron with one statement has tiny per-day blast radius — if today's run fails, tomorrow's catches up (the cutoff is absolute, not relative to the last successful run). Building retry/DLQ infra for a daily housekeeping job is overkill for v1 volume. | 2026-05-24 |
| **Test mocking follows existing pattern**: `vi.mock('@/lib/supabase/server')` + `vi.mock('@/lib/supabase/admin')` with the `test-helpers.ts` queue-based mock builder for routes; Playwright E2E in `tests/PROJ-13-*.spec.ts`. | Established by PROJ-10/PROJ-12. Reviewers don't have to learn a new mocking convention; new tests slot into the existing CI. | 2026-05-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### What we're building (one sentence)

PROJ-13 turns the Trash icon on a calculator card into a real
recovery surface: deleted calculators land in a Trash section
on the dashboard where the owner can either bring them back
(Restore) or finish them off (Delete permanently); a daily
background job sweeps anything older than 30 days; and a new
banner on the dashboard lets the owner clean up scenarios
that were saved against calculators that no longer exist.

### What we're reusing (no new infrastructure)

The hard work was front-loaded by upstream features. PROJ-13
adds **zero new database tables, zero new columns, zero new
env vars, and zero new cron schedules**:

- `soft_delete_at` was added by PROJ-8 with the original
  calculators table.
- The partial unique index on `(owner_id, title)` was added
  by PROJ-10 so a freed-up title doesn't block a restore-
  with-rename.
- The `scenarios.calculator_id` foreign key was set up by
  PROJ-12 with **`ON DELETE SET NULL`** specifically so
  PROJ-13 can detect orphans by checking one column.
- The cron schedule (`0 4 * * *`) and the bearer-token auth
  stub at `/api/cron/purge` were laid down by PROJ-1.
- `RETENTION_PERIOD_DAYS` env var is already in production
  and rendered in PROJ-10's Move-to-Trash copy.

PROJ-13 fills in **routes**, **UI components**, and the
**body of the cron handler**.

### Component structure (visual tree)

```
Dashboard page (/dashboard)
+-- My Calculators (PROJ-10, unchanged)
+-- My Scenarios (PROJ-12, modified)
|   +-- OrphanScenariosBanner  ← NEW (only when orphans > 0)
|   |   "{N} scenarios reference deleted calculators."
|   |   [Delete all orphans]  ← opens DestructiveConfirmSheet
|   +-- Scenario rows (PROJ-12, unchanged)
+-- Presets (PROJ-5/PROJ-18, unchanged)
+-- Trash  ← NEW (only when trash count > 0; collapsed by default)
|   +-- TrashCalcCard × N  ← NEW
|       +-- Icon badge + title + "Deleted" pill (grey)
|       +-- Footer: "Deleted N days ago · Purges in M days"
|       +-- Kebab popover  ← NEW
|           +-- Restore     → POST /api/calculators/:id/restore
|           +-- Delete permanently  → opens DeletePermanentlySheet
+-- User Calculators (PROJ-19, sysadmin-only, unchanged)

Editor & Visitor View — no changes
```

The Trash card visually mirrors My Calculators' card (same
icon, same title row, same kebab position) so users
recognise it as the same primitive in a different state.
The card body is **inert** (no card-wide click, no footer
icon-buttons) — only the kebab is interactive. This is the
single biggest behavioural difference from My Calculators.

### What gets fetched on the dashboard

The dashboard page is a server component and already runs
parallel reads for My Calculators + My Scenarios. PROJ-13
adds two more parallel reads to that bundle:

1. **List my soft-deleted calculators** — feeds the Trash
   section. Reads the rows where the current user is the
   owner AND `soft_delete_at IS NOT NULL`, ordered by
   `soft_delete_at DESC`. Uses the existing
   `idx_calculators_owner_soft_delete` index. Capped at
   100 rows (mirrors My Calculators).
2. **Count my orphan scenarios** — feeds the banner. Reads
   the count where the current user is the owner AND
   `calculator_id IS NULL`. Uses
   `idx_scenarios_calculator_id`.

Both reads add minimal latency — the dashboard already does
2 parallel fetches; this brings it to 4 (or 5 if Presets
adds one), all running concurrently.

### What the user sees, end-to-end

**Path 1 — Recover a calculator the user accidentally
deleted yesterday:**
1. User opens dashboard. Trash section is in slot 4,
   collapsed, with a count pill ("3"). They click to expand.
2. They see their accidentally-deleted calculator with
   "Deleted yesterday · Purges in 29 days" in the footer
   and a grey "Deleted" pill.
3. They click the kebab → Restore. No confirm dialog
   (restore is non-destructive). One API call.
4. The card disappears from Trash and reappears in My
   Calculators in the same render pass (no page reload).
5. Their existing shared URL (`/c/<token>`) becomes
   accessible again immediately. Any scenarios saved
   against this calculator are live again.

**Path 1b — Restore where the title now collides:**
1. Same as above, but the user had created a new calculator
   with the same name in the interim.
2. Restore happens anyway; the restored row's title is
   auto-suffixed to "<original> (2)".
3. A Sonner toast announces: *"Restored as «Original Name
   (2)» — a calculator with the original name already
   exists."*

**Path 2 — Free up Trash without waiting 30 days:**
1. User opens Trash, clicks the kebab on a calculator they
   never want back → Delete permanently.
2. Before the confirm sheet opens, the page fetches the
   orphan-scenarios count for this calculator.
3. The destructive-confirm sheet appears: *"Permanently
   delete «<title>»? This cannot be undone. {N}
   scenario(s) that reference this calculator will become
   orphan."* — `N` is the count from step 2.
4. User clicks "Delete permanently". One API call with
   `?hard=true`. The row, its sections, and its cells are
   gone forever (Postgres FK CASCADE handles the
   children). Scenarios that pointed at it have their
   `calculator_id` set to NULL (PROJ-12's FK rule).
5. Card disappears from Trash; Sonner toast confirms.

**Path 3 — Clean up orphan scenarios:**
1. Owner had saved scenarios on someone else's published
   calculator. The owner of that calculator later
   permanently deleted it (or it auto-purged).
2. On the saver's next dashboard visit, a banner appears
   at the top of My Scenarios: *"3 scenarios reference
   deleted calculators."* with a [Delete all orphans]
   button.
3. They click → destructive-confirm sheet → confirm.
4. All three orphan rows disappear from My Scenarios; the
   banner disappears.
5. Per-row Delete-in-kebab from PROJ-12 is still available
   for users who prefer to delete one at a time.

**Path 4 — Auto-purge (invisible to users):**
1. Every day at ~04:00 UTC, Vercel hits
   `/api/cron/purge` with the bearer token.
2. The handler runs one SQL `DELETE` that removes any
   calculator whose `soft_delete_at` is older than
   `RETENTION_PERIOD_DAYS` (default 30).
3. Sections + cells follow via existing FK CASCADE;
   scenarios are nulled-out (PROJ-12's FK rule).
4. The handler returns `{ ok: true, purged: <count>,
   retention_days: 30 }`. Vercel logs it. No user is
   notified.

### Data flow at a glance

```
User clicks Delete in My Calculators kebab
    → DELETE /api/calculators/:id  (sets soft_delete_at)
    → row leaves My Calculators, appears in Trash
    → /c/<token> starts returning 410 (PROJ-11 already does this)

User clicks Restore in Trash kebab
    → POST /api/calculators/:id/restore  (NULLs soft_delete_at + title-resolve if needed)
    → row leaves Trash, reappears in My Calculators
    → /c/<token> starts returning 200 again

User clicks Delete permanently in Trash kebab
    → GET /api/calculators/:id/scenarios-count  (drives the warning copy)
    → DELETE /api/calculators/:id?hard=true  (real DELETE FROM)
    → row, sections, cells gone forever
    → scenarios.calculator_id → NULL  (becomes an orphan)

Auto-purge cron fires daily
    → admin-client DELETE FROM calculators WHERE soft_delete_at < cutoff
    → same FK cascade behavior as manual Delete permanently
```

### New API endpoints (4 total)

| Endpoint                                                | Purpose                                                | Auth        |
|---------------------------------------------------------|--------------------------------------------------------|-------------|
| `POST /api/calculators/:id/restore`                     | Bring a soft-deleted calculator back; auto-resolve title collision | Owner       |
| `GET /api/calculators/:id/scenarios-count`              | Count scenarios pointing at this calculator (drives Delete-permanently copy) | Owner       |
| `DELETE /api/calculators/:id?hard=true` *(extends existing)* | Hard-delete a soft-deleted calculator                  | Owner       |
| `DELETE /api/scenarios?orphans=1` *(extends existing)*  | Bulk-delete all the caller's orphan scenarios          | Owner       |
| `GET /api/cron/purge` *(fills existing stub)*           | Daily auto-purge of expired soft-deletes               | Bearer (CRON_SECRET) |

All user-facing endpoints follow the existing PROJ-10
contract: 401 on no session, 404 on RLS reject (opacity —
never 403), 409 on stale `updated_at`. The cron endpoint
keeps PROJ-1's bearer-token contract and fail-closed
behaviour.

### New files (server)

```
src/app/api/calculators/[id]/
  restore/route.ts                ← NEW endpoint
  restore/route.test.ts           ← NEW unit tests
  scenarios-count/route.ts        ← NEW endpoint
  scenarios-count/route.test.ts   ← NEW unit tests

src/app/api/calculators/[id]/route.ts          ← MODIFIED (add ?hard=true branch)
src/app/api/calculators/[id]/route.test.ts     ← MODIFIED (cover ?hard=true)

src/app/api/scenarios/route.ts                 ← MODIFIED (add ?orphans=1 to DELETE)
src/app/api/scenarios/route.test.ts            ← MODIFIED (cover orphan bulk delete)

src/app/api/cron/purge/route.ts                ← MODIFIED (replace stub body with real DELETE)
src/app/api/cron/purge/route.test.ts           ← MODIFIED (cover the real path)

src/lib/calculators/server.ts                  ← MODIFIED (add listMySoftDeletedCalculators helper)
src/lib/scenarios/server.ts                    ← MODIFIED (add countMyOrphanScenarios helper)
```

### New files (UI)

```
src/components/dashboard/
  trash-section.tsx               ← NEW (wraps <Section> + TrashCalcCard grid)
  trash-calc-card.tsx             ← NEW (inert card, kebab with Restore + Delete permanently)
  delete-permanently-sheet.tsx    ← NEW (destructive confirm with orphan-count warning)
  orphan-scenarios-banner.tsx     ← NEW (banner + bulk-delete confirm)

src/components/dashboard/my-scenarios-section.tsx  ← MODIFIED (render the banner above rows)

src/app/(app)/dashboard/page.tsx                   ← MODIFIED (fetch trash list + orphan count, mount TrashSection)
```

### Tech decisions in plain language (the "why" for PMs)

- **Why no new migration?** Every piece of database state
  PROJ-13 needs is already there — added by PROJ-1
  (cron infra), PROJ-8 (`soft_delete_at`), PROJ-10
  (partial unique index), and PROJ-12 (the scenarios FK
  with `ON DELETE SET NULL`). The release is a code-only
  change; no Supabase `db push` step, no types regen.
- **Why one daily cron and not a more sophisticated
  schedule?** Retention is measured in days, not hours.
  A daily sweep is sufficient and matches PROJ-1's
  already-deployed schedule. Users get up to 24 extra
  hours of retention past the configured window — a
  feature, not a bug.
- **Why does Restore NOT pop a confirm dialog?** Restore
  is non-destructive. Confirm dialogs train users to
  click through them. Reserving the destructive-confirm
  pattern for actually-destructive actions (Move to
  Trash, Delete permanently, bulk-delete orphans) keeps
  the friction signal honest.
- **Why are orphan scenarios surfaced as a banner inside
  My Scenarios and not a dedicated section?** The orphan
  rows are already in My Scenarios with greyed-out
  styling from PROJ-12; the banner sits alongside them
  as the bulk-cleanup tool. A dedicated section would
  duplicate rows; a header button would be less
  discoverable when N is large.
- **Why does hard-delete require the row to already be
  in Trash?** Two-step gating mirrors how OS-level
  Trash works. The UI funnel always goes Move-to-Trash
  first; the API guard protects against accidental
  single-step hard-deletes via direct API calls (e.g.
  a buggy third-party script). Owners who want to skip
  the wait still only need two clicks.
- **Why preserve the public share token on Restore?**
  The user explicitly recovered the calculator. Assuming
  they wanted to break old shared links would be
  paternalistic. If they DO want to revoke old links,
  they can regenerate the URL from the editor's Sharing
  popover (PROJ-10) post-restore.

### Dependencies (packages to install)

**None.** Everything PROJ-13 needs is already in the
project:
- `@supabase/supabase-js` — used by all routes
- `next` — App Router for routing
- `sonner` — toast notifications
- `lucide-react` — icons (Trash, RotateCcw already used by
  PROJ-10)
- Radix UI primitives — `DropdownMenu`, `Dialog`
  (bottom-sheet base), already in PROJ-9/PROJ-10
- `vitest` — unit testing
- `@playwright/test` — E2E testing

### Risks & mitigations

| Risk                                                                                          | Mitigation                                                                                                                                          |
|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| Cron fails silently for days (Vercel outage or `CRON_SECRET` mis-config)                      | Stub already fails-closed (500 on missing secret). On recovery, one cron run catches up all past-cutoff rows in a single statement.                 |
| Restore re-introduces a title collision that auto-resolve can't handle (100-attempt cap hit)  | Returns 500 + structured error; user sees a "Couldn't restore" toast. Pathological — would require >99 collisions with the same title.              |
| User has so many soft-deleted calculators that the cron statement is slow                     | PRD volume is "tens-to-hundreds". The DELETE uses the existing `idx_calculators_owner_soft_delete` index. Single statement is atomic per cron run. |
| `RETENTION_PERIOD_DAYS` changed mid-flight (deployer drops 30 → 7)                            | Cron picks up new value on next run; older trash purges sooner. Owners get one extra dashboard visit's notice via the "Purges in M days" footer.    |
| Two browser tabs: tab A restores; tab B tries to restore the same row                         | Tab B gets 404 + "Couldn't restore" toast (the read-back disambiguation pattern PROJ-10 already uses). User refreshes tab B. Real-time sync is post-v1. |
| Scenario owner deletes their account while their orphans exist                                | Scenarios `owner_id` FK is `ON DELETE CASCADE` (PROJ-12) — scenarios go with the account. PROJ-13 doesn't change account-deletion semantics.       |
| A future PROJ-19 sysadmin "Move to Trash" feature collides with the owner's Trash list query | Trash list is scoped `owner_id = auth.uid()` — sysadmin-trashed rows owned by the user appear in the user's Trash naturally. Attribution column (if PROJ-19 needs it) can be added without changing PROJ-13's queries. |

### Verification (how QA can test end-to-end)

1. **Soft-delete → Trash appears.** From My Calculators
   kebab → Delete → confirm. Row disappears from My
   Calculators; appears in Trash with "Deleted today ·
   Purges in 30 days".
2. **Restore.** From Trash kebab → Restore. Row
   disappears from Trash; reappears at top of My
   Calculators. Visit `/c/<token>` in a separate tab —
   loads normally (was 410 before restore).
3. **Restore with collision.** Repeat (1), then create a
   new calculator with the same title, then restore.
   Toast shows the auto-renamed title; restored row in
   My Calculators carries the suffix.
4. **Delete permanently.** From Trash kebab → Delete
   permanently. Confirm sheet shows orphan-count copy.
   Confirm. Row gone from both lists. Visit `/c/<token>`
   — 404 (was 410 before).
5. **Auto-purge.** Manually invoke `GET
   /api/cron/purge` with `Authorization: Bearer
   $CRON_SECRET`. Response shows `purged: N` matching
   any rows in Trash older than `RETENTION_PERIOD_DAYS`.
6. **Orphan banner.** Save a scenario against another
   user's calculator (or a second test account's
   calculator); have the owner Delete permanently;
   reload the saver's dashboard. Banner appears above
   My Scenarios with the correct count. Bulk-delete
   clears it.
7. **Run `npm test`.** All existing tests + new
   PROJ-13 unit tests pass.
8. **Run `npm run test:e2e -- tests/PROJ-13-*.spec.ts`.**
   End-to-end recovery flow passes.

After QA approves: `/deploy` runs `npm run build`, deploys
to Vercel. The cron picks up the new behaviour on its next
scheduled run automatically — no manual step needed
post-deploy.

## Implementation Notes (Frontend + Backend)

**Status update (2026-05-24):** Initial implementation complete.

### Files added

Server / API:
- `src/app/api/calculators/[id]/restore/route.ts` — POST handler
  with stale-check, title auto-resolve via `resolveUniqueTitle`,
  and disambiguating read-after-write for the rare race where the
  row changes between the initial read and the UPDATE.
- `src/app/api/calculators/[id]/scenarios-count/route.ts` — GET
  handler that uses the user-scoped client to verify ownership of
  the calculator, then the **admin client** to read the cross-owner
  scenarios count (the only data exposed is an integer; no
  attribution).

Server / lib:
- `listMySoftDeletedCalculators()` in `src/lib/calculators/server.ts`
  — returns `TrashedCalculatorRow[]` (the public row shape plus
  `soft_delete_at`) ordered `soft_delete_at DESC`, capped at 100.
- `countMyOrphanScenarios()` in `src/lib/scenarios/server.ts` —
  `SELECT count(*) … WHERE calculator_id IS NULL` (orphan detection
  via the single-column check enabled by PROJ-12's FK SET NULL).

Server / extensions:
- `DELETE /api/calculators/:id?hard=true` branch in
  `src/app/api/calculators/[id]/route.ts` — two-step gate
  (`not_in_trash` for active rows), admin-client orphan count
  taken before the DELETE.
- `DELETE /api/scenarios?orphans=1` in
  `src/app/api/scenarios/route.ts` — caller-scoped bulk delete
  of orphan scenarios.
- `GET /api/cron/purge` body in
  `src/app/api/cron/purge/route.ts` — admin-client DELETE of
  calculators whose `soft_delete_at < NOW() -
  RETENTION_PERIOD_DAYS`. Sections/cells follow via FK CASCADE;
  scenarios survive as orphans via PROJ-12's `ON DELETE SET NULL`.

Client helpers:
- `restoreCalculator()`, `hardDeleteCalculator()`,
  `getScenariosCount()` added to `src/lib/calculators/client.ts`.
- `bulkDeleteOrphanScenarios()` added to
  `src/lib/scenarios/client.ts` + re-exported from
  `src/lib/scenarios/index.ts`.

UI components:
- `src/components/dashboard/trash-calc-card.tsx` — inert card,
  kebab with Restore + Delete permanently, "Deleted N days ago ·
  Purges in M days" footer with explicit phrasing for the today /
  yesterday / tomorrow / any-moment edges.
- `src/components/dashboard/delete-permanently-sheet.tsx` —
  destructive confirm with orphan-count fetch + graceful
  degradation copy on fetch failure.
- `src/components/dashboard/trash-section.tsx` — slot-4 wrapper
  (hide-when-empty, `defaultExpanded={false}`, grid mirrors My
  Calculators).
- `src/components/dashboard/orphan-scenarios-banner.tsx` — banner
  + bulk-delete confirm sheet, rendered inside `<MyScenariosSection>`
  above the row list.
- `Icons.RotateCcw` added to `src/components/shell/icons.tsx` for
  the Restore kebab item.

Wiring:
- `src/components/dashboard/my-scenarios-section.tsx` accepts a
  new optional `orphanCount` prop and renders
  `<OrphanScenariosBanner>` above the row list when > 0.
- `src/app/(app)/dashboard/page.tsx` now fetches four parallel
  reads (calculators, scenarios, trashed calcs, orphan count) and
  mounts `<TrashSection>` in slot 4.

### Tests

- All 665 existing unit tests pass.
- `src/app/api/cron/purge/route.test.ts` extended: now mocks
  `createAdminClient`, covers the real purge count, the
  RETENTION_PERIOD_DAYS cutoff calculation, the 500-on-DB-error
  path, and confirms auth short-circuits before the admin client
  is constructed.
- Spec-listed PROJ-13 unit tests (`restore/route.test.ts`,
  `scenarios-count/route.test.ts`, extended `[id]/route.test.ts`
  for `?hard=true`, extended `scenarios/route.test.ts` for
  `?orphans=1`) and the Playwright E2E (`tests/PROJ-13-*.spec.ts`)
  are NOT in this batch — they belong to the `/qa` phase and will
  land before deployment.

### Deviations from the spec / decisions

- **Restore endpoint also returns `renamed: boolean`** in addition
  to the public row shape so the client can pick between the two
  toast variants ("Restored …" vs "Restored as …") without
  needing to compare the response title to a remembered pre-
  delete title. The spec's AC ("the response body's `title`
  carries the new value") is preserved; `renamed` is additive.
- **`scenarios-count` uses the admin client for the COUNT step**
  to honour the spec's "regardless of who owns those scenarios"
  AC. The route still proves caller ownership of the calculator
  via the user-scoped client first.
- **Hard-delete orphan count** uses the admin client for the same
  reason. No new RPC was needed.

## QA Test Results

**Date:** 2026-05-24 (initial QA pass), re-run 2026-05-24 (post-fix)
**Tester:** /qa (Claude)
**Status:** **READY.** Both bugs found in the initial pass are Fixed and re-verified end-to-end. See "Re-run log" at the bottom of this section.

### Summary

| Surface | Result |
|---|---|
| Unit tests | 704 passed (39 added for PROJ-13), 0 failed |
| Lint | 0 errors, 5 pre-existing warnings (unrelated) |
| Production build | Clean |
| Playwright E2E — PROJ-13 (`tests/PROJ-13-soft-delete-trash.spec.ts`) | 30 passed (15 × chromium + 15 × Mobile Safari), 0 `.fixme`, 0 failed |
| Playwright regression — PROJ-1 / PROJ-10 / PROJ-12 | 36 passed, 0 failed |
| Acceptance criteria | 49/49 pass after BUG-H1 + BUG-L1 fixes |

### Bugs found

#### BUG-H1 — Hard-delete returns 500 (RLS DELETE policy missing) — **HIGH**

- **Status:** **Fixed** (2026-05-24). The `?hard=true` branch in
  `src/app/api/calculators/[id]/route.ts` now issues its final
  `DELETE FROM calculators` through the admin client already created
  for the orphan COUNT a few lines above — single-handler change, no
  schema/migration touch. Ownership is still proven up-front by the
  user-scoped SELECT (RLS gate), so the admin DELETE remains
  owner-scoped in practice. The `tests/PROJ-13-soft-delete-trash.spec.ts`
  test that was `test.fixme(...)` on this bug is back to plain `test(...)`
  and passes on both chromium and Mobile Safari. The
  `src/app/api/calculators/[id]/route.test.ts` happy/zero/error
  hard-delete cases were updated to expect the DELETE on the admin
  client and added a regression guard (`supabase._builders[0]!.delete`
  must NOT have been called). Originally caught by the E2E only —
  unit tests now cover both the admin-client routing AND the
  user-scoped-client-never-deletes invariant.
- **Severity (original):** **High** — the entire "Delete permanently" flow was broken in production.

**Where (original):** `src/app/api/calculators/[id]/route.ts` line ~276, in the `?hard=true` branch.

**Repro steps:**
1. Sign in as any user, soft-delete a calculator from My Calculators.
2. Open the Trash card kebab → Delete permanently → confirm.
3. The route fires `DELETE /api/calculators/:id?hard=true` and Postgres rejects with
   `42501 permission denied for table calculators`. Response is `500 { error: 'delete_failed' }`.
4. The card stays in Trash; the user sees the "Couldn't delete — please try again." toast.

**Root cause:** PROJ-1's `20260523120000_calculators.sql` migration deliberately omits a DELETE policy
on `calculators` (line 85: *"No DELETE policy: hard deletes are admin-only paths in PROJ-13 / PROJ-19"*)
and grants `SELECT, INSERT, UPDATE` only to `authenticated`. The PROJ-13 hard-delete handler ignores
that contract and issues the `DELETE FROM calculators` through the user-scoped client. Result: every
authenticated DELETE on the calculators table fails 42501. The unit tests didn't catch this because
the Supabase mock returns whatever the test queues for the DELETE — only the real DB enforces the GRANT.

**Suggested fix:** switch the `DELETE FROM calculators` to the admin client (ownership is already
proven by the user-scoped read that runs immediately above). The admin client has `GRANT ALL`
already. The single-line change in the route is:
```ts
const { error: deleteErr } = await admin
  .from('calculators')
  .delete()
  .eq('id', id)
  .not('soft_delete_at', 'is', null);
```
(reuse the `admin` reference already created for the orphan COUNT a few lines above).

Alternative: add a DELETE policy + grant for owners on calculators — but that contradicts PROJ-1's
intent and widens the RLS surface for the cron path (which also uses the admin client).

**E2E coverage:** `tests/PROJ-13-soft-delete-trash.spec.ts` reproduces the bug; the suite was left
as `test.fixme(...)` in the initial pass and was flipped back to plain `test(...)` once the fix
landed. Now green on both chromium and Mobile Safari.

**Priority:** **Fix before deployment.** Done.

#### BUG-L1 — `formatTrashFooter` never renders "Purges today" (spec divergence) — **Low**

- **Status:** **Fixed** (2026-05-24). One-line change in
  `src/components/dashboard/trash-calc-card.tsx` flipped the first
  guard from `remainingMs <= 0` to `remainingMs < 0`. The boundary
  between "today" and "any moment" now lives on `remainingMs` (the
  signed millisecond delta) instead of `remainingDays` (the ceil-
  rounded day count) — a naive order swap would have mis-classified
  *overdue* cards as "Purges today" because `Math.ceil` of a negative
  fraction-of-a-day rounds up to 0. Two boundary unit tests added in
  `src/components/dashboard/trash-calc-card.test.ts`: one pins the
  M=0 case to "today", the other pins M=−1ms to "any moment".
- **Severity (original):** Low

**Where (original):** `src/components/dashboard/trash-calc-card.tsx` line ~199.

**Repro:** A calculator whose `soft_delete_at + RETENTION_PERIOD_DAYS` lands exactly on `now()` (M=0)
shows "Purges any moment" instead of the spec'd "Purges today". The `remainingMs <= 0` branch
short-circuits before the `remainingDays === 0` branch can ever fire.

**Spec AC affected:** *"when M is 1, then the footer reads 'Purges tomorrow'; when M is 0,
'Purges today'; when M ≤ 0 (cron hasn't run yet but the window has elapsed) … the footer reads
'Purges any moment'."*

**Suggested fix (applied):** keep the original branch order but tighten
the first guard from `remainingMs <= 0` to `remainingMs < 0`. The
existing `remainingDays === 0` branch (which only fires when
`Math.ceil(remainingMs / DAY_MS)` returns 0 — i.e. exactly the M=0
instant) then carries the "today" label without misclassifying
overdue rows.

#### Notes (non-bugs, worth tracking)

- **No rate-limit on the new endpoints.** `/restore`, `?hard=true`, `/scenarios-count`, `?orphans=1`
  have no Upstash gate. PROJ-12 added a 30/min limit on `POST /api/scenarios` only. RLS scopes the
  blast radius to the caller's own rows, but a misbehaving authenticated script can spam them.
  Acceptable for v1's "single-deployer, low-volume" PRD assumption; revisit if multi-tenant volume
  picks up.

### Acceptance criteria coverage

All AC sections from the spec walked. Spot-result format: AC group → tests covering it.

| AC group | Verified by |
|---|---|
| Trash section render & ordering (slot 4) | `tests/PROJ-13` soft-delete dashboard render + manual review of `dashboard/page.tsx` slot 4 placement; `TrashSection` hide-when-empty + `defaultExpanded={false}` confirmed in source |
| `<TrashCalcCard>` visual structure | Source review against spec; `trash-calc-card.test.ts` covers the footer formatter edge cases (deleted today/yesterday/N days, purges tomorrow / any moment) |
| `<TrashCalcCard>` click behaviour | Source review — card is a `<div>` with no onClick handler; only the kebab `<button>` is interactive (verified) |
| Kebab Restore + Delete permanently order | Source review — items rendered in spec order; Delete permanently has danger text colour (`text-red-600`) |
| `POST /restore` (200, preserves published+token, collision rename, 409 stale, 404 active/cross-owner, 401 anon) | `restore/route.test.ts` (11 cases) + E2E (5 cases: happy, collision rename, restore-on-active 404, cross-owner 404, anon redirect) |
| Dashboard Restore flow (toast, refresh, hide-when-empty) | Source review of `trash-calc-card.tsx` `handleRestore`; covered indirectly by E2E that confirms the API contract the component depends on |
| `DELETE ?hard=true` (200 with orphan count, 400 not_in_trash, 409 stale, 404 missing/cross-owner, 401 anon) | Extended `[id]/route.test.ts` (8 cases) + E2E (cross-owner 404, not_in_trash 400, **BUG-H1 fixme on 200 happy path**) |
| `DELETE` without `?hard=true` still soft-deletes (PROJ-10 contract) | Extended `[id]/route.test.ts` + PROJ-10 regression suite (36/36 still passing) |
| Delete-permanently sheet copy with orphan count | Source review of `delete-permanently-sheet.tsx`; renders 0-count vs 1 vs N variants + graceful-degradation copy on count-fetch failure |
| `GET /scenarios-count` (200 count, 404 cross-owner, 401 anon, admin-client for the COUNT, no leak when ownership check fails) | `scenarios-count/route.test.ts` (6 cases) + E2E (owner returns count, cross-owner 404) |
| Cron `/api/cron/purge` (200 with real count, RETENTION_PERIOD_DAYS, FK CASCADE, scenarios survive, 401 missing/bad bearer, 500 missing secret, 500 DB error) | Extended `cron/purge/route.test.ts` (9 cases) + E2E (real purge of a backdated row leaves fresh row intact; wrong bearer → 401 + no purge) |
| Orphan-scenarios banner (count > 0 visibility, copy with singular/plural, bulk-delete confirm, success toast, hide-when-empty) | Source review of `orphan-scenarios-banner.tsx` + `my-scenarios-section.tsx`; covered by `DELETE ?orphans=1` E2E that the banner triggers |
| `DELETE /api/scenarios?orphans=1` (caller-scoped, deletes only orphans, 401 anon, 400 invalid_request without flag, 500 on DB error) | Extended `scenarios/route.test.ts` (6 cases) + E2E (verifies stranger's orphan is preserved, live scenario is preserved) |
| Title uniqueness on restore (auto-suffix, 100-attempt cap → 500) | `restore/route.test.ts` covers collision auto-resolve and resolveUniqueTitle failure surface |
| Security & RLS (401 unauthenticated; 404 cross-owner across all 4 new endpoints; bulk-delete owner-scoped; cron uses admin client; constant-time bearer) | Mix of unit + E2E (cross-owner restore 404, cross-owner hard-delete 404, cross-owner scenarios-count 404, anon mutation 401/redirect, cron wrong-bearer 401 with no DB effect) |

### Security audit

Red-team checklist walked, all PASS except where noted:

| Check | Result |
|---|---|
| 401 on all new endpoints when unauthenticated | PASS |
| 404 cross-owner (opacity, never 403) | PASS — unit + E2E |
| Admin client only used where intended (cron purge, cross-owner orphan COUNT inside ownership-gated routes) | PASS — `scenarios-count` and `?hard=true` orphan-count both run the user-scoped ownership SELECT first; cron purge has bearer-token auth |
| User-scoped client honours RLS on `restore`, `scenarios-count`, `bulk-delete-orphans` | PASS — uses `createClient` (cookie-bound publishable key) |
| Cron bearer constant-time compare | PASS — `timingSafeEqual` with length-mismatch short-circuit |
| CRON_SECRET missing → fail-closed 500 | PASS |
| Input strip-validation (no key smuggling) | PASS — `restoreSchema` / `deleteSchema` use `.strip()` |
| No secret/token leak in responses | PASS — restore returns owner's own row (intentional); scenarios-count returns integer only; hard-delete returns integer only; bulk-delete-orphans returns integer only |
| SQL injection via UUIDs | PASS — Supabase parameterised queries throughout; no string interpolation into SQL |
| XSS via title (toast, card render) | PASS — React escapes; Sonner escapes |
| Hard-delete two-step gate (`not_in_trash` on active rows) | PASS — unit + E2E |
| Bulk-delete-orphans scoped to caller's `owner_id` AND `calculator_id IS NULL` | PASS — E2E confirms a stranger's orphan is left untouched |
| Anonymous requests to new endpoints do not return JSON success payloads | PASS — E2E with `maxRedirects: 0` confirms 401/redirect statuses |

### Regression checks

- PROJ-1 cron stub tests → still passing (cron handler body now real, contract preserved).
- PROJ-10 calculator lifecycle (publish, soft-delete, regenerate-token, duplicate, cross-owner opacity) → 22/22 still passing.
- PROJ-12 scenarios (save/load/share/drift/XSS/dashboard/copy-link) → 14/14 still passing.
- PROJ-5 dashboard (My Calculators slot, hide-when-empty, presets) — unaffected by the new slot-4 wiring.

### Files added during QA

- `src/app/api/calculators/[id]/restore/route.test.ts` (11 unit tests, NEW)
- `src/app/api/calculators/[id]/scenarios-count/route.test.ts` (6 unit tests, NEW)
- `src/app/api/calculators/[id]/route.test.ts` — extended with 8 unit tests for `?hard=true`
- `src/app/api/scenarios/route.test.ts` — extended with 6 unit tests for `?orphans=1`
- `src/components/dashboard/trash-calc-card.test.ts` (6 unit tests for the footer formatter, NEW)
- `tests/PROJ-13-soft-delete-trash.spec.ts` (15 Playwright E2E tests, 1 `.fixme` blocked on BUG-H1)
- `src/app/api/calculators/test-helpers.ts` + `src/app/api/scenarios/test-helpers.ts` — extended the
  fluent-chain mock with `.not()` to match the new route shapes.

### Production-ready decision

**READY.** Both bugs from the initial pass are fixed and re-verified end-to-end.

- **Acceptance Criteria:** 49/49 passed after BUG-H1 + BUG-L1 fixes. The previously-fixme'd
  hard-delete E2E is back to plain `test(...)` and green on both chromium and Mobile Safari.
- **Bugs found (total across both QA passes):** **1 High (Fixed — BUG-H1), 1 Low (Fixed — BUG-L1).**
  No Critical, no Medium, no open bugs.
- **Security:** Pass. The BUG-H1 fix doesn't widen the RLS surface — the cron path was already
  using the admin client; the hard-delete handler now matches that pattern, with ownership still
  proven up-front by the user-scoped SELECT.
- **Recommendation:** Status moves to **Approved**. Next step: Run `/deploy` to ship PROJ-13.

### Re-run log (2026-05-24, post BUG-H1 + BUG-L1 fixes)

- `npm test` → **704/704 passed** (71 files, ~9.5s). +2 over the initial pass:
  - `src/components/dashboard/trash-calc-card.test.ts` now pins both the M=0 ("Purges today")
    and the M=−1ms ("Purges any moment") boundaries.
  - `src/app/api/calculators/[id]/route.test.ts` hard-delete happy-path now asserts the DELETE
    runs against the admin builder and the user-scoped client never calls `.delete()`.
- `npx playwright test tests/PROJ-13-soft-delete-trash.spec.ts` →
  **30/30 passed** across chromium + Mobile Safari (~32s). The BUG-H1-blocked scenario
  (`DELETE ?hard=true hard-deletes a trashed row and returns the orphan count`) is green on both
  browsers without any `.fixme`.
- `npx playwright test tests/PROJ-1-cron-purge.spec.ts tests/PROJ-10-calculator-lifecycle.spec.ts
  tests/PROJ-12-scenarios.spec.ts --project=chromium` → **36/36 passed** (~25s). No regressions
  in the related cron / lifecycle / scenarios surfaces.
- No new bugs surfaced during the re-run; no migration touched; no env var changes.

## Deployment

**Date:** 2026-05-24
**Production URL:** https://calcgrinder.vercel.app
**Deploy commit:** `86f505c` (feat) + the deploy commit that
follows this section (status flip + tag).
**Git tag:** `v1.13.0-PROJ-13`
**Deployer:** /deploy (Claude)

### Pre-deployment checks

- `npm run build` → clean (TypeScript + 17 static pages
  generated; new routes `/api/calculators/[id]/restore`,
  `/api/calculators/[id]/scenarios-count`, `/api/cron/purge`
  listed in the Route map).
- `npm run lint` → 0 errors, 5 pre-existing warnings
  unrelated to PROJ-13 (formula engine + PROJ-11 leftovers).
- `npm test` (recorded in QA section) → 704/704 pass.
- Playwright E2E (recorded in QA section) → 30/30 pass.
- Regression suites (PROJ-1 / PROJ-10 / PROJ-12) →
  36/36 pass.
- QA status: **Approved** (49/49 AC pass; BUG-H1 + BUG-L1
  fixed and re-verified).
- No new env vars; no new migration; no schema change.
- `vercel.json` cron (`0 4 * * *` → `/api/cron/purge`)
  unchanged — Vercel auto-picks up the new handler body.

### Deploy flow

1. `feat(PROJ-13)` commit `86f505c` pushed to `origin/main`.
2. Vercel GitHub integration auto-built and deployed.
3. GitHub commit-status API reported `state: "success"`,
   description "Deployment has completed", deployment URL
   `https://vercel.com/voidforge-projects/calcgrinder/6iXWhJLS1b1XBR6svjsZoNqwk8w3`.

### Post-deployment smoke tests

All performed against https://calcgrinder.vercel.app
immediately after Vercel reported deployment-success:

| Endpoint | Probe | Expected | Actual |
|---|---|---|---|
| `GET /api/cron/purge` (no bearer) | unauth | 401 | 401 ✓ |
| `GET /api/cron/purge` (empty `Bearer `) | unauth | 401 | 401 ✓ |
| `GET /api/cron/purge` (wrong bearer) | constant-time mismatch | 401 | 401 ✓ |
| `POST /api/calculators/<uuid>/restore` | unauth | 307 → `/auth/login` | 307 ✓ |
| `GET /api/calculators/<uuid>/scenarios-count` | unauth | 307 → `/auth/login` | 307 ✓ |
| `DELETE /api/scenarios?orphans=1` | unauth | 307 → `/auth/login` | 307 ✓ |
| `GET /` | unauth | 307 → `/auth/login` | 307 ✓ |
| `GET /dashboard` | unauth | 307 → `/auth/login` | 307 ✓ |

No 5xx anywhere; all auth gates fire before any handler
side-effect; cron bearer-auth contract from PROJ-1
preserved exactly.

### Cron next-run notes

The daily auto-purge cron runs at `0 4 * * *` UTC (per
`vercel.json`). The first execution carrying the PROJ-13
body fires on the next scheduled tick after deployment — no
manual step required. The handler returns
`{ ok: true, purged: <count>, retention_days: 30 }`; for the
first few days `<count>` may be 0 if no calculators
soft-deleted before today have aged past 30 days yet.

### Rollback plan

If a regression surfaces in production:
1. Vercel Dashboard → Deployments → promote the prior
   deployment (PROJ-12 deploy commit `0744d13`) to
   production. Estimated time-to-rollback: < 30s.
2. The cron picks up the rolled-back handler on its next
   scheduled run (returning to the PROJ-1 stub's `purged: 0`
   shape — no DB rows are touched in the stub).
3. No schema rollback needed: PROJ-13 added no migrations.
4. No env-var rollback needed: PROJ-13 added no env vars.
5. Soft-deleted rows that were created since the deploy
   remain in `calculators.soft_delete_at IS NOT NULL` — they
   simply stop being visible in Trash UI (the rolled-back
   build has no Trash section) but are otherwise untouched.

### Production-ready essentials

- Error tracking: out of scope for this deploy; see
  `docs/production/error-tracking.md` for the standing Sentry
  setup that already covers the production deployment.
- Security headers: already configured in `next.config` from
  prior deploys; no PROJ-13 changes needed.
- Rate limiting: PROJ-13's four new routes intentionally have
  no Upstash gate (per QA "Notes" — acceptable for v1's
  single-deployer assumption; RLS scopes the blast radius to
  the caller's own rows). Revisit if multi-tenant volume
  picks up.
