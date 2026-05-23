# App Shell (PROJ-4)

Operational reference for the signed-in chrome shipped with PROJ-4.
Covers theme model, route-group conventions, forward-compat slots,
deferred features, the production security headers wired in this
feature, and the Lighthouse baseline captured at deploy time.

---

## 1. Two themes, one provider

Calcgrinder has two distinct theme systems. PROJ-4 only ships the
first:

- **App theme** (this feature). Light / Dark / System for the app
  chrome — top bar, dashboard, settings, auth pages. Stored per
  browser in `localStorage` via `next-themes`. Drives the `dark`
  class on `<html>`. One provider, defined at the root layout
  (`src/components/theme-provider.tsx`).
- **Calculator theme** (PROJ-6). Eight themes that paint the inside
  of a published calculator. Stored per calculator in the database;
  applied to the visitor surface and the editor preview. Completely
  independent of the App theme.

The user picks the App theme from the avatar popover (Light / Dark /
System buttons). Choosing one calls `next-themes`' `setTheme(value)`;
the popover stays open so the user can see the transition. Persistence
is per browser — switching browsers or clearing localStorage resets
the choice to "System".

---

## 2. Avatar initials derivation

Pure helper at `src/components/shell/avatar-initials.ts`. Rules:

| Profile state                       | Initials                                              |
| ----------------------------------- | ----------------------------------------------------- |
| Name with 2+ words                  | First letter of each space-split word, capped at 2    |
| Name with 1 word                    | First letter                                          |
| Name null / empty / whitespace-only | First 2 chars of the email local-part, uppercased     |
| Single-char email local-part        | That single letter                                    |
| Accented characters in name         | Preserved (`"Łukasz Świątek"` → `"ŁŚ"`)               |
| Everything empty (defensive only)   | `"?"`                                                 |

The avatar background colour is derived from the initials via
`cgAvatarHue()` (deterministic hash → oklch hue) so the colour is
stable per user across sessions. Per-theme lightness is held in a CSS
variable (`--cg-avatar-l`: 0.62 light, 0.55 dark) so the browser picks
the right value at theme-switch time without a React round-trip.

---

## 3. Route-group conventions

Three Next.js route groups serve distinct chromes:

| Group        | Purpose                                            | Chrome              |
| ------------ | -------------------------------------------------- | ------------------- |
| `(app)`      | Approved-user surfaces (Dashboard, Editor, Settings)| `AppShell` (PROJ-4) |
| `(auth)`     | Pre-auth pages (login, signup, ...)                 | `AuthShell` (PROJ-3)|
| `auth/`      | Auth callbacks + sign-out POST endpoint            | None (route handlers)|

The middleware + the `(app)` layout's status gate enforce the route
gate matrix (PROJ-3). The AppShell itself only ever sees an *approved*
profile.

---

## 4. AppShell forward-compat slots

The shell exposes four override seams future features will wire:

| Slot              | Default                                       | Future caller                                |
| ----------------- | --------------------------------------------- | -------------------------------------------- |
| `rightExtras`     | omitted (no gap)                              | PROJ-6 / PROJ-8 calculator-theme picker      |
| `mobileLeftSlot`  | mini Wordmark linking to /dashboard           | PROJ-8 mobile Grid drawer toggle             |
| `mobileCenter`    | pathname-derived title                        | PROJ-8 live calculator title (mobile)        |
| `editorTitle`     | placeholder "Untitled calculator"             | PROJ-8 live calculator title (desktop tabs)  |
| `AvatarPopover.isAdmin` | `false`                                 | PROJ-19 flips to `true` for sysadmins        |

Slots accept any `React.ReactNode` — Server or Client subtrees.
Layouts mounting the AppShell can pass props without crossing the
client boundary.

---

## 5. Deferred items

PROJ-4 deliberately ships the frame; the contents fill in later:

| Deferred                            | Lands in   |
| ----------------------------------- | ---------- |
| "+ New calculator" enablement       | PROJ-10    |
| Admin row in the avatar popover     | PROJ-19    |
| Calculator-theme picker (rightExtras)| PROJ-6 / 8 |
| Mobile Grid drawer toggle           | PROJ-8     |
| Live calculator title in breadcrumbs| PROJ-8     |
| Dashboard / Settings / Editor content | PROJ-5 / 14 / 8 |
| App-level error boundary (`(app)/error.tsx`) | Later feature if needed |

The "+ New calculator" button is rendered disabled with a "Coming
soon" tooltip on desktop and not rendered at all on mobile.

---

## 6. Production security headers

`next.config.ts` returns these four headers for `/:path*` — covering
every route in the app, including auth callbacks and the not-found
surface. CSP is deliberately omitted (see PROJ-4 Decision Log).

| Header                   | Value                                       |
| ------------------------ | ------------------------------------------- |
| `X-Frame-Options`        | `DENY`                                      |
| `X-Content-Type-Options` | `nosniff`                                   |
| `Referrer-Policy`        | `origin-when-cross-origin`                  |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`    |

Canonical reference: `docs/production/security-headers.md`.

**Verify after deployment:**

```bash
curl -I https://<production-domain>/dashboard
curl -I https://<production-domain>/auth/login
curl -I https://<production-domain>/c/<any-token>
```

All four headers should appear on every response (302 or 200).

---

## 7. Lighthouse baseline (PROJ-4)

Captured manually from Chrome DevTools after deploy. The baseline
exists for future regression detection only — no score targets, no
follow-up optimisation pass.

**Deploy date:** 2026-05-23
**Production URL:** https://calcgrinder.vercel.app
**Capture time:** 2026-05-23T06:14:57Z
**Sample size:** Single run, mobile form factor only (Moto G Power
emulation). Desktop form factor and additional surfaces (`/settings`,
`/auth/login`) deliberately skipped — App Shell ships placeholder
content; a more meaningful baseline can be captured post-PROJ-5 when
`/dashboard` has real content.

| Surface         | Form factor | Performance | Accessibility | Best Practices | SEO |
| --------------- | ----------- | ----------- | ------------- | -------------- | --- |
| `/dashboard`    | mobile      | 96          | 100           | 81             | 100 |

**Key metrics (mobile, `/dashboard`):**

| Metric                          | Value |
| ------------------------------- | ----- |
| First Contentful Paint (FCP)    | 1.3s  |
| Largest Contentful Paint (LCP)  | 1.4s  |
| Cumulative Layout Shift (CLS)   | 0     |
| Total Blocking Time (TBT)       | 230ms |
| Time to Interactive (TTI)       | 2.0s  |

**Notes:**

- **Best Practices 81/100** traces to a single warning ("Unload event
  listeners are deprecated") sourced from a Chrome extension's
  `content.js`, not Calcgrinder code. The same extension also triggers
  the "Page prevented back/forward cache restoration" diagnostic under
  Performance. Re-running in Incognito would likely return 100 / clear
  the bfcache flag. Not investigated further — baseline-only per
  PROJ-4 scope discipline.
- **Performance diagnostics** flag ~575 KiB unused JavaScript and
  ~14 KiB legacy JavaScript polyfills (Next.js default bundling). Not
  addressed — bundle optimisation is explicitly out-of-scope for v1
  per the PROJ-4 Decision Log.
