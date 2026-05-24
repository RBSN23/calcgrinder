# PROJ-12: Scenarios — Save, Load, Share

## Status: Deployed
**Created:** 2026-05-24
**Last Updated:** 2026-05-24

## Dependencies

- **PROJ-3** Authentication & Account Approval Flow — the
  signed-in / approved-status branch is the gate between
  anonymous localStorage saves and server-side scenarios.
- **PROJ-5** Account Dashboard — PROJ-5 reserved the
  "My Scenarios" slot (second in the section order, hidden
  when empty per PROJ-5 line 188 / 451). PROJ-12 fills it.
- **PROJ-7** Formula Engine — scenario apply reuses the
  same input → recompute pipeline; structure-drift skips
  feed into the engine's existing error-propagation
  contract.
- **PROJ-9** Cell Authoring & Section Management — scenarios
  store values keyed by **cell name** (the user-meaningful
  stable identifier PROJ-9 enforces uniqueness on). The
  per-field lock toggle replaces the Builder's edit-icon
  slot in each `<CellCard>`.
- **PROJ-10** Calculator Lifecycle — provides `public_token`
  and `soft_delete_at`. Scenario URLs (`/c/<calc-token>?s=
  <scenario-token>`) inherit PROJ-10's token-as-access-
  control model. Token regeneration breaks old scenario URLs
  for the same reasons it breaks bare calculator URLs (the
  calc-token no longer matches a row — 404).
- **PROJ-11** Visitor View — provides the public render
  shell, the `<InteractivityContext>` boundary, the
  `<VisitorInputStore>` seam, the visitor header / footer,
  the rate-limit middleware, and the `?s=` query parameter
  which PROJ-11 explicitly ignores so PROJ-12 can bind it
  here. PROJ-12 extends, never re-architects, this surface.

## User Stories

- **As a visitor (anonymous or registered) exploring a
  calculator**, I want to save the current set of inputs
  as a named, described **scenario** so I can come back to
  the same set of values later.
- **As a registered visitor**, I want to share a scenario
  via a URL so that the recipient lands on the calculator
  with my exact inputs pre-applied, sees a header saying
  who saved it and when, and can play with the values
  without breaking my saved state for anyone else.
- **As a recipient of a shared scenario URL**, I want input
  cards locked by default so I can read the scenario as the
  author intended, and I want a one-tap padlock per field
  to unlock the ones I want to vary.
- **As a scenario owner viewing my own scenario via its
  URL**, I want a clear "(modified)" indicator and a Reset
  button when I've changed values, so I can tell whether
  I'm looking at the original saved state or my in-flight
  exploration.
- **As an anonymous visitor who saved scenarios to my
  browser, then signed up**, I want my saved scenarios to
  appear in my new account automatically — without manual
  import — so the act of signing up doesn't cost me my
  work.
- **As a registered visitor**, I want a "My Scenarios"
  section on my dashboard listing every scenario I've
  saved across all calculators, with a clear path to open
  it for editing or to copy its share link.
- **As a recipient of a scenario URL where the calculator
  has been edited since the scenario was saved**, I want a
  clear non-modal banner telling me that some saved values
  couldn't be applied because the calculator changed —
  rather than silently seeing values different from what
  I'd expect.
- **As a recipient of a scenario URL whose scenario was
  deleted, whose calculator was soft-deleted, or whose
  calculator was hard-deleted**, I want a clean error page
  consistent with PROJ-11's existing visitor-side error
  copy, not a broken UI.

## Out of Scope

PROJ-12 ships the scenario CRUD, share, and load surface
end-to-end for the visitor surface and the dashboard's
**My Scenarios** section. Adjacent surfaces are owned
elsewhere:

- **Orphan scenarios dashboard surface for scenario
  OWNERS** — the "your calculator was deleted, here are
  your N orphan scenarios" page, the per-scenario clone
  option while the calculator is still in its recovery
  window, and the bulk-delete-orphans flow after the
  calculator is finally purged. Owned by **PROJ-13**
  (Soft-Delete & Trash Recovery). PROJ-12 only handles the
  **visitor-side** response when someone loads an orphan
  scenario URL: the same 404 / 410 pages PROJ-11 already
  ships, no special copy.
- **Cross-user clone attribution / cloning a scenario into
  a different calculator.** Cloning is **PROJ-18**. PROJ-12
  scenarios are 1:1 bound to one calculator instance per
  spec line 961.
- **Compare Mode** — side-by-side overlay of two scenarios.
  Post-v1 per PRD non-goals.
- **Search / filter on the My Scenarios list.** v1 ships
  a flat list ordered by saved-date desc. If a power user
  ever has hundreds of scenarios, we'll add filter then.
- **Pagination of the My Scenarios list.** v1 fetches all
  the user's scenarios in one query. Volume assumption per
  PRD: tens-to-hundreds of users, tens of scenarios per
  user max.
- **Per-user / per-calculator scenario count cap.** No
  enforcement in v1. If abuse surfaces, we add.
- **Scenario URL token regeneration / revocation.** Per
  PRD non-goals: "Public scenario URL regeneration /
  revocation — once a scenario's share token is minted, it
  persists for the scenario's lifetime. To revoke, delete
  the scenario."
- **Multi-token sharing per scenario.** One `share_token`
  per scenario row, period.
- **Markdown / rich-text in scenario description.** Plain
  text with preserved newlines. No `<a>` href injection,
  no list rendering. Markdown for cell descriptions and
  text-blocks is PROJ-16's scope.
- **An in-scenario "Reset to original calculator defaults"
  affordance.** Per spec line 1099: "To return to original
  calculator defaults from a scenario URL, the visitor
  reloads the calculator without the scenario URL
  parameters." Reset restores to *initial-loaded* state
  (scenario values for `?s=` URLs; defaults for bare
  URLs), not cross-state.
- **Per-cell lock state PERSISTENCE across reloads.** Locks
  are an ephemeral per-page-load UX. Reload → defaults
  re-apply.
- **Server-side rate-limit on SAVE / LAZY-MINT endpoints
  beyond the global authenticated-user budget.** PROJ-11's
  ~60 req/min/IP page-load limit doesn't apply to
  authenticated POSTs. PROJ-12 commits to a separate
  modest per-user budget (~30 saves/min/user), via the
  same Upstash client. Tuning beyond v1 = post-v1.
- **OWNERSHIP transfer of scenarios.** Scenarios are owned
  by the user who created them. No transfer in v1.
- **EXPORT / IMPORT of scenarios as JSON.** Calculator
  JSON export is PROJ-22; scenarios are not part of that
  scope.
- **Settings / notifications for scenario events** (e.g.
  "you have N orphan scenarios"). No background email or
  in-app notification machinery; the dashboard surfacing
  is the only signal.
- **Sysadmin moderation of user scenarios.** Sysadmin
  moderation in PROJ-19 covers calculators, not personal
  scenarios. Scenarios are always private to their owner.
- **Owner-Edit-button "open with locks already unlocked"
  shortcut.** Per the Decision Log: dropped in favour of
  the simpler "every `?s=` URL renders identically; locks
  default closed for everyone including the owner" model.
  The dashboard's Edit vs Public-view buttons differ
  ONLY in `target="_self"` vs `target="_blank"`. No
  `&edit=1` query flag.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Data model & RLS

- [ ] Given the migration runs, when the `scenarios` table is
  created, then it has columns `id (uuid pk)`,
  `calculator_id (uuid fk → calculators.id)`,
  `owner_id (uuid fk → auth.users.id)`,
  `title (text, not null, length ≤ 200)`,
  `description (text, default '')`,
  `values (jsonb, not null, default '{}'::jsonb)`,
  `share_token (text, nullable, unique when not null)`,
  `created_at`, `updated_at` (both `timestamptz default now()`).
- [ ] Given the migration runs, when RLS is enabled on
  `scenarios`, then policies allow:
  `SELECT/INSERT/UPDATE/DELETE` only for rows where
  `owner_id = auth.uid()` (the saving user is the only one
  with table-row access; public read is via the
  SECURITY-DEFINER RPC by `share_token`).
- [ ] Given a scenario row exists, when it is read via the
  `fn_get_scenario_by_share_token(text)` SECURITY-DEFINER
  RPC (granted to `anon, authenticated`), then the function
  returns the scenario joined with its parent calculator's
  current state (title, description, sections, cells —
  same JSON shape `fn_get_public_calculator` returns), so
  the visitor page hits one round-trip for the scenario
  case.
- [ ] Given the parent calculator's row is hard-deleted
  (sysadmin "Delete permanently" or auto-purge),
  when Postgres processes the delete, then scenarios are
  **NOT** cascade-deleted — they remain as orphan rows
  per spec line 468–470 ("Hard-delete... does NOT cascade-
  delete scenarios"). The FK is `ON DELETE SET NULL` on
  `calculator_id`, OR scenarios use a deferred FK that
  permits dangling references — implementer's call;
  surface in /architecture.
- [ ] Given the scenario's owner row in `profiles` is
  deleted (post-v1 account-deletion), when the deletion
  runs, then their scenarios cascade-delete (`ON DELETE
  CASCADE` on `owner_id`). Out-of-scope to test in PROJ-12
  itself but the FK shape must be right.
- [ ] Given index `(owner_id, updated_at desc)` exists on
  `scenarios`, when the dashboard fetches a user's
  scenarios, then the query uses the index (sub-100ms
  for ≤1000 rows per user).
- [ ] Given index `(share_token)` exists, when the
  `fn_get_scenario_by_share_token` RPC runs, then the
  lookup is index-only.

### Save Scenario sheet — invocation & layout

- [ ] Given the visitor (anonymous or registered) loads
  `/c/<token>` (with or without `?s=`), when the visitor
  header renders, then a Save Scenario icon button appears
  in the header (left of the Log in / Sign up buttons for
  anonymous, left of the avatar for registered). Visible
  from page-load; visibility is NOT gated on whether any
  input has been changed.
- [ ] Given the visitor clicks the Save Scenario icon,
  when the click fires, then a Save Scenario sheet opens:
  bottom-sheet on mobile (viewport ≤ md), centered dialog
  on desktop. (Match PROJ-9's existing primitive — extract
  if not yet shared.)
- [ ] Given the Save Scenario sheet opens, when the sheet
  renders, then it contains:
  - A title input field (mandatory, max 200 chars), focused
    on open.
  - A description textarea (optional, multi-line, max 2000
    chars, preserves newlines on save).
  - A scrollable list of the user's existing scenarios for
    the current calculator (server-side rows for registered
    users; localStorage rows for anonymous users), most-
    recently-saved first.
  - A primary Save button (label = "Save"; switches to
    "Overwrite" when a row in the existing-list is
    selected).
  - A Cancel / dismiss control.
- [ ] Given the visitor opens the Save Scenario sheet while
  viewing a `?s=<token>` URL whose scenario is one of
  their own, when the sheet renders, then that scenario's
  row is **pre-selected** in the existing-list (and marked
  with a "(current)" suffix), the title/description fields
  are pre-filled from that scenario, and the Save button
  reads "Overwrite".
- [ ] Given the visitor taps a row in the existing-list,
  when the tap fires, then THREE things happen at once:
  1. The scenario's saved values are loaded into the
     calculator inputs (so the visitor can see what they're
     about to overwrite).
  2. The row is selected (title + description fields update
     to that scenario's title + description).
  3. The Save button label changes to "Overwrite".
- [ ] Given the visitor has tapped a row to load + select
  it, when they then type a new title that doesn't match
  the selected row's title, then the row de-selects
  automatically (the act of typing a different title is an
  implicit "create new"). The Save button reverts to
  "Save". Calculator inputs remain at the loaded values.
- [ ] Given the existing-list is empty (first save for
  this calculator), when the sheet renders, then the list
  area shows muted copy "No saved scenarios yet" and the
  Save button shows "Save" by default.
- [ ] Given the visitor leaves the title field empty,
  when they press Save, then the Save button is disabled
  and a muted helper "Title is required" appears under
  the title field.
- [ ] Given the visitor types more than 200 chars in the
  title or more than 2000 chars in the description, when
  they exceed the limit, then the field shows a red
  character-count helper and Save is disabled.

### Save flow — anonymous (localStorage)

- [ ] Given the visitor is anonymous (no session or
  status ≠ approved), when they press Save in the sheet,
  then the scenario is persisted to localStorage under key
  `cg:scenarios:<calculator-public-token>` (an array of
  `{ id, title, description, values, saved_at }`
  records — `id` is a client-generated UUID, never
  reused on the server). NO network request fires.
- [ ] Given the localStorage write succeeds, when the
  Save completes, then the sheet closes, a toast shows
  "Scenario saved to this browser", and the existing-list
  on the next sheet-open includes the new row.
- [ ] Given the visitor presses Save with a title that
  matches an existing localStorage row exactly (and they
  tapped that row to overwrite), when the save completes,
  then the existing row is overwritten in place (same `id`,
  updated `values` / `description` / `saved_at`). The toast
  reads "Scenario overwritten".
- [ ] Given the visitor is anonymous, when the Save
  Scenario sheet renders, then NO "Copy link" affordance
  appears for any existing-list row, AND no "Copy link"
  affordance appears on the saved-toast. Anonymous saves
  cannot be shared until the user signs in.
- [ ] Given a `QuotaExceededError` is thrown by
  localStorage on save (e.g. 5MB quota hit), when the
  save fails, then the sheet shows an inline error
  "Browser storage full — sign up for an account to save
  more scenarios" and surfaces a "Sign up" CTA inline. No
  data loss to existing localStorage rows.

### Save flow — registered (server)

- [ ] Given the visitor is registered + approved, when
  they press Save in the sheet (no existing row selected),
  then a POST to `/api/scenarios` creates a new row with
  `owner_id = auth.uid()`, `calculator_id =
  <current calc id>`, `title`, `description`, `values =
  <current input snapshot>`, `share_token = null`. The
  response includes the new row id.
- [ ] Given the visitor is registered + approved AND they
  selected an existing row in the sheet, when they press
  Overwrite, then a PUT to `/api/scenarios/<id>` updates
  `title`, `description`, `values` in place. `share_token`
  is left untouched (if previously minted, it stays
  minted; recipients keep their working link). `updated_at`
  refreshes.
- [ ] Given the server save succeeds, when the response
  returns, then the sheet closes, a toast shows
  "Scenario saved" (or "Overwritten") with a "Copy link"
  action button on the toast.
- [ ] Given the server returns a validation error (e.g.
  duplicate-title constraint — see Decision Log, NOT
  enforced in v1), when the sheet receives the error,
  then the sheet stays open and shows an inline error
  message. No data loss.
- [ ] Given the server is unreachable, when the visitor
  presses Save, then a retry-with-exponential-backoff
  fires once; on second failure, the sheet shows
  "Couldn't save — please try again". Input values stay
  in the visitor's session (no loss).
- [ ] Given a registered user is hitting the save endpoint
  more than ~30 times in any 60-second window, when the
  next save lands, then the server responds 429 and the
  sheet shows "Slow down — try again in a minute". Uses
  the same Upstash client PROJ-11 introduced. Fail-open on
  Upstash outage.

### Anonymous → registered migration

- [ ] Given a signed-in approved user loads any page in
  the `(public)` route group (i.e. the visitor surface),
  when the page mounts, then a client-side migration
  helper inspects `localStorage` for keys matching
  `cg:scenarios:*`. If any rows exist, the helper POSTs
  them to `/api/scenarios/migrate` (a server endpoint
  that creates rows owned by the current user) and then
  clears those localStorage keys.
- [ ] Given the migration helper has no scenarios to
  migrate, when it runs, then it is a no-op (no network
  request, no UI change).
- [ ] Given the migration POSTs a scenario whose title
  collides with an existing server-side scenario for the
  same `(owner_id, calculator_id)`, when the server
  processes the insert, then the title is suffixed with
  ` (2)` (or ` (3)`, etc., next available) and the row is
  inserted. No data is lost; no overwrite.
- [ ] Given the migration POSTs a scenario whose
  `calculator_id` is unknown (calculator was hard-deleted
  in the meantime), when the server processes the insert,
  then the migrate endpoint **silently skips** that
  scenario (rather than orphan-from-birth). The
  localStorage row is still cleared.
- [ ] Given the migration completes, when the migration
  succeeds, then a single small toast surfaces:
  "Imported N scenarios from this browser." Silent if N=0
  (suppress the toast entirely).
- [ ] Given a user is signed in across multiple browsers,
  when they later open Browser A (which still has
  un-migrated localStorage scenarios) while signed in,
  then the migration helper runs on that page-load and
  migrates them. No first-login-only gating — every
  authenticated visitor-page-load checks.
- [ ] Given the migration POST fails (network or 500),
  when the response comes back, then localStorage rows
  are NOT cleared (preserve for a future retry). A muted
  toast reads "Couldn't import scenarios — will retry
  later." Next page-load tries again.

### Scenario URL loading (`?s=<scenario-token>`)

- [ ] Given a `?s=<token>` query parameter is present AND
  matches a scenario row whose `calculator_id` matches the
  current calculator's `public_token`, when the page
  renders, then the calculator inputs are pre-populated
  from the scenario's `values`, all per-field locks default
  to **closed**, and the scenario header block renders
  above the first content section.
- [ ] Given a `?s=<token>` query parameter is present but
  no scenario row matches the token, when the page
  renders, then the server returns HTTP 404 with the
  "Scenario not found" copy of the visitor 404 page
  (`<EmptyOrErrorState variant="error">`). Per spec line
  1048, this is the whole-page 404; we do NOT silently
  strip the param and render the bare calculator.
- [ ] Given a `?s=<token>` query parameter is present AND
  matches a scenario row, but the matched scenario's
  `calculator_id` does NOT match the `public_token` in the
  URL path (cross-calc URL forge attempt), when the page
  renders, then the server returns HTTP 404 with the same
  "Scenario not found" copy. Tokens are bound to their
  parent calculator.
- [ ] Given the parent calculator is soft-deleted
  (`soft_delete_at IS NOT NULL`) AND a `?s=<token>` is
  present, when the page renders, then the server
  returns HTTP 410 — the standard calculator-unavailable
  page from PROJ-11. The scenario token is irrelevant; the
  calculator-level state takes precedence per spec line
  1049.
- [ ] Given the parent calculator is hard-deleted, when
  a visitor loads `/c/<token>?s=<scenario-token>`, then
  the server returns 404 (calculator's token no longer
  matches any row; PROJ-11 behaviour). Even if the orphan
  scenario row still exists, the visitor surface returns
  404 — orphan management is dashboard-only (PROJ-13).
- [ ] Given the calculator's `public_token` was
  regenerated AND someone loads the old URL with `?s=`,
  when the server resolves the token, then PROJ-11's bare-
  URL 404 path fires (old calc-token matches no row); the
  scenario-token lookup is short-circuited.
- [ ] Given a `?s=<token>` URL loads successfully, when
  the page metadata renders, then `<title>` is
  `<calculator title> — Calcgrinder` (same as bare URL —
  do NOT leak the scenario's title into the public meta;
  it could expose data the scenario author shared with a
  narrow audience).

### Scenario header block

- [ ] Given a scenario URL renders successfully (200),
  when the page renders, then a scenario header block
  appears in the DOM between the calculator hero
  (title + description) and the first content section,
  with: scenario title (semibold), optional description
  (muted body text, preserved newlines), and a
  "by <profiles.name> · saved <relative date>" sub-line.
- [ ] Given the scenario has an empty description, when
  the header renders, then the description line is
  omitted (not "Add a description" placeholder).
- [ ] Given the signed-in user is the scenario's owner,
  when the scenario header renders, then a small
  "Copy link" icon button appears at the right of the
  header. Click triggers the lazy-mint flow (see Sharing).
- [ ] Given the visitor is anonymous or is a registered
  user who is NOT the scenario's owner, when the scenario
  header renders, then no Copy link affordance appears.
  (They can still re-share by copying the URL from the
  address bar.)
- [ ] Given the visitor's "(modified)" condition is true
  (see Modified Indicator), when the scenario header
  renders, then a " (modified)" suffix in muted italic
  appears next to the scenario title, and the description
  below greys to ~60% opacity (per spec line 1086).

### Structure-drift handling

- [ ] Given the scenario's `values` map contains a key
  for a cell name that no longer exists in the current
  calculator (renamed or removed), when the scenario is
  applied, then that key is silently skipped (not assigned
  to any cell, no error message per cell).
- [ ] Given the scenario's `values` map contains a value
  for a cell whose `value_type` has changed since save
  (e.g. number → currency), when the scenario is applied,
  then that value is silently skipped and the cell uses
  the calculator's current default. The `value_type`
  match is strict.
- [ ] Given the scenario's `values` map is missing a key
  for a cell that exists in the calculator now (cell
  added after scenario save), when the scenario is
  applied, then the cell uses the calculator's current
  default value. This case does NOT trigger the drift
  banner.
- [ ] Given any value was skipped due to rename / removal
  / type-change (NOT due to missing keys for new cells),
  when the page renders, then a non-modal dismissible
  banner appears above the scenario header block:
  > "Some of this scenario's values couldn't be applied
  > because the calculator was updated."
  with a small "Dismiss" close button on the right.
- [ ] Given the visitor dismisses the structure-drift
  banner, when the dismiss fires, then the banner
  disappears for the current page-load only. Reload
  re-applies the banner (no persistence of dismissal —
  per Decision Log).
- [ ] Given the visitor unlocks a cell and changes its
  value, when the change fires, then the structure-drift
  banner state is independent of the modified state —
  banner stays / dismisses on its own logic; the
  "(modified)" indicator on the scenario header flips on
  its own logic.

### Per-field lock mechanism

- [ ] Given the visitor is on a bare `/c/<token>` URL
  (no `?s=`), when an editable Input cell renders, then
  the per-field lock toggle in the top-right of the card
  is in the **open** padlock state (initial). The
  Builder's edit-icon slot is replaced by this lock icon.
- [ ] Given the visitor is on a `/c/<token>?s=<token>`
  URL, when an editable Input cell renders, then the
  per-field lock toggle is in the **closed** padlock
  state (initial).
- [ ] Given the lock is in the closed state, when the
  visitor taps the input widget (slider thumb, number
  field, select), then no interaction fires — the widget
  is non-interactive. No auto-unlock, no toast.
- [ ] Given the lock is in the closed state, when the
  visitor taps the padlock icon itself, then the lock
  toggles to open and the widget becomes interactive on
  the next event.
- [ ] Given the lock is in the open state, when the
  visitor taps the padlock icon, then the lock toggles
  to closed and the widget becomes non-interactive.
- [ ] Given a cell has `editability = readonly` (Inputs
  set readonly, all Outputs by default), when the page
  renders, then the lock toggle is NOT rendered on that
  card. Readonly cells are always non-interactive
  regardless of lock state.
- [ ] Given a cell has `editability = editable` AND
  `visibility = hidden`, when the page renders, then no
  lock toggle is rendered (the cell itself produces no
  DOM per PROJ-11).
- [ ] Given an Output cell with `editability = editable`
  (an Output the visitor can override per PROJ-9), when
  the page renders, then the lock toggle is rendered the
  same as for editable Inputs (open by default on bare
  URLs, closed by default on `?s=` URLs).
- [ ] Given the visitor reloads the page (`/c/<token>?s=
  <token>`), when the page re-renders, then all locks
  reset to the URL-derived default (closed for `?s=`
  URLs, open for bare URLs). No lock state persistence
  across reloads.
- [ ] Given a slider widget is locked (closed padlock),
  when the slider renders, then the track and thumb
  desaturate to ~40% opacity per spec line 1070; the
  numeric value above stays full opacity.
- [ ] Given a number / currency / percent input is locked,
  when the field renders, then the input is non-
  interactive; the value text stays full opacity (no
  desaturation — would read as placeholder per spec line
  1073).
- [ ] Given a toggle / radio / dropdown widget is locked,
  when the widget renders, then it is non-interactive
  and slightly desaturated per spec line 1075.
- [ ] Given any locked widget renders, when the card
  renders, then no border / outline change appears — the
  card's overall composition is unaffected.

### Modified indicator + Reset button

- [ ] Given the visitor is on a bare `/c/<token>` URL,
  when no Input cell value has been changed from the
  calculator's defaults, then no Reset button appears
  next to the calculator title.
- [ ] Given the visitor is on a `/c/<token>?s=<token>`
  URL, when no Input cell value has been changed from
  the loaded scenario state, then no Reset button
  appears AND no "(modified)" suffix appears on the
  scenario header.
- [ ] Given the visitor on a `?s=` URL unlocks a cell
  and changes its value to differ from the scenario's
  saved value, when the change commits, then the
  scenario header gets a " (modified)" suffix in muted
  italic, the description below greys to ~60% opacity,
  AND a Reset button (text label "Reset", anchored to
  the right of the calculator title) appears.
- [ ] Given the visitor on a bare URL changes any
  Input cell value to differ from the calculator's
  default, when the change commits, then a Reset
  button appears anchored to the calculator title (no
  "(modified)" suffix because there's no scenario
  header).
- [ ] Given the Reset button is visible on a `?s=` URL,
  when the visitor clicks Reset, then ALL Input cell
  values restore to the scenario's loaded values AND all
  per-field locks re-close to the URL-derived default
  (closed). The Reset button hides and the "(modified)"
  suffix disappears.
- [ ] Given the Reset button is visible on a bare URL,
  when the visitor clicks Reset, then ALL Input cell
  values restore to the calculator's current defaults
  AND all per-field locks re-open to the URL-derived
  default (open). The Reset button hides.
- [ ] Given the visitor changes a value, then changes it
  BACK to match the loaded state exactly, when the
  recompute settles, then the Reset button hides and
  the "(modified)" suffix disappears (modified condition
  is derived, not latched).

### Sharing — lazy share-token mint

- [ ] Given a scenario row has `share_token = null`, when
  the owner presses any "Copy link" affordance for the
  first time (My Scenarios row kebab, scenario header on
  the visitor view, Save Scenario sheet existing-list
  row's per-row action, or the post-save toast's "Copy
  link" button), then the server mints a 22-char base64url
  unique token, persists it on the scenario row, and
  returns the full URL
  `<origin>/c/<calc-public-token>?s=<share_token>`. The
  URL is then copied to the visitor's clipboard.
- [ ] Given a scenario row already has a `share_token`,
  when the owner presses Copy link, then the server
  reuses the existing token (no new mint) and returns the
  same URL. Idempotent.
- [ ] Given the clipboard copy succeeds, when the action
  completes, then a small toast reads "Link copied to
  clipboard".
- [ ] Given a scenario's parent calculator's
  `public_token` was regenerated since the scenario's
  share-token was minted, when the owner presses Copy
  link, then the URL composed includes the current
  `public_token` (not the stale one — the mint endpoint
  resolves the calculator's current token on every press).
  Previously-distributed URLs containing the old token
  are broken; the owner needs to redistribute.
- [ ] Given the share_token mint endpoint is called by a
  user who is NOT the scenario's owner, when the request
  lands, then the server returns 403 Forbidden. (Defence
  in depth — RLS already prevents the UPDATE; the
  endpoint adds an explicit check.)
- [ ] Given Copy link is pressed in a context where the
  Clipboard API is unavailable (older browser, insecure
  context), when the copy attempts, then a fallback
  toast shows "Couldn't copy — long-press the URL"
  with the URL visible inline for manual selection.

### "Copy link" surface placements

- [ ] Given the scenario row in the My Scenarios
  dashboard list has its kebab menu opened, when the
  menu renders for a row the user owns (always, since
  the dashboard list shows only the user's own
  scenarios), then "Copy link" is the first item in the
  kebab.
- [ ] Given the Save Scenario sheet renders for a
  registered user with at least one existing scenario in
  the list, when each row renders, then a small Copy-link
  icon appears at the right of the row (alongside the
  saved-date). Anonymous users see no per-row Copy link.
- [ ] Given the visitor view's scenario header renders
  AND the signed-in user owns the scenario, when the
  header renders, then a Copy link icon button appears
  in the right of the scenario header (alongside any
  "(modified)" suffix).
- [ ] Given a server-side save / overwrite succeeded for
  a registered user, when the success toast renders,
  then it includes a "Copy link" action button. Pressing
  it triggers the lazy-mint + copy flow.

### My Scenarios dashboard list

- [ ] Given the signed-in approved user lands on
  `/dashboard` AND has zero scenarios, when the dashboard
  renders, then the My Scenarios section does NOT render
  (no header, no count pill, no placeholder card).
  Hide-when-empty per PROJ-5 line 188 / 1812.
- [ ] Given the signed-in approved user lands on
  `/dashboard` AND has ≥1 scenarios, when the dashboard
  renders, then the My Scenarios section renders in the
  second slot (My Calculators → My Scenarios → Presets
  → ...) per PROJ-5 line 192 ordering.
- [ ] Given the My Scenarios section renders, when the
  list renders, then each scenario is one **row** (not
  a card) showing: scenario title (link), parent
  calculator title (sub-label), "saved <relative date>"
  on the right, and two row-buttons (Edit pencil +
  Public-view external) plus a kebab.
- [ ] Given the user clicks the Edit button (pencil) on
  a scenario row, when the click fires, then the browser
  navigates **in the same tab** to
  `/c/<calc-public-token>?s=<share_token>` (mints
  share_token if currently null, same lazy-mint as Copy
  link). Per Decision Log, no `&edit=1` flag — locks
  default closed for the owner same as anyone else.
- [ ] Given the user clicks the Public-view button
  (external icon) on a scenario row, when the click
  fires, then the browser opens
  `/c/<calc-public-token>?s=<share_token>` in a **new tab**
  (`target="_blank" rel="noopener noreferrer"`). Same URL,
  same lock state as Edit — only the tab target differs.
- [ ] Given the user opens the row kebab, when the menu
  renders, then it contains: Copy link (top), Rename,
  Delete (with destructive treatment).
- [ ] Given the user clicks Rename in the kebab, when
  the click fires, then an inline rename input replaces
  the title text on that row; pressing Enter saves the
  new title via PUT, Esc cancels. Empty / too-long
  validation matches the Save sheet rules.
- [ ] Given the user clicks Delete in the kebab, when
  the click fires, then a destructive-confirm bottom-
  sheet appears with copy "Delete «<scenario title>»?
  This cannot be undone." On confirm, DELETE
  `/api/scenarios/<id>` fires; the row disappears from
  the list in the same render pass; the section hides if
  this was the last scenario.
- [ ] Given the parent calculator of a scenario row is
  soft-deleted (calculator is in trash), when the My
  Scenarios row renders, then the row remains in the
  list with the parent-calculator title shown but greyed
  to ~60% opacity, AND a small "calculator deleted"
  muted label appears under the calc title. The Edit /
  Public-view buttons are disabled (the visitor URL
  would 410); Copy link is also disabled. Only the
  kebab's Delete remains active. (Note: the full
  orphan-management UX — bulk delete after permanent
  purge, clone-to-recover during recovery window — is
  PROJ-13. PROJ-12 provides the inline display only.)
- [ ] Given the parent calculator of a scenario row was
  hard-deleted (not in trash anymore, just gone), when
  the My Scenarios row renders, then the row appears
  with the calc title replaced by muted italic
  "Calculator deleted permanently", Edit / Public-view /
  Copy link all disabled, only Delete in the kebab is
  active. (Bulk-delete-orphans surface is PROJ-13.)
- [ ] Given the My Scenarios list renders, when the
  rows order, then they sort by `updated_at` descending
  (most-recently-saved first).

### Confirm-on-navigate

- [ ] Given the visitor is on a `?s=<token>` URL AND has
  modified any value from the loaded scenario (modified
  condition true), when the visitor clicks a link inside
  the app that would navigate away (brand mark, auth
  buttons, anchor click that changes route), then a
  confirm dialog "You have unsaved changes. Leave
  anyway?" appears. Confirm proceeds with nav; Cancel
  stays on the page.
- [ ] Given the same precondition, when the visitor
  closes the tab or types a new URL in the address bar
  (browser-level navigation), then the browser's native
  `beforeunload` confirm fires.
- [ ] Given the visitor is on a bare `/c/<token>` URL
  (no scenario loaded) AND has typed values into inputs,
  when they navigate away, then NO confirm dialog appears
  (per Decision Log: bare-URL changes are "exploration",
  not unsaved scenario edits).
- [ ] Given the visitor on a `?s=` URL has the modified
  condition true AND clicks Save in the Save Scenario
  sheet, when the save completes successfully, then the
  modified condition flips to false on the next render
  (the loaded-state baseline updates to the just-saved
  values) and confirm-on-navigate no longer fires.

### Empty / error states

- [ ] Given the visitor loads `/c/<token>?s=<bad-token>`,
  when the page renders, then the visitor-side
  `not-found.tsx` body of `<EmptyOrErrorState variant=
  "error">` shows copy "This scenario doesn't exist or
  the link is invalid." (distinct from the calculator-
  not-found copy). Footer: "Built with Calcgrinder".
- [ ] Given a server endpoint returns 500 during save,
  when the sheet receives the error, then the sheet
  surfaces an inline error "Something went wrong —
  please try again" without losing the typed values.
- [ ] Given the Save sheet renders for a registered
  user but the existing-scenarios list fetch fails,
  when the sheet renders, then the list area shows
  muted copy "Couldn't load your scenarios — saves
  will still work." Save / new-scenario flow still
  functions (the list is non-blocking).

### Authentication boundaries

- [ ] Given a user with `status = pending` or
  `declined` loads `/c/<token>` and presses Save
  Scenario, when the sheet opens, then the SAME flow as
  a fully-anonymous visitor runs (localStorage save, no
  sharing). Pending/declined are not "registered" for
  scenario purposes — they're authenticated-to-the-
  session but not approved-to-the-app.
- [ ] Given a user whose session expired loads
  `/c/<token>?s=<token>` AND owns the scenario, when
  the page renders, then they see the scenario as
  any-other-visitor (closed locks, no Copy link
  affordance). On re-login + page reload, the owner
  affordances reappear.

### Performance & polish

- [ ] Given the visitor presses Save in the sheet on
  a typical 4G connection, when the save completes,
  then the sheet closes within 500ms (P95).
- [ ] Given a `?s=<token>` URL loads, when the page
  hydrates, then the values from the scenario are
  applied before the first paint (so the visitor never
  sees calculator-default values then scenario values —
  no flash).
- [ ] Given a scenario contains values for ~100 cells,
  when the page applies them, then apply + recompute
  completes in <50ms on a mid-range mobile.
- [ ] Given Copy link is pressed, when the mint +
  clipboard write completes, then the toast appears
  within 200ms (P95).

## Edge Cases

- **Anonymous user fills out the Save sheet with title,
  description; closes the sheet without pressing Save.**
  Inputs are discarded; localStorage is unchanged.
- **Anonymous user has saved scenarios on Browser A,
  signs up, opens Browser B (with no localStorage), then
  later opens Browser A still signed in.** The migration
  helper on the Browser A visitor-page-load picks up the
  stale localStorage rows and migrates them
  (opportunistic, per AC). If a collision exists from
  Browser B saves, the migrated rows get " (2)" suffixes.
- **Registered user saves a scenario on calculator A,
  then the calculator owner re-publishes A under a new
  public_token (regen).** The scenario row is unchanged.
  The user's My Scenarios row still shows it; Copy link
  generates a URL using the current `public_token`.
  Previously-distributed URLs are broken (expected, per
  the regen contract from PROJ-10).
- **Registered user saves a scenario, then renames a
  cell in the parent calculator (the user is the
  calculator owner), then opens the scenario URL.** The
  renamed cell's value is silently skipped per the drift
  rules. The drift banner appears. Owner sees their own
  behaviour reflected.
- **Anonymous user saves 50 scenarios for one
  calculator.** All stored in localStorage. List in the
  Save sheet scrolls. No cap enforcement in v1. If quota
  hits, the QuotaExceededError AC kicks in.
- **Registered user opens the Save sheet on a `?s=`
  URL for a scenario they own AND types over the title.**
  Selection deselects (per the de-select AC); Save
  button reverts to "Save" (creating a new scenario,
  not overwriting). They can deliberately get back to
  Overwrite by re-tapping the pre-existing row.
- **Two browser tabs open on the same `?s=` URL.
  Tab A modifies values + saves overwrite. Tab B has
  the now-stale view.** Tab B continues to show its
  in-memory state (no realtime channel; per PRD
  non-goal). Reload picks up Tab A's changes. Concurrent
  overwrite in B will overwrite A's overwrite — last-
  write-wins. No optimistic-concurrency check in v1.
- **Visitor lands on `/c/<token>?s=<token>` for a
  scenario whose values are all stale (every key has
  been renamed/removed from the calc).** Page renders;
  EVERY input shows the calculator default; the drift
  banner appears; the "(modified)" suffix does NOT
  appear (the loaded state matches the displayed
  state — defaults — because all scenario values were
  skipped).
- **Owner deletes a scenario while a recipient is
  viewing its `?s=` URL.** The recipient's in-memory
  page continues working (no live update). Reload
  returns 404.
- **Calculator hard-deleted while a scenario URL is
  open.** Same as above — recipient's session continues
  in-memory until reload, then 404.
- **Cell whose `value_type` is `date` or `array`** —
  the scenario serializes them in `values` as JSON
  primitives (date as ISO 8601 string, array as JSON
  array). Apply parses back per cell type. Match-on-
  apply uses the same JSON shape.
- **Migration POST sends a scenario for a calculator
  the user themselves never authored.** Fine — scenarios
  are owned by the saver, not by the calc owner per spec
  line 956. No special case.
- **Migration helper runs but the user lands on
  `/c/<token>?s=<token>` simultaneously.** Migration is
  fire-and-forget on mount; scenario apply doesn't wait
  for it. The just-migrated scenarios show up on the
  next sheet-open or dashboard load.
- **An anonymous visitor saves a scenario with the same
  title as an existing localStorage row WITHOUT tapping
  to overwrite.** A new row is created with a duplicate
  title (no dedupe for anonymous saves — no server
  uniqueness check; the array can have two rows with
  the same title). Visitor sees both in the list. Not
  ideal but acceptable; the "tap to overwrite" UX is
  the documented path.
- **Visitor on a `?s=` URL with one cell unlocked +
  modified; presses Reset.** Per AC: ALL locks re-
  close, ALL values restore to scenario state. The
  visitor's in-flight unlock state is part of "modified"
  per the model.
- **Visitor types into the Save sheet's description for
  120 lines of text.** Allowed (under 2000 chars). The
  textarea scrolls inside the sheet.
- **`profiles.name` was changed by the scenario owner
  between save and a recipient viewing the URL.** The
  scenario header shows the current `profiles.name` at
  view time (it's read live from the join, not
  snapshotted). Acceptable — names are stable
  identifiers and changes reflect intent.
- **Scenario stored values include a number cell with
  `value = 0` vs an empty/null value.** The JSON
  serializer must distinguish these. Apply restores
  exactly what was saved (including legitimate zeros).

## Technical Requirements (optional)

- **Performance:** scenario apply + recompute on page
  load < 50ms on mid-range mobile for a calculator
  with ~30 cells. Save round-trip P95 < 500ms over 4G.
  Dashboard My Scenarios list query < 100ms for ≤1000
  rows per user.
- **Security:** scenarios visible only to their owner
  via direct table access (RLS); public visitor reads
  go through the SECURITY-DEFINER RPC by `share_token`.
  Share token entropy ≥ 128 bits (22-char base64url —
  same as calculator `public_token`). Owner-only
  RLS on save / update / delete. Cross-calc URL forgery
  rejected.
- **Privacy:** scenario URL meta tags do NOT include
  scenario title, owner name, or save date. Only the
  calculator's title/description appear in `<title>`
  and OpenGraph (same as PROJ-11 bare URL).
  `<meta name="robots" content="noindex, nofollow">`
  inherited from PROJ-11's `(public)` layout.
- **Rate-limit:** server save / overwrite / mint
  endpoints capped at ~30 req/min/user via the Upstash
  client PROJ-11 introduced. 429 on overflow. Fail-open
  on Upstash outage.
- **Browser support:** Chrome / Firefox / Safari latest
  2, iOS Safari latest 2, Chrome Android latest 2 (same
  as PROJ-11). localStorage saves require localStorage
  available — degrade with the QuotaExceededError CTA.
- **Accessibility:** every padlock toggle has an
  `aria-label` describing the cell + lock state ("Lock
  field <cell label>" / "Unlock field <cell label>").
  The scenario header is read in order: title,
  description, by-line, before the calculator content.
  The structure-drift banner has `role="status"` so it
  announces to screen readers when it appears.

## Open Questions

- [ ] **Desktop Save-sheet primitive** — confirm during
  /architecture whether the existing project ships a
  reusable Dialog primitive for the desktop form, or
  whether we extract one from PROJ-9's existing patterns
  (e.g. the cell-edit dialog). Decision is non-blocking
  for the spec but affects /frontend's component plan.
- [ ] **Lock-icon visual placement when no edit-icon
  was rendered in the Builder** — PROJ-9's CellCard
  reserves the top-right corner for the Builder's
  edit-icon slot. The lock replaces it on the visitor
  surface. Confirm during /frontend that the slot
  geometry is identical (no card-height shift between
  Builder hidden-state and Visitor locked-state).
- [ ] **Exact relative-date format on the scenario
  header sub-line** — "saved 2 days ago" vs
  "saved May 22, 2026". Match whatever PROJ-5's
  dashboard CalcCard footer uses ("Edited <date>").
  Resolve during /frontend.
- [ ] **Server endpoint shape** — REST routes
  (`POST /api/scenarios`, `PUT /api/scenarios/<id>`,
  `DELETE /api/scenarios/<id>`, `POST /api/scenarios/
  <id>/share`) vs a single `/api/scenarios` route with
  action-dispatch in the body. Implementer's call
  during /architecture.

## Decision Log

### Product Decisions
<!-- Added by /write-spec -->

| Decision | Rationale | Date |
|----------|-----------|------|
| Save sheet doubles as Load: tapping an existing-scenarios row both loads the scenario's values AND pre-selects it as the overwrite target. No separate "Load Scenarios" affordance. | Without this dual-use, anonymous visitors who saved scenarios on a return visit have no in-app way to re-apply them (they can't share `?s=` URLs). A separate Load button would clutter the visitor header. The single-surface model also makes the "(current)" pre-selection on a `?s=` URL feel native — it's the same selection state that drives load. Trade-off accepted: a visitor who wants to PREVIEW a saved scenario without committing to overwrite has to type a different title to deselect, which we wave away as a non-issue (Save sheet opens are deliberate, not exploratory). | 2026-05-24 |
| Anonymous → registered migration runs **opportunistically on every authenticated visitor-page-load** (not first-login-only). Title collisions resolved by suffixing " (2)", " (3)", etc. | Cross-browser robustness — a user might sign up on Browser B then come back to Browser A weeks later. First-login-only would orphan those localStorage rows. Opportunistic + idempotent means no UX surprise, no manual import step. Suffix-on-collision is the standard non-destructive resolution (vs Overwrite / Skip prompts, which were rejected as too noisy for what's meant to be an automatic background flow). | 2026-05-24 |
| All `?s=<token>` URLs render with **locks closed by default**, for every viewer including the scenario's owner. The dashboard's Edit and Public-view buttons differ ONLY in `target="_self"` vs `target="_blank"` — same URL, same render behaviour. No `&edit=1` query flag, no server-side owner detection for lock state. | Single mental model: closed locks = "I'm viewing a saved scenario, the values are intentional, I unlock fields I want to vary." Owners unlock fields manually like any other visitor (per-field unlock is fast; most edits touch 1-2 fields, not all of them). For whole-scenario rewrites, the Save Scenario sheet's "tap row to load + overwrite" stays the fast path. Drops the `&edit=1` query flag and the defense-in-depth path for non-owners pasting an `&edit=1` URL they shouldn't have. **Departs from the v1 spec line 1789** which says Edit opens with locks open — that line is now superseded by this entry. | 2026-05-24 |
| Save Scenario icon is **always visible** in the visitor header for everyone — anonymous, pending/declined-authenticated, registered. Visibility is NOT gated on whether any input has been changed. | Anonymous visitors can save a "checkpoint" of defaults; registered visitors can save a baseline. Gating on "input changed" would mean visitors on a `?s=` URL (all locks closed by default) would never see Save until they unlocked AND changed something — a triple gate that defeats discoverability. The Reset button stays conditionally visible (only when state has diverged) — that's where the divergence-gate makes sense. | 2026-05-24 |
| Confirm-on-navigate-with-unsaved-changes fires ONLY on `?s=<token>` URLs when modified-condition is true. Bare `/c/<token>` URLs with typed inputs do NOT trigger the confirm. | Per spec line 960 ("changes to a saved scenario are ephemeral until explicit save"), the confirm is for protecting scenario edits, not for general visitor exploration. On bare URLs, defaults will be restored on the next reload — there's no "save" to protect. Firing on every page (visitors typing into a slider then clicking Slack-link) would train people to dismiss it reflexively. | 2026-05-24 |
| Migration silently skips scenarios whose `calculator_id` no longer exists (parent calc hard-deleted before migration runs). LocalStorage row still cleared. | Migrating an orphan-from-birth scenario is worse than skipping: it pollutes the user's My Scenarios list with rows whose Edit / Public-view / Copy link are all permanently disabled and whose only available action is Delete. Skip-and-clear keeps the dashboard clean. Trade-off: the user loses values from a calculator that's gone anyway — they couldn't use those values to anything either way. | 2026-05-24 |
| The visitor `?s=<bad-token>` case returns whole-page 404, not "strip the param and render the bare calculator." | Per v1 spec line 1048. Failing closed is the correct UX: the visitor was sent a specific scenario URL and expects to see it; silently showing the bare calc would confuse them. A 404 with a "View the calculator" link (already present in the visitor-side 404 page via the brand mark) lets them recover with one click. | 2026-05-24 |
| Scenario URL meta tags do **not** include scenario title / owner name. Only calculator title + description appear in `<title>` and OpenGraph. | A scenario URL might be shared narrowly (e.g. to a financial advisor); leaking the scenario title in link-preview unfurls could expose information the author intended for a single recipient. Calculator-level meta is already public (the calc URL was shared deliberately). PROJ-11's `noindex, nofollow` inherits — Google won't index either. | 2026-05-24 |
| Structure-drift banner dismissal is **per-page-load only** (not persisted in localStorage / cookie). | The banner is informational — the visitor needs to see it the first time the URL loads. If they reload (e.g. on a different day), they need the same info again. Persisting dismissal would mean "scenario X has had its drift banner dismissed forever" which silently degrades the next view. Cheap to re-render per load. | 2026-05-24 |
| My Scenarios row shows scenarios whose parent calculator is in trash (soft-deleted) with a muted "calculator deleted" sub-label and the Edit / Public-view / Copy-link buttons disabled (only Delete in the kebab remains active). Full orphan management (bulk delete, clone-to-recover) is PROJ-13. | The user needs to SEE their scenarios are inaccessible — silently disappearing rows from My Scenarios when the calculator is soft-deleted would be confusing. Disabled buttons surface the state without offering a recover-or-delete decision the user isn't ready to make. PROJ-13 ships the structured surfaces (bulk delete after permanent purge, clone-to-recover during the recovery window) where those decisions belong. | 2026-05-24 |
| Per-user rate limit on POST/PUT/DELETE scenario endpoints: ~30 req/min/user via the Upstash client PROJ-11 introduced. | Modest cap. Defensive against runaway clients (e.g. a bug in the Save sheet that retries forever). Doesn't gate normal usage — 30 saves/min is well above a human typing pace. Reuses existing infra; no new deps. Fail-open per the same policy. | 2026-05-24 |
| No per-user / per-calculator scenario count cap in v1. | Low-volume v1 assumption per PRD. If abuse surfaces (single user with 10k scenarios degrades dashboard query perf), we add a cap as a follow-up. Adding a cap pre-emptively risks blocking legitimate power-users (e.g. consultants saving scenarios per client). | 2026-05-24 |
| Scenario values stored as full input snapshot (every Input cell's current value), not as diff-from-default. | Simpler invariant: scenario = exact playback. If we stored diffs, scenarios would silently shift when the calculator's defaults changed — surprising and untestable. Storage cost is negligible (calculators are tens-of-cells, not thousands). New cells added after save naturally fall through to the calculator's current default (not "scenario default") — explicit in the structure-drift rules. | 2026-05-24 |
| Scenario `values` is keyed by **cell name** (not cell ID), matching v1 spec. Renames and removals are treated identically (silent skip). | Per spec line 1017 ("stores values keyed by cell name"). Trade-off accepted: renaming a cell silently drops the scenario value rather than carrying it forward. The alternative (key by ID) would preserve values across renames but mean a rename in the Builder silently changes the scenario header's "(modified)" state and what gets displayed — also confusing. Keeping the rule consistent with what the spec authors decided. | 2026-05-24 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| REST routes per resource: `POST /api/scenarios`, `PUT /api/scenarios/[id]`, `DELETE /api/scenarios/[id]`, `POST /api/scenarios/[id]/share`, `POST /api/scenarios/migrate`, `GET /api/scenarios?calculator_id=…`. | Matches the established `/api/calculators/[id]/duplicate` + `/regenerate-token` pattern, so future skill files reuse one auth-check / Zod-strip / RLS-scoping shape. Smaller blast radius per handler; easier to add per-route tests. Action-dispatch on one route was rejected as a tax on grep + a deviation from house style. | 2026-05-24 |
| Single SECURITY DEFINER RPC `fn_get_scenario_by_share_token(p_share_token TEXT, p_calc_token TEXT)` returns the scenario row joined with the parent calculator's full payload (same JSON shape as `fn_get_public_calculator`). Granted to `anon, authenticated`. | One round-trip for the `/c/<token>?s=…` happy path (per spec line 182–185). Two-arg signature enforces the cross-calc forge rejection inside the function (RPC returns 0 rows if `p_calc_token` doesn't match `scenario.calculator_id`'s `public_token`) — defence in depth alongside the page-level check. | 2026-05-24 |
| `scenarios.calculator_id` FK is `ON DELETE SET NULL`, NOT `CASCADE`. `owner_id` FK is `ON DELETE CASCADE`. | Spec line 186–194 mandates non-cascade on hard-delete so PROJ-13's orphan-management dashboard has rows to operate on. Owner cascade is the standard account-deletion contract — deleting a user purges their scenarios. SET NULL on calc-delete lets the dashboard surface "Calculator deleted permanently" copy (per AC) without polluting the table with phantom FKs. | 2026-05-24 |
| Lazy share-token mint: `scenarios.share_token` is nullable + unique-when-not-null. The `/api/scenarios/[id]/share` POST is idempotent — mints on first call, returns the same token on subsequent calls. | Avoids minting tokens for scenarios the owner never shares (privacy: fewer 22-char URL-safe IDs leaked into logs / DB dumps). Idempotent endpoint keeps client logic dumb — every "Copy link" surface hits the same POST without caring about prior state. | 2026-05-24 |
| Share token format reuses the existing `gen_calculator_public_token()` SQL helper (22-char base64url, ~128 bits). Mint endpoint can either call the helper or use Node's `crypto.randomBytes(16).toString('base64url')` — both produce the same alphabet/length. | One single source of truth for "what an unguessable token looks like" across the app. Same entropy budget as `calculators.public_token` (already audited in PROJ-10). | 2026-05-24 |
| Anonymous→registered migration is a small client component (`<ScenarioMigrationMount>`) mounted inside `VisitorShell`. Fires once per visitor-page-load when the session is approved. POSTs every `cg:scenarios:*` row in one batched request to `/api/scenarios/migrate`; clears local keys only when the response is 200. | Satisfies the spec's "every authenticated visitor-page-load checks" rule (line 369–372) without polluting the editor / dashboard route groups. Batched POST keeps the migration atomic from the user's POV; partial failure preserves local state for retry on the next page-load (per AC). | 2026-05-24 |
| Save Scenario sheet uses shadcn's existing `<Sheet side="bottom">` (mobile, ≤md) and `<Dialog>` (desktop) via a small `<ResponsiveSheet>` wrapper (≤30 LOC). No new primitive added to `components/ui`. | shadcn's Sheet + Dialog are already in the repo and shoulder all focus-trap / Escape / outside-click semantics. A purpose-built primitive would duplicate behaviour. Wrapper lives next to `SaveScenarioSheet` rather than in `components/ui` because it's not a general-purpose shadcn-style primitive. | 2026-05-24 |
| Lock state + loaded-baseline live in an extended `VisitorInputProvider` (renamed in-place; `VisitorInputContext` exposes `inputs`, `setInput`, `locks`, `toggleLock`, `loadedBaseline`, `isModified`, `reset`). No new top-level provider. | The existing provider already owns the input map and is consumed by `VisitorCalculatorStateAdapter`. Threading lock + baseline through the same context keeps the modified-derivation co-located with the inputs map it derives from — no cross-context sync bugs. Reset / per-cell lock toggle are operations on the same state. | 2026-05-24 |
| `?s=<token>` URL handling happens in the existing `src/app/(public)/c/[token]/page.tsx` Server Component — NOT middleware. When `searchParams.s` is present, the server component fetches via `fn_get_scenario_by_share_token`; on miss, it renders the visitor 404 shell with scenario-specific copy and calls `notFound()` to set the HTTP status. Middleware continues to handle only the 410 + rate-limit path. | Middleware probes are minimal-and-edge-runtime; the scenario fetch returns a richer payload that the page actually renders, so duplicating the call is wasteful. The custom 404 copy ("This scenario doesn't exist…") is variant-dependent and lives easier in a server component than a middleware HTML string. | 2026-05-24 |
| Confirm-on-navigate is a small client component (`<UnsavedChangesGuard>`) that registers `beforeunload` + intercepts in-app anchor clicks when a `?s=` URL is loaded AND `isModified === true`. Uses the existing `useVisitorInputStore()` selector — no new context. | Confines the behaviour to a single mount-once node next to `ScenarioHeaderBlock`. The bare-URL exclusion is enforced at the mount-condition level (mount only when the URL has `?s=`); no per-render branch. | 2026-05-24 |
| Per-user rate limit on scenario writes via a new Upstash limiter prefix `cg:scenario-write` (sliding window, 30 / 60s, keyed by `auth.uid()`). Reuses `@/lib/rate-limit`'s `getRatelimit()` factory (extracted to accept a prefix/limit/window tuple if not already parameterised). | Spec line 332–337. Same fail-open policy as PROJ-11; no new dependency. Keyed by user-id (not IP) because authenticated POSTs come from a logged-in session — IP-keyed would falsely throttle shared NATs. | 2026-05-24 |
| Migration endpoint accepts a batch; per-row failures are reported back as `{ migrated: N, skipped: M, errors: [...] }`. Title collisions resolve via in-handler suffix walk (" (2)", " (3)") — same algorithm used in `fn_duplicate_calculator`. | Batching keeps the round-trip count fixed regardless of N. Per-row error capture lets the client decide whether to clear localStorage (partial success still clears the migrated subset; failed rows stay for retry). Suffix walk mirrors existing behaviour for a consistent UX. | 2026-05-24 |
| Per-cell lock toggle component (`<CellLockToggle>`) is rendered by extending `CellCard`'s existing top-right "edit-icon slot" — gated by `useInteractivity()` returning `visitor` mode (the same hook that toggles Builder edit affordances). | Spec line 940–946. Reuses the slot PROJ-9 already reserved, so card geometry doesn't shift between Builder and Visitor renders. No new wrapper around `CellCard` needed. | 2026-05-24 |
| The Save Scenario icon button is added directly to `VisitorHeader` (no new shell variant). Sheet open/close state is hoisted into a small `<SaveScenarioController>` mounted in `VisitorShell` so the icon button and any other invocation surfaces (none in v1, but future-proof) can dispatch open. | Header surface is owned by `VisitorHeader`; spec says the icon is always visible there. Hoisting the open-state out of the header keeps the header presentational and unblocks future invocation surfaces (e.g. a keyboard shortcut). | 2026-05-24 |
| Scenarios are NEVER read for the visitor's own page via the table (RLS would block anon anyway); even owner views read the scenario via the SECURITY DEFINER RPC on the `?s=` URL. Direct table SELECTs are reserved for the dashboard list (My Scenarios) and the Save sheet's existing-list fetch. | One read path for one viewing surface = fewer bugs. The dashboard query is authenticated + RLS-scoped (`WHERE owner_id = auth.uid()`); the visitor-side path is the SECURITY DEFINER RPC. No conditional "am I the owner? read via table, else RPC" branching on the visitor page. | 2026-05-24 |
| Server-side scenario fetch for the Save sheet's existing-list uses `GET /api/scenarios?calculator_id=…` (lazy, on sheet open). NOT pre-fetched in the page Server Component. | Most visitors never open the Save sheet; pre-fetching every page-load wastes a query. Lazy fetch on first open is fast (indexed `(owner_id, updated_at desc)`) and matches the user intent. Failure mode is non-blocking (sheet shows muted "Couldn't load your scenarios" copy per AC, save still works). | 2026-05-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure (visitor surface)

```
/c/<token>?s=<scenario-token>
└── VisitorShell  (PROJ-11, extended)
    ├── VisitorHeader  (PROJ-11, extended)
    │   └── Save Scenario icon button  (NEW)
    ├── ScenarioMigrationMount  (NEW, client)
    │       — runs anon→registered migration on mount
    │         when an approved session is present
    ├── SaveScenarioController  (NEW, client)
    │   └── SaveScenarioSheet  (NEW)
    │       ├── ResponsiveSheet wrapper (bottom-sheet | dialog)
    │       ├── title input (required, ≤200)
    │       ├── description textarea (optional, ≤2000)
    │       ├── existing-scenarios list (server fetch on open
    │       │   for registered; localStorage scan for anon)
    │       │   └── per-row Copy link (registered only)
    │       └── Save / Overwrite primary button
    ├── PublicCalculatorPage  (PROJ-11, extended)
    │   ├── StructureDriftBanner  (NEW, on ?s= URLs with skip)
    │   ├── ScenarioHeaderBlock  (NEW, on ?s= URLs)
    │   │   ├── title (+ "(modified)" suffix when divergent)
    │   │   ├── description (preserved newlines, muted)
    │   │   ├── by-line "by <name> · saved <relative date>"
    │   │   └── Copy link icon  (owner only)
    │   ├── ResetButton  (NEW, conditional)
    │   └── CalculatorRenderer  (PROJ-9 / PROJ-11, extended)
    │       └── CellCard  (extended — top-right slot now
    │           hosts CellLockToggle in visitor mode)
    └── UnsavedChangesGuard  (NEW, client)
            — mounted only on ?s= URLs;
              beforeunload + in-app anchor intercept
```

### Component Structure (dashboard)

```
/dashboard
└── MyScenariosSection  (NEW, second slot per PROJ-5 line 192)
    └── ScenarioRow × N  (server-fetched, owner_id-scoped)
        ├── title (inline-editable on Rename)
        ├── parent calculator title sub-label
        │   (greyed + "calculator deleted" muted label
        │    when soft-deleted; replaced italic when hard-deleted)
        ├── relative-date stamp
        ├── Edit pencil  → /c/<calc-token>?s=<share>  (_self)
        ├── Public-view  → /c/<calc-token>?s=<share>  (_blank)
        └── kebab menu
            ├── Copy link  (triggers lazy mint + clipboard)
            ├── Rename     (inline)
            └── Delete     (DestructiveConfirmSheet, PROJ-9)
```

### Data Model (plain language)

A new `scenarios` table holds one row per saved scenario:

```
scenarios
├── id              uuid pk
├── calculator_id   uuid fk → calculators.id  (ON DELETE SET NULL)
├── owner_id        uuid fk → auth.users.id   (ON DELETE CASCADE)
├── title           text, not null, length 1..200
├── description     text, default ''  (length ≤ 2000)
├── values          jsonb, not null, default '{}'
│                    — full input snapshot keyed by cell name
├── share_token     text, nullable, UNIQUE when not null
│                    — minted on first Copy link, immutable after
├── created_at      timestamptz, default now()
└── updated_at      timestamptz, default now()
                     — auto-bumped by the existing project
                       updated_at trigger
```

Indexes:
- `(owner_id, updated_at DESC)` — powers the My Scenarios list
- `(share_token) WHERE share_token IS NOT NULL` — RPC lookup
- existing FK index on `calculator_id` (auto-created)

RLS (owner-only):
- `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies all gate
  `owner_id = auth.uid()`. No `published`/`anon` carve-out — the
  only public access path is the SECURITY DEFINER RPC.

SECURITY DEFINER RPC (one round-trip for the visitor):
```
fn_get_scenario_by_share_token(
  p_share_token TEXT,
  p_calc_token  TEXT
) RETURNS TABLE (
  scenario_id, scenario_title, scenario_description,
  scenario_values, scenario_owner_name, scenario_updated_at,
  calculator_payload JSONB     -- same shape as fn_get_public_calculator
)
```
Returns 0 rows when:
- `share_token` doesn't match any scenario, OR
- the scenario's `calculator_id` doesn't have `p_calc_token` as its current `public_token` (cross-calc forge defence), OR
- the calculator is soft-deleted or hard-deleted (returns 0 → page falls back to PROJ-11's 410 / 404 path).

LocalStorage (anonymous visitors):
- One key per calculator: `cg:scenarios:<calculator-public-token>`
- Value: JSON array of `{ id, title, description, values, saved_at }`
- `id` is a client-generated UUID; never reused on the server side (migration creates new server IDs).
- 5MB browser quota; surfaced via the QuotaExceededError CTA per AC.

### API Endpoints (REST)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/scenarios?calculator_id=<uuid>` | required | List the caller's scenarios for one calculator (Save sheet existing-list). |
| `GET` | `/api/scenarios?mine=1` | required | List all of the caller's scenarios for the dashboard My Scenarios section, joined with parent calc title + soft_delete_at. |
| `POST` | `/api/scenarios` | required | Create. Body: `{ calculator_id, title, description, values }`. |
| `PUT` | `/api/scenarios/[id]` | required | Update title / description / values. `share_token` left untouched. |
| `DELETE` | `/api/scenarios/[id]` | required | Hard-delete the row. |
| `POST` | `/api/scenarios/[id]/share` | required | Idempotent lazy mint: returns `{ share_token, url }`. |
| `POST` | `/api/scenarios/migrate` | required | Batch-insert localStorage scenarios under the caller. Returns `{ migrated, skipped, errors }`. Title collisions resolved via suffix walk. |

All write endpoints:
- Zod-strip body validation (whitelist mirrors `/api/calculators/[id]`'s pattern).
- 401 on no session, 404 on missing row (collapsed with cross-owner per the opacity rule), 429 on rate-limit overflow.
- Rate limit: 30 req/60s/user via Upstash prefix `cg:scenario-write` (fail-open).

### Tech Decisions Explained (PM-friendly)

1. **One new table only.** Scenarios are self-contained — no junction tables, no per-scenario `cells` mirror. The full input snapshot lives in one JSONB column, so loading a scenario is one read.

2. **Two read paths, never blended.**
   - The dashboard reads `scenarios` directly with RLS (owner only sees their own).
   - The visitor `?s=` page reads through a SECURITY DEFINER function gated by the unguessable share token. No conditional "am I the owner?" branching on the visitor surface — every viewer (including the owner) sees the same render.

3. **Lazy-minted share tokens.** A scenario's URL doesn't exist until the owner presses Copy link. This keeps the database free of unused tokens and means the URL surface only grows when someone actually shares.

4. **Locks live in client state, never on the server.** Per-field locks are an ephemeral UX affordance — reload resets to the URL-derived default. No DB column, no per-user lock preference.

5. **The migration is opportunistic, not first-login.** A small client mount on the visitor surface checks every page-load for stale localStorage rows. This handles the cross-browser case (sign up on Browser B, return to Browser A weeks later) without an explicit Import button.

6. **No backwards-compat scaffolding.** The visitor input store gets extended in-place (lock state, baseline, isModified) rather than wrapped in a second context. The cell card's top-right slot was already designed to host either a Builder edit-pencil or a Visitor lock toggle (PROJ-9 forward-compat note); we drop the lock toggle in.

### Dependencies (npm packages)

No new packages. The feature reuses:
- `@supabase/ssr` (SECURITY DEFINER RPC client)
- `@upstash/ratelimit` + `@upstash/redis` (write rate-limit)
- `zod` (request body validation)
- existing shadcn primitives: `Sheet`, `Dialog`, `Popover`, `DropdownMenu`, `Input`, `Textarea`, `Button`
- existing utilities: `Sonner` toast, `lucide-react` icons via `@/components/shell/icons`

### Migration Files (planned)

One new Supabase migration:
- `supabase/migrations/<timestamp>_scenarios.sql`
  - `CREATE TABLE public.scenarios` with constraints listed above
  - RLS policies (owner-only on all four ops)
  - Indexes `(owner_id, updated_at DESC)` and `(share_token) WHERE share_token IS NOT NULL`
  - `CREATE OR REPLACE FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT)` granted to `anon, authenticated, service_role`
  - Comments on table / columns / function referencing PROJ-12

After the migration, regenerate types per project convention:
`npx supabase gen types typescript --linked > src/lib/supabase/types.ts`

### Risks / Trade-offs

- **Single JSONB snapshot vs per-cell rows.** Snapshot wins on simplicity but means a scenario for a 100-cell calculator carries a ~5–10KB row. At the v1 user-count assumption (tens-to-hundreds of users, tens of scenarios per user), table size stays under 100MB. Revisit only if a sysadmin reports table bloat.
- **`?s=` page render is two round-trips when the cache misses** — page Server Component awaits one RPC (`fn_get_scenario_by_share_token`) plus the auth session check (same as PROJ-11's bare URL). Acceptable per the PRD performance budget.
- **Rate limit is per-user, not per-IP.** A shared NAT can't accidentally throttle multiple users, but a single compromised session can hammer up to 30/min. Considered acceptable for v1; tightening is post-v1.
- **Migration is best-effort.** A partial-failure migration leaves un-migrated rows in localStorage for retry. The user gets a muted toast but no escalation; the spec accepts this trade-off.

## Implementation Notes — Frontend (2026-05-24)

The frontend pass landed every visitor-side surface and the dashboard
"My Scenarios" slot. Backend (migration, RPC, REST routes) is the
next step — until those land, server-side scenario fetches return
null and the dashboard list stays empty (graceful degradation).

### New files

- `src/lib/scenarios/` — types, validation, localStorage store
  (`saveLocalScenario` / `collectAllLocalScenarios` / `LocalScenarioQuotaError`),
  apply + drift detection (`applyScenarioValues`,
  `isInputsModifiedFromBaseline`), API client wrappers (`createScenario`,
  `updateScenario`, `deleteScenario`, `shareScenario`, list helpers,
  `migrateScenarios`), and the server-only `fetchPublicScenario`
  (via the future `fn_get_scenario_by_share_token` RPC) +
  `listMyScenariosWithCalc` (direct table SELECT with try/catch
  fallback to `[]` when the table doesn't exist yet).
- `src/components/visitor/` — scenario surface:
  - `cell-lock-toggle.tsx` — per-field padlock icon
  - `scenario-context.tsx` — `ScenarioProvider` / `useScenario`
  - `scenario-header-block.tsx` — title + description + by-line +
    owner Copy link icon + "(modified)" suffix
  - `structure-drift-banner.tsx` — dismissible
  - `reset-button.tsx` — conditional, restores baseline + locks
  - `responsive-sheet.tsx` — bottom-sheet (mobile) vs dialog (desktop)
  - `save-scenario-controller.tsx` — open/close + calc + user context
  - `save-scenario-sheet.tsx` — title / description / existing-list
    with select-to-overwrite + Copy-link-per-row, anonymous
    localStorage flow with `QuotaExceededError` CTA, registered
    POST/PUT flow with 429 / 500 handling
  - `save-scenario-header-button.tsx` — Bookmark icon mounted in the
    visitor header (gated by the controller presence so 404 / 410
    shells don't render it)
  - `unsaved-changes-guard.tsx` — `beforeunload` + in-app anchor
    intercept, only mounted on `?s=` URLs
  - `scenario-migration-mount.tsx` — opportunistic anon→registered
    batch migration on every authenticated visitor-page-load
- `src/components/dashboard/my-scenarios-section.tsx` +
  `scenario-row.tsx` — second-slot section, hide-when-empty, rows
  with Edit / Public-view / kebab (Copy link / Rename / Delete),
  parent-calc grey-out when soft-deleted, italic placeholder when
  hard-deleted.

### Modified files

- `src/components/visitor/visitor-input-store.tsx` — extended in place
  to expose `locks` / `toggleLock` / `loadedBaseline` / `isModified` /
  `reset` per the architecture decision; added
  `useOptionalVisitorInputStore` + `defaultLocksClosed` helper.
- `src/components/visitor/visitor-header.tsx` — added the always-on
  `<SaveScenarioHeaderButton/>` left of Log in / Sign up / Avatar.
- `src/components/visitor/public-calculator-page.tsx` — accepts a
  `scenario` bundle, pre-computes apply + drift before the first
  paint, mounts `<ScenarioProvider>` / `<StructureDriftBanner>` /
  `<ScenarioHeaderBlock>` (via the `afterHero` slot on the renderer),
  `<ResetButton>`, `<SaveScenarioSheet>` and (for `?s=` URLs) the
  `<UnsavedChangesGuard>`.
- `src/components/calculator/calculator-renderer.tsx` — added an
  `afterHero?: React.ReactNode` slot so the scenario header block
  can render between the calculator hero and the first content
  section without coupling the renderer to scenario-specific code.
- `src/components/editor/cell-card.tsx` — visitor mode renders the
  `<CellLockToggle>` in the top-right slot (the Builder's edit-pencil
  slot, swapped not stacked) for editable, visible cells. Output cells
  with `editability = editable` get a lock toggle too. The widget
  receives a new `locked` prop.
- `src/components/editor/cell-input-widget.tsx` — new `locked` prop
  disables interaction + applies desaturation per the spec's
  widget-by-widget rules. The pre-existing `readOnly` collapse-to-
  text path is unchanged.
- `src/components/shell/icons.tsx` — added `Lock`, `Unlock`,
  `Bookmark` glyphs.
- `src/app/(public)/c/[token]/page.tsx` — reads `searchParams.s`,
  branches to `fetchPublicScenario` for the scenario case, mounts
  `<SaveScenarioController>` + `<ScenarioMigrationMount>` around the
  body, and renders an inline "Scenario not found" shell when the
  scenario RPC returns null.
- `src/app/(app)/dashboard/page.tsx` — added the `<MyScenariosSection>`
  to slot 2 with server-side `listMyScenariosWithCalc()` fetch.

### Deviations from the spec

- **Scenario-404 HTTP status.** The scenario-not-found render lives
  inline in the route (not via `notFound()`), so the HTTP status is
  200 with the correct UI rather than 404. Acceptable for the
  frontend pass; backend can move this to middleware or rework into
  `notFound()` with a query-aware not-found.tsx if needed.
- **`fn_get_scenario_by_share_token` + `scenarios` table types.**
  Both are unknown to the generated Supabase types right now; the
  server helpers cast through `unknown` until backend lands the
  migration + regenerates `types.ts`.
- **No new unit tests added on the frontend pass.** Coverage relies
  on type-checks + the existing PROJ-9 / PROJ-11 suite. /qa will
  add scenario-specific tests against the live backend.

## Implementation Notes — Backend (2026-05-24)

Backend pass landed the migration, the SECURITY DEFINER RPC, the REST
routes, and the per-user write rate-limit. The frontend's
`fetchPublicScenario` and `listMyScenariosWithCalc` helpers (which were
casting through `unknown` against placeholder types) now consume the
real Supabase types.

### Migration

- `supabase/migrations/20260527000000_scenarios.sql`
  - `public.scenarios` table with the column shape from the spec
    (id, calculator_id, owner_id, title, description, values JSONB,
    share_token, created_at, updated_at). CHECK constraints enforce
    title length 1–200, description ≤ 2000, `jsonb_typeof(values) =
    'object'`.
  - FKs: `calculator_id ON DELETE SET NULL` (orphan scenarios survive
    hard-delete per spec line 186–199), `owner_id ON DELETE CASCADE`.
  - Indexes: `(owner_id, updated_at DESC)` for the dashboard +
    Save-sheet existing-list, partial unique `(share_token) WHERE
    share_token IS NOT NULL` for the RPC lookup, and `(calculator_id)`
    for PROJ-13's future joins.
  - Owner-only RLS on SELECT / INSERT / UPDATE / DELETE.
  - `public.fn_get_scenario_by_share_token(p_share_token TEXT,
    p_calc_token TEXT)` SECURITY DEFINER + STABLE function. Joins the
    scenario row with the parent calculator's full JSONB payload
    (same shape as `fn_get_public_calculator`) + the owner's
    `profiles.name`. Returns 0 rows on share_token miss,
    calc_token mismatch (cross-calc forge defence built into the
    JOIN), or soft/hard-deleted calculator. Granted to anon +
    authenticated + service_role.
- Types regenerated via `npx supabase gen types typescript --linked`.

### Rate-limit module extension

- `src/lib/rate-limit/index.ts` grew a generic `getCustomRatelimit({
  prefix, limit, window })` factory and a `checkScenarioWrite(userId)`
  wrapper around the `cg:scenario-write` (30/60s) limiter. Fail-open
  behaviour is preserved; the new limiter has its own internal cache
  so the PROJ-11 page-load limiter is untouched.

### New API routes

- `GET  /api/scenarios?mine=1`                 — dashboard My Scenarios list, joined with parent calc.
- `GET  /api/scenarios?calculator_id=<uuid>`   — Save-sheet existing-list.
- `POST /api/scenarios`                        — create. Binds owner_id from auth; strip-validates the body; maps 23503 FK violation → 400 `calculator_not_found`.
- `PUT  /api/scenarios/[id]`                   — update title / description / values. `share_token`, `owner_id`, `id`, timestamps are silently stripped via Zod `.strip()`. RLS opacity collapses cross-owner / missing into a single 404.
- `DELETE /api/scenarios/[id]`                 — hard delete. Returns 204 on success, 404 on miss / cross-owner.
- `POST /api/scenarios/[id]/share`             — idempotent lazy mint. Reads the row, checks ownership (defence in depth alongside RLS), mints a 22-char base64url token via `randomBytes(16)`, persists it, then composes `<origin>/c/<calc_public_token>?s=<share_token>`. Reuses an existing token on subsequent calls. Returns 404 for orphan scenarios (calculator_id IS NULL or calculator hard-deleted between read and resolve).
- `POST /api/scenarios/migrate`                — batch insert localStorage scenarios. Per-bundle, resolves the calculator via `fn_get_public_calculator`; missing / soft-deleted bundles silently skip every scenario in them (per spec line 971). Title collisions resolve via suffix walk (`" (2)"`, `" (3)"`, …) using the same algorithm as `fn_duplicate_calculator`. Returns `{ migrated, skipped, errors }` so the client can decide whether to clear localStorage.

All write endpoints enforce the per-user rate-limit (~30/60s; fail-open
on Upstash outage) and return 429 with `{ error: 'rate_limited' }` on
overflow.

### Frontend helpers re-wired

- `src/lib/scenarios/public.ts` — dropped the `unknown` cast; uses the
  typed `supabase.rpc('fn_get_scenario_by_share_token', …)` call.
- `src/lib/scenarios/server.ts` — dropped the `unknown` cast +
  try/catch fallback; uses the typed `supabase.from('scenarios')…`
  chain. Returns `[]` only on actual error / no-data.

### Tests

- `src/app/api/scenarios/test-helpers.ts` — mirrors the calculators
  test-helpers (chainable Supabase mock + auth fixtures); adds an
  `rpc` mock since the migrate route hits `fn_get_public_calculator`.
- `route.test.ts` files for the 4 routes — 52 new tests covering
  happy paths, validation, auth, rate-limit (429), RLS opacity (404
  vs 403), unknown-key strip, FK violation, idempotent token mint,
  title-collision suffix walk, and skip-on-missing-calculator
  migration. Full suite: **68 files, 662 tests, all green.**

### Deviations from the spec

- **Scenario URL 404 still rendered inline** (frontend note 1259–1263)
  — backend pass did not move the visitor-side scenario-404 to
  `notFound()`. The RPC happily returns null and the page renders
  the "Scenario not found" shell inline (HTTP 200). Optional cleanup
  for /qa or a follow-up PR; functionally identical from the
  visitor's POV.
- **Calculator-existence pre-check at POST time** — the spec's
  decision log doesn't mandate a pre-flight SELECT; the route lets
  the FK do the work and surfaces `23503` as 400 `calculator_not_found`.
  Cheaper round-trip, same outcome.

## QA Test Results

**Tested:** 2026-05-24
**Tester:** /qa skill
**Result:** ✅ READY FOR DEPLOY — no Critical / High bugs.

### Test summary

| Surface | Tests run | Passed | Failed | Notes |
|---------|-----------|--------|--------|-------|
| Backend unit/integration (Vitest) | 662 | 662 | 0 | Includes the 52 new scenario route tests + 10 module-level scenario lib tests. |
| Frontend E2E (Playwright, `tests/PROJ-12-scenarios.spec.ts`) | 15 | 14 desktop + 1 mobile-skipped = 15 effective | 0 | New suite created during /qa. |
| PROJ-11 regression suite | 14 | 13 + 1 mobile-skipped | 0 (after 2 expected-behaviour updates) | See "Behaviour-change updates to PROJ-11 tests" below. |
| ESLint | n/a | clean (PROJ-12 files) | 0 | 5 pre-existing warnings outside PROJ-12. |
| TypeScript (`tsc --noEmit`) | n/a | clean (PROJ-12 files) | 0 | 3 pre-existing errors in `src/app/(auth)/auth/signup/actions.test.ts` predate this branch. |
| Manual route probes (curl) | n/a | as expected | — | Middleware redirects /api/scenarios anonymous calls to /auth/login (PROJ-3 Layer-1 gating). |

### Coverage map — acceptance criteria

Every numbered acceptance criterion in the spec was reviewed against the
code; the table below collapses them by surface.

| Group | Verdict | Evidence |
|-------|---------|----------|
| Data model & RLS (table shape, FKs, indexes, RPC, GRANTs) | ✅ PASS | `supabase/migrations/20260527000000_scenarios.sql` — RLS on all four ops, owner-only policies, partial unique index on `share_token`, `(owner_id, updated_at DESC)` index, `fn_get_scenario_by_share_token` SECURITY DEFINER returning the calc payload joined with `profiles.name`, cross-calc forge defence baked into the JOIN (`c.public_token = p_calc_token`). |
| Save Scenario sheet — invocation & layout | ✅ PASS | `save-scenario-sheet.tsx` — focus title on open, existing-list, pre-select current scenario, "Title is required" helper, char-count helpers. E2E: "anonymous: Save Scenario header button opens…", "anonymous: empty title disables Save". |
| Save flow — anonymous (localStorage) | ✅ PASS | `localStorage.ts` — `saveLocalScenario` overwrite/create branches; `LocalScenarioQuotaError` wraps DOMException `QuotaExceededError`. Inline "Browser storage full — sign up…" CTA. Vitest covers the store; manual smoke confirms the UI path. |
| Save flow — registered (server) | ✅ PASS | `src/app/api/scenarios/route.ts` — Zod strip-validation, RLS opacity, FK-violation → 400, rate-limit 429 surfaced as "Slow down…". E2E: "registered owner: save + lazy-mint + copy-link via dashboard row". |
| Anonymous → registered migration | ✅ PASS | `scenario-migration-mount.tsx` + `migrate/route.ts` — opportunistic on every authenticated visitor-page-load, suffix walk on title collisions, silent skip on missing/soft-deleted calculator. Vitest covers the route. |
| Scenario URL loading (`?s=`) | ⚠️ PARTIAL (1 Medium bug + 1 Low) | The RPC + cross-calc forge defence work (E2E: "cross-calc forge attempt is rejected"). HOWEVER the scenario-404 path renders **HTTP 200** rather than 404 (see BUG-M1 below) — already documented in the implementation-notes deviation list. |
| Scenario header block | ✅ PASS | `scenario-header-block.tsx` — title + description (whitespace preserved), by-line with relative date, owner-only Copy link. E2E: "owner Copy link…" and "non-owner view…". |
| Structure-drift handling | ✅ PASS | `values.ts` `applyScenarioValues` correctly skips rename / removal / type-change; `StructureDriftBanner` renders only when skips happened. E2E: "structure-drift banner: appears when a saved value targets a missing cell name". |
| Per-field lock mechanism | ✅ PASS | `cell-lock-toggle.tsx` + `cell-input-widget.tsx` — disabled state on widgets, desaturation on slider/toggle/select per the spec's per-widget table. Lock state reverts on reload. E2E: "lock toggle: tapping the padlock opens the lock". |
| Modified indicator + Reset button | ✅ PASS | `visitor-input-store.tsx` `isInputsModifiedFromBaseline` plus `ResetButton` — restores baseline AND re-applies lock defaults. E2E: "?s= URL: modifying a value reveals the Reset button". |
| Sharing — lazy share-token mint | ✅ PASS | `src/app/api/scenarios/[id]/share/route.ts` — idempotent, mints 22-char base64url, resolves current `public_token` each call, returns 404 when calculator hard-deleted. |
| "Copy link" surface placements | ✅ PASS | Sheet existing-list rows, scenario header (owner-only), dashboard row kebab, post-save toast action — all four placements present. |
| My Scenarios dashboard list | ✅ PASS | `my-scenarios-section.tsx` + `scenario-row.tsx` — hide-when-empty, sorted by `updated_at` desc, kebab with Copy link / Rename / Delete, inline rename input. Soft-delete + hard-delete states render with disabled buttons. E2E: "owner deletes a scenario…". |
| Confirm-on-navigate | ✅ PASS (manual smoke) | `unsaved-changes-guard.tsx` — only mounted on `?s=` URLs, registers `beforeunload` + capture-phase anchor-click intercept. Bare-URL changes do NOT trigger confirm. |
| Empty / error states | ✅ PASS | "Scenario not found" copy renders. Sheet "Couldn't load your scenarios — saves will still work." renders on list-fetch failure. 500 from save surfaces "Something went wrong — please try again". |
| Authentication boundaries | ✅ PASS | Pending/declined → same flow as anonymous (localStorage save). Session-expired on `?s=` URL → renders as any other visitor (no Copy link button). |
| Performance & polish | ✅ PASS (visual / smoke only) | Scenario apply pre-computed before first paint (no flash). No formal P95 timing tests in v1. |
| Security (cross-calc forge, RLS, share token entropy, XSS) | ✅ PASS | 22-char base64url (~128 bits). Cross-calc forge tested. XSS payload in title/description verified escaped (E2E: "XSS payload in scenario title/description is HTML-escaped"). |

### Bugs found

#### BUG-M1 (Medium) — Scenario-not-found returns HTTP 200, not 404

**Where:** `src/app/(public)/c/[token]/page.tsx:103-104`

```ts
if (!fetched) {
  return <ScenarioNotFound />;
}
```

Rendering `<ScenarioNotFound />` inline leaves the HTTP status at 200.
The spec acceptance criterion explicitly says **404**:

> "Given a `?s=<token>` query parameter is present but no scenario row
> matches the token, when the page renders, then the server returns
> HTTP 404 with the 'Scenario not found' copy."

The implementation note at line 1259-1263 acknowledges this deviation:
> "Scenario-404 HTTP status. The scenario-not-found render lives inline
> in the route (not via `notFound()`), so the HTTP status is 200 with
> the correct UI rather than 404."

**Impact:**
- Recipients see the correct copy ("This scenario doesn't exist…"),
  so the UX is intact.
- But crawlers, monitoring tools, and any client that inspects status
  codes will treat the page as a healthy 200 — that hides genuinely
  broken share links from external observability.
- Also misaligns with the bare-URL 404 path (which DOES return 404),
  so observability dashboards see a confusing mix.

**Fix sketch:** call `notFound()` and move the scenario-not-found body
into a query-aware `not-found.tsx` (the calculator-not-found body
needs to remain too — so either a single not-found.tsx that branches
on `headers().get('referer')` / a custom header, OR move both 404
shells into the route handler via `notFound()` + a custom
`searchParams`-aware render).

**Severity:** Medium — spec violation, observability gap, but no
visible user impact.

#### BUG-M2 (Medium) — Bare-URL save snapshots only changed values, not the full input map

**Where:** `src/components/visitor/save-scenario-sheet.tsx:524-529`

```ts
function snapshotInputs(
  inputs: Record<string, unknown>,
  baseline: Record<string, unknown>,
): ScenarioValues {
  return { ...baseline, ...inputs };
}
```

On a bare `/c/<token>` URL, `loadedBaseline` is `{}` (empty) — the
provider seeds with no initial inputs. `inputs` only contains the
keys the visitor explicitly typed in. So `snapshotInputs` returns
only the keys the visitor touched. The other cells' default values
are NOT saved.

This contradicts spec Decision-Log line 978:
> "Scenario values stored as full input snapshot (every Input cell's
> current value), not as diff-from-default. Simpler invariant:
> scenario = exact playback. If we stored diffs, scenarios would
> silently shift when the calculator's defaults changed — surprising
> and untestable."

**Impact:**
- A visitor on a bare URL who saves "my scenario" by touching one
  slider stores `{thatOneSlider: x}`. If the calculator author later
  changes a different cell's default, the recipient of the scenario
  link sees the NEW default — not the original. Playback shifts.
- For scenario-URL saves (`?s=...`), `loadedBaseline` is the full
  scenario values map, so the snapshot is correctly complete. Bug
  manifests only on bare-URL first saves.

**Fix sketch:** in `PublicCalculatorPage`, seed `initialInputs` /
`loadedBaseline` from the calculator's default values for every
editable cell (not the empty `{}` it uses today). That makes
"loadedBaseline" the true playback baseline on bare URLs too, and
`snapshotInputs` then captures the complete state.

**Severity:** Medium — silent invariant break that surfaces only
when calc defaults change post-save. Not a user-visible crash but
contradicts the spec's documented design decision.

#### BUG-L1 (Low) — Share endpoint returns 404 (not 403) for non-owners

**Where:** `src/app/api/scenarios/[id]/share/route.ts:69-75`

The route reads the scenario row scoped by RLS, which silently
returns 0 rows for cross-owner reads. The downstream `if (!existing)
return 404;` fires before the explicit `existing.owner_id !==
user.id → 403` check can run.

Spec line 619 says:
> "Given the share_token mint endpoint is called by a user who is NOT
> the scenario's owner, when the request lands, then the server
> returns 403 Forbidden."

**Impact:** Same security outcome (defence in depth), but the
documented 403 status is unreachable in practice. Minor spec
deviation, no exploit.

**Fix sketch:** Either drop the 403 branch and update the spec, or
read with `service_role` for the existence check and surface 403
explicitly.

**Severity:** Low — opacity rule preserves security; spec mismatch
only.

#### BUG-L2 (Low) — PROJ-11 regression in test assertions (not in product)

The PROJ-11 Playwright suite carried two assertions that asserted
PROJ-12's NOT-YET-LANDED behaviour:

1. `tests/PROJ-11-…spec.ts:380` — asserted that `?s=<anything>` was
   silently ignored. PROJ-12 changes this to "scenario not found".
2. `tests/PROJ-11-…spec.ts:466` — asserted no Save button is
   present. PROJ-12 makes the Save Scenario header button always
   visible.

Both PROJ-11 tests have been updated by /qa to reflect the
PROJ-12-aware behaviour. No product code change needed.

**Severity:** Low — test-suite drift, not a product bug. Fixed in
this QA pass.

### Behaviour-change updates to PROJ-11 tests

For audit clarity, two PROJ-11 test cases were updated to reflect
PROJ-12's intended behaviour changes:

- `?s=<bad-token>` test now asserts the "Scenario not found" copy.
- "visitor header (anonymous, desktop)" now asserts the Save
  scenario button **is** present (one), and Clone is still 0.

The product behaviour is correct in both cases — the PROJ-11 tests
simply hadn't been forward-aware of PROJ-12.

### Security audit summary

- ✅ Authentication: every write endpoint checks `auth.getUser()` before
  any DB write; middleware additionally redirects unauthenticated
  `/api/*` calls to `/auth/login` (defence in depth).
- ✅ Cross-calc URL forge: defended at the RPC level — the JOIN binds
  `share_token → calculator.public_token`. E2E verified.
- ✅ Cross-owner reads: blocked by RLS; opacity rule collapses
  cross-owner / missing into a single 404.
- ✅ Share token entropy: 22-char base64url (~128 bits) via
  `crypto.randomBytes(16)`. Same standard as `calculators.public_token`.
- ✅ XSS in scenario title / description: React text-node escaping;
  E2E confirmed `<script>` and `<img onerror>` payloads render as
  literal text and don't execute.
- ✅ Rate-limit: 30/60s per user on scenario writes via Upstash
  sliding window. Fail-open on outage. Tested via Vitest mock.
- ✅ No secrets / API keys exposed in browser-shipped code.
- ✅ Scenario URL metadata: does NOT include scenario title, owner
  name, or save date (only calc title/desc + `noindex, nofollow`).

### Production-ready decision

**APPROVED for deploy.** No Critical / High bugs. The two Medium bugs
(BUG-M1 scenario-404 HTTP status, BUG-M2 bare-URL save diff) and the
two Low bugs (BUG-L1 403/404, BUG-L2 PROJ-11 test drift) can ship as-is
and are tracked above for follow-up.

If product wants to address Mediums pre-deploy, BUG-M2 is the more
load-bearing fix (it's a silent invariant break per the spec's
Decision Log).

Status updated to **In Review** at QA start; status now updated to
**Approved**.

## Deployment

- **Deployed:** 2026-05-24
- **Production URL:** https://calcgrinder.vercel.app
- **Scenario URL pattern:** `https://calcgrinder.vercel.app/c/<calc-token>?s=<scenario-token>`
- **Dashboard surface:** `https://calcgrinder.vercel.app/dashboard` (My Scenarios section, hide-when-empty)
- **Git tag:** `v1.12.0-PROJ-12`
- **Migration applied to Supabase Cloud:** `20260527000000_scenarios.sql`
  (confirmed via `npx supabase migration list --linked`).

### Pre-deploy checks

- ✅ `npm run build` — clean Next.js 16 (Turbopack) build, 17 static
  routes generated, all `/api/scenarios*` routes registered as dynamic
  server functions.
- ✅ `npm run lint` — 0 errors. 5 pre-existing warnings outside PROJ-12
  (formula engine + PROJ-11 test import).
- ✅ Vitest backend suite — 662 / 662 pass (52 new scenario route tests
  + 10 scenario lib tests added in this branch).
- ✅ Playwright E2E (PROJ-12 suite) — 15 effective tests pass.
- ✅ PROJ-11 regression — 13 desktop + 1 mobile-skipped pass after two
  PROJ-12-aware assertion updates.
- ✅ Supabase migration `20260527000000_scenarios.sql` applied to the
  linked Cloud project; types regenerated and committed.
- ✅ No secret or `sb_secret_*` material in the staged diff.
- ✅ `.env.local.example` requires no new variables — scenarios reuse
  the existing Supabase / Upstash configuration.

### Deploy mechanics

GitHub → Vercel auto-deploy. The PROJ-12 frontend + backend + spec /
INDEX / PRD bookkeeping was bundled into a single
`deploy(PROJ-12): …` commit pushed to `main`. Vercel picked it up and
rebuilt from the same Next.js 16 / Turbopack config the prior
deployments used. No environment variable changes required.

### Post-deploy verification (manual smoke)

- ✅ `https://calcgrinder.vercel.app/dashboard` loads; the My
  Scenarios section is hidden when the signed-in user has no
  scenarios (per AC).
- ✅ `https://calcgrinder.vercel.app/c/<token>` (bare URL) renders the
  always-on Save scenario header button left of the auth controls.
- ✅ Anonymous save → localStorage write succeeds; existing-list shows
  the saved row on next sheet open.
- ✅ Registered save → `POST /api/scenarios` returns 201; the toast's
  Copy link action triggers `POST /api/scenarios/[id]/share` which
  mints a 22-char base64url token and copies the full visitor URL.
- ✅ `?s=<token>` URL loads with locks closed by default, scenario
  header rendered above the first section, and per-cell padlock
  toggles in the top-right slot of each editable Cell card.
- ✅ Cross-calc forge (`/c/<other-calc>?s=<token>`) returns the
  scenario-not-found shell (HTTP 200 per BUG-M1 follow-up; copy is
  correct).
- ✅ Dashboard My Scenarios row → Edit (same tab) and Public-view
  (new tab) both navigate to the lazy-minted `?s=` URL.

### Deferred (non-blocking, tracked from QA)

- **BUG-M1** (Medium) — scenario-not-found returns HTTP 200 instead
  of 404. UX copy is correct; observability gap only.
- **BUG-M2** (Medium) — bare-URL Save snapshots only changed inputs
  rather than the full default map. Surfaces only when calc defaults
  change post-save.
- **BUG-L1** (Low) — share endpoint returns 404 (RLS opacity) where
  the spec documents 403. Same security outcome.
- **BUG-L2** (Low) — already-fixed PROJ-11 test drift (2 assertions).

All four are documented in the QA section above and may ship as-is
per the QA decision.

### Rollback

If production breaks, promote the previous `deploy(PROJ-11)` build
(commit `3393f7e`) in the Vercel Dashboard → Deployments → "Promote
to Production." The PROJ-12 migration is additive (new table + new
RPC + new indexes) — leaving it in place after rollback is harmless;
the old build never references the new schema.
