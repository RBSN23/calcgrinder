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

Captured manually from Chrome DevTools after deploy. Mobile + desktop
form factors against three surfaces. No score targets, no follow-up
optimisation pass — the baseline exists for future regression
detection only.

**Deploy date:** _to be filled in at /deploy_

| Surface         | Form factor | Performance | Accessibility | Best Practices | SEO |
| --------------- | ----------- | ----------- | ------------- | -------------- | --- |
| `/dashboard`    | desktop     | TBD         | TBD           | TBD            | TBD |
| `/dashboard`    | mobile      | TBD         | TBD           | TBD            | TBD |
| `/settings`     | desktop     | TBD         | TBD           | TBD            | TBD |
| `/settings`     | mobile      | TBD         | TBD           | TBD            | TBD |
| `/auth/login`   | desktop     | TBD         | TBD           | TBD            | TBD |
| `/auth/login`   | mobile      | TBD         | TBD           | TBD            | TBD |
