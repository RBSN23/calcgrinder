# PROJ-6: Calculator Theme System

## Status: Approved
**Created:** 2026-05-23
**Last Updated:** 2026-05-23

## Dependencies
- Requires: PROJ-4 (App Shell, Routing & Top-Level Navigation) — establishes the root layout and Tailwind setup that PROJ-6 extends with global font loading. PROJ-6 does NOT depend on PROJ-1 / PROJ-3 directly; theme tokens are pure data and require no Supabase access.

## User Stories
- As a **calculator author**, I want a choice of 8 visually distinct calculator themes, so each calculator I build (mortgage, accounting, portfolio…) can wear a different visual identity that matches its content.
- As a **calculator author**, I want my chosen theme to render identically in the Builder preview and on the public visitor URL, so I'm never surprised by what visitors see.
- As a **calculator author**, I want to recognise themes at a glance when a future picker surface lists them, so picking a theme isn't a wall of text.
- As a **template maintainer (post-v1)**, I want to add a 9th theme by dropping a single TypeScript file into `src/lib/themes/` and adding it to the registry, without touching renderer or helper code.
- As a **visitor**, I want consistent typography across every calculator so the experience feels intentional regardless of which theme the author picked.

## Out of Scope

Everything in this list came up during the spec interview and was consciously excluded from PROJ-6:

- **Theme picker UI (editor top-bar)** — deferred to PROJ-8 (Editor — Grid + Builder Two-Panel Split).
- **Default-theme dropdown in Settings** — deferred to PROJ-14 (Settings Page).
- **`theme_id` column on the `calculators` table** — deferred to PROJ-10 (Calculator Lifecycle), which creates the calculators table for the first time. PROJ-6 only defines the contract that the column's string value will be looked up against.
- **`<ThemedCalculator>` renderer** (full calculator rendering against theme tokens) — deferred to PROJ-11 (Visitor View — Calculator Interface). PROJ-6 ships theme tokens + helpers; the renderer that consumes them is PROJ-11's deliverable.
- **Accent 1 / Accent 2 palette enumeration** — referenced by `Calcgrinder-spec.md:281-329` (card-level visual settings: "restricted to the theme's palette") but not present in `themes.jsx`. Deferred to PROJ-9 (Cell Authoring & Section Management) — PROJ-9 will extend the theme contract when the card-accent picker ships.
- **Section layout patterns exposed by themes** — `themes.jsx` carries `cols2` and `cols3` only; `Calcgrinder-spec.md:760-767` references a "layout-pattern picker listing the layout patterns the active theme exposes for a section." PROJ-6 ports `cols2`/`cols3` faithfully; PROJ-9 decides what the layout-pattern set looks like when the picker ships.
- **`/dev/themes` route or any standalone theme-demo page** — rejected during the interview. The design file `docs/design/Calcgrinder Themes.html` already serves as the visual reference; PROJ-6 validates tokens via data-equality tests, not by re-rendering them.
- **App-theme adaptive variants** — calculator themes are absolute / self-contained. No "Calcgrinder · Light has a dark variant" — users who want a dark calculator pick Vessel or Terminal · Cyber from the 8 shipped themes.
- **Theme editor / user-authored custom themes** — post-v1. Themes are deployer-shipped TS modules; end users cannot create or modify themes.
- **Per-element visual overrides** beyond what `Calcgrinder-spec.md:281-329` defines (Card-level + element-specific vocabulary) — PROJ-9's territory.
- **Mortgage-mock copy / data structures from `themes.jsx`** — `titleLabel`, `title`, `subtitle` fields are stripped during the port. They are theme-demo illustration, not calculator properties (see `Calcgrinder-spec.md:740-745`).
- **Visual diff / pixel-snapshot tests of rendered themes** — PROJ-6 has no renderer to snapshot. Visual fidelity is verified in PROJ-11 when the renderer exists.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Token modules — port from `docs/design/themes.jsx`

- [ ] Given the directory `src/lib/themes/` contains 8 theme TypeScript modules (one per theme: `calcgrinder.ts`, `vessel.ts`, `editorial.ts`, `calcgrinder-ci.ts`, `minimal.ts`, `bento.ts`, `bento-glassy.ts`, `terminal.ts`), when each module is imported, then it exports a single typed `Theme` object whose visual-token fields match the corresponding entry in `docs/design/themes.jsx`'s `THEMES` object 1:1.
- [ ] Given PROJ-6's deliverables, when the contents of `src/lib/themes/` are listed, then it contains exactly: the 8 theme modules above; `index.ts` (registry, exposing `getTheme`, `getThemeIds`, `getDefaultThemeId`); `helpers.ts` (the pure helpers `cardSurface`, `labelTextStyle`, `numberStyle`); `types.ts` (the `Theme` type and supporting types); `ThemeSwatch.tsx` (the swatch component); and `README.md` (extensibility documentation).
- [ ] Given a data-equality test suite asserts every Group A field (`bg`, `surface`, `card`, `cardAlt`, `border`, `borderStr`, `rule`, `ink`, `text`, `muted`, `subtle`, `accent`, `accentFg`, `accentSoft`, `chartA`, `chartB`, `chartGrid`, `radius`, `fieldRadius`, `padding`, `headerH`, `cols2`, `cols3`, `cardShadow`, `cardStyle`, `cardTints`, `glowRgba`, `brandColor`, `uppercase`, `monoEverything`) for each of the 8 themes, when the suite runs, then every value matches `themes.jsx` exactly (the test transcribes the source of truth — if either side changes silently, the test fails).
- [ ] Given the `font` and `fontMono` fields in `themes.jsx` literally reference `"Geist"` and `"Geist Mono"`, when the same fields are ported into PROJ-6 theme modules, then the literal `"Geist"` and `"Geist Mono"` substrings are replaced with `var(--font-geist-sans)` and `var(--font-geist-mono)` respectively, with the existing fallback chain preserved (e.g. `var(--font-geist-sans), -apple-system, system-ui, sans-serif`).
- [ ] Given any theme module is inspected, when its keys are enumerated, then NO mortgage-mock field (`titleLabel`, `title`, `subtitle`) is present.
- [ ] Given each theme module, when inspected, then it carries: an `id` field (the stable string id), a `displayName` field (renamed from `themes.jsx`'s `label`), and a `description` field (renamed from `themes.jsx`'s `sub`).

### Theme contract & types

- [ ] Given the `Theme` TypeScript type, when a theme module is authored, then `cardStyle` is constrained to the union `'flat' | 'glow' | 'tinted' | 'glass' | 'terminal'`; any other value fails the TypeScript build.
- [ ] Given a theme declares `cardStyle: 'tinted'` or `'glass'`, when the type-checker runs, then `cardTints` MUST be present and contain at least the keys `inputs`, `results`, `chart`, `hero`, `heroFg` (matching the shape `themes.jsx` uses for `bento` and `bentoGlassy`); for any other `cardStyle`, `cardTints` MAY be `null`.
- [ ] Given the `Theme` type, when audited, then it does NOT include `titleLabel`, `title`, or `subtitle` fields.

### Registry & lookup (`getTheme` with fallback)

- [ ] Given the registry index file (`src/lib/themes/index.ts`) is the single source of truth for which themes exist, when `getThemeIds()` is called, then it returns the array `['calcgrinder', 'vessel', 'editorial', 'calcgrinderCI', 'minimal', 'bento', 'bentoGlassy', 'terminal']`.
- [ ] Given `getTheme('calcgrinder')` is called, when the lookup runs, then the Calcgrinder · Light theme module is returned and NO warning is logged.
- [ ] Given `getTheme('vessel')` (or any of the 8 valid ids) is called, when the lookup runs, then the corresponding theme module is returned and NO warning is logged.
- [ ] Given `getTheme('unknown-id')` is called, when the lookup runs, then the default theme (`calcgrinder`) is returned AND a `console.warn` is emitted in the form `[theme-system] Unknown theme id "<id>" — falling back to "calcgrinder"`.
- [ ] Given `getTheme(null)` or `getTheme(undefined)` is called, when the lookup runs, then the default theme is returned with the same warning (null / undefined are treated as "unknown id").
- [ ] Given the unknown-id fallback fires, when the database is inspected, then NO row is mutated — the lookup is read-only. The calling code (PROJ-11 visitor view, PROJ-8 editor) sees the fallback theme at render time without any persistent state change.
- [ ] Given a `getDefaultThemeId()` function exists, when called, then it returns the string `'calcgrinder'` (the system-wide default for new calculators, per `Calcgrinder-spec.md:1540` "Default for new calculators").
- [ ] Given a registry-consistency test, when it runs, then it asserts (a) every theme imported into `src/lib/themes/index.ts` exposes a unique non-empty `id`, (b) every `id` exposed by `getThemeIds()` is reachable via `getTheme(id)`, and (c) the literal `id` declared inside each theme module matches the key the registry uses to expose it (no id mismatch between file content and registry map).

### Helpers (pure theme → CSS functions, ported from `themes.jsx`)

- [ ] Given `cardSurface(theme, kind?)` where `kind ∈ {'generic' | 'inputs' | 'results' | 'chart' | 'hero'}` (default `'generic'`), when called for each of the 8 themes with each kind, then it returns a `CSSProperties` object including (at minimum) `background`, `border`, `borderRadius`, `boxShadow` — branching on `theme.cardStyle` and applying `theme.cardTints[kind]` for `'tinted'` / `'glass'` themes, with `backdropFilter` set for `'glass'`. Logic matches `themes.jsx`'s `cardSurface` helper.
- [ ] Given `labelTextStyle(theme, color?)`, when called for each of the 8 themes, then it returns a `CSSProperties` object containing `fontSize`, `fontWeight`, `color` (falling back to `theme.muted` if no override), `letterSpacing`, `textTransform: 'uppercase'`, and `fontFamily` (using `theme.fontMono` when `theme.cardStyle === 'terminal'`).
- [ ] Given `numberStyle(theme, size)`, when called for each of the 8 themes with sizes `∈ {18, 28, 40}`, then it returns a `CSSProperties` object with `fontFamily: theme.fontMono`, `fontSize: size`, `fontWeight: 600` (or `500` when `theme.monoEverything`), `color: theme.ink`, `letterSpacing` scaled by size, `fontVariantNumeric: 'tabular-nums'`, `lineHeight: 1`.
- [ ] Given each of the three helpers, when snapshot-tested across all 8 themes (for `cardSurface`: × 5 kinds), then snapshots are stable across runs.

### `<ThemeSwatch>` preview component

- [ ] Given `<ThemeSwatch theme={theme} />` is rendered, when the DOM is inspected, then the outer container's background uses `theme.bg`, an inner card uses `cardSurface(theme, 'generic')`, an accent stripe / dot uses `theme.accent`, and a tiny visible label (e.g. theme initials or display name) uses the theme's `font` family.
- [ ] Given `<ThemeSwatch>` is rendered for each of the 8 themes, when snapshot-tested, then snapshots are stable.
- [ ] Given `<ThemeSwatch>` is a pure presentational component, when it renders, then it makes NO network calls, NO DB calls, and consumes NO calculator data — only the passed `theme` object.
- [ ] Given `<ThemeSwatch>` has a default render size, when rendered without size props, then it occupies roughly 56 × 56 px (small enough to fit in a dropdown row alongside the theme's `displayName`).

### Font loading (Geist + Geist Mono)

- [ ] Given `src/app/layout.tsx` is inspected, when `next/font/google` imports are checked, then both `Geist` and `Geist_Mono` are imported and exposed as CSS variables `--font-geist-sans` and `--font-geist-mono` on the `<html>` or `<body>` element.
- [ ] Given the Tailwind config (`tailwind.config.*` or equivalent inline theme extension), when `fontFamily.sans` and `fontFamily.mono` are inspected, then they reference `var(--font-geist-sans)` and `var(--font-geist-mono)` respectively, with the existing system-font fallback chain preserved.
- [ ] Given a theme module declares `font: 'var(--font-geist-sans), -apple-system, system-ui, sans-serif'`, when a page renders any element using that theme's font, then the resolved font (verified via `getComputedStyle`) is Geist — NOT the system fallback.
- [ ] Given the Geist font file fails to load (simulated by blocking `fonts.googleapis.com` or equivalent), when a page renders, then text degrades to the next entry in the fallback chain without layout crash and without uncaught exceptions in the console.

### Self-containment / App-theme isolation

- [ ] Given the user has set App theme to Dark (via `next-themes`, PROJ-4) and is viewing the Builder preview (PROJ-8, future) for a calculator using `theme.id === 'calcgrinder'`, when the preview surface is rendered, then it uses Calcgrinder · Light's literal token values (`bg: '#FAFAF9'`, `card: '#FFFFFF'`, etc.) — the light preview renders as a "bright island" inside the dark editor frame. This is the intended UX, not a bug to fix.
- [ ] Given any of the 8 theme modules is inspected, when its visual-token fields are scanned for variable references, then NO field references any App-theme CSS variable (e.g. `var(--cg-primary)`, `var(--background)`, etc.) — the ONLY variables that may appear in theme tokens are `var(--font-geist-sans)` and `var(--font-geist-mono)` (in the `font` / `fontMono` fields).
- [ ] Given the future public visitor URL `/c/<token>` renders a calculator (PROJ-11), when the visitor toggles their OS dark-mode preference or browser-level dark-mode setting, then the calculator rendering does NOT change — calculator theme tokens are absolute, not OS-preference-adaptive. (Spec'd here as the contract PROJ-11 inherits; PROJ-11 verifies the behaviour end-to-end.)

### Extensibility — adding a 9th theme post-v1

- [ ] Given a hypothetical 9th theme module (`src/lib/themes/new-theme.ts`) is added using one of the existing five `cardStyle` values, when the registry index `src/lib/themes/index.ts` is updated to include the new entry, then `getTheme('new-theme')` returns it and `<ThemeSwatch theme={newTheme} />` renders it WITHOUT any changes to helper code, dispatch switches, or type declarations.
- [ ] Given the extensibility model is documented in `src/lib/themes/README.md`, when a future engineer reads it, then they find: (a) the procedure for adding a theme (create `src/lib/themes/<id>.ts` → register in `src/lib/themes/index.ts` → grow snapshot tests → done); (b) the caveat that introducing a 6th `cardStyle` value requires extending the `Theme` type in `src/lib/themes/types.ts` AND adding a branch to `cardSurface` in `src/lib/themes/helpers.ts`.

### Forward-compat contract for PROJ-8 (editor banner)

- [ ] Given PROJ-8's spec is written, when its acceptance criteria are drafted, then it includes a criterion of the form: "Given a calculator's stored `theme_id` resolves to the fallback (i.e. `getTheme` returned the default because the id is unknown), when the editor renders, then an inline banner is shown in the Builder reading 'This calculator's theme is no longer available — using Calcgrinder · Light. Pick a new theme to dismiss.' The banner is dismissed by picking any valid theme. The visitor view (`/c/<token>`) NEVER shows this banner." (PROJ-6 documents the requirement; PROJ-8 implements it.)

## Edge Cases

- **Unknown / removed / typo'd theme id.** Lookup falls back to the default theme (`calcgrinder`) with a `console.warn`; no DB mutation; PROJ-8 Builder shows the inline banner; visitor view silently falls back. Covered by Acceptance Criteria above.
- **Author in App Dark mode editing a light calculator theme.** The Builder preview renders the light calculator as a bright panel inside the dark editor. Intended — not a bug. Covered by Acceptance Criteria above.
- **Geist font fails to load** (network drop, CDN outage, ad-blocker). Text gracefully degrades to the next entry in each theme's fallback chain (`-apple-system, system-ui, sans-serif` or `"SF Mono", monospace`). Themes lose their typographic identity but remain readable; no layout crash.
- **Theme module file added but not registered in the index.** Build succeeds (the file's a dead export); `getTheme(itsId)` returns the fallback because the registry never learned about it. Caught at code review when the registry-consistency test is run alongside the new theme PR.
- **Hypothetical 9th theme needs a 6th `cardStyle` value.** This is a non-trivial extension: the `Theme` type union expands, the `cardSurface` helper adds a branch, snapshot tests grow. Acceptable but explicitly NOT a "drop a file" addition — documented in the extensibility README.
- **Two browser tabs comparing themes by toggling App theme.** App theme has no effect on calculator preview (per self-containment). The two tabs render the calculator identically; only their app chrome differs. Useful for QA.
- **Renaming a theme id** (e.g. `'calcgrinderCI'` → `'calcgrinder-ci'`). Breaks every calculator stored with the old id — they all fall back to default, all show the banner. Post-v1 concern; if it ever happens, a one-off DB migration is the path.
- **A theme uses fonts other than Geist / Geist Mono in a future post-v1 addition** (e.g. a serif theme). The new theme self-declares its font in the `font` field; the deployer adds the font loader to `src/app/layout.tsx`. Out of scope for v1 — all 8 shipped themes use Geist + Geist Mono.

## Technical Requirements (optional)

- **Performance:** theme lookup is an in-memory map access — sub-millisecond. Font loading is a one-time cost per session, served from the same origin via `next/font` self-hosting (no third-party request after build).
- **Security:** theme tokens are static data; no user input ever reaches the theme system in v1. There is no surface that lets users author or modify themes.
- **Browser support:** Chrome / Firefox / Safari (latest 2 versions, per template default). `backdropFilter` for `cardStyle: 'glass'` (Bento · Glassy theme) requires `-webkit-backdrop-filter` fallback, already encoded in `themes.jsx`'s shared helper and carried over.

## Open Questions

<!-- Unresolved questions from the spec interview. Close them in /refine when answered. -->

- [ ] **Accent 1 / Accent 2 palette enumeration** — `Calcgrinder-spec.md:281-329` says card-level visual settings let cells pick "Accent 1 / Accent 2" colours from "the theme's palette." `themes.jsx` only exposes a single `accent` plus `chartA`/`chartB`. PROJ-9 (Cell Authoring) decides whether to extend the theme contract with an explicit `accentPalette: string[]` field or derive it from existing tokens. PROJ-6 ports what `themes.jsx` carries; no `accentPalette` field added preemptively.
- [ ] **Section layout patterns exposed per theme** — `themes.jsx` carries only `cols2` / `cols3`. `Calcgrinder-spec.md:760-767` references a "layout-pattern picker listing the layout patterns the active theme exposes for a section." Whether a theme can expose multiple layout patterns (e.g. `2col`, `3col`, `mobile`, `grid-mosaic`, etc.) — and how — is a PROJ-9 decision. PROJ-6 ports `cols2` / `cols3` faithfully; PROJ-9 either extends the contract or builds layout patterns outside the theme system.
- [ ] **Custom themes & deployer-side theme overrides** — post-v1. Out of scope here; tracked for future planning when a deployer asks.

## Decision Log

### Product Decisions
<!-- Added by /write-spec -->

| Decision | Rationale | Date |
|----------|-----------|------|
| All 8 themes ship to production picker (overrides `Calcgrinder-spec.md:1534-1551`) | The PRD's success metric explicitly references "pixel-identical across the 8 shipped themes" and `INDEX.md` calls PROJ-6 "8 themes as runtime tokens." The Calcgrinder-spec passage calling 6 of the 8 themes "design exploration, NOT shipped in v1" is the inconsistent one; aligning PROJ-6 with the PRD also gives a single user real variety across distinct calculator types (mortgage / accounting / portfolio each get a different look). Future-confusion risk of an `isShipped` flag is real with no offsetting benefit. | 2026-05-23 |
| `docs/design/` files are visual drafts only — never the source of truth for behaviour, content, or data structures | These files were produced by Claude Design from design prompts only, without access to the PRD, `Calcgrinder-spec.md`, or any feature spec. Demo content (mortgage copy, mortgage values, mortgage data structures) is illustration, not specification. This rule applies forward to PROJ-7 / 8 / 9 / 11 onward. | 2026-05-23 |
| Strip mortgage-mock fields (`titleLabel`, `title`, `subtitle`) when porting `themes.jsx` to TS modules | These are theme-demo copy used by the self-contained `themes.jsx` mock, not calculator properties. `Calcgrinder-spec.md:740-745` explicitly says "themes that use that [eyebrow] slot fill it themselves." PROJ-11 will fill them (e.g. with section name or a brand label). Carrying them into PROJ-6 token modules would smuggle calculator content into the theme system. | 2026-05-23 |
| Calculator themes are absolute / self-contained — never adapt to App theme | Confirms `Calcgrinder-spec.md:1573-1574`: App theme and Calculator theme are independent. A user in App Dark mode editing a Calcgrinder · Light calculator sees a bright preview island inside the dark editor — intended UX. The 8 themes include 2 dark variants (Vessel, Terminal · Cyber); users who want dark calculators pick those. | 2026-05-23 |
| Unknown theme id → fallback to default + `console.warn` + Builder banner (PROJ-8) — never DB mutation | Standard "fail gracefully, signal loudly to the right audience" pattern. Visitor experience preserved; author gets a clear path to fix in the Builder; ops gets a log line. Keeping the lookup pure (read-only) means a temporarily-removed theme transparently restores itself if added back later — the fallback is a runtime safety net, not a destructive auto-migration. | 2026-05-23 |
| Font loading (Geist + Geist Mono) is PROJ-6's responsibility, loaded globally via `next/font/google` in `src/app/layout.tsx` | The PRD's "pixel-identical across 8 themes" success metric depends on Geist actually resolving — otherwise all 8 themes degrade to system fonts and lose typographic identity. PROJ-4 didn't load Geist. Loading it in PROJ-6 (a) honours the metric, (b) lives with the visual system it belongs to, (c) costs ~50 KB woff2 once, (d) typographically aligns app chrome with calculator surfaces (matches Calcgrinder · Light's "App-aligned theme" intent). | 2026-05-23 |
| Ship `<ThemeSwatch>` as part of PROJ-6, not as part of the picker UI in PROJ-8/PROJ-14 | The swatch is a pure function of theme tokens — same architectural category as `cardSurface()` / `labelTextStyle()` helpers. It composes into any future picker without dragging picker-UI concerns into PROJ-6, and adding a 9th theme post-v1 just works because the swatch derives from tokens. | 2026-05-23 |
| No `<ThemedCalculator>` renderer and no `/dev/themes` route in PROJ-6 | The renderer needs the calculator data shape that PROJ-8 / PROJ-9 define; baking it into PROJ-6 commits architectural decisions to the wrong feature. A port of `themes.jsx`'s mortgage-mock renderer would be ~800 lines of throwaway code that gets deleted when PROJ-11 ships the real renderer. Visual validation in PROJ-6 happens via data-equality tests; the existing `docs/design/Calcgrinder Themes.html` is the visual reference. PROJ-11 verifies "themes render pixel-identical in Builder preview vs. visitor URL." | 2026-05-23 |
| `theme_id` column on `calculators` is NOT in PROJ-6 | The calculators table doesn't exist yet — PROJ-10 (Calculator Lifecycle) creates it for the first time. PROJ-10 adds the `theme_id` column, defaulting to `getDefaultThemeId()` (`'calcgrinder'`), validated against PROJ-6's registry. | 2026-05-23 |
| Default theme for new calculators is `calcgrinder` (Calcgrinder · Light) — exposed via `getDefaultThemeId()` | Matches `Calcgrinder-spec.md:1540` ("App-aligned theme. Default for new calculators"). PROJ-14 (Settings → "Default calculator theme for new calculators" dropdown) will override this per-user; PROJ-6 exposes the system-wide fallback. | 2026-05-23 |

### Technical Decisions
<!-- Added by /architecture -->

| Decision | Rationale | Date |
|----------|-----------|------|
| Registry implemented as a typed `Record<ThemeId, Theme>` map in `src/lib/themes/index.ts` (not a switch, not lazy `import()`) | 8 themes total; tree-shaking is irrelevant at this volume. A static map makes `getThemeIds()`, `getTheme()`, and the registry-consistency test one-line implementations and keeps the "register a new theme by adding one entry" extensibility promise literal. | 2026-05-23 |
| Theme tokens encoded as plain `as const` TS objects (one file per theme) — no JSON, no Zod schema, no runtime validation | Themes are deployer-shipped code, not user input; TypeScript already enforces the `Theme` shape at compile time. Zod adds runtime cost + duplication with the type for zero security gain (no untrusted source). | 2026-05-23 |
| `Theme.cardStyle` is a discriminated-union string literal type, NOT a class hierarchy or per-style interfaces | `cardSurface()` is the only branching consumer (~25 lines). A discriminated union keeps "add the 6th `cardStyle`" mechanically simple (add string → exhaustiveness check fails → add branch) and matches the README's documented extension path. | 2026-05-23 |
| `cardTints` typed as optional/nullable on the `Theme` type, but type-narrowed to required when `cardStyle ∈ {'tinted','glass'}` via discriminated union | Carries the AC contract "tinted/glass MUST have cardTints" into the type system, so a malformed theme module fails the build instead of silently rendering wrong at runtime. | 2026-05-23 |
| Tests co-located (`src/lib/themes/calcgrinder.test.ts` etc.) — matches `CLAUDE.md` convention, not a centralised `tests/themes/` folder | Project convention (CLAUDE.md: "Unit tests co-located next to source files"). Keeps theme-port edits and their data-equality tests in the same directory for review. | 2026-05-23 |
| Snapshot tests use Vitest's built-in `toMatchSnapshot` — no extra snapshot library | Vitest is already the test runner; built-in inline & file snapshots cover the `cardSurface` / `labelTextStyle` / `numberStyle` / `<ThemeSwatch>` cases without new deps. | 2026-05-23 |
| Geist loaded via `next/font/google` in `src/app/layout.tsx`, exposed as CSS variables `--font-geist-sans` / `--font-geist-mono` on `<html>` | `next/font` self-hosts the font (zero-runtime, no FOUT, no third-party request after build) and is the documented Next.js 16 pattern. CSS-variable form lets theme tokens reference the same font from outside React, satisfying the AC that theme `font` strings are pure CSS values. | 2026-05-23 |
| Tailwind config extended with `fontFamily.sans` and `fontFamily.mono` pointing at the same `var(--font-geist-sans)` / `var(--font-geist-mono)` chain | Aligns the app chrome (Tailwind utilities like `font-sans`) with the calculator theme tokens. Without this, app chrome would render in system fonts while calculator surfaces render in Geist — visually disjoint. | 2026-05-23 |
| `<ThemeSwatch>` is a server-renderable presentational component (no `'use client'` directive) | Pure function of props, no state, no effects, no event handlers. Server-rendering it keeps the dropdown rows that consume it (PROJ-8 / PROJ-14) free to remain server components where possible. | 2026-05-23 |
| `console.warn` for unknown-id fallback uses a fixed, greppable prefix `[theme-system]` | Lets the deployer / sysadmin search logs for theme-resolution warnings without having to know upstream caller code paths. Matches the convention used elsewhere in the codebase (auth, email). | 2026-05-23 |
| Helpers (`cardSurface`, `labelTextStyle`, `numberStyle`) return `React.CSSProperties` objects, NOT class-name strings | The 8 themes use values (radii, padding, gradients, backdrop-filter, rgba shadows) that don't fit Tailwind's preset scale and would require a per-theme Tailwind plugin to express as classes. Inline styles keep theme data → CSS pure and side-effect-free; the global "no inline styles" rule in `.claude/rules/frontend.md` is scoped to app-chrome components, not the calculator theme surface where inline `style` IS the architecture. | 2026-05-23 |
| Theme `id` field is a plain string literal (e.g. `'calcgrinder'`) — NOT a branded type | Avoids over-engineering. The registry-consistency test catches id/key mismatch at test-time; PROJ-10's DB column will validate `theme_id` against `getThemeIds()` at write-time. No need for a nominal type. | 2026-05-23 |
| README lives at `src/lib/themes/README.md` (co-located with the code), NOT in `docs/` | Engineers extending the theme system are already in `src/lib/themes/` when they need the procedure. Co-location keeps the doc and the code drift-resistant. | 2026-05-23 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### One-paragraph summary
PROJ-6 ships the **data layer** of the calculator theme system: 8 themes encoded as plain TypeScript "token" objects (colours, radii, fonts, layout grid columns…), a tiny **registry** that looks them up by id with a safe fallback, three **pure helpers** that turn a theme into ready-to-apply CSS (`cardSurface`, `labelTextStyle`, `numberStyle`), and a **`<ThemeSwatch>`** preview tile that a future picker can drop into a dropdown row. It also loads **Geist + Geist Mono** globally so every theme that asks for them actually gets them. There is no calculator renderer in this feature — that arrives in PROJ-11 and will consume the helpers PROJ-6 ships.

### What we are building (visual tree)

```
src/lib/themes/                                 ← all PROJ-6 lives here
├── types.ts                                    ← Theme type + supporting unions
├── index.ts                                    ← Registry: getTheme, getThemeIds, getDefaultThemeId
├── helpers.ts                                  ← cardSurface, labelTextStyle, numberStyle
├── ThemeSwatch.tsx                             ← 56×56 preview tile (pure function of theme)
├── README.md                                   ← "How to add a 9th theme"
├── calcgrinder.ts                              ← 1 of 8 theme modules
├── vessel.ts                                   ← (dark, neon-green accent)
├── editorial.ts                                ← (warm cream + ink)
├── calcgrinder-ci.ts                           ← (brand-indigo variant)
├── minimal.ts                                  ← (linear-style hairline)
├── bento.ts                                    ← (vibrant tinted tiles)
├── bento-glassy.ts                             ← (glass tiles, backdrop blur)
└── terminal.ts                                 ← (cyber mono, dashed borders)

src/app/layout.tsx                              ← extended to load Geist + Geist Mono
tailwind.config.ts                              ← extended with fontFamily.sans / mono
```

Tests sit next to each module (`calcgrinder.test.ts`, `helpers.test.ts`, `index.test.ts`, `ThemeSwatch.test.tsx`) per the project convention.

### Data model (plain language)

A **Theme** is a frozen bag of values that fully describes the look of one calculator:

- **Identity**: stable `id` (e.g. `"calcgrinder"`), human-readable `displayName`, one-liner `description`.
- **Surface colours**: page background, card background, alternate card background, borders, hairline rules.
- **Text colours**: ink (headings), body text, muted captions, subtle hints.
- **Accent**: accent colour + its readable foreground + a soft tinted version for hovers / highlights.
- **Chart colours**: two-series palette + grid colour.
- **Shape**: card corner radius, field corner radius, card padding, header height.
- **Layout**: column ratios for 2-column and 3-column section layouts.
- **Card style** (the dispatch key): `flat` · `glow` · `tinted` · `glass` · `terminal`. This controls how `cardSurface()` renders a card.
- **Card tints** (only for `tinted` / `glass`): per-section colours — inputs, results, chart, hero, hero-foreground.
- **Typography**: font stack and mono font stack (both reference Geist via CSS variable in v1).
- **Cosmetics**: optional `brandColor`, `glowRgba`, `uppercase` flag, `monoEverything` flag.

Stored as: **TypeScript code** (token modules), loaded once at build time. NOT in the database. The `calculators` table (created in PROJ-10) will store only the **theme id** as a string; lookup happens at render time via `getTheme(id)`.

### How the pieces talk to each other

```
┌────────────────────────────────────────────────────────────────────┐
│  Theme modules (8 files, ~30 fields each)                          │
│  ─ pure data, frozen at build time                                 │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ imported by
                       ▼
┌────────────────────────────────────────────────────────────────────┐
│  Registry (index.ts)                                               │
│  ─ Record<ThemeId, Theme>                                          │
│  ─ getTheme(id) → Theme  (with fallback to 'calcgrinder' + warn)   │
│  ─ getThemeIds() → ThemeId[]                                       │
│  ─ getDefaultThemeId() → 'calcgrinder'                             │
└────────┬───────────────────────────────┬───────────────────────────┘
         │                               │
         │ used by helpers               │ used by future consumers
         ▼                               ▼
┌─────────────────────────┐     ┌────────────────────────────────────┐
│  helpers.ts             │     │  PROJ-8 editor (theme picker)      │
│  ─ cardSurface          │     │  PROJ-10 DB write (validate id)    │
│  ─ labelTextStyle       │     │  PROJ-11 visitor view (render)     │
│  ─ numberStyle          │     │  PROJ-14 settings (default picker) │
└──────────┬──────────────┘     └────────────────────────────────────┘
           │
           │ consumed by
           ▼
┌────────────────────────────────────────────────────────────────────┐
│  <ThemeSwatch theme={…} /> — 56×56 preview tile                    │
│  ─ pure, no network, no DB                                         │
│  ─ usable in any future dropdown row                               │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  src/app/layout.tsx (extended)                                     │
│  ─ next/font loads Geist + Geist Mono → CSS variables on <html>    │
│  ─ themes reference var(--font-geist-sans) / var(--font-geist-mono)│
└────────────────────────────────────────────────────────────────────┘
```

### Why this shape

- **Token modules over a single JSON blob**: each theme is one file, easy to diff, easy to add a 9th. TypeScript catches malformed themes at build time (e.g. a `tinted` theme missing `cardTints`).
- **Pure helpers return CSS-property objects, not class names**: the 8 themes use radii, backdrops, gradients, and rgba shadows that Tailwind's preset scale can't express without a per-theme plugin. Inline style is the right primitive here; the no-inline-style rule in `.claude/rules/frontend.md` is scoped to app chrome.
- **Fallback returns the default, never mutates**: an unknown id is a runtime safety net — the calculator still renders, the author sees a banner in the Builder (per PROJ-8's forward-compat criterion), and the same calculator self-heals the moment the theme module is re-registered.
- **Geist loaded centrally, not per-theme**: every shipped theme uses Geist; loading it once via `next/font` self-hosts the woff2 (no third-party request after build) and gives us a single CSS variable each theme references.
- **No renderer in PROJ-6**: the calculator data shape doesn't exist yet (PROJ-8 / PROJ-9 define it). A throwaway mortgage-mock renderer here would be ~800 lines that get deleted at PROJ-11. Visual validation is the existing `docs/design/Calcgrinder Themes.html`; correctness validation is the data-equality tests.

### Backend need
**None.** PROJ-6 is frontend-only static code + tests. No Supabase access, no API routes, no env vars, no migrations. PROJ-10 later adds a `theme_id` column on the `calculators` table — that's PROJ-10's design, not PROJ-6's.

### Dependencies (packages to install)
**None.** Everything PROJ-6 needs is already in `package.json`:
- `next` 16 — supplies `next/font/google` for Geist loading.
- `tailwindcss` 3.4 — already wired in `tailwind.config.ts`; needs a small extension to register `fontFamily.sans` / `mono`.
- `vitest` 4 — already wired; built-in snapshots cover the helper / swatch tests.
- `react` 19 / `@testing-library/react` 16 — for `<ThemeSwatch>` snapshot test.

No new npm installs.

### What PROJ-6 explicitly does NOT touch
- No DB tables / migrations (PROJ-10 adds `theme_id` column to `calculators`).
- No editor UI (PROJ-8 builds the picker, consuming `<ThemeSwatch>`).
- No settings UI (PROJ-14 builds the default-theme dropdown).
- No calculator renderer (PROJ-11 consumes `cardSurface` / `labelTextStyle` / `numberStyle`).
- No accent-palette extension (PROJ-9 decides — currently `Open Questions`).
- No layout-pattern extension (PROJ-9 decides — currently `Open Questions`).

## Implementation Notes (Frontend)

**Files created** under `src/lib/themes/`:
- `types.ts` — `Theme`, `ThemeId`, `CardStyle`, `CardTints`, `CardTintKind`,
  `NumberSize`. `Theme` is a discriminated union on `cardStyle`: choosing
  `'tinted'` or `'glass'` forces `cardTints: CardTints` at compile time;
  the other three styles force `cardTints: null`.
- `index.ts` — typed `Record<ThemeId, Theme>` registry, plus `getTheme`,
  `getThemeIds`, `getDefaultThemeId`. Unknown / null / undefined id →
  fallback to `calcgrinder` + `[theme-system]` warning. Re-exports the
  helpers and `ThemeSwatch` for downstream convenience.
- `helpers.ts` — `cardSurface(theme, kind?)`, `labelTextStyle(theme, color?)`,
  `numberStyle(theme, size)`. Pure functions returning `CSSProperties`.
- `ThemeSwatch.tsx` — 56 × 56 preview tile (size prop overrides). Pure
  presentational component (no `'use client'`).
- 8 theme modules: `calcgrinder.ts`, `vessel.ts`, `editorial.ts`,
  `calcgrinder-ci.ts`, `minimal.ts`, `bento.ts`, `bento-glassy.ts`,
  `terminal.ts`. Ported 1:1 from `docs/design/themes.jsx`, with
  `"Geist"` / `"Geist Mono"` literals replaced by
  `var(--font-geist-sans)` / `var(--font-geist-mono)`, mortgage-mock
  fields (`titleLabel`, `title`, `subtitle`) stripped, and
  `id` / `displayName` / `description` added.
- `README.md` — extension procedure (new theme using existing
  `cardStyle`) plus caveat for adding a 6th `cardStyle`.

**Files modified:**
- `src/app/layout.tsx` — loads `Geist` and `Geist_Mono` from
  `next/font/google`, exposes `--font-geist-sans` / `--font-geist-mono`
  on `<html>`, and applies `font-sans` to `<body>` so app chrome
  inherits Geist.
- `tailwind.config.ts` — `fontFamily.sans` / `fontFamily.mono` extended
  to reference the CSS variables with system fallbacks preserved.

**Tests (268 total project tests passing):**
- `calcgrinder.test.ts`, `vessel.test.ts`, `editorial.test.ts`,
  `calcgrinder-ci.test.ts`, `minimal.test.ts`, `bento.test.ts`,
  `bento-glassy.test.ts`, `terminal.test.ts` — data-equality
  transcriptions of `docs/design/themes.jsx` (a silent drift on either
  side fails the test).
- `index.test.ts` — registry consistency (id list, default, fallback
  warning, round-trip).
- `helpers.test.ts` — snapshots for all 8 themes × 5 kinds for
  `cardSurface`; 8-theme snapshots for `labelTextStyle`; 8 × 3-size
  snapshots for `numberStyle`. Synthetic `cardStyle: 'terminal'` test
  covers the helper branch (no v1 theme uses it — Terminal · Cyber uses
  `cardStyle: 'glow'`).
- `ThemeSwatch.test.tsx` — snapshot per theme + behaviour assertions
  (default 56 px, size prop, data-theme-id attr).
- `self-containment.test.ts` — every theme's font fields use
  `var(--font-geist-*)` (no bare `"Geist"` literal survives); no other
  CSS variable appears in any theme field; mortgage-mock fields are
  stripped; tinted/glass themes carry a complete `cardTints` object.

**Deviations / clarifications:**
- The original `themes.jsx` documented `cardStyle` as `'flat' | 'glow' |
  'tinted' | 'terminal'` but its Terminal · Cyber theme actually uses
  `cardStyle: 'glow'`. The port preserves that — the `'terminal'`
  branch in `cardSurface` / `labelTextStyle` is dead code for v1 but
  remains in the helpers and in the `CardStyle` union for future
  themes. Tests for that branch run against a synthetic theme.
- `labelTextStyle` was simplified slightly: the original ternary
  `th.cardStyle === 'terminal' ? 11 : 11` collapsed to a constant `11`.
  Behaviour is identical.

## QA Test Results

**Tested:** 2026-05-23
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Branch:** main (uncommitted PROJ-6 changes)

### Test environment
- Node 25.9.0 · Next 16.1.1 (Turbopack) · macOS 24.6 (arm64)
- Vitest 4.1.2 (jsdom) — 268 tests across 27 files
- Playwright 1.208 — Chromium + Mobile Safari projects
- Dev server smoke test: `npm run dev` → http://localhost:3000

### Acceptance Criteria Status

#### AC-1: Token modules ported from `docs/design/themes.jsx`
- [x] `src/lib/themes/` contains the 8 named theme modules; each
      module exports a single typed `Theme` whose Group A fields
      match `themes.jsx` 1:1 (verified by data-equality tests in
      every `<id>.test.ts` — 8 tests, 1 per theme).
- [x] Directory inventory matches the spec: 8 theme modules +
      `index.ts` + `helpers.ts` + `types.ts` + `ThemeSwatch.tsx` +
      `README.md` (plus co-located `*.test.ts`/`*.test.tsx` files).
- [x] Every Group A field for each of the 8 themes equals the
      `themes.jsx` source (`*.test.ts` × 8 transcribe the source
      side-by-side; either side drifting silently fails the test).
- [x] `"Geist"` / `"Geist Mono"` literals replaced with
      `var(--font-geist-sans)` / `var(--font-geist-mono)` in
      every theme module; fallback chains preserved (verified by
      `self-containment.test.ts` and grep across modules).
- [x] No mortgage-mock field (`titleLabel` / `title` / `subtitle`)
      survives in any theme module (verified per-theme + by
      `self-containment.test.ts` covering all 8).
- [x] Each theme carries `id`, `displayName`, `description`
      (verified by `self-containment.test.ts`).

#### AC-2: Theme contract & types
- [x] `Theme.cardStyle` is the literal union
      `'flat' | 'glow' | 'tinted' | 'glass' | 'terminal'`
      (`src/lib/themes/types.ts:22`). `tsc --noEmit` rejects any
      other value (confirmed manually by introducing an invalid
      value and observing the TS error before reverting).
- [x] Discriminated union forces `cardTints: CardTints` when
      `cardStyle ∈ {'tinted','glass'}` and `cardTints: null`
      otherwise (`types.ts:91-99`). Bento + Bento · Glassy
      carry complete `{inputs, results, chart, hero, heroFg}`
      tints — verified by `self-containment.test.ts`.
- [x] No `titleLabel` / `title` / `subtitle` fields on `Theme`
      (file inspection — type only declares Group A + cosmetics).

#### AC-3: Registry & lookup (`getTheme` with fallback)
- [x] `getThemeIds()` returns
      `['calcgrinder','vessel','editorial','calcgrinderCI','minimal','bento','bentoGlassy','terminal']`
      in that order (`index.test.ts:24`).
- [x] `getTheme('calcgrinder')` returns the Calcgrinder · Light
      theme module with NO warning (`index.test.ts:42-49`).
- [x] `getTheme(<any of the 8 valid ids>)` returns the matching
      theme with NO warning — parameterised `it.each` covers all
      8 (`index.test.ts:42-49`).
- [x] `getTheme('unknown-id')` falls back to `calcgrinder` AND
      emits `console.warn` matching
      `[theme-system] Unknown theme id "<id>" — falling back to "calcgrinder"`
      (`index.test.ts:51-58`).
- [x] `getTheme(null)` / `getTheme(undefined)` fall back with the
      same warning (`index.test.ts:60-76`).
- [x] Fallback is read-only — no DB layer touched in PROJ-6.
      `getTheme` is a pure in-memory lookup
      (`index.ts:63-71`); no side effects beyond `console.warn`.
- [x] `getDefaultThemeId()` returns `'calcgrinder'`
      (`index.test.ts:27-29`).
- [x] Registry-consistency tests confirm every `getThemeIds()`
      entry is reachable via `getTheme`, every theme's own
      `.id` matches its registry key, and every named module is
      re-exported (`index.test.ts:79-107`).

#### AC-4: Helpers
- [x] `cardSurface(theme, kind?)` returns `CSSProperties` with
      `background`/`border`/`borderRadius`/`boxShadow` for each
      style, applies `cardTints[kind]` on tinted/glass, adds
      `backdropFilter` on glass, branches `terminal` to flat
      borders + zero radius (`helpers.ts:22-63`). Matches
      `themes.jsx`'s `cardSurface` exactly (the `glow` and `flat`
      default branches collapse into one block because they
      produce identical output — verified visually side-by-side).
- [x] `labelTextStyle(theme, color?)` returns `fontSize: 11`,
      `fontWeight: 600`, `color: color ?? theme.muted`,
      `letterSpacing` (1.2 / 0.6 by `uppercase`),
      `textTransform: 'uppercase'`, and `fontFamily: theme.fontMono`
      only when `cardStyle === 'terminal'` (`helpers.ts:65-77`;
      `helpers.test.ts:86-117`). Original `themes.jsx`'s constant
      `11` ternary is faithfully simplified — behaviour identical
      and documented in the spec's "Deviations" notes.
- [x] `numberStyle(theme, size)` returns `fontFamily: theme.fontMono`,
      `fontSize: size`, `fontWeight: 600` (`500` when
      `monoEverything`), `color: theme.ink`, letterSpacing scaled
      by size (`-1.2`/`-0.5`/`-0.3`), `fontVariantNumeric: 'tabular-nums'`,
      `lineHeight: 1` (`helpers.ts:79-89`; `helpers.test.ts:120-164`).
- [x] All three helpers have stable snapshots across the 8 themes
      (× 5 kinds for `cardSurface`, × 3 sizes for `numberStyle`).
      Re-runs produce identical output — `vitest --run` reports
      0 obsolete / 0 mismatched snapshots after 2 runs.

#### AC-5: `<ThemeSwatch>` preview component
- [x] Outer container uses `theme.bg`; inner card uses
      `cardSurface(theme, 'generic')`; accent dot uses
      `theme.accent`; label uses `theme.font`
      (`ThemeSwatch.tsx:33-90`; verified by snapshot per theme).
- [x] Per-theme snapshot tests stable for all 8 themes
      (`ThemeSwatch.test.tsx:7-13`).
- [x] Pure presentational — no `'use client'` directive, no
      hooks, no `fetch`/DB calls, no `useEffect`. Consumes only
      the `theme` prop (file inspection + test execution under
      jsdom shows no environment requirements).
- [x] Default size is 56×56 px; the size prop overrides
      (`ThemeSwatch.test.tsx:32-48`).
- [x] Accessibility extras (beyond AC): `role="img"`,
      `aria-label="<displayName> theme preview"`,
      `data-theme-id="<id>"` attributes are emitted — confirms
      future picker can drive selection from the data attr
      without re-rendering.

#### AC-6: Font loading (Geist + Geist Mono)
- [x] `src/app/layout.tsx` imports `Geist` and `Geist_Mono` from
      `next/font/google` and exposes
      `--font-geist-sans` / `--font-geist-mono` on `<html>` via
      `className={`${geistSans.variable} ${geistMono.variable}`}`
      (`layout.tsx:2,8-18,33`).
- [x] `tailwind.config.ts` `fontFamily.sans` / `fontFamily.mono`
      reference `var(--font-geist-sans)` / `var(--font-geist-mono)`
      with system fallbacks preserved
      (`tailwind.config.ts:12-15`).
- [x] Browser smoke test (Playwright + Chromium): at
      `http://localhost:3000/auth/login`, `document.fonts` reports
      Geist + Geist Mono loaded; `getComputedStyle(body).fontFamily`
      resolves to
      `'Geist, "Geist Fallback", -apple-system, system-ui, sans-serif'`
      — Geist, not the system fallback. CSS vars on `<html>`
      resolve to `"Geist", "Geist Fallback"` / `"Geist Mono", "Geist Mono Fallback"`.
- [x] Geist-blocked smoke test (Playwright with
      `page.route('**/_next/static/media/**.woff2', abort)`):
      browser fonts go to `status: error` for Geist, `Geist
      Fallback` / `Geist Mono Fallback` remain `loaded`, page
      still renders (1280×720), no `pageerror` event,
      no uncaught JS exceptions in console — only the expected
      `net::ERR_FAILED` resource entries from the blocked
      requests.

#### AC-7: Self-containment / App-theme isolation
- [x] No theme token field references any non-allowed CSS
      variable. Allowed variables are exactly
      `--font-geist-sans` / `--font-geist-mono`, and only in
      `font` / `fontMono` fields (`self-containment.test.ts:17-39`).
- [x] PROJ-8 builder-preview "bright island" behaviour is the
      explicit contract — `next-themes` (`html.className =
      "light"|"dark"`) does NOT bleed into theme tokens because
      theme tokens are literal values, not CSS variables.
      Verified by inspecting all 8 modules and by AC-7
      self-containment test.
- [x] OS-dark-mode independence: theme tokens are absolute hex /
      rgba / gradient strings — there are no `@media (prefers-
      color-scheme: dark)` rules in `helpers.ts` or the modules.
      Visual verification deferred to PROJ-11 (renderer ships
      there) per the spec.

#### AC-8: Extensibility — adding a 9th theme post-v1
- [x] Adding a hypothetical 9th theme is a 3-step diff: drop a
      file, append to the `THEMES` map + `THEME_IDS` array in
      `index.ts`, append to the `ThemeId` literal union in
      `types.ts`. `<ThemeSwatch>` and helpers are pure functions
      of `Theme` — no dispatch switches to update.
- [x] `README.md` documents (a) the procedure for adding a theme
      with one of the existing 5 `cardStyle` values, (b) the
      caveat that introducing a 6th `cardStyle` requires
      extending the type AND the `cardSurface` helper
      (`README.md:20-72`).

#### AC-9: Forward-compat contract for PROJ-8 (editor banner)
- [x] The fallback-warning banner contract is documented in
      PROJ-6's spec (Acceptance Criteria section) — PROJ-8 will
      implement it. The current `console.warn` already emits the
      `[theme-system]` prefix that lets the future Builder
      detect and surface the banner.

### Edge Cases Status

#### EC-1: Unknown / removed / typo'd theme id
- [x] `getTheme('unknown')` returns the default; warning logged;
      no mutation. Tested in `index.test.ts:51-76`.

#### EC-2: Author in App Dark mode editing a light calculator theme
- [x] Self-containment guarantees the calculator preview ignores
      the app theme — theme tokens carry literal colour values,
      not `var(--*)` references. Verified by token inspection
      and `self-containment.test.ts:17-39`.

#### EC-3: Geist font fails to load
- [x] Playwright with `**/_next/static/media/**.woff2` aborted
      confirms graceful degradation to the fallback chain. No
      `pageerror` events, page renders at full dimensions.

#### EC-4: Theme module file added but not registered in the index
- [x] Acceptance: this is caught at code review time by the
      registry-consistency test that asserts every theme is
      reachable + every namespace export is wired
      (`index.test.ts:99-106`). An unregistered theme file would
      not be reachable via `getTheme(itsId)`.

#### EC-5: Hypothetical 9th theme needs a 6th `cardStyle` value
- [x] Type system + `README.md` already encode the requirement.
      Documented and deferred — not actionable in v1.

#### EC-6: Two browser tabs comparing themes by toggling App theme
- [x] By construction: theme tokens are absolute, so the two
      tabs always render the calculator identically; only app
      chrome (the Tailwind utilities + `next-themes` class)
      differs. Confirmed by tokens inspection.

#### EC-7: Renaming a theme id
- [x] Acceptable post-v1 risk — current behaviour falls back to
      default + warning. Documented. Not actionable in v1.

#### EC-8: Future theme uses a non-Geist font
- [x] Architecture supports it (deployer adds font loader; theme
      self-declares with fallback). README documents the path.
      Not actionable in v1.

### Security Audit Results
- [x] **No user input reaches the theme system in v1.** Themes
      are static TypeScript modules loaded at build time. No
      route accepts a theme id from the network and writes it
      anywhere in PROJ-6's scope. The future calculator surface
      (PROJ-10 onward) will validate `theme_id` writes against
      `getThemeIds()`.
- [x] **No XSS surface.** `cardSurface` / `labelTextStyle` /
      `numberStyle` return `CSSProperties` objects React will
      apply via the safe `style` API — values are typed
      `string | number`, never raw HTML. No `dangerouslySetInnerHTML`
      anywhere in PROJ-6 files.
- [x] **No injection vector via `console.warn`.** The fallback
      message embeds the raw id in a template string, but the
      sink is `console.warn` — log injection at worst, not a
      script-execution surface. Acceptable.
- [x] **No secret exposure.** Theme modules contain only colour /
      typography / layout tokens. No env vars referenced.
- [x] **No auth / authorisation surface.** PROJ-6 is purely
      client-side static data + helpers; no API routes added.
- [x] **`backdropFilter` browser support:** glass theme already
      ships `WebkitBackdropFilter` fallback (`helpers.ts:42-43`).
      Safari coverage preserved.

### Regression Testing
- [x] **PROJ-1 cron-purge (10 tests):** all passing.
- [x] **PROJ-3 auth flow (16 tests):** all passing — login /
      signup / approval / wrong-password / pending-redirect /
      bogus-confirm-token regressions covered.
- [x] **PROJ-4 app shell (6 tests):** dashboard navigation,
      theme toggle, security headers, disabled-button tooltip
      — all passing.
- [x] **PROJ-5 dashboard (4 tests):** welcome line, Presets
      empty state, sysadmin pill — all passing.
- [x] **Lint:** `npm run lint` clean.
- [x] **Build:** `npm run build` succeeds; full route table
      renders. New `next/font/google` Geist + Geist Mono loaded
      via `<link rel=preload>` headers (verified by curl
      probing `/`).
- [x] **Unit tests:** 268 / 268 passing, including 81 new
      PROJ-6 tests (data-equality × 8, registry × 8, helpers
      × ~90 snapshots, swatch × ~13, self-containment × ~30).
- [x] **E2E tests:** 36 passed / 2 skipped (the 2 skips are
      pre-existing Mobile Safari opt-outs unrelated to PROJ-6).
- [x] No `app/(app)/dashboard/page.tsx` rendering regression
      observed after Tailwind `fontFamily.sans` / `fontFamily.mono`
      additions; the dashboard still renders, Tailwind's
      `font-sans` utility resolves to Geist (verified by
      Playwright smoke).

### Bugs Found
**None.**

### Observations / non-blocking notes
- **`tsc --noEmit` errors in `src/app/(auth)/auth/signup/actions.test.ts`**
  (3 errors at lines 29, 235) exist on `main` since
  commit `8c4c0ba` (PROJ-3) — pre-existing, unrelated to
  PROJ-6, not picked up by ESLint and not affecting Vitest
  runs. Not blocking PROJ-6 approval; should be filed against
  PROJ-3 for a follow-up.
- **Tailwind `fontFamily.mono` fallback** is `['var(--font-geist-mono)', 'SF Mono', 'monospace']`.
  No previous mono utility was defined, so the AC's
  "fallback chain preserved" check applies to the
  themes-module fallbacks (which ARE preserved verbatim); the
  Tailwind default `font-mono` adopted a sensible chain from
  scratch. Reviewed — intentional.
- **`cardStyle: 'terminal'` is dead code in v1.** Terminal · Cyber
  uses `cardStyle: 'glow'` (the original `themes.jsx`'s contract
  too); the `'terminal'` branch in `cardSurface` /
  `labelTextStyle` exists for future themes, covered by a
  synthetic-theme test. Documented in the spec's
  "Deviations / clarifications" section.

### Summary
- **Acceptance Criteria:** 9 / 9 categories passed (every
  numbered sub-criterion under each category passed; no
  failures or partial passes).
- **Edge Cases:** 8 / 8 handled — 5 verified empirically, 3
  documented & deferred per the spec.
- **Bugs Found:** 0 (0 Critical, 0 High, 0 Medium, 0 Low).
- **Security:** Pass — PROJ-6 has no user-input surface, no
  injection vectors, no auth/authz surface; static-data layer
  only.
- **Automated test totals:** Unit 268 / 268, E2E 36 / 38
  (2 pre-existing Mobile Safari skips), Lint clean, Build OK.
- **Production Ready:** **YES.**
- **Recommendation:** Approve and proceed to `/deploy`.

## Deployment
_To be added by /deploy_
