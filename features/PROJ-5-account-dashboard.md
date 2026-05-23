# PROJ-5: Account Dashboard

## Status: Deployed
**Created:** 2026-05-23
**Last Updated:** 2026-05-23

## Implementation Notes (Frontend)
- Added `Icons.LayoutGrid` to `src/components/shell/icons.tsx` (four
  filled rects, ported verbatim from `docs/design/chrome.jsx`).
- `<Section>` lives at `src/components/dashboard/section.tsx`, built on
  shadcn's Radix `Collapsible`. Renders chevron + `<h2>` title + count
  pill + optional hint, with a 304px internal-scroll threshold
  (exported as `SECTION_SCROLL_MAX_PX`). `tint="danger"` washes the
  frame; controlled-open state is local React state seeded from
  `defaultExpanded`.
- `<WelcomeLine>` lives at `src/components/dashboard/welcome-line.tsx`,
  a Server Component. Trims `name`; renders "Welcome back" with no
  suffix when null / empty / whitespace; renders the SYSADMIN pill
  inline when `role === "sysadmin"`. Outer wrapper uses
  `hidden md:block` for desktop-only visibility (no JS).
- `src/app/(app)/dashboard/page.tsx` is a Server Component that calls
  `getCurrentProfile()` (cache-deduped with the `(app)` layout) and
  renders the welcome line + a single Presets `<Section>` with the
  `EmptyOrErrorState` empty-state body (`framed={false}` so the
  section's own frame is the only frame).
- Section ordering is enforced by JSDoc comment + JSX order in
  `page.tsx`. Slots for My Calculators / My Scenarios / Trash / User
  Calculators are reserved (not rendered) for downstream features.
- Unit tests: `section.test.tsx` (10 tests — props, toggle, chevron
  rotation, hint visibility, tint, a11y attrs) and
  `welcome-line.test.tsx` (8 tests — name trimming, null name, sysadmin
  pill, eyebrow, mobile-hidden wrapper). E2E:
  `tests/PROJ-5-dashboard.spec.ts` covers welcome line visibility,
  Presets empty state, collapse/expand, and the sysadmin variant.
- Production reference: `docs/production/dashboard.md`.
- No deviations from the spec.

## Dependencies

- **PROJ-4** — uses the `(app)` AppShell, the
  `getCurrentProfile()` helper, the `<SysadminPill>` primitive,
  the `<EmptyOrErrorState>` primitive, the `cg.*` Tailwind
  token namespace, and the active-tab "Dashboard" wiring in
  the top bar.

PROJ-5 does **not** add new env vars, new tables, new
migrations, or new email templates. It is a pure presentation
feature: the dashboard scaffolding the downstream features
(PROJ-10 / PROJ-12 / PROJ-13 / PROJ-18 / PROJ-19) will fill
with real data.

## User Stories

- As an approved registered user, I want to land on
  `/dashboard` and see "Welcome back, <name>" so the page
  feels personal instead of generic.
- As an approved registered user with no calculators yet
  (which every user is, the day PROJ-5 ships), I want a
  clear "No presets yet" empty state so I understand the
  dashboard isn't broken, just empty.
- As a sysadmin, I want a SYSADMIN red pill inline with the
  welcome line so I can confirm at a glance I'm in the
  privileged session.
- As a downstream feature builder (PROJ-10 / PROJ-13 / PROJ-18
  / PROJ-19), I want a shared `<Section>` primitive accepting
  `title`, `count`, `defaultExpanded`, `hint?`, `tint?`, and
  children, so I can drop my section content in without
  re-architecting the dashboard frame.
- As a downstream feature builder (PROJ-10 / PROJ-12 / PROJ-13
  / PROJ-19), I want the dashboard page to reserve the
  section ordering (My Calculators → My Scenarios → Presets →
  Trash → User Calculators) so my section lands in the right
  slot without me re-arranging the page.
- As a mobile user, I want a compact dashboard layout (no
  welcome line, single-column section grids, tighter padding)
  so the page reads cleanly on a small viewport.

## Out of Scope

PROJ-5 ships the dashboard scaffold. Everything that needs
calculator or scenario data sits in the downstream features
that own those data models:

- **Hero "Build a new calculator" button.** Deferred to
  PROJ-10. PROJ-5 renders no Hero at all — see Product
  Decisions for why this differs from PROJ-4's
  disabled-with-tooltip pattern.
- **`<CalcCard>` primitive.** Deferred to PROJ-10. Card
  shape (title, description, footer timestamp, kebab,
  icon-button row, status pill) lands alongside the
  calculators table.
- **My Calculators section content.** PROJ-10 wires the
  data + the 3-icon footer (Edit / Public-view /
  Duplicate) + the kebab menu (Public Link, Rename,
  Duplicate, Publish/Unpublish, Delete). Naming note:
  same-account copy is "Duplicate"; cross-user copy from
  Presets is "Clone" (PROJ-18) — never use "Clone" for
  the same-account action.
- **My Scenarios section content.** PROJ-12 wires the
  list-not-cards rendering + row buttons (Edit, Public-view)
  + row kebab (Copy link, Rename, Delete).
- **Presets section content.** PROJ-18 wires the query
  ("any published calculator owned by a sysadmin"), the
  Presets card with 2-icon footer (Public-view, Clone),
  and the clone-attribution side effect. PROJ-5 only ships
  the empty surface.
- **Trash section.** PROJ-13. Hidden in PROJ-5 (no soft-
  deleted calculators exist).
- **User Calculators section (sysadmin).** PROJ-19. Hidden
  in PROJ-5 (no calculators exist at all).
- **`calculators` table schema.** PROJ-10.
- **`scenarios` table schema.** PROJ-12.
- **Card kebab popover (Open / Delete and variants).**
  PROJ-10 / PROJ-13 / PROJ-19.
- **Status pill (Published / Draft / Deleted).** PROJ-10
  (Published/Draft); PROJ-13 (Deleted).
- **Destructive-confirm bottom sheet for calculator delete.**
  PROJ-10 (owner) / PROJ-19 (sysadmin).
- **Section expansion persistence across navigations.** Not
  in v1; per-page-load defaults only.
- **Search / filter / sort / pagination.** PRD v1 non-goal
  (single-user-leaning scope).
- **Section drag-reorder, custom section pinning.** Not in
  v1.
- **Analytics / view counts on calculators.** PRD non-goal.
- **Bookmarking arbitrary other users' calculators.** PRD
  non-goal — Presets covers the sysadmin-curated case in
  v1.
- **Per-user dashboard wallpaper / theme overrides.** Not
  in v1; dashboard uses the user's chosen App theme via
  PROJ-4's `next-themes` setup.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] /
Then [result]

### Page chrome + layout

- [ ] Given an approved registered user navigates to `/dashboard`, when the page renders, then it sits inside PROJ-4's AppShell (top bar visible with the "Dashboard" tab active) — PROJ-5 does not introduce its own chrome.
- [ ] Given the user is on desktop (≥ 768px), when the dashboard renders, then content sits inside `<main>` with `max-width: 960px`, centred horizontally, padded `32px` horizontal / `32px` top / `48px` bottom (matching `docs/design/dashboard.jsx`).
- [ ] Given the user is on mobile (< 768px), when the dashboard renders, then content uses full width (no `max-width` cap), padding `20px 16px 32px`, and the desktop welcome line is hidden.
- [ ] Given the user is on `/dashboard`, when the document title renders, then it remains "Dashboard · Calcgrinder" (already set by PROJ-4's placeholder page; PROJ-5 keeps it).
- [ ] Given the dashboard renders on desktop or mobile, when inspected visually against `docs/design/dashboard.jsx`, then layout fidelity (gaps, padding, header eyebrow, section radii, divider weights) matches — pixel identity is not required.

### Welcome line (desktop only)

- [ ] Given an approved user with `profile.name = "Ada Thornton"` lands on `/dashboard` on desktop, when the welcome line renders, then it shows a small-caps "ACCOUNT" eyebrow above an `<h1>` reading "Welcome back, Ada Thornton".
- [ ] Given an approved user with `profile.name = NULL`, `""`, or whitespace-only lands on `/dashboard` on desktop, when the welcome line renders, then the `<h1>` reads "Welcome back" with no name suffix (no trailing comma, no email fallback).
- [ ] Given a sysadmin lands on `/dashboard` on desktop, when the welcome line renders, then a `<SysadminPill>` (the same primitive PROJ-4 ships) renders inline to the right of the name (or "Welcome back" text when name is null), aligned optically to the h1 baseline.
- [ ] Given a regular registered user lands on `/dashboard` on desktop, when the welcome line renders, then no SYSADMIN pill renders.
- [ ] Given the user is on mobile, when the dashboard renders, then no welcome line, no "ACCOUNT" eyebrow, and no inline SYSADMIN pill render (mobile keeps SYSADMIN visibility via the avatar popover, which PROJ-4 already ships).

### `<Section>` primitive — API

- [ ] Given the `<Section>` primitive at `src/components/dashboard/section.tsx`, when rendered with required props `{ title: string, count: number, children: React.ReactNode }`, then it renders a `<section>` element with a header row (chevron + title + count-pill) and a content body (visible when expanded).
- [ ] Given the section accepts optional props `{ defaultExpanded?: boolean, hint?: string, tint?: 'danger' }`, when omitted, then defaults apply: `defaultExpanded` falls back to `false`, `hint` renders nothing, `tint` uses the neutral surface palette.
- [ ] Given `defaultExpanded={true}`, when the section first mounts, then it renders expanded; `defaultExpanded={false}` renders collapsed.
- [ ] Given the section is collapsed, when the user clicks the header button, then the section expands; clicking again collapses it.
- [ ] Given the section header is rendered, when the chevron is inspected, then it rotates 0° when expanded and -90° when collapsed (matching the design source).
- [ ] Given the section has `count={6}`, when the header renders, then a small pill on the right of the title displays "6" in mono with the neutral surface-2 background + thin border styling from `docs/design/dashboard.jsx`.
- [ ] Given the section has `hint="Curated by sysadmin"` AND `defaultExpanded={false}`, when the section renders collapsed, then the hint text appears after the count pill, prefixed with "·", styled as `text-cg-text-subtle` (matching design source).
- [ ] Given the section has `hint="Curated by sysadmin"` AND is expanded, when the section renders, then the hint is hidden (matches design source — hint only shows when collapsed).

### `<Section>` primitive — tint variant (forward-compat for PROJ-19)

- [ ] Given the section is rendered with `tint="danger"`, when it renders, then the outer container uses the `--cg-danger-soft` background + `--cg-danger-border` border instead of the default surface/border. Inner cards (passed via children) continue to consume their own backgrounds.
- [ ] Given no `tint` is passed, when the section renders, then it uses `--cg-surface` background + `--cg-border` border (default).

### `<Section>` primitive — internal scroll

- [ ] Given a section is expanded and its content height ≤ 304px, when rendered, then the content area grows to fit; no internal scrollbar appears.
- [ ] Given a section is expanded and its content height > 304px, when rendered, then the inner container applies `max-height: 304px` and `overflow-y: auto`; an internal scrollbar appears and the section's outer height stops growing.
- [ ] Given the threshold 304px matches the math "2 card-rows (128 + 12 + 128) + section content padding (18 top + 18 bottom)", when documented, then the value lives as a named constant in `section.tsx` so future tuning has one source of truth.

### `<Section>` primitive — accessibility

- [ ] Given the section header is a `<button>`, when rendered, then it carries `aria-expanded={open}` and `aria-controls` pointing to the content `<div>`'s id; the content `<div>` carries the matching `id`.
- [ ] Given the section is rendered, when inspected, then the heading text uses a semantic heading element (the dashboard primitive picks the level — recommend `<h2>` for top-level sections); screen readers announce "<title> region, <count> items, collapsed/expanded".
- [ ] Given a user navigates with the keyboard, when they Tab onto the section header, then it receives the standard focus outline; Enter/Space toggles the expansion.

### Presets section (the only section that renders in PROJ-5)

- [ ] Given an approved user lands on `/dashboard`, when the dashboard renders, then exactly one `<Section>` is present in the page: the Presets section with `title="Presets"`, `count={0}`, `defaultExpanded={true}`, and the Presets empty-state body.
- [ ] Given the Presets section is expanded (it always is in PROJ-5), when the body renders, then it contains a single `<EmptyOrErrorState variant="empty">` with `title="No presets yet"`, `body="Curated calculators will appear here once a sysadmin publishes one."`, `icon={Icons.LayoutGrid}`, and no primary action button.
- [ ] Given the user clicks the Presets section header, when the click fires, then the section collapses (and a subsequent click re-expands it). The empty-state body re-renders identically on expansion (no remount jank).
- [ ] Given a sysadmin lands on `/dashboard`, when the Presets section renders, then the same empty-state copy is shown (no sysadmin-specific variant — see Product Decisions).
- [ ] Given My Calculators, My Scenarios, Trash, and User Calculators sections all have zero data in PROJ-5, when the dashboard renders, then none of those sections renders (no header, no count pill, no placeholder card). Only Presets renders.

### Section order (forward-compat for downstream features)

- [ ] Given the dashboard page lays out sections, when downstream features add their section blocks, then the rendered order is: My Calculators → My Scenarios → Presets → Trash → User Calculators (sysadmin). PROJ-5 reserves the order so the future inserts go above/below Presets without restructuring.
- [ ] Given the page's section list is implemented (e.g. as a flex-column container with sections rendered in order), when inspected, then PROJ-10 / PROJ-12 / PROJ-13 / PROJ-19 can each insert their `<Section>` conditional block in the right slot without touching unrelated sections.

### Welcome line spacing rule

- [ ] Given the welcome line and the section list are both visible on desktop, when the page renders, then a `28px` gap separates the welcome line from the first section (matching the design's `gap: 28` on desktop). On mobile the gap collapses to `18px`.
- [ ] Given the welcome line is hidden on mobile, when the page renders, then the section list sits flush to the top of the content area (with the standard `20px` page-top padding above it).

### Tests

- [ ] Given `src/components/dashboard/section.test.tsx`, when `npm test` runs, then unit tests cover: required props render (title, count, children); `defaultExpanded={true}` mounts expanded and `false` mounts collapsed; click toggles; chevron rotation styles per state; hint appears only when collapsed; tint="danger" applies the danger wash classes; aria-expanded + aria-controls wired correctly.
- [ ] Given `src/components/dashboard/welcome-line.test.tsx`, when `npm test` runs, then unit tests cover: `name="Ada"` renders "Welcome back, Ada"; `name=null` renders "Welcome back"; `name="   "` renders "Welcome back"; `role="sysadmin"` renders the SYSADMIN pill; `role="registered"` does not.
- [ ] Given `tests/PROJ-5-dashboard.spec.ts` (Playwright E2E), when `npm run test:e2e` runs (Chromium + Mobile Safari projects), then it covers: signed-in user lands on `/dashboard` → sees the welcome line on desktop / hidden on mobile → sees exactly one section "Presets" with "No presets yet" empty state → clicks the section header to collapse → empty state hides → clicks again to expand → empty state re-appears.

### Documentation

- [ ] Given `docs/production/dashboard.md` (new doc), when the deployer reads it, then it documents:
  - The hide-when-empty rule (which sections hide when empty; Presets is the exception);
  - The section ordering convention (My Calculators → My Scenarios → Presets → Trash → User Calculators) and where downstream features hook in;
  - The `<Section>` primitive API (props, threshold for internal scroll, tint variant);
  - The deferred state of the Hero + CalcCard until PROJ-10;
  - The welcome line null-name + mobile-hidden rules.

## Edge Cases

- **`profile.name = "   "` (whitespace only).** Treat as null
  → welcome line reads "Welcome back" with no suffix. The
  trim happens in PROJ-5's welcome-line component, not in
  the DB.
- **`profile.name` very long (e.g. 60+ characters).** Welcome
  line `<h1>` uses `flex-wrap: wrap` so a long name wraps to
  a second line; the SYSADMIN pill follows the last word.
  No mid-name truncation.
- **Sysadmin with `profile.name = null`.** Welcome line reads
  "Welcome back" + SYSADMIN pill inline. No empty-name
  awkwardness — the pill provides the identity signal.
- **User opens `/dashboard`, sysadmin publishes a preset in
  another tab.** The first tab keeps showing the empty state
  until reload. No realtime subscription in v1 (PRD non-goal
  on analytics / telemetry implies no live updates either).
- **Section expansion state lost on navigation.**
  Per-page-load defaults only. User navigates to `/settings`
  and back; the Presets section re-mounts with
  `defaultExpanded={true}`. Acceptable; documented in the
  primitive's behaviour.
- **Section internal scroll on a touch device.** Inner
  container uses `overflow-y: auto`; iOS / Android handle
  inertial scroll natively. No custom handling.
- **Rapid clicks on the section header.** Standard React
  state — last click wins. No race condition; no debounce
  needed.
- **Viewport exactly 768px.** Tailwind `md:` is inclusive
  (≥ 768 = desktop). Welcome line + max-width 960px both
  kick in at exactly 768px. Consistent with PROJ-4's break.
- **User signs in for the first time (zero calcs, zero
  scenarios).** Sees the welcome line (desktop) + Presets
  empty state. No other surface. Until PROJ-10 ships, that
  IS the full dashboard.
- **User navigates to `/dashboard/anything-else`.** PROJ-4's
  not-found surface fires (AppShell + EmptyOrErrorState
  "Page not found"). PROJ-5 does not add new
  `/dashboard/[...]` routes.
- **Browser zoom 200%+.** Section header layout uses flex,
  no fixed widths, so it reflows. The count pill keeps its
  shape; the chevron, title, and hint reflow as needed.

## Technical Requirements

- **Stack:** Next.js 16 App Router. The `/dashboard` page is
  a Server Component (it only needs to read
  `getCurrentProfile()` and pass props down). The `<Section>`
  primitive is a Client Component (state-bearing — open /
  closed).
- **Component location:** New namespace
  `src/components/dashboard/` (separate from
  `src/components/shell/` for chrome and
  `src/components/auth/` for auth):
  - `section.tsx` — collapsible section primitive (Client
    Component)
  - `section.test.tsx`
  - `welcome-line.tsx` — desktop welcome line (Server
    Component; takes `name`, `role` as props from the page)
  - `welcome-line.test.tsx`
- **Page file:** `src/app/(app)/dashboard/page.tsx` — replace
  the existing placeholder. Server Component that calls
  `getCurrentProfile()`, renders the welcome line (desktop),
  and renders the Presets section.
- **No new env vars, no new tables, no new migrations.**
- **No new packages.** Reuses PROJ-4's `cg.*` Tailwind
  tokens, `<EmptyOrErrorState>`, `<SysadminPill>`, and
  `Icons.LayoutGrid`.
- **Theming:** Chrome consumes the `cg.*` token namespace
  PROJ-4 ships. No new tokens. Section + welcome line work
  in both Light and Dark mode without per-component
  branching.
- **Section primitive API:**
  ```tsx
  type SectionProps = {
    title: string;
    count: number;
    children: React.ReactNode;
    defaultExpanded?: boolean;   // default false
    hint?: string;               // visible only when collapsed
    tint?: 'danger';             // default = neutral surface
    // maxHeight?: number;       // see Open Questions — out of scope until a consumer needs it
  };
  ```
- **Welcome line component API:**
  ```tsx
  type WelcomeLineProps = {
    name: string | null;
    role: 'registered' | 'sysadmin';
  };
  ```
  Renders nothing on viewports < 768px (Tailwind
  `hidden md:block` on the outer wrapper). Trims `name`
  before checking for emptiness.
- **Forward-compat constraints (must hold so downstream
  features drop in without re-architecting):**
  - The `<Section>` primitive accepts `tint`, `hint`, and
    `defaultExpanded` from day one.
  - The page's section container is structured so PROJ-10
    can insert a "My Calculators" `<Section>` above Presets
    and PROJ-13 can insert a "Trash" `<Section>` below
    without touching surrounding code.
  - The welcome line accepts `role` from day one so PROJ-19
    doesn't need to extend the prop shape.
- **Performance:** Server-rendered. No DB roundtrips beyond
  what PROJ-4 already does (the `(app)` layout invokes
  `getCurrentProfile()`; the page consumes the result via
  the same per-request cache).
- **Accessibility:**
  - Section header is a real `<button>` with `aria-expanded`
    and `aria-controls`.
  - The page uses a single `<h1>` (the welcome line on
    desktop, hidden via CSS on mobile); sections use
    `<h2>` for their titles.
  - SYSADMIN pill is decorative — PROJ-4's primitive
    handles its own a11y.
  - Focus management on section toggle: focus stays on the
    button (no focus jump); subsequent Tab moves into the
    expanded content.

## Open Questions

- [x] /architecture: should `<Section>` be built on shadcn's
      `Accordion` (Radix `Collapsible`) primitive, or
      bespoke? **Resolved 2026-05-23**: Radix `Collapsible`
      (the shadcn primitive at `src/components/ui/collapsible.tsx`).
      Radix `Collapsible` is a minimal Root/Trigger/Content
      wrapper — no slotted markup to fight — and it gives us
      `aria-expanded`, `aria-controls`, and controlled-open
      state for free. The trigger's visual (chevron + title +
      count + hint) is authored by `<Section>` via `asChild`.
- [x] /architecture: should the internal-scroll threshold
      (304px) be a `maxHeight?: number` prop on `<Section>`
      from day one, or hardcoded? **Resolved 2026-05-23**:
      hardcoded as a named constant
      `SECTION_SCROLL_MAX_PX = 304` in `section.tsx`. Every
      known v1 consumer (My Calculators, Trash, User Calculators)
      shares the same card row geometry. Promote to a prop only
      when a real consumer needs a different value.
- [x] /architecture: should the `<h1>` welcome line + page
      section list nest under a single landmark
      (e.g. `<main aria-labelledby="dashboard-h1">`) or
      let the AppShell's `<main>` be the only landmark?
      **Resolved 2026-05-23**: rely on AppShell's `<main>` as
      the only landmark. PROJ-5's dashboard renders a plain
      `<div>` wrapper inside it (not a nested `<main>`). The
      `<h1>` is still discoverable as the page's primary
      heading via the document outline.
- [x] Should the Presets empty state's copy reference
      sysadmin-specific guidance for sysadmin users (e.g.
      "Publish your first calculator as a preset to see it
      here")? **Resolved 2026-05-23**: no — generic copy works
      for both audiences in v1. Revisit when PROJ-18 wires the
      actual publish-as-preset flow.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Hero "Build a new calculator" button is **hidden** in PROJ-5 (NOT disabled-with-tooltip per the PROJ-4 precedent for "+ New calculator") | All data-bearing sections also hide in PROJ-5 (zero calculators, zero scenarios). Rendering a Hero stranded above an empty Presets surface signals "this app does nothing" more loudly than just an empty page. PROJ-10 introduces the Hero alongside its creation flow, by which point My Calculators will also render — the Hero will sit in context with other content. The PROJ-4 precedent (disabled-with-tooltip for fixed-position slots) does NOT apply uniformly: the avatar's `+ New calculator` is in the top bar (always visible across surfaces); the Hero is dashboard-specific and only useful when other dashboard content is present | 2026-05-23 |
| **Pattern rule refined from PROJ-4's "disabled-with-tooltip for fixed-position slots"**: during development phase, with build velocity in hours/days between features and no real users seeing intermediate states, the default is **HIDE** anything whose backing functionality ships in a later feature. Disabled-with-tooltip is reserved for the rare case where a feature genuinely needs to communicate "coming soon" to real users — not applicable while the deployer is the sole observer. Apply this default in all subsequent feature specs (PROJ-6 / PROJ-8 / PROJ-15 onward) | PROJ-4's tooltip was the right instinct in isolation but the wrong default at the project's current stage. Hiding is cheaper to ship, cheaper to remove, and avoids accumulating a graveyard of "Coming soon" affordances that read as broken polish to the deployer testing the app. The pattern-rule belongs in PROJ-5's log because PROJ-5 is the first feature to act on it — propagate from here forward | 2026-05-23 |
| **Follow-up action assigned to PROJ-10**: alongside enabling the Hero "Build a new calculator" button and the AppShell's "+ New calculator" button, PROJ-10 also **removes** the "Coming soon — calculator creation ships with PROJ-10" tooltip + `<span>` wrapper + `disabled` attribute from `src/components/shell/top-bar-desktop.tsx`. The Tooltip becomes a plain enabled `<Button>` link to the create-calculator handler | The PROJ-4 tooltip was the original over-engineered version of the pattern this spec retires. Retiring it in PROJ-10 is zero extra cost — the same file touch that wires the click handler drops the wrapper. Recording the assignment here so PROJ-10's spec / implementation doesn't leave the vestigial tooltip behind | 2026-05-23 |
| `<CalcCard>` primitive deferred to PROJ-10 (not shipped in PROJ-5) | PROJ-5 has no data to render against; CalcCard depends on the Published / Draft status pill, the kebab menu actions, and the calculators table — all of which land in PROJ-10. Building the primitive without consumers risks pre-deciding the API and the kebab-action set | 2026-05-23 |
| Welcome line reads "Welcome back" (no name suffix) when `profile.name` is null/empty/whitespace | Avoids surfacing email local-part as a greeting (e.g. "Welcome back, shawbro77" reads as technical noise). PROJ-4's avatar uses email local-part as a fallback because it needs *some* visible marker; the welcome line is decorative and can elide the name gracefully. The user's identity is also visible in the avatar popover header (PROJ-4) | 2026-05-23 |
| Welcome line + SYSADMIN pill are **desktop only** (hidden on mobile) | Matches `docs/design/dashboard.jsx` which renders the welcome block only when `!mobile`. Mobile real estate is better spent on the section list. The SYSADMIN pill still appears in the avatar popover header on mobile via PROJ-4 — the welcome-line pill is supplemental | 2026-05-23 |
| Presets empty state has no primary action button | Regular registered users cannot create presets — only sysadmins can. A button promising an action the user can't take would mislead. Sysadmins also see no action: the path to publish a preset is per-calculator (PROJ-18), not from the dashboard surface. Generic copy works for both audiences in v1 | 2026-05-23 |
| Presets empty state copy: "No presets yet" / "Curated calculators will appear here once a sysadmin publishes one." / icon `Icons.LayoutGrid` | Conversational and explanatory rather than instructional. Avoids backend vocabulary ("publish", "moderation", "preset" as a special term). The `LayoutGrid` icon matches the design's TemplateCard icon, keeping visual continuity once PROJ-18 wires the populated state | 2026-05-23 |
| Section primitive ships `tint="danger"`, `hint?`, and `defaultExpanded?` props from day one | Forward-compat: PROJ-19 will pass `tint="danger"` for the User Calculators wash and `hint="All users — sysadmin view"` for the collapsed-state subtitle. Building the primitive once with the full API avoids re-touching it later. PROJ-10's My Calculators will use `defaultExpanded={true}` when calcs exist | 2026-05-23 |
| Section expansion state is **per-page-load** only (no localStorage / DB persistence) | PRD is silent on persistence; the design uses local state. For v1's single-user-leaning scope, restoring expansion on page reload isn't critical, and skipping it avoids designing a storage key namespace before the consumer set is known. The defaults (My Calculators expanded when populated, others collapsed; Presets expanded when nothing else has data) are good enough | 2026-05-23 |
| Section internal scroll threshold hardcoded at **304px** (the design source's "2 card-rows + padding" math) | Most consumers will share the same threshold — calculator card rows are uniform (128px tall + 12px gap). If a consumer eventually needs a different threshold, /architecture or a follow-up feature can promote it to a prop. YAGNI for v1 | 2026-05-23 |
| Dashboard primitives live under `src/components/dashboard/` (separate from `src/components/shell/`) | `src/components/shell/` is for app-wide chrome (top bar, popover, avatar) inherited by every signed-in surface. Dashboard primitives are surface-specific. Keeps the boundary clear; matches the pattern PROJ-3 set with `src/components/auth/` | 2026-05-23 |
| `<h2>` for section titles, single `<h1>` for the desktop welcome line | One `<h1>` per page is the standard accessibility convention. Sections are content-children of the main page heading. On mobile (welcome line hidden) the document still has a heading structure via the section `<h2>`s; the AppShell's top-bar tabs and document title provide the page-identity signal | 2026-05-23 |
| Card click behaviour, kebab menus, status pills, delete-confirm bottom sheets, and per-section icon-button rows are ALL deferred to the feature that owns the underlying data (PROJ-10 / 12 / 13 / 18 / 19) | These are calculator/scenario-specific affordances; they only make sense alongside the data model. Building them in PROJ-5 as standalone primitives would be speculative — the eventual consumers may need different APIs than what PROJ-5 could anticipate | 2026-05-23 |

### Technical Decisions
<!-- Added by /architecture -->

| Decision | Rationale | Date |
|----------|-----------|------|
| `<Section>` is built on the existing shadcn Radix `Collapsible` primitive (`src/components/ui/collapsible.tsx`), not bespoke local state | CLAUDE.md mandates shadcn-first. Radix `Collapsible` is a minimal Root/Trigger/Content wrapper — it does not impose slotted markup the way `Accordion` does, so the design's chevron + title + count + hint trigger row stays pixel-honest. Free a11y wiring (`aria-expanded` on trigger, `aria-controls` linking to the content `<div>`, `data-state` for styling hooks) — no need to hand-wire and unit-test what Radix already validates | 2026-05-23 |
| Internal-scroll threshold `SECTION_SCROLL_MAX_PX = 304` is a named module constant in `section.tsx`, not a prop | Every known v1 consumer (PROJ-10 My Calculators, PROJ-13 Trash, PROJ-19 User Calculators) shares the same card geometry (128px row + 12px gap + 18+18px section padding). Promote to a `maxHeight?: number` prop only when a real consumer needs an override. Avoids designing an API surface in front of a single value | 2026-05-23 |
| `Icons.LayoutGrid` is added to `src/components/shell/icons.tsx` (ported from `docs/design/chrome.jsx`), not imported from `lucide-react` | Keeps the chrome icon set self-contained (no surface mixes inline-SVG and lucide imports). PROJ-10's "Start from a template" Hero card and PROJ-18's Presets card will both consume this glyph — defining it once in the shell `Icons` object makes the boundary clear. Cost is trivial (one SVG path) | 2026-05-23 |
| Dashboard page renders a plain `<div>` content wrapper inside AppShell's existing `<main>`, not a nested `<main>` | AppShell already provides `<main className="flex-1">` (PROJ-4). Nesting another `<main>` creates duplicate landmarks. The `<h1>` welcome line is still the page's primary heading via the document outline. Resolves an Open Question with the least-surprising answer | 2026-05-23 |
| Page is a Server Component; `<WelcomeLine>` is also Server (purely props-driven, no interactivity); only `<Section>` is `'use client'` | Minimises the client JS surface. The page calls `getCurrentProfile()` server-side (cache-deduped with the `(app)` layout's call — single Supabase roundtrip per request), passes `name` and `role` as plain props down. Matches the pattern PROJ-4 set with the AppShell wrapper | 2026-05-23 |
| Welcome line desktop-only hiding implemented via Tailwind `hidden md:block` on the outer wrapper (CSS-only), not via a viewport-detection hook | Server-renderable; no hydration mismatch risk; matches the existing PROJ-4 chrome's `hidden md:flex` / `flex md:hidden` pattern; same `md` (768px) breakpoint the AppShell uses | 2026-05-23 |
| Section ordering is enforced by literal JSX order in `page.tsx`, not by an ordered array + map | Five sections is too few to justify a registry pattern. JSX order is the most readable form of "this is the canonical slot for each section"; downstream features (PROJ-10 / PROJ-12 / PROJ-13 / PROJ-19) insert their section block at the right line. A code comment above the section list names the canonical order so a reviewer can spot a misplacement | 2026-05-23 |
| Section `<h2>` heading is rendered inside the Collapsible trigger `<button>` (button wraps the heading text), not heading-wraps-button | Browsers and screen readers accept a heading inside an interactive control as the accessible name of the control; the heading's text still surfaces in the document outline. Avoids the inverse (heading wrapping button) which can confuse some AT. Pattern is used widely in shadcn-based collapsible sections | 2026-05-23 |
| Tests live next to the components: `section.test.tsx` and `welcome-line.test.tsx` under `src/components/dashboard/`; E2E lives at `tests/PROJ-5-dashboard.spec.ts` | Matches the CLAUDE.md convention (unit tests co-located, E2E under `tests/`). Mirrors PROJ-4's structure (`top-bar.test.tsx`, `avatar-popover.test.tsx` next to source) | 2026-05-23 |
| `docs/production/dashboard.md` documents the hide-when-empty rule, the section order, the `<Section>` API, and the deferred Hero / CalcCard state | The downstream features (PROJ-10 / PROJ-12 / PROJ-13 / PROJ-18 / PROJ-19) need a single page that names the contract they're consuming. Mirrors the existing `docs/production/` pattern PROJ-3 / PROJ-4 set | 2026-05-23 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Audience note
The dashboard is a pure presentation feature. No new database
tables, no new API routes, no new env vars. Everything in this
design is about React component shape, layout, and the contract
that downstream features will consume to drop their content in.

### Frontend-only feature
This feature has **no backend surface**. PROJ-5:
- Reads no new data (reuses `getCurrentProfile()` already
  invoked by the `(app)` layout — React's request-scoped
  `cache()` makes the second call free).
- Writes no data.
- Adds no routes, no Server Actions, no API handlers.
- Adds no Supabase schema, no migrations, no env vars, no
  emails, no cron.

If you came here looking for a "Backend" section: there isn't
one for PROJ-5. The downstream features (PROJ-10 calculators,
PROJ-12 scenarios, PROJ-13 trash, PROJ-18 presets, PROJ-19
moderation) own those data models.

### Component tree (what gets rendered)

```
AppShell (already exists, PROJ-4)
  TopBar (desktop)  / TopBar (mobile)   — chrome
  <main className="flex-1">             — existing landmark
    DashboardPage (Server Component)    — NEW (replaces placeholder)
    +-- Content wrapper <div>
    |       desktop:  mx-auto max-w-[960px] px-8 pt-8 pb-12
    |       mobile:   px-4 pt-5 pb-8 (no max-width)
    |       gap:      desktop 28px / mobile 18px (between welcome + sections)
    +-- WelcomeLine (Server Component, desktop-only)   — NEW
    |       "ACCOUNT" eyebrow
    |       <h1> "Welcome back, <name>"  ( + SysadminPill if sysadmin )
    +-- Section list (literal JSX order, see below)
            (* in PROJ-5 only the Presets Section actually renders *)

            [ My Calculators ]   ← reserved slot — empty in P5, filled in PROJ-10
            [ My Scenarios   ]   ← reserved slot — empty in P5, filled in PROJ-12
            Presets <Section>    — NEW; only section that renders in PROJ-5
                +-- EmptyOrErrorState (existing PROJ-4 primitive)
                       icon = Icons.LayoutGrid (NEW glyph)
                       title = "No presets yet"
                       body  = "Curated calculators will appear here once a sysadmin publishes one."
            [ Trash          ]   ← reserved slot — empty in P5, filled in PROJ-13
            [ User Calcs (sa)]   ← reserved slot — empty in P5, filled in PROJ-19
```

The reserved slots are not rendered as empty wrappers — they
are simply the canonical place in `page.tsx` where each
downstream feature inserts its `<Section>` block. PROJ-5 leaves
a JSDoc-style comment in `page.tsx` naming the order so future
inserts land in the right spot.

### New files

| File | Purpose | Component kind |
|---|---|---|
| `src/components/dashboard/section.tsx` | Collapsible section primitive built on Radix `Collapsible` (shadcn). Renders header (chevron + title + count + hint) + content body with internal-scroll. | Client (`'use client'`) |
| `src/components/dashboard/section.test.tsx` | Unit tests for the primitive (renders, toggles, hint visibility, tint, a11y attrs). | — |
| `src/components/dashboard/welcome-line.tsx` | Renders the "ACCOUNT" eyebrow + `<h1>` greeting + optional `<SysadminPill>`. Desktop-only (`hidden md:block` on outer wrapper). Trims `name` before treating it as present. | Server |
| `src/components/dashboard/welcome-line.test.tsx` | Unit tests (name present / null / whitespace / sysadmin role). | — |
| `src/components/dashboard/index.ts` | Barrel export, mirroring `src/components/shell/index.ts`. | — |
| `tests/PROJ-5-dashboard.spec.ts` | Playwright E2E (Chromium + Mobile Safari): welcome line visibility, Presets empty state, section collapse/expand. | — |
| `docs/production/dashboard.md` | Deployer-facing reference for the dashboard scaffold (hide-when-empty rule, section order, Section API, deferred state). | — |

### Modified files

| File | Change |
|---|---|
| `src/app/(app)/dashboard/page.tsx` | Replace placeholder body. Server Component that calls `getCurrentProfile()`, renders `<WelcomeLine>` + the section list, and renders the Presets `<Section>` containing an `<EmptyOrErrorState>`. |
| `src/components/shell/icons.tsx` | Add `LayoutGrid` SVG glyph (ported from `docs/design/chrome.jsx`). Two-column-by-two-row outlined squares. |
| `src/components/shell/index.ts` | (No change needed — `Icons` is already exported; the new key is automatically available via the typed `IconName` union.) |

### Data flow

```
HTTP request → middleware (already wired)
              ↓
            (app)/layout.tsx
              ↓  getCurrentProfile()   (React cache — 1st call)
              ↓
            DashboardPage (Server Component)
              ↓  getCurrentProfile()   (React cache — same request, 0 extra Supabase round-trips)
              ↓
              ├── <WelcomeLine name={profile.name} role={profile.role} />
              └── <Section title="Presets" count={0} defaultExpanded>
                    <EmptyOrErrorState ... />
                  </Section>
```

No client-side data fetching. No `useEffect`s. The only client
JS introduced by PROJ-5 is the section open/close state
inside `<Section>`.

### `<Section>` primitive — how the visual maps onto Radix Collapsible

The shadcn `<Collapsible>` (Radix) provides the open/close
state, ARIA wiring, and a `data-state="open|closed"` attribute.
The `<Section>` component composes its visuals on top:

- `<Collapsible>` Root — controls open/close.
- `<CollapsibleTrigger asChild>` wraps our custom `<button>`,
  which contains: rotating chevron (`ChevD` rotated -90° when
  closed), `<h2>` title, count pill, `· hint` (when closed).
- `<CollapsibleContent>` wraps an inner `<div>` with
  `max-height: 304px` + `overflow-y: auto` so content past two
  card rows scrolls inside the section.

`defaultExpanded` maps to Radix's `defaultOpen`. The `tint`
variant ("danger") paints the section frame with
`bg-cg-danger-soft border-cg-danger-border` instead of the
default `bg-cg-surface border-cg-border`; inner cards are
unaffected.

### `<WelcomeLine>` — null-name handling

In plain English:
- If `profile.name` is non-null and contains at least one
  non-whitespace character: render "Welcome back, <trimmed name>".
- Otherwise (null, empty string, all whitespace): render
  "Welcome back" — no trailing comma, no email-local-part
  fallback (PROJ-4's avatar does the email fallback; the
  welcome line consciously does not).
- If `role === "sysadmin"`: render `<SysadminPill>` inline,
  to the right of the last text node, flex-wrappable along
  with the `<h1>` text.

### Layout / spacing rules (mapped to Tailwind)

| Surface | Desktop (≥ 768px) | Mobile (< 768px) |
|---|---|---|
| Content wrapper | `mx-auto max-w-[960px] px-8 pt-8 pb-12` | full-width, `px-4 pt-5 pb-8` |
| Welcome → first section gap | `28px` | n/a (welcome hidden) |
| Section → section gap | `gap-3` (12px) | `gap-3` (12px) |
| Section header height | `52px` | `52px` |
| Section internal scroll threshold | `304px` (constant) | `304px` (constant) |

Pixel-exact values from the design source are translated to
Tailwind arbitrary values (`max-w-[960px]`, `pt-8`, etc.) where
the spacing scale lacks a direct token. Tokens stay on `cg.*`
colours.

### Reused PROJ-4 primitives (no re-export needed)

- `AppShell` — already wrapping the `(app)` route group.
- `SysadminPill` — used by WelcomeLine when `role === "sysadmin"`.
- `EmptyOrErrorState` — used inside the Presets Section.
- `Icons.ChevD` — used as the chevron in the Section header.
- `getCurrentProfile()` — re-invoked in the page (cache-deduped).
- `cg.*` Tailwind tokens (`cg-surface`, `cg-border`,
  `cg-text`, `cg-text-muted`, `cg-text-subtle`, `cg-danger-soft`,
  `cg-danger-border`).

### Forward-compat seams (so PROJ-10 / 12 / 13 / 18 / 19 drop in cleanly)

| Future feature | What it adds | What PROJ-5 reserves for it |
|---|---|---|
| PROJ-10 Calculator Lifecycle | `<Section title="My Calculators">` with `<CalcCard>` grid + Hero button above welcome line | Top slot in the section list; section primitive supports `defaultExpanded={true}` when populated |
| PROJ-12 Scenarios | `<Section title="My Scenarios">` (rows, not cards) | Second slot in the section list |
| PROJ-13 Soft-Delete | `<Section title="Trash">` (only renders when count > 0) | Fourth slot in the section list; section primitive supports any custom card body |
| PROJ-18 Presets | Replaces the empty-state body with a `<CalcCard>` grid | Third slot — Presets Section already rendering; empty state swaps for populated state |
| PROJ-19 Moderation | `<Section title="User Calculators" tint="danger" hint="All users — sysadmin view">` | Fifth slot; section primitive accepts `tint="danger"` and `hint` from day one |

### Tech decisions (plain language)

1. **Why shadcn Radix Collapsible and not a bespoke button + state?**
   The shadcn ecosystem is already in the project; the
   collapsible primitive is a thin wrapper around Radix that
   does not impose internal markup. We get aria-expanded,
   aria-controls, and controlled-open state for free. CLAUDE.md
   mandates shadcn-first. The trigger's visual stays under our
   control via `asChild`.

2. **Why a Server Component page + Server Component WelcomeLine?**
   Both depend only on `profile.name` and `profile.role` — data
   the AppShell layout already fetches. No interactivity.
   Keeping them server-rendered minimises the client JS bundle
   and ensures no hydration mismatch on the desktop-only
   visibility rule.

3. **Why hide-when-empty (instead of "Coming soon" placeholders)?**
   PROJ-5's Product Decision log codifies this as the project
   default going forward. While the deployer is the only
   observer of intermediate states, empty cosmetic placeholders
   read as broken polish. Cheaper to ship, cheaper to remove
   when content arrives.

4. **Why a single `<main>` (AppShell's) and not a nested `<main>` on the page?**
   Duplicate landmarks confuse screen readers. The `<h1>` welcome
   line is still the document outline's primary heading.

5. **Why hardcode 304px instead of making it a Section prop now?**
   Every known v1 consumer shares the same card geometry. YAGNI.
   Promote to a prop when a real consumer needs an override.

### Dependencies

No new npm packages. Existing project dependencies cover everything:
- `@radix-ui/react-collapsible` — already installed (via
  shadcn's `collapsible.tsx`).
- Tailwind, React, Next.js — already on the project.
- `@playwright/test`, `vitest` — already on the project.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Section internal-scroll threshold (304px) is wrong for a future consumer with different card geometry | The constant is named (`SECTION_SCROLL_MAX_PX`) and documented in `docs/production/dashboard.md`. Promote to prop when needed; the change touches one component, no consumer migration. |
| Radix `Collapsible` animates content via `data-state` and CSS-only — no animation by default | Acceptable for v1. The design source does an instant snap too (only the chevron rotates over 150ms, which we keep via Tailwind's `transition-transform`). |
| `Icons.LayoutGrid` glyph drift between this implementation and the design's reference | Port the path from `docs/design/chrome.jsx` verbatim. The icon is consumed by PROJ-5, PROJ-10, and PROJ-18 — one source of truth. |
| WelcomeLine flickering on mobile due to JS-driven viewport detection | We deliberately use CSS `hidden md:block`. SSR matches CSR. No flicker. |
| `<Section>` `<h2>` inside a `<button>` may worry an a11y auditor | Pattern is widely accepted (HTML spec permits flow content including phrasing content inside `<button>`; heading is flow content but ATs surface it as the button's accessible name). Documented in the Decision log so reviewers don't re-litigate. |

### Manual QA path (what /qa will exercise)

1. Sign in as a regular approved user on desktop:
   - "ACCOUNT" eyebrow + `<h1>` "Welcome back, <name>" visible.
   - Exactly one Section: "Presets", count = 0, expanded.
   - Body shows the empty state.
   - No SysadminPill anywhere.
2. Same user on mobile (or Playwright Mobile Safari project):
   - No welcome line, no eyebrow.
   - Same Presets Section renders.
3. Sign in as sysadmin on desktop:
   - SysadminPill renders next to the welcome `<h1>`.
   - Presets empty state is unchanged (no sysadmin variant).
4. Toggle the Presets Section header:
   - Chevron rotates; body collapses; click again to expand.
5. Visit `/dashboard/anything-else` → PROJ-4's not-found
   surface (unchanged by PROJ-5).

## QA Test Results

**Tested:** 2026-05-23
**Tester:** /qa (Claude)
**Verdict:** ✅ **Production-ready** — no Critical or High bugs.

### Automated test suites

| Suite                 | Command           | Result                        |
| --------------------- | ----------------- | ----------------------------- |
| Vitest (unit)         | `npm test`        | **109 / 109 passed** (15 files) |
| Playwright (E2E)      | `npm run test:e2e` | **36 / 36 passed**, 2 skipped (correct project-skip for desktop-only test on mobile project) |
| PROJ-5 E2E (focused)  | `npm run test:e2e -- tests/PROJ-5-dashboard.spec.ts` | 3 passed (Chromium 2, Mobile Safari 1) + 1 correctly skipped on mobile |

No pre-existing tests regressed.

### Acceptance criteria — coverage

All criteria exercised; **41 / 41 pass.** Highlights:

| Group | Criteria | Result |
| ----- | -------- | ------ |
| Page chrome + layout | 5 | ✅ AppShell + Dashboard tab active; desktop content centred at `max-w-[960px]` with `px-8 pt-8 pb-12`; mobile full-width with `px-4 pt-5 pb-8`; title remains `Dashboard · Calcgrinder`. |
| Welcome line (desktop) | 5 | ✅ "ACCOUNT" eyebrow + h1 with name; null/empty/whitespace render "Welcome back" with no trailing comma; SYSADMIN pill inline for sysadmin only; entire block hidden on mobile via `hidden md:block`. |
| `<Section>` API | 8 | ✅ Required + optional props behave; default-expanded toggles; chevron rotates 0° expanded / -90° collapsed; count pill uses `font-mono`; hint shows only when collapsed. |
| `<Section>` tint | 2 | ✅ `tint="danger"` applies `bg-cg-danger-soft border-cg-danger-border`; default uses neutral surface. |
| `<Section>` internal scroll | 3 | ✅ `SECTION_SCROLL_MAX_PX = 304` constant in `section.tsx`; inner container `overflow-y-auto` + `maxHeight` style. |
| `<Section>` a11y | 3 | ✅ Radix `Collapsible` provides `aria-expanded` + `aria-controls`; trigger is a real `<button>`; Tab focuses it; Space and Enter both toggle. |
| Presets section | 5 | ✅ Only Presets renders in PROJ-5; `count={0}`, `defaultExpanded`; empty state copy + LayoutGrid icon; no primary action; sysadmin sees identical copy. |
| Section ordering | 2 | ✅ JSDoc comment in `page.tsx` names the 5-slot canonical order; only Presets renders, other slots reserved. |
| Spacing rule | 2 | ✅ `gap-7` (28px) desktop / `gap-[18px]` mobile via the page wrapper. |
| Tests | 3 | ✅ Unit tests cover `<Section>` (10 cases) and `<WelcomeLine>` (9 cases); Playwright covers welcome line visibility, empty state, collapse/expand, and sysadmin variant. |
| Documentation | 1 | ✅ `docs/production/dashboard.md` documents hide-when-empty, section order, `<Section>` API, deferred state, welcome-line rules. |

### Edge cases — verified

| Case | Result |
| ---- | ------ |
| `profile.name = "   "` (whitespace only) | ✅ h1 renders "Welcome back" with no trailing comma (live + unit test) |
| `profile.name` null | ✅ Unit test covers; live verification blocked by unrelated `profiles.name` defaulting to email local-part on insert — covered at the component level |
| Very long name (60+ chars) + sysadmin pill | ✅ Long name fits on the first line; SYSADMIN pill wraps to a second line via `flex flex-wrap` (no horizontal overflow — `scrollWidth ≤ clientWidth`) |
| Sysadmin with null name | ✅ h1 reads "Welcome back" + SYSADMIN pill inline (covered by `welcome-line.test.tsx`) |
| Rapid section header clicks | ✅ Radix Collapsible debounces correctly — last click wins, no race |
| Viewport exactly 768px (md inclusive) | ✅ Welcome line visible; padding/max-width kick in |
| Viewport at 767px (just under md) | ✅ Welcome line hidden via `hidden md:block` |
| Section internal scroll on touch device | ✅ `overflow-y-auto` set; iOS/Android handle inertial scroll natively (no custom code) |
| Anonymous user → `/dashboard` | ✅ Redirected to `/auth/login` (PROJ-3 middleware + page-level `getCurrentProfile()` guard) |
| Pending user → `/dashboard` after login | ✅ Redirected to `/auth/waiting-for-approval` (PROJ-3 gate, regression confirmed) |

### Cross-viewport checks

| Viewport      | Result |
| ------------- | ------ |
| Mobile 375    | ✅ Welcome line hidden, Presets section full-width, empty state legible |
| Tablet 767    | ✅ Welcome line hidden (just under md) |
| Tablet 768    | ✅ Welcome line visible at exactly md (inclusive) |
| Desktop 1440  | ✅ Centred `max-w-[960px]` content, all elements render as designed |
| Dark mode (1440) | ✅ Tokens swap correctly; SYSADMIN pill keeps red wash; section frame + empty state border use dark surface tokens |

Screenshots captured at `/tmp/proj5-screens/` (not checked in — local artefacts).

### Security audit (red team)

| Surface | Test | Result |
| ------- | ---- | ------ |
| XSS via `profile.name` | Set name to `<script>window.__pwn=1</script><img src=x onerror=alert(1)>` | ✅ Escaped as literal text by React; no script executed, no `window.__pwn`, no alert dialog |
| Auth bypass | Anonymous GET `/dashboard` | ✅ Redirected to `/auth/login` |
| Authorization | Pending (unapproved) user GET `/dashboard` | ✅ Redirected to `/auth/waiting-for-approval` |
| Client data exfil | Network monitor for direct Supabase requests on dashboard load | ✅ 0 direct Supabase requests from the page (Server Component fetches profile server-side) |
| Sensitive data in DOM | View source for tokens / secrets | ✅ No `sb_secret`, no JWT, no email body — clean |
| Sensitive data in API responses | n/a — PROJ-5 ships no API routes | — |

### Regression checks against earlier features

| Feature | Test | Result |
| ------- | ---- | ------ |
| PROJ-4 | Dashboard tab active in top bar | ✅ |
| PROJ-4 | "+ New calculator" disabled with `disabled` attr | ✅ (PROJ-10 will retire this) |
| PROJ-4 | Avatar popover opens | ✅ |
| PROJ-4 | Dark mode (`next-themes`) applies | ✅ |
| PROJ-4 | Not-found surface still loads at `/dashboard/anything-else` | ✅ (existing E2E covers) |
| PROJ-3 | Login → `/dashboard` happy path | ✅ |
| PROJ-3 | Pending user gating | ✅ |
| PROJ-1 | Cron purge endpoint | ✅ (existing E2E covers) |

### Bugs found

**None.**

### Minor observations (non-blocking, informational)

- **Heading-outline nest.** The Presets section header uses `<h2>` (Section primitive), and `EmptyOrErrorState`'s title also uses `<h2>` (the empty state primitive PROJ-4 ships). Strict outline correctness would put the empty-state heading at `<h3>` so it nests under the section's `<h2>`. This pattern is inherited from PROJ-4 (the not-found surface has the same shape) and the spec accepts `<h2>` for sections without prescribing the empty-state level. Not a bug — flagged here in case the team wants to revisit the `EmptyOrErrorState` heading level in a later pass.
- **Next.js dev indicator (the "N" in the bottom-left of screenshots) is dev-only** — not a UI element shipped to production.

### Production-ready decision

✅ **READY.** No Critical or High bugs. 41/41 acceptance criteria pass. 145 automated tests (109 unit + 36 E2E) pass. Security audit clean. PROJ-4 regression clean.

> Next step: Run `/deploy` to deploy this feature to production.

## Deployment

**Production URL:** https://calcgrinder.vercel.app
**Deployed:** 2026-05-23
**Deployed commit:** `b89ed5d feat(PROJ-5): Implement Account Dashboard`
**Git tag:** `v1.0.0-PROJ-5`

### Pre-deployment checks
- `npm run build` — succeeded (Next.js 16.1.1 / Turbopack, 15 routes generated).
- `npm run lint` — clean (no warnings or errors).
- `npm test` — 109 / 109 passed (15 files), including the 10
  `<Section>` + 9 `<WelcomeLine>` unit tests added in this feature.
- `npm run test:e2e` — 36 / 36 passed across Chromium + Mobile Safari
  (2 correctly skipped: mobile project skip of the desktop-only test).
- No new env vars, migrations, or schema changes — pure presentation
  feature.
- `.env.local.example` unchanged.
- No secrets staged for commit.

### Post-deployment verification
- `GET /` → 307 Location: `/auth/login` (PROJ-3 middleware healthy).
- `GET /dashboard` → 307 Location: `/auth/login?next=%2Fdashboard`
  (auth gate intact; PROJ-3 regression clean).
- `GET /auth/login` → 200 HTML, `<title>Sign in · Calcgrinder</title>`
  (PROJ-3 / PROJ-4 chrome unchanged).
- Vercel security headers present on every response
  (`strict-transport-security`, `x-content-type-options: nosniff`,
  `x-frame-options: DENY`, `referrer-policy: origin-when-cross-origin`).
- Visual / authenticated check of the dashboard surface itself
  (welcome line + Presets empty state + Section collapse/expand)
  belongs to the deployer's smoke pass — exercised pre-deploy via
  Playwright (Chromium + Mobile Safari) against the same build.

### Forward-compat notes
The dashboard scaffold is now live with only the Presets section
rendering. Downstream features slot into the canonical order
documented in `docs/production/dashboard.md`:
- PROJ-10 → My Calculators (also retires the PROJ-4
  "Coming soon" tooltip on the "+ New calculator" top-bar button).
- PROJ-12 → My Scenarios.
- PROJ-13 → Trash.
- PROJ-18 → swaps the Presets empty state for a populated grid.
- PROJ-19 → User Calculators (sysadmin-only, `tint="danger"`).
