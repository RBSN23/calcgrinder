# Calculator Theme System

Self-contained, absolute (NOT App-theme adaptive) visual themes for
calculators. The 8 shipped themes are encoded as plain TypeScript modules
under this directory and resolved at render time via the registry in
[`./index.ts`](./index.ts).

## What lives here

| File                  | Purpose                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| `types.ts`            | `Theme` type, `ThemeId` union, `CardStyle` discriminator, `CardTints`. |
| `index.ts`            | Registry: `getTheme`, `getThemeIds`, `getDefaultThemeId`.              |
| `helpers.ts`          | Pure helpers: `cardSurface`, `labelTextStyle`, `numberStyle`.          |
| `ThemeSwatch.tsx`     | 56 × 56 preview tile — pure function of `Theme`.                       |
| `<id>.ts` (× 8)       | One file per theme; each exports a typed `Theme` token bag.            |

Tests sit co-located next to each module (`*.test.ts` / `*.test.tsx`).

## Adding a 9th theme

1. **Create the token module.** Drop `src/lib/themes/<id>.ts` exporting
   a single typed `Theme`:

   ```ts
   import type { Theme } from './types';

   export const myTheme: Theme = {
     id: 'myTheme',
     displayName: 'My Theme',
     description: 'One-line summary used in tooltips and picker rows.',
     // …all visual tokens — see existing themes for the full shape.
     cardStyle: 'flat', // 'flat' | 'glow' | 'tinted' | 'glass' | 'terminal'
     cardTints: null,    // required object for 'tinted' / 'glass'
   };
   ```

   The `Theme` type is a discriminated union on `cardStyle`. If you pick
   `'tinted'` or `'glass'`, the build will fail until `cardTints` carries
   `{ inputs, results, chart, hero, heroFg }`.

2. **Register it.** Add the `ThemeId` literal to the union in `types.ts`,
   import the module into `index.ts`, and append the id to both `THEMES`
   and `THEME_IDS`. The registry-consistency test
   ([`./index.test.ts`](./index.test.ts)) keeps the two in sync.

3. **Grow the snapshot tests.** Update the data-equality test (or add a
   new one for your theme) and re-record the helper snapshots so
   `cardSurface` / `labelTextStyle` / `numberStyle` cover the new theme.

That's it for any theme using one of the existing five `cardStyle` values
(`flat` · `glow` · `tinted` · `glass` · `terminal`). No helper code
changes; no dispatch switches to touch. `<ThemeSwatch>` will render the
new theme automatically because it is a pure function of `Theme`.

## Caveat: adding a 6th `cardStyle` value

If a future theme needs a card surface treatment that doesn't fit any of
the existing five `cardStyle` values, the addition stops being a
"drop a file" change:

1. Extend the `CardStyle` union in [`./types.ts`](./types.ts) — TypeScript
   will then flag every exhaustive switch on `cardStyle` until the new
   case is handled.
2. Add a branch to [`./helpers.ts`](./helpers.ts) `cardSurface()` for the
   new style. Re-record helper snapshots.
3. Decide whether the new `cardStyle` requires `cardTints` (extend the
   discriminated union in `types.ts` accordingly).

The discriminated union is intentional: adding a `cardStyle` value
without handling it surfaces as a compile error in the helper, not a
runtime visual bug.

## Fonts

The theme tokens reference `var(--font-geist-sans)` and
`var(--font-geist-mono)` for typography. These variables are emitted on
`<html>` by `next/font/google` in `src/app/layout.tsx`. The fallback
chain in each theme's `font` / `fontMono` string is preserved, so if
Geist fails to load the calculator degrades to the next system font
without crashing layout.

A theme using a different font face (e.g. a serif theme post-v1) must
(a) declare it in the theme's `font` field with a fallback chain and
(b) the deployer must load the face in `src/app/layout.tsx`. Out of
scope for v1.

## What this module is NOT responsible for

- **Persisting the chosen `theme_id`.** PROJ-10 (Calculator Lifecycle)
  adds the `theme_id` column on the `calculators` table and validates
  writes against `getThemeIds()`.
- **Rendering a calculator.** PROJ-11 (Visitor View) ships the renderer
  that consumes `cardSurface` / `labelTextStyle` / `numberStyle`.
- **Theme picker UI.** PROJ-8 (Builder) and PROJ-14 (Settings) consume
  `<ThemeSwatch>` and `getThemeIds()` / `getDefaultThemeId()`.
- **Author-editable themes.** Themes are deployer-shipped code; end
  users cannot create or modify themes in v1.
