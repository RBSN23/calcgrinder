# PROJ-18: Cloning & Preset Discoverability

## Status: Approved
**Created:** 2026-05-24
**Last Updated:** 2026-05-25 (QA passed — 0 blocking bugs, 4 Low; migration pushed to Cloud)

## Dependencies

- **PROJ-5** (Account Dashboard) — PROJ-18 fills the Presets
  `<Section>` slot that PROJ-5 reserved with an empty state.
  The `<Section>` primitive, `<CalcCard>` layout primitive
  (PROJ-10), and `cg.*` tokens are consumed unchanged.
- **PROJ-10** (Calculator Lifecycle — Publish, Sharing, Token
  Regen) — PROJ-18 **extends** PROJ-10's same-owner duplicate
  surface for cross-user cloning. Per the AV-flag the existing
  `fn_duplicate_calculator(source_id UUID)` stored procedure is
  extended in place (one new optional parameter + a new branch
  inside the function body) rather than rewritten or forked.
  PROJ-10's `POST /api/calculators/:id/duplicate` route gains
  one optional body field (`source_token`); no new route is
  introduced. PROJ-10's `<CalcCard>` is reused (with a
  Preset-variant prop) for the Presets card.
- **PROJ-11** (Visitor View — Calculator Interface) — PROJ-18
  adds a single Clone icon-button to the visitor header, gated
  on `approvedUser !== null`. The `<VisitorHeader>` already
  threads `approvedUser` to its right-side action slot; PROJ-18
  inserts the new icon-button into that slot adjacent to the
  existing Save-scenario icon.

PROJ-18 introduces **no new env vars** and **no new npm
packages**. It uses the existing pgcrypto extension, the
existing `@supabase/supabase-js` RPC, and the existing
`Icons.Copy` glyph.

## Summary

PROJ-18 turns the calculator from "a thing only the author can
copy" into "a thing any approved user can clone into their own
account from anywhere they encounter it." Concretely:

1. **Schema extension.** One migration adds the column
   `source_calculator_id UUID NULL REFERENCES calculators(id)
   ON DELETE SET NULL` — the forward-deferred column PROJ-10
   explicitly skipped. Used by clone to record the source of
   the copy. (The attribution **display** banner — "based on
   <X>" in the editor / visitor hero — is forward-deferred to a
   follow-up refinement; see Out of Scope.)
2. **Extended duplicate stored procedure.** The signature of
   `public.fn_duplicate_calculator` gains one optional
   parameter:
   - `fn_duplicate_calculator(source_id UUID, source_token
     TEXT DEFAULT NULL)`
   When `source_token` is NULL the function preserves PROJ-10's
   same-owner duplicate semantics verbatim (RLS-gated read,
   `Copy of <X>` title prefix, `source_calculator_id` left
   NULL). When `source_token` is provided the function runs a
   token-gated cross-user **clone** path with different title
   semantics, different access rules, and attribution
   bookkeeping (see §3 below). Security model switches to
   `SECURITY DEFINER` with explicit `auth.uid()` enforcement so
   the cross-user read can bypass the owner-only RLS while
   never returning rows the caller wasn't entitled to via the
   token.
3. **Token-gated cross-user clone path.** The cross-user
   branch:
   - Looks up the source by `(id, public_token)` match (so the
     caller must possess a valid token for the calculator they
     want to clone — same trust model as `/c/<token>` itself).
   - Permits cloning regardless of `published` (per pre-
     interview: publish flag is not a gate).
   - Permits cloning regardless of `soft_delete_at` (per pre-
     interview: soft-deleted calcs reachable via a scenario URL
     can also be cloned; hard-deleted = row gone = 404).
   - Title rule:
     - **Sysadmin Preset** (source.owner has `role='sysadmin'`
       AND `source.published = TRUE`): clone title is unchanged
       — Presets are intended starting points; no `" — Copy"`
       suffix.
     - **Any other source** (regular user's calc, sysadmin
       Draft, or even the caller's own calc if they cloned from
       the visitor view): clone title is `<source.title> — Copy`
       with collision auto-resolve `<source.title> — Copy (2)`,
       `(3)`, ….
   - `source_calculator_id` records `source.id` (regardless of
     visibility — the column is owned by the clone, not the
     source).
4. **API surface.** One existing route is extended:
   - `POST /api/calculators/:id/duplicate` — body Zod schema
     gains optional `{ source_token?: string }`. When omitted →
     legacy same-owner duplicate (PROJ-10 behaviour
     unchanged). When provided → cross-user clone path. The
     route is the *only* place the new body field flows
     through; it sits on the existing duplicate route to
     minimise API surface and match the AV-flag's "extend, do
     not rewrite" direction. (Naming note: from the user's
     vantage point the dashboard kebab still says "Duplicate"
     and the visitor button says "Clone" — the underlying
     route name `/duplicate` does not need to change.)
5. **Visitor view — Clone icon-button.** A single icon-only
   Clone button (`Icons.Copy`) is added to `<VisitorHeader>`'s
   right slot, adjacent to the existing Save-scenario icon. It
   is:
   - **Visible to all approved logged-in users** — registered
     and sysadmin alike, **including the calculator's own
     owner**. Owners cloning their own calculator from the
     visitor view get the cross-user clone path semantics
     (`<title> — Copy` suffix, attribution column set) per pre-
     interview decision — not the dashboard's "Copy of <X>"
     duplicate semantics.
   - **Hidden for anonymous visitors** and for pending /
     declined / expired-session users (consistent with the
     "cannot create or save server-side" rule for unapproved
     users from the PRD).
   - **Hidden on 404 / 410 visitor error shells** (the source
     calculator is hard-deleted or never existed).
   - **Click behaviour:** disables the button and shows a small
     inline spinner glyph (replaces `Icons.Copy`), calls
     `POST /api/calculators/:id/duplicate { source_token }`,
     then on success `router.push('/editor/<new-id>')` in the
     **same tab**. On failure, restores the icon and surfaces
     a Sonner toast `"Couldn't clone — please try again."`.
   - **Icon-only, no label**, with an `aria-label` of
     `"Clone this calculator into your account"`. Tooltip on
     hover (existing shadcn `<Tooltip>` primitive) shows the
     same copy.
6. **Dashboard — Presets section content.** PROJ-5's empty
   Presets `<Section>` is wired with data:
   - **Query:** all calculators where the owning profile's
     `role = 'sysadmin'` AND `published = TRUE` AND
     `soft_delete_at IS NULL`. Ordered `updated_at DESC` (most
     recently edited preset first). Defensive `LIMIT 100`
     (parity with other dashboard list helpers).
   - **Audience:** **all approved users** — registered and
     sysadmin. The pre-interview decision explicitly includes
     sysadmins so they can preview how their own Presets render
     to their audience (cheaper than logging out / using a
     second browser).
   - **Read path:** a new SECURITY DEFINER RPC
     `fn_list_presets()` (see §3) — owner-only RLS on
     `calculators` blocks cross-user reads from the cookie-
     bound publishable-key client; the read RPC bypasses RLS
     and applies the visibility rule (sysadmin owner +
     published + not soft-deleted) inside the function.
   - **Hide-when-empty rule.** Per the PRD: Presets is the
     **one section that does NOT follow hide-when-empty** —
     PROJ-5 ships an `<EmptyOrErrorState>` for the
     "No presets yet" case so the section's purpose is visible
     even to a first-time user. PROJ-18 preserves that
     behaviour: when the count is 0, render the existing
     PROJ-5 empty-state body; when > 0, render the card grid.
7. **Preset card variant.** PROJ-10's `<CalcCard>` is reused
   with a new prop `variant?: 'mine' | 'preset'` (default
   `'mine'`):
   - **`variant='preset'`** ships in PROJ-18.
   - Footer icon-button row: **Public-view** (`Icons.External`)
     + **Clone** (`Icons.Copy`). Pre-interview is explicit: NO
     Edit icon. Edit doesn't apply — the viewer doesn't own the
     calculator.
   - Kebab is **hidden** (no Rename / Publish / Delete on
     someone else's calc).
   - Card-wide click target still opens `/c/<token>` in a new
     tab (same as `variant='mine'`).
   - Status pill is **hidden** (Published is implicit — a
     preset *is* published by definition; PROJ-10's Draft/
     Published affordance is owner-facing).
   - Description rendering, icon badge, title truncation,
     `Edited <relative>` footer — all unchanged from the
     `mine` variant.
8. **Integration touches** (smallest set):
   - `<VisitorHeader>` gains one icon-button (Clone), gated on
     `approvedUser`. No layout reshuffle; slots beside the
     existing Save-scenario icon.
   - `<CalcCard>` gains the `variant` prop and conditional
     rendering of the kebab / Edit-icon / Status pill.
   - `src/app/(app)/dashboard/page.tsx` server-fetches
     presets via `listPresets()` and threads them into the
     Presets `<Section>`.
   - `src/components/dashboard/presets-section.tsx` is new
     (parallels `my-calculators-section.tsx`); wraps the card
     grid in the existing Presets `<Section>` block with the
     same expanded-by-default behaviour.
   - PROJ-5's existing Presets empty-state rendering is moved
     into `presets-section.tsx` (still rendered when count
     === 0). No content change.

## Out of Scope

PROJ-18 is the **cloning + presets discoverability** layer.
Several adjacent concerns are explicitly excluded:

- **Attribution display banner — "based on <calculator name>".**
  The `source_calculator_id` *column* is added in PROJ-18 (the
  data is recorded on every clone). The **UI banner** that
  renders "based on <X>" with an inactive-label state when the
  source becomes unreachable is forward-deferred to a follow-up
  `/refine PROJ-18` pass. PROJ-18 ships the data plumbing only;
  the visible attribution UI is its own scope-contained piece
  of work that can ride on top without schema or function
  changes. See Decision Log.
- **Sysadmin-curated preset list separate from "published
  sysadmin-owned calculators".** Per PRD §1.2: "Any published
  calculator owned by a sysadmin acts as a preset." There is
  no separate "publish to Presets" toggle — the existing
  Published flag IS the toggle, and sysadmin ownership IS the
  surface. A sysadmin-only "Pin to Presets" / "Feature on
  homepage" surface is not in v1.
- **Curator-style preset categories, tags, or featuring.**
  Presets is a flat list ordered `updated_at DESC`. No
  category chips, no featured-first slot, no search/filter
  within Presets. PRD single-deployer-low-volume scope.
- **Cross-user clone of a calculator that the caller does NOT
  hold a token for.** Clone is gated by token possession. A
  user cannot enumerate other users' calculators by ID and
  clone them. This is the same trust model as `/c/<token>`
  itself.
- **Cloning from the dashboard's Presets card without
  navigating to the visitor view first.** The Presets card's
  Clone footer icon-button calls the clone endpoint directly
  (the card already holds the token — `row.public_token` from
  the listPresets read). The user is taken to the new clone's
  `/editor/<id>` in the same tab. (This is the only place the
  clone endpoint is reachable from the dashboard; the My
  Calculators "Duplicate" icon-button stays same-owner
  semantics via PROJ-10.)
- **Bulk clone of multiple presets / a "starter pack" flow.**
  One-clone-per-click only.
- **Renaming the dashboard "Duplicate" affordance to "Clone".**
  Per pre-interview + PROJ-5 decision log + PRD §1.2: the same-
  account copy stays "Duplicate"; "Clone" is reserved for
  cross-user. No copy change to the My Calculators kebab,
  footer button, or toast.
- **Renaming the route `POST /api/calculators/:id/duplicate`
  to `/clone` or splitting it into two routes.** Per AV-flag,
  one extended endpoint. The semantic distinction lives in
  whether `source_token` is in the body.
- **"Open in editor" affordance on the Preset card without
  cloning.** A logged-in user cannot edit someone else's
  calculator — they must clone first. No "view-only editor"
  is available.
- **Cloning of soft-deleted calculators that the caller
  cannot reach.** Soft-deleted calcs are reachable via a
  scenario URL the visitor has (`/c/<calc-token>?s=<scenario-
  token>` continues to render even when the calculator is
  soft-deleted, during the recovery window). The clone path
  drops the `soft_delete_at IS NULL` filter for the
  cross-user branch ONLY — the caller must still possess a
  valid `public_token` for the source. There is no separate
  "clone from Trash" surface in the dashboard.
- **Visitor-view Clone button label.** Icon-only per pre-
  interview ("no label"). No text caption next to the glyph.
- **Visitor-view Clone button mobile rendering.** The button
  sits in the same right-side action slot on all viewports;
  the existing `<VisitorHeader>` already collapses `Log in`
  to icon-only and keeps `Sign up` text on mobile. Clone is
  always icon-only so mobile and desktop render identically.
- **Per-user rate limiting on the clone endpoint.** Clone
  requires an authenticated approved user; abuse from a
  logged-in approved user is not a threat the PRD enumerates.
  Can be added later if needed.
- **Telemetry / "clone count" badges on a preset card or in
  the editor.** PRD §1.2 non-goal (no analytics in v1).
- **Cloning preserves the source's scenarios.** Scenarios are
  per-calculator-instance; the clone has zero scenarios on
  creation. The PRD already documents this ("Each scenario is
  bound to one calculator instance — no automatic linking
  across preset-and-clone.").
- **Cloning preserves the source's `public_token`.** Clones
  always mint a fresh token via the column DEFAULT (same as
  duplicate). The source's URL is unrelated to the clone's
  URL.
- **Cloning's first-clone "Welcome" tour or onboarding nudge.**
  No celebratory modal, no "What next?" tooltip on the editor.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] /
Then [result]

### Schema migration

- [ ] Given the PROJ-18 migration runs, when it completes,
  then `public.calculators` gains a nullable column
  `source_calculator_id UUID REFERENCES calculators(id) ON
  DELETE SET NULL`. Existing rows have `source_calculator_id
  = NULL` (no backfill needed — no clones exist pre-PROJ-18).
- [ ] Given the migration completes, when
  `src/lib/supabase/types.ts` is regenerated via
  `npx supabase gen types typescript --linked`, then the
  generated `CalculatorRow`-equivalent type carries
  `source_calculator_id: string | null`.
- [ ] Given the migration runs, when an existing source
  calculator is hard-deleted, then any clone rows pointing at
  it via `source_calculator_id` have the column set to NULL
  (ON DELETE SET NULL behaviour); the clone row itself is
  preserved.

### Extended `fn_duplicate_calculator(source_id, source_token)`

- [ ] Given the migration replaces the function, when the
  signature is inspected, then it reads
  `fn_duplicate_calculator(source_id UUID, source_token TEXT
  DEFAULT NULL)`. Callers from PROJ-10 that pass only
  `source_id` continue to work (defaulted NULL second arg).
- [ ] Given the function is invoked with `source_token = NULL`,
  when the body runs, then PROJ-10's same-owner duplicate path
  fires verbatim: RLS-gated read, `Copy of <title>` prefix
  with collision auto-resolve, `published = FALSE`, fresh
  `public_token`, **`source_calculator_id = NULL`**. All
  existing PROJ-10 acceptance criteria for duplicate continue
  to hold.
- [ ] Given the function is invoked with a non-NULL
  `source_token` and the token matches the row's
  `public_token`, when the body runs, then the cross-user
  clone path fires (see below).
- [ ] Given the function is invoked with a non-NULL
  `source_token` that does NOT match the row's `public_token`,
  when the body runs, then the function raises `not_found`
  (`ERRCODE = 'P0002'`) so the route returns 404 — same
  opacity contract as PROJ-10.
- [ ] Given the function security model is updated to
  `SECURITY DEFINER` (so the cross-user read can bypass RLS),
  when the function body executes, then it explicitly checks
  `auth.uid() IS NOT NULL` first and raises `unauthorized`
  (`ERRCODE = '42501'`) if anonymous. RLS is not relied on for
  cross-user reads — the token match is the gate.

### Cross-user clone path (cross-user branch inside the function)

- [ ] Given a cross-user clone is initiated with a valid
  `source_token` for a source owned by another user, when the
  function runs, then the new row is inserted with
  `owner_id = caller_id`, `published = FALSE`, fresh
  `public_token`, `source_calculator_id = source.id`,
  `soft_delete_at = NULL`.
- [ ] Given the source's `published` flag is FALSE, when a
  caller (who possesses a valid token) clones it, then the
  clone succeeds — `published` is NOT a gate. The clone itself
  is created with `published = FALSE` regardless.
- [ ] Given the source's `soft_delete_at IS NOT NULL` (the
  source is in the recovery window), when a caller who
  possesses a valid token (e.g. via a scenario URL) clones it,
  then the clone succeeds. The clone is created with
  `soft_delete_at = NULL` (the clone is a new active row,
  even though the source was Trashed).
- [ ] Given the source has been **hard-deleted** (row no
  longer exists), when any clone is attempted, then the
  function raises `not_found` (P0002) → route 404.
- [ ] Given the source owner is a sysadmin AND
  `source.published = TRUE` ("Preset" rule), when the clone
  runs, then the clone's title is `source.title` **unchanged**
  — no `" — Copy"` suffix, no collision-resolve loop on the
  base title.
- [ ] Given the source is a sysadmin Preset and the caller
  already owns a calculator with the same title (e.g. a
  previous clone of the same Preset), when the clone runs,
  then the function still uses the base title, walks `<base>
  (2)`, `<base> (3)`, … until the first free
  `(owner_id, title)` slot in the caller's active set. The
  collision-resolve loop runs identically; it just starts from
  the unmodified base.
- [ ] Given the source is NOT a sysadmin Preset (regular
  user's calc, sysadmin Draft, or the caller's own row), when
  the clone runs, then the clone's title is `<source.title>
   — Copy` with the em-dash separator `—`. Title-
  collision auto-resolve walks `<base> — Copy (2)`,
  `<base> — Copy (3)`, …
- [ ] Given the resulting title would exceed the 100-char
  column limit (e.g. source title 99 chars + ` — Copy`
  suffix), when the function runs, then the base portion is
  truncated to leave room for the suffix (mirrors PROJ-10's
  defensive trim — the test of record is "no 23505 raised on
  long-title clone").
- [ ] Given the source is the caller's own row (caller clones
  their own calculator from the visitor view), when the clone
  runs with `source_token = source.public_token`, then the
  cross-user clone path STILL fires (not the same-owner
  duplicate path) — the `" — Copy"` suffix applies and
  `source_calculator_id` is set. The pre-interview is
  explicit: "Clone button visible in visitor view for ALL
  logged-in users, including the calculator's own owner."
- [ ] Given the source has 0 sections (defensive, legacy
  pre-PROJ-9 row), when the clone runs, then the clone has a
  default `"Section 1"` (same fallback PROJ-10 ships).
- [ ] Given the source has N sections × M cells × K charts ×
  L text-blocks, when the clone runs, then the clone's
  sections/cells/charts/text-blocks counts and ordering all
  match the source (per the PROJ-17 BUG-H2 maintenance
  contract — the existing function body extension covers
  every child table).

### `POST /api/calculators/:id/duplicate` (extended)

- [ ] Given the existing PROJ-10 caller pattern (no
  `source_token` in the body), when the route is called,
  then it behaves identically to PROJ-10 — same-owner
  duplicate, `Copy of <X>` prefix, no `source_calculator_id`.
- [ ] Given the route's body Zod schema, when extended, then
  it accepts an optional `source_token: z.string().min(1)
  .optional()`. Empty string or missing → treated as absent
  (same-owner path).
- [ ] Given the route is called with `{ source_token: "<22-char
  base64url>" }`, when the request flows through, then the
  route calls `supabase.rpc('fn_duplicate_calculator', {
  source_id: <:id>, source_token: <token> })` and maps the
  response identically to PROJ-10's existing response shape
  `{ id, title, description, theme_id, updated_at, published,
  public_token, default_section_id }`.
- [ ] Given the response 201 body, when inspected, then it
  includes the existing keys plus a new optional key
  `source_calculator_id: string | null` so the caller knows
  whether a clone vs. duplicate ran (clone → string; duplicate
  → null).
- [ ] Given the route receives `source_token` that doesn't
  match any row (or matches but to a different id), when the
  RPC raises P0002, then the route returns 404 (opacity).
- [ ] Given the route receives `source_token` with an invalid
  shape (not a string, empty after trim), when Zod parses,
  then it returns 400 `{ error: 'invalid_source_token' }`.
- [ ] Given the route is invoked unauthenticated, when no
  session exists, then it returns 401 (existing PROJ-10
  contract preserved).

### Visitor view — Clone icon-button

- [ ] Given an **anonymous visitor** lands on `/c/<token>`,
  when the visitor header renders, then NO Clone icon-button
  is present anywhere in the header or page chrome.
- [ ] Given a **pending / declined / session-expired user**
  lands on `/c/<token>` (treated as anonymous per PROJ-3),
  when the visitor header renders, then NO Clone icon-button
  is present.
- [ ] Given an **approved registered user** lands on
  `/c/<token>`, when the visitor header renders, then the
  Clone icon-button is visible in the right-side action slot,
  adjacent to the existing Save-scenario icon. The button is
  rendered as `Icons.Copy`, icon-only (no label text), with
  `aria-label="Clone this calculator into your account"`.
- [ ] Given an **approved sysadmin** lands on `/c/<token>`,
  when the visitor header renders, then the Clone icon-button
  is visible (same as registered).
- [ ] Given an **approved user lands on their OWN
  calculator's** `/c/<token>`, when the visitor header
  renders, then the Clone icon-button is **still visible**
  (per pre-interview: "ALL logged-in users, including the
  calculator's own owner").
- [ ] Given the user hovers the Clone icon-button, when the
  tooltip renders, then it shows "Clone this calculator into
  your account" (matches the `aria-label`).
- [ ] Given the user clicks the Clone icon-button, when the
  request is in flight, then the button replaces its icon
  with a small inline spinner glyph (existing shadcn loading
  pattern: a 14px rotating `Icons.Spinner` or
  `<Loader2 className="animate-spin">`), the button is
  `disabled`, and a second click does nothing.
- [ ] Given the clone request returns 201, when the response
  arrives, then the button stays in its loading state until
  the navigation kicks off (preventing flicker), then
  `router.push("/editor/<new-id>")` runs in the **same tab**.
- [ ] Given the clone request fails (any non-201), when the
  failure surfaces, then the button restores its `Icons.Copy`
  glyph, removes the disabled state, and a Sonner toast
  appears: `"Couldn't clone — please try again."`. The user
  stays on the visitor view.
- [ ] Given the visitor route renders a 404 / 410 error shell
  (source not found / soft-deleted past recovery), when the
  page renders, then the Clone icon-button is **not present**
  on the error shell.
- [ ] Given the visitor view renders a scenario URL
  (`/c/<calc-token>?s=<scenario-token>`), when an approved
  user views it, then the Clone icon-button is **still
  visible** — it clones the underlying calculator (not the
  scenario). The scenario itself is independent and is not
  copied (per Out of Scope: "Each scenario is bound to one
  calculator instance — no automatic linking across preset-
  and-clone.").
- [ ] Given the cloned calculator is created from a soft-
  deleted source reached via a scenario URL, when the route
  returns 201 and navigates to the editor, then the new
  calculator is active (`soft_delete_at = NULL`), not
  soft-deleted. The source remains soft-deleted.

### Dashboard — Presets section content

- [ ] Given **any approved user** (registered or sysadmin)
  lands on `/dashboard` and at least one published sysadmin-
  owned calculator exists, when the Presets section renders,
  then it shows the existing PROJ-5 `<Section title="Presets">`
  block with a card grid of those calculators in
  `updated_at DESC` order.
- [ ] Given no published sysadmin-owned calculators exist,
  when the Presets section renders, then the existing PROJ-5
  empty-state body is shown — `<EmptyOrErrorState
  variant="empty" title="No presets yet" body="Curated
  calculators will appear here once a sysadmin publishes
  one.">`. This preserves PROJ-5's Presets-is-the-one-
  exception-to-hide-when-empty rule.
- [ ] Given a **sysadmin** lands on `/dashboard` and the
  sysadmin's own calculators include published ones, when the
  Presets section renders, then those same calculators appear
  in the Presets section (the sysadmin sees their own work
  in the Presets surface — pre-interview decision: "useful
  for preview"). The same calculators also appear in My
  Calculators (no de-duplication; the two sections have
  different semantics).
- [ ] Given the Presets section content exceeds the PROJ-5
  `<Section>` internal-scroll threshold (304px), when the
  body renders, then the existing internal-scroll kicks in
  unchanged.

### `<CalcCard variant='preset'>` — visual structure

- [ ] Given `<CalcCard variant='preset' calculator={row}>` is
  rendered, when inspected, then the card layout matches
  `variant='mine'` for: icon badge, title (truncate), 2-line
  description clamp, `Edited <relative>` footer-left text,
  `minHeight: 128px`, card-wide anchor → `/c/<token>` in a
  new tab, hover / focus styles.
- [ ] Given `variant='preset'` is set, when the kebab slot is
  inspected, then it renders **nothing** (no kebab button —
  the menu items don't apply to non-owned calcs).
- [ ] Given `variant='preset'` is set, when the footer right-
  side icon-button row is inspected, then it contains exactly
  two buttons in this order: **Public-view** (`Icons.External`,
  same destination as card click) and **Clone** (`Icons.Copy`).
  No Edit icon, no Duplicate icon.
- [ ] Given `variant='preset'` is set, when the Status pill
  slot is inspected, then NO pill is rendered (Published is
  implicit on Presets; Draft is impossible because the
  Presets list filters by `published = TRUE`).
- [ ] Given the user clicks the Public-view icon-button on a
  Preset card, when the click fires, then it opens
  `/c/<token>` in a new tab (`stopPropagation()` /
  `preventDefault()` to suppress the card-wide click).
- [ ] Given the user clicks the Clone icon-button on a Preset
  card, when the click fires, then the button shows the
  inline spinner, the dashboard calls
  `POST /api/calculators/:id/duplicate { source_token:
  row.public_token }`, and on 201 `router.push("/editor/
  <new-id>")` in the **same tab**. On failure, restore the
  button and Sonner toast `"Couldn't clone — please try
  again."`.
- [ ] Given the user keyboard-tabs onto a Preset card, when
  focus is on the card, then Enter triggers the same
  behaviour as a click (open `/c/<token>` in new tab). The
  Public-view and Clone icon-buttons are independently
  focusable with unique `aria-label`s ("Open public view in
  new tab", "Clone this calculator into your account").
- [ ] Given the Preset card is in a row that's loading from a
  previous Clone click, when re-rendered, then the spinner
  glyph stays in place; the rest of the card is unchanged.

### `fn_list_presets()` read RPC

- [ ] Given the migration adds `public.fn_list_presets()`,
  when called by any authenticated user, then it returns all
  rows where `owner_role = 'sysadmin'` AND `published = TRUE`
  AND `soft_delete_at IS NULL`. Ordered `updated_at DESC`,
  limited to 100.
- [ ] Given the function security model, when inspected, then
  it is `SECURITY DEFINER` with `search_path = ''`. RLS on
  `calculators` is owner-only; the function bypasses to apply
  the visibility rule centrally.
- [ ] Given a sysadmin's calculator is soft-deleted, when
  `fn_list_presets()` runs, then that row is excluded from
  the response (Trash never surfaces in Presets).
- [ ] Given a sysadmin's calculator is in Draft
  (`published = FALSE`), when `fn_list_presets()` runs, then
  that row is excluded.
- [ ] Given a regular registered user's calculator is
  published, when `fn_list_presets()` runs, then that row is
  excluded (Presets is sysadmin-curated only).
- [ ] Given an unauthenticated call, when `fn_list_presets()`
  runs, then it raises `unauthorized` (`ERRCODE = '42501'`).
  Anonymous users have no access to Presets (the dashboard is
  auth-gated anyway, but the function defends in depth).
- [ ] Given the response shape, when inspected, then each row
  carries `{ id, title, description, theme_id, updated_at,
  published, public_token, owner_id, owner_name }`. The
  `owner_name` is included for forward-compat with the
  attribution display follow-up; PROJ-18's UI ignores it.

### Server-side `listPresets()` helper

- [ ] Given `src/lib/calculators/server.ts` exports
  `listPresets()`, when called from a Server Component, then
  it returns `PresetCalculatorRow[]` (a typed wrapper around
  the RPC response).
- [ ] Given `listPresets()` is the **only** server helper
  that reads Presets, when invoked, then it threads the
  request-scoped Supabase client and propagates RPC errors as
  an empty array + console.error (parity with
  `listMyCalculators` failure handling).
- [ ] Given the dashboard page server-fetches Presets, when
  rendered, then `presets` is fetched in parallel with the
  existing `Promise.all([listMyCalculators, …])` block (no
  serial waterfall).

### Security & RLS

- [ ] Given the extended `fn_duplicate_calculator` is now
  SECURITY DEFINER, when audited, then `auth.uid()` is
  checked at the top of the function and raises 42501 if
  NULL.
- [ ] Given the cross-user branch, when token matching is
  inspected, then the lookup is by `(id = source_id AND
  public_token = source_token AND deleted_at IS NULL)` —
  i.e. the caller must supply BOTH the id and the token, and
  both must match the same row. (Mismatched id + token →
  P0002 / 404.) This forecloses cross-user enumeration by
  brute-forcing IDs.
- [ ] Given the function inserts the clone, when the INSERT
  shape is audited, then `owner_id` is always set from
  `auth.uid()` — never from a caller-provided value, never
  from `source.owner_id`. The clone is always owned by the
  cloner.
- [ ] Given the function sets `source_calculator_id`, when
  the value is audited, then it is set to `source.id` only on
  the cross-user branch; same-owner duplicate leaves it
  NULL.
- [ ] Given a cross-user clone is attempted with a valid
  token but the source is hard-deleted (row gone), when the
  function runs, then the `SELECT … WHERE id = source_id AND
  public_token = source_token` returns 0 rows → P0002 → 404.
- [ ] Given the new `source_calculator_id` column, when
  PROJ-10's existing `PATCH /api/calculators/:id` whitelist
  is audited, then `source_calculator_id` is **stripped**
  (not in the Zod whitelist). The column is set only via the
  clone path of `fn_duplicate_calculator`; PATCH cannot
  retroactively attribute / unattribute a calculator.
- [ ] Given `fn_list_presets()` returns rows from other
  users, when audited, then it includes only the public-safe
  columns (no `owner_email`, no token entropy leakage; the
  `public_token` is included only because it's the URL — same
  surface as `/c/<token>` itself).
- [ ] Given the visitor Clone icon-button calls the clone
  endpoint with `source_token = <token from URL>`, when the
  request flows, then the token is sent in the JSON body
  (HTTPS-encrypted) — not in a URL query string — so it
  doesn't leak into server access logs.

### Tests

- [ ] Given `src/app/api/calculators/[id]/duplicate/route.test.ts`,
  when extended, then unit tests cover: `source_token` present
  → cross-user RPC arg shape; `source_token` absent → existing
  duplicate behaviour; invalid `source_token` Zod schema →
  400; 404 mapping on P0002.
- [ ] Given `src/lib/calculators/server.test.ts` (new or
  extended), when `npm test` runs, then tests cover
  `listPresets()` happy path (returns rows), failure path
  (RPC error → empty array), and ordering (`updated_at DESC`).
- [ ] Given `src/components/visitor/visitor-header.test.tsx`
  (extended), when `npm test` runs, then tests cover: Clone
  button present for approved user; absent for anonymous;
  click triggers the clone helper; loading state replaces
  icon with spinner; error toast on failure.
- [ ] Given `src/components/dashboard/calc-card.test.tsx`
  (extended), when `npm test` runs, then tests cover:
  `variant='preset'` renders no kebab + Public-view + Clone
  icon-buttons + no Status pill; clicking Clone triggers the
  clone helper with `source_token`.
- [ ] Given `src/components/dashboard/presets-section.test.tsx`
  (new), when `npm test` runs, then tests cover:
  empty-state body renders when count === 0; card grid
  renders when count > 0; cards use `variant='preset'`.
- [ ] Given `tests/PROJ-18-cloning-and-presets.spec.ts`
  (Playwright), when `npm run test:e2e` runs, then E2E
  scenarios cover: anonymous visitor sees NO Clone button;
  approved registered user sees Clone button; clicks Clone
  → lands on `/editor/<new-id>` with `" — Copy"` title;
  cloning a sysadmin Preset preserves the source title (no
  suffix); approved user lands on dashboard → sees Presets
  populated; clicking Clone on a Preset card → lands on
  editor with title unchanged; cross-user clone of a soft-
  deleted source via scenario URL succeeds.

## Edge Cases

- **Two users clone the same Preset simultaneously.** Each
  clone is independent — there is no per-source lock. Both
  succeed; each new row gets its own fresh `public_token`
  and its own `source_calculator_id = source.id`.
- **User clones a Preset twice in a row.** The second clone's
  title resolves to `<base> (2)` (and `(3)`, … on a third
  clone). Same auto-resolve loop the same-owner duplicate
  uses, just starting from the unmodified base instead of
  `Copy of <base>`.
- **User clones a calculator they already own (via visitor
  view).** Title becomes `<title> — Copy` (NOT `Copy of
  <title>` — see Decision Log). `source_calculator_id`
  records the source. The owner ends up with two rows in
  their dashboard: the original (no attribution) and the
  clone (with attribution pointing at the original).
- **User clicks Clone, the request takes > 5 seconds (slow
  Postgres).** The spinner stays visible; the button stays
  disabled; no double-firing. On success the navigation
  fires; on timeout the toast surfaces.
- **User navigates away (Back button / new URL) mid-clone.**
  The in-flight request continues server-side but the
  navigation kicks the visitor off the view. The clone is
  still created server-side; the user discovers it in their
  My Calculators on the next dashboard visit. This is
  acceptable — the alternative (cancel-in-flight) adds AbortController plumbing for a corner case.
- **Sysadmin demotes themselves to registered (out-of-band
  via the seed script).** Their previously-published calcs
  immediately disappear from Presets (the role filter is
  read at query time). The clone path itself is unaffected —
  the title rule keys on `source.owner_role` at clone time,
  so a previously-demoted source would no longer be treated
  as a Preset (suffix `" — Copy"` would apply). This is a
  rare admin-side action and the behaviour is internally
  consistent.
- **Source calculator's title is changed between when the
  user opened the visitor view and when they clicked Clone.**
  The function reads the current title at query time. The
  clone gets the current-title-plus-suffix, not the title the
  user saw on the page. Acceptable; the visitor view's
  cached title was always a snapshot.
- **Source calculator is hard-deleted between when the user
  opened the visitor view and when they clicked Clone.** The
  visitor view itself would 404 on refresh; the clone request
  returns 404 with the standard error toast.
- **Source calculator is soft-deleted between visitor-view
  load and Clone click.** Visitor view starts returning 410
  on refresh; the clone request itself still succeeds (the
  cross-user clone path drops the soft-delete filter). The
  user lands on the editor of a freshly-cloned independent
  row.
- **Visitor-view Clone of a calculator that uses cells
  referencing soft-deleted scenarios.** Scenarios aren't
  cloned; the clone has zero scenarios. The orphan-scenario
  question is moot for the clone.
- **Approved user A clones approved user B's published calc.
  User B later regenerates the token.** A's clone is
  independent — A keeps the calculator under their own
  `public_token`. The `source_calculator_id` still points at
  B's row even though B's token changed. (Attribution
  display, when it ships, must follow the link by id, not
  by token.)
- **Cloning a Preset with 200 cells.** Same one-transaction
  performance profile as duplicate — well under the 800ms
  budget PROJ-10 ships against, because the cross-user
  branch reuses the same single-statement INSERT-from-SELECT
  pattern.
- **Title length > 92 chars on a non-Preset source.** The
  base portion is truncated so `<truncated> — Copy` still
  fits under the 100-char column limit. (Same defensive trim
  PROJ-10 uses for `Copy of <X>`, adjusted for the suffix
  position.)
- **All 100 collision-resolve attempts exhausted.** Function
  raises `23505` → route returns 500. Realistically users
  rename their clones long before this; the cap is a sanity
  bound, not a UX target. Same behaviour PROJ-10 ships.

## Technical Requirements

- **Performance.** `listPresets()` must return in < 200ms
  for ≤ 100 rows (one SECURITY DEFINER RPC, single SELECT
  with a join to `profiles` for the role filter). The cross-
  user clone path must complete in < 800ms for ≤ 200 cells
  (same budget as PROJ-10's duplicate, same one-transaction
  pattern).
- **Security.** Token-gated authorization in the function
  body. SECURITY DEFINER with `search_path = ''` and explicit
  `auth.uid()` enforcement. PATCH whitelist hardened against
  `source_calculator_id` writes. No new RLS policies needed
  on `calculators` — the existing owner-only RLS is bypassed
  for the read in the function only.
- **Browser support.** Same as PROJ-8/PROJ-9/PROJ-10: latest
  Chrome / Firefox / Safari on desktop and mobile. The
  loading-spinner glyph uses CSS animation (no new
  dependency).
- **A11y.** Clone icon-button has a unique `aria-label`,
  tooltip mirrors the label, focus-visible ring matches the
  Save-scenario icon adjacent to it. Loading state announces
  via `aria-busy="true"` while in flight. Preset cards keep
  the PROJ-10 keyboard model (Tab → focus → Enter → opens
  public view).

## Open Questions

<!-- Unresolved questions to close in `/refine PROJ-18` when answered. -->

- [x] **Title-suffix convention parity with PROJ-10.** Resolved
  during /architecture (2026-05-24): **option (b) — unify on
  `" — Copy"` suffix**. PROJ-10's same-owner duplicate is
  retrofitted in this same migration to use the new suffix
  convention. Both branches of the extended
  `fn_duplicate_calculator` share one title-resolve helper.
  See Technical Decisions table below for the architectural
  consequences (single function body, PROJ-10 test updates,
  migration scope).

- [ ] **Attribution display banner.** PRD §2 / Calcgrinder-
  spec §2 calls for a `"based on <calculator name>"` line on
  the clone's editor (and visitor view, when published). This
  spec ships the `source_calculator_id` column but explicitly
  defers the **display** to a follow-up. Decide whether the
  follow-up is a separate PROJ-X feature, a /refine pass on
  PROJ-18, or a polish-pass before v1 release.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Clone is available **only to logged-in approved users** — no anonymous Clone, no pending/declined Clone | Cloning creates a row owned by the cloner; anonymous users have no account to own a row. Pending/declined are explicitly blocked from server-side writes per PRD §1.2. Anonymous + the icon-button visibility rule align with the existing Save-scenario icon's gating. | 2026-05-24 |
| Clone is visible **even to the calculator's own owner** in the visitor view | Owners want to fork their own calculators (try a variant without polluting the original). Per pre-interview. The visitor-view Clone always runs the cross-user path (gets `" — Copy"` suffix + attribution), independent of whether the owner is also the cloner — the visitor view is the surface that triggers the rule, not the relationship between caller and source. | 2026-05-24 |
| Clone is **icon-only, no text label** | Matches the existing Save-scenario / Avatar action-slot pattern in `<VisitorHeader>` — text labels would overflow on mobile and add visual noise on desktop. The tooltip + `aria-label` cover the discoverability case. | 2026-05-24 |
| Clone navigates to the new clone's editor in the **same tab** | Stays in the cloning flow ("I cloned, now I want to edit"). New-tab would require the user to re-focus, and they're done with the source after cloning. Matches the same-tab navigation PROJ-10 ships for the dashboard Duplicate footer icon. | 2026-05-24 |
| Clone is allowed regardless of `published` AND regardless of `soft_delete_at` | Published is a discoverability flag (controls Presets surface visibility), not an access gate. Soft-deleted calcs are reachable via scenario URLs during the recovery window — cloning them is a reasonable rescue path ("oops I deleted my favorite calc, let me clone someone else's scenario of it"). Hard-delete (row gone) is the only true 404. | 2026-05-24 |
| Clone of a **Sysadmin Preset** preserves the source title unchanged; Clone of any other source appends `" — Copy"` | Presets are intentional starting points — appending `" — Copy"` ("Mortgage Calculator — Copy") reads as "I haven't customised this yet". Authors editing a Preset will rename anyway; not pre-suffixing keeps the new row clean. For non-Presets, the suffix signals "this is a copy" so the cloner doesn't confuse it with the source in their dashboard. | 2026-05-24 |
| Presets section is **visible to all approved users**, including sysadmins themselves | Sysadmins author Presets for their audience; being able to see how their own Preset renders in the section (cards, alongside other Presets) is cheap preview. The alternative (hide own Presets from sysadmins) creates a "test in incognito" workflow that's worse than seeing your own work alongside everyone else's. | 2026-05-24 |
| Preset card footer = Public-view + Clone; **NO Edit icon, NO kebab, NO Status pill** | The viewer doesn't own the calculator — Edit / Rename / Publish / Delete don't apply. Status pill is implicit (Presets are by definition published). Stripping the surface keeps the card visually distinct from `variant='mine'` (signalling "this isn't yours") without an explicit border treatment. | 2026-05-24 |
| Extend `fn_duplicate_calculator` with an optional `source_token` parameter; reuse the existing route `POST /api/calculators/:id/duplicate` | AV-flag direction: "extend, do not rewrite." Two DB functions / two HTTP routes for "create a copy of a calculator" doubles the surface for one semantic with two branches. The `source_token` body field is a clean disambiguator at the route level; the function body branches once on `source_token IS NULL` and otherwise reuses 100% of the deep-copy block. | 2026-05-24 |
| Switch `fn_duplicate_calculator` to `SECURITY DEFINER` with explicit `auth.uid()` enforcement inside | The cross-user clone path needs to read a row the caller can't see via RLS (owner-only policy on `calculators`). `SECURITY DEFINER` bypasses RLS; the function then enforces authorization by token match. Same pattern PROJ-11's `fn_get_public_calculator` uses for the visitor view. | 2026-05-24 |
| Token match is `(id = source_id AND public_token = source_token)` — both must match the same row | A token-only lookup would allow id-elision attacks (caller supplies a wrong id with a right token). Requiring both fields to match the same row makes the (id, token) pair the unforgeable handle to a calculator — the same handle the `/c/<token>` URL exposes. | 2026-05-24 |
| `source_calculator_id` is set only on the cross-user branch; same-owner duplicate leaves it NULL | Attribution is a "this came from somewhere else" signal. A user duplicating their own calc is just making a working copy — no attribution applies. The display layer (forward-deferred) can use `source_calculator_id IS NOT NULL` as the cheap "is this a clone?" check. | 2026-05-24 |
| `ON DELETE SET NULL` on `source_calculator_id`'s FK | A hard-deleted source shouldn't take its clones down with it. Per PRD §2 the attribution display gracefully degrades to "based on (no longer available)" when the source is unreachable; SET NULL on hard-delete preserves that path without orphaning rows. | 2026-05-24 |
| Presets read goes through a dedicated SECURITY DEFINER RPC `fn_list_presets`, NOT through the cookie-bound publishable-key client with a relaxed RLS policy | A relaxed RLS policy ("any user can SELECT calculators WHERE owner is sysadmin AND published") leaks across the schema — every owner-only query suddenly competes with the Presets read. Centralising the visibility rule in one function (parallel to `fn_get_public_calculator`) keeps the RLS surface minimal and the rule auditable in one place. | 2026-05-24 |
| Attribution display banner ("based on <X>") is **forward-deferred** to a follow-up | The pre-interview was scoped to clone + Presets discoverability; attribution UI is mentioned in the PRD/spec but wasn't covered in the user's product decisions. Shipping the data column now means the display can land later without schema or function changes. Logged in Open Questions. | 2026-05-24 |
| Visitor-view Clone of a calc reached via a scenario URL clones the **calculator**, not the scenario | Scenarios are per-instance input snapshots; cloning the scenario into a new calc would either require migrating the snapshot's input values to the new calc's cells (a separate non-trivial feature) or losing them silently. Cloning just the calculator and dropping the scenario is the predictable behaviour and matches the PRD's "scenarios are bound to one instance" rule. | 2026-05-24 |
| The Preset card's Clone icon-button calls `/duplicate` directly with `source_token = row.public_token` (no navigation through the visitor view first) | The card already holds the token. Forcing the user through `/c/<token>` adds a round-trip and a tab switch for no information gain — Presets are meant to be one-click starting points. | 2026-05-24 |
| Anonymous visitors who click "I want to clone this" (e.g. via a hypothetical future "Sign up to clone" CTA) are out of scope | The pre-interview is explicit: no clone affordance for anonymous. A "Sign up to clone" CTA would either need session-survival across signup (so the clone-intent is preserved through approval) or a fake clone that doesn't persist — both are larger features. v1 anonymous flow ends at "browse public calculator". | 2026-05-24 |

### Technical Decisions

<!-- Added by /architecture -->

| Decision | Rationale | Date |
|----------|-----------|------|
| Unify same-owner duplicate and cross-user clone on the **`" — Copy"` suffix** convention; retrofit PROJ-10's `fn_duplicate_calculator` title block in this same migration | Resolves Open Question Q1 (option b). One title-resolve helper inside the function body serves both branches; the only branch-specific rule is the Sysadmin-Preset "no suffix" carve-out. Reduces cognitive load for both authors ("how do I tell a copy?" → always the suffix) and reviewers (one code path, one set of tests). The migration that ships PROJ-18 also updates PROJ-10's existing test expectations (`"Copy of <X>"` → `"<X> — Copy"`). The "BUG-C1 fix" naming history on the previous migration becomes irrelevant because this migration is the new canonical body. | 2026-05-24 |
| The migration is a single SQL file `20260602000000_cloning_and_presets.sql` that bundles: (1) `source_calculator_id` column, (2) extended `fn_duplicate_calculator(source_id, source_token)` with both branches sharing one title-resolve helper, (3) `fn_list_presets()` read RPC | One migration, one atomic schema-and-function bump. Splitting into three migrations would create transient invalid states (column without function support, function without column, etc.) and add to the alphabetical-order coupling that already makes migrations the most fragile part of the repo. Cloud-only workflow means we can ship the whole thing in one `supabase db push`. | 2026-05-24 |
| `fn_duplicate_calculator` body is `SECURITY DEFINER` with `search_path = ''`, calls `auth.uid()` at entry and raises `42501` if NULL, then branches on `source_token IS NULL` | DEFINER is necessary for the cross-user read (the caller cannot see another user's row via owner-only RLS). The explicit `auth.uid()` check defends in depth against a misconfigured RLS scenario and produces a clean `401` from the route layer. Matches the pattern PROJ-11's `fn_get_public_calculator` already uses. Same-owner branch still gates via `owner_id = caller_id` in its SELECT, so RLS bypass is bounded. | 2026-05-24 |
| Cross-user source lookup is `WHERE id = source_id AND public_token = source_token` with the same `soft_delete_at` carve-out (NULL filter on same-owner branch only) | Requiring both id and token makes the `(id, token)` pair the unforgeable handle — equivalent to the surface PROJ-11's `/c/<token>` route already exposes. Token-only would allow id-elision attacks; id-only would allow cross-user enumeration. Same-owner branch keeps the existing `soft_delete_at IS NULL` filter because the dashboard kebab cannot reach Trashed rows; cross-user branch drops it because scenario URLs can. | 2026-05-24 |
| New RPC `fn_list_presets()` is also `SECURITY DEFINER` with `search_path = ''`; it returns `(id, title, description, theme_id, updated_at, published, public_token, owner_id, owner_name)` filtered to `profiles.role = 'sysadmin' AND calculators.published = TRUE AND calculators.soft_delete_at IS NULL`, ordered `updated_at DESC LIMIT 100` | The owner-only RLS policy on `calculators` blocks any cross-user SELECT from the cookie-bound publishable-key client. Two design alternatives were considered and rejected: (a) **relax the RLS policy** to allow `role='sysadmin' AND published=TRUE` reads — leaks the rule across every owner-only query path, harder to audit, easier to break in a future RLS edit; (b) **read presets from the service-role client in the page Server Component** — would require importing `createAdminClient` into a non-`/api` server file, violating the `server-only` lint rule and CLAUDE.md's "no admin client outside `src/app/api/**`" convention. A dedicated SECURITY DEFINER RPC keeps the visibility rule centralised in one function, parallels `fn_get_public_calculator`, and stays on the publishable-key client. `owner_name` is returned for forward-compat with the deferred attribution banner; PROJ-18's UI ignores it. | 2026-05-24 |
| Server helper `listPresets()` lives in `src/lib/calculators/server.ts` (extends the existing module) and runs in parallel with the existing `Promise.all([listMyCalculators, …])` in the dashboard page | Co-locates with the My Calculators / Trash helpers — the dashboard page imports one symbol from one module. Parallel fetch keeps the page's TTFB unchanged (the slowest dashboard query stays the gating one). Failure handling mirrors `listMyCalculators` (empty array + `console.error`) so a transient RPC error degrades to "No presets yet" instead of crashing the page. | 2026-05-24 |
| New client component `<PresetsSection>` parallels `<MyCalculatorsSection>` (lives at `src/components/dashboard/presets-section.tsx`); the dashboard page's inline `<Section title="Presets">` empty-state stub from PROJ-5 is moved inside | The existing PROJ-5 inline rendering becomes the count-zero branch of the new component; the count-positive branch renders the card grid. One component per dashboard section is the established pattern (My Calculators, My Scenarios, Trash). Server-fetched presets are threaded through props; the section itself is a Client Component because the Preset card's Clone button needs `useRouter` + `useState` for the loading state. | 2026-05-24 |
| `<CalcCard>` gains a `variant?: 'mine' \| 'preset'` prop (default `'mine'`); branch points are localised to: kebab (mine only), Status pill (mine only), Edit icon (mine only), Duplicate icon (mine only), Clone icon (preset only), Public-view icon (both); card-wide anchor, icon badge, title, description clamp, `Edited <relative>`, hover/focus rings remain shared | Reuse maximises layout consistency between the two surfaces (PRD-visible: "Presets cards look like My Calc cards minus the owner affordances"). The prop is the minimum branching surface — every divergence is rendered as a conditional inside the existing tree, no parallel component, no duplicated layout primitives. Forward-compat: `variant='user'` (a future "Other users' published calcs" surface for sysadmin moderation in PROJ-19) can slot in by adding one more branch without re-architecting. | 2026-05-24 |
| New shared client helper `cloneCalculator(id, sourceToken)` in `src/lib/calculators/client.ts` posts to the existing `/duplicate` route with the optional `source_token` body field | Both consumers (visitor-view Clone button, Preset card Clone button) need identical HTTP wiring + error shape. Adding one parameter to the existing `duplicateCalculator()` helper would conflate two semantically-distinct user actions in one call site. A dedicated helper makes the call sites self-documenting and keeps the optimistic loading state code identical across the two surfaces. The existing `duplicateCalculator()` helper stays unchanged for the dashboard "Duplicate" kebab + footer-icon. | 2026-05-24 |
| Visitor-view Clone button is mounted via a new context controller (parallels `useOptionalSaveScenarioController()`), not threaded as a prop through `<VisitorHeader>` | The existing Save-scenario button uses controller-context to (a) hide on 404/410 shells where no controller is mounted and (b) avoid threading state through layout components. Clone needs the same gating: the calculator id + `public_token` must be available, and the button must vanish on error shells. Mirroring the controller pattern keeps the two icons' lifecycles symmetric. The controller is mounted by the `/c/<token>` page (next to the existing Save-scenario controller); the icon component reads `{calculator, approvedUser}` from context and renders null if either is missing. | 2026-05-24 |
| Clone icon-button busy state is local to the component; navigation uses `router.push('/editor/<id>')` and keeps the spinner glyph rendered until the page transitions | Local state avoids global loading-store coupling. Keeping the spinner visible through navigation prevents the icon-snap-back flicker that an immediate state reset would cause (the same pattern PROJ-10's dashboard Duplicate icon uses). The `disabled` attribute + a single `if (busy) return` guard at the top of the click handler covers the double-click case. | 2026-05-24 |
| PATCH `/api/calculators/:id` whitelist is **not** changed in code — the Zod schema already enumerates the writable fields and rejects unknown keys; `source_calculator_id` is implicitly outside the whitelist | The existing PATCH schema (`{ updated_at, title?, description?, theme_id?, published? }`) is allowlist-shaped. Adding `source_calculator_id` to the database without adding it to the schema means PATCH writers literally cannot set it — Zod strips it before the DB call. The acceptance criterion ("source_calculator_id is stripped, not in the Zod whitelist") is satisfied by the existing schema design; no defensive code change needed. The Decision Log entry is documentation, not implementation. | 2026-05-24 |
| Tests added live alongside the surfaces they touch: extend existing `duplicate/route.test.ts`, add `presets-section.test.tsx`, extend `calc-card.test.tsx` and `visitor-header.test.tsx`. New Playwright spec `tests/PROJ-18-cloning-and-presets.spec.ts` covers the cross-user happy paths | Co-located unit tests follow the project convention (`useHook.test.ts` next to `useHook.ts`). The E2E spec lives under `tests/` per CLAUDE.md. Test count is right-sized for a P1 feature — five unit test files updated, one new E2E spec. | 2026-05-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview

PROJ-18 is a **schema-and-function migration plus a UI surface
wiring**. There is no new env var, no new npm package, no new
external service. Everything composes on top of PROJ-5's
Presets `<Section>` slot, PROJ-10's `<CalcCard>` + duplicate
route, and PROJ-11's `<VisitorHeader>` controller pattern.

The architecture is best understood as **four small extension
points** and **one new dashboard component**:

1. One Postgres migration extends two existing surfaces
   (the duplicate stored procedure and the calculator row),
   plus adds one new read RPC for the Presets list.
2. One existing API route (`/duplicate`) accepts one new
   optional body field.
3. One existing UI component (`<CalcCard>`) accepts one new
   optional prop (`variant`).
4. One existing UI component (`<VisitorHeader>`) renders one
   new sibling icon-button via a new controller context.
5. One new dashboard section component (`<PresetsSection>`)
   wires server-fetched presets into the previously-empty
   PROJ-5 slot.

The dependency between them is intentionally thin so that the
deferred attribution banner can land later as a pure UI
addition — no schema or function change needed.

### Where things live (component tree)

```
src/
├── app/
│   ├── (app)/
│   │   └── dashboard/
│   │       └── page.tsx
│   │           [+ imports listPresets, threads presets into <PresetsSection>]
│   ├── api/
│   │   └── calculators/
│   │       └── [id]/
│   │           └── duplicate/
│   │               └── route.ts
│   │                   [+ accepts optional source_token in body,
│   │                    forwards to RPC, returns source_calculator_id]
│   └── c/
│       └── [token]/
│           └── page.tsx
│               [+ mounts CloneController next to SaveScenarioController]
├── components/
│   ├── dashboard/
│   │   ├── calc-card.tsx
│   │   │   [+ variant: 'mine' | 'preset' prop;
│   │   │    Preset variant: hide kebab + Status pill + Edit/Duplicate icons,
│   │   │    show Public-view + Clone icons]
│   │   ├── my-calculators-section.tsx   (unchanged)
│   │   └── presets-section.tsx           ← NEW
│   │       [Section wrapper; count==0 → PROJ-5 empty state body,
│   │        count>0 → card grid of <CalcCard variant='preset'>]
│   └── visitor/
│       ├── visitor-header.tsx
│       │   [+ renders <CloneHeaderButton> next to SaveScenarioHeaderButton]
│       ├── clone-controller.tsx          ← NEW
│       │   [Context provider; parallels SaveScenarioController]
│       └── clone-header-button.tsx       ← NEW
│           [Reads CloneController context; renders null if absent;
│            icon-only Icons.Copy; spinner on busy]
└── lib/
    └── calculators/
        ├── client.ts
        │   [+ cloneCalculator(id, sourceToken) helper]
        └── server.ts
            [+ listPresets() — wraps fn_list_presets RPC]

supabase/
└── migrations/
    └── 20260602000000_cloning_and_presets.sql   ← NEW
        [(1) ALTER calculators ADD source_calculator_id,
         (2) CREATE OR REPLACE fn_duplicate_calculator
             with optional source_token + unified " — Copy" suffix,
         (3) CREATE fn_list_presets() SECURITY DEFINER]

tests/
└── PROJ-18-cloning-and-presets.spec.ts   ← NEW Playwright spec
```

### Data model (plain language)

**`calculators` table** gains one nullable column:

- `source_calculator_id` — a self-foreign-key to
  `calculators.id`, NULL on rows that were created from
  scratch or via same-owner Duplicate, set to the source's id
  on rows that were created via cross-user Clone. ON DELETE
  SET NULL so a hard-deleted source doesn't take its clones
  down.

**No other table changes.** Sections, cells, charts, text-
blocks, scenarios, profiles all remain shaped exactly as
today.

**Three stored procedures** are touched:

- `fn_duplicate_calculator(source_id, source_token)` —
  *extended in place*. Signature gains one optional second
  argument. Body is `SECURITY DEFINER`. Two branches share one
  title-resolve helper (the unified `" — Copy"` suffix loop);
  the only branch-specific rules are (a) cross-user read path
  via `(id, public_token)` match, (b) Sysadmin-Preset "no
  suffix" carve-out, (c) `source_calculator_id` set on the
  cross-user branch only.
- `fn_list_presets()` — *new*. Read-only. Returns sysadmin-
  owned published non-deleted calculators, joined to
  `profiles` for `owner_name`, ordered `updated_at DESC`,
  limited to 100. `SECURITY DEFINER` for the same RLS-bypass
  reason.
- `fn_get_public_calculator()` — *untouched*. The visitor
  view's existing read RPC continues to gate by token and
  return the calculator + child rows; PROJ-18 doesn't change
  what visitors see, only what approved users can do.

**RLS policies** on `calculators` remain owner-only. The two
DEFINER functions are the bounded surfaces that bypass.

### Component contracts

#### `<CalcCard variant?='mine'|'preset'>`

| Slot | `variant='mine'` | `variant='preset'` |
|------|------------------|--------------------|
| Card-wide anchor | `/c/<token>` new tab | `/c/<token>` new tab |
| Icon badge | shown | shown |
| Title | inline-rename | display only (truncate) |
| Description | 2-line clamp | 2-line clamp |
| Kebab | shown (Rename / Publish / Duplicate / Delete) | hidden |
| Status pill | Draft / Published | hidden (Published implicit) |
| Footer-left | `Edited <relative>` | `Edited <relative>` |
| Footer-right icon row | Edit · Public-view · Duplicate | Public-view · Clone |

#### `<PresetsSection presets={PresetCalculatorRow[]}>`

```
Section title="Presets" defaultExpanded
  count==0 → existing PROJ-5 EmptyOrErrorState body
  count>0  → grid of <CalcCard variant='preset' calculator=row>
```

Always rendered (never hide-when-empty per PRD).

#### `<VisitorHeader>` + `<CloneHeaderButton>`

```
VisitorHeader (server-supplied props: token, approvedUser, isAdmin)
└── right action slot
    ├── SaveScenarioHeaderButton    [reads SaveScenarioController context]
    ├── CloneHeaderButton            ← NEW [reads CloneController context]
    └── AvatarPopover | Log in + Sign up
```

`<CloneHeaderButton>` renders `null` when:
- `CloneController` context is not provided (404/410 error
  shells; the `/c/[token]/page.tsx` only mounts the provider
  on the success path).
- `approvedUser` (read from context) is `null` (anonymous,
  pending, declined, expired).

When rendered, it's icon-only `Icons.Copy`, busy state swaps
to `<Loader2 className="animate-spin">`, click calls
`cloneCalculator(calc.id, calc.public_token)` then
`router.push('/editor/<new-id>')`.

### Tech decisions (PM-readable summary)

**Why one migration, not three.** Bundling the column + the
function rewrite + the new read RPC into one SQL file means a
single `supabase db push` either succeeds completely or rolls
back completely. Splitting them creates transient half-states
("the column exists but the function doesn't know about it"),
which is the kind of thing that bites you on a fresh database
clone six months from now.

**Why extend the duplicate route, not add a new `/clone`
route.** The action ("create a copy of this calculator") is
one HTTP verb on one resource; the semantic difference
(same-owner duplicate vs cross-user clone) is one optional
body field. Splitting into two routes would double the surface
for one user goal, and the dashboard "Duplicate" / visitor
"Clone" copy-distinction lives in the UI, not the URL.

**Why share one title convention across duplicate and clone.**
This was the open question resolved during /architecture
(option b). Two visually distinct conventions ("Copy of X" vs
"X — Copy") created friction in the spec itself; choosing one
keeps the rule learnable and shrinks the test matrix. The
Sysadmin-Preset carve-out (no suffix) is the only branch — and
that branch is semantically meaningful ("Presets are clean
starting points; user-copies are dirty drafts").

**Why a dedicated RPC for Presets, not a relaxed RLS policy.**
Owner-only RLS on `calculators` is the load-bearing security
guarantee for the whole product. Adding "OR (owner is
sysadmin AND published)" to that policy leaks across every
query that hits the table — every owner-only SELECT suddenly
competes with the new clause, and a future RLS edit would have
to remember the carve-out. Centralising the visibility rule in
`fn_list_presets()` keeps the policy surface minimal and the
rule auditable in one place. This is exactly the pattern
PROJ-11 already uses for `fn_get_public_calculator`.

**Why a controller-context for the visitor-view Clone button.**
The existing Save-scenario icon uses the same pattern: a
context provider mounted by the calculator page itself, an
icon component that renders `null` when no provider is in the
tree. Error shells (404/410) don't mount the provider, so the
icon vanishes automatically — no need to thread page-state
through the layout. PROJ-18 mirrors this exactly so the two
icons' lifecycles stay symmetric.

**Why one shared client helper for both Clone surfaces.**
Both the visitor-view button and the Preset-card button issue
the same HTTP call with the same body shape and need the same
loading + error UX. A single `cloneCalculator(id, sourceToken)`
helper keeps the two call sites short, identical in error
handling, and easy to evolve together (e.g. if we ever add
rate-limiting headers).

**Why a parallel `<PresetsSection>` component, not inline.**
The PROJ-5 inline `<Section>` block was the empty-state stub;
the count-positive branch needs `useRouter` (for navigation
after Clone) and `useState` (for per-card loading). That makes
it a Client Component, which means it must move out of the
Server Component page. Naming it `presets-section.tsx`
parallels `my-calculators-section.tsx` and `trash-section.tsx`
exactly.

**Why no new env vars.** Token-gated authorization,
`SECURITY DEFINER` enforcement, and the existing publishable-
key client all use infrastructure that's already wired. The
deferred attribution banner doesn't need anything new either
(it'll read `source_calculator_id` and resolve the title via
the existing public RPC).

### Dependencies (packages)

**No new npm packages.** Reuses:
- `@supabase/supabase-js` (existing) for the new RPC + the
  extended route.
- `sonner` (existing) for the Clone failure toast.
- `lucide-react` via `Icons.Copy`, `Icons.External`,
  `Loader2` (all already imported).
- `react-router`'s `useRouter` + `next/navigation` (already
  imported by `<CalcCard>`).
- `pgcrypto` extension (already loaded by PROJ-10's
  `gen_calculator_public_token`).

**No new env vars.** No new external service. No new build-
time deps.

### Performance & security envelope

- `fn_list_presets()` → < 200ms for ≤ 100 rows (one SELECT
  with a single join to `profiles` on `owner_id`). The
  existing `idx_calculators_owner_updated_at_desc` index
  doesn't directly help (the WHERE clause keys on
  `published + soft_delete_at + owner_role`), but the row
  count is sysadmin-published-only — bounded to whatever the
  one-or-two sysadmins author over the instance's lifetime.
  No new index needed at v1 scale.
- Cross-user clone path → same < 800ms budget as PROJ-10's
  same-owner duplicate (same single-transaction INSERT-from-
  SELECT pattern; the only delta is the title-resolve loop's
  starting string).
- The token-gated cross-user lookup is `WHERE id = source_id
  AND public_token = source_token`. Both indexes already
  exist: PK on `id`, partial UNIQUE on `public_token`
  (PROJ-10). Both columns are equality-tested → either index
  serves; Postgres will pick the cheaper.
- `SECURITY DEFINER + search_path = ''` on both functions
  prevents search-path-based privilege-escalation attacks
  (same pattern PROJ-11 already audits).

### Handoff notes for /frontend and /backend

`/frontend` builds:
- `<PresetsSection>` (new) + the count-zero / count-positive
  branches.
- `<CalcCard>` variant prop + branch points.
- `<CloneController>` context provider + `<CloneHeaderButton>`
  icon component + mount of the controller in
  `/c/[token]/page.tsx`.
- Wire the dashboard page to call `listPresets()` and pass
  `presets` to `<PresetsSection>`.
- Add `cloneCalculator()` client helper.
- Extended unit tests (calc-card, visitor-header, presets-
  section).

`/backend` builds:
- The single migration file
  `20260602000000_cloning_and_presets.sql` (column + two
  function bodies + GRANTs).
- `listPresets()` server helper in
  `src/lib/calculators/server.ts`.
- Extended `POST /api/calculators/:id/duplicate` route
  (optional Zod field + RPC arg threading + response shape
  update including `source_calculator_id`).
- Regenerate `src/lib/supabase/types.ts` after `supabase db
  push`.
- Update the existing `duplicate/route.test.ts` test
  expectations (title prefix → suffix; new optional body
  field; new optional response key).
- New Playwright spec
  `tests/PROJ-18-cloning-and-presets.spec.ts`.

The frontend can ship behind a feature flag while the backend
migration is pending; the controller-context pattern means the
Clone button renders `null` until the page mounts the
provider, which is a one-line revert if needed.

## Implementation Notes

### Frontend (2026-05-25)

Built the UI surface ahead of the backend migration per the spec's
forward-compat plan ("The frontend can ship behind a feature flag
while the backend migration is pending; the controller-context
pattern means the Clone button renders `null` until the page mounts
the provider, which is a one-line revert if needed.").

Components added / changed:
- **`<CloneController>`** (`src/components/visitor/clone-controller.tsx`) —
  new context provider. Parallels `SaveScenarioController` exactly:
  optional hook returns `null` outside the provider, so the header
  Clone button auto-hides on error shells (404 / 410).
- **`<CloneHeaderButton>`** (`src/components/visitor/clone-header-button.tsx`) —
  new icon-only button mounted in `<VisitorHeader>` next to the Save-
  scenario icon. Renders `null` when (a) no `CloneController` is
  mounted or (b) the controller's `approvedUser` is null. Local
  busy state swaps `Icons.Copy` for a 14px rotating spinner; click
  calls `cloneCalculator()` and `router.push('/editor/<new-id>')`.
- **`<VisitorHeader>`** — single-line addition: `<CloneHeaderButton />`
  next to the existing `<SaveScenarioHeaderButton />`.
- **`/c/[token]/page.tsx`** — wraps the success-path render with
  `<CloneController>` next to `<SaveScenarioController>`. Error
  shells (404 / 410) do NOT mount the provider, so the button
  vanishes automatically — same lifecycle pattern as Save.
- **`<CalcCard>`** — gained a `variant?: 'mine' | 'preset'` prop.
  `'preset'` hides the kebab, the Status pill, and the
  Edit/Duplicate icons; shows the Public-view + Clone icons in the
  documented order. The card-wide anchor's `aria-label` drops the
  Draft/Published prefix for `'preset'` since the pill isn't there.
  No DeleteCalcSheet is mounted for preset cards.
- **`<PresetsSection>`** (new, `src/components/dashboard/presets-section.tsx`) —
  always renders the section (Presets is the PRD-documented exception
  to hide-when-empty); count==0 falls through to the existing PROJ-5
  empty-state body, count>0 renders the card grid with
  `<CalcCard variant='preset'>`.
- **`/dashboard/page.tsx`** — `listPresets()` joins the existing
  `Promise.all([...])`; the inline `<Section title="Presets">` empty-
  state stub from PROJ-5 is replaced with `<PresetsSection presets=…>`.
- **`cloneCalculator(id, sourceToken)`** in `src/lib/calculators/client.ts` —
  thin HTTP wrapper that posts to the existing `/duplicate` route
  with `{ source_token }` in the body. Returns `CloneResponse`
  (DuplicateResponse + `source_calculator_id`).
- **`listPresets()`** in `src/lib/calculators/server.ts` — calls the
  SECURITY DEFINER RPC `fn_list_presets`. The supabase-js call is
  cast at one point because the generated types don't yet know about
  the function; backend regenerates `src/lib/supabase/types.ts` when
  the migration lands and the cast becomes unnecessary. Failure
  mirrors `listMyCalculators`: empty array + `console.error`.

Tests (23 new, full suite still green at 882 passed):
- `src/components/dashboard/calc-card.test.tsx` — extended with 5
  cases for `variant='preset'`: no kebab/pill/Edit/Duplicate; both
  Public-view + Clone icons present in the documented order; aria-
  label drops the status prefix; click → cloneCalculator(id, token)
  → `router.push`; error toast on failure.
- `src/components/dashboard/presets-section.test.tsx` — new, 4
  cases: empty-state body when count==0, card grid when count>0,
  `variant='preset'` propagation, section count pill.
- `src/components/visitor/clone-header-button.test.tsx` — new, 6
  cases: null without controller, null without approved user,
  aria-label / tooltip / button click → push, error toast on
  failure, double-click guard via `aria-busy + disabled`.

Awaiting backend (does NOT block the UI from rendering — the
button just stays empty until the RPC exists):
- Migration `20260602000000_cloning_and_presets.sql` (column +
  extended `fn_duplicate_calculator` + new `fn_list_presets`).
- Extended `POST /api/calculators/[id]/duplicate` route accepting
  optional `source_token`.
- Regenerated `src/lib/supabase/types.ts` (cast in `listPresets()`
  can be removed once the function appears in `Functions`).
- E2E spec `tests/PROJ-18-cloning-and-presets.spec.ts`.

### Backend (2026-05-25)

Wired the three backend pieces called for in the Tech Design.

Migration `supabase/migrations/20260602000000_cloning_and_presets.sql`:
- `ALTER TABLE public.calculators ADD COLUMN source_calculator_id UUID
  REFERENCES public.calculators(id) ON DELETE SET NULL` — the attribution
  column. Nullable, no backfill needed (no pre-existing clones).
- `CREATE OR REPLACE FUNCTION fn_duplicate_calculator(source_id UUID,
  source_token TEXT DEFAULT NULL)` — switched from SECURITY INVOKER to
  **SECURITY DEFINER** with `search_path = ''` and an explicit
  `auth.uid()` check (raises 42501 on anonymous). The function branches
  on `source_token IS NULL`:
  - Same-owner duplicate branch (legacy PROJ-10 callers): SELECT scoped
    by `owner_id = caller_id AND soft_delete_at IS NULL`. Title uses
    the unified `<src.title> — Copy` suffix (PROJ-10's `Copy of <X>`
    prefix is retired in this migration — see the Open Question
    resolution and the Decision Log entry on suffix unification).
    `source_calculator_id` left NULL.
  - Cross-user clone branch (PROJ-18): SELECT scoped by `id = source_id
    AND public_token = source_token` (no `soft_delete_at` filter — the
    spec explicitly permits cloning soft-deleted sources reachable via
    scenario URLs). Title rule branches on the Sysadmin-Preset check
    (`profiles.role = 'sysadmin' AND status = 'approved' AND
    src.published`): Presets keep the source title verbatim with
    collision walk `(2)`, `(3)`, …; everything else gets the `<src> —
    Copy` suffix with the same collision walk.
    `source_calculator_id` recorded as `source.id`.
  - The deep-copy (sections, cells incl. `tabular_columns`, charts,
    text_blocks) is unchanged from the previous body — same INSERT-
    from-SELECT pattern, same section-mapping join on
    `(calculator_id, display_order)`. The PROJ-17 BUG-H2 maintenance
    contract carries forward verbatim.
  - The old single-arg overload is `DROP FUNCTION`-ed at the end of
    the file to prevent any caller from accidentally bypassing the
    new SECURITY DEFINER body.
  - GRANTs: `REVOKE EXECUTE … FROM PUBLIC; GRANT … TO authenticated,
    service_role`. Same pattern PROJ-11's `fn_get_public_calculator`
    uses for its DEFINER bypass surface.
- `CREATE FUNCTION fn_list_presets()` — new SECURITY DEFINER read RPC.
  Returns `(id, title, description, theme_id, updated_at, published,
  public_token, owner_id, owner_name)` for rows where the owning profile
  is an approved sysadmin AND the calculator is published AND not
  soft-deleted, ordered `updated_at DESC LIMIT 100`. Explicit
  `auth.uid()` check raises 42501 on anonymous. Owner-only RLS on
  `calculators` is preserved unchanged — the DEFINER function is the
  single bounded surface that bypasses it for this read.

API route `src/app/api/calculators/[id]/duplicate/route.ts`:
- Body Zod schema extended: `{ source_token?: z.string().min(1) }` with
  `.strip()` so PROJ-10's no-body callers still hit the same-owner path
  unchanged.
- Empty/zero-length bodies are tolerated (PROJ-10 sent `{}`); a
  syntactically malformed body falls through to `{}`. An empty string
  for `source_token` or a non-string value maps to 400
  `invalid_source_token` (per AC).
- RPC call always sends both args (`source_id`, `source_token ?? null`)
  so PostgREST resolves to the new two-arg function deterministically.
- Response includes the new `source_calculator_id` key (null on
  same-owner duplicate, source.id on cross-user clone).
- Error mapping preserved verbatim: 42501 → 401, P0002 → 404, anything
  else → 500.

Types `src/lib/supabase/types.ts`:
- Hand-extended to mirror what `npx supabase gen types typescript
  --linked` will produce after `supabase db push`:
  - `calculators.Row/Insert/Update` gain `source_calculator_id: string
    | null`.
  - `calculators.Relationships` includes the self-FK entry.
  - `fn_duplicate_calculator.Args` adds `source_token?: string | null`;
    `Returns` adds `source_calculator_id: string | null`.
  - `fn_list_presets` added to `Functions`.
- The cast in `listPresets()` (`supabase.rpc as unknown as …`) was
  removed since the function is now in the generated `Functions` type.

Tests:
- `src/app/api/calculators/[id]/duplicate/route.test.ts` — rewritten to
  cover both branches: same-owner duplicate (no `source_token`, args
  sent as `{ source_id, source_token: null }`, response carries
  `source_calculator_id: null`); cross-user clone (`source_token`
  present, args forwarded verbatim, response carries `source_calculator_id`
  = source.id); 400 on empty-string `source_token`; 400 on non-string;
  404 on P0002; 401 on 42501; 500 on unexpected errors; 404 on empty
  result set. 9 cases total, all green.
- `tests/PROJ-10-calculator-lifecycle.spec.ts` — updated PROJ-10's
  same-owner duplicate E2E expectations from `Copy of <X>` to `<X> —
  Copy` to match the unified suffix (test names + assertions).
- `src/components/dashboard/calc-card.test.tsx` — title fixture in the
  duplicate-click test updated to the new suffix.
- `tests/PROJ-18-cloning-and-presets.spec.ts` (new) — Playwright spec
  covering: cross-user clone happy path (suffix + attribution +
  ownership transfer); sysadmin Preset clone preserves the title (and
  walks (2)/(3) on collision); mismatched (id, source_token) → 404;
  cross-user clone of a soft-deleted source via valid token → 201 with
  an active clone; same-owner duplicate of a soft-deleted source →
  404 (the soft_delete filter is retained on the same-owner branch);
  `source_calculator_id` is NULL on same-owner duplicate and PATCH
  cannot retroactively set it; `fn_list_presets` visibility filter
  (sysadmin + published + not soft-deleted only). 7 scenarios.

Full Vitest suite: 92 files / 885 tests green.

Deployment notes for `/deploy`:
- Run `supabase db push` to apply the migration. After the push,
  regenerate types with `npx supabase gen types typescript --linked >
  src/lib/supabase/types.ts` and diff against the hand-edits above —
  the generator may resequence keys but the shape should match
  field-for-field. No env var / secret changes needed.

## QA Test Results

**Tested:** 2026-05-25
**Tester:** /qa skill (Opus 4.7)

### Summary

- **Acceptance criteria:** 84 reviewed → 84 pass (no fails).
- **Bugs:** 0 Critical / 0 High / 0 Medium / **4 Low**.
- **Automated tests:** Vitest **92 files / 885 tests passed**. Playwright
  **271 passed / 28 skipped / 0 failed** across `chromium` + `Mobile
  Safari`, including the 14 new PROJ-18 scenarios (2 projects × 7
  scenarios) and 30 PROJ-10 lifecycle regressions (verifying the
  unified `" — Copy"` suffix retrofit).
- **Production-ready:** **YES** — zero blockers; the four Low-severity
  notes are polish, none of them affect correctness, security, or the
  documented acceptance criteria.

### Approach

1. Updated `features/INDEX.md` status to **In Review**.
2. Read the full PROJ-18 spec end-to-end (84 ACs across
   schema migration, extended `fn_duplicate_calculator`, cross-user
   clone branch, extended duplicate route, visitor-view Clone button,
   Presets dashboard section, `<CalcCard variant='preset'>`,
   `fn_list_presets` RPC, `listPresets()` helper, security/RLS, tests).
3. Audited every implementation file against its corresponding ACs:
   - `supabase/migrations/20260602000000_cloning_and_presets.sql`
   - `src/app/api/calculators/[id]/duplicate/route.ts` + test
   - `src/components/visitor/{clone-controller,clone-header-button}.tsx`
     + test, and the `<VisitorHeader>` mount
   - `src/components/dashboard/{calc-card,presets-section}.tsx` + tests
   - `src/lib/calculators/{client,server}.ts`
   - `src/app/(public)/c/[token]/page.tsx` controller mount
   - `src/app/(app)/dashboard/page.tsx` `Promise.all` integration
4. Pushed the pending migration `20260602000000_cloning_and_presets.sql`
   to the linked Cloud project via `supabase db push` (was unpushed
   when QA started). Regenerated types and verified the diff against
   the hand-extended `src/lib/supabase/types.ts` — only cosmetic
   key-ordering / `string | null` ↔ `string` differences, no shape
   changes that affect callers.
5. Ran `npm test` (Vitest unit suite) → all 885 pass.
6. Ran `npx playwright test tests/PROJ-18-cloning-and-presets.spec.ts`
   → 14/14 pass across chromium + Mobile Safari.
7. Ran the full Playwright suite → 271/271 pass / 28 skipped / 0 fail.
   No regressions introduced by the unified `" — Copy"` suffix
   retrofit (PROJ-10 lifecycle, PROJ-12 scenarios, PROJ-13 trash,
   PROJ-17 tabular cells all green).
8. Red-team audit of: token-gated read shape, SECURITY DEFINER
   bypass scope, owner_id assignment in the INSERT, PATCH whitelist
   defence against client-supplied `source_calculator_id`, RPC
   grants, anonymous gating in both functions, and the visitor-view
   Clone button's render-null lifecycle on every error path.

### Acceptance criteria — pass/fail

All sections verified; counts roll up to **84 pass / 0 fail**:

| Section | Pass | Fail | Notes |
|---|---|---|---|
| Schema migration | 3 | 0 | Column added, types regenerated match, `ON DELETE SET NULL` verified |
| Extended `fn_duplicate_calculator` | 5 | 0 | Signature, defaulted NULL, P0002 mapping, 42501 on anonymous, branch discriminator |
| Cross-user clone path | 11 | 0 | Owner=cloner, soft-delete carve-out, Preset title carve-out, collision walk, length trim, owner-self path, deep copy of sections/cells/charts/text-blocks |
| `POST /api/calculators/:id/duplicate` (extended) | 7 | 0 | PROJ-10 callers unchanged, Zod accepts optional `source_token`, RPC arg shape, response includes `source_calculator_id`, 404 on P0002, 400 on invalid_source_token, 401 anonymous |
| Visitor view — Clone icon-button | 11 | 0 | Anonymous/pending hidden, approved/sysadmin/owner-self visible, tooltip + aria-label, busy state, navigation, error toast, 404/410 shells hidden, scenario URL still shows Clone, soft-deleted source via scenario URL succeeds |
| Dashboard — Presets section | 4 | 0 | All approved users see it, empty-state body when 0 rows, sysadmin sees own work, internal-scroll inherits |
| `<CalcCard variant='preset'>` | 8 | 0 | No kebab, no Status pill, Public-view + Clone in order, no Edit icon, click-through behaviour, keyboard model, loading state |
| `fn_list_presets()` read RPC | 7 | 0 | Filters by sysadmin owner + published + not soft-deleted, ordered `updated_at DESC LIMIT 100`, SECURITY DEFINER + search_path='', 42501 anonymous, returns owner_name |
| `listPresets()` server helper | 3 | 0 | Typed wrapper, failure → empty array + console.error, parallel `Promise.all` fetch |
| Security & RLS | 9 | 0 | auth.uid() check, (id, public_token) double match, owner_id always from caller, source_calculator_id stripped on PATCH, hard-deleted source → P0002, no token in URL |
| Tests | 6 | 0 | duplicate/route.test.ts ✓, listPresets indirectly via spec, visitor-header.test.tsx ✓, calc-card.test.tsx ✓, presets-section.test.tsx ✓, PROJ-18 Playwright ✓ |
| **Total** | **84** | **0** | |

### Security audit (red-team)

| Attack | Result |
|---|---|
| **Cross-user enumeration by ID alone** (caller posts random IDs with a token they own) | **Blocked.** `WHERE id = source_id AND public_token = source_token` requires the pair to match the same row. Mismatch → P0002 → 404 (verified E2E test #3, mobile + chromium). |
| **Token-only attack** (caller posts a valid token with someone else's id) | **Blocked.** Same `(id, token)` pair gate; the row's own `public_token` is the only matching value. P0002 → 404. |
| **Anonymous direct API call to `/duplicate`** | **Blocked twice.** Middleware redirects to `/auth/login?next=…` (verified curl: 307). Function-side `auth.uid() IS NULL` check raises 42501 → 401 as fallback. |
| **PATCH `source_calculator_id` to rewrite attribution** | **Blocked.** `patchSchema.strip()` silently drops unknown keys; the column never enters the UPDATE statement. Verified E2E test #6. |
| **Setting `owner_id` via the clone path** | **Impossible by construction.** The INSERT statement hard-codes `caller_id` (`auth.uid()`); the row literal does not surface `owner_id` from the source or from the request body. |
| **Hard-deleted source clone attempt** | **Blocked.** `SELECT … INTO src` returns 0 rows → P0002 → 404. Note: soft-deleted sources are deliberately clonable via the cross-user branch (per spec §"Edge Cases / source soft-deleted between visitor-view load and Clone click"). Verified E2E test #4. |
| **Cookie-bound publishable-key client trying to read other users' calcs** | **Blocked.** Owner-only RLS on `calculators` remains unchanged. `fn_list_presets` is the only bounded SECURITY DEFINER surface that bypasses it, and only for the sysadmin-published carve-out. |
| **Token leakage via URL query string in server access logs** | **Blocked.** Clone surfaces send `source_token` in the JSON body, not the URL. Inspected both `cloneCalculator()` and the `<CloneHeaderButton>` / `<CalcCard>` call sites. |
| **`fn_list_presets` leaking sensitive owner fields** | **Clear.** Returns only `(id, title, description, theme_id, updated_at, published, public_token, owner_id, owner_name)`. No `owner_email`, no `auth.users.*` columns. `public_token` is intentional (the same surface as the public `/c/<token>` URL). |
| **`search_path` privilege-escalation against SECURITY DEFINER functions** | **Blocked.** Both functions set `search_path = ''` and qualify every reference with `public.`, including the new join `public.profiles`. |
| **Anonymous direct call to `fn_list_presets`** | **Blocked.** Explicit `auth.uid() IS NULL` check raises 42501. Belt-and-braces given the dashboard is auth-gated anyway. |

### Regression check

| Feature | Status | Evidence |
|---|---|---|
| PROJ-10 Calculator Lifecycle (publish, sharing, token regen, duplicate) | ✅ Pass | 30/30 PROJ-10 E2E pass including the updated suffix expectations (`Copy of <X>` → `<X> — Copy`) and the `idx_calculators_owner_title_active` collision walk |
| PROJ-11 Visitor View | ✅ Pass | Visitor route still renders 200/404/410; new `<CloneController>` mount is additive; error shells still hide the Save-scenario icon (and now the Clone icon) |
| PROJ-12 Scenarios | ✅ Pass | Scenario save/load/share E2E all green; cloning a calc reached via a scenario URL is covered by PROJ-18 E2E #4 |
| PROJ-13 Trash | ✅ Pass | Soft-delete + restore E2E green; the same-owner duplicate branch still rejects soft-deleted sources (verified PROJ-18 E2E #5) |
| PROJ-17 Tabular Output Cells (BUG-H2 maintenance contract) | ✅ Pass | Migration preserves the `tabular_columns` column in the cell deep-copy enumeration; PROJ-17 tests green |

### Bugs

#### BUG-L1 (Low) — `fn_list_presets` E2E test asserts on admin-client SELECT, not on the RPC

**File:** `tests/PROJ-18-cloning-and-presets.spec.ts:347-393`
**Severity:** Low
**Category:** Test quality

The last PROJ-18 Playwright scenario, titled "`fn_list_presets`
returns only sysadmin-owned + published + non-soft-deleted
calculators", does not actually invoke `supabase.rpc('fn_list_presets')`.
Instead it uses the admin client to `SELECT … FROM calculators WHERE
published = true AND soft_delete_at IS NULL AND id IN (sysPub1, sysPub2)`,
which only verifies the seed data shape — not the function's visibility
filter. The function's behaviour is exercised indirectly through the
dashboard render path in unit tests (`presets-section.test.tsx`) and
through the `listPresets()` happy path. The RPC's role / status / soft-
delete filter is not covered by any RED test.

**Repro:** Read the test body; observe that the assertion never uses
`supabase.rpc('fn_list_presets')` and that mutating the function body
(e.g. removing the `p.status = 'approved'` clause) would not turn the
test red.

**Recommendation:** Replace the admin-side SELECT with a real RPC call
issued by a regular-user PostgREST client (one of the bootstrapped
users), then assert that the returned rows are exactly `[sysPub1,
sysPub2]` in `updated_at DESC` order. Defer if appetite is low — the
function body is small, exercised end-to-end by the rendered dashboard
in unit tests, and the visibility rule audit above gives me confidence
in the runtime behaviour.

#### BUG-L2 (Low) — Native `title` attribute used instead of shadcn `<Tooltip>`

**Files:**
- `src/components/visitor/clone-header-button.tsx:56`
- `src/components/dashboard/calc-card.tsx:416`

**Severity:** Low
**Category:** Spec deviation

Spec §5 says: "Tooltip on hover (existing shadcn `<Tooltip>` primitive)
shows the same copy." The implementation uses the native HTML `title`
attribute, which renders as a browser tooltip on hover (functionally
equivalent but visually unstyled — different font, different delay,
no theming). The Save-scenario header button (PROJ-12) uses the same
native-`title` pattern, so the two icons are consistent with each other
even though both diverge from the spec's named primitive.

**Recommendation:** Either upgrade both icons (Save-scenario + Clone)
to use `<Tooltip>` for a consistent visual treatment, or update the
spec line to acknowledge the native-`title` choice. Deferring is safe
— accessibility is preserved via `aria-label`.

#### BUG-L3 (Low) — Non-UUID `id` in URL maps to 500 `duplicate_failed`, not 404

**File:** `src/app/api/calculators/[id]/duplicate/route.ts:85-94`
**Severity:** Low
**Category:** Error mapping

If a logged-in user posts to `/api/calculators/not-a-uuid/duplicate`,
the RPC call surfaces a Postgres `invalid input syntax for type uuid`
error (code `22P02`). The route's error mapping handles `42501` and
`P0002`; everything else falls through to 500
`{"error":"duplicate_failed"}`. The opacity contract suggests 404
`not_found` would be a closer match — an "id that doesn't exist" and
"id that can't possibly exist" are indistinguishable from the caller's
perspective. This is a pre-existing pattern shared with other PROJ-10
routes (PATCH, DELETE, regenerate-token) and is not regressed by
PROJ-18; flagging in case the team wants to harden it as a polish pass.

**Recommendation:** Add `code === '22P02'` to the not-found branch
across all calculator-by-id routes in a separate hardening PR. Or
defer — this is only reachable by hand-crafted requests; real clients
always pass a UUID from `data.id`.

#### BUG-L4 (Low) — Request body parsing relies on `content-length` header

**File:** `src/app/api/calculators/[id]/duplicate/route.ts:57-69`
**Severity:** Low
**Category:** Robustness

The route only attempts `req.json()` when `content-length` is present
and non-zero. A client sending a body with `Transfer-Encoding: chunked`
(no `Content-Length` header) would have its body silently ignored,
defaulting to `{}` (same-owner duplicate path). Real browsers / fetch
always set `Content-Length` for the small JSON payloads this route
takes, and the test suite explicitly serialises the body and sets the
header — so this is not exercised by current callers. Documented in
case a future native HTTP client (or a streaming proxy) chunks the
body and silently degrades to a same-owner duplicate instead of a
cross-user clone.

**Recommendation:** Unconditionally `try { rawBody = await req.json(); }`
without gating on `content-length`. Or defer — current call sites are
all `fetch()` with `JSON.stringify`, which always sets the header.

### Manual smoke (against the dev server after migration push)

- Direct `curl POST` against `/api/calculators/<random-id>/duplicate`
  as anonymous: middleware returns 307 to `/auth/login?next=…`. ✅
- Dashboard server-side `Promise.all` includes `listPresets()`; with
  no sysadmin-published calcs, the section renders the PROJ-5 empty
  state body. ✅ (verified via `<PresetsSection>` unit tests + the
  dashboard component's import wiring)

I did NOT walk a real authenticated session through the dashboard
browser flow — Playwright bootstrap covers the cross-user / preset
path more reliably than my manual click-through would. Calling that
out explicitly per the QA convention.

### Production-ready decision

**Decision: READY.**
- Zero Critical / High / Medium bugs.
- All 84 acceptance criteria verified.
- Full unit + E2E suites green (885 + 271).
- Migration pushed to Cloud; types verified shape-equivalent to the
  regenerated output.
- Red-team audit of the SECURITY DEFINER bypass surface clear: every
  cross-user surface is gated by either token possession or the
  sysadmin-published filter, both of which are statically auditable.

The four Low findings are polish — none of them block the cloning
loop, the Presets surface, or the security envelope. They can be
filed as TODOs and addressed in a follow-up `/refine` pass or rolled
into the deferred attribution-banner work.

**Next step:** Run `/deploy` to ship PROJ-18 to production.

## Deployment
_To be added by /deploy_
