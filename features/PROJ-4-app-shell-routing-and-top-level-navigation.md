# PROJ-4: App Shell, Routing & Top-Level Navigation

## Status: Approved
**Created:** 2026-05-23
**Last Updated:** 2026-05-23

## Dependencies

- **PROJ-3** — uses the existing `(app)` route group, the
  `getCurrentProfile()` helper at `src/lib/auth/`, the
  `/auth/sign-out` POST endpoint, and the route-gate matrix
  PROJ-3 enforces in middleware + the `(app)` / `(auth)`
  layouts. PROJ-4 replaces the `(app)` layout's pass-through
  stub with the real AppShell.

PROJ-4 does **not** add new env vars, new tables, new
migrations, or new email templates.

## User Stories

- As an approved registered user, I want a consistent top bar
  across Dashboard, Editor, and Settings, so I always know
  where I am in the app.
- As an approved registered user, I want the avatar popover
  to give me my theme picker, Settings, and Sign-out from
  every signed-in surface, so I never have to hunt for those
  controls.
- As an approved registered user, I want to switch between
  Light / Dark / System app themes from anywhere, with my
  choice persisting per browser.
- As a desktop user, I want a tab-style breadcrumb in the top
  bar showing where I am (Dashboard / Editor / Settings), so
  I can orient and get back to the Dashboard with one click.
- As a mobile user, I want a compact top bar that still gives
  me access to my account controls, without cramming
  desktop-style breadcrumbs into a small viewport.
- As a signed-in user who types a wrong URL inside the app,
  I want a clean error page with the same chrome and a clear
  "Go to Dashboard" path, instead of a generic Next.js 404.
- As a sysadmin, I want a SYSADMIN red pill in the avatar
  popover so I can confirm at a glance I'm in the privileged
  session.
- As a future Editor maintainer, I want the AppShell to
  expose page-specific slots in the top bar (right-side
  extras, mobile-left affordance, mobile-center title), so
  PROJ-6 (theme picker) and PROJ-8 (Grid drawer toggle, live
  calculator name) can wire those features in without
  re-architecting the chrome.

## Out of Scope

PROJ-4 ships the frame. The contents that fill it belong to
later features:

- **Dashboard sections** — Hero, My Calculators, Presets, My
  Scenarios, Trash, User Calculators (sysadmin). PROJ-5 /
  PROJ-13 / PROJ-18 / PROJ-19.
- **Settings page contents** — Profile, App preferences,
  Account deletion, Danger zone. PROJ-14.
- **Editor surfaces** — Grid + Builder split, toolbar,
  configurator cards, mobile drawer overlay. PROJ-8.
- **"+ New calculator" backing creation** — inserting a
  `calculators` row, minting a `public_token`, redirecting
  to `/editor/<id>`. PROJ-10. PROJ-4 renders the button as
  disabled with a "Coming soon" tooltip.
- **Calculator-theme picker in the top bar** (visible when
  editing a calculator). PROJ-6 / PROJ-8. PROJ-4 only ships
  the `rightExtras` slot the picker will mount into.
- **User Calculators dashboard section + Admin popover-link
  wiring**. PROJ-19. PROJ-4 hides the Admin row entirely
  (the popover component carries an `isAdmin` prop from day
  one so PROJ-19 can flip it without restructuring).
- **Visitor surface chrome** — `/c/<token>` has no app
  chrome at all. PROJ-11. PROJ-4's AppShell never wraps the
  visitor route.
- **Auth surface chrome** — `AuthShell` and primitives.
  Shipped by PROJ-3.
- **Editor mobile drawer / Grid drawer toggle** — PROJ-8.
  PROJ-4 ships the `mobileLeftSlot` prop PROJ-8 will use,
  but doesn't render anything there itself.
- **Avatar image upload** — initials-only in v1 per the
  design source (PRD non-goal).
- **In-popover name / email editing** — single source of
  truth is the Settings page (PROJ-14). The popover header
  is read-only.
- **Internationalisation** — PRD non-goal. All chrome copy
  is English.
- **Global search / command palette** — not in v1.
- **Notification centre / inbox** — not in v1.
- **Theme sync across devices** — App theme is stored
  per-browser in `localStorage` (next-themes default).
- **Page-transition animations** — defaults; no custom
  transitions.
- **App-level error boundary (`(app)/error.tsx`)** — PROJ-4
  ships only the not-found surface. For runtime errors thrown
  by child pages or by `getCurrentProfile()` in the layout,
  the existing Next.js default error boundary is accepted.
  The `(app)/layout.tsx` continues to call `getCurrentProfile()`
  without try/catch; PROJ-3's middleware + layout gates remain
  the only failure mode for non-throwing auth states. A
  chrome-aware error surface can land in a later feature if
  real failures justify it.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] /
Then [result]

### AppShell — desktop layout

- [ ] Given an approved user navigates to `/dashboard`, `/settings`, `/editor/<id>`, or any unmatched route inside `(app)`, when the page renders on a viewport ≥ 768px, then the top bar is fixed at the top (48px tall, full width, surface background, 1px bottom border), and the page content sits below it.
- [ ] Given the desktop top bar is rendered, when its content is inspected, then it contains in order: Wordmark (logo + "Calcgrinder" text) on the left → thin vertical divider → tab nav → flex spacer → optional `rightExtras` slot → "+ New calculator" button → Avatar button.
- [ ] Given the user clicks the Wordmark from any signed-in surface, when the click fires, then the browser navigates to `/dashboard`.
- [ ] Given the user inspects the top bar visually against `docs/design/chrome.jsx`, when the comparison is made, then layout fidelity (spacing, heights, font sizes, border placements, divider positions) matches — pixel identity is not required.

### Tabs / breadcrumb (desktop)

- [ ] Given the user is on `/dashboard`, when the top bar renders, then the tab list shows exactly one segment "Dashboard" in active style (surface2 background, primary text colour).
- [ ] Given the user is on `/settings`, when the top bar renders, then the tab list shows two segments separated by a "/" — "Dashboard" (linkable to `/dashboard`, inactive style) + "Settings" (active style, surface2 background).
- [ ] Given the user is on `/editor/<id>`, when the top bar renders, then the tab list shows two segments — "Dashboard" (linkable, inactive) + a placeholder "Untitled calculator" (active). PROJ-8 will replace the placeholder text with the live calculator title.
- [ ] Given the user clicks the "Dashboard" segment from `/settings` or `/editor/<id>`, when the click fires, then the browser navigates to `/dashboard`.
- [ ] Given the tab nav has more text than will fit (very long calculator name), when rendered, then the active segment ellipsises at max-width 280px per the chrome.jsx primitive; no horizontal scrollbar appears.

### Right-slot extras (forward-compat for PROJ-6 / PROJ-8)

- [ ] Given AppShell accepts a `rightExtras?: React.ReactNode` prop, when a child layout provides a node, then the node renders between the flex spacer and the "+ New calculator" button on desktop.
- [ ] Given no `rightExtras` is provided, when the top bar renders, then no empty container or extra gap appears between the spacer and the button.

### "+ New calculator" button

- [ ] Given any approved user opens any signed-in surface on desktop, when the top bar renders, then the "+ New calculator" button is visible in the rightmost cluster, **disabled** (with `aria-disabled="true"` and `disabled` attribute), and wrapped in a Tooltip that reads "Coming soon — calculator creation ships with PROJ-10" on hover/focus.
- [ ] Given the button is disabled, when the user attempts to click it, then nothing happens (no navigation, no server call, no console error).
- [ ] Given the mobile top bar (< 768px) is rendered, when inspected visually, then the "+ New calculator" button is **not visible** to the user (it will return in a mobile-appropriate form alongside PROJ-10). Implementation may use CSS-based hiding (e.g. `hidden md:flex` on the desktop bar) rather than conditional rendering — the goal is "no mobile affordance for creating a calculator", not literal DOM absence.

### Avatar — initials derivation

- [ ] Given a profile has `name = "Ada Thornton"`, when the avatar renders, then the initials are "AT" (first letter of each space-split word, capped at 2, uppercase).
- [ ] Given a profile has `name = "Madonna"`, when the avatar renders, then the initials are "M".
- [ ] Given a profile has `name = NULL`, `""`, or whitespace-only, when the avatar renders, then the initials are derived from the first 2 letters of the email local-part, uppercased (e.g. `"shawbro77@icloud.com"` → "SH").
- [ ] Given an email local-part is a single character (`"a@…"`), when the avatar renders, then the initial is that single letter uppercased.
- [ ] Given a name contains accented characters (e.g. "Łukasz Świątek"), when the avatar renders, then the initials are derived from the first letter of each space-split word, preserving the original characters ("ŁŚ").
- [ ] Given the avatar background colour is derived from the initials string via the `cgAvatarHue()` hash (deterministic oklch hue), when the same user opens the popover on different sessions, then the colour stays stable.

### Avatar popover — content + behaviour

- [ ] Given the user clicks the avatar button on desktop, when the click fires, then a popover opens anchored below-right of the avatar (≈264px wide, surface background, 1px border, `shadowLg`), with an indigo focus outline on the avatar.
- [ ] Given the popover is open, when its content is inspected, then it contains in order: (1) header row with 36px avatar + name (or "—" if name is null) + email truncated at max-width 200px, (2) divider, (3) "THEME" small-caps label + 3-button grid (Light / Dark / System), (4) divider, (5) Settings row (link to `/settings`, gear icon), (6) divider, (7) Sign-out row (logout icon, muted text).
- [ ] Given the popover is open, when the user clicks outside it or presses Esc, then the popover closes and focus returns to the avatar button.
- [ ] Given a sysadmin opens the popover in PROJ-4, when the popover is inspected, then the Admin row is **not** rendered (it will be inserted above Settings by PROJ-19); a `<SysadminPill>` (uppercase red filled pill, 10px, monospace, "SYSADMIN") appears in the header row next to the user's name.
- [ ] Given a regular registered user opens the popover, when the header renders, then no SYSADMIN pill appears.
- [ ] Given the user clicks "Settings" in the popover, when the click fires, then the browser navigates to `/settings` and the popover closes.
- [ ] Given the user clicks "Sign out" in the popover, when the click fires, then a `<form action="/auth/sign-out" method="post">` is submitted, the PROJ-3 sign-out handler runs, and the browser is redirected to `/auth/login`.
- [ ] Given the popover is open and the user clicks one of the theme buttons (Light / Dark / System), when the click fires, then next-themes' `setTheme` is called with the corresponding value (`"light"`, `"dark"`, `"system"`), the body `class` updates immediately, the clicked button gains active styling, and the popover remains open (the user can switch themes and observe the change without reopening).
- [ ] Given the user's chosen theme is persisted via `next-themes` (localStorage), when the user reloads or opens a new tab, then the theme persists across sessions.
- [ ] Given the popover's name display reads from the server-rendered profile, when the user updates their name in Settings (PROJ-14), then the popover reflects the new name on next navigation (no client-side state to invalidate).

### Mobile top bar

- [ ] Given the user opens any signed-in surface on a viewport < 768px, when the top bar renders, then it is 48px tall and contains: Wordmark (mini, no text label) on the left + page-title center segment + Avatar on the right. No "+ New calculator" button, no Dashboard/Settings tabs, no hamburger.
- [ ] Given the user is on `/dashboard` on mobile, when the center segment renders, then it shows the Wordmark icon + "Calcgrinder" text (the home / brand title).
- [ ] Given the user is on `/settings` on mobile, when the center segment renders, then it shows the text "Settings".
- [ ] Given the user is on `/editor/<id>` on mobile, when the center segment renders, then it shows a placeholder "Calculator" (PROJ-8 will replace with the live calculator title via the `mobileCenter` prop).
- [ ] Given the user taps the avatar on mobile, when the tap fires, then the popover opens; its anchor position adapts so it doesn't overflow the viewport's right edge (stays inside the safe area). All content + behaviour identical to desktop.

### Mobile-left slot (forward-compat for PROJ-8)

- [ ] Given AppShell accepts a `mobileLeftSlot?: React.ReactNode` prop, when a child layout provides a node (e.g. PROJ-8 will pass the Grid drawer toggle button), then that node replaces the Wordmark on the left side of the mobile top bar.
- [ ] Given no `mobileLeftSlot` is provided (Dashboard / Settings in PROJ-4), when the mobile top bar renders, then the mini Wordmark renders in the left position.

### Mobile-center slot (forward-compat for PROJ-8)

- [ ] Given AppShell accepts a `mobileCenter?: React.ReactNode` prop, when a child layout provides a node, then it replaces the default page-title content in the center of the mobile top bar.
- [ ] Given no `mobileCenter` is provided, when the mobile top bar renders, then a sensible default is shown per the rules in "Mobile top bar" above, derived from `usePathname()`.

### App theme — provider + persistence

- [ ] Given the user has not yet chosen a theme, when the app first loads, then `next-themes` defaults to "system" (the existing root-layout setup); the body `class` reflects the OS preference; no flash-of-unstyled-content (handled by `suppressHydrationWarning` on `<html>`, already in place).
- [ ] Given the user changes the theme via the popover, when the user navigates between any signed-in routes, then the theme persists.
- [ ] Given the AuthShell pages (login/signup/...) and the AppShell pages share the same root `ThemeProvider`, when the user changes the theme on the AppShell and then signs out and lands on `/auth/login`, then the auth page renders in the same theme without a flash.

### Not-found inside the (app) group

- [ ] Given an approved user navigates to a route that doesn't match any `(app)` page (e.g. `/dashboard/foo`, `/widgets`, `/editor` without an id), when Next.js dispatches the 404, then `src/app/(app)/not-found.tsx` renders the full AppShell (Dashboard tab visible) plus `<EmptyOrErrorState variant="error" framed={false}>` with headline "Page not found", body "We couldn't find that page.", and a primary "Go to Dashboard" button linking to `/dashboard`.
- [ ] Given a child `(app)` page calls Next.js's `notFound()` directly, when triggered, then the same `not-found.tsx` renders.
- [ ] Given an anonymous browser hits an unmatched route inside `(app)`, when middleware processes the request, then the PROJ-3 auth gate redirects to `/auth/login?next=<original-path>` (gate runs first; not-found never renders).
- [ ] Given a pending / declined user hits an unmatched `(app)` route, when the `(app)` layout's status gate fires, then the user is redirected to `/auth/waiting-for-approval` (gate runs before not-found).
- [ ] Given user-facing copy on the not-found page is inspected, when read, then it uses user-level vocabulary (no "404", no "token", no "route", no "URL").

### EmptyOrErrorState primitive (shared, shipped by PROJ-4)

- [ ] Given `src/components/shell/empty-or-error-state.tsx` exports `EmptyOrErrorState`, when the component is rendered with `variant="empty"`, then it renders a dashed-border container on `surface2` background, with the given title, body, optional icon, and optional action button slot.
- [ ] Given `EmptyOrErrorState` is rendered with `variant="error"` and `framed={true}` (default), when it renders, then it uses a solid 1px border.
- [ ] Given `EmptyOrErrorState` is rendered with `variant="error"` and `framed={false}`, when it renders, then no outer container border / background is drawn — just centred content for full-page contexts.
- [ ] Given the component is rendered with no `icon` prop, when it renders, then no icon slot space is reserved.

### Sysadmin pill

- [ ] Given a sysadmin opens the avatar popover, when the popover header renders, then a `<SysadminPill>` appears next to the user's name (uppercase red filled pill, 10px text, mono).
- [ ] Given a regular registered user opens the popover, when the header renders, then no pill appears.

### Top-bar primitives — port from chrome.jsx

- [ ] Given the chrome design source `docs/design/chrome.jsx`, when its primitives are ported into PROJ-4, then the following exist under `src/components/shell/` as React/TypeScript components: `Wordmark`, `Avatar`, `Pill`, `Btn`, `IconBtn`, `SysadminPill`, `TopBarDesktop`, `TopBarMobile`, `AvatarPopover`, `AppShell`, plus the `Icons` set.
- [ ] Given the App renders in Light mode and Dark mode, when any chrome primitive (top bar, popover, avatar, breadcrumb tab, button) is inspected in both modes, then colours, borders, and backgrounds resolve correctly per the `cgTokens` semantic palette in both modes, with no missing tokens, no fallback flashes during theme switch, and no light/dark contamination (e.g. a dark-mode border bleeding into a light-mode surface). (Exact wiring strategy is an /architecture decision — see Open Questions.)
- [ ] Given a regular shadcn primitive already in `src/components/ui/` exists (e.g. `Button`, `Tooltip`), when PROJ-4 needs that behaviour, then it uses the shadcn primitive rather than building a parallel `Btn` everywhere. The chrome.jsx `Btn` / `IconBtn` ports are limited to the surfaces that need exact design fidelity (the top bar itself).

### Page metadata

- [ ] Given the user is on `/dashboard`, when the document title renders, then it is "Dashboard · Calcgrinder" (existing).
- [ ] Given the user is on `/settings`, when the document title renders, then it is "Settings · Calcgrinder" (existing).
- [ ] Given the user is on `/editor/[id]`, when the document title renders, then it is "Editor · Calcgrinder" (PROJ-8 will swap to the live calculator title later).

### Route gating regression (no PROJ-3 regression)

- [ ] Given PROJ-3 already enforces session + status gating in middleware + the `(app)` / `(auth)` layouts, when PROJ-4 lands, then no existing route-gate test regresses (the full 15-case matrix from PROJ-3 continues to pass).
- [ ] Given the `(app)` layout now hosts the AppShell instead of the bare pass-through, when an anonymous browser, a pending user, a declined user, and an approved user each hit `/dashboard`, `/editor/x`, `/settings`, and an unmatched `/foo`, then redirect/render behaviour matches the PROJ-3 matrix with the additional rule "approved × unmatched → /not-found page renders inside AppShell".

### Hardening — production security headers

Deferred from the PROJ-1 / PROJ-2 / PROJ-3 deploys: the four
non-CSP headers from `docs/production/security-headers.md`
are wired into `next.config.ts` as part of this feature.
PROJ-4 is the natural landing point because it ships the
shared chrome that every signed-in surface inherits.

- [ ] Given `next.config.ts` is inspected, when its `headers()` function is read, then it returns a single rule with `source: '/:path*'` carrying exactly four headers, with the verbatim values documented in `docs/production/security-headers.md`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- [ ] Given a `curl -I https://<production-domain>/dashboard` is run after deploy, when the response headers are inspected, then all four headers above are present with the documented values, on a 302 (redirect-to-login when unauthenticated) and on a 200 (authenticated dashboard response). The verification is repeated on `/auth/login`, `/c/<any-token>`, and `/auth/admin/<any-token>/approve` so the global rule is confirmed.
- [ ] Given `docs/production/security-headers.md`'s "Verify After Deployment" checklist is followed (Chrome DevTools → Network → Response Headers), when run against production, then the same four headers appear on every response.
- [ ] Given a Content-Security-Policy header is inspected on production responses, when checked, then **none is set** — CSP is deliberately deferred (see Product Decisions).

### Hardening — Lighthouse baseline

Light touch only. PROJ-4 captures a baseline; later features
revisit if real-user evidence demands it.

- [ ] Given the PROJ-4 deploy has landed in production, when Lighthouse is run from Chrome DevTools (mobile + desktop) against the deployed `/dashboard` (placeholder), `/settings` (placeholder), and `/auth/login` after sign-out, then the four category scores (Performance, Accessibility, Best Practices, SEO) for each run are recorded in `docs/production/app-shell.md` under a "Lighthouse baseline (PROJ-4)" section with the deploy date. No score targets, no follow-up optimisation pass — see Product Decisions.

### Tests

- [ ] Given `src/components/shell/avatar-initials.test.ts`, when `npm test` runs, then all derivation cases pass: name with 2+ words → first letter each capped at 2; name with 1 word → first letter; empty name → first 2 chars of email local-part uppercased; single-char local-part → single letter; accented characters preserved; whitespace-only name treated as empty.
- [ ] Given `src/components/shell/avatar-popover.test.tsx` covers the popover (opens / closes on outside click + Esc, theme buttons call `setTheme` with the right value, Settings link target, Sign-out form action + method, Admin row hidden in PROJ-4, SYSADMIN pill conditional on `role`), when `npm test` runs, then all cases pass.
- [ ] Given `src/components/shell/top-bar.test.tsx` covers tab assembly per pathname (`/dashboard` → 1 tab; `/settings` → 2 tabs; `/editor/anything` → 2 tabs with the placeholder second segment), when `npm test` runs, then all assertions pass.
- [ ] Given `tests/PROJ-4-app-shell.spec.ts` (Playwright E2E) walks through: signed-in user on `/dashboard` sees the AppShell with the active Dashboard tab → opens the avatar popover → switches to Dark theme → clicks Settings → arrives at `/settings` with the breadcrumb "Dashboard / Settings" → types `/dashboard/nope` → lands on the not-found page → clicks "Go to Dashboard" → returns to `/dashboard`, when `npm run test:e2e` runs, then it passes in both Chromium and Mobile Safari projects (same multi-project setup as PROJ-1 / PROJ-3).

### Documentation

- [ ] Given `docs/production/app-shell.md` exists, when the deployer reads it, then it documents: the App vs. Calculator theme distinction (per-browser App theme via next-themes); avatar-initials derivation rules; route-group conventions (`(app)` private chrome, `(auth)` pre-auth, plain `auth/` for callbacks); where to wire the editor's per-page extras (`rightExtras` / `mobileLeftSlot` / `mobileCenter`); the deferred status of "+ New calculator" (re-enabled in PROJ-10) and the Admin popover row (re-enabled in PROJ-19); the four production security headers wired into `next.config.ts` (with a pointer to `docs/production/security-headers.md` for the canonical reference); the Lighthouse baseline scores captured at PROJ-4 deploy.

## Edge Cases

- **Profile.name is NULL AND email is empty.** Impossible in
  practice (Supabase Auth requires email), but defensively:
  the avatar helper returns `"?"` instead of throwing.
- **User renames themselves in Settings (PROJ-14).** Server-
  rendered profile is the single source of truth; the
  avatar / popover header re-derive on next request without
  any client-side cache to invalidate.
- **Very long email (40+ chars).** The popover header
  truncates the email with ellipsis at `max-width: 200px`
  per the chrome.jsx primitive; the name stays visible.
- **Network drops between popover open and Sign-out click.**
  The Sign-out form submits normally (browser-native);
  if the POST fails to reach the server, the session cookie
  is unchanged; the user can retry. No silent failure state.
- **Two browser tabs open with different themes.** The most
  recent `setTheme` wins for that browser; tabs that haven't
  navigated yet keep the old theme until next render
  (next-themes default behaviour). Refresh reconciles.
- **User signs out in one tab; another tab still on
  AppShell.** On next navigation the PROJ-3 middleware
  redirects the second tab to `/auth/login`. The stale tab
  before that interaction shows the cached UI — accepted.
- **Browser blocks `localStorage`.** next-themes falls back
  to attribute toggling per tab; the user re-picks each
  session. Acceptable.
- **Viewport exactly 768px.** Tailwind's `md:` break
  inclusive of 768px (desktop chrome at exactly 768).
- **Editor route with an invalid calculator id.** PROJ-8
  will call `notFound()` from the editor page, hitting
  PROJ-4's not-found surface (AppShell + EmptyOrErrorState).
- **Wordmark click from a deep editor route with unsaved
  changes.** PROJ-8 adds the navigation-guard prompt; PROJ-4
  just navigates. Out of scope here.
- **Case-sensitive route mismatch** (e.g. `/Dashboard` with
  capital D). Next.js routes are case-sensitive — hits the
  not-found surface, behaves correctly.
- **Sysadmin with a regular-looking name** (no SYSADMIN pill
  in the header would mislead). Pill rendering is gated on
  `profiles.role === 'sysadmin'`, not on the name.
- **The disabled "+ New calculator" button + screen-reader.**
  `aria-disabled="true"` + native `disabled` attribute +
  tooltip text are exposed; screen readers announce the
  button as disabled with the "Coming soon" hint.
- **Theme button rapid-click (race).** next-themes' setTheme
  is synchronous-enough that rapid clicks just settle on
  the last selection.
- **Avatar popover anchored near the viewport edge on mobile
  landscape.** Popover position adapts to stay inside the
  viewport (`right: 8px` clamp); no horizontal scroll.

## Technical Requirements

- **Stack:** Next.js 16 App Router. The `(app)` layout
  becomes a Server Component that resolves `getCurrentProfile()`
  once and passes the profile to a Client `AppShell` for
  popover state. Other layouts unchanged.
- **Component location:** `src/components/shell/` is the new
  home for chrome primitives:
  - `app-shell.tsx` (top-level Client Component)
  - `top-bar-desktop.tsx`, `top-bar-mobile.tsx`
  - `avatar.tsx`, `avatar-popover.tsx`, `avatar-initials.ts`
  - `wordmark.tsx`, `sysadmin-pill.tsx`
  - `pill.tsx`, `btn.tsx`, `icon-btn.tsx` (chrome-only
    variants — shadcn `Button` stays for body content)
  - `icons.tsx` (re-exports the SVG set ported from
    `chrome.jsx`)
  - `empty-or-error-state.tsx`
  - Keep distinct from `src/components/ui/` (shadcn,
    untouched + regenerable) and `src/components/auth/` (the
    auth primitives PROJ-3 ships).
- **Theme provider:** reuse the existing `ThemeProvider`
  (`next-themes`) in `src/components/theme-provider.tsx`.
  No new provider in PROJ-4. The popover's theme buttons
  call `useTheme().setTheme`.
- **Design tokens:** the `cgTokens` light + dark token set
  in `docs/design/chrome.jsx` defines the semantic palette
  chrome primitives consume (surface, surface2, border,
  text, textMuted, accent, danger, …). PROJ-4 must surface
  these tokens to chrome primitives in a way that resolves
  correctly in both Light and Dark mode. The wiring
  approach (extend the shadcn token set vs. parallel
  shell-tokens layer; where the tokens live; how Tailwind
  references them) is an /architecture decision — see Open
  Questions.
- **AppShell API (props):**
  - `user: { name: string | null; email: string; role: 'registered' | 'sysadmin' }` (required)
  - `children: React.ReactNode` (required)
  - `rightExtras?: React.ReactNode` (desktop right-side
    slot)
  - `mobileLeftSlot?: React.ReactNode` (mobile left-side
    slot)
  - `mobileCenter?: React.ReactNode` (mobile center slot —
    page title)
- **Pathname-driven tabs:** the desktop top bar computes
  tab assembly from `usePathname()`. Rules: `/dashboard` →
  1 tab; `/settings` → 2 tabs; `/editor/*` → 2 tabs (second
  segment text is "Untitled calculator" placeholder until
  PROJ-8 supplies the live title).
- **Avatar initials helper:** pure function in
  `src/components/shell/avatar-initials.ts` with unit
  tests; signature `({ name: string | null, email: string }) → string`. Returns 1–2 chars. Trims and NFC-normalises
  name; falls back to first 2 chars of email local-part
  uppercased; empty-everything returns `"?"`.
- **Avatar hue:** port `cgAvatarHue()` (deterministic hash
  → oklch hue) into the same module so the avatar
  background colour is stable per user.
- **`/not-found.tsx` inside `(app)`:** `src/app/(app)/not-found.tsx`
  renders the full AppShell + `EmptyOrErrorState`. Triggered
  by either an unmatched route or a server-side `notFound()`
  call from a child page.
- **Root `/not-found.tsx`:** kept as Next.js default;
  visitor-route 404 (`/c/<token>` not found) defines its
  own surface in PROJ-11.
- **Sign-out wiring:** popover's Sign-out row is a
  `<button type="submit">` inside a
  `<form action="/auth/sign-out" method="post">`. No JS
  required.
- **Tooltip on the disabled "+ New calculator":** use
  shadcn `Tooltip` (already installed). Disabled buttons
  don't fire mouse events, so use the documented shadcn
  pattern (wrapping `<span>` or `pointer-events: auto` on
  the disabled child) to keep the tooltip working.
- **Responsive break:** Tailwind's `md:` (≥ 768px) gates
  desktop vs. mobile chrome. Single break for the whole
  shell.
- **Accessibility:**
  - Avatar button: `aria-label="Open account menu"`,
    `aria-expanded={open}`.
  - Popover: `role="menu"` with `role="menuitem"` rows
    where appropriate; theme buttons grouped as
    `role="radiogroup"` with three `role="radio"` buttons.
  - Esc / outside click closes; focus returns to avatar
    button.
  - Disabled "+ New calculator" exposes both
    `aria-disabled="true"` and the native `disabled`
    attribute.
  - All chrome icons have either `aria-hidden="true"`
    (decorative) or an `aria-label` (interactive).
- **Performance:** AppShell adds zero additional DB
  roundtrips beyond what PROJ-3 already does — the `(app)`
  layout already invokes `getCurrentProfile()`; the shell
  consumes the result via props.
- **Forward-compat constraints (must hold for downstream
  features to drop in cleanly):**
  - `rightExtras` slot is present from day one for PROJ-6 /
    PROJ-8's Calculator-theme picker.
  - `mobileLeftSlot` slot is present from day one for
    PROJ-8's Grid drawer toggle on the mobile editor.
  - `mobileCenter` slot is present from day one for
    PROJ-8's live calculator name in the mobile editor
    header.
  - `AvatarPopover` accepts an `isAdmin` boolean from day
    one — false in PROJ-4 (Admin row hidden); PROJ-19 flips
    it to true and the Admin row renders above Settings.
  - The desktop tab nav accepts an optional override for
    the second segment text so PROJ-8 can pass the live
    calculator title once it's available.
  - The disabled "+ New calculator" button keeps its
    rendering position and styling; PROJ-10 swaps the
    tooltip + disabled attribute and wires the action
    without re-arranging the surrounding cluster.
- **Tests:** unit tests for `avatar-initials`,
  `avatar-popover`, and `top-bar`; Playwright E2E for the
  end-to-end user flow.
- **Production security headers:** wire the four headers
  documented in `docs/production/security-headers.md` into
  `next.config.ts`'s `headers()` function. CSP is
  deliberately not added (see Product Decisions).
- **Lighthouse baseline:** capture mobile + desktop scores
  for `/dashboard`, `/settings`, and `/auth/login` into
  `docs/production/app-shell.md` after the PROJ-4 deploy.
  No optimisation pass.

## Open Questions

- [ ] /architecture: how should `cgTokens` be wired into
      Tailwind / CSS variables — extend the existing shadcn
      token set (one unified token system), or coexist as a
      parallel shell-specific layer? Trade-off: unification
      keeps the design language consistent but risks
      colliding with shadcn's semantic naming; parallel
      keeps the boundary clean but duplicates similar
      values.
- [ ] /architecture: should the top bar be a Server
      Component (reading pathname via `headers()`) or a
      Client Component (`usePathname()`)? Client is simpler
      and the only state-bearing part (popover) needs it
      anyway; Server saves a tiny bit of hydration. Decide
      where the boundary sits.
- [ ] /architecture: where should `not-found.tsx` for the
      `(app)` group live — `src/app/(app)/not-found.tsx`
      only, or also a shared parent for routes outside the
      group? Default: per-group `not-found.tsx` (Next.js
      idiomatic).
- [ ] /architecture: should `cgTokens`-derived avatar hue
      use the same oklch lightness in light and dark mode,
      or adjust per theme (as chrome.jsx does)? Default:
      port the per-theme adjustment from chrome.jsx.
- [ ] When to migrate `middleware.ts` → `proxy.ts` (Next
      16 emits a deprecation warning for the old API; Next
      17 is expected to remove it). PROJ-4 explicitly does
      **not** do this migration — it's a deprecation, not
      a breaking change, and absorbing it here would expand
      scope into PROJ-3's shipped route-gate code. Track
      separately as either its own micro-feature or a
      chore commit when Next 17 actually lands.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| "+ New calculator" button rendered disabled with a "Coming soon" tooltip until PROJ-10 ships the creation flow | Keeps the chrome visually real from day one without crossing into PROJ-10's data-model territory; the disabled state with explanatory tooltip is friendlier than a hidden affordance the user won't expect to return | 2026-05-23 |
| Mobile hamburger menu dropped from /dashboard and /settings; AppShell exposes a `mobileLeftSlot` prop for PROJ-8 to use on the Editor | Dashboard and Settings have nothing else to navigate to from the top bar (Settings + Sign-out live in the avatar popover, which works on mobile). The Editor is the only surface that needs a mobile-left affordance (Grid drawer toggle). Exposing the slot avoids re-architecting the shell when PROJ-8 lands | 2026-05-23 |
| /settings desktop breadcrumb shows "Dashboard / Settings" (two segments) | Mirrors the /editor/<id> "Dashboard / <Calc name>" pattern; gives a one-click back-to-dashboard affordance besides the wordmark; consistent shape across signed-in surfaces with more than one level of context | 2026-05-23 |
| Admin entry hidden from the avatar popover until PROJ-19 ships the User Calculators dashboard section | The Admin entry's scroll-target doesn't exist yet; a disabled entry would clutter the popover for the deployer-sysadmin without value. The `AvatarPopover` carries an `isAdmin` prop from day one so PROJ-19 flips it without restructuring. **Pattern rule (inheritable by PROJ-19 and any future scope debate):** disabled-with-tooltip for public-facing slots in fixed layout positions (e.g. "+ New calculator" in the top bar); hide for privileged items in lists (e.g. Admin entry in the popover menu). Different visibility consequences justify different placeholder strategies — a fixed-position slot leaves a visible hole when hidden; a list item just shortens the list | 2026-05-23 |
| Not-found inside (app) renders the full AppShell + EmptyOrErrorState (variant=error, framed=false) | Keeps the user oriented (top bar still there, Dashboard tab visible); gives them a clear "Go to Dashboard" path; avoids the generic Next.js 404 chrome that looks broken in a signed-in context | 2026-05-23 |
| Avatar initials: when name is null/empty, fall back to first 2 letters of email local-part uppercased | The seeded sysadmin has no name (PROJ-1 seed leaves it NULL until edited in PROJ-14 Settings). Email is always present, so always-derivable initials avoid an empty-circle UX; matches the convention used across most SaaS apps | 2026-05-23 |
| PROJ-4 ships the shared `EmptyOrErrorState` primitive (rather than inlining the not-found error) | The primitive is reused by PROJ-5 (Presets empty state), PROJ-11 (visitor /c/<token> 404/410), PROJ-13 (Trash empty), and retroactively by PROJ-3's confirm error landing. Building it now means later features import instead of duplicate | 2026-05-23 |
| Avatar popover stays open after a theme-button click | Lets the user see the theme transition applied and switch again without re-opening the popover; matches the chrome.jsx prototype behaviour and the typical "settings popover" pattern | 2026-05-23 |
| Chrome primitives live under `src/components/shell/` (separate from `src/components/ui/` and `src/components/auth/`) | Keeps `src/components/ui/` for shadcn copy-paste (untouched, regenerable) and `src/components/auth/` for PROJ-3's auth primitives. Shell primitives are bespoke ports of `docs/design/chrome.jsx`; new namespace makes their origin and purpose clear | 2026-05-23 |
| Wordmark click navigates to /dashboard from every signed-in surface | Universal "home" gesture; matches SaaS convention; no app-state implications | 2026-05-23 |
| Sign-out wired as a plain `<form action="/auth/sign-out" method="post">` (no JS) | Same pattern PROJ-3's waiting-for-approval screen uses; works under stalled-JS conditions; one POST endpoint with multiple triggers | 2026-05-23 |
| Responsive break at Tailwind's `md:` (≥ 768px) | Matches shadcn defaults; single break for the whole chrome keeps the rule simple; below = mobile bar, above = desktop bar | 2026-05-23 |
| `mobileCenter` slot included from day one alongside `mobileLeftSlot` | The mobile top bar's center segment will need to be the live calculator title in the Editor (PROJ-8). Exposing the slot now means PROJ-8 only needs to pass a string, not restructure the bar | 2026-05-23 |
| Production security headers wired in PROJ-4 (deferred from PROJ-1 / PROJ-2 / PROJ-3 deploys) — exact four-header set from `docs/production/security-headers.md` (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). CSP **deliberately deferred** | PROJ-4 ships the chrome every signed-in surface inherits, so it's the natural landing point for a header rule that applies to all responses. The four non-CSP headers are zero-risk drop-ins. CSP is intentionally not added: the template doc itself flags it as "Advanced / optional" because misconfiguration breaks the app, and for a private, deployer-only-user app the marginal protection isn't worth the configuration-debug burden. Revisit if/when the app opens to outside users | 2026-05-23 |
| Lighthouse baseline captured once at PROJ-4 deploy and recorded in `docs/production/app-shell.md`; no score targets, no optimisation pass | The template's "> 90 in all categories" target is a default, not a gate. For a private app with no real users yet, capturing a baseline is enough to detect future regressions; investing engineering time chasing scores against no real-world load is premature. Deep performance work (image optimisation policies, bundle-splitting strategy, caching policy) is out-of-scope for v1 — revisit when real usage produces evidence | 2026-05-23 |

### Technical Decisions
<!-- Added by /architecture -->

| Decision | Rationale | Date |
|----------|-----------|------|
| Wire the chrome.jsx semantic palette as a **parallel `--cg-*` CSS variable layer** in `globals.css` (not an extension of the shadcn token set). Tailwind config exposes them under `colors.cg.*` (e.g. `bg-cg-surface`, `text-cg-text-muted`, `border-cg-border-strong`). Shadcn tokens stay untouched. Chrome primitives consume only `cg.*` colours; body content keeps using shadcn defaults | Keeps a clean boundary between the chrome design language and the shadcn defaults the rest of the app uses. shadcn's semantic naming (`card`, `accent`, `muted-foreground`) doesn't 1:1 map to the chrome.jsx ladder (`surface` → `surface2` → `surface3`, `textMuted` vs `textSubtle`, plus a danger / diff family). A parallel namespace makes "this colour belongs to chrome" obvious in JSX, and shadcn's `npx shadcn add …` regeneration can't accidentally collide with shell tokens. Trade-off: a handful of duplicate-feeling values (e.g. `cg.border` near `border`) — acceptable, and the chrome design source is the authority for those surfaces | 2026-05-23 |
| **AppShell is a single Client Component** that the `(app)` server layout wraps around its children. The layout calls `getCurrentProfile()` (already cached for the request) and passes `user = { name, email, role }` as a prop. Avatar popover state, theme buttons, and pathname-driven tab assembly all live inside the client boundary | The popover needs state, the theme picker needs `useTheme()`, the desktop tab nav reads `usePathname()` — three reasons to be client. Keeping the entire AppShell as one client boundary is simpler than splitting per-piece, and the boundary cost is one component subtree. Zero extra DB roundtrips: the layout already invokes `getCurrentProfile()` for the PROJ-3 status gate; AppShell consumes the result via props | 2026-05-23 |
| **Pathname-driven tab assembly via pure helper** `buildBreadcrumbTabs(pathname) → Tab[]` in `top-bar-desktop.tsx` (or a sibling helper). Rules: `/dashboard` → 1 active tab "Dashboard"; `/settings` → "Dashboard" (link) + "Settings" (active); `/editor/*` → "Dashboard" (link) + "Untitled calculator" (active placeholder). Helper is unit-tested in isolation; the live calculator title injection (PROJ-8) is delivered as an override prop on the top bar, not by changing the helper | Pure-function helpers are the cheapest unit-test surface; isolating tab assembly from the React render keeps the top-bar component focused on layout. The override-prop seam for PROJ-8 means future scope can deliver title-from-DB without re-architecting the breadcrumb logic | 2026-05-23 |
| **`(app)/not-found.tsx`** placed inside the route group only. The root `not-found.tsx` is left as the Next.js default (visitor `/c/<token>` 404 ships its own surface in PROJ-11). The not-found surface renders the full `AppShell` plus `EmptyOrErrorState variant="error" framed={false}` | Per-group `not-found.tsx` is the Next.js idiomatic pattern for chrome-aware error pages. Scoping it to `(app)` ensures the auth gate in middleware + layout fires first (anon → /auth/login, pending → /auth/waiting-for-approval) and the not-found surface only ever renders for approved users — keeping PROJ-3's route-gate matrix intact | 2026-05-23 |
| **Avatar hue**: deterministic hash `cgAvatarHue(initials) → 0–359`, applied as `background: oklch(var(--cg-avatar-l) 0.13 <hue>deg)`. `--cg-avatar-l` is defined per theme (light: 0.62, dark: 0.55) in `globals.css`, matching the chrome.jsx source | Per-theme lightness keeps the avatar legible against both `bg-cg-surface` ladder values without a JS branch. Using a CSS variable for lightness lets the browser pick the right value on theme switch with no React state, no flash, no `useTheme()` round-trip | 2026-05-23 |
| **Slot composition**: `AppShell` exposes three optional slots — `rightExtras` (desktop right cluster), `mobileLeftSlot`, `mobileCenter`. Slots are typed as `React.ReactNode`. When omitted, the bar renders sensible defaults (Wordmark on mobile left; pathname-derived title in mobile center; no gap on desktop right). Slot props can be Server or Client components — the AppShell boundary doesn't constrain them | A `ReactNode` slot is the cheapest forward-compat seam: PROJ-6 (calculator-theme picker), PROJ-8 (Grid drawer toggle, live calculator title), and PROJ-10 (`+ New calculator` enablement) can inject content without prop drilling or restructuring the bar. Defaults keep PROJ-4 surfaces (Dashboard, Settings) clean today | 2026-05-23 |
| **AvatarPopover composition**: ship as a bespoke shell primitive wrapped around shadcn's `Popover` (already installed). Internal sub-pieces (Settings link row, Sign-out form row, Theme radio-group) use lightweight shell-styled buttons; the disabled "+ New calculator" button uses shadcn `Button disabled` inside a `<span>` wrapper inside shadcn `Tooltip` to keep the tooltip firing | shadcn `Popover` handles outside-click, Esc, focus-return, and viewport-collision logic — three accessibility behaviours we'd otherwise rebuild. The shell-styled internal rows match chrome.jsx fidelity. The disabled-button + Tooltip wrapping is the documented shadcn pattern; we don't need a parallel `Btn` for this surface | 2026-05-23 |
| **Sign-out** wired as `<form action="/auth/sign-out" method="post">` with a submit button styled as a popover row — no client JS required | Reuses PROJ-3's existing sign-out endpoint; same pattern PROJ-3's waiting-for-approval screen uses. Works under stalled-JS conditions; one POST endpoint serving multiple triggers | 2026-05-23 |
| **Icons set** ported as a single typed `Icons` namespace in `src/components/shell/icons.tsx` from `docs/design/chrome.jsx`. The chrome surfaces consume only this set. Body content / shadcn components can still pull `lucide-react` independently | The chrome.jsx icons are tuned for the design's stroke weights and size grid (16/14/13/11px). Porting them as a typed namespace gives type-checked icon names, decouples from `lucide-react`'s changing API, and lets us add bespoke chrome glyphs (e.g. `NotFound`, `Hourglass`) without depending on a third-party set | 2026-05-23 |
| **App-theme persistence**: reuse the existing root-layout `ThemeProvider` (next-themes) untouched. Popover theme buttons call `useTheme().setTheme('light'|'dark'|'system')`. No new provider, no server-side persistence. Storage: browser `localStorage` (next-themes default key) | The provider already exists in `src/components/theme-provider.tsx` and wraps both `(auth)` and `(app)` routes. Adding a second provider would double-render and could fight on `<html class="dark">`. Per-browser localStorage is the documented v1 stance in the PRD's non-goals (theme sync across devices is post-v1) | 2026-05-23 |
| **Production security headers** wired into `next.config.ts` via the `headers()` function returning a single rule on `source: '/:path*'` with the four headers from `docs/production/security-headers.md`. CSP deliberately omitted | Documented in `docs/production/security-headers.md` as zero-risk drop-ins. PROJ-4 is the natural landing point because it ships the shared chrome — applying the rule globally now means every later feature inherits it without per-route plumbing. CSP exclusion is a product decision logged separately | 2026-05-23 |
| **Lighthouse baseline** captured manually after deploy and recorded in `docs/production/app-shell.md`. No CI runner, no scoring gate | Captured at deploy-time once for posterity. PRD-level decision: no real users yet, so chasing scores against synthetic load isn't worth the engineering time. Recording the baseline future-proofs regression detection without committing to optimisation work | 2026-05-23 |
| `middleware.ts` → `proxy.ts` migration **explicitly deferred** out of PROJ-4 | Next 16 emits a deprecation warning; Next 17 will rename. It's a chore, not a feature dependency, and absorbing it here would expand scope into PROJ-3's shipped route-gate code. Tracked separately in the Open Questions | 2026-05-23 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Big picture

PROJ-4 turns the `(app)` route group from a pass-through stub into the
real signed-in chrome. The data side stays exactly as PROJ-3 left it
— same `profiles` row, same `getCurrentProfile()` helper, same
sign-out endpoint, same middleware. The new code is entirely
presentational: a Client Component `AppShell` that the existing
server layout wraps around its children, plus the shared
`EmptyOrErrorState` primitive that PROJ-5 / PROJ-11 / PROJ-13 will
reuse.

Two side-quests ride along because PROJ-4 is the natural landing
point: the four production security headers (deferred since PROJ-1)
and a one-time Lighthouse baseline capture.

### Component tree

```
RootLayout (Server — keeps existing ThemeProvider)
└── (app)/layout.tsx (Server — gates session + status, fetches profile)
    └── <AppShell user={{ name, email, role }}>  ← Client boundary starts
        ├── <TopBarDesktop>           (visible md:flex)
        │     Wordmark → divider → Tabs → spacer → {rightExtras}
        │     → NewCalculatorButton (disabled + Tooltip) → AvatarButton
        ├── <TopBarMobile>            (visible <md)
        │     {mobileLeftSlot || <Wordmark mini/>} → {mobileCenter || derived}
        │     → AvatarButton
        ├── <AvatarPopover>           (shadcn Popover; opens on AvatarButton)
        │     Header (Avatar + name + email + optional <SysadminPill>)
        │     Theme picker (Light / Dark / System radiogroup)
        │     Settings row (link → /settings)
        │     Sign-out row (form POST → /auth/sign-out)
        └── children                  (Server — the page)

(app)/not-found.tsx (Server — Next.js per-group convention)
└── <AppShell user={…}>
    └── <EmptyOrErrorState variant="error" framed={false}
            title="Page not found"
            body="We couldn't find that page."
            action={<Link href="/dashboard">Go to Dashboard</Link>}
        />
```

### New / changed files

**New (`src/components/shell/`):**

| File | Responsibility |
|------|---------------|
| `app-shell.tsx` | Top-level Client Component; orchestrates desktop vs mobile bars and the popover; accepts `user`, `rightExtras`, `mobileLeftSlot`, `mobileCenter` |
| `top-bar-desktop.tsx` | Desktop bar layout + tab assembly via `usePathname()` |
| `top-bar-mobile.tsx` | Mobile bar layout; consumes the same popover state |
| `avatar.tsx` | Stateless avatar circle (background hue from initials) |
| `avatar-initials.ts` | Pure helper `({name, email}) → string`, NFC-normalised, capped 2 chars |
| `avatar-popover.tsx` | shadcn `Popover` wrapper with the header + theme picker + Settings + Sign-out + (forward-compat) `isAdmin` slot |
| `wordmark.tsx` | "c" tile + "Calcgrinder" text; `mini` variant for mobile |
| `sysadmin-pill.tsx` | Small red filled pill, mono font |
| `pill.tsx`, `btn.tsx`, `icon-btn.tsx` | Chrome-only ports of chrome.jsx primitives (used in the top bar only) |
| `icons.tsx` | Typed `Icons` namespace ported from chrome.jsx |
| `empty-or-error-state.tsx` | Shared primitive: title + body + optional icon + optional action; `variant: 'empty' \| 'error'`, `framed?: boolean` |

**New (other):**

| File | Responsibility |
|------|---------------|
| `src/app/(app)/not-found.tsx` | Per-group 404 surface — renders AppShell + EmptyOrErrorState |
| `docs/production/app-shell.md` | Operational doc: App vs Calculator themes, initials rules, route-group conventions, slot wiring guide, deferred-feature notes, security-headers pointer, Lighthouse baseline |
| `src/components/shell/avatar-initials.test.ts` | Unit tests for initials derivation |
| `src/components/shell/avatar-popover.test.tsx` | Component tests for popover behaviour |
| `src/components/shell/top-bar.test.tsx` | Component tests for tab assembly |
| `tests/PROJ-4-app-shell.spec.ts` | Playwright E2E |

**Modified:**

| File | Change |
|------|--------|
| `src/app/(app)/layout.tsx` | Pass-through stub → `<AppShell user={…}>{children}</AppShell>` (server fetches profile, hands it to client shell) |
| `src/app/globals.css` | Add the `--cg-*` token block under `:root` and `.dark` (chrome semantic palette + per-theme `--cg-avatar-l`) |
| `tailwind.config.ts` | Extend `theme.colors.cg.*` to surface `hsl(var(--cg-*))` |
| `next.config.ts` | Add `async headers()` returning the four production headers on `/:path*` |

### Data model

**No new tables, no new columns, no migrations.** PROJ-4 is
presentational; it consumes the existing `profiles` row through
`getCurrentProfile()`:

```
profiles row used by the shell:
  name        string | null   → header line in the avatar popover
  email       string          → header subline + fallback for initials
  role        'registered' | 'sysadmin' → gates the <SysadminPill>
```

**App theme** lives in the browser's `localStorage` via `next-themes`'
default key — no server-side storage, no DB column. The PRD non-goal
"theme sync across devices" stays out.

### How the open spec questions resolve

| Spec open question | Resolution |
|---------------------|-----------|
| cgTokens wiring strategy | **Parallel `--cg-*` layer.** Shadcn untouched; chrome primitives consume `bg-cg-surface`, `text-cg-text-muted`, etc. |
| Server vs Client top bar | **Client.** Popover state + `useTheme()` + `usePathname()` all need it; single client boundary at AppShell is the simplest seam |
| Where `not-found.tsx` lives | **`src/app/(app)/not-found.tsx` only.** Root `not-found.tsx` stays Next.js default; visitor 404 is PROJ-11's job |
| Avatar hue per-theme lightness | **Port chrome.jsx behaviour via a CSS variable** (`--cg-avatar-l`: 0.62 light, 0.55 dark). No JS branch needed |
| middleware → proxy migration | **Deferred.** Tracked in the spec's Open Questions; not in PROJ-4 |

### Tech decisions (concise)

- **shadcn vs shell primitives.** Reuse shadcn `Popover`, `Tooltip`,
  `Button` for off-the-shelf behaviour (outside-click, focus return,
  disabled+tooltip wrapping). Port chrome.jsx `Btn` / `IconBtn` only
  for the top bar surface itself, where exact pixel fidelity to the
  design source matters. shadcn `Avatar` is skipped — the design
  uses an oklch hue + initials only, simpler as a 30-line bespoke
  component.
- **Theme buttons keep the popover open.** Documented product
  decision; implementation is just "don't call `setOpen(false)` from
  the theme handler".
- **Disabled "+ New calculator" + Tooltip.** Wrap the disabled button
  in a `<span>` so the Tooltip's hover/focus target stays mouse-
  active — the documented shadcn workaround for disabled buttons
  swallowing pointer events.
- **`AvatarPopover.isAdmin` prop** ships from day one as `false` for
  every PROJ-4 caller. PROJ-19 will flip it to `true` for sysadmin
  users and the Admin row will render above Settings — no
  restructuring needed then.
- **`(app)` layout-level error.tsx is out of scope** for PROJ-4. If a
  child page throws, the existing Next.js error boundary handles it.
  PROJ-4 only ships the not-found surface; a chrome-aware error
  surface can land later if real failures justify it.
- **No new client/server boundary inside slots.** `rightExtras`,
  `mobileLeftSlot`, `mobileCenter` accept any `ReactNode`; downstream
  features can pass either Server or Client subtrees.

### Forward-compat seams (the props PROJ-6 / 8 / 10 / 19 will wire)

| Seam | PROJ-4 default | Future caller |
|------|---------------|--------------|
| `<AppShell rightExtras>` | omitted | PROJ-6 / 8 calculator-theme picker on the editor |
| `<AppShell mobileLeftSlot>` | omitted (mini Wordmark default renders) | PROJ-8 mobile Grid drawer toggle |
| `<AppShell mobileCenter>` | omitted (pathname-derived title) | PROJ-8 live calculator title |
| Tab nav 2nd-segment override on the desktop bar | placeholder "Untitled calculator" on `/editor/*` | PROJ-8 supplies the live calculator title |
| `<AvatarPopover isAdmin>` | `false` always | PROJ-19 reads `role === 'sysadmin'` and flips to `true` |
| `+ New calculator` button position + style | disabled with "Coming soon" tooltip | PROJ-10 enables the click handler and removes the tooltip |

### Security headers (drop-in)

Single rule in `next.config.ts` `headers()`:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

Applied to `/:path*` — covers `/dashboard`, `/auth/*`, `/c/<token>`,
`/auth/admin/<token>/<action>`, and the not-found surface. CSP
deliberately omitted (product decision).

### Lighthouse baseline (one-shot)

Manual capture after deploy. Three surfaces × two form factors =
six runs; record the four category scores per run into the
"Lighthouse baseline (PROJ-4)" section of `docs/production/app-shell.md`
with the deploy date. No follow-up optimisation.

### Tests (mapping spec ACs → suites)

| Suite | What it covers |
|-------|---------------|
| `avatar-initials.test.ts` | All derivation cases from the spec: 2+ words, 1 word, null/empty name → email local-part fallback, single-char local-part, accented characters, whitespace-only, fallback `?` |
| `avatar-popover.test.tsx` | Open/close on outside click + Esc, theme buttons call `setTheme`, Settings link target, Sign-out form action+method, Admin row hidden when `isAdmin=false`, SYSADMIN pill conditional on `role` |
| `top-bar.test.tsx` | `buildBreadcrumbTabs` produces the right tab list per pathname; ellipsis at 280px (snapshot or computed-style assertion) |
| `tests/PROJ-4-app-shell.spec.ts` | Playwright walkthrough: dashboard → popover → dark theme → settings → /dashboard/nope → not-found → "Go to Dashboard"; runs in Chromium and Mobile Safari projects |
| (No new test for) the PROJ-3 15-case matrix | Existing tests run unchanged; the assertion is that they still pass after the AppShell lands |

### Dependencies (packages)

**No new packages.** Already installed:
- `next-themes` — App theme provider (existing)
- `@radix-ui/react-popover` via shadcn `popover` — avatar popover
- `@radix-ui/react-tooltip` via shadcn `tooltip` — disabled-button hint
- `@radix-ui/react-radio-group` via shadcn `radio-group` — theme picker semantics

The chrome icon set ports the SVG paths inline (no `lucide-react`
addition for shell primitives).

### Risk + non-risks

- **No DB risk.** Zero schema changes, zero new RLS, zero new env vars.
- **No PROJ-3 route-gate regression.** The middleware + layout gates
  fire before the AppShell renders; the shell only ever sees an
  approved profile. The 15-case matrix test suite from PROJ-3 stays
  green by construction.
- **Theme flash risk:** mitigated by `suppressHydrationWarning` on
  `<html>` (already in place) and `disableTransitionOnChange` on the
  ThemeProvider (already in place).
- **Security-headers rollout:** the four headers are zero-risk
  drop-ins per the template's documentation. If misconfigured, the
  app behaviour is unaffected; only the response headers change.
- **No CSP rollout:** intentional — sidesteps the misconfig-breaks-app
  failure mode for a v1 private-deploy. Documented and reversible.

## Implementation Notes (Frontend — 2026-05-23)

### What landed

- **Shell primitives** under `src/components/shell/`:
  `app-shell.tsx`, `top-bar-desktop.tsx`, `top-bar-mobile.tsx`,
  `avatar.tsx`, `avatar-initials.ts`, `avatar-popover.tsx`,
  `wordmark.tsx`, `sysadmin-pill.tsx`, `pill.tsx`, `btn.tsx`,
  `icon-btn.tsx`, `icons.tsx`, `empty-or-error-state.tsx`,
  plus an `index.ts` barrel.
- **`(app)/layout.tsx`** now wraps children in `<AppShell user={…}>`
  using the already-cached `getCurrentProfile()` result. No new
  DB round-trips.
- **`(app)/not-found.tsx`** renders `<EmptyOrErrorState>` inside
  the AppShell (the layout wraps the not-found view automatically).
- **Design tokens** wired as a parallel `--cg-*` CSS variable
  layer in `src/app/globals.css`, exposed under Tailwind's
  `colors.cg.*` namespace via `tailwind.config.ts`. The shadcn
  token set is untouched.
- **Production security headers** added to `next.config.ts` —
  four headers (X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, HSTS) on `/:path*`. CSP omitted by design.
- **Tests:** `avatar-initials.test.ts`, `top-bar.test.tsx`,
  `avatar-popover.test.tsx` (Vitest); `tests/PROJ-4-app-shell.spec.ts`
  (Playwright).
- **Docs:** `docs/production/app-shell.md` covering the App vs.
  Calculator theme distinction, initials rules, route-group
  conventions, slot wiring guide, deferred-feature notes, the
  security-headers wiring (with pointer to the canonical doc),
  and a Lighthouse baseline placeholder filled in at /deploy.

### Decisions made during implementation

- **Top bar position** uses `sticky top-0 z-30` instead of CSS
  `position: fixed`. Same visual outcome (the bar stays at the
  top of the viewport when scrolling) but keeps the bar in
  document flow so child pages don't need to reserve padding-top.
- **Icons** ported as a typed `Icons` namespace. Only the subset
  needed by PROJ-4 ships in `icons.tsx` (Plus, Sun, Moon, Monitor,
  Settings, Logout, Shield, Menu, NotFound, plus chev/minus
  variants); future features can extend the namespace as they
  need new glyphs.
- **`Pill`** is shipped now (listed in the spec ports) even
  though no PROJ-4 surface uses it — future features (PROJ-10
  publish state, PROJ-21 import-preview diff) will consume it.
- **`AvatarPopoverContent`** is exported separately from the
  `<AvatarPopover>` wrapper so the popover body can be
  unit-tested directly without going through the Radix trigger.
- **Disabled `+ New calculator`** uses a `<span>` wrapper inside
  the Tooltip trigger so the tooltip still fires when the
  underlying shadcn `Button` is disabled — the documented
  shadcn pattern.

### Status of acceptance criteria

- All unit-testable ACs covered by `npm test`.
- E2E walkthrough covered by `tests/PROJ-4-app-shell.spec.ts`.
- Hardening ACs (Lighthouse baseline, security-headers curl
  verification, the deploy-section of docs/production/app-shell.md)
  are filled in by the /deploy step.

### Deferred — Known Issues

- **Disabled "+ New calculator" tooltip is mouse-only.** Native
  HTML's `disabled` attribute removes the element from the tab
  order by spec, so keyboard / screen-reader users cannot land on
  the disabled button and hear the "Coming soon — calculator
  creation ships with PROJ-10" Tooltip. Closing this gap would
  require dropping native `disabled` in favour of
  `aria-disabled="true" tabIndex={0}` plus a manual `onClick`
  guard, which is added complexity for an affordance that
  disappears completely in PROJ-10. Tracked as deferred-known-issue;
  resolution = PROJ-10 (which removes both the disabled state and
  the tooltip when it wires the real creation flow).

## QA Test Results

**Tested by:** /qa (2026-05-23)
**Environment:** Local Vitest + Playwright (Chromium + Mobile Safari)
against `npm run dev`, real Supabase Cloud project.

### Summary

| Suite               | Result                         |
| ------------------- | ------------------------------ |
| `npm test`          | **PASS** — 13 files, 91 tests  |
| `npm run lint`      | **PASS** — clean               |
| `npx tsc --noEmit`  | PASS for PROJ-4 files (3 pre-existing errors in PROJ-3's `signup/actions.test.ts` — unrelated, not a PROJ-4 regression) |
| `npx playwright test tests/PROJ-4-app-shell.spec.ts` | **2 failed / 1 skipped / 3 passed** |

E2E walkthrough fails on both Chromium and Mobile Safari for distinct
reasons. Security-headers E2E **passes** (all four headers confirmed
on `/auth/login`). Disabled "+ New calculator" tooltip E2E **passes**
on Chromium, skipped on Mobile Safari.

### Acceptance criteria audit

Each section below reports the criteria's status; only failures and
notable observations are described in detail.

#### AppShell — desktop layout
- **PASS** Top bar `sticky top-0 z-30 h-12`, full width, surface
  background, 1px bottom border (`top-bar-desktop.tsx:84-89`).
- **PASS** Order: Wordmark → divider → tabs → flex spacer → rightExtras
  → "+ New calculator" → Avatar.
- **PASS** Wordmark wraps `<Link href="/dashboard">`.
- **PASS** Layout matches `docs/design/chrome.jsx` semantics (spacing
  tokens consumed from `--cg-*` layer; pixel parity not required).

#### Tabs / breadcrumb (desktop)
- **PASS** All 5 ACs covered by `buildBreadcrumbTabs` helper and its
  unit tests in `top-bar.test.tsx`.
- **PASS** Active segment ellipsises at `max-w-[280px]`
  (`top-bar-desktop.tsx:121`).

#### Right-slot extras
- **PASS** `rightExtras` prop accepts ReactNode; no empty container
  when omitted.

#### "+ New calculator" button
- **PASS** Disabled with `aria-disabled="true"` + native `disabled` +
  shadcn `Tooltip` "Coming soon — calculator creation ships with
  PROJ-10".
- **PASS** Click is a no-op on the disabled button.
- **L1 — see Bugs** "Mobile bar (< 768px) is rendered, then '+ New
  calculator' is **not rendered** at all" — the desktop bar is
  CSS-hidden via `hidden md:flex` rather than gated by JS, so the
  disabled button is still in the DOM on mobile.

#### Avatar — initials derivation
- **PASS** All 6 ACs covered by `avatar-initials.test.ts`.

#### Avatar popover — content + behaviour
- **PASS** Header, theme picker, Settings link, Sign-out form action
  + method, Admin row hidden when `isAdmin=false`, SYSADMIN pill
  conditional on `role === 'sysadmin'`.
- **PASS** Outside click + Esc handled by shadcn `Popover` (Radix
  primitive).
- **PASS** Theme button keeps popover open (no `setOpen(false)` in
  handler; `setTheme()` is the only side effect).
- **PASS** Sign-out wired as `<form action="/auth/sign-out" method="post">`.
- **OBSERVED** `useTheme()` hydration guard (`mounted` flag) holds
  off the active-state highlight until after mount to avoid theme
  hydration mismatch — correct behaviour, but means the first paint
  shows all three theme buttons in their "inactive" state before
  switching to the persisted choice. Acceptable.

#### Mobile top bar
- **PASS** 48px tall, contains Wordmark / page-title / Avatar; no
  "+ New calculator", no breadcrumbs, no hamburger.
- **PASS** `/dashboard` mobile: mini Wordmark + "Calcgrinder"
  centred. `/settings` mobile: "Settings". `/editor/<id>` mobile:
  "Calculator" placeholder.
- **PASS** Avatar tap opens the popover; Radix collision-padding
  handles right-edge overflow.

#### Mobile-left + mobile-center slots
- **PASS** Both slots accept ReactNode; defaults render correctly
  when omitted.

#### App theme — provider + persistence
- **PASS** ThemeProvider reused from root layout (`src/app/layout.tsx`
  → `src/components/theme-provider.tsx`); default "system";
  `suppressHydrationWarning` is in place from the template.
- **PASS** Theme persists across navigation and sign-out (Auth + App
  share the same root provider via the root layout).

#### Not-found inside (app) group
- **PASS** A child page that calls `notFound()` triggers
  `src/app/(app)/not-found.tsx` (Next.js convention).
- **H1 — see Bugs** An approved user navigating to an unmatched URL
  inside `(app)` (e.g. `/dashboard/nope`, `/widgets`, `/editor`
  without an id) renders the **default Next.js 404 page** ("404 /
  This page could not be found") **instead of** the AppShell +
  EmptyOrErrorState surface. The Playwright walkthrough was able to
  reach the URL and capture the response — the snapshot shows the
  generic Next.js 404.
- **PASS** Anonymous browser → middleware redirects to
  `/auth/login?next=<original-path>` (verified via curl:
  `GET /dashboard/nope` →
  `Location: /auth/login?next=%2Fdashboard%2Fnope`).
- **PASS** Pending / declined users hit the layout's status gate
  before any not-found rendering.
- **PASS** Copy uses user-level vocabulary ("Page not found", "We
  couldn't find that page.") — no "404", no "URL", no "route". (The
  bug is that this copy never renders for unmatched URLs.)

#### EmptyOrErrorState primitive
- **PASS** All 4 ACs satisfied (`empty-or-error-state.tsx`).

#### Sysadmin pill
- **PASS** Pill conditional on `role === 'sysadmin'`; never appears
  for regular users.

#### Top-bar primitives — port from chrome.jsx
- **PASS** All primitives shipped under `src/components/shell/`:
  Wordmark, Avatar, Pill, Btn, IconBtn, SysadminPill, TopBarDesktop,
  TopBarMobile, AvatarPopover, AppShell, Icons set.
- **PASS** `--cg-*` token block defined for `:root` and `.dark` in
  `globals.css:55-79, 122-145`; Tailwind exposes `colors.cg.*`.
- **PASS** shadcn `Button`, `Tooltip`, `Popover` are used where
  off-the-shelf behaviour is available; `Btn` / `IconBtn` ports only
  power chrome surfaces.

#### Page metadata
- **PASS** `/dashboard` → "Dashboard · Calcgrinder",
  `/settings` → "Settings · Calcgrinder",
  `/editor/[id]` → "Editor · Calcgrinder".

#### Route gating regression
- **PASS** Anonymous `GET /dashboard/nope` returns
  `307 → /auth/login?next=...` (PROJ-3 middleware unchanged).
- **PASS** `(app)` layout still calls `getCurrentProfile()` once and
  redirects pending / non-approved users to
  `/auth/waiting-for-approval`.
- **PASS** PROJ-3 unit + E2E suites (route-gate, login actions,
  signup actions, confirm route, admin process) all green.

#### Hardening — production security headers
- **PASS** `next.config.ts` returns the exact four headers from
  `docs/production/security-headers.md` on `source: '/:path*'`.
- **PASS** Verified locally:
  ```
  curl -I http://localhost:3000/
  → 307 Temporary Redirect
    X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
    Referrer-Policy: origin-when-cross-origin
    Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```
  E2E test `production security headers are present on all responses`
  passes against `/auth/login` (200 response).
- **PASS** CSP is deliberately **not** set.
- **DEFERRED** Post-deploy verification (`curl -I` against the live
  domain on `/dashboard`, `/c/<any-token>`,
  `/auth/admin/<any-token>/approve`) — landed in `/deploy`.

#### Hardening — Lighthouse baseline
- **DEFERRED** Captured during `/deploy`. The placeholder table in
  `docs/production/app-shell.md` is in place with TBD values.

#### Tests
- **PASS** `avatar-initials.test.ts` — 9 cases (2+ words, single word,
  null/empty/whitespace name, single-char local-part, accented chars,
  fallback `?`).
- **PASS** `avatar-popover.test.tsx` — 8 cases (name+email render,
  null-name dash, SYSADMIN pill conditional, Admin row hidden / shown,
  theme buttons call `setTheme`, Settings link target, Sign-out form
  action+method).
- **PASS** `top-bar.test.tsx` — 6 cases (tab assembly per pathname,
  editorTitle override, unmatched fallbacks).
- **PARTIAL** `tests/PROJ-4-app-shell.spec.ts` (Playwright) — see
  Bugs H1 and M1. The not-found stop on the walkthrough fails on
  Chromium because of H1; on Mobile Safari the walkthrough fails at
  the first step because the assertion is desktop-only (M1). 1
  skipped is the intentional `isMobile` skip on the "+ New
  calculator" tooltip test.

#### Documentation
- **PASS** `docs/production/app-shell.md` covers App vs Calculator
  theme distinction, initials rules, route-group conventions, slot
  wiring, deferred items, security-headers wiring (with pointer to
  `docs/production/security-headers.md`), Lighthouse baseline
  placeholder.

### Bugs

#### **H1 (High)** — Unmatched URLs inside `(app)` fall through to the default Next.js 404 page
**Severity:** High
**AC reference:** "Not-found inside the (app) group" — the first
acceptance criterion ("an approved user navigates to a route that
doesn't match any (app) page … then `src/app/(app)/not-found.tsx`
renders the full AppShell").
**Steps to reproduce:**
1. Sign in as an approved user.
2. Type `/dashboard/nope` (or `/widgets`, or `/editor`) in the
   browser URL bar.
3. **Expected:** AppShell renders with the active "Dashboard" tab
   visible, body shows the `EmptyOrErrorState` with "Page not found"
   headline and a "Go to Dashboard" button.
4. **Actual:** The generic Next.js 404 page renders ("404 / This
   page could not be found"), with no chrome and no path back to the
   dashboard. Confirmed via Playwright snapshot from the failing
   Chromium walkthrough:
   ```
   - heading "404" [level=1]
   - heading "This page could not be found." [level=2]
   ```
**Root cause (engineering-side):** Next.js's per-route-group
`not-found.tsx` fires for `notFound()` calls within the group, but
unmatched URLs are routed through the *root* `not-found.tsx`. There
is no root `src/app/not-found.tsx`, so Next.js falls back to its
default 404 page and never enters the `(app)` segment to render
`(app)/not-found.tsx`. Suggested fix (frontend): add a catch-all
`src/app/(app)/[...slug]/page.tsx` that calls `notFound()`, which
will then route through `(app)/layout.tsx` (running the gate,
fetching the profile, rendering the AppShell) and surface
`(app)/not-found.tsx`. The catch-all must be the lowest-priority
match so it doesn't shadow `dashboard/`, `settings/`, `editor/[id]`.

#### **M1 (Medium)** — E2E walkthrough asserts the breadcrumb nav on Mobile Safari, where it is desktop-only by design
**Severity:** Medium (test bug, not a feature bug)
**Steps to reproduce:**
1. `npx playwright test tests/PROJ-4-app-shell.spec.ts --project="Mobile Safari"`.
2. The walkthrough test fails at the first step with
   `expect(getByRole('navigation', { name: /breadcrumb/i })).toBeVisible()`.
**Why it's a test bug:** The mobile bar deliberately omits the
breadcrumb (per spec: "Wordmark mini + page-title center + avatar.
No '+ New calculator' button, no Dashboard/Settings tabs, no
hamburger"). The Playwright snapshot of the failing Mobile Safari
run shows the mobile bar rendering correctly (Wordmark + Calcgrinder
+ Open account menu).
**Suggested fix (qa/frontend):** in the walkthrough, branch on
`isMobile`. For mobile, assert the mobile-bar contents (mini wordmark
+ "Calcgrinder" centre text) instead of the breadcrumb nav. The
not-found assertion (heading "Page not found") would still need to
pass on both projects once H1 is fixed.

#### **L1 (Low)** — `+ New calculator` button is in the DOM on mobile, not literally "not rendered"
**Severity:** Low
**AC reference:** "Given the mobile top bar (< 768px) is rendered,
when inspected, then the '+ New calculator' button is **not
rendered** at all."
**Steps to reproduce:**
1. Open the app on a viewport < 768px.
2. Inspect the DOM. The desktop `<header>` is present with class
   `hidden md:flex` — the disabled button lives inside it, just
   visually hidden.
**Impact:** Behaviour is correct (button is never visible or
focusable for mobile users). The literal "not rendered at all"
phrasing in the AC is not strictly met, but the user experience is
identical to a JS-gated render. If we want literal compliance:
either render the desktop bar conditionally on a media-query hook,
or simply remove the AC's "at all" wording to acknowledge CSS-gated
rendering.

#### **L2 (Low)** — Disabled `+ New calculator` tooltip is mouse-only
**Severity:** Low
**AC reference:** "the disabled '+ New calculator' button + screen
reader … screen readers announce the button as disabled with the
'Coming soon' hint."
**Steps to reproduce:**
1. With a screen reader (VoiceOver / NVDA), tab through the desktop
   top bar.
2. The disabled button is skipped — native HTML `disabled` removes
   it from the tab order. The tooltip text is not announced because
   the button can't receive focus.
**Impact:** Mouse users get the "Coming soon" hint on hover.
Keyboard / screen-reader users skip the affordance entirely and miss
the explanation. PROJ-10 will replace this button with the real
creation flow, at which point the tooltip / disabled state goes
away — so the accessibility gap has a short shelf life. If we want
to close it sooner, drop the native `disabled` and rely on
`aria-disabled="true"` + `tabIndex={0}` so screen readers can land
on the button.

### Security Audit (Red Team)

| Vector                                   | Result                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `dangerouslySetInnerHTML` / `innerHTML` / `eval` in shell + (app) pages | **None** — verified by grep. All profile fields flow through React text nodes. |
| Profile-data exposure in client bundle   | **OK** — only the current user's own `{name, email, role}` is serialised to the client component; same data is already in the user's session. |
| XSS via profile.name (e.g. `<script>` in name) | **OK** — React auto-escapes; manually crafted name "<script>alert(1)</script>" would render as text. |
| Auth bypass — unmatched URL inside (app) | **OK** — anonymous `GET /dashboard/nope` redirects to `/auth/login?next=%2Fdashboard%2Fnope`. Middleware fires before any layout / page. |
| Authorisation — pending user accessing (app) routes | **OK** — `(app)/layout.tsx:13-15` redirects non-approved users to `/auth/waiting-for-approval`. |
| Sign-out CSRF                             | **OK (same as PROJ-3)** — the `<form action="/auth/sign-out" method="post">` issues a same-origin POST; PROJ-3's sign-out handler already runs server-side. No new attack surface introduced. |
| Production security headers              | **PASS** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `HSTS: max-age=31536000; includeSubDomains` confirmed live on dev server `/` and `/auth/login`. CSP intentionally not set. |
| Theme persistence — localStorage         | **OK** — only the literal string `"light"`, `"dark"`, or `"system"` is stored. No user-controllable content. |

No new env vars, no DB writes, no RLS policy changes.

### Regression check on deployed features

| Feature           | Touched by PROJ-4?               | Result                                                                                              |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| PROJ-1 Supabase   | No                               | N/A                                                                                                 |
| PROJ-2 Email      | No                               | N/A                                                                                                 |
| PROJ-3 Auth       | `(app)/layout.tsx` wraps `<AppShell>` around the existing gate; middleware untouched | **PASS** — `route-gate.test.ts`, `login/actions.test.ts`, `signup/actions.test.ts`, `confirm/route.test.ts`, `admin/process.test.ts` all green. Anonymous redirect to `/auth/login?next=…` verified via curl. |

### Production-ready decision

**NOT READY**.

H1 is a High-severity functional regression against an explicit
acceptance criterion: unmatched URLs inside `(app)` show the
generic Next.js 404 instead of the chrome-aware `EmptyOrErrorState`.
This must be fixed before deploy.

M1 is a test bug that masks downstream confidence in the E2E suite
and must also be resolved before signing off the feature. L1 and L2
are nice-to-haves that can be triaged at the user's discretion.

### Recommended next steps

1. **Fix H1**: add `src/app/(app)/[...slug]/page.tsx` that calls
   `notFound()`. Verify by running the Playwright walkthrough on
   Chromium and watching the not-found page render with the
   AppShell intact.
2. **Fix M1**: branch the walkthrough on `isMobile` (assert
   breadcrumb on desktop, assert the mobile bar's center-segment
   on Mobile Safari).
3. Decide whether to close L1 / L2 now or punt to PROJ-10
   (which replaces the disabled button entirely).
4. Re-run `npm test` and `npm run test:e2e` — once both projects
   pass, status moves to **Approved** and `/deploy` can proceed.

---

### Re-test after fix pass (2026-05-23)

**Resolutions applied:**

- **H1 — Fixed.** Added `src/app/(app)/[...slug]/page.tsx` (a
  catch-all that calls `notFound()`). Next.js matches static
  segments before catch-alls, so `/dashboard`, `/settings`, and
  `/editor/[id]` still route normally. Unmatched URLs like
  `/dashboard/nope`, `/widgets`, `/editor` now flow through the
  `(app)` layout (status gate fires first) and surface
  `(app)/not-found.tsx`, which renders the full AppShell +
  EmptyOrErrorState.
- **M1 — Fixed.** Walkthrough now branches on Playwright's
  `isMobile` fixture: desktop runs the breadcrumb assertions
  unchanged; mobile asserts the brand title in the mobile bar's
  centre segment instead.
- **L1 — Closed as spec clarification.** AC reworded from "not
  rendered at all" to "not visible to the user" — explicitly
  permitting CSS-based hiding. No code change needed.
- **L2 — Deferred to PROJ-10.** Documented under "Deferred —
  Known Issues" in the Implementation Notes section. Resolution
  ships when PROJ-10 replaces the disabled button with the real
  creation flow.

**Re-test results:**

| Suite                           | Result                                      |
| ------------------------------- | ------------------------------------------- |
| `npm test`                      | **PASS** — 13 files, 91 tests               |
| `npm run lint`                  | **PASS**                                    |
| `npx playwright test tests/PROJ-4-app-shell.spec.ts` | **5 passed / 1 skipped** (the intentional `isMobile` skip on the "+ New calculator" tooltip test) |
| Full `npx playwright test` (regression sweep) | **33 passed / 1 skipped** — no PROJ-1 / PROJ-3 regressions |

### Production-ready decision (final)

**READY.** No outstanding Critical or High bugs. L2 is documented
as a known deferred item with a tracked resolution in PROJ-10.

Next step: `/deploy` to ship PROJ-4 to production. The deploy
pass owns the post-deploy security-header verification (`curl -I`
against the live domain) and the Lighthouse baseline capture
into `docs/production/app-shell.md`.

## Deployment
_To be added by /deploy_
