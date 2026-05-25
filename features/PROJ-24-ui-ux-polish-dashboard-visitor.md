# PROJ-24: UI/UX Polish Part 2 — Dashboard + Visitor + Editor Settings

## Status: Architected
**Created:** 2026-05-25
**Last Updated:** 2026-05-25

## Dependencies
- PROJ-6 (Calculator Theme System) — theme tokens, layout patterns
- PROJ-8 (Editor — Grid + Builder Two-Panel Split) — editor structure, DnD
- PROJ-9 (Cell Authoring & Section Management) — section layouts, cell settings
- PROJ-11 (Visitor View) — public calculator page header
- PROJ-23 (UI/UX Polish Part 1 — Editor) — prior polish pass

## Overview

Nine discrete polish items spanning the Dashboard, Visitor View,
and Editor settings surfaces. Each item is independently testable
and deployable, but bundled here as a single polish pass (same
pattern as PROJ-23).

Items are numbered for reference in acceptance criteria and
implementation:

| # | Area | Summary |
|---|------|---------|
| 1 | Dashboard | Card width stability on section expand/collapse |
| 2 | Navigation | Loading indicators + performance investigation |
| 3 | Visitor View | Owner "Edit" button on public calculator page |
| 4 | Editor | Viewport picker — correct Tablet/Mobile icons |
| 5 | Editor | Additional section layout patterns (universal catalog) |
| 6 | Editor | Active toggle option highlighted in brand color |
| 7 | Editor | Compact visual-icon toggles in Live Preview cell settings |
| 8 | Editor | Cell settings flyout panel (replaces inline expansion) |
| 9 | Editor | Cross-section drag & drop |

---

## User Stories

- As a **registered user**, I want dashboard calculator cards to stay the same width when I expand or collapse a section, so the layout doesn't jump around (Item 1).
- As a **registered user**, I want immediate visual feedback when I navigate between pages (dashboard, editor, public view), so the app doesn't feel unresponsive (Item 2).
- As a **registered user** viewing my own published calculator at `/c/<token>`, I want a quick "Edit" button in the visitor header so I can jump straight into the editor without navigating through the dashboard (Item 3).
- As a **registered user**, I want the viewport picker icons to accurately represent tablet and mobile devices so I can quickly identify the correct preview mode (Item 4).
- As a **registered user**, I want more section layout options (3-column, 4-column, asymmetric splits) available in every theme, so I can build flexible, visually varied calculators (Item 5).
- As a **registered user**, I want the active option in toggle controls to be clearly highlighted (brand color background), so I can instantly see which setting is selected (Item 6).
- As a **registered user**, I want the Live Preview cell settings to use compact visual icons instead of text labels, so the settings panel takes less space and is faster to scan (Item 7).
- As a **registered user**, I want cell settings to appear in a fixed-width flyout panel next to the card instead of expanding below it, so the settings are usable regardless of card width (Item 8).
- As a **registered user**, I want to drag cells, charts, and text blocks between sections (not just within), so I can reorganize my calculator layout freely (Item 9).

---

## Out of Scope

- **Footer redesign on public calculator views** — deferred to a
  separate interface-theme polishing feature. Not part of PROJ-24.
- **Actual performance optimization of server-side data loading** —
  Item 2 covers loading indicators (perceived performance) and
  investigation of root causes, but deep backend query optimization
  or caching infrastructure is out of scope. Findings go into
  Open Questions for a future feature.
- **Grid cell settings panel redesign** — Item 7 and 8 apply to
  the Live Preview cell settings only. The Grid sidebar panel
  keeps its current layout (it's already in a fixed-width context).
- **Mobile-specific editor layout overhaul** — the flyout (Item 8)
  falls back to a bottom sheet on mobile, but no broader mobile
  editor rethink.
- **Per-theme layout pattern curation** — Item 5 explicitly
  decouples layout patterns from themes. No per-theme restrictions.
- **New layout patterns beyond the 8 specified** — the catalog is
  fixed for this feature; additional patterns are a future addition.
- **Section drag & drop between calculators** — Item 9 covers
  cross-section moves within a single calculator only.

---

## Acceptance Criteria

### Item 1 — Dashboard Card Width Stability

- [ ] Given the dashboard is loaded with multiple sections, when the user expands or collapses any section (My Calculators, Presets, Saved Scenarios, Trash), then the width of calculator cards in all visible sections remains constant.
- [ ] Given the dashboard is loaded on a viewport of any width (375px–1440px+), when sections are toggled, then no horizontal layout shift occurs on any card.

### Item 2 — Navigation Loading Indicators

- [ ] Given the user is on the dashboard, when they click "+ New calculator" or the Edit icon on a card, then a loading indicator (spinner or skeleton) appears within 100ms of the click.
- [ ] Given the user is in the editor, when they click the "Dashboard" breadcrumb or navigate away, then a loading indicator appears immediately.
- [ ] Given the user clicks any navigation action, when the destination page is loading, then the source page remains interactive (no frozen UI).
- [ ] Given the navigation transitions are implemented, when measured, then the investigation findings (root causes of 5–10s load times, optimization opportunities like prefetching or server actions) are documented in this spec's Open Questions section.

### Item 3 — Owner Edit Button on Visitor View

- [ ] Given a logged-in user who owns the displayed calculator, when they visit `/c/<token>`, then a pencil (edit) icon button appears in the visitor header alongside the existing Save Scenario and Clone buttons.
- [ ] Given the edit button is visible, when the owner clicks it, then they are navigated to `/editor/<calculator-id>`.
- [ ] Given a logged-in user who does NOT own the calculator, when they visit `/c/<token>`, then no edit button is visible.
- [ ] Given an anonymous visitor, when they visit `/c/<token>`, then no edit button is visible.
- [ ] Given the edit button is rendered, then it uses the same pencil icon and button styling as the edit button on dashboard calculator cards.

### Item 4 — Viewport Picker Icons

- [ ] Given the editor is open, when the user sees the viewport picker, then the Tablet option shows a tablet silhouette icon (portrait rectangle with rounded corners).
- [ ] Given the editor is open, when the user sees the viewport picker, then the Mobile option shows a phone silhouette icon (narrow portrait rectangle with rounded corners).
- [ ] Given the icons are updated, then the Desktop icon (monitor) remains unchanged.

### Item 5 — Universal Section Layout Catalog

- [ ] Given the layout patterns are decoupled from themes, then a single universal catalog of 8 patterns exists, shared by all themes:
  1. Single column `[1]`
  2. Two columns `[1, 1]`
  3. Two-thirds + one-third `[2, 1]`
  4. One-third + two-thirds `[1, 2]`
  5. Three columns `[1, 1, 1]`
  6. Four columns `[1, 1, 1, 1]`
  7. Three-quarters + one-quarter `[3, 1]`
  8. One-quarter + one-quarter + one-half `[1, 1, 2]`
- [ ] Given any theme is active, when the user opens the layout picker on a section, then all 8 patterns are available.
- [ ] Given the `layoutPatterns` property is removed from the `Theme` type, then existing calculators with stored `layout_pattern_id` values continue to resolve correctly via the universal catalog.
- [ ] Given the layout picker is open, then each pattern shows its visual preview (proportional rectangles), display name, and description.
- [ ] Given a user selects any layout pattern, then the section grid immediately re-renders with the correct column proportions.

### Item 6 — Toggle Active State Brand Color

- [ ] Given any segmented toggle control in the Live Preview cell settings panel, when an option is selected/active, then its background color is the Calcgrinder app brand color (`cg-accent`).
- [ ] Given any segmented toggle control in the Grid cell settings panel, when an option is selected/active, then its background color is the Calcgrinder app brand color (`cg-accent`).
- [ ] Given the active toggle uses `cg-accent` as background, then the text/icon on the active segment uses a contrasting foreground color (white or `cg-accent-fg`) for readability.
- [ ] Given the toggle is not active, then it retains the current neutral styling (no color change for inactive segments).

### Item 7 — Compact Visual-Icon Toggles in Live Preview

- [ ] Given the cell settings flyout is open (Item 8), when the user sees the Label field, then there is no separate "LABEL" heading — the input field shows placeholder text "Label (optional)".
- [ ] Given the cell settings flyout is open, when the user sees the Text Size toggle, then it shows four "T" glyphs at increasing sizes (small T, medium T, large T, extra-large T) instead of the text labels "S / M / L / XL".
- [ ] Given the cell settings flyout is open, when the user sees the Border toggle, then it shows three small visual boxes: one with no border, one with a thin (hairline) border, one with a thick (strong) border — instead of the text labels "None / Hairline / Strong".
- [ ] Given the cell settings flyout is open, when the user sees the Text Color toggle, then it shows three color swatches displaying the actual colors from the active calculator theme (default text color, accent 1, accent 2) — instead of the text labels "Default / Accent 1 / Accent 2".
- [ ] Given the cell settings flyout is open, when the user sees the Background Tint toggle, then it shows three small squares with increasing fill opacity (empty, light tint, solid tint) using the calculator theme's tint color — instead of the text labels "None / Soft / Strong".
- [ ] Given the cell settings flyout is open, when the user sees the Size toggle, then it shows three rectangles of increasing width (narrow bar, medium bar, full-width bar) — instead of the text labels "Narrow / Wide / Full".
- [ ] Given all visual-icon toggles are rendered, then each toggle segment has a tooltip showing the text label on hover (accessibility fallback).

### Item 8 — Cell Settings Flyout Panel

- [ ] Given a cell, chart, or text block is in the Live Preview, when the user clicks its Edit icon, then a 320px-wide settings panel slides out from the card's right edge, overlaying adjacent content.
- [ ] Given the flyout is open, then the card itself remains at its current size and position (no resize, no layout shift).
- [ ] Given the flyout is open, when the user clicks outside the flyout or presses Escape, then the flyout dismisses.
- [ ] Given the flyout is open for one element, when the user clicks Edit on a different element, then the first flyout closes and the new one opens (one flyout at a time).
- [ ] Given the viewport is too narrow for a 320px flyout beside the card (mobile breakpoint), then the settings appear as a bottom sheet sliding up from the bottom of the screen.
- [ ] Given the flyout is anchored to the right edge of the card, when there is insufficient space on the right (card is near viewport edge), then the flyout anchors to the left edge instead.
- [ ] Given the flyout is open, then the settings content (Label, toggles, widget picker, etc.) is identical to the current inline settings panel — only the container changes.

### Item 9 — Cross-Section Drag & Drop

- [ ] Given a cell exists in Section A, when the user drags it and drops it into Section B's drop zone, then the cell moves from Section A to Section B.
- [ ] Given a chart or text block exists in Section A, when the user drags it to Section B, then it moves to Section B (all display element types support cross-section moves).
- [ ] Given an element is dragged from Section A to Section B, when the drop completes, then both sections re-number their display order contiguously (no gaps).
- [ ] Given an element is dragged across sections, when the drop completes, then a single undo entry is created that reverts both the move and the reorder.
- [ ] Given an element is being dragged, then visual drop zone indicators appear in all sections (not just the source section) showing valid drop targets.
- [ ] Given a cross-section drag is in progress, when the element hovers over a target section, then the section visually highlights to indicate it will accept the drop.
- [ ] Given the current toast "Cross-section moves aren't supported yet" exists, when cross-section DnD is implemented, then the toast and its guard logic are removed.

---

## Edge Cases

- **Item 1**: A section with zero calculators collapses to a minimal height — nearby sections' cards must not reflow.
- **Item 2**: If navigation is interrupted (e.g., user clicks back during loading), the loading indicator should disappear cleanly without leaving ghost spinners.
- **Item 3**: If the calculator is in Draft status (not published), the owner can still see the Edit button on the preview URL — the button should work regardless of publish state.
- **Item 3**: If the owner's session expires while viewing `/c/<token>`, the Edit button should disappear on next render (no stale auth state showing the button).
- **Item 5**: Calculators created with old themes that had fewer patterns retain their stored `layout_pattern_id` — the universal catalog must include all historical pattern IDs so nothing falls back unexpectedly.
- **Item 8**: If a cell is in the bottom-right corner of the preview, the flyout may need to open above or to the left — the positioning logic must handle all four corners.
- **Item 8**: If the user scrolls while the flyout is open, the flyout should scroll with the card (anchored) or dismiss — it should not float detached.
- **Item 9**: Dragging the last element out of a section leaves the section empty — the section should show an empty-state drop zone, not collapse to zero height.
- **Item 9**: If two elements are in a two-column layout and one is dragged out, the remaining element should stay in its column position (no reflow to single column).
- **Item 9**: Undo of a cross-section move must restore the element to its original position in the original section, including its original display order.

---

## Technical Requirements

- **Performance (Item 2)**: Loading indicators must appear within 100ms of user action. No perceptible delay between click and visual feedback.
- **Accessibility**: All icon toggles (Item 7) must have `aria-label` attributes and tooltips for screen reader support. Flyout (Item 8) must be keyboard-navigable and trap focus while open.
- **Browser support**: Chrome, Firefox, Safari (latest stable).
- **Responsive**: All items must work at 375px, 768px, and 1440px viewports.

---

## Open Questions

- [ ] **Item 2 — Root cause of navigation latency**: What is causing the 5–10s delay when creating a new calculator or opening an existing one? Is it server-side data fetching, client-side hydration, or Supabase query time? Investigation during implementation should document findings here.
- [ ] **Item 2 — Prefetch strategy**: Should Next.js `<Link prefetch>` be used for dashboard → editor navigation? What is the bundle size impact?
- [ ] **Item 8 — Flyout scroll behavior**: Should the flyout scroll with the card (stay anchored to the card's position in the scroll container), or should it dismiss on scroll? Recommended: scroll with the card.

---

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Cell settings flyout (320px, anchored right) instead of inline expansion or side-by-side split | Flyout width is independent of card width — works identically at any layout. Side-by-side distorts the preview; inline expansion creates unwieldy wide panels in single-column layouts. | 2026-05-25 |
| Flyout dismisses on click outside / Escape, one at a time, bottom sheet on mobile | Standard flyout behavior matching user expectations from Figma, Notion. Bottom sheet is the natural mobile fallback. | 2026-05-25 |
| Layout patterns decoupled from themes — universal catalog | With N themes, per-theme pattern lists create O(N) maintenance for every new pattern. A single catalog scales to any number of themes without per-theme edits. | 2026-05-25 |
| All 8 themes get all 8 layout patterns | Authors shouldn't be restricted by theme choice. The layout is an authoring decision, not an aesthetic one. | 2026-05-25 |
| Cross-section DnD kept in PROJ-24 rather than split out | Highest-complexity item but clearly desired. Splitting adds tracking overhead without architectural benefit — it touches the same DnD code as the rest of the editor. | 2026-05-25 |
| Public view footer redesign deferred | Belongs to a dedicated interface-theme polishing pass. Different scope and testing surface. | 2026-05-25 |
| Visual icon toggles with hover tooltips | Icons are faster to scan than text labels; tooltips preserve discoverability for first-time users and accessibility. | 2026-05-25 |
| Toggle active state uses `cg-accent` (app brand color), not calculator theme accent | Toggles are editor chrome, not calculator content. App brand color is consistent across all calculator themes. | 2026-05-25 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Universal layout catalog as a shared const array exported from `layout-patterns.ts` — remove `layoutPatterns` from the `Theme` type | One array of 8 patterns, referenced everywhere. Eliminates per-theme maintenance: adding a 9th pattern is one line, not 8. `resolveLayoutPattern()` changes its first arg from `Theme['layoutPatterns']` to the global catalog. | 2026-05-25 |
| New `Tablet` and `Smartphone` SVG icons in `icons.tsx` using standard Lucide-style silhouettes | No new package needed — two `<svg>` paths. Replaces `LayoutGrid` (tablet) and `Menu` (mobile), which are semantically wrong. | 2026-05-25 |
| Owner Edit button: server-component prop `ownerId` threaded from page.tsx to `VisitorHeader` — client comparison via context | The server already fetches both `calculator.user_id` and `current.user.id`. Passing `isOwner` as a boolean prop avoids a redundant client-side auth check. | 2026-05-25 |
| Cross-section DnD via a single `DndContext` wrapping all sections (lifted from `BuilderLayoutGrid` to `SectionList`) | Per-section DndContexts can't communicate cross-section. A single context + multiple `SortableContext` containers (one per section) enables cross-section drops while maintaining per-section ordering. `@dnd-kit/core` collision detection handles the multi-container case natively. | 2026-05-25 |
| Flyout panel uses Radix `Popover` (already installed as `@/components/ui/popover`) anchored to the cell card | Radix Popover handles positioning, focus trap, Escape dismiss, and click-outside dismiss. The flyout is the same popover primitive with a fixed 320px width. Mobile fallback uses the `ResponsiveSheet` pattern (PROJ-12 precedent). | 2026-05-25 |
| Visual icon toggles: new `IconSegmentedField` component rendering themed SVG/glyphs instead of text | Extends the existing `SegmentedField` pattern from `cell-visual-panel.tsx`. Same `role="radiogroup"` contract, same `onPatch` signature — just swaps text children for SVG/icon children + tooltips. | 2026-05-25 |
| Toggle active state: replace `bg-cg-surface` with `bg-cg-accent text-cg-accent-fg` in `SegmentedField` | One className change in the shared component. App brand color (`cg-accent`) is consistent across themes; toggle controls are editor chrome, not calculator content. | 2026-05-25 |
| Dashboard card width stability: switch from `minmax(0, 1fr)` auto-placement to explicit `grid-template-columns` with fixed column count per breakpoint | `grid-cols-1 sm:grid-cols-2` is already used in `my-calculators-section.tsx`. The issue is the `Section` content area's `maxHeight` + scroll causing reflow when siblings expand/collapse. Fix: ensure all Section content areas have a consistent width constraint independent of open/collapsed state. | 2026-05-25 |
| Navigation loading: Next.js `useTransition` + `router.push` to show pending state; optional `<Link prefetch>` on dashboard→editor links | `useTransition` gives an `isPending` boolean for immediate spinner feedback. No new package. Prefetch is configurable and costs one extra fetch per link. Investigation findings go into Open Questions. | 2026-05-25 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
Dashboard (page.tsx)
├── NewCalculatorHero ← MODIFIED (loading indicator on click)
├── Section ("My Calculators")
│   └── Grid (grid-cols-1 sm:grid-cols-2)  ← width-stability fix
│       └── CalcCard ← MODIFIED (loading indicator on edit click)
├── Section ("Presets")
├── Section ("Saved Scenarios")
└── Section ("Trash")

Visitor View (public /c/<token>)
├── VisitorShell
│   ├── VisitorHeader ← MODIFIED (+ Edit button for owner)
│   │   ├── Wordmark
│   │   ├── SaveScenarioHeaderButton
│   │   ├── CloneHeaderButton
│   │   ├── [NEW] EditHeaderButton (owner only)
│   │   └── Avatar / Auth CTAs
│   └── PublicCalculatorPage (unchanged)
└── VisitorFooter

Editor — Live Preview
├── EditorBody
│   ├── GridPanel (unchanged)
│   ├── ResizeHandle (unchanged)
│   ├── BuilderToolbar
│   │   └── ViewportPicker ← MODIFIED (Tablet + Mobile icons)
│   └── BuilderCanvas
│       └── CalculatorRenderer
│           ├── CalculatorHero
│           ├── SectionList ← MODIFIED (wrapping DndContext lifted here)
│           │   ├── SectionBlock (Section A)
│           │   │   ├── SectionToolbar
│           │   │   │   └── LayoutPatternPicker ← MODIFIED (universal catalog)
│           │   │   └── BuilderLayoutGrid ← MODIFIED (SortableContext per section, no DndContext)
│           │   │       ├── SortableItem (cell, chart, or text-block)
│           │   │       └── DropZoneIndicator ← NEW (visual drop target)
│           │   └── SectionBlock (Section B)
│           │       └── ...
│           └── DragOverlay (one global, lifted with DndContext)

Editor — Cell Settings Flyout (Item 8)
├── CellCard ← MODIFIED (pencil icon opens flyout instead of inline panel)
│   └── [Flyout anchor point]
├── CellSettingsFlyout ← NEW (320px Radix Popover)
│   ├── Label field (placeholder "Label (optional)")
│   ├── IconSegmentedField: Text Size (T glyphs) ← NEW
│   ├── IconSegmentedField: Border (box icons) ← NEW
│   ├── IconSegmentedField: Text Color (theme swatches) ← NEW
│   ├── IconSegmentedField: Background Tint (fill squares) ← NEW
│   ├── IconSegmentedField: Size (width bars) ← NEW
│   ├── WidgetPicker (unchanged logic)
│   ├── Emphasis picker (output cells only)
│   └── Theme label
└── [Mobile] BottomSheet fallback (reuse ResponsiveSheet)
```

### Data Model

No database schema changes. All 9 items are pure frontend
(components + state changes + one new universal constant).

**Layout patterns:**
- The `layoutPatterns` property is REMOVED from the `Theme` type
- A new `UNIVERSAL_LAYOUT_CATALOG: readonly LayoutPattern[]` is
  exported from `layout-patterns.ts` — contains all 8 patterns
- `resolveLayoutPattern()` takes the universal catalog instead of
  the theme's pattern list
- All theme files drop their `layoutPatterns` property
- Three new pattern constants are added to `layout-patterns.ts`:
  `FOUR_COLUMN_PATTERN`, `THREE_QUARTERS_ONE_QUARTER_PATTERN`,
  `QUARTER_QUARTER_HALF_PATTERN`

**EditorState (reducer):**
- No new state fields. Cross-section DnD uses the existing
  `patchCell` / `patchChart` / `patchTextBlock` mutations with
  a new `section_id` + `display_order` in the PATCH body. The
  existing undo stack handles the revert.

**No new API endpoints.** All PATCH calls reuse existing routes:
- `PATCH /api/cells/:id` — `section_id`, `display_order`
- `PATCH /api/charts/:id` — `section_id`, `display_order`
- `PATCH /api/text_blocks/:id` — `section_id`, `display_order`

### Changes by Item

**Item 1 — Dashboard Card Width Stability**

Affected files:
- `src/components/dashboard/section.tsx` — the content area's
  `maxHeight` scroll already works correctly; the actual issue
  is that when sections expand/collapse, the page reflows and
  the Section's `overflow-hidden rounded-[10px]` wrapper may
  briefly change width during Radix Collapsible animation. Fix:
  add `will-change: height` or `contain: layout` to the
  `CollapsibleContent` wrapper so the browser doesn't reflow
  siblings during the collapse animation.
- Verify that `grid-cols-1 sm:grid-cols-2` in
  `my-calculators-section.tsx`, `presets-section.tsx`,
  `trash-section.tsx` all use the same grid pattern (currently
  they do). No structural change needed — the fix is CSS-only
  on the Section primitive.

**Item 2 — Navigation Loading Indicators**

Affected files:
- `src/components/dashboard/calc-card.tsx` — wrap `router.push`
  calls in `useTransition()`. The `isPending` boolean drives a
  spinner overlay or opacity pulse on the card.
- `src/components/dashboard/new-calculator-hero.tsx` — same
  `useTransition()` pattern for the "+ New" button.
- `src/components/editor/builder-toolbar.tsx` — Dashboard
  breadcrumb uses `router.push('/dashboard')`. Wrap with
  `useTransition()` for a pending indicator.
- Investigation: measure actual navigation time, identify whether
  the delay is server-side data fetching (Supabase query for the
  calculator + all cells/sections/charts/text_blocks), client
  hydration, or bundle size. Document findings in Open Questions.

**Item 3 — Owner Edit Button on Visitor View**

Affected files:
- `src/app/(public)/c/[token]/page.tsx` — compute `isOwner`
  by comparing `current?.user.id` to `result.calculator.user_id`.
  Pass `isOwner` and `calculatorId` as props to `VisitorShell`
  (which threads them to `VisitorHeader`).
- `src/components/visitor/visitor-shell.tsx` — accept and pass
  through `isOwner` + `calculatorId` props.
- `src/components/visitor/visitor-header.tsx` — when `isOwner`
  is true, render an edit button (pencil icon, same styling as
  `calc-card.tsx` line 437-441) that links to `/editor/<id>`.
  Position: between CloneHeaderButton and the avatar/CTAs.

Auth flow:
- Server Component computes ownership → passes boolean prop →
  no client-side auth check needed.
- If session expires, the next server render sets `isOwner=false`
  → button disappears.

**Item 4 — Viewport Picker Icons**

Affected files:
- `src/components/shell/icons.tsx` — add `Tablet` icon (portrait
  rectangle with rounded corners) and `Smartphone` icon (narrow
  portrait rectangle with rounded corners, notch line at top).
  Standard Lucide-style SVG.
- `src/components/editor/viewport-picker.tsx` — replace
  `Icons.LayoutGrid` → `Icons.Tablet`, `Icons.Menu` →
  `Icons.Smartphone` in the `OPTIONS` array.

**Item 5 — Universal Section Layout Catalog**

Affected files:
- `src/lib/themes/layout-patterns.ts` — add three new pattern
  constants: `FOUR_COLUMN_PATTERN` (`[1,1,1,1]`),
  `THREE_QUARTERS_ONE_QUARTER_PATTERN` (`[3,1]`),
  `QUARTER_QUARTER_HALF_PATTERN` (`[1,1,2]`). Export a
  `UNIVERSAL_LAYOUT_CATALOG` array containing all 8 in the
  spec-mandated order.
- `src/lib/themes/types.ts` — REMOVE `layoutPatterns` from
  `ThemeBase`.
- All 8 theme files (`calcgrinder.ts`, `vessel.ts`,
  `editorial.ts`, `calcgrinder-ci.ts`, `minimal.ts`, `bento.ts`,
  `bento-glassy.ts`, `terminal.ts`) — remove the `layoutPatterns`
  property from each theme object.
- `src/lib/themes/index.ts` — re-export `UNIVERSAL_LAYOUT_CATALOG`
  and the `LayoutPattern` type.
- `src/components/editor/section-block.tsx` — call
  `resolveLayoutPattern(UNIVERSAL_LAYOUT_CATALOG, ...)` instead
  of `resolveLayoutPattern(theme.layoutPatterns, ...)`.
- `src/components/editor/section-block.tsx` (SectionToolbar) —
  pass `UNIVERSAL_LAYOUT_CATALOG` to `LayoutPatternPicker`
  instead of `theme.layoutPatterns`.
- Theme test files — update snapshot expectations to not include
  `layoutPatterns`.

Backward compat: all existing `layout_pattern_id` values stored
in the DB match one of the 5 pre-existing patterns
(`single_column`, `two_column`, `two_thirds_one_third`,
`one_third_two_thirds`, `three_column`). All 5 remain in the
universal catalog, so `resolveLayoutPattern()` still finds them.

**Item 6 — Toggle Active State Brand Color**

Affected files:
- `src/components/editor/cell-visual-panel.tsx` —
  `SegmentedField`: change the selected-state className from
  `'bg-cg-surface text-cg-text shadow-sm'` to
  `'bg-cg-accent text-cg-accent-fg shadow-sm'`.
- `src/components/editor/cell-data-model-panel.tsx` — same
  change to any `SegmentedField` or `SegmentedToggle` used in
  the Grid cell settings.

**Item 7 — Compact Visual-Icon Toggles in Live Preview**

Affected files:
- `src/components/editor/cell-visual-panel.tsx` — replace
  `SegmentedField` instances with new `IconSegmentedField`
  component for: Text Size, Border, Text Color, Background Tint,
  Size. Each gets custom icon renderers:
  - **Text Size**: 4 "T" glyphs at increasing font-sizes
    (10px, 13px, 16px, 20px)
  - **Border**: 3 small box SVGs (no border, 1px border, 2px
    border)
  - **Text Color**: 3 color swatches rendered as circles filled
    with the theme's actual colors (`theme.text`, `theme.accent`,
    `theme.accentSoft`)
  - **Background Tint**: 3 small squares with opacity 0, 0.15,
    0.4 of the theme's tint color
  - **Size**: 3 horizontal bars at proportional widths (33%,
    66%, 100%)
- New component `IconSegmentedField` in `cell-visual-panel.tsx`
  (or extracted to its own file if large). Same props as
  `SegmentedField` but children are `ReactNode` per option +
  `tooltip` string per option.
- Label field: remove the "LABEL" heading, use placeholder text
  "Label (optional)" on the Input.
- All icon segments get `title` (tooltip) with the text label
  and `aria-label` for accessibility.

**Item 8 — Cell Settings Flyout Panel**

Affected files:
- `src/components/editor/cell-card.tsx` — pencil icon onClick
  changes from toggling inline `CellVisualPanel` visibility to
  opening the flyout via a ref/state.
- `src/components/editor/cell-settings-flyout.tsx` ← NEW file.
  A 320px-wide Radix `Popover` anchored to the card's right
  edge. Contains the same settings content as `CellVisualPanel`
  (refactored: shared settings body, different containers).
  - Desktop: `PopoverContent` with `side="right"` (flips to
    `side="left"` via Radix's built-in collision avoidance).
  - Mobile: replace with `ResponsiveSheet` (PROJ-12 pattern)
    that renders a bottom sheet below the `md:` breakpoint.
  - One flyout at a time: managed by a single
    `activeFlyoutId: string | null` state in `SectionBlock` or
    lifted to the `CalculatorRenderer`.
  - Escape + click-outside: handled natively by Radix Popover.
- Chart cards and text-block cards: same flyout pattern for their
  visual panels (shared flyout wrapper, different settings body).

**Item 9 — Cross-Section Drag & Drop**

Affected files:
- `src/components/editor/section-list.tsx` — wrap all
  `SectionBlock` children in a single `DndContext` (was per-
  section in `BuilderLayoutGrid`). The `DragOverlay` moves here
  too. `onDragEnd` now reads `over.data.current.sortable
  .containerId` to determine which section the drop targets.
- `src/components/editor/section-block.tsx` —
  `BuilderLayoutGrid` loses its `DndContext` + `DragOverlay`.
  Retains `SortableContext` with its section's items as the
  sortable group. Adds a droppable empty-zone at the end of
  each section for cross-section drops into empty sections.
- `src/components/editor/dnd-helpers.tsx` — `SortableItem`
  passes `data={{ sectionId }}` to `useSortable()` so the
  parent `onDragEnd` handler knows the target section.
- `src/lib/editor/EditorProvider.tsx` — add a `moveElement`
  action that PATCHes both `section_id` and `display_order`
  on the dragged element + renumbers siblings in both source
  and target sections. Enrolls a single undo entry.
- Remove the cross-section toast guard from
  `section-block.tsx` (line 492-495 in current code).

DnD mechanics:
- `@dnd-kit/core` natively supports multiple `SortableContext`
  containers under one `DndContext` — items can be dragged
  between containers.
- Each `SortableContext` is identified by a `containerId`
  (section id).
- The `onDragEnd` handler: if `over.data.current.sortable
  .containerId !== active.data.current.sortable.containerId`,
  it's a cross-section move → call `moveElement(elementId,
  targetSectionId, newDisplayOrder)`.
- Visual feedback: all sections show drop zone highlights
  when a drag is active (CSS class toggled by
  `useDndMonitor()`).
- Empty section after drag-out: remains visible with the
  "Drop elements here" placeholder.

### Dependencies (packages to install)

None. All 9 items use existing packages:
- `@dnd-kit/core` + `@dnd-kit/sortable` (already installed)
- `@radix-ui/react-popover` via `@/components/ui/popover` (already installed)
- Lucide icon paths (hand-drawn SVGs, no new package)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
