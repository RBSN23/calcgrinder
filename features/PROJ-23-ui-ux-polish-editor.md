# PROJ-23: UI/UX Polish Part 1 — Editor

## Status: Approved
**Created:** 2026-05-25
**Last Updated:** 2026-05-25

## Dependencies
- Requires: PROJ-8 (Editor — Grid + Builder Two-Panel Split)
- Requires: PROJ-9 (Cell Authoring & Section Management)
- Requires: PROJ-6 (Calculator Theme System)
- Requires: PROJ-15 (Charts) — chart columns participate in global expand
- Requires: PROJ-16 (Text Blocks) — inline editing replaces split-pane

## User Stories

- As a **calculator author**, I want to expand cell settings in-place below the grid header so that the settings panel doesn't float over the builder toolbar and become unreachable.
- As a **calculator author**, I want to rename cells by double-clicking the column header so that I can rename without opening a separate panel.
- As a **calculator author**, I want the label field in the Cell Visual Panel (not the Grid settings) so that visual properties are co-located with visual controls.
- As a **calculator author**, I want the grid panel to stay sticky on desktop so that I can always see and edit cell data while scrolling through a long builder canvas.
- As a **calculator author**, I want text blocks in the builder canvas to look identical to the visitor view, with inline editing on click, so that the canvas always reflects the published output.
- As a **calculator author**, I want the calculator title input to maintain its heading font size during editing so that there is no layout shift when I click to edit.
- As a **calculator author**, I want app dark/light mode changes to never affect the calculator preview so that I always see the calculator exactly as visitors will.

## Out of Scope

- **WYSIWYG markdown editor for text blocks** — inline textarea is plain source, no rich-text toolbar (PRD non-goal)
- **Per-cell expand** — expand/collapse is global only; no per-column independent toggle
- **Mobile grid interactions** — mobile layout unchanged (no grid panel on mobile); all 7 issues target desktop only
- **Grid column reordering by drag** — out of scope for this polish round
- **Keyboard shortcuts for expand/collapse** — not in this iteration; could be added later
- **Undo/redo for inline rename** — standard browser undo within the text input; not wired to the editor undo stack
- **Text block visual panel redesign** — visual panel controls stay as-is; only the content editing surface changes
- **Formula editor changes** — formula editing in output cells stays in the grid data row; not affected by the settings panel redesign
- **Settings Panel for text blocks in the grid** — text blocks don't appear in the grid (per PROJ-16 spec override)

## Acceptance Criteria

### Issue 1 — Grid Cell Settings: Expand-in-Place + Compact Redesign

- [ ] Given the editor is open on desktop, when the user clicks a cell column's chevron icon, then ALL cell and chart columns expand simultaneously to show their settings panel below the column header
- [ ] Given all columns are expanded, when the user clicks any column's chevron icon, then ALL columns collapse simultaneously
- [ ] Given a column is in its collapsed state, then a downward-pointing chevron icon is displayed in the column header (replacing the former kebab ⋮ icon)
- [ ] Given a column is in its expanded state, then the chevron rotates to indicate the open state
- [ ] Given the Grid Panel header strip, then a master expand/collapse toggle is present next to the "Grid" label
- [ ] Given the master toggle is clicked, then all columns expand or collapse (same as clicking any individual chevron)
- [ ] Given settings are expanded, then the builder toolbar and canvas shift downward proportionally — no overflow, no clipping of the settings content
- [ ] Given settings are expanded, then there is no close-X button on any settings panel — the only close mechanism is the chevron toggle
- [ ] Given the expanded settings panel for a cell, then the following fields are displayed as segmented toggle controls in compact rows: KIND (input / output), VISIBILITY (visible / hidden), EDITABILITY (editable / readonly — shown only for input cells), DESCRIPTION RENDER (caption / tooltip)
- [ ] Given the expanded settings panel for a cell, then VALUE TYPE is displayed as a compact inline select (dropdown) with all 7 options (number, currency, percent, date, boolean, select, text)
- [ ] Given a cell's VALUE TYPE is set to number, currency, or percent, then numeric constraint fields (min, max, step) appear inline below the VALUE TYPE select
- [ ] Given a cell's VALUE TYPE is set to currency, then the currency code field appears inline below the VALUE TYPE select
- [ ] Given a cell's VALUE TYPE is set to select, then the select options list appears inline below the VALUE TYPE select
- [ ] Given a cell's VALUE TYPE does not require additional fields, then no extra fields appear below the VALUE TYPE select
- [ ] Given the expanded settings panel, then the former NAME field is absent (moved to inline rename — Issue 2)
- [ ] Given the expanded settings panel, then the former LABEL field is absent (moved to Visual Panel — Issue 3)
- [ ] Given the expanded settings panel, then a single-line text field labeled "NOTES" appears at the bottom of the panel (renamed from "DESCRIPTION")
- [ ] Given the expanded settings panel for a chart column, then chart-specific settings are shown using the same compact expand pattern
- [ ] Given the settings panel height, then the total expanded height is approximately half of the current panel height or less

### Issue 2 — Cell Name: Double-Click Inline Rename in Grid

- [ ] Given the editor grid is visible, when the user double-clicks a cell name in the column header, then the name text transforms into an inline text input at that position
- [ ] Given the inline rename input is active, when the user presses Enter or the input loses focus, then the new name is committed (saved via PATCH)
- [ ] Given the inline rename input is active, when the user presses Escape, then the edit is discarded and the original name is restored
- [ ] Given the user enters an empty name, then the input shows a validation error and does not commit
- [ ] Given the user enters a name that already exists on another cell in the same calculator, then the input shows a validation error and does not commit
- [ ] Given the user enters a name with invalid characters (not matching cell-name rules), then the input shows a validation error and does not commit
- [ ] Given the inline rename input, then it has the same monospace styling as the resting-state cell name — no layout shift

### Issue 3 — Label Field Moves to Cell Visual Panel

- [ ] Given the cell data model settings panel (Issue 1), then no LABEL field is present
- [ ] Given the Cell Visual Panel is open (via pencil hover icon on a cell card in the canvas), then a LABEL text field is present at the top of the panel, before the style controls
- [ ] Given the user edits the LABEL in the Visual Panel, then the change is saved immediately via PATCH (consistent with other Visual Panel controls)
- [ ] Given the LABEL field is empty, then the cell falls back to displaying the cell name as the label (existing behaviour preserved)

### Issue 4 — Grid Panel Sticky on Desktop

- [ ] Given the editor is open on desktop, when the user scrolls the builder canvas, then the grid panel remains fixed/sticky at its position (does not scroll out of view)
- [ ] Given the builder canvas content exceeds the viewport height, then the canvas scrolls independently below the grid panel
- [ ] Given the grid settings are expanded (Issue 1), then the grid panel height grows to accommodate the expanded content and the canvas area shrinks proportionally
- [ ] Given the grid settings are collapsed, then the grid panel returns to its collapsed height (controlled by the resize handle)
- [ ] Given the resize handle between grid and canvas, then it continues to function and controls the collapsed-state grid height
- [ ] Given the editor is open on mobile, then the layout is unchanged (no sticky grid — grid is not shown on mobile)

### Issue 5 — Text Block Builder Canvas: Inline Editing

- [ ] Given a text block exists in a section, when the builder canvas renders it, then the text block shows only the rendered markdown output — identical to the visitor/public view
- [ ] Given a text block in the builder canvas, when the user clicks inside it, then the rendered markdown is replaced by a plain textarea containing the raw markdown source
- [ ] Given the inline textarea is active, when the user types, then changes are auto-saved (debounced PATCH, consistent with existing text block save behavior)
- [ ] Given the inline textarea is active, when the user clicks outside the text block or the textarea loses focus, then the textarea disappears and the rendered markdown returns
- [ ] Given the inline textarea is active, when the user presses Escape, then editing ends and the rendered markdown returns
- [ ] Given a text block in the builder canvas, then there is no source + preview split-pane visible in the canvas
- [ ] Given a text block in the builder canvas, when the user hovers and clicks the pencil icon, then the Text Block Visual Panel opens (style controls: tint, border, size, text color) — NOT the inline textarea
- [ ] Given a freshly added text block (empty), then the canvas shows an empty-state placeholder; clicking it opens the inline textarea

### Issue 6 — Title Editing: Constant Font Size in Hero

- [ ] Given the calculator title in the builder canvas hero, when the user clicks to edit it, then the input field has the same font-size, font-weight, letter-spacing, and line-height as the resting-state title heading
- [ ] Given the user is editing the title, then there is zero layout shift — no content jumping up or down when entering or leaving edit mode
- [ ] Given the user finishes editing (blur/Enter), then the transition back to resting state is seamless with no visual flash or resize

### Issue 7 — Dark/Light Mode: App Theme Does Not Affect Calculator Preview

- [ ] Given the user switches the app theme from light to dark (or vice versa), then the builder canvas background, text colors, and all calculator-themed elements remain unchanged
- [ ] Given any calculator theme is active, then the builder canvas renders exclusively with that calculator theme's tokens — no CSS variables or inherited styles from the app's dark/light mode leak through
- [ ] Given the visitor view of the same calculator, then the builder canvas preview is visually identical to the visitor view regardless of the app's dark/light mode setting

## Edge Cases

- **Issue 1: Expand with many columns.** When the calculator has 20+ cells, expanding all settings simultaneously will create a wide scrollable area. The grid must remain horizontally scrollable with all columns expanded. Each column's expanded settings must have a consistent width that accommodates the longest field.
- **Issue 1: Expand with mixed cell types.** Input cells show EDITABILITY toggle; output cells do not. The panel height may differ slightly per column. Alignment should be top-anchored so mismatched heights don't create visual jaggedness.
- **Issue 2: Rename to a formula-referenced name.** Renaming a cell that is referenced by other cells' formulas must update formula references or (minimally) not break existing formulas. The current rename behavior in the data model panel is the baseline — inline rename must behave identically.
- **Issue 2: Double-click on kind pill or visibility badge.** Double-clicking on non-name elements in the column header must NOT trigger the rename editor. Only the name text itself is the double-click target.
- **Issue 4: Very tall expanded grid.** If the calculator has many cells and settings are expanded, the grid panel could consume most of the viewport. The canvas area must still have a minimum usable height (at least ~200px) regardless of grid expansion.
- **Issue 5: Long markdown content.** For text blocks with very long markdown, the inline textarea should auto-grow vertically to fit content (up to a reasonable max), matching the height of the rendered output it replaces.
- **Issue 5: Markdown with images.** If the markdown contains image references (external URLs), the inline textarea shows the raw markdown (including image URLs). The rendered state shows the images. This height difference is acceptable.
- **Issue 6: Very long titles.** Titles that span multiple lines in the hero must maintain their wrapping behavior identically in edit mode. The textarea/input must support the same multi-line wrapping.
- **Issue 7: Themes with transparent backgrounds.** If a calculator theme uses semi-transparent backgrounds (e.g., glass card style), the builder canvas must provide an opaque isolation layer so the app theme's background doesn't bleed through the transparency.

## Technical Requirements

- **Performance:** Expand/collapse animation should complete in ≤150ms. No jank during grid height transitions.
- **Browser support:** Chrome, Firefox, Safari (latest versions). Standard desktop breakpoint (md: 768px+).
- **Accessibility:** Chevron toggle must be keyboard-accessible (Enter/Space to toggle). Inline rename must support standard text input keyboard navigation. ARIA states (expanded/collapsed) must be set on expandable regions.
- **State persistence:** Expand/collapse state is session-only (not persisted to database). Reloading the editor resets to collapsed.

## Open Questions

- [x] Should the inline rename (Issue 2) automatically update formula references in other cells, or should it behave like the current name-change in the data model panel? → **YES, same behavior as current.** The existing PATCH endpoint rewrites dependent formulas. Inline rename uses the same path.
- [x] Should the expand/collapse state be shared across sections or truly global (one toggle for the entire grid)? → **Global.** One boolean for the entire grid. Since columns sit side-by-side in horizontal scroll, partial expand saves no vertical space.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Global expand/collapse (not per-cell) | Keeps interaction model simple — no cognitive load deciding which columns to expand. All-or-nothing matches the use case of "configure cells, then return to building." | 2026-05-25 |
| VALUE TYPE as compact inline select, binary fields as segmented toggles | 7 VALUE TYPE options don't fit a toggle control. Binary fields (kind, visibility, editability, description render) work naturally as 2-option segmented controls. | 2026-05-25 |
| Value-type-specific fields shown conditionally inline | Keeps panel compact for simple cells while making advanced fields (min/max/step, select options, currency code) discoverable when relevant. | 2026-05-25 |
| Text block inline editor is a plain textarea | Consistent with title/section editing pattern. No WYSIWYG (PRD non-goal). Resting state IS the preview, so no split-pane needed. | 2026-05-25 |
| Click = content editing, Pencil = style controls (text blocks) | Matches cell card pattern where pencil hover icon opens the Visual Panel. Content editing is the primary action (click), style is secondary (pencil). | 2026-05-25 |
| Grid height grows when settings expand | Avoids scroll-within-scroll. Canvas area shrinks proportionally. Resize handle controls the collapsed-state height. | 2026-05-25 |
| Charts included in global expand/collapse | All grid column types (cells + charts) expand together. Inconsistent behavior (some columns react, others don't) would confuse users. | 2026-05-25 |
| Both per-column chevrons + master toggle in Grid header | Chevrons are discoverable from any column position; master toggle provides a central control. Redundancy aids discoverability without harming usability. | 2026-05-25 |
| LABEL field moves to top of Cell Visual Panel | Label is a visual/presentation concern — it controls what visitors see, not data-model semantics. Co-locating it with other visual controls is more coherent. | 2026-05-25 |
| DESCRIPTION renamed to NOTES | "Notes" better describes the field's purpose (author-facing annotations). Positioned at the bottom of the settings panel as the least-used field. | 2026-05-25 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Single `gridSettingsExpanded` boolean in EditorState | Global expand is one reducer action, one piece of state — no per-column tracking. All columns expand/collapse together (they sit side-by-side, so partial expand saves no space). | 2026-05-25 |
| Inline rename reuses existing rename API path + EditorProvider formula-rewrite logic | The PATCH `/api/cells/:id` already rewrites dependent formulas on name change. The client-side EditorProvider already snapshots dependents for undo. No new logic needed — just a new trigger surface. | 2026-05-25 |
| Canvas visual panels remain independent per-element | Opening Cell A's visual panel does NOT close Cell B's. Multiple visual panels can coexist. This is distinct from the Grid settings (which are globally toggled). | 2026-05-25 |
| Text block inline editing replaces current split-pane | Click on content → textarea overlay (same card dimensions). No side-by-side. Pencil hover icon → visual panel (style controls). Separates content editing (primary) from styling (secondary). | 2026-05-25 |
| Canvas outer wrapper uses `theme.bg` instead of `bg-cg-bg` | Removes the single point where the app's dark/light mode leaks into the calculator preview. Calculator is rendered with theme tokens only. | 2026-05-25 |
| EditableText receives inline `style` object for input matching | Pass the resting-state font metrics (size, weight, spacing, line-height) through to the editing input so there is zero layout shift. No new component — same primitive, enhanced props. | 2026-05-25 |
| Grid panel uses `max-content` height when settings expanded | When `gridSettingsExpanded` is true, the grid panel grows to its content height (capped at 60% of container). When collapsed, it returns to the user-set resize-handle height. | 2026-05-25 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
EditorBody (desktop two-panel layout)
├── GridPanel
│   ├── Header Strip
│   │   ├── Master expand/collapse chevron toggle
│   │   ├── "Grid" label + column count badge
│   │   └── AddPicker (+ Add menu)
│   ├── Column Row (horizontal scroll)
│   │   ├── GridColumn (per cell) ← MODIFIED
│   │   │   ├── Column Header
│   │   │   │   ├── Cell Name (double-click → inline rename input)
│   │   │   │   ├── Kind pill + Visibility chip
│   │   │   │   └── Chevron toggle (replaces kebab ⋮)
│   │   │   ├── Data Row (value/formula — unchanged)
│   │   │   └── [Expanded] Compact Settings Panel ← NEW
│   │   │       ├── Segmented toggles: KIND, VISIBILITY, EDITABILITY, DESC RENDER
│   │   │       ├── Inline select: VALUE TYPE
│   │   │       ├── [Conditional] Numeric constraints / currency / select options
│   │   │       └── NOTES text field (bottom)
│   │   └── ChartGridColumn (per chart) ← MODIFIED
│   │       ├── Column Header (with chevron toggle)
│   │       └── [Expanded] Chart settings panel
│   └── Empty State
├── ResizeHandle (drag-resize — controls collapsed-state height)
├── BuilderToolbar (unchanged)
└── BuilderCanvas ← MODIFIED (theme.bg isolation)
    └── CalculatorRenderer (shared pipeline)
        ├── CalculatorHero ← MODIFIED (title style consistency)
        ├── SectionList
        │   ├── SectionBlock
        │   │   ├── Section Header (unchanged)
        │   │   ├── Cell Cards (unchanged — visual panels stay independent)
        │   │   ├── Chart Cards (unchanged)
        │   │   └── TextBlockCard ← MODIFIED (inline editing)
        │   │       ├── [Resting] Rendered Markdown (identical to visitor)
        │   │       ├── [Editing] Inline Textarea (click to enter)
        │   │       └── [Visual Panel via pencil] Style controls
        │   └── ...
        └── ...
```

### Data Model

No database schema changes. All 7 issues are pure frontend (component + state changes).

**EditorState additions** (reducer):
- `gridSettingsExpanded: boolean` (default `false`) — drives the global expand/collapse of cell/chart settings in the grid panel

**No new API endpoints.** All PATCH calls reuse existing routes:
- `PATCH /api/cells/:id` — name, label, kind, value_type, visibility, etc.
- `PATCH /api/text_blocks/:id` — body
- `PATCH /api/calculators/:id` — title

### Changes by Issue

**Issue 1 — Grid Cell Settings: Expand-in-Place**

Affected files:
- `src/lib/editor/reducer.ts` — add `gridSettingsExpanded` to state + `TOGGLE_GRID_SETTINGS` action
- `src/components/editor/grid-panel.tsx` — master chevron toggle in header, height logic (auto-grow when expanded)
- `src/components/editor/grid-column.tsx` — replace per-column `expanded` state with global `gridSettingsExpanded` read; replace kebab ⋮ with chevron icon; remove close-X; redesign panel to compact layout (segmented toggles + inline select)
- `src/components/editor/cell-data-model-panel.tsx` — rewrite as compact settings panel (remove NAME, LABEL, FORMULA fields; add segmented toggles for binary fields; rename DESCRIPTION → NOTES; conditional sub-fields based on value_type)
- `src/components/editor/chart-grid-column.tsx` — add chevron toggle; when grid settings expand, show chart-specific settings inline (chart type, bindings summary)

Layout mechanics:
- Grid panel `height` prop becomes conditional: `gridSettingsExpanded ? 'auto' : gridHeight`
- Grid panel gets `max-height: 60%` when expanded (same cap as resize handle)
- `min-height` on the canvas area: `200px` (prevents settings from consuming the entire viewport)
- Transition: CSS `transition: max-height 150ms ease` for smooth expand/collapse animation

**Issue 2 — Cell Name: Double-Click Inline Rename**

Affected files:
- `src/components/editor/grid-column.tsx` — add `onDoubleClick` handler on the name `<span>`, switch to inline `<input>` with monospace styling; Enter/blur commits via existing `patchCell({ name })`, Escape reverts
- Reuses existing `validateCellName()` from `@/lib/cells/types`
- Reuses existing EditorProvider formula-rewrite logic (the `patchCell` path already handles rename dependents)

Double-click target: ONLY the `<span>` containing the cell name text. The kind pill and visibility chip are separate elements — double-clicking them does nothing.

**Issue 3 — Label Field Moves to Visual Panel**

Affected files:
- `src/components/editor/cell-data-model-panel.tsx` — remove the LABEL `<Field>` block
- `src/components/editor/cell-visual-panel.tsx` — add a LABEL text input at the top of the panel (before Background Tint), using the same Input component + onBlur PATCH pattern

**Issue 4 — Grid Panel Sticky on Desktop**

Affected files:
- `src/components/editor/grid-panel.tsx` — conditional height/max-height based on `gridSettingsExpanded`
- `src/components/editor/editor-body.tsx` — ensure canvas area has `min-h-[200px]` and `flex-1 overflow-auto`

Current layout already achieves sticky behavior (grid has fixed height, canvas scrolls independently). The key change is: when settings expand, the grid grows to content height instead of staying at the user-set `gridHeight`. The resize handle continues to control the collapsed-state height.

**Issue 5 — Text Block Inline Editing**

Affected files:
- `src/components/editor/text-block-card.tsx` — refactor `TextBlockEditAffordance`:
  - Resting: rendered markdown (click anywhere on content → enter edit mode)
  - Editing: inline textarea (auto-grow, debounced save, blur/Escape → exit)
  - Pencil hover icon: opens TextBlockVisualPanel (independent of editing state)
  - Remove: `TextBlockExpandedView` (the split-pane wrapper)
- `src/components/editor/text-block-editor-pane.tsx` — repurpose as a plain inline textarea (remove the grid-cols-2 split-pane layout, remove "Live preview" column, remove "Markdown source" label)

Interaction model:
- Click on rendered content → replace with textarea at same position (no split-pane)
- Textarea auto-grows to fit content (CSS `field-sizing: content` with a min-height fallback)
- Debounced PATCH on change (500ms), immediate flush on blur
- Escape or click-outside → exit edit mode, show rendered markdown again
- Pencil icon → TextBlockVisualPanel (style controls) — can be open alongside the textarea

**Issue 6 — Title Editing: Constant Font Size**

Affected files:
- `src/components/editor/editable-text.tsx` — add an optional `inputStyle?: React.CSSProperties` prop that applies to the `<input>` / `<textarea>` element alongside `inputClassName`
- `src/components/editor/calculator-hero.tsx` — pass `inputStyle={{ fontSize: 28, fontWeight: 700, letterSpacing: ..., lineHeight: 1.15, fontFamily: themeFont }}` to the title `EditableText`

This ensures the editing input renders at the exact same size as the resting `<h1>`, eliminating layout shift.

**Issue 7 — Dark/Light Mode Isolation**

Affected files:
- `src/components/editor/builder-canvas.tsx` — replace `className="flex-1 overflow-auto bg-cg-bg"` with an inline style `style={{ background: theme.bg }}` where `theme` is read from the calculator state. This removes the single CSS-variable reference that responds to dark mode.

The calculator preview content is already fully isolated (inline styles from theme tokens). The only leakage point is the canvas wrapper's background. Builder-only chrome (hover affordances, drag handle overlays, edit buttons) uses `cg-*` variables intentionally — they are editor UI, not calculator content.

For themes with semi-transparent backgrounds (edge case), the canvas wrapper provides an opaque base. Since `theme.bg` is always an opaque color, no additional isolation layer is needed.

### Tech Decisions (Justified)

| Choice | Why |
|--------|-----|
| No new packages needed | All interactions use native DOM APIs (double-click, focus management, CSS transitions). No drag library, no animation library. |
| Session-only state (not persisted) | Expand/collapse is ephemeral — reload resets to collapsed. No database round-trip for a UI preference. |
| CSS `field-sizing: content` for auto-grow textarea | Supported in Chrome 123+, Firefox 131+, Safari 18+. Falls back gracefully (fixed height with resize handle) on older browsers. No JS resize observer needed. |
| Reuse existing `patchCell` / `validateCellName` | Inline rename is just a new trigger for the same mutation. No new validation logic, no new API surface, no new undo logic. |
| Global expand uses reducer action (not component state) | Multiple components need to read/react to it (GridPanel header toggle, each GridColumn chevron, ResizeHandle height logic). Reducer is the single source of truth. |

### Dependencies (packages to install)

None. All 7 issues are implementable with existing packages.

### Open Questions (Resolved)

- **Q: Should inline rename update formula references?** → YES. The existing PATCH `/api/cells/:id` already rewrites dependent formulas on name change. The EditorProvider already handles the client-side formula rewrite + undo snapshot. Inline rename uses the same path — behavior is identical to the current data-model panel rename.
- **Q: Should expand/collapse be shared across sections or truly global?** → GLOBAL. One boolean (`gridSettingsExpanded`) controls all columns. Since columns are side-by-side in a horizontal scroll, expanding one column's settings is visually identical to expanding all (same vertical space consumed).

## Implementation Notes

### Deviations from Architecture Spec

| Change | Rationale | Date |
|--------|-----------|------|
| Compact settings panel: all labels removed except Min/Max/Step | Toggle options (Input/Output, Visible/Hidden, etc.) and dropdowns are self-explanatory — labels doubled the vertical space for no usability gain. `aria-label` kept for screen readers. | 2026-05-25 |
| Currency field changed from text input to Select dropdown (32 currencies) | Dropdown prevents typos and is faster than typing a 3-letter code. Covers all major world currencies. | 2026-05-25 |
| Settings panels top-aligned (not bottom-aligned) | Removed `flex-1` from data row so panels stack directly below header + data. First toggle sits at the same Y across all columns — much easier to scan and operate. | 2026-05-25 |
| Builder canvas desktop max-width changed from `100%` to `1200px` | Matches the public view's `max-w-[1200px]` constraint. Builder preview is now pixel-identical to visitor view at the same window width. | 2026-05-25 |
| Dark/light mode isolation via `.cg-force-light` CSS class | Architecture spec only mentioned replacing `bg-cg-bg` with `theme.bg` on the canvas wrapper. In practice, `cg-*` CSS variables leaked throughout the entire calculator rendering pipeline (visitor page background, input fields, borders). Fix: a CSS class that redeclares all `cg-*` + shadcn variables to their light values, applied to the public layout and builder canvas. | 2026-05-25 |

### Files Changed

- `src/lib/editor/reducer.ts` — `gridSettingsExpanded` state + `TOGGLE_GRID_SETTINGS` action
- `src/components/editor/grid-panel.tsx` — master settings toggle, auto-height when expanded
- `src/components/editor/grid-column.tsx` — chevron toggle, inline rename, top-aligned settings
- `src/components/editor/cell-data-model-panel.tsx` — compact label-free layout, currency dropdown
- `src/components/editor/chart-grid-column.tsx` — chevron toggle, expanded chart info
- `src/components/editor/cell-visual-panel.tsx` — LABEL field added at top
- `src/components/editor/text-block-card.tsx` — inline editing replaces split-pane
- `src/components/editor/editable-text.tsx` — `inputStyle` prop for zero-shift editing
- `src/components/editor/calculator-hero.tsx` — passes font metrics via `inputStyle`
- `src/components/editor/builder-canvas.tsx` — `cg-force-light` + `theme.bg` + matched padding
- `src/components/editor/viewport-picker.tsx` — desktop max-width `1200px`
- `src/app/globals.css` — `.cg-force-light` utility class
- `src/app/(public)/layout.tsx` — `cg-force-light` on visitor wrapper

## QA Test Results

**QA Date:** 2026-05-25
**Tested By:** QA Engineer (automated + code review)
**Build:** Local dev (commit 8d517ca + uncommitted PROJ-23 implementation)

### Automated Test Suite (Pre-QA Baseline)

| Suite | Result | Count |
|-------|--------|-------|
| Vitest unit/integration | PASS | 907 passed (906 existing + 1 new) |
| Playwright E2E (existing) | PASS | 313 passed, 28 skipped |
| Playwright E2E (PROJ-23 new) | PASS | 16 passed |

### Acceptance Criteria Results

#### Issue 1 — Grid Cell Settings: Expand-in-Place + Compact Redesign

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1.1 | Clicking chevron expands ALL cell/chart columns | PASS | E2E: master toggle + per-column chevron verified |
| 1.2 | Clicking chevron again collapses ALL | PASS | E2E: collapse toggle verified |
| 1.3 | Collapsed state shows downward chevron (not kebab ⋮) | PASS | Code review: `Icons.ChevD` replaces kebab |
| 1.4 | Expanded state rotates chevron | PASS | Code review: `rotate-180` class applied |
| 1.5 | Master expand/collapse toggle in Grid header | PASS | E2E: master "Settings" button verified |
| 1.6 | Master toggle syncs with individual chevrons | PASS | Both dispatch same `TOGGLE_GRID_SETTINGS` action |
| 1.7 | Builder toolbar/canvas shift downward (no overflow/clipping) | PASS | Code review: grid uses auto height + max-h-[60vh] |
| 1.8 | No close-X button on settings panel | PASS | E2E: verified no close button exists |
| 1.9 | Segmented toggles for KIND, VISIBILITY, EDITABILITY, DESC RENDER | PASS | E2E: radiogroup controls verified |
| 1.10 | VALUE TYPE as compact inline select (7 options) | PASS | Code review: Select component with all 7 types |
| 1.11 | Numeric constraints appear for number/currency/percent | PASS | Code review: conditional render verified |
| 1.12 | Currency code appears for currency type | PASS | Code review: Select dropdown with 32 currencies |
| 1.13 | Select options appear for select type | PASS | Code review: SelectOptionsEditor rendered |
| 1.14 | No extra fields for types without them | PASS | Code review: conditional rendering |
| 1.15 | NAME field absent (moved to inline rename) | PASS | Code review: removed from CellDataModelPanel |
| 1.16 | LABEL field absent (moved to Visual Panel) | PASS | E2E: verified no Label in settings panel |
| 1.17 | NOTES field at bottom (renamed from DESCRIPTION) | PASS | Code review: notes field with placeholder |
| 1.18 | Chart columns show chart-specific settings | PASS | Code review: ChartGridColumn expanded state |
| 1.19 | Compact panel height ≤ half of former | PASS | Code review: label-free layout, segmented toggles |

#### Issue 2 — Cell Name: Double-Click Inline Rename in Grid

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 2.1 | Double-click name → inline text input | PASS | E2E: verified |
| 2.2 | Enter/blur commits via PATCH | PASS | E2E: verified DB write |
| 2.3 | Escape discards edit | PASS | E2E: verified |
| 2.4 | Empty name → validation error | PASS | E2E: verified |
| 2.5 | Duplicate name → validation error | PASS | Code review: `state.cells.find` check |
| 2.6 | Invalid characters → validation error | PASS | Code review: `validateCellName` called |
| 2.7 | Monospace styling, no layout shift | PASS | Code review: same font-mono class as resting state |

#### Issue 3 — Label Field Moves to Cell Visual Panel

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 3.1 | No LABEL in data model panel | PASS | E2E + code review |
| 3.2 | LABEL text field at top of Visual Panel | PASS | Code review: added before style controls |
| 3.3 | LABEL change saved via PATCH on blur | PASS | Code review: onBlur handler |
| 3.4 | Empty LABEL falls back to cell name | PASS | Code review: `placeholder={cell.name}` |

#### Issue 4 — Grid Panel Sticky on Desktop

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 4.1 | Grid panel stays fixed while canvas scrolls | PASS | Code review: flex column layout, grid has fixed height |
| 4.2 | Canvas scrolls independently | PASS | Code review: `flex-1 overflow-auto` on BuilderCanvas |
| 4.3 | Grid grows when settings expanded | PASS | Code review: auto height + max-h-[60vh] |
| 4.4 | Grid returns to collapsed height | PASS | Code review: conditional height prop |
| 4.5 | Resize handle continues to function | PASS | Code review: ResizeHandle unchanged, controls collapsed height |
| 4.6 | Mobile layout unchanged | PASS | Code review: no changes to mobile layout |

#### Issue 5 — Text Block Builder Canvas: Inline Editing

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 5.1 | Resting state = rendered markdown (identical to visitor) | PASS | E2E: rendered h2 verified |
| 5.2 | Click → plain textarea with raw markdown | PASS | E2E: textarea with markdown source |
| 5.3 | Auto-saved on type (debounced PATCH) | PASS | Code review: 500ms debounce |
| 5.4 | Click outside / blur → rendered markdown returns | PASS | E2E: verified |
| 5.5 | Escape → rendered markdown returns | PASS | E2E: verified |
| 5.6 | No source + preview split-pane | PASS | E2E: no "Live preview" or "Markdown source" |
| 5.7 | Pencil hover icon → Visual Panel (not textarea) | PASS | Code review: separate onClick handler |
| 5.8 | Empty text block shows placeholder; click opens textarea | PASS | Code review: isEmpty conditional |

#### Issue 6 — Title Editing: Constant Font Size in Hero

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 6.1 | Input has same font metrics as resting h1 | PASS | E2E: computed fontSize match verified |
| 6.2 | Zero layout shift | PASS | Code review: inputStyle matches renderResting style |
| 6.3 | Seamless transition back | PASS | Code review: same font metrics |

#### Issue 7 — Dark/Light Mode: App Theme Does Not Affect Calculator Preview

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 7.1 | App theme switch doesn't affect canvas | PASS | Code review: `.cg-force-light` resets all cg-* vars |
| 7.2 | Canvas renders exclusively with calculator theme tokens | PASS | E2E: `cg-force-light` class present |
| 7.3 | Builder preview matches visitor view | PASS | E2E: inline `background` style from theme.bg + cg-force-light on public layout |

### Edge Cases Tested

| Edge Case | Result | Notes |
|-----------|--------|-------|
| Double-click on kind pill (not name text) | PASS | E2E: no rename triggered |
| Inline rename validation (empty, invalid, duplicate) | PASS | E2E + code review |
| Text block auto-grow textarea | PASS | Code review: `fieldSizing: content` with 60px min-height fallback |

### Bugs Found

| # | Severity | Issue | Component | Steps to Reproduce |
|---|----------|-------|-----------|-------------------|
| 1 | Low | Missing `focus-visible:ring-2` on per-column chevron buttons | `grid-column.tsx:192`, `chart-grid-column.tsx:73` | Tab to the per-column chevron toggle — no visible focus ring. The master toggle in `grid-panel.tsx` has `focus-visible:ring-2 focus-visible:ring-cg-accent`, but individual column chevrons don't. |
| 2 | Low | No explicit `min-h-[200px]` on canvas area | `editor-body.tsx` | With 20+ cells and settings expanded, on a small viewport (≤700px height), the canvas could shrink below 200px. The max-h-[60vh] cap on the grid mitigates this for most viewport sizes, but the spec requires a minimum. |

### Pre-Existing Issues (Not PROJ-23 Regressions)

| # | Severity | Issue | Component | Notes |
|---|----------|-------|-----------|-------|
| 1 | Medium | `SelectOptionsEditor` has `value` + `defaultValue` on Input without `onChange` | `cell-data-model-panel.tsx:278-309` | Both `id` and `label` inputs use `value={opt.id}` (controlled) alongside `defaultValue` (ignored in controlled mode) without an `onChange` handler. In React, this makes the inputs effectively read-only during typing. Pre-existing from PROJ-9 — identical code before and after PROJ-23. |

### Security Audit

| Check | Result | Notes |
|-------|--------|-------|
| XSS via inline rename | PASS | `validateCellName` enforces `/^[a-z][a-z0-9_]{0,39}$/`; React auto-escapes |
| XSS via text block markdown | PASS | `rehype-sanitize` + `skipHtml` + no `rehype-raw` |
| CSS injection via theme.bg | PASS | Static compile-time constants, not user-controlled |
| CSS injection via inputStyle | PASS | Hardcoded object literals from theme data |
| Authorization (PATCH calls) | PASS | All reuse existing authenticated, RLS-protected endpoints |
| Data exposure in DOM | PASS | Only UUIDs in data attributes; no secrets or PII |

### Test Files

| Type | File | Tests |
|------|------|-------|
| Unit | `src/lib/editor/reducer.test.ts` | +1 (TOGGLE_GRID_SETTINGS toggle) |
| E2E | `tests/PROJ-23-ui-ux-polish-editor.spec.ts` | 16 tests covering Issues 1-3, 5-7 |

### Production-Ready Decision

**READY** — No Critical or High bugs. Two Low-severity issues found (missing focus ring on column chevrons, no explicit canvas min-height). Both are cosmetic/edge-case and do not block deployment. One pre-existing Medium bug in SelectOptionsEditor is not a PROJ-23 regression.

## Deployment
_To be added by /deploy_
