# PROJ-8: Editor — Grid + Builder Two-Panel Split

## Status: Approved
**Created:** 2026-05-23
**Last Updated:** 2026-05-23 (B2 + B3 resolved by /frontend — B2: the obsolete PROJ-4 "Coming soon" tooltip test now asserts the enabled top-bar button, scoped to `role=banner` so the dashboard Hero's "Build a new calculator" button does not collide. B3: spec ACs at lines 261-263, 285-287, and the PATCH section now describe HTTP 307 → `/auth/login?next=…` for signed-out browser requests, matching PROJ-3 middleware convention; the route handlers' direct-invocation 401 branch is preserved for tests and server-side callers — no code change. Previously: B4 Critical resolved — `useEditor` now reads from a module-level store via `useSyncExternalStore`. All four QA bugs (B1 / B2 / B3 / B4) now resolved; ready to re-QA.)

## Dependencies

- Requires: PROJ-4 (App Shell, Routing & Top-Level Navigation) —
  PROJ-8 extends the existing `TopBarDesktop` / `TopBarMobile` /
  `AppShell` with the editor-specific breadcrumb rename surface
  and the calculator-theme picker, and enables the AppShell's
  "+ New calculator" button (currently disabled with a "Coming
  soon — calculator creation ships with PROJ-10" tooltip).
- Requires: PROJ-5 (Account Dashboard) — PROJ-8 enables the
  dashboard's Hero "Build a new calculator" button (currently
  hidden in PROJ-5) and wires it to the same create-calculator
  click handler as the top-bar "+ New calculator" button.
- Requires: PROJ-6 (Calculator Theme System) — the Builder
  canvas renders the calculator hero using the active calculator
  theme's tokens; the theme picker lists every theme exposed by
  `getThemeIds()` with its `ThemeSwatch` preview. PROJ-8 also
  implements the fallback-theme banner contract PROJ-6
  documented (`features/PROJ-6-calculator-theme-system.md:97`).
- Requires: PROJ-7 (Formula Engine) — listed in the INDEX.md
  dependency row but consumed only by PROJ-9, PROJ-11 and PROJ-12.
  PROJ-8 itself has no formula-engine touchpoints — it renders
  no cells, so it never calls `analyze()` / `evaluate()`. The
  dependency stays declared so PROJ-9's authoring layer can
  build directly on top of PROJ-8 without an intermediate
  feature.

## Summary

PROJ-8 is the editor **shell** — the chrome, layout, navigation,
and create-calculator path that surrounds the cell-authoring
experience PROJ-9 will fill in. Concretely:

1. A minimal `calculators` table (8 columns) and a Supabase
   row-level-security policy that scopes reads / writes / soft-
   deletes to the owner.
2. Three owner-only API routes: `POST /api/calculators`
   (create), `GET /api/calculators/:id` (read), `PATCH
   /api/calculators/:id` (update title / description /
   theme_id, with calculator-level optimistic concurrency).
3. The desktop two-panel editor at `/editor/<id>`: Grid panel
   on top (with chevron-collapse + drag-resizable handle to the
   Builder), Builder toolbar in the middle, Builder canvas
   filling the rest. The Grid panel is structurally present but
   contains no cells until PROJ-9.
4. The mobile editor variant: app top bar, editor toolbar,
   Builder canvas filling the viewport, a footer nav with a
   Grid drawer toggle that slides up an empty drawer.
5. Two desktop top-bar additions: an **inline-rename
   breadcrumb segment** for the calculator name, and a
   **calculator-theme picker** (anchored popover listing every
   theme with a `ThemeSwatch` preview).
6. The **"+ Add" picker** scaffolding (Cell · Chart · Text
   block · Section) in the Builder toolbar, with all four
   options visible-but-disabled in PROJ-8 per the INDEX.md
   forward-compat constraint.
7. A **session-scoped Undo / Redo stack** with toolbar buttons
   and `Cmd-Z` / `Cmd-Shift-Z` keyboard shortcuts. Title-rename
   and theme-change are the two operations enrolled by PROJ-8;
   PROJ-9 will enroll cell-level mutations into the same stack.
8. The **fallback-theme banner** in the Builder when the
   calculator's stored `theme_id` resolves to the default via
   `getTheme`'s unknown-id fallback path.
9. Enabled wiring for the dashboard Hero "Build a new
   calculator" button and the top-bar "+ New calculator"
   button. Both POST to `/api/calculators` and navigate to
   `/editor/<id>`.

PROJ-8 ships **no cell rendering, no section management, no
formula evaluation, no publish flag, no public-share token,
no per-cell edit cards.** Those land in PROJ-9, PROJ-10, and
PROJ-11. The Builder canvas in PROJ-8 renders the themed hero
(title only — read-only here) plus a single
`EmptyOrErrorState` card reading "Add cells to get started" so
the editor doesn't feel broken before PROJ-9 lands.

## User Stories

- As a **registered user**, I want to click "Build a new
  calculator" on my dashboard (or "+ New calculator" in the
  top bar) and land directly in an editor for the newly-
  created calculator, so I can start authoring without an
  intermediate naming form.
- As a **registered user**, I want to rename a calculator
  inline from the top-bar breadcrumb (click the segment, type,
  Enter to commit, Esc to revert), so renaming is a single
  gesture without a modal.
- As a **registered user**, I want to switch a calculator
  between any of the 8 shipped calculator themes from a top-bar
  theme picker and see the Builder canvas re-render
  immediately, so I can pick the right visual identity before I
  invest time in cell authoring.
- As a **registered user**, I want the Grid panel and Builder
  panel to share a horizontal resize handle on desktop so I can
  trade Grid height for Builder height while I work.
- As a **registered user editing on a phone**, I want the
  Builder canvas to fill my viewport and a footer Grid toggle
  to slide up the Grid drawer on demand, so I get a
  builder-first mobile experience without two panels fighting
  for screen real estate.
- As a **registered user**, I want `Cmd-Z` to undo my last
  rename or theme change inside the editor session, and `Cmd-
  Shift-Z` to redo, so I can experiment freely without losing
  prior state.
- As a **registered user**, I want a calculator that references
  a theme that no longer exists to keep working — render with
  the fallback theme and show a small banner letting me pick a
  new theme — so the editor never breaks for me.
- As a **registered user**, I want the editor URL to refuse
  access to calculators that aren't mine (404, same as a
  calculator that doesn't exist), so I can't accidentally land
  inside another user's editor by ID-typing or sharing.

## Out of Scope

Everything below came up during the spec interview and was
consciously excluded from PROJ-8:

- **Cell rendering, cell authoring, the data-model expand in
  the Grid, the visual-settings expand in the Builder.** All
  PROJ-9. The Grid panel in PROJ-8 is structurally present
  (header strip + empty cells area + chevron-collapse) but
  contains zero columns.
- **Section management — create, rename, reorder, delete,
  hover-border discoverability, edit-in-place section
  headers.** PROJ-9. PROJ-8 has no `sections` table.
- **Builder hero hover/click-to-edit affordance, description
  editing, "Add a short description" placeholder, Esc-revert
  on the hero.** PROJ-9, alongside the hero rendering pipeline
  it owns. PROJ-8 renders the title as read-only text in the
  hero.
- **Publish flag, `Status: Draft / Published` pill, share-URL
  inline popover, public-token mint / regenerate.** PROJ-10.
  PROJ-8's `calculators` table carries NO `published` or
  `public_token` columns.
- **Preview button in the Builder toolbar.** Hidden in PROJ-8
  because there's no public token to open. PROJ-10 adds the
  button when the token surface ships.
- **Visitor view at `/c/<token>`.** PROJ-11.
- **Scenario save / load surfaces.** PROJ-12.
- **Soft-delete UI in Trash, Restore / Delete permanently,
  destructive-confirm bottom sheet.** PROJ-13. PROJ-8 adds the
  `soft_delete_at` column to the table (free forward-compat)
  but never reads or writes it.
- **Settings page integration (default theme, default size
  hints).** PROJ-14.
- **Charts, Text-blocks, Tabular output cells.** P1
  (PROJ-15, PROJ-16, PROJ-17). PROJ-8's "+ Add" picker lists
  these options visible-but-disabled per the INDEX.md
  forward-compat note — the architecture supports them, only
  the wiring waits.
- **Clone attribution (`source_calculator_id` column, "based
  on …" subtitle).** PROJ-18.
- **Sysadmin moderation (User Calculators section, Move to
  Trash, Delete permanently from any owner).** PROJ-19.
- **Concurrent-editing 409 banner UX, sysadmin-trash 410
  banner, refresh-on-conflict button.** PROJ-20. PROJ-8 ships
  the **server-side** half of optimistic concurrency
  (`updated_at` increment + stale-write 409 rejection) plus a
  generic error toast on 409; PROJ-20 replaces the toast with
  the proper non-modal banner.
- **Code-import dialog (paste surface, mode toggle, preview
  list, apply).** PROJ-21. The sparkles entry-point button is
  hidden in PROJ-8 — PROJ-21 introduces it.
- **JSON export / import.** PROJ-22.
- **Pixel-snapshot tests of the Builder canvas against the
  visitor view.** PROJ-11 owns the pixel-identity acceptance
  criteria when both renderers exist; PROJ-8 has no visitor
  view to compare against.
- **localStorage persistence of the Grid-panel height.**
  Drag-resize is in scope; persisting the height across
  reloads / devices is deferred. Each editor mount resets to
  the default Grid height.
- **Right-click context menus, keyboard navigation between
  Grid and Builder panels beyond `Cmd-Z` / `Cmd-Shift-Z`.**
  Not in scope.
- **Mobile resize between the Builder canvas and the Grid
  drawer.** The drawer's height policy (content-driven, capped
  at 70% of viewport per `Calcgrinder-spec.md:1647-1649`) is
  PROJ-9's territory — PROJ-9 ships the drawer's content
  (cell rows + focused-expand), so the height behaviour rides
  on that work. PROJ-8's drawer opens to a fixed
  ~`50%-of-viewport` empty state.
- **Drag-and-drop reordering of any kind.** PROJ-9 ships
  drag-handles on cell cards and the section-reorder
  affordance.
- **Hidden-cells popover surface.** PROJ-9, alongside the
  cells that can be hidden. PROJ-8's hidden-cells pill is
  always hidden because the count is always 0.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Database schema — `calculators` table

- [ ] Given a fresh Supabase project at PROJ-8 HEAD, when the
  Supabase CLI runs `supabase db push`, then a new migration
  in `supabase/migrations/` creates a `calculators` table
  with exactly these columns:
  - `id uuid primary key default gen_random_uuid()`
  - `owner_id uuid not null references auth.users(id) on delete cascade`
  - `title text not null default 'Untitled calculator'`
  - `description text not null default ''`
  - `theme_id text not null default 'calcgrinder'`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - `soft_delete_at timestamptz`
- [ ] Given the table is created, when the regenerated types
  file (`src/lib/supabase/types.ts`) is regenerated via
  `npx supabase gen types typescript --linked`, then the
  resulting type for `calculators` row has exactly the eight
  fields above with the correct nullability.
- [ ] Given `title` is constrained, when an INSERT or UPDATE
  attempts to write a title longer than 100 characters after
  trim, then the row is rejected by a check constraint
  (`length(trim(title)) <= 100`).
- [ ] Given `title` is required to be non-empty, when an
  INSERT or UPDATE attempts to write a title that is empty
  after trim, then the row is rejected by a check constraint
  (`length(trim(title)) > 0`).
- [ ] Given the table is created, when the migration is
  inspected, then an `updated_at` BEFORE-UPDATE trigger sets
  `updated_at = now()` on every UPDATE.
- [ ] Given the table is created, when the migration is
  inspected, then indexes exist for
  `(owner_id, soft_delete_at)` and `(owner_id, updated_at desc)`
  (the second one is what PROJ-5's dashboard query will use to
  list a user's calculators in
  most-recently-edited order — PROJ-8 adds it now so PROJ-9
  doesn't need to migrate again).

### Row-level security — `calculators` table

- [ ] Given Row-Level Security is enabled on `calculators`,
  when a SELECT runs through a publishable-key Supabase
  client signed in as user A, then only rows where
  `owner_id = auth.uid()` are returned.
- [ ] Given the same RLS, when an INSERT runs through a
  publishable-key client signed in as user A with `owner_id`
  set to user B's id, then the INSERT is rejected by RLS.
- [ ] Given the same RLS, when an UPDATE runs against a row
  owned by user B while signed in as user A, then 0 rows are
  affected (silent RLS rejection — never throws).
- [ ] Given the same RLS, when a DELETE runs against any row,
  then it is rejected — hard deletes go through admin-only
  paths in PROJ-13 / PROJ-19. PROJ-8 has no hard-delete API.
- [ ] Given an admin Supabase client (the `SUPABASE_SECRET_KEY`
  client from `src/lib/supabase/admin.ts`), when it reads /
  writes any row, then RLS is bypassed — used by server-side
  route handlers that have already authenticated the user via
  the cookie-bound server client.

### API — `POST /api/calculators`

- [ ] Given a signed-out browser request, when `POST
  /api/calculators` is invoked, then the PROJ-3 middleware
  pre-empts the route and returns HTTP 307 with `location:
  /auth/login?next=%2Fapi%2Fcalculators` (the established
  project convention — every private `/api/*` path except
  `/api/cron/*` goes through the same redirect). The route
  handler's own 401-with-`{ error: 'unauthorized' }` branch
  remains in place for direct-invocation paths (integration
  tests, server-side calls that bypass middleware) and is
  exercised by the route's unit / integration tests.
- [ ] Given a signed-in request with an empty body, when `POST
  /api/calculators` is invoked, then a new row is created with
  `owner_id = auth.uid()`, `title = 'Untitled calculator'`,
  `description = ''`, `theme_id = 'calcgrinder'`, fresh
  `created_at` / `updated_at` timestamps, and the response
  body is `{ id, title, description, theme_id, updated_at }`
  (no `owner_id`, no `soft_delete_at`).
- [ ] Given the same call, when the response is inspected,
  then the HTTP status is 201.
- [ ] Given a signed-in request, when `POST /api/calculators`
  is invoked rapidly five times in a row, then five distinct
  rows are created (no idempotency key required in v1).
- [ ] Given a signed-in user has hit a per-user rate limit
  (placeholder for PROJ-20 — not enforced in PROJ-8), when
  `POST /api/calculators` is invoked, then it still succeeds.
  PROJ-8 does NOT introduce rate-limiting; the user is
  trusted.

### API — `GET /api/calculators/:id`

- [ ] Given a signed-out browser request, when `GET
  /api/calculators/<owned-id>` is invoked, then the PROJ-3
  middleware pre-empts the route and returns HTTP 307 with
  `location: /auth/login?next=%2Fapi%2Fcalculators%2F<id>`
  (same convention as the POST endpoint). The route handler's
  own 401-with-`{ error: 'unauthorized' }` branch remains
  in place for direct-invocation paths.
- [ ] Given a signed-in user A, when `GET
  /api/calculators/<user-B-id>` is invoked, then it returns
  HTTP 404 with `{ error: 'not_found' }` — never 403, to
  avoid leaking row existence across owners.
- [ ] Given a signed-in user, when `GET
  /api/calculators/<non-existent-id>` is invoked, then it
  returns HTTP 404.
- [ ] Given a signed-in user, when `GET
  /api/calculators/<id>` is invoked for an owned but
  soft-deleted row (`soft_delete_at IS NOT NULL`), then it
  returns HTTP 404. The Trash recovery surface (PROJ-13) uses
  a different list endpoint.
- [ ] Given a signed-in user, when `GET
  /api/calculators/<id>` is invoked for an owned, non-trashed
  row, then it returns HTTP 200 with `{ id, title,
  description, theme_id, updated_at }`.

### API — `PATCH /api/calculators/:id` (title / description / theme)

- [ ] Given a signed-out browser request, when `PATCH
  /api/calculators/<id>` is invoked, then the PROJ-3
  middleware pre-empts the route and returns HTTP 307 with
  `location: /auth/login?next=%2Fapi%2Fcalculators%2F<id>`
  (same convention as the POST and GET endpoints). The route
  handler's own 401-with-`{ error: 'unauthorized' }` branch
  remains in place for direct-invocation paths.
- [ ] Given a signed-in user, when `PATCH
  /api/calculators/<id>` is invoked with `{ title:
  'Mortgage', updated_at: '<stale-value>' }`, then the
  server compares `<stale-value>` against the row's current
  `updated_at` and:
  - If they match → write the update, return HTTP 200 with
    the updated row including the new `updated_at`.
  - If they differ → reject with HTTP 409 and body `{ error:
    'stale', server_updated_at: '<current>' }`.
- [ ] Given the same endpoint, when the body contains a
  `title` longer than 100 chars after trim, then it returns
  HTTP 400 with `{ error: 'title_too_long', max: 100 }`.
- [ ] Given the same endpoint, when the body contains a
  `title` that is empty after trim, then it returns HTTP 400
  with `{ error: 'title_required' }`.
- [ ] Given the same endpoint, when the body contains
  `theme_id` set to a string not in `getThemeIds()`, then it
  still accepts the write — the unknown-id fallback is a
  read-time concern (per PROJ-6), not a write-time
  rejection. (Rationale: keeps the write path simple and
  matches PROJ-6's fallback design.)
- [ ] Given the same endpoint, when the body contains
  `description` longer than any value, then no length cap
  applies (per `Calcgrinder-spec.md:91-94`, description has no
  enforced length cap).
- [ ] Given the same endpoint, when the body contains a key
  that isn't one of `title`, `description`, `theme_id`, then
  the key is ignored — `published`, `public_token`,
  `owner_id`, `soft_delete_at`, `created_at`, `id`,
  `updated_at` are NEVER writable through this route.
- [ ] Given a PATCH succeeds, when it returns, then the
  response body's `updated_at` reflects the freshly-bumped
  trigger value — the client's next PATCH echoes this value
  back as its concurrency check.
- [ ] Given a non-owner / non-existent / soft-deleted target,
  when `PATCH /api/calculators/<id>` runs, then it returns
  HTTP 404 (same opacity rule as `GET`).
- [ ] Given a 409 response, when the client receives it, then
  the client surfaces a generic shadcn toast reading "Save
  failed — reload to retry." (PROJ-20 replaces this toast
  with the non-modal banner UX from
  `Calcgrinder-spec.md:589-621`.)

### Editor route — `/editor/<id>` access gate

- [ ] Given an unauthenticated visitor navigating to
  `/editor/<any-id>`, when the route resolves, then they are
  redirected to `/auth/login?redirect=/editor/<id>` by the
  existing PROJ-3 middleware.
- [ ] Given a signed-in user navigating to
  `/editor/<id-they-do-not-own>`, when the page renders, then
  the server-side load returns 404 and PROJ-4's
  `not-found.tsx` surface is shown.
- [ ] Given a signed-in user navigating to a `/editor/<id>`
  for a soft-deleted calculator they own, when the page
  renders, then it returns 404 (the calculator is in Trash —
  PROJ-13's restore flow brings it back).
- [ ] Given a signed-in user navigating to their own
  non-trashed calculator's `/editor/<id>`, when the page
  renders, then the editor mounts with the title,
  description, and theme_id loaded from the row.

### Desktop two-panel layout

- [ ] Given a desktop viewport (≥ 1024px wide), when
  `/editor/<id>` renders, then the screen shows in this
  vertical order: app top bar (PROJ-4's `TopBarDesktop`) →
  Grid panel → horizontal resize handle → Builder toolbar →
  Builder canvas.
- [ ] Given the editor renders, when the Grid panel is
  inspected, then it contains a header strip with the
  calculator-title `<span>` removed (the title is in the top
  bar; the Grid header is element-listing only) and a body
  area sized to fit "no columns" (the empty
  "no cells yet" Grid state — see Grid panel section below).
- [ ] Given the resize handle is dragged, when the pointer
  moves, then the Grid panel height changes accordingly, with
  a minimum of 80px (collapsed strip) and a maximum of 60% of
  the editor's available vertical space. The Builder
  canvas reclaims the inverse.
- [ ] Given the Grid panel is resized within the session,
  when the user navigates away from the editor and back,
  then the height resets to the default (164px when no
  columns are expanded — matches design file
  `editor.jsx:202`). No localStorage / DB persistence.
- [ ] Given the chevron-up control in the Grid header is
  clicked, when the click is registered, then the Grid panel
  collapses to a ~40px strip showing only the header. The
  Builder canvas fills the reclaimed space.
- [ ] Given the Grid panel is collapsed, when the chevron-down
  (rotated 180°) is clicked, then the Grid panel restores to
  its prior height (the value before collapse, or the
  default if it was never resized).

### Desktop top bar — editor adjustments

- [ ] Given `/editor/<id>` is open, when `TopBarDesktop`
  renders, then the breadcrumb shows two segments:
  `Dashboard` (linked to `/dashboard`) and the calculator
  title (active, inline-renameable). The title is read from
  the calculator row, NOT from a hard-coded placeholder.
- [ ] Given the calculator's stored title is the empty string
  (impossible via API but defensive), when the breadcrumb
  renders, then the second segment renders 'Untitled
  calculator' as a visual fallback.
- [ ] Given the user clicks the active title segment, when the
  click is registered, then the segment becomes a focused
  `<input type="text">` pre-filled with the current title,
  with text selected.
- [ ] Given the input is focused, when the user presses Enter,
  then the trimmed value is committed (PATCH
  `/api/calculators/:id`) and the segment returns to
  display state. The undo stack receives the title-rename
  operation. Empty-after-trim values are rejected client-side
  with the input staying focused and a brief shake/border-
  red treatment.
- [ ] Given the input is focused, when the user clicks
  outside, then the trimmed value is committed (same path as
  Enter).
- [ ] Given the input is focused, when the user presses Esc,
  then the input reverts to the original title without a
  write, and the segment returns to display state.
- [ ] Given the input is focused, when the user types past 100
  characters, then the input refuses further keystrokes (HTML
  `maxLength={100}`).
- [ ] Given a title-rename PATCH returns 409, when the toast
  surfaces, then the breadcrumb stays at the user's typed
  value AND the editor is now in a stale state — until the
  user reloads, further PATCHes continue to 409 (per spec
  600-602). PROJ-20 replaces the toast with the proper banner.

### Desktop top bar — calculator-theme picker

- [ ] Given `/editor/<id>` is open, when `TopBarDesktop`
  renders, then between the breadcrumb and the "+ New
  calculator" button is a calculator-theme picker. The picker
  is NOT shown on `/dashboard`, `/settings`, or any
  non-editor route — it's passed via `TopBarDesktop`'s
  existing `rightExtras` prop.
- [ ] Given the theme picker's closed state, when inspected,
  then it shows a small `ThemeSwatch` for the current theme
  + the theme's `displayName` (truncated if needed) + a
  chevron-down. Layout matches design file
  `editor.jsx:36-54` (ThemePicker component).
- [ ] Given the theme picker is clicked, when it opens, then
  an anchored shadcn Popover (NOT a bottom sheet on desktop)
  lists all 8 themes returned by `getThemeIds()` in the
  registry order. Each row contains: `ThemeSwatch`, theme
  `displayName`, theme `description`, and a checkmark on the
  currently-active row.
- [ ] Given the picker is open, when a different theme row is
  clicked, then the popover closes, the calculator's
  `theme_id` is PATCHed to the new id, the Builder canvas
  re-renders with the new theme's tokens immediately (within
  the same React render pass), and the undo stack receives
  the theme-change operation.
- [ ] Given the picker is open, when the user presses Esc or
  clicks outside, then it closes without committing.
- [ ] Given the calculator's stored `theme_id` is unknown
  (e.g. a theme was removed in a future migration), when the
  picker renders, then the closed-state swatch reflects the
  fallback theme returned by `getTheme(stored_id)` (per
  PROJ-6 contract — the default 'calcgrinder' theme), and
  the picker still functions normally.

### Desktop top bar — "+ New calculator" button

- [ ] Given any signed-in route under `/dashboard`, `/editor`,
  or `/settings`, when `TopBarDesktop` renders, then the
  "+ New calculator" button is **enabled** (the
  `TooltipProvider` + `Tooltip` + `disabled` wrapper around
  it in `src/components/shell/top-bar-desktop.tsx` is
  retired by PROJ-8 — replaced with a plain enabled `Button`
  wired to the create handler).
- [ ] Given the "+ New calculator" button is clicked, when
  the click is processed, then `POST /api/calculators` is
  invoked (no body needed), and on success the client
  navigates to `/editor/<new-id>` in the same tab via
  `router.push`.
- [ ] Given `POST /api/calculators` returns an error (network
  failure, 500, 401), when the failure surfaces, then a
  shadcn toast appears reading "Couldn't create calculator —
  please try again." The button remains clickable for retry.
- [ ] Given the "+ New calculator" button is clicked while the
  user is already on `/editor/<some-id>`, when the new
  calculator is created, then the navigation replaces the
  current editor route — the previous calculator's editor
  state (resize, undo stack) is discarded.

### Dashboard hero "Build a new calculator" button

- [ ] Given a signed-in user on `/dashboard`, when the page
  renders, then a prominent Hero "Build a new calculator"
  button is **always visible** at the top, regardless of
  whether My Calculators / My Scenarios / Presets sections
  are present (the PROJ-5 visibility deferral is retired).
- [ ] Given the Hero button is clicked, when the click is
  processed, then it uses the same create handler as the
  top-bar "+ New calculator" button — same POST, same
  navigate-to-`/editor/<new-id>`.
- [ ] Given a user with zero calculators clicks the Hero on
  first visit, when the new calculator is created, then
  they land in `/editor/<id>` with the Builder canvas
  showing the themed hero "Untitled calculator" and the
  "Add cells to get started" empty-state card.
- [ ] Given the Hero button's PROJ-5 decision-log entry
  ("Hero hidden in PROJ-5; assigned to PROJ-10"), when this
  feature lands, then the Hero is enabled in PROJ-8 instead.
  The PROJ-5 spec receives a brief implementation-note
  appendix recording the reassignment so future readers
  trace the change. (Reassignment is benign: PROJ-10 still
  owns publish/share-token, just not the create button.)

### Builder toolbar

- [ ] Given the desktop editor renders, when the Builder
  toolbar is inspected, then it sits between the resize
  handle and the Builder canvas, ~44px tall, and contains in
  reading order from left to right: Undo button, Redo button,
  a thin separator, the viewport-width picker (Desktop /
  Tablet / Mobile), a flex spacer, the "+ Add" picker
  button.
- [ ] Given the Builder toolbar renders, when the Preview
  button is searched for, then it is **not present** in
  PROJ-8 (hidden until PROJ-10 ships the public token surface).
- [ ] Given the Builder toolbar renders, when the
  hidden-cells pill is searched for, then it is **not
  present** in PROJ-8 — the pill is conditionally rendered
  on `hiddenCount > 0`, and PROJ-8 has zero cells so the
  count is always 0.
- [ ] Given the Builder toolbar renders, when the
  code-import sparkles button is searched for, then it is
  **not present** in PROJ-8 (hidden until PROJ-21).
- [ ] Given the viewport-width picker has three options
  (Desktop / Tablet / Mobile), when one is selected, then
  the Builder canvas's preview width changes to the
  corresponding constraint (Desktop: full width; Tablet:
  ~768px; Mobile: ~390px) while the editor frame itself
  stays full-window. Selection is session-scoped (resets on
  reload).

### "+ Add" picker

- [ ] Given the "+ Add" button in the Builder toolbar is
  clicked, when the picker opens, then it lists exactly four
  options in order: **Cell**, **Chart**, **Text block**,
  **Section**. Each option has a small icon, a label, and a
  one-line subtitle (e.g. "Add an input or output value" for
  Cell, "Group elements together" for Section per
  `Calcgrinder-spec.md:785-786`).
- [ ] Given the picker renders, when any of the four options
  is inspected, then it is **disabled** in PROJ-8.
- [ ] Given a disabled option is hovered, when a tooltip
  appears, then it reads (per option):
  - Cell → "Cell authoring ships next."
  - Section → "Section management ships next."
  - Chart → "Charts ship in v1.1."
  - Text block → "Text blocks ship in v1.1."
- [ ] Given a disabled option is clicked, when the click is
  processed, then nothing happens — no row write, no
  navigation, no toast.
- [ ] Given the picker is open, when the user presses Esc or
  clicks outside, then the picker closes.
- [ ] Given the picker's component is inspected, when its
  React props are read, then each option's `disabled` flag
  is a single boolean — PROJ-9 flips Cell + Section to
  enabled with no other structural change to the picker; P1
  flips Chart + Text-block. This satisfies the INDEX.md
  forward-compat note: "enabling them in P1 must be a flag
  flip, not a re-architecture of the picker."

### Undo / Redo

- [ ] Given the Builder toolbar renders, when the Undo button
  is inspected, then it has an `aria-label="Undo"` and is
  disabled when the undo stack is empty.
- [ ] Given the Builder toolbar renders, when the Redo button
  is inspected, then it has `aria-label="Redo"` and is
  disabled when the redo stack is empty.
- [ ] Given a user renames the calculator from "Untitled
  calculator" to "Mortgage", when the rename commits, then
  one entry is pushed onto the undo stack with enough
  information to restore the prior title.
- [ ] Given the Undo button is clicked (or Cmd-Z / Ctrl-Z is
  pressed), when the entry pops, then the calculator's title
  reverts to "Untitled calculator" (server PATCH + breadcrumb
  re-render), and a redo entry is pushed onto the redo stack.
- [ ] Given the Redo button is clicked (or Cmd-Shift-Z /
  Ctrl-Y is pressed), when the entry pops, then the title
  re-applies to "Mortgage" and the entry returns to the
  undo stack.
- [ ] Given a user picks a different theme, when the change
  commits, then one entry is pushed onto the undo stack with
  the prior `theme_id`. Same undo / redo behaviour applies.
- [ ] Given a new operation is performed (e.g. rename) while
  the redo stack is non-empty, when the operation commits,
  then the redo stack is cleared — standard undo-stack
  semantics.
- [ ] Given the user reloads the editor page, when the
  editor remounts, then both undo and redo stacks are empty.
  Stacks are session-scoped per `Calcgrinder-spec.md:527`.
- [ ] Given Cmd-Z is pressed while an input is focused
  (e.g. the breadcrumb rename input), when the keystroke is
  intercepted, then the browser's native input-undo wins —
  the editor-level undo only fires when no editable surface
  has focus. (Implementation: keyboard handler attached at
  document level checks `document.activeElement` and skips
  when it's an `<input>` / `<textarea>` / `contenteditable`.)
- [ ] Given an undo PATCH returns 409 (stale), when the
  failure surfaces, then the editor follows the same generic-
  toast flow as a forward PATCH 409 — the operation is NOT
  re-added to the redo stack, the undo stack remains empty
  for safety, and the user is invited to reload.

### Builder canvas — empty state

- [ ] Given `/editor/<new-id>` is opened for a freshly-created
  calculator, when the Builder canvas renders, then it shows
  in this vertical order:
  - The calculator's themed hero — title only, read-only, rendered
    via the active theme's hero tokens (font, size, color from
    the theme). Description is not rendered in PROJ-8 (PROJ-9
    adds the description block).
  - One centred `EmptyOrErrorState` card (`variant='empty'`,
    inherits PROJ-4's `EmptyOrErrorState` component) with
    title "Add cells to get started" and body "Cell authoring
    ships next." (Wording flagged as Open Question if the
    user prefers a less self-referential phrasing.)
- [ ] Given the calculator's theme is switched, when the new
  theme is applied, then the hero typography and the empty-
  state card surrounding (background, border, text colour
  read from theme tokens) re-render to match the new theme.
- [ ] Given the calculator's title is updated, when the
  rename commits, then the Builder hero text re-renders to
  the new title within the same React render pass — no
  reload required.
- [ ] Given the Builder canvas in PROJ-8 has no cells, when
  inspected, then it renders no slot-iteration code that
  branches on `display_element` type — the dispatch
  scaffolding lives in code but the iterated list is empty
  in PROJ-8. PROJ-9 fills the list.

### Fallback-theme banner

- [ ] Given a calculator's stored `theme_id` resolves to the
  fallback (i.e. `getTheme(stored_id)` returned the default
  because the id is unknown), when the editor renders, then
  an inline banner is shown in the Builder panel reading:
  > "This calculator's theme is no longer available — using
  > Calcgrinder · Light. Pick a new theme to dismiss."
- [ ] Given the fallback banner is present, when the user
  picks any valid theme from the top-bar theme picker, then
  the banner disappears (the stored `theme_id` now resolves
  without fallback).
- [ ] Given the fallback banner is present, when the
  visitor view URL is opened (`/c/<token>`, PROJ-11), then
  the banner does NOT appear there — it's editor-only. (This
  AC is forward-compat: PROJ-11 verifies end-to-end when
  the visitor view exists.)
- [ ] Given the banner renders, when it is inspected, then it
  uses the existing `EmptyOrErrorState` component
  (`variant='error'`, `framed={false}`, banner-shaped),
  consistent with `Calcgrinder-spec.md:597` ("uses the same
  EmptyOrErrorState component (banner variant)").

### Mobile layout

- [ ] Given a mobile viewport (< 768px wide), when
  `/editor/<id>` renders, then the screen shows in this
  vertical order: app top bar (PROJ-4's `TopBarMobile` with
  wordmark + truncated calculator name + avatar) → editor
  toolbar (theme picker + viewport picker) → Builder canvas
  filling the rest → footer nav.
- [ ] Given the mobile editor renders, when the top-bar
  breadcrumb is searched for, then it is NOT present — mobile
  has no breadcrumb per `Calcgrinder-spec.md:736-738`. Title
  editing on mobile is via the Builder hero in PROJ-9; in
  PROJ-8 mobile has no title-edit affordance and the title is
  visible only as the top-bar's truncated label.
- [ ] Given the mobile editor toolbar renders, when its
  contents are inspected, then it contains a compact theme
  picker (swatch + word "Theme" without `displayName`) and
  the viewport-width picker. No "+ Add", no hidden-cells
  pill, no Preview button — these live in the desktop
  toolbar only on mobile per
  `Calcgrinder-spec.md:1644-1657` (mobile uses the footer
  nav for primary actions).
- [ ] Given the mobile editor renders, when the footer nav is
  inspected, then it contains in reading order from left to
  right: Undo button + Redo button (grouped pair), a flex
  spacer, the Grid drawer toggle (pill with switch glyph), a
  flex spacer, the "+ Add cell" button (icon-only mode). The
  layout follows the spec-mandated structure ("undo/redo
  group on the left, Grid drawer toggle in the centre, view-
  mode / preview on the right") with the right-slot
  occupied by the "+ Add cell" button instead of Preview,
  because Preview is hidden in PROJ-8 and the +Add affordance
  needs a touch target.
- [ ] Given the mobile footer's Grid toggle is tapped, when
  the toggle activates, then a Grid drawer slides up from the
  bottom of the viewport, occupying ~50% of the viewport
  height. The drawer shows an empty-state placeholder reading
  "No cells yet. Add cells in the Builder." (PROJ-9 replaces
  this with the real cell-row list + focused-expand.)
- [ ] Given the Grid drawer is open, when the toggle is
  tapped again, then the drawer slides back down. The toggle
  acts as a press-to-toggle.
- [ ] Given the Grid drawer is open, when the user taps
  outside the drawer (on the Builder canvas above), then the
  drawer slides down. Same behaviour as toggling.
- [ ] Given the mobile theme picker is tapped, when it opens,
  then a bottom sheet (not a popover, per the spec's
  mobile-first constraint at `Calcgrinder-spec.md:1582-1585`)
  lists all 8 themes with `ThemeSwatch` + `displayName` +
  `description`. Selection commits and dismisses the sheet.

### Live sync between top bar / theme picker and Builder canvas

- [ ] Given a calculator is open in two browser tabs (same
  user, same id), when the user renames the title in tab A,
  then tab B does NOT auto-update — there is no real-time
  sync in v1. (Spec line 1583 mentions optimistic concurrency
  as the conflict-resolution model, not real-time sync.)
  Tab B's next write will 409.
- [ ] Given the user renames the title in the breadcrumb,
  when the rename commits, then within the same render pass
  the Builder hero re-renders with the new title. No reload,
  no API re-fetch — the React state is the single source of
  truth client-side.
- [ ] Given the user picks a new theme, when the PATCH
  succeeds, then the Builder canvas re-renders with the new
  theme tokens within the same render pass — no flash, no
  unmount-remount.
- [ ] Given a PATCH is in-flight (e.g. rename committed but
  network slow), when the user immediately triggers another
  action (theme change, rename again), then the second PATCH
  waits until the first resolves (serial), so the
  `updated_at` echo stays consistent. The UI feels
  optimistic — local state updates before the PATCH
  resolves — but the server-side ordering is serial.

### Reusable architecture seams

- [ ] Given the editor's data layer, when inspected, then it
  exposes a single Zustand store (or React Context — implementer's
  choice; either works) with the calculator state, the undo /
  redo stacks, and the Grid-height. The PROJ-9 cell layer
  attaches to the same store.
- [ ] Given the Builder canvas component, when inspected, then
  it renders the hero from a small `<CalculatorHero>` subcomponent
  and the empty-state card from a small `<EmptyBuilder>`
  subcomponent. PROJ-9 will replace `<EmptyBuilder>` with the
  real section / element pipeline; the hero subcomponent stays
  and gains its hover-edit affordance in PROJ-9.
- [ ] Given the "+ Add" picker, when inspected, then it accepts
  an array of options each with `{ id, label, subtitle, icon,
  disabled, onSelect }`. PROJ-9 enables Cell + Section by
  flipping `disabled: false` and providing `onSelect`. No
  picker rewrite required.
- [ ] Given the breadcrumb-rename component, when inspected,
  then its commit handler is parameterised on a callback
  `(newTitle: string) => Promise<void>`. The PATCH call lives
  in the page component, not the breadcrumb component, so
  PROJ-9's Builder-hero edit-in-place can reuse the same
  commit logic.

## Edge Cases

- **Empty title after trim.** The breadcrumb rename input
  refuses to commit; the input stays focused with a brief
  shake/border-red treatment. Esc and clicking-outside still
  revert to the prior valid title. The DB check constraint
  (`length(trim(title)) > 0`) acts as a server-side backstop.
- **Title with 100+ chars pasted into the breadcrumb input.**
  HTML `maxLength={100}` blocks at the browser level. If
  somehow more is sent (e.g. programmatic), the server returns
  HTTP 400 `title_too_long` and the toast surfaces.
- **Theme picker opened before the calculator data has loaded.**
  The picker is hidden until the editor data is hydrated.
  PROJ-4's `AppShell` handles the loading skeleton for the rest
  of the editor; the theme picker simply isn't rendered until
  `calculator.theme_id` is in state.
- **Resize handle drag spans multi-monitor / off-screen.** The
  drag clamps to the editor's visible bounds; releasing the
  pointer outside the viewport still commits the last in-bounds
  height. No "snap to position" needed.
- **Chevron-collapse pressed while Grid panel is mid-resize.**
  The mid-resize state is committed first, then the collapse
  applies on top. Re-expand returns to the just-committed
  height.
- **Browser tab killed mid-PATCH.** The optimistic local state
  reverts on next mount (server is the source of truth).
  Worst case: the user's last-typed title shows briefly in the
  breadcrumb on next load if it was committed, or doesn't if it
  wasn't.
- **Calculator deleted (PROJ-13) while the user is editing it
  in another tab.** The user's next PATCH returns 404 — they
  get the generic save-failed toast. PROJ-20 introduces the
  proper "moved-to-Trash" 410 banner. PROJ-8's toast is the
  v1-acceptable fallback.
- **`theme_id` set to an unknown string by future migration /
  manual DB edit.** `getTheme` falls back to 'calcgrinder', the
  fallback banner shows, and the user can pick a valid theme
  to clear the banner. Per PROJ-6 contract.
- **Mobile user rotates device mid-edit.** The mobile / desktop
  breakpoint at 768px swaps layouts. The undo / redo stacks
  survive (they live in the same store). The Grid drawer
  closes if it was open. The breadcrumb appears on landscape
  tablet (≥ 768px) and gains the inline-rename affordance.
- **User loses network mid-PATCH.** The PATCH request rejects
  with a network error; the generic save-failed toast shows.
  Local state remains at the optimistic value, which diverges
  from the server. Reloading restores the server state. The
  user is expected to re-apply their change on reconnect.
- **Two users somehow share an `owner_id`.** Impossible by
  schema (FK to `auth.users(id)`) — included for paranoia.
  Even so, RLS scopes to `auth.uid()` and PATCH is concurrency-
  versioned, so the "second writer wins after retry" semantics
  hold.

## Technical Requirements

- **Performance.** The editor must reach interactive state
  (top bar + theme picker + Builder hero rendered, undo
  handlers attached) within 1.5s on a fresh `/editor/<id>`
  load over a typical broadband connection. The single
  database read (the calculator row) happens server-side
  during the initial render — no client-side waterfall.
- **Bundle size.** PROJ-8 adds no new heavy dependencies. The
  editor reuses React 18, Next.js 16, shadcn/ui primitives
  (`Popover`, `Tooltip`, `Button`, `Sheet`, `Input`,
  `Toaster`), and PROJ-6's `ThemeSwatch`. No
  drag-resize library — a hand-rolled pointer-event handler
  is sufficient for the single horizontal handle.
- **Accessibility.** All interactive elements have ARIA
  labels: the breadcrumb rename input has `aria-label="Rename
  calculator"`; the theme picker button has
  `aria-haspopup="listbox"`; each theme option has
  `role="option"`. The resize handle has
  `role="separator"`, `aria-orientation="horizontal"`,
  `aria-valuenow` reflecting the current height, and
  `tabIndex={0}` with arrow-key resize support (↑ / ↓ adjust
  by 24px increments). Toast messages are announced via
  `aria-live="polite"`.
- **Browser support.** Modern evergreen (Chrome, Firefox,
  Safari, Edge). No IE11. Pointer Events for the resize
  handle (fallback to mouse / touch as needed).
- **Security.** Per PROJ-1's RLS + the new RLS policies on
  `calculators`. Server routes use the cookie-bound
  `createClient` (from `@/lib/supabase/server`) so writes go
  through RLS. The admin client (`createAdminClient`) is NOT
  used by PROJ-8 — every PROJ-8 write is an owner-acting-on-
  own-row operation and stays within the owner's RLS scope.
- **Test plan.** Unit tests for: the breadcrumb-tabs helper
  extension, the title-validation logic, the theme-picker
  state machine, the undo / redo reducer (push, undo, redo,
  clear-on-new-op, empty-handling), the resize-handle pointer
  math (clamping to min / max). Integration tests for: POST /
  GET / PATCH `/api/calculators` happy paths and the 409
  stale-write path. E2E (Playwright): sign in → click
  "+ New calculator" top-bar button → arrive at
  `/editor/<id>` → rename to "Mortgage" → switch theme to
  "Vessel" → Cmd-Z twice → confirm title and theme both
  reverted → reload → confirm undo stacks empty.

## Open Questions

- [ ] Empty-state copy: "Cell authoring ships next." reads
  self-referentially ("ships next" assumes the user reads
  Calcgrinder roadmap docs). Replace with something visitor-
  facing like "This calculator has no cells yet" or "Start by
  adding an input cell"?
- [ ] Should the editor's `/editor/<id>` page issue a small
  in-memory analytics ping on load (calculator opened) so
  PROJ-19 sysadmins can later see which calculators are
  heavily edited? Current scope: NO (the PRD's Non-Goals
  forbid analytics in v1). Logging this as Open in case the
  position changes between PROJ-8 and PROJ-19.
- [ ] Theme-picker keyboard navigation: arrow keys move
  between rows, Enter commits, Esc closes. Should `/` or `t`
  focus the picker from anywhere in the editor? Convenience
  shortcut for power users — left out of PROJ-8 by default,
  flagged for revisit if anyone asks.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| **Scope: PROJ-8 = editor shell only; no cell rendering, no section management.** Builder canvas in PROJ-8 shows the themed hero + an empty-state card. | Cleanest split with PROJ-9 (Cell Authoring & Section Management). PROJ-8 stays a pure infrastructure / chrome feature that PROJ-9 fills in. The alternative — embedding read-only cell rendering in PROJ-8 — would blur the boundary and require PROJ-8 to ship rendering logic it can't fully test until PROJ-9 lands. | 2026-05-23 |
| **PROJ-8 introduces a minimal `calculators` table** with `id`, `owner_id`, `title`, `description`, `theme_id`, `created_at`, `updated_at`, `soft_delete_at`. | The editor route is unreachable without a row. Adding `soft_delete_at` now is free and saves PROJ-13 a migration. `published` and `public_token` deliberately wait for PROJ-10 — those are security-sensitive (token-bearing public URLs) and deserve their own migration, plus PROJ-10 already owns publish UX. `source_calculator_id` waits for PROJ-18. | 2026-05-23 |
| **PROJ-8 owns the create-calculator click path** (`POST /api/calculators` + enabling both the dashboard Hero "Build a new calculator" button and the top-bar "+ New calculator" button). | PROJ-5's decision log assigned this to PROJ-10. Since PROJ-8 now introduces the table, the create path is intrinsic to PROJ-8 anyway — assigning it to PROJ-10 would leave PROJ-8 unreachable end-to-end and PROJ-10 would only retire a tooltip. The reassignment is recorded here and via an implementation-note appendix on PROJ-5's spec. PROJ-10 still owns publish + share-token. | 2026-05-23 |
| **Owner-only editor access; 404 (not 403) on cross-owner / soft-deleted / unknown id.** | Don't leak existence of other users' calculators. 404 is consistent across "doesn't exist" and "not yours" so an attacker can't probe IDs to enumerate. Matches the PRD's small-deployer mindset (one instance, low-volume, trust-the-deployer to keep IDs unguessable). | 2026-05-23 |
| **Title editing in PROJ-8: top-bar breadcrumb only.** Description editing and Builder-hero hover-edit wait for PROJ-9. | Builder hero hover-edit needs the hero rendering pipeline, which is PROJ-9's territory. The breadcrumb rename is a self-contained surface on the top bar (PROJ-4's existing component) and gives the editor a usable title-edit path without dragging the hero into scope. | 2026-05-23 |
| **PROJ-8 ships server-side optimistic concurrency** (`updated_at` column + stale-write 409 rejection), plus a generic shadcn toast on 409. PROJ-20 replaces the toast with the proper non-modal banner UX. | The concurrency mechanism (column + check) is the foundation; the banner is the polish. Putting the column in PROJ-8 means every PROJ-8 / PROJ-9 / PROJ-10 write path naturally adopts the check. PROJ-20 then has a clean surface — replace the toast with a banner, add reload affordance, handle the calculator-deleted 410 variant. | 2026-05-23 |
| **Undo / Redo in PROJ-8: title-rename and theme-change enroll into the session-scoped stack.** Plumbing (stack data structure, toolbar buttons, `Cmd-Z` / `Cmd-Shift-Z` handlers) all in PROJ-8. PROJ-9 enrolls cell mutations into the same stack. | Makes PROJ-8 demonstrably usable on its own — the Undo / Redo buttons aren't dead during PROJ-8's lifetime. Stack is in-memory and session-scoped per `Calcgrinder-spec.md:527`. | 2026-05-23 |
| **+ Add picker: visible in PROJ-8 with all 4 options (Cell / Chart / Text block / Section) visible-but-disabled.** Each option has a per-option tooltip explaining when it'll be enabled. | Satisfies INDEX.md's forward-compat constraint: "enabling them in P1 must be a flag flip, not a re-architecture of the picker." Visible-but-disabled is more honest than hidden — the user sees what's coming, and the picker's layout is stable across PROJ-8 → PROJ-9 → P1 transitions. | 2026-05-23 |
| **Preview button hidden in PROJ-8 (added by PROJ-10).** | No public token exists in PROJ-8, so the button has nothing to open. Hiding rather than show-disabled keeps the toolbar reading cleanly. The user (UX deliberate empty-multiselect) accepted defaults to hide-everything-not-strictly-needed; this is the cleanest application of that default. | 2026-05-23 |
| **Code-import sparkles button hidden in PROJ-8 (added by PROJ-21).** | Same reasoning as Preview. The code-import feature itself is P1 (PROJ-21), so PROJ-8 doesn't host a dead entry point. | 2026-05-23 |
| **Hidden-cells pill is conditional on `hiddenCount > 0`** and therefore never visible in PROJ-8 (always 0 cells). | Matches `Calcgrinder-spec.md:78-97` of the design file: the pill component is rendered only when the count is non-zero. PROJ-9 wires the pill to real cell data; the pill's popover surface ships with PROJ-9 too. | 2026-05-23 |
| **Mobile Grid drawer toggle is visible in PROJ-8; opening the drawer shows an empty-state placeholder ("No cells yet.").** | Hiding the toggle would change the mobile chrome shape between PROJ-8 and PROJ-9, complicating mobile users' muscle memory and design-system tests. Empty-state placeholder uses PROJ-4's `EmptyOrErrorState` for visual consistency. | 2026-05-23 |
| **Drag-resizable Grid / Builder resize handle, session-scoped (no localStorage / DB).** | Per-user persisted heights add complexity without obvious v1 benefit. Sessions reset on reload — typical editor sessions are long-lived enough to make the drag worthwhile, short enough that "remember across reloads" isn't critical. v1.x can add localStorage if user feedback asks. | 2026-05-23 |
| **Calculator-theme picker is a desktop top-bar anchored popover with `ThemeSwatch` previews; mobile is a bottom sheet.** | Desktop popover matches the spec's "avatar popover is the one allowed popover at app level" subordination — the theme picker is the second allowed popover because it's a non-destructive single-tap commit, not a navigation choice. Mobile uses a bottom sheet per the mobile-first constraint (`Calcgrinder-spec.md:1582-1585`). | 2026-05-23 |
| **Builder canvas empty state: themed hero (title only, read-only) + one `EmptyOrErrorState` card.** | An empty viewport without the hero would feel broken on first edit. Rendering the title gives feedback that the edit ("Untitled calculator" default) is live; the empty-state card tells the user what to expect next. Description stays out of the hero in PROJ-8 because the edit affordance is PROJ-9. | 2026-05-23 |
| **Mobile footer nav: undo/redo group | Grid toggle | "+ Add cell" button.** Spec-mandated structure is "undo/redo | Grid toggle | view-mode/preview" (`Calcgrinder-spec.md:1636-1638`). | Preview button is hidden in PROJ-8 (above decision), so the right slot is reassigned to "+ Add cell" to keep a primary mobile-first authoring affordance at thumb reach. PROJ-10 may revisit when Preview ships; PROJ-9 may revisit when "+ Add cell" wires into real cell creation. The spec's structural shape (3 slots, left / centre / right) is preserved. | 2026-05-23 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| **One new database table — `calculators` — added via a single Supabase CLI migration.** No staging table, no shadow table, no extra reference tables. | The spec defines exactly 8 columns and they're all known up-front. Splitting the schema across migrations would buy nothing and add migration-ordering risk. | 2026-05-23 |
| **Three owner-only API routes under `/api/calculators`** (`POST` collection, `GET` + `PATCH` single resource). No `DELETE`, no list endpoint. | Listing is owned by PROJ-5 (Account Dashboard's "My Calculators" — and that one is also deferred until PROJ-10 wires it). Delete is owned by PROJ-13 (soft-delete + Trash). PROJ-8's API surface is the minimum that the editor route, the create-button click handler, and the rename / theme-pick PATCHes require. | 2026-05-23 |
| **Editor data layer = React Context + a small reducer, not Zustand.** State is page-scoped to `/editor/<id>` and dies on unmount — exactly the lifetime a Context provides. | The spec left the choice open. Zustand shines for cross-route shared stores; this state never leaves the editor tree. Skipping Zustand avoids a new dependency, keeps the bundle smaller, and matches the existing project patterns (no global store today). PROJ-9's cell mutations dispatch through the same reducer; the slice shape stays additive. | 2026-05-23 |
| **Undo / Redo is a pure reducer over an in-memory `{ past, present, future }` triple, no third-party library.** | The stack only needs push / undo / redo / clear-on-new-op. That's ~30 lines of reducer code. A library (`zundo`, `useUndo`) would add a dep for behaviour we can hand-write and test exhaustively. Each enrolled operation describes itself with two callbacks: `do` and `undo`. PROJ-9's cell mutations enroll the same way. | 2026-05-23 |
| **Optimistic concurrency uses `updated_at` as the version token, not a separate `version int` column.** The trigger that bumps `updated_at` on every UPDATE doubles as the version-bump. | The spec already mandates an `updated_at` column with a BEFORE-UPDATE trigger. A second column would be redundant. Timestamp granularity (microsecond on Postgres) is more than sufficient for human-edit cadence; the only collision risk is two PATCHes in the same microsecond, which the database-side comparison rules out anyway. | 2026-05-23 |
| **Resize handle is a hand-rolled pointer-event component, not a third-party split-pane library.** | One horizontal handle, two min/max clamps, no nested panes, no persistence. Libraries like `react-resizable-panels` add ~12 KB and a layout opinion for behaviour we can implement in ~60 lines. The component owns its own pointer-capture, keyboard-resize, and ARIA wiring. | 2026-05-23 |
| **404-on-not-yours / soft-deleted is decided by the server-side page load**, not by client-side fetch. The page is a Server Component that calls the cookie-bound Supabase client, runs the row lookup once, and renders Next's `notFound()` when the row is missing or owned by someone else. | Putting the gate in the page means a non-owner never sees the editor chrome flash before a redirect. It also collapses three of the AC scenarios (not-yours, doesn't-exist, soft-deleted) into one server-side branch. The PATCH / GET API routes apply the same opacity rule independently, so an attacker can't probe via the API either. | 2026-05-23 |
| **Owner-only writes go through the cookie-bound Supabase client + RLS — `createAdminClient` is NOT used.** | Every PROJ-8 write is "owner editing own row". The publishable-key client + RLS scope to `auth.uid()` is the right tool. Using the secret-key admin client would bypass RLS and force us to re-derive ownership in app code, which is a worse posture than letting Postgres enforce it. | 2026-05-23 |
| **The `+ Add` picker is a registry-driven component**, parameterised on a list of `{ id, label, subtitle, icon, disabled, tooltipWhenDisabled, onSelect }` rows. | Forward-compat hinge — PROJ-9 enables Cell + Section by passing `disabled: false` plus an `onSelect`. P1 enables Chart + Text-block the same way. No conditional branching, no v-flag, no picker rewrite. Satisfies the INDEX.md forward-compat note literally. | 2026-05-23 |
| **The Builder canvas's slot-iteration pipeline is shipped as an empty array in PROJ-8** — the `<SlotRenderer>` exists, accepts a polymorphic `display_element` array, and returns nothing because the array is `[]`. | Lets PROJ-9 add cells / sections / hidden-cells handling without touching renderer dispatch. Lets PROJ-11 (visitor view) reuse the same `<SlotRenderer>` by passing the same array shape from a different data loader. This is the load-bearing forward-compat seam called out in INDEX.md for PROJ-11. | 2026-05-23 |
| **Theme picker on desktop = shadcn `Popover`; on mobile = shadcn `Sheet` (bottom variant).** Two surfaces, one inner list component. | The list rows (swatch + name + description + checkmark) are identical between desktop and mobile. The surface wrapper differs because `Calcgrinder-spec.md:1582-1585` mandates bottom sheets on mobile for picker UIs. Sharing the inner list keeps content edits in one place. | 2026-05-23 |
| **Title rename input lives inside the existing `TopBarDesktop` breadcrumb — no new top-bar component**, only an extension to `buildBreadcrumbTabs` so the active segment can be marked `editable: true`. | Keeps top-bar layout decisions concentrated in one file. PROJ-4 already exposed the `editorTitle` prop hook; PROJ-8 reads from it and adds an `onEditorTitleCommit` callback. PROJ-4's `top-bar.test.tsx` extends with the inline-rename cases. | 2026-05-23 |
| **Fallback-theme banner is a regular render inside the Builder panel**, driven by a derived boolean `isFallback = getThemeIds().indexOf(stored_id) === -1`. No DB write, no event. | Per PROJ-6's contract, fallback is a read-time concern. Surfacing it in the editor is one boolean and one `<EmptyOrErrorState variant='error' framed={false}>` instance. PROJ-11 deliberately does NOT render the banner — the visitor doesn't pick themes. | 2026-05-23 |
| **Mobile Grid drawer = shadcn `Sheet` (side='bottom'), opens to a fixed ~50%-of-viewport height in PROJ-8.** | PROJ-9 will swap the height policy to content-driven-capped-at-70% once the drawer carries real cell rows. Fixed 50% is the cleanest empty-state placeholder — predictable, no layout jitter, matches design file's empty-drawer mock. | 2026-05-23 |
| **Login redirect param is `next`, not `redirect`**, matching the existing PROJ-3 middleware. The AC at line 354 saying `?redirect=…` is a spec typo we're choosing to follow the middleware on (single source of truth = `route-gate.ts`). | The middleware already redirects unauthenticated `/editor/*` visitors with `?next=<path>`. Diverging would break the login form's existing post-login redirect logic. Flagged here so QA reads against the right param. The spec text will be patched in a follow-up edit. | 2026-05-23 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### What we're building, at a glance

PROJ-8 is the editor **shell** — the page route, the database row it
loads, the chrome around the canvas, and the create-calculator click
path that gets users to it. It ships nothing that renders user
content (cells, charts, text blocks): that's PROJ-9 and beyond.

Three new pieces stand up:

1. A `calculators` database table (one row per calculator) with
   owner-only access enforced by Postgres.
2. Three owner-only API endpoints to create, read, and update a
   calculator's title / description / theme.
3. The `/editor/<id>` page itself — a two-panel split on desktop,
   a builder-first stack on mobile, with the breadcrumb-rename and
   theme-picker affordances wired into the existing top bar.

Everything else (Grid cells, sections, publish flag, share token,
visitor view, scenarios, trash) is explicitly scoped out and waits
for its own feature spec.

### Data model — `calculators` table (plain language)

One database table is added. Each row represents a single
calculator owned by a single registered user.

Per row we store:

- **Unique id** (generated by the database)
- **Owner id** (foreign key to the user; if the user is deleted,
  their calculators delete too)
- **Title** (the calculator's name; required; max 100 characters
  after trimming whitespace; default "Untitled calculator")
- **Description** (free-form text; no length cap; default empty
  string)
- **Theme id** (the calculator's visual theme — one of the 8
  registered ids; defaults to `calcgrinder`)
- **Created at** (timestamp of row insert)
- **Updated at** (timestamp; auto-bumped by a database trigger on
  every UPDATE; doubles as the optimistic-concurrency version)
- **Soft-deleted at** (nullable timestamp; PROJ-8 only adds the
  column — actual soft-delete behaviour ships with PROJ-13)

**Access control.** Row-Level Security is enabled. A signed-in user
can read, insert, and update only the rows where they are the owner.
Hard-delete is not allowed for any user-side client — when PROJ-13
and PROJ-19 ship destructive paths, they go through the privileged
server-side admin client.

**Indexes.** Two are added now to keep downstream features from
needing schema migrations: one on `(owner_id, soft_delete_at)`
(used by PROJ-13's trash list) and one on `(owner_id, updated_at)`
in descending order (used by PROJ-10's "My Calculators" dashboard
section to show "most-recently-edited first").

**Forward-compat columns deliberately NOT added in PROJ-8:**
`published`, `public_token` (PROJ-10), `source_calculator_id`
(PROJ-18). Adding them now would mean shipping unused columns with
security implications (token-bearing public URLs deserve their own
review).

### API surface — three routes, owner-only

```
POST   /api/calculators          → create empty calculator, return its id
GET    /api/calculators/:id      → read one calculator the user owns
PATCH  /api/calculators/:id      → update title / description / theme
```

All three are protected: an unsigned request gets `401`; a signed
request for a row that isn't yours, doesn't exist, or is
soft-deleted gets `404` (never `403` — we don't want to leak whether
the row exists). The PATCH route enforces:

- Title length / non-empty (mirrors the database check constraint as
  a friendlier `400` instead of a generic constraint violation).
- Whitelist on which fields can be written — `title`, `description`,
  `theme_id` only. Other keys in the body are silently ignored.
  Owner, id, timestamps, soft-delete column are never client-writable.
- **Optimistic concurrency.** The client echoes back the
  `updated_at` it last saw. The server rejects the write with `409`
  + the current `updated_at` if they don't match. On `200`, the
  response carries the freshly bumped `updated_at`, which the
  client uses for its next PATCH.

The PATCH route accepts `theme_id` values not in `getThemeIds()`
without rejection — per the PROJ-6 contract, unknown ids are
handled at read time by the registry's fallback. Rejecting at write
time would put two systems in the validation business and risk
divergence on future migrations.

### Editor page route (`/editor/<id>`) — server-side load

The page is a Server Component that:

1. Reads the signed-in user from the cookie-bound Supabase client
   (already established by PROJ-3 middleware).
2. Looks up the calculator row by id, scoped to `owner_id =
   auth.uid()` and `soft_delete_at IS NULL`.
3. Renders Next's 404 (PROJ-4's `not-found.tsx`) if the lookup
   returns nothing.
4. Otherwise, mounts the editor client tree with the row's
   `{ id, title, description, theme_id, updated_at }` passed in
   as initial state.

This collapses three AC scenarios (not yours, doesn't exist,
soft-deleted) into one server-side branch. The editor chrome never
flashes for unauthorized users — they see the 404 directly.

### Component structure — desktop editor

```
EditorPage (Server Component)
└── AppShell (PROJ-4 — receives rightExtras, editorTitle from below)
    └── EditorProvider (React Context — holds calculator state,
        │                 undo/redo stack, gridHeight, viewportMode)
        ├── TopBarDesktop (PROJ-4 — receives:)
        │     ├── rightExtras = <ThemePicker />
        │     └── editorTitle = live calculator title
        │                       with inline-rename input
        │
        └── EditorBody
            ├── FallbackThemeBanner (renders only when
            │                         isFallback === true)
            ├── GridPanel
            │   ├── GridHeader (chevron-collapse button,
            │   │              element-listing strip — empty in PROJ-8)
            │   └── GridBody (empty placeholder — no columns)
            │
            ├── ResizeHandle (drag to resize; arrow-key support;
            │                 ARIA separator role)
            │
            ├── BuilderToolbar
            │   ├── UndoButton + RedoButton
            │   ├── Separator
            │   ├── ViewportPicker (Desktop / Tablet / Mobile)
            │   ├── (flex spacer)
            │   └── AddPicker (Cell · Chart · Text · Section —
            │                  all four disabled in PROJ-8)
            │
            └── BuilderCanvas (constrained by viewportMode)
                ├── CalculatorHero (themed; title only, read-only)
                ├── SlotRenderer (renders [] in PROJ-8;
                │                  polymorphic dispatch ready for PROJ-9)
                └── EmptyBuilder (centred "Add cells to get started" card)
```

### Component structure — mobile editor

```
EditorPage
└── AppShell (mobile variant)
    └── EditorProvider
        ├── TopBarMobile (PROJ-4 — receives:)
        │     ├── mobileLeftSlot = (default wordmark — no Grid toggle
        │     │                     here, the spec puts the toggle in
        │     │                     the footer instead)
        │     └── mobileCenter   = truncated calculator title (read-only)
        │
        ├── MobileEditorToolbar
        │   ├── CompactThemePicker (swatch + "Theme" label)
        │   └── ViewportPicker (Desktop / Tablet / Mobile)
        │
        ├── FallbackThemeBanner (when applicable)
        │
        ├── BuilderCanvas (fills viewport; same component as desktop)
        │
        ├── FooterNav (sticky bottom)
        │   ├── UndoButton + RedoButton (left group)
        │   ├── (flex spacer)
        │   ├── GridDrawerToggle (centre — opens the bottom sheet)
        │   ├── (flex spacer)
        │   └── AddCellButton (right slot — replaces Preview, which is
        │                      hidden until PROJ-10; disabled in PROJ-8)
        │
        └── GridDrawer (shadcn Sheet, side='bottom'; opens to ~50%vh;
                        body = "No cells yet" placeholder)
```

### State management — one React Context, one reducer

A single `EditorContext` exposed via an `<EditorProvider>` that
mounts inside the page once the row has been loaded. The provider
holds:

- **Calculator state slice**: `{ id, title, description, theme_id,
  updated_at }` — kept in sync with the server via PATCH echoes.
- **Undo / redo stack**: `{ past, present, future }` — each entry is
  a small object with two callbacks (`do`, `undo`) and a human label
  (for accessibility / future "undo X" tooltips).
- **Layout slice**: `{ gridHeight, gridCollapsed, viewportMode,
  gridDrawerOpen }` — all session-scoped, none persisted.

Mutations dispatch through a reducer. Operations that enroll into
the undo stack (rename, theme-change) wrap the dispatch with a
`recordOperation()` helper that pushes the inverse onto the stack
and clears the redo stack. Keyboard handlers for Cmd-Z / Cmd-Shift-Z
attach at the document level and skip when an `<input>` /
`<textarea>` / `contenteditable` has focus (so the breadcrumb input
keeps native input-undo).

PROJ-9's cell mutations dispatch through the same reducer and use
the same `recordOperation()` helper — no second store, no migration.

### Persistence policy

- **Calculator data** → database (round-trips through PATCH).
- **Undo/redo stack** → in-memory only; cleared on page reload.
- **Grid panel height + collapsed flag + viewport mode + drawer
  open flag** → in-memory only; reset on remount.

The spec deliberately rules out localStorage for the resize height
in v1. If user feedback later asks for "remember my Grid height",
we add it as a one-line `localStorage.setItem` in the reducer — no
schema or API change.

### Theme picker — shared inner list, two surface wrappers

The picker's row content (swatch + display name + description +
checkmark on active) is one `<ThemePickerList>` component. The
wrapper differs by viewport:

- **Desktop**: shadcn `Popover` anchored to the toolbar trigger.
- **Mobile**: shadcn `Sheet` (`side='bottom'`).

The list iterates `getThemeIds()` in registry order. Selecting a
row dispatches a `setTheme` action (which PATCHes the server,
re-renders the Builder canvas with the new tokens within the same
React render pass, and enrolls a redo entry).

### Fallback-theme banner

Rendered when `getThemeIds()` doesn't contain the stored `theme_id`.
Uses the existing `EmptyOrErrorState` component in error / unframed
mode, sized as an inline banner above the Grid panel. Disappears
automatically when the user picks any valid theme (the derived
boolean flips false).

The visitor view (PROJ-11) deliberately omits this banner — visitors
don't pick themes — but the calculator's hero still renders with
the fallback theme so the public page works.

### Create-calculator click path (Hero + top-bar button)

Both the dashboard's Hero "Build a new calculator" button and the
top bar's "+ New calculator" button call the same client-side
helper. The helper:

1. POSTs to `/api/calculators` (empty body).
2. On success → `router.push('/editor/<new-id>')`.
3. On failure → shadcn toast "Couldn't create calculator — please
   try again."

The PROJ-5 dashboard's Hero is enabled by PROJ-8 (the PROJ-5 decision
log assigned this to PROJ-10; this design moves it to PROJ-8 since
the API endpoint lives here anyway). PROJ-5's spec gets an
implementation-note appendix recording the reassignment.

The top-bar button replaces the existing disabled+tooltip stub in
`top-bar-desktop.tsx` with a plain enabled button using the same
helper.

### Error / loading surfaces

- **Not-your-calculator / not-found / soft-deleted** → PROJ-4's
  `not-found.tsx` (404).
- **Network failure on PATCH** → shadcn toast (PROJ-20 replaces
  with proper banner).
- **409 stale-write on PATCH** → shadcn toast "Save failed — reload
  to retry." (PROJ-20 replaces with banner + reload button).
- **Network failure on POST `/api/calculators`** → shadcn toast.
- **Editor data not yet hydrated** → AppShell's existing loading
  skeleton (PROJ-4); theme picker, breadcrumb-rename, and undo
  buttons render only after hydration.

### Forward-compat seams (the things that matter for PROJ-9 / 10 / 11)

These are load-bearing — getting them wrong here means rewriting in
the next feature.

- **`SlotRenderer`** accepts a polymorphic array of
  `display_element` and dispatches per element-type. PROJ-8 passes
  `[]`. PROJ-9 fills it with cells / sections. PROJ-11 reuses the
  same component with the same array shape but a different loader.
- **`<CalculatorHero>`** subcomponent: PROJ-8 renders the title
  only, read-only. PROJ-9 adds description + hover-edit affordance
  to the same subcomponent.
- **`<AddPicker>`** accepts an option list. PROJ-9 flips two
  options' `disabled` flags; P1 flips two more. No re-architecture.
- **Title-commit callback** on the breadcrumb is a `(newTitle:
  string) => Promise<void>` callback; PROJ-9's Builder hero
  inline-rename reuses the same callback.
- **Undo / redo `recordOperation()`** helper is generic — PROJ-9's
  cell mutations enroll the same way, no special-casing of cell
  vs. title vs. theme operations.
- **Editor reducer slice shape** is additive — PROJ-9's cell slice
  is added alongside the calculator + layout slices.

### What PROJ-8 explicitly does NOT touch

Re-stated to keep the build small (the spec's Out-of-Scope is the
authority; this is the design-side echo):

- No cell rendering, no Grid columns, no section management.
- No Builder hero hover-edit, no description editing.
- No publish flag, no public-share token, no Preview button.
- No visitor view, no scenarios.
- No soft-delete UI, no trash list.
- No localStorage persistence of layout state.
- No drag-and-drop reordering.
- No real-time sync across tabs (409 on stale write is the model).

### Dependencies

**No new packages.** The build uses what's already installed:

- React 19 + Next.js 16 (existing)
- `@supabase/ssr` for cookie-bound auth (existing)
- shadcn primitives: `Popover`, `Tooltip`, `Button`, `Sheet`,
  `Input`, `Toaster` (all already in `src/components/ui/`)
- `sonner` for toasts (existing)
- `zod` for API request-body validation (existing)
- PROJ-6's `ThemeSwatch`, `getTheme`, `getThemeIds` (existing)
- PROJ-4's `EmptyOrErrorState`, `Icons`, `TopBarDesktop`,
  `TopBarMobile`, `AppShell`, `Wordmark` (existing)

The Zustand / `react-resizable-panels` / undo-library options were
all evaluated and ruled out — see the Technical Decisions table.

### Testing strategy

- **Unit**: reducer (push / undo / redo / clear-on-new-op),
  resize-handle clamping math, title-validation, theme-picker state
  machine, `buildBreadcrumbTabs` extension for editor-title
  overrides.
- **Integration**: API routes — POST happy path + auth, GET
  ownership + 404 opacity, PATCH happy path + 409 stale-write + 400
  validation + field-whitelist.
- **E2E (Playwright)**: sign in → create calculator from top bar →
  rename via breadcrumb → switch theme via picker → Cmd-Z twice →
  confirm both reverted → reload → confirm undo stack cleared.
- **RLS**: smoke test that user A can't read / update user B's row
  via the publishable-key client.

## Implementation Notes — Frontend

**Status:** Frontend (UI + client-side data layer + chrome integration)
complete. Backend (migration + `/api/calculators` routes) is the next
step — `/backend` will land that.

### What the frontend ships

- **Editor data layer**
  - `src/lib/calculators/types.ts` — `CalculatorRow` type, `validateTitle`,
    `MAX_TITLE_LENGTH`, `DEFAULT_TITLE`. Validation mirrors the eventual
    DB check constraint (`length(trim) BETWEEN 1 AND 100`).
  - `src/lib/calculators/client.ts` — `createCalculator()` and
    `patchCalculator()` helpers + `CalculatorApiError`. Both surfaces
    (Hero, top-bar "+ New") call `createCalculator`. The editor calls
    `patchCalculator` on rename and theme-change.
  - `src/lib/calculators/server.ts` — `getCalculatorForEditor(id)` (cookie-
    bound server client) collapses the not-yours / not-found /
    soft-deleted branches into a single null return.
  - `src/lib/editor/reducer.ts` — pure reducer with three slices
    (calculator / undo-redo / layout), exported clamping helper, and
    initial-state constructor. 25 unit tests cover push / undo / redo /
    clear-on-new-op / mark-stale / collapse-toggle / resize-clamp math.
  - `src/lib/editor/EditorProvider.tsx` — async wrapper that runs the
    PATCH, records the inverse operation, marks the editor stale on
    409, and attaches the document-level `Cmd-Z` / `Cmd-Shift-Z` / `Ctrl-Y`
    keyboard handlers (skipping native input-undo when an input or
    textarea has focus). Post-QA, `useEditor()` reads from a module-level
    singleton via `React.useSyncExternalStore` rather than a React Context
    (the spec's documented alternative) — this lets top-bar slot JSX that
    subscribes to editor state render outside the Provider's render-parent
    chain, which was the root cause of QA bug B4.

- **Editor UI components** under `src/components/editor/`
  - `editor-body.tsx` — registers top-bar slots (theme picker,
    breadcrumb title + commit, mobile centre) via the new slot registry,
    then renders the desktop two-panel split (Grid + ResizeHandle +
    BuilderToolbar + BuilderCanvas) and the mobile builder-first stack
    (compact toolbar + BuilderCanvas + MobileFooterNav). `ResizeObserver`
    tracks the container height so the resize-handle clamp stays accurate.
  - `grid-panel.tsx` — header strip with chevron-collapse + "0" count;
    body is an empty placeholder in PROJ-8.
  - `resize-handle.tsx` — hand-rolled Pointer Events handler with ARIA
    separator semantics, keyboard resize (↑ / ↓ in 24px steps), and
    clamping via `clampGridHeight`.
  - `builder-toolbar.tsx` — Undo · Redo · separator · ViewportPicker ·
    spacer · AddPicker. Preview / hidden-cells pill / code-import
    sparkles are intentionally absent.
  - `builder-canvas.tsx` — themed wrapper around `CalculatorHero`,
    `SlotRenderer` (empty array for now), and the centred
    `EmptyOrErrorState` empty state. Renders the fallback-theme banner
    when `getThemeIds()` doesn't contain the stored `theme_id`.
  - `calculator-hero.tsx` — read-only themed title; PROJ-9 will replace
    this with the hover-edit affordance + description block.
  - `slot-renderer.tsx` — polymorphic dispatch with a renderer registry;
    empty in PROJ-8 (load-bearing PROJ-9 / PROJ-11 forward-compat seam).
  - `add-picker.tsx` — registry-driven options list with per-option
    tooltipWhenDisabled; PROJ-8 exports the fixed
    `PROJ_8_OPTIONS` (all four disabled with their tooltips).
  - `theme-picker.tsx` — `ThemePickerDesktop` (shadcn Popover) +
    `ThemePickerMobile` (shadcn Sheet bottom-sheet), sharing one
    inner list. Active row gets a checkmark.
  - `viewport-picker.tsx` — three-way radio group + `viewportMaxWidth`
    helper that the Builder canvas applies to its `max-width`.
  - `undo-redo-buttons.tsx` — accessible buttons; disabled state
    follows `state.past.length === 0` / `state.future.length === 0` /
    `state.stale`.
  - `grid-drawer-toggle.tsx` + `mobile-footer-nav.tsx` — fixed-50% bottom
    sheet with an empty-state placeholder in PROJ-8.

- **Chrome integration**
  - `src/components/shell/top-bar-slots.tsx` (new) — small slot registry
    Context + `useRegisterTopBarSlots` hook. AppShell wraps everything
    in the provider; TopBarDesktop / TopBarMobile read merged slots from
    context (context overrides direct props). This lets the editor page
    inject its chrome without restructuring the layout.
  - `src/components/shell/top-bar-desktop.tsx` — `"+ New calculator"` is
    now an enabled `Button` wired to `createCalculator()`. Active
    breadcrumb segment gains inline-rename when `onEditorTitleCommit`
    is provided (focus + select on click, Enter / blur to commit, Esc
    to revert, `maxLength={100}`, brief invalid-shake on validation
    failure).
  - `src/components/shell/app-shell.tsx` — wraps content in
    `TopBarSlotsProvider`; main becomes `flex flex-1 flex-col` so the
    editor body can stretch to the viewport.

- **Dashboard**
  - `src/components/dashboard/new-calculator-hero.tsx` — Hero block
    rendered unconditionally on `/dashboard` (the PROJ-5 visibility
    deferral is retired). Same client-side helper as the top-bar
    button. PROJ-5's spec previously assigned this work to PROJ-10; it
    landed in PROJ-8 alongside the API path that powers it.

- **Global**
  - `src/app/layout.tsx` mounts `<Toaster richColors position="top-right" />`
    so the generic save-failed toast and "Couldn't create calculator"
    toast surface globally.

### Tests added

- `src/lib/editor/reducer.test.ts` — 19 cases over all three slices.
- `src/lib/calculators/types.test.ts` — 6 cases over `validateTitle`.
- `src/components/shell/top-bar.test.tsx` (existing) continues to pass
  with the breadcrumb tabs unchanged.

Test suite: 46 files, 441 tests passing.

### Deviations from the spec

- **No new feature-spec deviations.** The Technical-Decisions log line
  about `?next=` (vs the AC's typo `?redirect=`) was already documented
  by the architect; the redirect uses `?next=`.
- The implementation runs **without** the `calculators` table — the
  server loader and client helpers will surface 404 / 401 until
  `/backend` adds the migration + API routes. This is the documented
  PROJ-8 hand-off — see the workflow note at the bottom of this
  appendix.

### Forward-compat seams (re-validated post-implementation)

- `<SlotRenderer>` already accepts a polymorphic `DisplayElement[]`
  registry — PROJ-9 calls `registerDisplayElementRenderer('cell', …)`.
- `<CalculatorHero>` is a self-contained subcomponent — PROJ-9 swaps it
  with no upstream change required.
- `AddPicker` accepts an option list — PROJ-9 flips Cell + Section's
  `disabled: false` and passes `onSelect`. The shell never changes.
- `<BreadcrumbEditableSegment>` is parameterised on a commit callback,
  so PROJ-9's Builder-hero inline-rename can reuse the same callback.
- The undo helper (`recordOperation` inside `EditorProvider`) is
  type-agnostic — PROJ-9's cell mutations enroll via the same path.

### Open follow-up (handed to /backend)

1. Supabase CLI migration creating `calculators` (8 columns, indexes,
   `updated_at` trigger, RLS owner-scoped policies, no DELETE policy).
2. Three API routes — `POST /api/calculators`, `GET /api/calculators/:id`,
   `PATCH /api/calculators/:id`. Optimistic-concurrency via the
   `updated_at` echo on PATCH.
3. Regenerate `src/lib/supabase/types.ts` after the migration lands so
   the temporary `as any` cast in `getCalculatorForEditor` can drop.
4. RLS integration smoke test verifying user A can't read user B's
   rows via the publishable-key client.

## Implementation Notes — Backend

**Status:** Backend (migration + `/api/calculators` routes + test coverage)
complete. The editor route is now reachable end-to-end: the dashboard Hero
and top-bar "+ New calculator" button POST a row, the server loader reads
it under RLS, and the breadcrumb / theme picker PATCH it with optimistic
concurrency.

### What the backend ships

- **Migration** `supabase/migrations/20260523120000_calculators.sql`
  - Creates `public.calculators` with the exact 8-column shape from the AC
    (`id`, `owner_id`, `title`, `description`, `theme_id`, `created_at`,
    `updated_at`, `soft_delete_at`).
  - Adds two named CHECK constraints: `calculators_title_nonempty_check`
    (`length(trim(title)) > 0`) and `calculators_title_length_check`
    (`length(trim(title)) <= 100`).
  - Re-uses PROJ-1's `public.set_updated_at()` function via
    `trg_calculators_set_updated_at` — the trigger doubles as the
    optimistic-concurrency bump.
  - Adds the two indexes PROJ-13 / PROJ-10 will need now (no second
    migration later): `idx_calculators_owner_soft_delete` and
    `idx_calculators_owner_updated_at_desc`.
  - Enables RLS with owner-only `SELECT`, `INSERT`, and `UPDATE` policies;
    no `DELETE` policy (hard deletes go through the admin client in
    PROJ-13 / PROJ-19).
  - `GRANT SELECT, INSERT, UPDATE … TO authenticated` and
    `GRANT ALL … TO service_role` round out the access surface.

- **API routes** under `src/app/api/calculators/`
  - `route.ts` — `POST` creates a row bound to `auth.uid()`, returns
    `{ id, title, description, theme_id, updated_at }` with HTTP 201.
    401 on no user, 500 on insert failure.
  - `[id]/route.ts` — `GET` and `PATCH`.
    - `GET` returns the row when the user owns it and it's not
      soft-deleted; 404 otherwise (collapses three branches into one to
      preserve ID opacity); 401 on no user; 500 on read failure.
    - `PATCH` validates the body with Zod (strip mode so unknown keys —
      `owner_id`, `published`, `public_token`, `soft_delete_at`, `id`,
      `created_at`, `updated_at` in the SET slot — are silently dropped).
      Title is validated against `validateTitle` (`title_required` /
      `title_too_long` → 400). `theme_id` is accepted as any string per
      the PROJ-6 read-time fallback contract.
    - Optimistic concurrency is one round-trip on the happy path:
      `UPDATE … WHERE id = :id AND updated_at = :stale AND soft_delete_at
      IS NULL` with `RETURNING …`. A 0-row response triggers a
      disambiguating `SELECT` → 404 if the row is missing / not owned /
      soft-deleted, 409 with `server_updated_at` if it's just stale.

- **Type integration**
  - `src/lib/supabase/types.ts` now carries the generated `calculators`
    Row / Insert / Update shapes so the editor server loader and the
    route handlers are fully typed.
  - `src/lib/calculators/server.ts` drops the temporary `as any` cast
    introduced during the frontend pass.

### Tests added

- `src/app/api/calculators/route.test.ts` — 3 cases for POST (401,
  201 + owner-binding assertion, 500).
- `src/app/api/calculators/[id]/route.test.ts` — 15 cases for GET + PATCH
  covering auth, JSON parsing, title validation, happy-path update,
  stale-409 disambiguation, not-found, field whitelisting, theme_id
  acceptance, and the no-update edge case.
- `src/app/api/calculators/test-helpers.ts` — shared chainable Supabase
  mock builder that records the `.insert / .update / .eq / .is` shape
  and queues results per `.from()` call.

Full suite: 48 files, 459 tests passing. Lint clean (the 4 pre-existing
warnings in `src/lib/formula/**` are unchanged).

### Operational follow-up (for /deploy)

1. Run `supabase db push` to apply the new migration to the linked Cloud
   project.
2. Re-run `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
   after deploy to confirm the manually-added `calculators` block matches
   the generator output. (The shapes are 1:1 with PostgREST's default
   generator output, so the file should be unchanged.)
3. RLS smoke test (manual): from a second account, verify a `GET
   /api/calculators/<other-user-id>` returns 404 and a direct
   publishable-key SELECT returns zero rows.

### Deviations from the spec

- No spec deviations. The migration matches the AC's column list and
  constraint shapes exactly; the routes match the response codes and
  payload shapes listed in the AC.

## QA Test Results

### Re-QA pass (2026-05-23, post-fix)

After /frontend resolved B4 (Critical), B2 (Medium), B3 (Medium), and the
linked Cloud DB picked up B1's migration, all four QA bugs are now verified
green. Re-run results:

| Check | Result |
|---|---|
| Vitest (unit + integration) | **459 / 459 passing (48 files)** |
| ESLint | 0 errors; 4 pre-existing PROJ-7 warnings in `src/lib/formula/**` (unchanged) |
| `tsc --noEmit` | 0 PROJ-8 errors; 3 pre-existing PROJ-3 errors in `src/app/(auth)/auth/signup/actions.test.ts` (unchanged, predates PROJ-8) |
| Playwright chromium — full sweep | **30 / 30 passing** across PROJ-1 / PROJ-3 / PROJ-4 / PROJ-5 / PROJ-8 specs |
| `tests/PROJ-8-editor.spec.ts` (B4 fix) | **11 / 11 passing** (was 2 / 11 — the 9 editor-route renders that previously crashed with `useEditor must be used inside <EditorProvider>` now succeed) |
| `tests/PROJ-4-app-shell.spec.ts` (B2 fix) | **3 / 3 passing** — the rewritten `+ New calculator` test asserts the enabled button surface scoped to `role="banner"` so it no longer collides with the dashboard Hero |
| PROJ-8 spec ACs vs middleware (B3 fix) | Spec now describes HTTP 307 → `/auth/login?next=…` for signed-out browser requests at the three `/api/calculators` ACs (lines 261-263 POST, 291-297 GET, 317-323 PATCH). The route handlers' own 401-with-`{ error: 'unauthorized' }` branch is preserved and explicitly called out in each updated AC — the integration tests in `src/app/api/calculators/**/route.test.ts` continue to exercise it by bypassing middleware. |
| `calculators` table on linked Cloud project (B1 fix) | Migration `20260523120000` confirmed applied in the earlier QA pass; no schema drift. |

#### B4 fix — independent verification

The /frontend resolution swapped `useEditor()` from a React Context lookup to
a `React.useSyncExternalStore` subscription against a module-level singleton
(`src/lib/editor/EditorProvider.tsx:235-287`). The `<EditorProvider>`
component still constructs / tears down the store and owns the Cmd-Z /
Cmd-Shift-Z document handler, but it no longer needs to be a render-tree
ancestor of every consumer — so top-bar slot JSX (`<ThemePickerDesktop />`,
mobile centre label) registered via `useRegisterTopBarSlots` now resolves
correctly when rendered inside `<TopBarDesktop>` outside the Provider's
subtree. The StrictMode hazard noted in the resolution (`useEffect` cleanup
nulling `activeStore` before slot JSX re-renders) is handled by
re-registering the store in the effect setup body (lines 323-330) on top of
the synchronous render-phase registration (lines 313-315). Vitest + Playwright
both green confirms the fix holds under StrictMode's double-invocation.

The smaller B4 follow-up — a Playwright locator that newly collided with the
dashboard Hero's `Build a new calculator` after the Hero was enabled — was
fixed alongside B4 by anchoring `tests/PROJ-8-editor.spec.ts` to
`/^new calculator$/i` for the top-bar pill.

#### B2 fix — independent verification

`tests/PROJ-4-app-shell.spec.ts:166-184` now asserts the enabled-button
behaviour (`toBeVisible`, `toBeEnabled`, `not.toHaveAttribute('aria-disabled', 'true')`)
instead of the retired `toBeDisabled` + "Coming soon" tooltip. The locator
uses `page.getByRole('banner').getByRole('button', { name: /^new calculator$/i })`
to scope strictly to the top bar — the strict-mode 2-matches that caused
the original failure no longer occurs. Click → editor navigation is owned
by `tests/PROJ-8-editor.spec.ts:133` so the PROJ-4 spec stays focused on
chrome regressions.

#### B3 fix — independent verification

Spec-only patch verified by reading the three updated AC blocks: each now
opens with "Given a signed-out browser request, when … is invoked, then the
PROJ-3 middleware pre-empts the route and returns HTTP 307 with `location:
/auth/login?next=…`" and closes with "The route handler's own 401-with-
`{ error: 'unauthorized' }` branch remains in place for direct-invocation
paths." No code change required — the integration tests
(`src/app/api/calculators/route.test.ts`, `src/app/api/calculators/[id]/route.test.ts`)
already exercise the 401 branch directly, and the in-app contract now
matches `src/lib/auth/route-gate.ts:88-97`'s long-standing convention.

### Production-ready decision (re-QA)

**READY.** All four bugs (B1 / B2 / B3 / B4) resolved and independently
verified. Vitest 459 / 459, Playwright 30 / 30 chromium, lint clean for
PROJ-8 surfaces, typecheck clean for PROJ-8 surfaces. The implementation
matches the spec end-to-end; the slot-registry seam survives intact; PROJ-9
can attach cell mutations to the same module-level store with no further
re-architecture. Status flipped to **Approved**.

Next step: `/deploy`.

---

### Initial QA pass (2026-05-23, kept for audit trail)

**Tested on:** 2026-05-23
**QA owner:** /qa
**Branch:** main (uncommitted PROJ-8 working tree)

### Summary

| Metric                                  | Result |
|-----------------------------------------|--------|
| Vitest suite (unit + integration)       | 459 / 459 passing (48 files) |
| ESLint                                  | 0 errors, 4 pre-existing warnings in `src/lib/formula/**` (unchanged) |
| TypeScript (`tsc --noEmit`)             | 0 PROJ-8 errors; 3 pre-existing PROJ-3 errors in `src/app/(auth)/auth/signup/actions.test.ts` (unchanged) |
| Playwright regression (PROJ-4 / PROJ-5) | 4 / 5 passing — 1 failure is an obsolete PROJ-4 test asserting the retired "Coming soon" tooltip (see bug B2) |
| PROJ-8 E2E happy path (Playwright)      | **2 / 11 passing — 9 fail with a runtime crash on the editor route (see bug B4)** |
| Code audit vs. acceptance criteria      | Spec coverage confirmed in source; one documented alternative empty-state copy (Open Question #1); but live rendering is broken — see B4. |
| Security audit                          | No findings of concern — see Security section below |
| Production-ready                        | **NOT READY** (B4 is critical — every navigation to `/editor/<id>` throws a client-side runtime error and renders only the Next.js error overlay; B2 + B3 stay; B1 has been resolved after the migration was pushed.) |

### Acceptance-criteria coverage

Pass = code path verified against the spec; Blocked = code path is correct but cannot be exercised end-to-end because the `calculators` table is missing from the linked Cloud project (bug B1); Fail = behaviour deviates from spec.

| Section                                         | Status     | Notes |
|-------------------------------------------------|------------|-------|
| Database schema — `calculators` table           | Pass (code) / Blocked (live) | Migration matches the 8-column AC exactly; check constraints, indexes, and `set_updated_at` trigger present (`supabase/migrations/20260523120000_calculators.sql`). Cloud DB still on `20260522221232`. |
| RLS — owner-only SELECT / INSERT / UPDATE; no DELETE | Pass (code) / Blocked (live) | Migration enables RLS and writes owner-scoped policies; admin-client bypass remains for service_role only. RLS smoke test requires the migration. |
| `POST /api/calculators` (201 + owner-bound row) | Pass (code) / Blocked (live) | Route binds `owner_id = auth.uid()` server-side; body ignored; returns the public row shape. Integration test asserts owner-binding. |
| `POST /api/calculators` (401 signed-out)        | **Partial — B3** | Route returns 401 to direct callers; in-app, the PROJ-3 middleware preempts and returns HTTP 307 → `/auth/login?next=/api/calculators`. Pre-existing project convention; documented in the Decision Log only for `/editor/*` paths. |
| `GET /api/calculators/:id` (200 / 404 opacity)  | Pass (code) / Blocked (live) | 404 collapses not-yours / not-found / soft-deleted into one branch; integration tests assert each. |
| `GET /api/calculators/:id` (401 signed-out)     | **Partial — B3** | Same as above. |
| `PATCH /api/calculators/:id` (happy + 400 / 404 / 409 / field-whitelist / theme-id-any) | Pass (code) / Blocked (live) | Optimistic concurrency uses a single stale-checked UPDATE with a SELECT only to disambiguate 0-row responses. Whitelist via Zod `strip()` ignores `owner_id`, `published`, `public_token`, `soft_delete_at`, `id`, `created_at`, and SET-side `updated_at`. |
| `PATCH /api/calculators/:id` (401 signed-out)   | **Partial — B3** | Same as above. |
| Editor route — unauth visitor redirects to `?next=…` | **Pass (live)** | Confirmed end-to-end via `curl`: `GET /editor/<id>` → `HTTP 307 → /auth/login?next=%2Feditor%2F<id>`. The page also re-checks via `getCurrentProfile` as defence in depth. |
| Editor route — owner-only, 404 on cross-owner / soft-deleted / unknown id | Pass (code) / Blocked (live) | `getCalculatorForEditor` returns `null` for all three; page calls `notFound()`. Live verification needs B1 resolved (E2E test in `tests/PROJ-8-editor.spec.ts` exercises it). |
| Desktop two-panel layout (Grid · ResizeHandle · BuilderToolbar · BuilderCanvas) | Pass (code) | `src/components/editor/editor-body.tsx` arranges the panels in the correct order; ResizeObserver feeds the clamp. |
| Resize handle — drag + arrow-key + clamp + collapse | Pass (code) | Hand-rolled pointer events with ARIA separator semantics. `clampGridHeight` unit-tested for MIN floor + 60% ceiling + rounding. Collapse stashes `prevGridHeight` and restores on re-expand. |
| Desktop top bar — inline-rename breadcrumb (Enter / Esc / blur / `maxLength` 100 / shake on invalid) | Pass (code) | `BreadcrumbEditableSegment` focuses + selects on click, validates via `validateTitle`, re-focuses on validation failure, ARIA: `aria-current`, `aria-label`, `aria-invalid`. |
| Desktop top bar — calculator-theme picker (popover, 8 themes, checkmark, fallback handling) | Pass (code) | Two surface wrappers share one `ThemePickerList`. Desktop = `Popover`, mobile = `Sheet` bottom. `role="listbox"` + `aria-haspopup="listbox"`. |
| Desktop top bar — "+ New calculator" enabled and wired to `createCalculator()` | Pass (code) / Blocked (live) | Button surface retired the disabled+tooltip wrapper. POST happy path blocked by B1; failure path falls back to a Sonner toast. |
| Dashboard Hero — always visible, calls the same `createCalculator()` | Pass (code) / Blocked (live) | `src/components/dashboard/new-calculator-hero.tsx` is rendered unconditionally on `/dashboard`. Same blocker as above for the click flow. |
| Builder toolbar (Undo · Redo · Separator · ViewportPicker · spacer · AddPicker; no Preview / hidden-cells pill / sparkles) | Pass (code) | Exactly the spec layout. Toolbar role + label present. |
| Viewport picker — Desktop / Tablet / Mobile with correct max-widths | Pass (code) | `viewportMaxWidth` returns `100%` / `768px` / `390px`. Selection is session-scoped via the reducer. |
| "+ Add" picker — 4 options visible-but-disabled with per-option tooltips, no row writes on click | Pass (code) | `PROJ_8_OPTIONS` matches the spec's labels, subtitles, tooltips, and order. `disabled` flag is the single forward-compat flip. |
| Undo / Redo — title-rename + theme-change enrolled; `Cmd-Z` / `Cmd-Shift-Z` / `Ctrl-Y`; native input-undo precedence | Pass (code) | Reducer unit-tested (push / undo / redo / clear-on-new-op / MARK_STALE clears stacks). Document-level keyboard handler skips when the focused element is an `<input>` / `<textarea>` / contenteditable. |
| Builder canvas — themed hero (title only) + empty-state card + slot-renderer wired to `[]` | Pass (code) | One documented deviation (see "Spec Deviations" below): empty-state body copy uses the open-question alternative phrasing ("This calculator has no cells yet…") instead of the spec's "Cell authoring ships next." — implementer's choice on the spec's Open Question #1. |
| Fallback-theme banner — renders when `getThemeIds()` lacks the stored `theme_id`, hides on valid pick | Pass (code) | Derived boolean drives the banner; `EmptyOrErrorState variant="error" framed={false}`. |
| Mobile layout — top bar truncated name + compact toolbar + Builder + footer nav (undo/redo · grid toggle · "+ Add cell") | Pass (code) | Footer's right slot is the "+ Add cell" button (disabled with tooltip) per the spec's reassignment from Preview. Grid drawer = shadcn Sheet bottom at `h-[50vh]`. |
| Mobile theme picker — bottom sheet | Pass (code) | `ThemePickerMobile` wraps the same inner list in a `Sheet` (`side="bottom"`). |
| Reusable architecture seams (SlotRenderer · CalculatorHero · AddPicker · breadcrumb commit callback · `recordOperation`) | Pass (code) | All five seams are in place exactly as Decision Log entries described. No coupling that would block PROJ-9. |

### Bugs found

#### B4 — Editor route crashes at runtime: `useEditor must be used inside <EditorProvider>` — **Critical** **(RESOLVED)**

**Resolution (2026-05-23, /frontend):** The QA's suggested route-layout lift would not have worked — a new `editor/[id]/layout.tsx` still renders inside `(app)/layout.tsx`'s `<main>`, sibling-deep to `<TopBarDesktop>`, so `<EditorProvider>` would still be missing from the slot JSX's render-parent chain. The fix instead exercises the spec's documented alternative ("Zustand store ... implementer's choice; either works", `## Acceptance Criteria` → Reusable architecture seams): `src/lib/editor/EditorProvider.tsx` now backs `useEditor()` with a module-level singleton (`activeStore`) read via `React.useSyncExternalStore`. The Provider component still owns store construction, the document-level Cmd-Z / Cmd-Shift-Z handler, and store teardown — but it no longer needs to be a React ancestor of every `useEditor()` caller. Any consumer that mounts while a calculator is open reads the same store regardless of its render-tree position, so the top-bar slot JSX (`<ThemePickerDesktop />`, etc.) succeeds when rendered inside `<TopBarDesktop>`.

One non-obvious StrictMode hazard surfaced during the fix: an empty-body `useEffect` whose cleanup nulls `activeStore` survives the first mount but, on the dev-mode strict double-invocation, the cleanup runs before the slot JSX has a chance to render — leaving `activeStore` null. The fix mirrors `setActiveStore(store)` from the effect's setup body, so the strict-mode cleanup/setup cycle restores the registration before the slot-triggered re-render commits.

A separate locator ambiguity surfaced once B4 was fixed: `tests/PROJ-8-editor.spec.ts:142` searched for `/new calculator$/i` which now also matches the dashboard Hero's "Build a new calculator" button. The locator was anchored to `/^new calculator$/i` to match the top-bar pill exactly.

**Verification:** `tests/PROJ-8-editor.spec.ts` now passes 11/11 (was 2/11). Vitest stays at 459/459. The slot-registry seam survives unchanged — no new dependency, no layout restructure.

**Original report (preserved for audit trail):**


- **Severity:** Critical (every navigation to `/editor/<id>` after the data loads — including from the dashboard Hero, the top-bar "+ New calculator" button, and direct URL — throws a client-side React error and replaces the editor chrome with the Next.js dev "Application error" overlay. The page never recovers.)
- **Symptom:** Playwright snapshot of the failed editor render shows a Next.js Runtime Error dialog titled `useEditor must be used inside <EditorProvider>` with the source point at `src/lib/editor/EditorProvider.tsx:46`. Call stack: `useEditor` ← `ThemePickerDesktop` ← `EditorBody.useMemo[slots]` ← `EditorBody` ← `EditorPage`.
- **Root cause:** The slot-registry pattern (`src/components/shell/top-bar-slots.tsx`) stores JSX elements that were created inside `<EditorProvider>` and renders them at `TopBarDesktop`'s position — which is *outside* `<EditorProvider>` in the React tree.
  - `(app)/layout.tsx` mounts `<AppShell user>` → `<TopBarSlotsProvider>` → `<TopBarDesktop />` + `<main>{children}</main>`.
  - `(app)/editor/[id]/page.tsx` returns `<EditorProvider initialRow><EditorBody /></EditorProvider>` — *children* of `<main>`, so `<EditorProvider>` is a sibling of `<TopBarDesktop>`.
  - `EditorBody` registers `{ rightExtras: <ThemePickerDesktop />, mobileCenter: <span>…</span> }` into the slot context via `useRegisterTopBarSlots`.
  - `TopBarDesktop` reads `slots.rightExtras` and renders the element inside its own tree. React Context lookup walks the *parent* tree, not the *owner* tree — so `useEditor()` inside `<ThemePickerDesktop />` no longer finds the `<EditorProvider>` context (it sits below `<main>`, not above `<TopBarDesktop>`).
- **Repro:**
  1. Apply the migration (B1, now done) and start `npm run dev`.
  2. Sign in as any approved user, click the dashboard Hero "Build a new calculator" button. Or seed a `calculators` row via the admin client and navigate to `/editor/<id>`.
  3. The editor route renders briefly, the slot effect fires, the slot's `<ThemePickerDesktop />` mounts in the top bar, and `useEditor()` throws. The page shows the Next.js Runtime Error overlay.
- **Confirmation:** `tests/PROJ-8-editor.spec.ts` 9 / 11 tests fail with this dialog visible in the page snapshot under `test-results/PROJ-8-editor-PROJ-8-—-Edi-…-chromium/error-context.md` (one example: `…-8079b-row-and-lands-in-editor-id--chromium/error-context.md`). The 2 passing tests are the unauth-redirect test (no editor render needed) and the cross-owner 404 test (404 page, no editor render). No production happy path renders successfully.
- **Fix candidates:**
  1. Lift `<EditorProvider>` above `<AppShell>` (or above `<TopBarSlotsProvider>`) so its context is reachable from any descendant — but `<AppShell>` is mounted in `(app)/layout.tsx` and shouldn't be aware of the editor-specific slice. The cleanest variant is a route-level layout: `app/(app)/editor/[id]/layout.tsx` that wraps the existing `(app)` layout's `children` in `<EditorProvider>`, so the provider sits between `<TopBarSlotsProvider>` and `<main>` in the React tree.
  2. Replace the slot registry's JSX-handoff with a *bridge component* approach: register a stable component reference (e.g. `rightExtrasComponent: ThemePickerDesktop`) and let `TopBarDesktop` render it with a "subscribe-to-editor-state" hook that reads from a context provider mounted *above* `TopBarDesktop`. This requires lifting at least the read-side of editor state.
  3. Move editor state from React Context to a Zustand store with module-level singleton — `useEditor` would then no longer depend on a parent provider. Heavier-weight, but solves the seam permanently.
- **Implementation notes:** `src/lib/editor/EditorProvider.tsx` itself is fine; `src/components/editor/editor-body.tsx:43` registers the `<ThemePickerDesktop />` element via the slot registry; `src/components/shell/top-bar-desktop.tsx:153` renders `effectiveRightExtras` directly. The pattern at lines 41-54 of `editor-body.tsx` triggers the same crash for any slot whose JSX subscribes to `useEditor()` — `editorTitle` / `onEditorTitleCommit` happen to be primitives and survive, but they are the only safe slots in the current model.
- **Owner:** `/frontend`. The two viable fixes (#1 route-layout, #2 component-bridge) are both achievable without a re-architecture; #1 is the smallest change. The forward-compat seam called out in the spec's Decision Log (slot registry) survives — only the React-tree position of `<EditorProvider>` needs to move.

#### B1 — ~~Database migration not yet applied to the linked Supabase Cloud project — High~~ **(RESOLVED)**

- **Status:** Resolved during QA. User ran `npx supabase db push --linked` after my findings surfaced the blocker.
- **Verification:** `npx supabase migration list --linked` now shows `20260523120000` in both Local and Remote columns. `src/lib/supabase/types.ts` regenerated to a byte-identical block to the hand-added one — the backend skill's manual shape matched the generator output.
- **Reason for keeping the entry:** preserves the audit trail; the operational follow-up note in the Backend implementation section is now satisfied.

#### B2 — Obsolete PROJ-4 E2E test asserts the retired "Coming soon" tooltip — **Medium** **(RESOLVED)**

**Resolution (2026-05-23, /frontend):** `tests/PROJ-4-app-shell.spec.ts:166` rewritten — the test now asserts that the top-bar `+ New calculator` button is **visible**, **enabled**, and does not carry `aria-disabled="true"`. The locator is scoped to `page.getByRole('banner').getByRole('button', { name: /^new calculator$/i })` to avoid colliding with the dashboard Hero's "Build a new calculator" button (the strict-mode 2-matches root cause). The click → editor navigation is already covered by `tests/PROJ-8-editor.spec.ts`, so the rewritten PROJ-4 test stays focused on the chrome regression (button surface) rather than duplicating PROJ-8's happy-path E2E.

**Original report (preserved for audit trail):**

- **Severity:** Medium (failing test on `main` once PROJ-8 lands; CI noise rather than a UX defect).
- **Location:** `tests/PROJ-4-app-shell.spec.ts:166` — the test `disabled "+ New calculator" button shows the coming-soon tooltip`.
- **Repro:** `npx playwright test --project=chromium tests/PROJ-4-app-shell.spec.ts` → 1 failed (`toBeDisabled` strict-mode-resolved-to-2-elements after the Dashboard Hero added a second `New calculator` button).
- **Root cause:** PROJ-8 retires the disabled+tooltip wrapper per AC line 478-479 ("the `TooltipProvider` + `Tooltip` + `disabled` wrapper around it in `src/components/shell/top-bar-desktop.tsx` is retired by PROJ-8 — replaced with a plain enabled `Button` wired to the create handler"). The PROJ-4 test that documented the old surface should be deleted (or rewritten to assert the new enabled-button + click → editor navigation).
- **Owner:** `/frontend` for the cleanup; PROJ-8 should not ship with this regression in CI.

#### B3 — `/api/calculators` returns HTTP 307 (login redirect) instead of HTTP 401 on signed-out requests — **Medium** **(RESOLVED)**

**Resolution (2026-05-23, /frontend):** Spec-only patch — fix candidate #1 from the original report. The three affected ACs (POST signed-out at lines 261-263, GET signed-out at lines 285-287, plus a new PATCH signed-out AC added at the top of the PATCH section) now describe the actual in-app contract: PROJ-3 middleware pre-empts the route and returns HTTP 307 with `location: /auth/login?next=…`, matching the established project convention used by PROJ-3 / PROJ-5 / PROJ-7's private API routes. The route handlers' own 401-with-`{ error: 'unauthorized' }` branch is preserved (and explicitly called out in each updated AC) for direct-invocation paths — integration tests in `src/app/api/calculators/**/route.test.ts` keep working unchanged because they bypass middleware. No code change.

**Original report (preserved for audit trail):**

- **Severity:** Medium (spec AC literal violation; functional UX is acceptable because the client falls into a generic save-failed toast for unsignaled responses).
- **Location:** `src/lib/auth/route-gate.ts:88-97` declares every `/api/*` path (except `/api/cron/*`) as private; an unauth request is rewritten to `/auth/login?next=<path>` by `src/lib/supabase/middleware.ts`. The route handlers' explicit 401 branch is unreachable from a real signed-out browser fetch.
- **Repro:**
  - `curl -i -X POST http://localhost:3000/api/calculators -H 'content-type: application/json' -d '{}'` → `HTTP/1.1 307 Temporary Redirect`, `location: /auth/login?next=%2Fapi%2Fcalculators`.
  - Spec AC line 261-263 ("`POST /api/calculators`" → "HTTP 401 with `{ error: 'unauthorized' }`") and AC line 285-287 (GET 401) and PATCH (401) all assert 401.
- **Root cause:** Pre-existing PROJ-3 middleware convention — applies to all private `/api/*` paths. Was not flagged when PROJ-8's spec was written.
- **Fix candidates (pick one):**
  1. Spec edit: rewrite the 401 ACs to match the established middleware (the response is a 307 to the login form; this matches existing PROJ-3 / PROJ-5 / PROJ-7 routes).
  2. Code change: exclude `/api/calculators` from `route-gate.ts`'s private-API redirect list and let the route handlers' own 401 branches surface — but this would diverge from project convention.
- **Owner:** `/refine` to update the spec, or `/backend` if the middleware should be changed. The integration tests in `src/app/api/calculators/**/route.test.ts` assume direct-invocation behaviour and already prove the route returns 401 outside the middleware — so the route is correct in isolation, only the in-app contract differs.

### Security audit

- **Owner-binding on POST.** `route.ts` sets `owner_id` from `auth.getUser()`'s `user.id` server-side — never from the (ignored) request body. No way for a signed-in attacker to seed a row owned by someone else.
- **Field whitelist on PATCH.** Zod `.strip()` drops `owner_id`, `published`, `public_token`, `soft_delete_at`, `id`, `created_at`, and `updated_at` (in the SET slot). Verified by `src/app/api/calculators/[id]/route.test.ts` ("silently ignores unknown keys (owner_id, published, etc.) via the whitelist").
- **404 opacity.** GET / PATCH collapse not-yours / missing / soft-deleted into a single `not_found` response. No path leaks row existence across owners.
- **RLS.** Migration enables RLS on `calculators` with owner-only SELECT / INSERT / UPDATE; no DELETE policy. Hard-delete via the publishable-key client is rejected by Postgres; admin-client paths are scoped to PROJ-13 / PROJ-19.
- **Server-only admin client.** `createAdminClient` is not imported anywhere under PROJ-8 (grep-confirmed: no admin-client imports in `src/lib/calculators/**` or `src/app/api/calculators/**`). The `server-only` guard remains in place.
- **Title rendering.** All title surfaces (breadcrumb, `<CalculatorHero>`, Builder toolbar, dashboard Hero) render the value through React text nodes — auto-escaped, no `dangerouslySetInnerHTML`. No XSS via the title field.
- **Optimistic concurrency token.** `updated_at` is set by the database trigger on every UPDATE and echoed back; the client cannot fabricate a "fresh" value to bypass the stale check.
- **No new env vars.** No new secrets, no new `NEXT_PUBLIC_*` keys. The existing publishable + secret Supabase keys are reused.
- **Login redirect param.** Uses `?next=…` (URL-encoded), matching PROJ-3 middleware. Verified the encoded payload by `curl` on `/editor/<id>`.

### Spec deviations (intentional)

- **Empty-state body copy** for the Builder canvas reads "This calculator has no cells yet. Use the "Add" button in the Builder toolbar to add the first input." instead of the spec's "Cell authoring ships next." This matches the spec's Open Question #1 ("Replace with something visitor-facing like 'This calculator has no cells yet'") and is an implementer-resolved acceptable variant.

### Regression check

| Feature                         | Result |
|---------------------------------|--------|
| PROJ-1 — Supabase infra (cron-purge / smoke) | Not re-run (no schema-level change touched PROJ-1 surfaces). |
| PROJ-3 — Auth flow              | Vitest passes (no source changes outside `src/app/api/calculators/**` and shell additions). |
| PROJ-4 — App shell              | 3 / 4 E2E tests passing in chromium; 1 expected-fail noted in B2. |
| PROJ-5 — Account dashboard      | 2 / 2 E2E tests passing in chromium. Hero block adds a new surface; no PROJ-5 behavioural assertion broke. |
| PROJ-6 — Theme system           | Vitest passes; ThemeSwatch + getTheme + getThemeIds reused unchanged. |
| PROJ-7 — Formula engine         | Vitest passes; no consumer in PROJ-8. |

### Production-ready decision

**NOT READY.** Resolve B1 (apply migration), B2 (delete or rewrite the obsolete PROJ-4 tooltip test), and B3 (spec/middleware alignment) before `/deploy`. Once the migration is applied, re-run `tests/PROJ-8-editor.spec.ts` to verify the full happy-path (create → rename → theme switch → Cmd-Z → reload). The code itself is in good shape: well-tested, well-documented, and faithfully implements the architecture decisions in the spec.

### Suggested fix order

1. **B4 (Critical) first.** Lift `<EditorProvider>` so it sits above `<TopBarSlotsProvider>` in the React tree — the smallest change is a new `src/app/(app)/editor/[id]/layout.tsx` that wraps the editor's children in `<EditorProvider>`, plus moving the row fetch into that layout. The seam survives; the slot registry keeps working; every `<ThemePickerDesktop />` and `<MobileCenter>` render reaches `useEditor()` again. Re-run `tests/PROJ-8-editor.spec.ts` after the fix — the 9 currently-failing tests should turn green.
2. **B2 (Medium).** Delete or rewrite `tests/PROJ-4-app-shell.spec.ts:166` to match the enabled "+ New calculator" button behaviour. The dashboard Hero introduced a second `New calculator` button — the obsolete test fails on the strict-mode 2-matches resolution.
3. **B3 (Medium).** Decide on the spec/middleware mismatch — either edit the PROJ-8 spec ACs (lines 261-263, 285-287, the 401 PATCH AC) to "307 → /auth/login?next=…" or carve `/api/calculators` out of `route-gate.ts`. The integration tests pass either way because they call the route handlers directly.
4. Re-run `npm test && npx playwright test --project=chromium` to confirm the full suite is green. Then re-run `/qa PROJ-8` to flip the status to **Approved** before `/deploy`.

## Deployment
_To be added by /deploy_
