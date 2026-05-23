# Account Dashboard (PROJ-5)

Operational reference for the dashboard scaffold shipped with PROJ-5.
Documents the section primitive, the hide-when-empty rule, the
canonical section order downstream features extend, and the affordances
deliberately deferred to later features.

PROJ-5 is a pure presentation feature — no database tables, no API
routes, no env vars. Everything below describes layout and component
contracts.

---

## 1. Section order (canonical, frozen)

The dashboard page renders sections in a single fixed order. Downstream
features insert their `<Section>` block into the matching slot; PROJ-5
leaves a comment in `src/app/(app)/dashboard/page.tsx` naming the order.

| Slot | Section          | Lands in | Visibility rule                            |
| ---- | ---------------- | -------- | ------------------------------------------ |
| 1    | My Calculators   | PROJ-10  | Hidden when the user has zero calculators  |
| 2    | My Scenarios     | PROJ-12  | Hidden when the user has zero scenarios    |
| 3    | Presets          | PROJ-5   | **Always rendered** (even when count = 0)  |
| 4    | Trash            | PROJ-13  | Hidden when nothing is soft-deleted        |
| 5    | User Calculators | PROJ-19  | Sysadmin-only; hidden for regular users    |

PROJ-5 renders **only** slot 3 — every other slot is dark until its
owning feature ships.

---

## 2. Hide-when-empty rule

The default for any dashboard section is **hide when its data is
empty**. Presets is the only exception: its empty state explains the
curated-calculators concept and is the call-to-action surface for
PROJ-18.

Rationale: while the deployer is the sole observer of intermediate
states, empty cosmetic placeholders read as broken polish. Hiding is
cheaper to ship, cheaper to remove when content arrives. See
PROJ-5's Decision Log for the broader pattern rule (it retires PROJ-4's
"disabled-with-tooltip" approach for non-fixed-position slots).

---

## 3. `<Section>` primitive — public API

Imported from `@/components/dashboard`.

```tsx
import { Section } from '@/components/dashboard';

<Section
  title="Presets"
  count={0}
  defaultExpanded
>
  {/* children — empty state or populated body */}
</Section>
```

| Prop              | Type                       | Default | Notes                                                                              |
| ----------------- | -------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `title`           | `string`                   | —       | Renders as an `<h2>` inside the trigger button.                                    |
| `count`           | `number`                   | —       | Shown in the monospace pill next to the title.                                     |
| `children`        | `React.ReactNode`          | —       | Section body — cards, grid, empty state, etc.                                      |
| `defaultExpanded` | `boolean`                  | `false` | Initial open state. Section state is **per-page-load only** (no persistence).      |
| `hint`            | `string`                   | —       | Subtitle shown after the count pill (prefixed with "·") **only when collapsed**.   |
| `tint`            | `'danger'`                 | —       | When set, washes the frame red (`bg-cg-danger-soft border-cg-danger-border`).      |

Built on shadcn's Radix `Collapsible`, so the trigger gets
`aria-expanded`, `aria-controls`, and the content `<div>` gets the
matching id for free. Focus stays on the button when toggled — no
focus jumps.

### Internal scroll

Body height ≤ 304px → no scrollbar; section grows to fit. Body height >
304px → inner container becomes a scroll container (`overflow-y: auto`)
and section height stops growing.

The threshold is exported as `SECTION_SCROLL_MAX_PX` from
`src/components/dashboard/section.tsx`. It's hardcoded because every
known v1 consumer (My Calculators, Trash, User Calculators) shares the
same card geometry (128px row + 12px gap + 18+18px section padding).
Promote to a `maxHeight?: number` prop only when a real consumer needs
a different value.

### `tint="danger"`

Used by PROJ-19 for the sysadmin "User Calculators" section. Washes the
section *frame*; the cards inside continue to read against the wash on
their own surface backgrounds.

---

## 4. Welcome line

`<WelcomeLine name={…} role={…} />` from `@/components/dashboard`.

- Trims `name`; null / empty / whitespace-only → renders **"Welcome
  back"** with no comma and no email-local-part fallback. (PROJ-4's
  avatar handles the email fallback; the welcome line consciously does
  not.)
- `role === 'sysadmin'` renders the SYSADMIN pill inline with the
  heading.
- The outer wrapper is `hidden md:block`, so the welcome line never
  renders on mobile — SYSADMIN visibility on small viewports stays via
  the avatar popover (PROJ-4). The breakpoint matches the rest of the
  shell (Tailwind `md` = 768px).

---

## 5. Deferred surfaces

These are intentionally not shipped in PROJ-5. The owning feature is in
parentheses.

- **Hero "Build a new calculator" button** (PROJ-10) — hidden entirely
  until calculator creation works. The PROJ-4 "+ New calculator"
  tooltip + `disabled` wrapper in
  `src/components/shell/top-bar-desktop.tsx` is also retired by PROJ-10.
- **`<CalcCard>` primitive** (PROJ-10) — title, description, footer
  timestamp, kebab, icon-button row, status pill. Lands alongside the
  calculators table.
- **Status pills** Published / Draft (PROJ-10), Deleted (PROJ-13).
- **Kebab popovers** (PROJ-10 / PROJ-13 / PROJ-19).
- **Destructive-confirm bottom sheet** (PROJ-10 / PROJ-19).
- **Per-card icon-button rows** (PROJ-10 / PROJ-12 / PROJ-18).
- **Section expansion persistence** across navigations — not in v1.

---

## 6. Files of record

| File                                            | Purpose                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app/(app)/dashboard/page.tsx`              | Server Component. Renders the welcome line + the Presets section.                                    |
| `src/components/dashboard/section.tsx`          | The `<Section>` primitive (Client Component, Radix `Collapsible` underneath).                        |
| `src/components/dashboard/welcome-line.tsx`     | The `<WelcomeLine>` Server Component (desktop-only via `hidden md:block`).                           |
| `src/components/dashboard/index.ts`             | Public barrel.                                                                                       |
| `src/components/shell/icons.tsx`                | `Icons.LayoutGrid` glyph — consumed by PROJ-5, PROJ-10, PROJ-18.                                     |
| `tests/PROJ-5-dashboard.spec.ts`                | Playwright E2E (Chromium + Mobile Safari).                                                           |
