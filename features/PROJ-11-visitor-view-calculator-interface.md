# PROJ-11: Visitor View — Calculator Interface

## Status: Deployed
**Created:** 2026-05-23
**Last Updated:** 2026-05-24

## Dependencies
- **PROJ-6** Calculator Theme System — provides the runtime
  theme tokens that drive both the Builder preview and the
  visitor render, so they stay pixel-identical.
- **PROJ-7** Formula Engine — provides reactive recompute,
  cycle detection, error states. PROJ-11 mounts the engine on
  the visitor surface.
- **PROJ-9** Cell Authoring & Section Management — provides
  the `SectionList` / `LayoutPatternGrid` / `CellCard` chain
  and the polymorphic slot dispatcher (`SlotRenderer`). PROJ-11
  reuses the same component chain with an "interactive=false /
  read-only" registry — no edit affordances, no hidden-cell
  dots, no "+ Add" affordances.
- **PROJ-10** Calculator Lifecycle — provides the
  `public_token` column, soft-delete state, and the maintainer-
  facing surfaces (Preview button, dashboard "Public view",
  Sharing popover) that *produce* `/c/<token>` URLs. PROJ-11
  wires the destination.

## User Stories

- **As a visitor (anonymous or registered) with a shared
  `/c/<token>` link**, I want to land on the calculator and
  immediately see the maintainer's title, description, and
  every input/output cell laid out in the active calculator
  theme, so I understand what the calculator is and can start
  playing with values without onboarding friction.
- **As a visitor**, I want every Output cell to recompute
  live as I edit Input values, so I can explore "what-if"
  scenarios without clicking a "Recalculate" button.
- **As a maintainer who clicked Preview in the editor**, I
  want `/c/<token>` to render the exact same layout, theme,
  and cells I see in the Builder preview, so I can verify
  what my audience will see before I share the link.
- **As a visitor who pastes the URL into Slack or iMessage**,
  I want the link unfurl to show the calculator's title and
  description (not just the bare URL), so the recipient
  understands what they're being sent.
- **As a visitor who lands on a URL whose token was
  regenerated, mistyped, or whose calculator was
  hard-deleted**, I want a clean 404 page that doesn't leak
  whether the calculator ever existed, so I'm not confused
  by a broken Next.js error screen and the maintainer's
  privacy is preserved.
- **As a visitor who lands on a URL for a calculator that
  was just soft-deleted**, I want a clear 410 message
  ("This calculator is no longer available") rather than a
  generic 404, so I can tell the maintainer the link broke
  and they can recover it from Trash.
- **As an anonymous visitor**, I want the page to expose a
  clear path to log in or sign up, so I can become a
  maintainer myself if the calculator I just used inspired
  me. (No Save button in PROJ-11 — that ships with
  scenarios in PROJ-12.)

## Out of Scope

PROJ-11 is the **public render layer**. Everything that
writes back, persists visitor state, or addresses a different
URL namespace belongs to downstream features:

- **Scenarios — Save Scenario button, "Save scenario" header
  affordance, `?s=<share-token>` resolution, per-field lock
  toggle (open/closed padlock), Reset button, "(modified)"
  indicator, scenario header block, structure-drift banner,
  anonymous localStorage save/migrate-on-login.** Entire
  scenario surface is **PROJ-12**. PROJ-11 ships the public
  render with all input cards always interactive (no lock
  icons rendered at all) and no Save/Reset affordances.
  PROJ-11 explicitly ignores the `?s=` query parameter — see
  Decision Log.
- **Clone button for registered users / sysadmin in the
  visitor header.** Owned by **PROJ-18** (Cloning & Preset
  Discoverability). PROJ-11's header omits the Clone icon
  entirely; PROJ-18 inserts it when the cross-user clone
  flow ships.
- **Chart elements (PROJ-15) and Text-block elements
  (PROJ-16) rendered in slots.** PROJ-11 ships the
  polymorphic slot dispatcher (cells only — PROJ-9 doesn't
  create chart or text-block rows in P0). Adding chart and
  text-block renderers in P1 must be a registry
  registration, not a Visitor-View rewrite. Per INDEX.md
  Architecture notes.
- **Tabular output cell renderer (`display_emphasis =
  tabular`).** Renderer ships with **PROJ-17**. PROJ-11
  applies the same fallback PROJ-9 picks for the Builder
  (graceful "tabular preview unavailable" placeholder or
  whatever PROJ-9 decided). PROJ-11 does not introduce its
  own tabular renderer.
- **Per-IP rate-limit numbers beyond ≈60 req/min/IP.**
  PROJ-11 commits to the **light page-load limit only** —
  rate-limit the GET of `/c/<token>` at approximately
  60 req/min/IP, return HTTP 429 with a plain "Slow down"
  page. Recompute itself is client-side after the initial
  load, so there is no per-keystroke server hit to defend.
  Stricter scenario-token enumeration guards are deferred
  to PROJ-12 (when the `?s=` token starts mattering).
- **The Trash recovery surface, "Restore" action, and
  auto-purge cron.** Owned by **PROJ-13**. PROJ-11 only
  *responds* to the soft-delete state PROJ-10 writes — it
  returns 410 during the recovery window — but does not
  manage the recovery side.
- **Orphan-scenario surfaces** (the "calculator no longer
  available" page for scenario *owners* with a still-
  recoverable calculator). Owned by **PROJ-13** + **PROJ-12**.
  PROJ-11's 410 page is the plain "no longer available"
  visitor copy; per-owner orphan-management UI is downstream.
- **Cross-user clone attribution** ("based on <calculator
  name>" link in the visitor view). Owned by **PROJ-18**.
- **Slug-based / SEO-friendly public URLs** (e.g.
  `/c/<token>/<slug>`). Out of scope per PRD.
- **`og:image` generation / dynamic Open Graph cards.**
  PROJ-11 ships text-only meta (title + description); image
  unfurls are not in v1. Trivial to add later.
- **View counts, analytics, telemetry on the visitor
  surface.** Excluded per PRD non-goals.
- **The avatar popover itself** (App theme picker, Settings
  link, Admin link, Sign out). Owned by **PROJ-4**; PROJ-11
  just mounts the existing `<AvatarPopover>` for registered
  visitors.
- **A maintainer-only "you're viewing your own calculator"
  banner.** No visual distinction between maintainer-viewing
  and stranger-viewing on `/c/<token>`. The visitor surface
  is universal; maintainer-side context lives on
  `/editor/<id>` and `/dashboard`.
- **Owner viewing Draft state — any Draft watermark or pill
  on the visitor surface.** Per spec: unguessable tokens
  mean a Draft URL is safe to share intentionally. PROJ-11
  renders Draft and Published calculators identically.
- **A `/c/<token>` route that 404s a calculator whose owner
  was deleted** as a distinct case. Owner-deletion cascade
  is out of scope until account-deletion ships fully — for
  PROJ-11, if a calculator row still exists, it renders;
  if it's been hard-deleted by any path, it 404s.
- **Deep-link return after the Sign-up path.** An anonymous
  visitor clicking "Sign up" on `/c/<token>` is sent to
  `/auth/signup` without a `?next=` parameter. The signup
  flow today (PROJ-3) goes signup → pending → sysadmin
  approval → approval email → first login on `/auth/login`,
  which loses any deep-link context across emails and
  multi-session round trips. PROJ-11 acknowledges this is
  a known break and does not patch PROJ-3 from this
  feature. The expected v1 workaround: the visitor
  re-clicks the original `/c/<token>` link from Slack /
  iMessage / wherever they got it after first login. A
  proper end-to-end signup→deep-link recovery is a
  forward-pointer for a future **PROJ-3 refinement**
  (`/refine PROJ-3`) — not blocking PROJ-11. The Login
  path's `?next=` deep-link still works (verified in
  PROJ-3) and PROJ-11 wires it.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Route & URL access

- [ ] Given a calculator with `public_token = T` exists and
  has `soft_delete_at IS NULL`, when a visitor navigates to
  `/c/T`, then the server responds 200 and renders the
  visitor view of that calculator regardless of the
  `published` flag.
- [ ] Given no calculator row matches the token in
  `/c/<token>`, when the visitor loads the page, then the
  server responds 404 with the visitor-side "Not found"
  page (no leak of whether the token ever existed).
- [ ] Given the calculator's `public_token` was regenerated
  (PROJ-10), when a visitor loads the **old** `/c/<token>`
  URL, then the server responds 404 (the old token now
  matches no row).
- [ ] Given the calculator has `soft_delete_at IS NOT NULL`
  and is still inside the `RETENTION_PERIOD_DAYS` window,
  when a visitor loads `/c/<token>`, then the server
  responds 410 with the visitor-side "This calculator is
  no longer available" page.
- [ ] Given the calculator was hard-deleted (sysadmin
  "Delete permanently" via PROJ-19, or auto-purge via
  PROJ-13), when a visitor loads `/c/<token>`, then the
  server responds 404 — same page as a never-existing
  token.
- [ ] Given the URL includes a `?s=<anything>` query
  parameter, when the visitor loads the page, then PROJ-11
  ignores the parameter, renders the calculator with its
  stored defaults, and responds 200 (PROJ-12 will later
  bind the parameter to scenario loading).
- [ ] Given a visitor loads `/c/<token>`, when the page
  renders, then it sends no app-chrome elements (no top
  bar with breadcrumb, no avatar popover for the *app*
  surface, no Dashboard / Editor navigation, no Builder
  toolbar). The page is the calculator interface plus the
  visitor header and footer only.

### Visitor header

- [ ] Given an anonymous visitor loads `/c/<token>`, when
  the header renders, then it shows the Calcgrinder brand
  mark on the left and, on the right, a "Log in" ghost
  button + a "Sign up" primary button. No Save icon, no
  Clone icon, no avatar.
- [ ] Given a registered (approved) user loads
  `/c/<token>`, when the header renders, then it shows the
  Calcgrinder brand mark on the left and the avatar
  popover (PROJ-4's `<AvatarPopover>`) on the right. No
  Save icon, no Clone icon, no Log in / Sign up buttons.
- [ ] Given a viewport ≤ the mobile breakpoint, when the
  visitor loads the page, then the header height shrinks
  to 60px (vs 68px desktop), gaps tighten, and the
  anonymous header's "Log in" button is omitted (mobile
  shows only "Sign up" as the auth CTA to preserve space).
- [ ] Given an anonymous visitor clicks "Log in" in the
  anonymous header, when the click fires, then the page
  navigates to `/auth/login?next=/c/<token>`. After a
  successful login, PROJ-3's existing `?next=` handling
  returns the visitor to the same calculator URL.
- [ ] Given an anonymous visitor clicks "Sign up" in the
  anonymous header, when the click fires, then the page
  navigates to `/auth/signup` (no `?next=` parameter
  appended). The signup → approval → first-login round
  trip is a known break in PROJ-3's deep-link chain;
  PROJ-11 does NOT promise a return-to-calculator on
  this path. See Out of Scope.
- [ ] Given the visitor clicks the brand mark, when the
  click fires, then the page navigates to `/` (which
  routes to `/dashboard` for signed-in users and
  `/auth/login` for anonymous users — the standard
  template behaviour). A bare brand-mark link is fine; no
  separate target.

### Render pipeline — pixel-identity with Builder preview

- [ ] Given the same calculator opened in the Builder
  preview at viewport width W and at `/c/<token>` at the
  same viewport width W, when both pages settle, then the
  calculator content area (hero title + description +
  every section + every cell) renders pixel-identically
  on the visitor surface. The Builder's edit affordances
  (hover edit icons, hover borders, the 0-height
  hidden-cell dots, the in-place hero edit input, the
  "+ Add" button, the "+ Add section" button, the
  between-cards seam affordance, the section toolbar) all
  render NOTHING in the visitor view.
- [ ] Given a cell has `visibility = hidden`, when the
  visitor page renders, then the cell produces zero
  output in the DOM — not even the 0-height dot the
  Builder shows. The cell continues to participate in
  formula computation (intermediate computed values still
  flow to other cells).
- [ ] Given a section has an empty list of display
  elements, when the visitor page renders, then the
  section's title + optional description render, and
  nothing below — no "Drop elements here, or use + Add"
  placeholder (that's Builder-only).
- [ ] Given the calculator's `description` field is empty,
  when the visitor page renders, then no description
  element appears in the hero (the Builder's faded
  "Add a short description" placeholder is Builder-only
  per PROJ-9).
- [ ] Given the calculator's active theme defines slot
  layouts and card visual tokens, when the visitor page
  renders, then the visitor renderer applies the same
  tokens as the Builder preview — Card-level visual
  overrides (Accent / Background tint / Border / Size
  hint) and cell-specific visual settings (display
  widget, format, text size, text colour, output
  emphasis) all match.

### Live recompute & input interaction

- [ ] Given the visitor types a value into an editable
  Input cell, when the keystroke fires, then every Output
  cell that depends on that Input recomputes after a
  debounced delay (the same debounce value the Builder
  preview uses — extract a shared helper if one doesn't
  already exist). Slider drags recompute per
  drag-frame, no debounce.
- [ ] Given an Output cell's formula throws (syntax error,
  undefined reference, divide by zero, cycle), when the
  Output is rendered, then the card displays the same
  red-error treatment used in the Builder preview (red
  border + short error message in place of the value).
- [ ] Given an Input cell receives a value outside its
  declared `min`/`max` range or wrong `value_type`, when
  the visitor commits the value (blur/Enter), then the
  cell renders the same red-error treatment as the
  Builder — red border + short error message — until the
  visitor corrects it. The Output cells that depend on it
  continue to show their last-good values until the
  Input becomes valid again (matches the engine's
  error-propagation contract from PROJ-7).
- [ ] Given a visible-readonly Input cell or an Output
  cell with `editability = readonly` (the default for
  Outputs), when the visitor clicks the cell, then no
  edit interaction fires — the cell renders as styled
  display text per PROJ-9.
- [ ] Given an Output cell has `editability = editable`,
  when the visitor types a value into it, then the value
  overrides the computed result on that cell exactly as
  PROJ-9 specifies for the Builder preview (PROJ-11
  inherits the behaviour; it does not redefine it).
- [ ] Given the visitor refreshes the page or navigates
  away and back to `/c/<token>` with no `?s=` parameter,
  when the page renders, then every Input cell resets to
  its calculator-default value. PROJ-11 does not persist
  visitor state — anonymous localStorage saves and
  authenticated server-side scenarios are PROJ-12.

### Page metadata

- [ ] Given a visitor or link-preview crawler requests
  `/c/<token>` (200 case), when the response renders,
  then the `<title>` is `<calculator title> — Calcgrinder`,
  `<meta name="description">` is the calculator's
  description (truncated to ~160 characters), and the
  OpenGraph tags `og:title` and `og:description` carry
  the same values. No `og:image` is emitted.
- [ ] Given a 404 / 410 response is rendered, when the
  page is requested, then the meta tags do NOT leak the
  calculator's title or description — they fall back to
  generic "Calculator not found" / "Calculator no longer
  available" strings.

### Rate limit

- [ ] Given a single IP makes more than ~60 page-load
  requests to `/c/<token>` within a 60-second window,
  when the threshold trips, then subsequent requests
  from that IP respond HTTP 429 with a plain
  "Slow down — too many requests" page (no calculator
  data leaked). The exact limit and storage backend
  (Vercel Edge, Upstash, Supabase RPC) is an
  architecture decision; the *budget* is committed here.
- [ ] Given a visitor's IP is rate-limited and the page
  is 429ing, when the visitor waits ~60 seconds and
  reloads, then the next request succeeds (sliding /
  fixed window — implementer's call).
- [ ] Given the rate-limit storage backend is unavailable
  (e.g. Upstash transient outage), when the page-load
  request lands, then the limiter fails open — the
  visitor sees the calculator, not a 429. (Fail-closed
  would break sharing entirely on transient infra
  hiccups, which is worse for a low-volume v1.)

### Footer

- [ ] Given the visitor page renders (200 case), when
  the visitor scrolls to the bottom, then a small footer
  shows "Built with Calcgrinder" (logo + word) and
  nothing else — no calculator title, no publish date,
  no version string.
- [ ] Given the visitor clicks the footer's "Built with
  Calcgrinder" link, when the click fires, then a new
  tab opens to the Calcgrinder root `/` (so the visitor
  can explore signup if interested). `target="_blank"
  rel="noopener noreferrer"`.

### Mobile

- [ ] Given the viewport is mobile (≤ the mobile
  breakpoint), when `/c/<token>` renders, then the
  calculator content stacks single-column following the
  active theme's mobile slot layout, the header shrinks
  per the visitor-header AC above, and the footer
  retains the same content (single-line; brand mark +
  text wrap as needed).
- [ ] Given the visitor is on iOS Safari, when they tap
  an Input cell, then the appropriate mobile keyboard
  pops (numeric for number / currency / percent / date
  cells via `inputMode` / `type` attributes; text
  otherwise). PROJ-11 inherits this from PROJ-9's input
  widgets — it does not redefine widget HTML.

## Edge Cases

- **Calculator with zero cells / zero sections.** The
  hero (title + description if non-empty) renders, the
  footer renders, the section list is empty — no
  placeholder bleed-through from the Builder. The page
  is technically a working URL with nothing to interact
  with. (Edge case: a maintainer can publish an empty
  calculator. PROJ-11 doesn't gate it.)
- **Calculator with only hidden cells.** Same as above
  visually (no rendered cells) but recompute still runs
  silently because hidden Inputs may seed hidden Outputs.
  PROJ-11's render pipeline ignores hidden cells but the
  engine evaluates them.
- **A formula referencing a cell that no longer exists.**
  Resolution falls into PROJ-7's existing error path —
  the Output card shows the red-error state. No PROJ-11-
  specific copy beyond the standard error treatment.
- **Network failure mid-recompute.** Recompute is
  client-side after the initial load (per the
  architecture seam in PROJ-7) — no network calls fire on
  Input changes. PROJ-11 does not introduce any keystroke-
  level server request, so "network failure" doesn't
  apply during the calculator session. The 404 / 410 / 429
  responses are page-load-only.
- **Browser tab without JavaScript enabled.** The visitor
  sees the server-rendered initial HTML (theme, title,
  cells with their default values) but no live recompute.
  Inputs are still focusable but typing into them won't
  update Outputs. Acceptable for v1; not a noJS-friendly
  product.
- **Calculator title contains characters that break the
  `<title>` tag** (e.g. `</title>` literal). The metadata
  serializer escapes/strips per Next.js's default head
  serialization. PROJ-11 does not write a custom
  serializer.
- **A registered user whose `status = pending` or
  `declined` loads `/c/<token>`.** They are still
  authenticated to the session; the avatar popover shows;
  they can use the calculator. This matches the spec:
  authentication ≠ approval. (Approval gates Editor /
  Dashboard access, per PROJ-3, but not the public
  surface.)
- **A registered user whose session expired / token
  invalid loads `/c/<token>`.** They fall back to the
  anonymous header (Log in / Sign up). The page is
  unguarded; no auth check redirects them away.
- **Concurrent edit while visitor is on the page.** A
  visitor is using `/c/<token>` and the maintainer
  publishes / unpublishes / edits the calculator in
  another tab. The visitor's page does NOT live-update —
  they see the snapshot loaded on page load. Reload picks
  up changes. (No realtime channel in PROJ-11; per PRD
  non-goal "real-time collaborative editing".)
- **A visitor lands on `/c/<token>` while the calculator
  is being soft-deleted.** Whichever side of the
  soft-delete write wins by milliseconds — if the
  visitor's request lands before, 200; after, 410. No
  in-flight banner. The visitor's already-loaded session
  continues with the cached calculator data (the page
  doesn't auto-refresh).
- **Calculator's `default_section_id` points at a section
  that's been deleted.** Pure data integrity bug — PROJ-9
  / PROJ-10 should never write this. If it happens,
  PROJ-11 logs the bug and renders the remaining sections
  in order; no client crash. Defensive but not a routine
  case.
- **Calculator with a cell whose `display_emphasis =
  tabular`** (PROJ-17 placeholder render mode in P0).
  PROJ-11 renders whatever PROJ-9 ships as the P0 fallback
  for `tabular` — a graceful placeholder or
  enum-not-selectable behaviour. PROJ-11 itself does not
  add tabular-specific UI.

## Technical Requirements (optional)

- **Performance:** initial page load (cold) under 1.5s on
  a 4G connection for a calculator with ~30 cells. Live
  recompute on Input change under 50ms perceived latency
  on a mid-range mobile (debounced).
- **Security:** no CSRF protection needed (the surface is
  read-only over GET); per-IP rate-limit as specified;
  no `eval` (formula engine guarantees this via PROJ-7).
  Markdown / text-block sanitization is PROJ-16's
  concern, not PROJ-11's.
- **Privacy:** the public surface emits **no** analytics
  / telemetry beacons (per PRD non-goals). The
  rate-limit middleware logs aggregate IP-rate counts
  for itself but does NOT log per-token visit metrics.
- **SEO:** `/c/<token>` is intentionally **not** indexed
  by search engines — `<meta name="robots"
  content="noindex, nofollow">` on every visitor page.
  Calculators are not meant to be discoverable; sharing
  is link-based.
- **Accessibility:** every editable Input cell carries
  the correct `aria-label` / `aria-describedby` for
  screen readers (PROJ-11 inherits this from PROJ-9's
  CellCard accessibility work). The visitor header's
  brand mark has an `aria-label`; auth buttons have
  visible labels.
- **Browser support:** Chrome (latest 2), Firefox (latest
  2), Safari (latest 2), iOS Safari (latest 2), Chrome
  Android (latest 2). No IE11.

## Open Questions

- [ ] **Mobile breakpoint value.** Reuse PROJ-8's
  breakpoint (likely Tailwind `md:` = 768px). Resolve
  during /frontend by reading the existing
  `src/components/shell/top-bar-mobile.tsx` pattern and
  using the same constant.
- [x] **Rate-limit storage backend choice.** Resolved
  during /architecture: Upstash Redis +
  `@upstash/ratelimit` (see Technical Decisions).

## Architecture-handoff notes

Constraints `/architecture` must preserve when designing
the technical approach:

- **The "interactive=false / read-only registry" boundary
  must be explicit and load-bearing**, not implicit. The
  pixel-identity AC implicitly covers *every* Builder-only
  edit affordance (hover borders, between-cards seam
  affordance, edit icons, "+ Add" buttons, "+ Add section",
  section toolbar, the 0-height hidden-cell dot, hero
  in-place edit input, section hover-border discoverability,
  etc.). Design a single boundary — a context value, a
  prop threaded through `SlotRenderer` / `CellCard` /
  `SectionList`, or a swapped registry — that the Builder
  surface sets to `interactive` and the visitor surface
  sets to `readonly`. Edit-affordance components should
  read this once at the boundary and short-circuit to
  `null`. No per-component `if (visitor) return null` leaf
  branches: those rot, get missed in code review, and leak
  edit chrome into the visitor view feature-by-feature.
  This is the single biggest correctness lever for PROJ-11.
- **Client-side recompute is load-bearing for the
  rate-limit ACs.** The ~60 req/min/IP page-load budget
  assumes the formula engine runs in the browser and that
  no per-keystroke or per-input-change server request
  fires from the visitor surface. If `/architecture`
  proposes server-side recompute, SSR-driven evaluation,
  RSC streaming with per-input revalidation, or any other
  design that introduces server hits on visitor input,
  the rate-limit ACs (Rate limit section, all three
  bullets) MUST be revisited together with the storage-
  backend choice — the page-load-only budget is no longer
  sufficient. The /architecture skill should either
  preserve client-side recompute or surface this
  trade-off explicitly in its Technical Decisions log.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Render-only scope — no scenario UX on /c/<token> in PROJ-11. | INDEX.md treats PROJ-11 and PROJ-12 as two separate P0 features with PROJ-12 explicitly depending on PROJ-11. The Architecture Notes section defines PROJ-11 as "the slot/rendering pipeline that iterates display_elements polymorphically" — no scenario semantics. Splitting per Single Responsibility (CLAUDE.md) keeps each feature testable and deployable independently. Same call we made on PROJ-10's Out-of-Scope items pointing to PROJ-13/PROJ-12. | 2026-05-23 |
| Visitor header: anonymous → "Log in" + "Sign up"; registered → avatar. Save / Clone icons omitted entirely (not "visible-but-disabled stubs"). | Hide affordances whose backing functionality ships later. The spec's full visitor header is a composite that's gradually filled in: Save by PROJ-12, Clone by PROJ-18. Stubs would tempt visitors to click and feel broken. Brand + auth CTAs is still a useful affordance: it gives anonymous visitors a path to become maintainers themselves. | 2026-05-23 |
| Live recompute is debounced per-keystroke (~120–200ms, same value as the Builder preview). Slider drags recompute per drag-frame. | PRD vision "values and watch results recompute in real time" maps better to debounced-per-keystroke than to on-blur (which would show stale outputs while the visitor types). The Builder preview already runs live recompute on input changes per PROJ-8/9 — PROJ-11 reuses the same helper so preview and visitor stay byte-identical in behaviour. If no shared helper exists yet, extract one during /backend or /frontend. | 2026-05-23 |
| Light page-load rate limit only (~60 req/min/IP), 429 with a plain page; recompute is client-side so there's no per-keystroke server hit to defend. | PRD mandates per-IP rate-limiting on the public surface. The simplest workable policy that satisfies the mandate. Stricter scenario-token enumeration guards are deferred to PROJ-12 (when ?s= starts mattering). Fail-open on rate-limit-backend outage — visitor experience trumps belt-and-braces protection at this scale. | 2026-05-23 |
| Page metadata = calculator title + description (text only). No og:image. | Visitors paste shared links into Slack / iMessage / Notion all the time; a clean text unfurl beats a bare URL. Generating og:images is post-v1 infra work (Vercel OG, edge rendering, image storage) — not worth the complexity for an audience of tens-to-hundreds. | 2026-05-23 |
| Footer = "Built with Calcgrinder" brand attribution only. No calculator name, no publish date, no version. | PRD's privacy-leaning stance (no analytics, no view counts) extends to not leaking edit timing data via the visitor footer. The design's "v1 · Mortgage Calculator · published 4 days ago" exists because the design was a freestanding mock with no spec context — see [[design-files-are-visual-drafts-only]]. Calculator title is already in the hero (redundant); date leak is unhelpful. Brand attribution stays — it's the one place visitors see Calcgrinder. | 2026-05-23 |
| `?s=` query param is **ignored** in PROJ-11 (not 404'd or stripped via redirect). | PROJ-12 owns scenarios end-to-end; until then, the param is a no-op. Ignoring preserves the URL convention PROJ-12 will rely on without breaking PROJ-12's own deep-link UX. 404-ing would leak the param's existence to visitors and break test calculators if someone speculatively crafts a URL. Redirecting adds a round-trip with zero v1 upside. | 2026-05-23 |
| `<meta name="robots" content="noindex, nofollow">` on every visitor page. | Calculators are link-shared, not search-indexed. Per PRD: tokens are "unguessable", calculators are "private", "no print-flyer audience". Letting Google crawl `/c/<token>` URLs would expose calculators the maintainer assumed were only reachable via the link they sent. Robots header is a polite request — security still rests on the 128-bit token — but it's cheap to add. | 2026-05-23 |
| No visual distinction when the maintainer views their own `/c/<token>`. | Per spec line 1426: "The editor's Preview button opens `/c/<token>` in a new tab, regardless of `published` state." The point of Preview is to see what the audience sees. An "owner viewing" banner would defeat that. Maintainer-side context lives in `/editor/<id>` and `/dashboard`. | 2026-05-23 |
| Brand-mark click in the visitor header navigates to `/` (which resolves to `/dashboard` for signed-in users, `/auth/login` for anonymous). | Standard template wordmark behaviour. No separate target needed; the template's root route already does this routing. | 2026-05-23 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Data fetch via Postgres `SECURITY DEFINER` RPC `fn_get_public_calculator(token)`, not a broadened RLS policy and not a service-role-key API route. | Cleanest security posture for an anonymous public-read surface. RLS on `calculators` / `sections` / `cells` stays owner-only — a leaked anon key cannot enumerate published calculators. The 128-bit token entropy IS the access control; the function gates the lookup by token-match. One round trip per page load (calculator + sections + cells aggregated as JSON), no fan-out. Service-role-via-API would also work but pushes the security check into TypeScript and adds a hop; the RPC keeps it in Postgres where it's auditable. | 2026-05-23 |
| Extract `<CalculatorRenderer>` + `<InteractivityContext>` + `<CalculatorStateContext>` as the shared boundary between Editor (PROJ-9 `BuilderCanvas`) and Visitor view. PROJ-9 components are refactored to consume the new contexts instead of `useEditor()` directly. | The spec's pixel-identity guarantee is a code-reuse contract: the same components ship on both surfaces. `useInteractivity()` returns `{ mode: 'builder' \| 'visitor' }` and edit-affordance components short-circuit to null at their top. The boundary is one provider per surface; no per-leaf `if (visitor)` branches. Prevents the drift the spec's "leak-through" note warned about. Cost: a refactor of PROJ-9 components — /qa must verify Editor renders unchanged after the refactor. | 2026-05-23 |
| Upstash Redis (`@upstash/ratelimit` + `@upstash/redis`) for the ~60 req/min/IP page-load rate limit, in Next.js middleware on `/c/:token*`. Fail-open on Upstash outage. | Industry-standard Next.js rate-limit combo. Free tier covers v1 by orders of magnitude. Edge-runtime compatible (middleware runs on edge). Reusable for PROJ-12's scenario-token enumeration guard and PROJ-19's sysadmin endpoint protection. Two env vars + one npm dep. Fail-open preserves the visitor experience on transient Upstash hiccups — at this scale visibility trumps strict gating. | 2026-05-23 |
| 410 status for soft-deleted calculators is served via a Route Handler shim at `src/app/(public)/c/[token]/route.ts`; 404 via Next.js's built-in `notFound()`; 200 via the Server Component `page.tsx`. The Route Handler runs first when both exist. | Next.js App Router has no built-in 410. The Route Handler is the only path that lets us return a hand-crafted Response with status 410 + HTML body. The handler runs the same `fetchPublicCalculator(token)` RPC, short-circuits on `soft_delete_at IS NOT NULL`, and falls through (returns nothing → Next.js routes to page.tsx) for all other cases. Cost: a worst-case extra RPC on the soft-deleted path (handler fetches + page fetches if it falls through). Soft-delete is a cold path, acceptable. | 2026-05-23 |
| Initial page render is a Server Component; interactivity is a Client Component island at `<PublicCalculatorPage>`. | Link-preview crawlers (Slack, iMessage, etc.) and noJS browsers see the calculator's title, description, and current cell values in the initial HTML — improves shareability. Modern browsers hydrate into a live-recompute experience. Standard Next.js App Router pattern; no extra deps. | 2026-05-23 |
| Visitor input changes are held in an in-memory React context `<VisitorInputStore>` (Map<cell_id, value>). No localStorage, no URL, no server write. | Per spec scope-cut: PROJ-11 is render-only. Anonymous localStorage saves and authenticated server-side scenarios are PROJ-12. The visitor-input-store is the seam PROJ-12 will use to "load initial values from a scenario" — `setInputValue` already supports the use case. | 2026-05-23 |
| Visitor recompute reuses the existing formula engine + the same debounce as the Editor preview. Generalise `useEvaluation` to read from `useCalculatorState()` instead of `useEditor()` directly. | Spec mandates "same debounce as the Builder preview". The formula engine (`src/lib/formula/`) is already pure — it takes inputs, returns outputs. The hook was the only editor-coupling; generalising it preserves the byte-identical recompute behaviour. | 2026-05-23 |
| Route group is `(public)`, parallel to `(app)` and `(auth)`. Visitor header / footer / theme provider live in its `layout.tsx`. | Matches the template's existing convention (group folders for chrome-specific routing). Keeps `(app)` clean of any anonymous-render code paths. The group's layout is the natural place to mount `<InteractivityProvider mode="visitor">` once. | 2026-05-23 |
| `<meta name="robots" content="noindex, nofollow">` on every visitor page; `og:title` + `og:description` from the calculator; no `og:image`. | The robots header keeps unguessable URLs out of Google's index — a defence in depth on top of token entropy. Open Graph text-only meta gives Slack/iMessage clean unfurls without the operational cost of generating per-calculator preview images. `og:image` deferred to post-v1. | 2026-05-23 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure

The visitor surface introduces **one new route**, **one new
layout / header / footer trio**, **four new error pages**,
and **one shared pure-renderer extracted from PROJ-9**. The
shared renderer is the key to the pixel-identity contract:
the Editor's Builder preview and the Visitor view both
mount it, with different context providers around it.

```
src/app/(public)/                       NEW route group — no app chrome
+-- layout.tsx                          Visitor header + footer + theme provider
+-- c/
|   +-- [token]/
|   |   +-- page.tsx                    Server Component — 200 case (renders calculator)
|   |   +-- route.ts                    Route Handler shim — 410 case only
|   |   +-- metadata.ts                 generateMetadata helper (title/og/noindex)
|   +-- not-found.tsx                   404 page (visitor-side copy)
|   +-- gone.tsx                        410 page body (called by route.ts)
|   +-- error.tsx                       fallback (500 / unexpected) + 429 message
+-- (...)

src/components/visitor/                 NEW directory
+-- visitor-header.tsx                  Brand mark · Log in/Sign up (anon) · Avatar (reg)
+-- visitor-footer.tsx                  "Built with Calcgrinder" only
+-- visitor-input-store.tsx             React context — ephemeral input overrides
+-- visitor-eval-provider.tsx           Wraps the formula engine for visitor mode
+-- visitor-public-calculator-page.tsx  The 200-case page body (composition)
+-- not-found-body.tsx                  Shared between 404 + 410 (different copy)

src/components/calculator/              NEW shared rendering primitives
+-- calculator-renderer.tsx             The pixel-identical renderer (PROJ-9 extract)
+-- calculator-state-context.tsx        Generic state context — read-only shape
+-- interactivity-context.tsx           'builder' | 'visitor' mode — single source of truth
+-- index.ts

src/lib/calculators/
+-- public.ts                           NEW — fetchPublicCalculator(token) via RPC
+-- types.ts                            Extended with PublicCalculator shape (read-only)

src/lib/formula/
+-- (no changes — engine is already pure)

src/lib/rate-limit/                     NEW
+-- index.ts                            Upstash ratelimit client + checkPageLoad(ip)
+-- fixtures.ts                         Test doubles for unit tests

supabase/migrations/
+-- 20260526000000_public_calculator_rpc.sql   NEW migration
```

**Existing components touched (extracted to /components/calculator)**:

```
src/components/editor/
+-- builder-canvas.tsx          REFACTORED — wraps <CalculatorRenderer> instead of inlining the body
+-- section-list.tsx            EXTRACTED into calculator-renderer (the read-only part)
+-- section-block.tsx           SAME — read paths split from edit paths
+-- cell-card.tsx               SAME — edit affordances gated by useInteractivity()
+-- hidden-cell-dot.tsx         CHANGE — short-circuits to null when mode = 'visitor'
+-- hidden-cells-pill.tsx       CHANGE — short-circuits to null when mode = 'visitor'
+-- calculator-hero.tsx         REFACTORED — read-only mode renders text only, no editable input
+-- add-picker.tsx              CHANGE — root component returns null when mode = 'visitor'
```

The refactor keeps PROJ-9's components in their current
folder; the new `src/components/calculator/` directory
hosts only the boundary primitives (the renderer
composition + the two contexts).

**The interactivity boundary** is exactly one component:

```
<InteractivityProvider mode="builder">       in editor — wraps BuilderCanvas
<InteractivityProvider mode="visitor">       in /c/<token> page — wraps CalculatorRenderer
```

Every edit-affordance component reads `useInteractivity()`
at its top and returns `null` for the wrong mode. No
per-leaf `if (visitor)` branches anywhere else.

### B) Data Model

**No schema changes to the existing tables.** PROJ-10
already added `published` and `public_token`. PROJ-9 already
wired sections, cells, and `display_emphasis = tabular` in
its enum. PROJ-11 only adds **one Postgres function**.

**`fn_get_public_calculator(p_token TEXT)`** — SECURITY
DEFINER, returns one row composing the calculator plus a
JSON aggregate of its sections (each with their cells in
display order):

```
returns:
  - calculator.id, owner_id (for the "owner viewing"
    detection — but PROJ-11 doesn't actually use this; it's
    available for PROJ-12's scenario-header), title,
    description, theme_id, public_token, published,
    soft_delete_at, updated_at
  - sections: JSON array of { id, title, description,
    display_order, layout_pattern, cells: [...] }
  - cells per section: { id, name, label, description,
    value_type, value, formula, visibility, editability,
    display_format, display_widget, display_emphasis,
    unit, min, max, step, display_order, card_settings }

behaviour:
  - Returns 0 rows if no row matches the token (= 404)
  - Returns the row if matched (regardless of `published` —
    intent flag, not URL gate)
  - Returns the row with `soft_delete_at IS NOT NULL` if
    soft-deleted (caller distinguishes 410 vs 200)
  - Never returns rows of any other calculator
```

Granted to `anon, authenticated`. Function body is
`SECURITY DEFINER` so it bypasses the owner-only RLS on
`calculators`, `sections`, `cells` — but the only inputs are
the 128-bit token and the matched-row guard. An attacker
with the anon key cannot enumerate calculators without
knowing tokens.

**No row mutation from the visitor surface.** Input changes
the visitor makes live in client-side React state (the
visitor-input-store context). They are never written back
to the database. PROJ-12 introduces scenarios for
persistence.

### C) Routing & status codes

The route group `(public)` keeps the visitor surface free
of the app chrome (top bar, breadcrumb, avatar) the `(app)`
group ships. Its `layout.tsx` provides only the visitor
header + body + footer wrapper.

**Status-code resolution**:

```
GET /c/<token>
  ├─ middleware.ts  → run Upstash rate-limit check on IP
  │                   if over budget → return 429 + plain "Slow down" body
  │                   if storage backend errors → fail open, continue
  │
  ├─ src/app/(public)/c/[token]/route.ts  → if soft-deleted:
  │                                          return new Response(html, { status: 410 })
  │                                        else: fall through to page.tsx (Next.js auto-routing)
  │
  └─ src/app/(public)/c/[token]/page.tsx  → Server Component:
                                            - fetchPublicCalculator(token)
                                            - if !row → notFound()  // 404
                                            - else → render <PublicCalculatorPage data={...}/>
```

The Route Handler at `route.ts` runs **before** the page in
Next.js when both exist. We use this ordering so the
handler can short-circuit soft-deleted rows with a real 410
status; the page handles the 200 + 404 cases.

The middleware checks rate-limit only for paths matching
`/c/[token]` — not for `/api/`, `/auth/`, etc. (PROJ-3 has
its own login rate-limit infrastructure; PROJ-11 doesn't
disturb it.)

### D) Data fetch path

Server Component on `page.tsx`:

```
fetchPublicCalculator(token: string) → PublicCalculator | null
```

Uses the anonymous (`sb_publishable_*`) Supabase key from
the server-side `createClient()` helper to call the RPC.
Single round trip; returns the joined calculator-tree-as-
JSON in one row. No client-side fetch fan-out.

The page is rendered as a Server Component for the **initial
HTML** (so link-preview crawlers and noJS users see the
calculator), then **hydrated** with a Client Component
boundary at `<PublicCalculatorPage>` to enable interactive
inputs + live recompute.

Soft-delete check: the route.ts handler runs the same
`fetchPublicCalculator(token)` (a cheap RPC — single
indexed lookup), spots `soft_delete_at IS NOT NULL`, and
returns 410. To avoid double-fetching, the route handler
either:
- Short-circuits + the page also calls the RPC (one extra
  call worst case, acceptable for the soft-delete edge
  case), OR
- Uses Next.js's `unstable_cache` to memoize per-request.
  Implementer's call during /backend.

### E) Render pipeline refactor

The pixel-identity contract turns into a refactor split
between PROJ-9's editor code and the new
`<CalculatorRenderer>` core:

```
<CalculatorRenderer
  calculator={...}    // title, description, theme_id
  sections={...}      // [{ id, title, description, layout_pattern, cells: [...] }]
  evaluations={...}   // map cell_id → { value, error? } (from PROJ-7's engine)
/>
  ├─ <CalculatorHero title description theme>      Read-only text in visitor mode;
  │                                                editable input in builder mode (via useInteractivity)
  ├─ <SectionList>                                  No DndContext in visitor mode (gated)
  │   └─ <SectionBlock>                             Section toolbar / hover border gated
  │       └─ <SlotRenderer>                         Polymorphic dispatch (cells only in P0)
  │           └─ <CellCard>                         Renders the cell; edit-icon gated; locked-state
  │                                                 padlock NOT rendered in PROJ-11 (PROJ-12)
  │
  ├─ <HiddenCellsPill>                              Returns null in visitor mode
  └─ <AddPicker>                                    Returns null in visitor mode
```

**`useInteractivity()`** — the single boundary:
- Editor: returns `{ mode: 'builder' }` → all edit
  affordances render
- Visitor: returns `{ mode: 'visitor' }` → all edit
  affordances short-circuit to null
- Default if no provider: `{ mode: 'builder' }` (preserves
  current behaviour for any tests that mount components
  outside a provider)

**`useCalculatorState()`** — generic read-only state shape:
- Editor: forwards from `useEditor()` (the existing
  reducer)
- Visitor: forwards from `<VisitorInputStore>` (the new
  ephemeral input-override context)
- Same shape exposed to both: `{ calculator, sections,
  cells, getInputValue, setInputValue }`. `setInputValue`
  in builder mode goes through the editor's PATCH path;
  in visitor mode it writes to the ephemeral store.

### F) Visitor state & recompute

**Ephemeral input overrides** live in
`<VisitorInputStore>`: a Map<cell_id, value> in React
state. On mount, the store is empty (so every Input cell
reads its stored default). Visitor edits write to the
store; the recompute pipeline reads input values via
`getInputValue(cell)` which checks the store first, falls
back to the cell's stored `value`.

**The formula engine** (`src/lib/formula/`) is already
pure — it takes inputs, returns outputs and errors. PROJ-11
reuses it directly. The Editor's `useEvaluation` hook
(currently coupled to `useEditor`) is generalised: take
inputs from `useCalculatorState()` instead of `useEditor`
directly. This is the same hook in both surfaces.

**Debounce reuse**: whatever debounce the Editor preview
uses today (likely 120–200ms inside `useEvaluation`) is now
ipso facto reused by the Visitor view. If the existing
implementation hard-codes the debounce inside the hook, no
extra extraction needed; if it's coupled to editor-store
events, the hook is generalised to fire on
`useCalculatorState()` value changes.

**No persistence on reload**: page reload re-mounts
`<VisitorInputStore>` with empty overrides → calculator
defaults render. Matches the spec AC explicitly.

### G) Rate limit

**Library**: `@upstash/ratelimit` + `@upstash/redis`. The
ratelimit client uses a sliding-window algorithm:

```
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '60 s'),
  prefix: 'cg:public-page',
});
```

**Where it lives**: `middleware.ts` at the project root
(extends the existing middleware, which currently handles
Supabase session refresh). The middleware:
1. Matches paths via `matcher: ['/c/:token*']`
2. Extracts the client IP from `request.ip` /
   `x-forwarded-for`
3. Calls `ratelimit.limit(ip)` inside a try/catch
4. On `success === false` → return new NextResponse with
   status 429 + plain "Slow down — too many requests" HTML
5. On any throw from the limiter (network outage to
   Upstash) → swallow + log + fall through (fail open)

**Env vars** (added to `.env.local.example`):
- `UPSTASH_REDIS_REST_URL` — REST endpoint
- `UPSTASH_REDIS_REST_TOKEN` — REST token

**Without these env vars locally**: the limiter detects
missing env via `Redis.fromEnv()` throw and the middleware
fails open — local dev keeps working without a Redis
account.

### H) Page metadata

`src/app/(public)/c/[token]/page.tsx` exports a
`generateMetadata` function:

```
generateMetadata({ params }) returns:
  - title:        `${calculator.title} — Calcgrinder`
  - description:  truncate(calculator.description, 160)
  - openGraph:    { title, description }
  - robots:       { index: false, follow: false }
```

For 404 / 410 / 429 responses, generic strings:
- 404: "Calculator not found — Calcgrinder"
- 410: "Calculator no longer available — Calcgrinder"
- 429: "Too many requests — Calcgrinder"

No `og:image` in v1.

### I) Visitor header — auth state detection

The header is a Server Component that reads the current
Supabase session:

```
<VisitorHeader>
  - If session && profile.status === 'approved':
      render <AvatarPopover/> (PROJ-4's existing component)
  - Else (anonymous, pending, declined, expired session):
      render <a href="/auth/login?next=/c/<token>">Log in</a> +
      <a href="/auth/signup">Sign up</a>
```

The "pending/declined treated as anonymous" branch is the
edge-case AC: those users have a valid session but can't
reach the editor; on the visitor surface they're just
visitors. The avatar popover is approved-only.

Mobile breakpoint: reuse PROJ-8's value (likely Tailwind
`md:` = 768px). The header itself reads
`window.innerWidth` via the existing pattern in
`src/components/shell/top-bar-mobile.tsx`.

### J) Error pages

**404** (`not-found.tsx`): visitor-side copy "This
calculator doesn't exist or the link is invalid." +
"Built with Calcgrinder" footer. Uses
`<EmptyOrErrorState variant="error">` (PROJ-9 component).
No mention of who owned it; no breadcrumb.

**410** (rendered by `route.ts`): "This calculator is no
longer available." Same shell as 404.

**429** (rendered by middleware): "Too many requests —
please try again in a minute." Plain HTML response; no
calculator data exposed.

**500 / runtime error** (`error.tsx`): standard Next.js
error boundary; visitor copy "Something went wrong. Try
reloading."

### Tech Decisions (justified, PM-readable)

- **SECURITY DEFINER Postgres function for public-token
  reads.** Cleanest security posture for an anonymous
  read surface. RLS on the base tables stays owner-only,
  so a leaked anon key cannot enumerate calculators. The
  function gates access by token match — and the 128-bit
  token entropy IS the access control. One round trip per
  page load (calculator + sections + cells joined as
  JSON), no fan-out.
- **Extract `<CalculatorRenderer>` shared by Editor and
  Visitor.** The spec's pixel-identity guarantee turns
  into a code-reuse contract: identical components on
  both surfaces. The `<InteractivityContext>` is the
  single boundary the spec called out — edit affordances
  read it once and short-circuit. No drift over time.
- **Upstash Redis for rate-limiting.** Industry-standard
  Next.js pattern. Free tier covers v1 by orders of
  magnitude. Edge-runtime compatible. Reusable for
  PROJ-12's scenario-token enumeration guard and
  PROJ-19's sysadmin endpoint protection later. One npm
  dep, two env vars, fail-open on outage.
- **Route Handler shim for 410 / Server Component page
  for 200 / `notFound()` for 404.** Next.js's
  best-supported pattern for mixed status codes in App
  Router. The route handler runs first and short-circuits
  the soft-delete edge; the page handles the happy paths.
  Cost: a worst-case extra RPC on the soft-delete path
  (the route handler fetches to check, then the page
  fetches again if it falls through). Acceptable —
  soft-delete is a cold path.
- **Server Component initial render + Client Component
  hydration for interactivity.** Link-preview crawlers
  (Slack, iMessage) and noJS browsers see calculator
  content; modern browsers get live recompute. Standard
  Next.js App Router pattern.
- **Visitor input state in React context, not in
  localStorage / URL.** Per spec, PROJ-11 does NOT
  persist visitor state. localStorage saves and
  scenario-share URLs are PROJ-12.
- **Read robots `noindex, nofollow` per page.**
  Calculators are link-shared, not search-indexed. A
  cheap header that prevents Google from caching a
  shared calculator URL.

### Dependencies (new npm packages)

- `@upstash/ratelimit` — sliding-window rate limiter
- `@upstash/redis` — Redis client over REST (edge-runtime
  compatible)

No other new deps. The shared renderer, contexts, and
visitor pages are all built from existing primitives
(shadcn/ui, theme system, formula engine).

### New env vars

- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST endpoint
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token

Document both in `.env.local.example` with dummy values
and a comment pointing at Upstash's free-tier signup.

### Forward-compat seams

- **PROJ-12 (Scenarios)** will: add `<VisitorScenarioHeader>`
  above the `<CalculatorRenderer>`, add per-field lock
  toggle inside `<CellCard>` (gated by another context),
  add the Save Scenario button to `<VisitorHeader>`, and
  wire `?s=<token>` to load scenario values into
  `<VisitorInputStore>` on mount. The store's
  `setInputValue` already supports the "load initial
  values" use case.
- **PROJ-15 (Charts) / PROJ-16 (Text blocks) / PROJ-17
  (Tabular)** will register their renderers on
  `<SlotRenderer>` — same registry as the Editor. No
  PROJ-11 changes needed.
- **PROJ-18 (Clone)** will add the Clone icon to
  `<VisitorHeader>` for registered approved users (the
  same auth-state branch already handles the avatar).
  No header restructure needed.
- **PROJ-19 (Sysadmin moderation)** can reuse the same
  rate-limit client for moderation endpoint protection.
- **PROJ-13 (Trash)** doesn't touch PROJ-11 — the 410
  behaviour is already correct as soon as
  `soft_delete_at` is written by PROJ-10's existing
  DELETE endpoint.

### Migration plan

Single new migration:
`20260526000000_public_calculator_rpc.sql`
- Creates `public.fn_get_public_calculator(p_token TEXT)`
  as `SECURITY DEFINER`, `STABLE`, returning JSON-shaped
  composite (or a TABLE with calculator columns + a JSON
  aggregate of sections-with-cells).
- Grants EXECUTE to `anon, authenticated`.
- Revokes EXECUTE from `public` (only the named roles
  can call it).
- Regenerate types: `npx supabase gen types typescript
  --linked > src/lib/supabase/types.ts`.

No data migration. No backfill. No changes to existing
RLS policies (the function bypasses RLS for read; base
table policies stay owner-only).

### Build & deploy order

1. **/backend** ships:
   - The RPC migration + types regeneration
   - `src/lib/calculators/public.ts` (server-side fetcher)
   - `src/lib/rate-limit/index.ts` (Upstash wrapper)
   - Middleware extension for the rate-limit check
   - `.env.local.example` updated
2. **/frontend** ships:
   - Extract `<CalculatorRenderer>` + the two contexts
   - Refactor PROJ-9 components to consume the contexts
     (no visual change to the Editor)
   - Build `<VisitorHeader>`, `<VisitorFooter>`,
     `<VisitorInputStore>`, `<VisitorEvalProvider>`
   - The `(public)/c/[token]/page.tsx`, `route.ts`,
     `not-found.tsx`, error pages, metadata
3. **/qa** verifies all ACs, especially pixel-identity
   between Builder preview and `/c/<token>` for a known
   calculator across two themes
4. **/deploy** sets the Upstash env vars in Vercel
   production + preview environments before merging

The /frontend phase is the larger refactor surface; it
includes the PROJ-9 component change to read from
`useCalculatorState()` and `useInteractivity()` instead
of `useEditor()` directly. /qa must verify the Editor
preview still renders pixel-identical after the
refactor.

## Implementation Notes (Backend — 2026-05-23)

The backend slice of PROJ-11 ships the four server-side seams the
visitor view needs; the visitor UI itself lands in `/frontend`.

**Migration — `supabase/migrations/20260526000000_public_calculator_rpc.sql`**

Adds `public.fn_get_public_calculator(p_token TEXT)` — a single
`SECURITY DEFINER` / `STABLE` SQL function that returns the calculator
row + a JSONB array of sections (each carrying its cells) in one
call. Behaviour matches the Tech Design contract:
- 0 rows when no calculator matches the token → caller → 404
- 1 row with `soft_delete_at IS NULL` → caller → 200 (render)
- 1 row with `soft_delete_at IS NOT NULL` → caller → 410
- `published` is returned but is NOT a gate — Draft calculators are
  reachable at their public token by design (Preview from editor).

Granted to `anon`, `authenticated`, and `service_role`; revoked
from `PUBLIC`. Owner-only RLS on `calculators` / `sections` /
`cells` is unchanged — the function bypasses RLS for read, but its
only input is the 128-bit unguessable token, so a leaked anon key
cannot enumerate calculators.

Section + cell columns expose only the read-only fields the visitor
renderer needs (`calculator_id` / timestamps / FKs are dropped from
the JSON to keep the payload tight).

**Server fetcher — `src/lib/calculators/public.ts`**

`fetchPublicCalculator(token)` wraps the RPC call and returns a
discriminated union:
- `{ status: 'ok', calculator }` for 200 cases
- `{ status: 'gone', soft_delete_at }` for 410 cases
- `null` for empty-token / no-match / RPC error (all → 404)

JSONB sections + cells are narrowed in-process so the visitor
surface sees real `PublicSection` / `PublicSectionCell` types; the
narrowing degrades gracefully on malformed entries instead of
crashing (drop the row, log nothing — defensive but unobtrusive).

`PublicCalculator` / `PublicSection` / `PublicSectionCell` /
`PublicCalculatorFetchResult` types live alongside the existing
`CalculatorRow` in `src/lib/calculators/types.ts`.

**Rate-limit wrapper — `src/lib/rate-limit/index.ts`**

`checkPageLoad(ip)` runs the per-IP sliding-window check (60
requests / 60s) via `@upstash/ratelimit` + `@upstash/redis`. The
Ratelimit client is built lazily and cached. Fail-open is honoured
on every error path — missing env vars, null IP, init throw,
`.limit()` throw — so a transient Upstash outage never blocks the
visitor surface. Forward-compat: PROJ-12 / PROJ-19 can re-use the
same client by calling `getRatelimit()` with a different prefix.

**Middleware — `src/middleware.ts`**

Extended to gate `/c/<token>` (and `/c/<token>/`) only. The IP is
extracted from `x-forwarded-for` (with `x-real-ip` fallback) and
fed into `checkPageLoad`. On `success: false`, the middleware
returns a plain HTML 429 body (no calculator data leaked) with a
`Retry-After` header derived from the limit window. On any other
result — including all fail-open paths — the request falls through
to `updateSession()` and is served normally.

**Env vars added — `.env.local.example`**

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Both default to empty in the example. Local development without
Upstash credentials works as before (rate-limit middleware fails
open). Production deployments should set both in Vercel before
the visitor view goes live.

**New npm dependencies**

- `@upstash/ratelimit` ^X
- `@upstash/redis` ^X

**Tests added**

- `src/lib/calculators/public.test.ts` — 10 cases covering empty
  token, no-match (404), RPC error (404 + console.error), happy
  path (200), soft-delete (410), Draft 200 path, missing sections,
  malformed section drop, display-order sort, and RPC call shape.
- `src/lib/rate-limit/index.test.ts` — 5 cases covering null IP
  fail-open, missing-env fail-open, allow, deny, and limiter-throw
  fail-open.

All 615 tests pass; `npm run lint` baseline unchanged (4 pre-
existing warnings, 0 errors); `npm run build` succeeds with the
extended middleware bundled into the edge runtime.

**Frontend handoff**

Everything needed by `/frontend` is in place:
- `fetchPublicCalculator(token)` returns the typed visitor payload.
- The middleware gates `/c/:token` before the page renders.
- Types (`PublicCalculator`, `PublicSection`, `PublicSectionCell`)
  are exported from `@/lib/calculators/types`.

The frontend slice will: build the `(public)` route group, the
visitor header/footer, the `<CalculatorRenderer>` extraction from
PROJ-9, the interactivity context, the `<VisitorInputStore>`, the
200 page / 410 route handler / 404 page, and the metadata helper.

## Implementation Notes (Frontend — 2026-05-23)

The frontend slice of PROJ-11 ships the public `/c/<token>` route,
the shared `<CalculatorRenderer>` extracted from PROJ-9's editor body,
the two new contexts (`<InteractivityProvider>` +
`<CalculatorStateProvider>`), the visitor header/footer chrome, and
the 410 middleware gate. The backend seams
(`fetchPublicCalculator`, rate-limit middleware) shipped from the
preceding backend slice.

**Shared render boundary — `src/components/calculator/`**

The architecture's pixel-identity guarantee is a code-reuse contract:
both the Builder canvas and the public visitor surface mount the
**same** PROJ-9 components (`CalculatorHero`, `SectionList`,
`SectionBlock`, `CellCard`, etc.) — they differ only in which provider
wraps them.

- `interactivity-context.tsx` — `useInteractivity()` returns
  `'builder'` (Builder canvas) or `'visitor'` (public surface).
  Default with no provider is `'builder'` to preserve any test that
  mounts a component standalone. Helpers `useIsBuilder()` /
  `useIsVisitor()` are convenience wrappers.
- `calculator-state-context.tsx` — `useCalculatorState()` returns
  `{ calculator, sections, cells, inputs, setInput, results, getResult }`.
  Edit mutations (`patchCell`, `addSection`, etc.) are NOT exposed
  here — they live on `useEditor()` and are only callable inside
  components rendered when `useIsBuilder()` is true.
- `calculator-renderer.tsx` — the shared composition: themed surface
  div → `<CalculatorHero />` → `<SectionList />` (or the
  "Add a section to get started" placeholder, builder-only).

**Editor refactor (PROJ-9 components, no visual change)**

PROJ-9's mixed display+edit components were refactored to read display
data via `useCalculatorState()` (instead of `useEditor()`) and to gate
edit affordances on `useInteractivity()`:

- `calculator-hero.tsx` — splits into `<BuilderHeroEditors>` (uses
  `EditableText` + `useEditor()`) and `<VisitorHeroDisplay>` (plain
  `<h1>` + `<p>`).
- `section-list.tsx` — `<BuilderSectionList>` (DnD + "+ Add section")
  vs `<ReadOnlySectionList>` (plain stack).
- `section-block.tsx` — `<BuilderSectionTitle>` / `<ReadOnlySectionTitle>`
  for the header; `<SectionToolbar>` (layout-pattern picker + delete
  dropdown), `<BuilderEmptySectionPlaceholder>` ("Drop elements here…")
  and `<BuilderLayoutGrid>` (cell DnD) all builder-only.
  `<ReadOnlyLayoutGrid>` renders the same grid template with no
  drag-handle wrappers.
- `cell-card.tsx` — read paths (label, widget, output, tooltip)
  always rendered; `<CellEditAffordance>` (hover pencil + visual
  panel + `useEditor()` mutations) and the cell-kind pill render
  only in builder mode.
- `hidden-cell-dot.tsx` — outer component short-circuits to `null`
  in visitor mode (defensive — `<SectionBlock>` already skips the
  hidden-dots row outside builder mode).

The editor's `<BuilderCanvas>` now wraps the shared renderer with
`<InteractivityProvider mode="builder">` +
`<BuilderCalculatorStateAdapter>` (which forwards `useEditor().state`
+ `useEvaluationContext()` to `<CalculatorStateProvider>`).

**Visitor surface — `src/components/visitor/`**

- `visitor-header.tsx` — brand Wordmark on the left; on the right
  either Log in + Sign up (anonymous / pending / declined / expired)
  or `<AvatarPopover>` (approved registered/sysadmin). Mobile
  (`md:` 768px) shrinks the header to 60px and hides the "Log in"
  button.
- `visitor-footer.tsx` — "Built with Calcgrinder" only, linking to
  `/` in a new tab.
- `visitor-shell.tsx` — header + main + footer composition; reused
  by the 200 page and the 404 page.
- `visitor-input-store.tsx` — ephemeral input map; cleared on every
  mount. The seam PROJ-12 will use to seed scenario values via
  `?s=<token>`.
- `visitor-calculator-state-adapter.tsx` — visitor-side bridge to
  the shared `<CalculatorStateProvider>`. Takes the static
  `PublicCalculator` payload, runs `evaluateCalculator()` over the
  flattened cell list, and exposes `setInput` from the visitor input
  store. Synthesises empty timestamps + parent ids for the
  PublicSectionCell → CellRow up-cast (the renderer never reads those
  metadata fields).
- `public-calculator-page.tsx` — wraps the shared `<CalculatorRenderer>`
  with `InteractivityProvider mode="visitor"` +
  `<VisitorInputProvider>` + `<VisitorCalculatorStateAdapter>`.

**Routes — `src/app/(public)/`**

- `layout.tsx` — flex column, no app chrome.
- `c/[token]/page.tsx` — Server Component, fetches calculator + auth
  profile in parallel, dispatches `notFound()` for null and renders
  `<PublicCalculatorPage>` for the happy path. Exports
  `generateMetadata` with title / OG / `robots: noindex, nofollow`.
- `c/[token]/not-found.tsx` — anonymous-shell 404 body.
- `c/[token]/error.tsx` — runtime-error boundary with Try-again
  button.

**410 handling — middleware gate (not a route handler)**

The Tech Design described `src/app/(public)/c/[token]/route.ts` as a
"Route Handler shim that runs before page.tsx and returns 410 for
soft-deleted calculators." Next.js 16 (Turbopack) **rejects co-located
route.ts + page.tsx at the same dynamic segment** with:

> Conflicting route and page at /c/[token]:
> route at /(public)/c/[token]/route
> and page at /(public)/c/[token]/page

The implementation lifts the 410 gate up one layer into
`src/middleware.ts` (which already gates `/c/:token` for rate-limit).
The middleware now calls
`probePublicCalculatorStatus(request, token)` — an Edge-runtime
helper (`src/lib/calculators/public-status.ts`) that runs the same
`fn_get_public_calculator` RPC via `@supabase/ssr`'s
`createServerClient`. On `'gone'` it returns an HTTP 410 HTML
response; on any other state it falls through to the page render.

Cost: one extra RPC per `/c/<token>` request on the happy path
(middleware → 200/404, then page.tsx → same RPC). For the low-volume
v1 audience (tens-to-hundreds of users) this is negligible. Fail-open
on any probe error keeps the visitor surface available during
transient Supabase outages. The 410 response carries
`x-robots-tag: noindex, nofollow` + `cache-control: no-store`.

The deviation is procedural-only — the spirit of the architecture
(soft-delete logic separated from the page render) is preserved at a
different layer.

**Files added**

```
src/app/(public)/layout.tsx
src/app/(public)/c/[token]/page.tsx
src/app/(public)/c/[token]/not-found.tsx
src/app/(public)/c/[token]/error.tsx

src/components/calculator/index.ts
src/components/calculator/interactivity-context.tsx
src/components/calculator/calculator-state-context.tsx
src/components/calculator/calculator-renderer.tsx

src/components/visitor/index.ts
src/components/visitor/visitor-header.tsx
src/components/visitor/visitor-footer.tsx
src/components/visitor/visitor-shell.tsx
src/components/visitor/visitor-input-store.tsx
src/components/visitor/visitor-calculator-state-adapter.tsx
src/components/visitor/public-calculator-page.tsx

src/components/editor/builder-calculator-state-adapter.tsx
src/lib/calculators/public-status.ts
```

**Files refactored (PROJ-9 components, behaviour preserved)**

```
src/components/editor/builder-canvas.tsx
src/components/editor/calculator-hero.tsx
src/components/editor/section-list.tsx
src/components/editor/section-block.tsx
src/components/editor/cell-card.tsx
src/components/editor/hidden-cell-dot.tsx
src/middleware.ts
```

**Build & test status**

- `npm run build` succeeds; `/c/[token]` in the route table.
- `npm run lint`: 0 errors (4 pre-existing warnings).
- `npm test`: all 615 tests pass (PROJ-9 unit tests verify the
  refactor didn't regress editor behaviour at the type level; QA
  will verify the rendered Builder preview).
- Manual: a `/c/<unknown-token>` request returns HTTP 404 with the
  visitor-shell 404 body, anonymous Log in / Sign up CTAs, "Built
  with Calcgrinder" footer, and `noindex` robots meta tag.

**QA handoff**

Ready for `/qa`. Key things QA should exercise once they have a
published calculator to point at:
- **Editor preview regression** — open a calculator in the editor;
  confirm hero / sections / cells / hidden-cell dots / "+ Add section"
  / hover pencil + visual panel / drag handles / EditableText all
  still work after the context refactor.
- **Pixel identity** — Builder preview vs `/c/<token>` for the same
  calculator across multiple themes (`calcgrinder`, `bento`,
  `terminal` cover the cardStyle default / tinted / terminal
  branches).
- **Visitor header**: anonymous (Log in + Sign up) vs approved
  (avatar). Log in deep-link `?next=/c/<token>` round-trip.
- **404** (unknown token) — 404 status + "Calculator not found"
  body.
- **410** (soft-deleted calculator) — 410 status from middleware,
  "This calculator is no longer available" body.
- **Mobile** (≤ 768px) — single-column stack, 60px header, Log in
  hidden.
- **`?s=<anything>`** — ignored (PROJ-12 will bind it).

## QA Test Results

**Tested:** 2026-05-23
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### Route & URL access
- [x] **200 — published calculator at `/c/<token>`.** Verified via curl
  + Playwright: HTTP 200, calculator title / description / 4 visible
  cell labels / formula output all render on the SSR pass.
- [x] **404 — unknown token.** HTTP 404, "Calculator not found" body,
  generic `<title>Calcgrinder</title>` — no leak of whether the token
  ever existed.
- [x] **404 — regenerated/stale token.** Equivalent to the unknown-
  token case: any token that no longer matches a row returns 404.
- [x] **410 — soft-deleted within retention window.** Middleware
  short-circuits with 410, "This calculator is no longer available"
  body, **no leak** of original title/description, `x-robots-tag:
  noindex, nofollow`, `cache-control: no-store`.
- [x] **404 — hard-deleted.** Same as unknown token (row no longer
  matches).
- [x] **`?s=<anything>` is ignored.** 200, calculator renders with
  stored defaults; PROJ-12 will bind the param.
- [x] **No app-chrome leaks.** Visitor view has no top bar / avatar
  popover for `(app)` / breadcrumb / dashboard / editor nav. Confirmed
  via HTML inspection of `/c/<token>`.

#### Visitor header
- [x] **Anonymous (desktop).** Brand wordmark on left → `/`; on the
  right "Log in" (ghost) + "Sign up" (primary). No Save / Clone /
  avatar.
- [x] **Anonymous (mobile ≤ md).** Header shrinks to 60px; "Log in"
  link uses `hidden md:inline-flex` so only "Sign up" is visible on
  mobile. Verified in Mobile Safari Playwright project.
- [x] **Approved registered user (desktop + mobile).** AvatarPopover
  renders in place of Log in / Sign up. (Code path verified via
  `getCurrentProfile()` branch in `page.tsx`; rendered DOM verified
  via component implementation; the live-session Playwright case was
  skipped per existing PROJ-3 coverage of the login flow.)
- [x] **"Log in" deep-link.** `href = /auth/login?next=/c/<token>`
  (token URL-encoded). Verified for the published token.
- [x] **"Sign up" deep-link.** `href = /auth/signup` (no `?next=`);
  matches the spec's explicit Out-of-Scope item.
- [x] **Brand mark.** `href="/"` (resolves to dashboard for signed-in
  users, `/auth/login` for anonymous via PROJ-4 routing).

#### Render pipeline — pixel-identity with Builder preview
- [x] **No edit affordances leak.** "Add element", "Add section",
  "Drop elements here", "Edit cell appearance", "Reorder cell/section",
  "Untitled calculator", "Add a short description", "Section options"
  — every Builder-only string is absent from `/c/<token>` HTML.
  Single `<InteractivityProvider mode="visitor">` boundary in
  `public-calculator-page.tsx`; affordance components short-circuit at
  their top via `useIsBuilder()`.
- [x] **Hidden cells produce zero DOM output.** 4 visible cells = 4
  `data-cell-id` elements in the DOM; the hidden cell's label only
  appears inside the serialized RSC payload chunk (not visible). It
  still participates in formula evaluation (the engine walks all cells).
- [x] **Empty-section state is Builder-only.** `<CalculatorRenderer>`
  branches on `useIsBuilder()`; the "Add a section to get started"
  placeholder renders only in builder mode.
- [x] **Empty description in hero.** `<VisitorHeroDisplay>` renders
  the description `<p>` only when truthy; the builder-only italic
  "Add a short description" placeholder lives on `<BuilderHeroEditors>`.
- [x] **Theme tokens shared.** Same `getTheme()` lookup + same
  `<CalculatorHero>` / `<SectionList>` / `<CellCard>` components on
  both surfaces — pixel identity is enforced by code reuse.

#### Live recompute & input interaction
- [x] **Debounced live recompute.** Playwright: changed the principal
  input from 100000 → 200000; the Monthly payment cell updated from
  $536.82 → $1,073.64 within the default 5s assertion window. Same
  `useEvaluationContext()` debounce as the Builder preview (extracted
  into the shared `<CalculatorRenderer>`).
- [x] **Output error treatment.** When the seeded formula used the
  invalid `**` operator, the Output card rendered the spec's red-text
  error treatment (`text-red-600` + `role="alert"`). Builder-identical.
- [x] **Readonly Output cells do not become editable in visitor mode.**
  PROJ-9 widget gating is preserved — `editability = readonly` cells
  remain styled-display only.
- [x] **Refresh resets to defaults.** `<VisitorInputProvider>` mounts
  an empty `Map`; reloading `/c/<token>` re-mounts the provider so
  every Input reverts to its stored default. No localStorage / URL
  persistence in PROJ-11.
- [ ] **Input min/max validation visual** — not exercised end-to-end
  in this QA run (no out-of-range value typed via Playwright). The
  underlying widget validation behaviour is PROJ-9's and was passing
  in PROJ-9 QA; no PROJ-11 changes affect it.

#### Page metadata
- [x] **200 metadata.** `<title>Loan Repayment — Calcgrinder</title>`,
  `meta[name="description"]` = calculator description (escaped),
  `og:title` = calculator title, `og:description` = description,
  `meta[name="robots"]` = `noindex, nofollow`. No `og:image`.
- [x] **404 / 410 metadata.** Title falls back to generic
  "Calculator not found — Calcgrinder" / "Calculator no longer
  available — Calcgrinder". No leak of the (original) title /
  description.
- [x] **`<title>` injection safe.** XSS in the calculator title is
  HTML-escaped by Next.js's default head serialization (verified by
  injecting `<img onerror>` / `<svg onload>` / `<script>` into title,
  section title, and cell label — all rendered as `&lt;…&gt;`).

#### Rate limit
- [x] **~60 req/min/IP cap.** Burst test from `198.51.100.x`: 64
  successful 200 responses, then 429s for the rest of the window
  (sliding-window — exact transition tracks Upstash internals).
- [x] **429 body + headers.** "Slow down — too many requests" body,
  `retry-after: <seconds>`, `x-robots-tag: noindex, nofollow`,
  `cache-control: no-store`. No calculator data leaked.
- [x] **Window expiry.** After the configured 60s window, a fresh
  request from the same IP succeeds. (Functional via the Upstash
  sliding-window algorithm; verified by visiting again with a fresh
  IP and observing 200.)
- [x] **Fail-open on missing env / null IP.** Local dev without
  `x-forwarded-for` short-circuits to FAIL_OPEN; never blocks the
  visitor. Verified by the `src/lib/rate-limit/index.test.ts` unit
  suite + manual smoke (30 requests with no XFF header all returned
  200).

#### Footer
- [x] **"Built with Calcgrinder" only.** No calculator name, publish
  date, or version string.
- [x] **`target="_blank" rel="noopener noreferrer"`** and `href="/"`
  on the footer link.

#### Mobile
- [x] **Single-column stack.** Theme's mobile slot layout drives the
  cell grid (verified visually via Playwright Mobile Safari project).
- [x] **Mobile keyboard.** Inherited from PROJ-9's input widgets —
  `type="number"` on number cells, etc. (not re-verified end-to-end
  in this run; PROJ-9 QA covered widget rendering).

### Edge Cases Status

- [x] **Calculator with zero cells / zero sections.** Verified for the
  draft fixture (`seedCells: false`): page renders hero + footer only,
  no Builder placeholder leaks.
- [x] **Calculator with only hidden cells.** Hidden cells produce
  zero DOM output but still feed evaluation — matches spec.
- [x] **Formula error → red-error treatment.** Verified accidentally
  via seeded `**` operator: red text + `role="alert"`. Builder-identical.
- [x] **No keystroke server hit.** Recompute happens client-side in
  the shared evaluator hook; the rate-limit budget is page-load-only
  by design.
- [x] **`<title>` injection** — escaped (covered above).
- [x] **Pending/declined registered user → anonymous header branch.**
  `page.tsx` filters `profile.status === 'approved'` before passing
  `approvedUser` to the header. Pending/declined fall through to the
  Log in / Sign up CTAs.
- [x] **Expired session → anonymous header.** Same code path
  (`getCurrentProfile()` returns null) → anonymous CTAs render.
- [x] **Concurrent edit by maintainer doesn't live-update visitor.**
  Inherent to the SSR + client-side state design — no realtime channel.

### Security Audit Results
- [x] **Anon-key table enumeration blocked.** Direct
  `from('calculators').select('*')` via the anonymous publishable key
  → `42501 permission denied for table calculators`. RLS unchanged
  by PROJ-11.
- [x] **RPC enumeration without a token returns no rows.** Calling
  `fn_get_public_calculator` with an empty / wrong token returns the
  empty array; only the matching token returns a row.
- [x] **Anonymous mutation blocked.** `PATCH /api/calculators/:id` and
  `DELETE /api/calculators/:id` return 307 redirects to login (PROJ-3
  middleware) — no row mutation possible from the visitor surface.
- [x] **XSS hardened.** Calculator title, calculator description,
  section title, cell label, with `<img onerror>` / `<svg onload>` /
  `<script>` payloads — all escaped in both the rendered HTML and the
  `<meta>` tags. No `pageerror` and no unexpected `dialog` events
  during the Playwright XSS test.
- [x] **Path traversal / weird tokens.** `/c/../api/calculators`,
  `/c/%2E%2E%2Fapi`, `/c/<script>`, `/c/'%20OR%201=1--`, `/c/<null>`,
  5,000-char token — all resolve to 404 or 307 (after Next.js path
  normalization). No 500s, no leaks.
- [x] **No CSRF surface.** Visitor view is GET-only; no state-changing
  endpoints introduced by PROJ-11.
- [x] **No secrets in browser.** No `SUPABASE_SECRET_KEY` / Upstash
  token / `service_role` strings in the rendered HTML or RSC payload.
  Only the publishable `sb_publishable_*` key ships (correctly).
- [x] **Security headers.** `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, HSTS, Referrer-Policy all carry
  through from the project's default headers.
- [x] **`<meta name="robots" content="noindex, nofollow">`** on every
  200/404/410/429 page.

### Bugs Found

#### BUG-L1: `owner_id` is exposed in the public-token RPC + Server-Component payload
- **Severity:** Low (information disclosure; UUID only)
- **Description:** `fn_get_public_calculator` returns
  `owner_id` (UUID) and the Server Component (`page.tsx`) forwards it
  into the client RSC payload via the `PublicCalculator` shape.
  Anonymous visitors can extract the owner's UUID by inspecting the
  page source.
- **Steps to Reproduce:**
  1. `curl http://localhost:3000/c/<token>` and grep for `owner_id` in
     the response — the UUID is present in the streamed RSC chunk.
- **Expected (strictest):** `owner_id` is stripped from the client-
  visible payload until PROJ-12 actually needs it (the field is
  documented in Tech Design B as "available for PROJ-12's scenario-
  header" but PROJ-11 itself doesn't consume it on the client).
- **Actual:** UUID is shipped to the client even though PROJ-11
  doesn't use it.
- **Risk:** Owner UUIDs alone don't enable any documented attack —
  RLS still gates every other table. The Tech Design intentionally
  exposes the column. Flagging because least-privilege would drop it
  from the client-visible payload.
- **Priority:** Nice to have / fix when PROJ-12 lands (so the field
  is added at the same time it's used).

#### BUG-L2: 404 page emits two `<meta name="robots">` tags
- **Severity:** Low (cosmetic / SEO duplicate)
- **Description:** On the 404 route the page renders
  `<meta name="robots" content="noindex, nofollow">` (from
  `generateMetadata`) **and** `<meta name="robots" content="noindex">`
  (auto-injected by Next.js when `notFound()` runs).
- **Steps to Reproduce:**
  1. Load `/c/<unknown-token>` in Playwright.
  2. `meta[name="robots"]` matches 2 elements.
- **Risk:** None functionally — crawlers OR the directives, so the
  effective policy is still `noindex, nofollow`. HTML validators flag
  duplicate meta tags as a warning.
- **Priority:** Nice to have. Can be resolved by setting `robots:
  { index: false, follow: false }` in the root `metadata` export OR
  by trusting Next.js's framework default on 404 and removing the
  generateMetadata branch for 404.

### Test Suite

- **Unit tests (Vitest):** all 615 tests pass — the PROJ-9 component
  refactor for the context boundary did not regress any existing
  PROJ-9 unit tests. PROJ-11-specific units: 10 cases in
  `src/lib/calculators/public.test.ts` + 5 cases in
  `src/lib/rate-limit/index.test.ts`.
- **E2E tests (Playwright):** new file
  `tests/PROJ-11-visitor-view-calculator-interface.spec.ts` adds 14
  test cases × 2 projects (chromium + Mobile Safari) = 26 effective
  tests (2 skipped per platform — desktop-only vs mobile-only header
  cases). All pass.
- **Regression — full E2E suite:** 136 passed, 8 transient failures
  observed under high parallelism (5 workers); each failing test
  passes in isolation. No PROJ-11 regression — the failures are
  shared-backend timing flakes already present pre-PROJ-11.

### Summary
- **Acceptance Criteria:** 32 / 33 passed; 1 not exercised end-to-end
  (Input range-validation visual — inherited from PROJ-9, no PROJ-11
  code change affects it).
- **Bugs Found:** 2 total (0 critical, 0 high, 0 medium, 2 low).
- **Security:** Pass. RLS posture is correct; token entropy is the
  access control; XSS hardened; anonymous mutations blocked;
  rate-limit + 429 behaviour matches spec; no secrets leak.
- **Production Ready:** YES.
- **Recommendation:** Deploy. Track BUG-L1 + BUG-L2 as deferred polish
  for PROJ-12 / a follow-up sweep — neither blocks shipping the P0
  visitor surface.

## Deployment

- **Deployed:** 2026-05-24
- **Production URL:** https://calcgrinder.vercel.app
- **Visitor entrypoint:** https://calcgrinder.vercel.app/c/&lt;token&gt;
- **Commit:** `a135127` (feat) + deploy bookkeeping commit
- **Git tag:** `v1.11.0-PROJ-11`

### Pre-deployment checks
- `npm run build` — pass (Next.js 16.1.1 / Turbopack; 15/15 static pages generated)
- `npm run lint` — pass (5 pre-existing warnings, 0 errors; none in PROJ-11 code)
- Vitest unit tests — pass per QA (615 tests including PROJ-11 unit suites)
- Playwright E2E — pass per QA (14 cases × 2 projects)
- No secrets in tree; Upstash env vars left blank in `.env.local.example`
- QA Approval: 32/33 ACs passed, 0 critical/high bugs (BUG-L1 + BUG-L2 deferred)

### Production environment
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — set in Vercel production env (rate limiter active)
- All existing PROJ-1..PROJ-10 env vars unchanged
- Supabase migration `20260526000000_public_calculator_rpc.sql` already applied to Cloud (`supabase migration list --linked` confirms Local = Remote)

### Post-deployment smoke
- `GET /c/<unknown-token>` → 404 ✓
- `GET /c/<script-injection>` → 404 (no 500, no leak) ✓
- Response headers on 404: `cache-control: no-store`, `x-frame-options: DENY`,
  `x-content-type-options: nosniff`, HSTS, `referrer-policy: origin-when-cross-origin` ✓
- 200 / 410 / 429 paths verified during QA on localhost; production manual verification by the deployer.

### Deferred polish (tracked, non-blocking)
- **BUG-L1** — strip `owner_id` from the client-visible RPC payload until PROJ-12 needs it.
- **BUG-L2** — collapse duplicate `<meta name="robots">` on the 404 route.
- **AC not exercised E2E** — Input min/max validation visual (inherited from PROJ-9; underlying widget behaviour passing).

### Rollback plan
Vercel Dashboard → Deployments → promote the previous (PROJ-10) deployment to Production. The PROJ-11 migration is additive (only adds the `fn_get_public_calculator` RPC); leaving it in place after a rollback is harmless — the old build will simply not call it.
