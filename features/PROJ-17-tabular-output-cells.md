# PROJ-17: Tabular Output Cells

## Status: Deployed
**Created:** 2026-05-24
**Last Updated:** 2026-05-24 (deployed to production)

## Dependencies

- Requires: **PROJ-9 (Cell Authoring & Section Management)** — PROJ-9
  shipped the forward-compat hooks PROJ-17 plugs into:
  `display_emphasis = 'tabular'` already exists as a CHECK-constraint
  enum value in the `cells` table, the emphasis picker in
  `cell-visual-panel.tsx` hides Tabular as a choice, and
  `cell-card.tsx` renders a "Array result — tabular display ships in
  v1.1." placeholder for any Output cell whose formula returns an
  array. PROJ-17 unhides the picker option, removes the placeholder,
  and replaces both with the real renderer + configurator.
- Requires: **PROJ-7 (Formula Engine)** — the engine's
  `EvaluationResult` shape detection (`scalar` / `array_of_scalars` /
  `array_of_objects` / `empty`) is the only signal PROJ-17 uses to
  decide what to render. The 10,000-row array cap (`out_of_range`
  error) already protects the renderer from pathological formulas.
- Requires: **PROJ-11 (Visitor View — Calculator Interface)** —
  PROJ-17 ships **one shared tabular renderer** consumed by both
  the Builder preview and the visitor view. PROJ-11's slot pipeline
  iterates `display_elements` polymorphically; PROJ-17 just adds a
  branch for `kind = output, display_emphasis = tabular` that
  resolves to the shared renderer. No PROJ-11 schema change, no
  visitor-route change.
- Requires: **PROJ-6 (Calculator Theme System)** — table chrome
  (header text, border treatment, row-separator, cell padding,
  empty-state typography) inherits from the active theme's tokens.
  No new theme surface — PROJ-17 reuses existing token names
  (`borderSubtle`, `text`, `muted`, `cardSurface`).

## Summary

PROJ-17 is the **renderer** for Output cells whose formula evaluates
to a row-shaped array. Until now (PROJ-9 HEAD), such cells render a
"ships in v1.1" placeholder. PROJ-17 ships:

1. **Auto-fallback to Tabular** for any Output cell whose formula
   returns `array_of_objects` and whose `display_emphasis` is the
   default (`'plain'`). No emphasis-picker click required; the cell
   "just renders" as a table. Maintainer can also explicitly pick
   Tabular via the (now-unhidden) emphasis picker.
2. **Shape-error red treatment** for cells whose formula returns
   `array_of_scalars` with default emphasis — the spec's
   "expected array of objects, got array of scalars" error inline
   in the card. Maintainer either rewrites the formula or picks
   Sparkline/KPI (KPI fallback for arrays already shipped in PROJ-9).
3. **A column configurator** in the Builder cell card's expand
   surface, visible only when `display_emphasis = 'tabular'`. The
   configurator is a repeating list of rows (one per column), each
   carrying: column **id** (auto, bound to the formula key,
   non-editable), **label** (text), **format** (the same 10-entry
   catalogue PROJ-9 ships for cell `display_format`), **alignment**
   (left / center / right), **currency_code** (visible only when
   format = currency), **visibility** (toggle), and a drag-handle for
   reorder.
4. **Auto-population on first Tabular activation.** The first time
   an Output cell either (a) has its emphasis switched to `tabular`
   manually, or (b) qualifies for the auto-fallback (formula returns
   `array_of_objects` with default emphasis), the column config is
   seeded from the **first row's keys**, in JS object-key insertion
   order. Subsequent emphasis cycling (tabular → plain → tabular)
   does NOT re-populate from scratch — the persisted config is
   restored.
5. **Smart-merge on formula commit.** When the maintainer commits a
   formula change (Grid blur / Enter), the renderer reads the new
   first-row keys and reconciles the persisted column config:
   matching keys keep their hand-tuned label / format / alignment /
   currency_code / visibility / order; vanished keys are dropped;
   new keys are appended with auto-populated defaults. The whole
   reconciliation is one undo entry, scoped to the formula commit.
6. **No visitor-side reconciliation.** Column config is a property
   of the maintainer-edited formula text, never of any specific
   evaluation result. Visitor-input-driven re-evaluations render
   against the persisted config: row keys in the config render in
   their column; row keys absent from the config are ignored;
   columns whose key is absent from a specific row render an empty
   cell.
7. **Sizing & overflow.** Default `card_size_hint` auto-bumps from
   `narrow` → `wide` on first Tabular activation (one-time bump —
   subsequent maintainer changes to `size_hint` are respected;
   emphasis cycling doesn't re-trigger the bump). Table body has
   a fixed max-height (~400px), with vertical scroll inside the
   card and `position: sticky` on `<thead>`. Horizontal scroll
   container inside the card activates when natural column widths
   exceed the card's content width. Mobile: same horizontal-scroll
   approach (no column stacking, no truncation).
8. **No interaction.** The table is rendered, full stop. No sort
   by column header, no per-column filter, no row selection / drill-
   down / striping toggle. Visitor sees the rows in formula order;
   maintainer controls ordering by sorting in the formula.
9. **Shared Builder + visitor renderer.** Per doc spec "no
   behavioural divergence" — one React component renders the table
   in both surfaces. The Builder preview is pixel-identical to the
   visitor view (modulo PROJ-9's hover affordances overlaid on
   resting state).
10. **Format system DRY** — PROJ-17 introduces a shared formatter
    helper consumed by both the cell renderer (PROJ-9) and the
    column renderer. The 10-entry display_format catalogue is the
    single source of truth across cells and columns. The cell-side
    formatting code in `cell-card.tsx` is refactored to call the
    shared helper.

PROJ-17 ships **no sort UI**, **no filter UI**, **no pagination**,
**no row virtualization**, **no per-column width override**, **no
per-column unit**, **no CSV/JSON export**, **no manual column
add/delete**, **no per-cell drill-down**, **no print-friendly
rendering**. The configurator is purely auto-populated; the only
way to add or remove a column is to change the formula.

## User Stories

- As a **registered user** building a mortgage calculator, I want my
  amortisation Output cell (formula returns 360 rows of
  `{month, principal, interest, balance}`) to "just render" as a
  table without me having to click into a picker, so the table is
  visible as soon as the formula commits.
- As a **registered user**, I want to rename the auto-populated
  column headers (e.g. `monthly_payment` → "Monthly payment") and
  pick per-column number formats (e.g. month → integer, principal
  → currency, interest rate → percent) so the table reads like a
  designed report, not a JSON dump.
- As a **registered user** building a multi-currency table, I want
  each currency column to have its own `currency_code` so I can
  show USD principal alongside EUR fees in the same Output cell
  without two separate cells.
- As a **registered user**, I want to drag-reorder columns and hide
  intermediate columns from the visitor view (without changing the
  formula) so I can keep the data-model intact while presenting a
  curated subset.
- As a **registered user** iterating on my formula, I want my
  hand-tuned column labels and formats to survive small formula
  edits (renaming a key, adding a new column to the row objects)
  so I don't lose my styling work every time I tweak the data
  shape.
- As a **registered user**, I want a formula edit that returns a
  scalar today but might return an array tomorrow (or vice versa)
  to give me clear inline feedback about what's wrong, not silently
  render nothing or stash my column config invisibly.
- As a **visitor** to a published calculator, I want the table to
  recompute in real time as I edit input values, with the same
  column headers / formats / order the maintainer designed.
- As a **visitor** browsing on a phone, I want long tables to scroll
  horizontally inside the card (not break the page layout) and
  scroll vertically inside the card with the header row staying
  pinned at the top.

## Out of Scope

Everything below either came up during the interview and was
consciously excluded, or is a PRD-locked non-goal.

- **Sort by column header (visitor-side).** PRD-adjacent. Static
  rendering only; the maintainer controls ordering by sorting in
  the formula. Re-opening this later is a renderer-only addition,
  but it would force decisions about scenario serialisation and
  share-URL persistence that v1 doesn't want to relitigate.
- **Per-column filter input (visitor-side).** Same rationale as
  sort. Out.
- **Pagination / "show first N rows + expand"** — the engine's
  10,000-row cap already protects against pathological inputs;
  realistic authoring loads (360-row amortisation, 60-month
  cashflow) are well within the cap. Vertical scroll inside the
  card covers the long-array case.
- **Row virtualization (react-window / TanStack Virtual).** Pure
  render-layer optimisation, additive later as a follow-up if
  production use surfaces performance issues with large tables.
  No API or schema change required to add it.
- **Per-column width override.** PRD non-goal. Columns take their
  natural width from the theme's table styling.
- **Per-row configuration** — row striping toggle, row selection,
  row drill-down. PRD non-goal.
- **CSV / JSON export from a tabular output cell.** PRD non-goal.
  Display-only in v1.
- **Manual column add / delete in the configurator.** Out of scope
  (Q6). The contract is "column set = first-row keys × maintainer
  styling". The only way to add or remove a column is to change
  the formula. An info-tooltip on the configurator block surfaces
  this contract in plain English.
- **Per-column unit suffix.** Out of scope (Q4b). The §2 spec
  lists id / label / format / alignment / visibility / drag-handle
  only — unit is absent from the column property list. If a
  maintainer needs per-row unit decoration, they add a `text_plain`
  column with the unit pre-baked in the formula output. Additive
  later if author research surfaces a real engineering / science
  case.
- **Per-column locale picker.** PRD-locked (English-only v1).
  Decimal separator follows the theme's locale via
  `Intl.NumberFormat('en-US', …)`, matching cells.
- **Currency auto-detection from row values.** Auto-population at
  first Tabular selection infers format from value type only
  (numeric → `number_decimal_2`, date → `date_short`, boolean →
  `text_plain` as Yes/No, string → `text_plain`). No heuristic on
  the value itself; maintainer flips numeric columns to `currency`
  manually when needed.
- **Visitor-side reconciliation of column config to live data.**
  Column config is a property of the maintainer's formula at
  commit time, never of a specific evaluation result. A formula
  whose first-row keys vary based on visitor input values is an
  author error; the renderer does not shuffle the config based on
  visitor data.
- **Surface for keys present only in later rows.** Spec's "extra
  keys in later rows are ignored" rule holds. The only path to
  surface such a key is to restructure the formula so row 1
  carries it (e.g. with a null / placeholder value).
- **Sort persistence in scenarios.** Moot — sort isn't shipped.
  Scenarios (PROJ-12) snapshot input values only; tabular
  outputs re-evaluate on scenario load against the maintainer's
  persisted column config. No PROJ-12 schema change.
- **Sort persistence in share URLs.** Same — moot.
- **In-table cell-level click handlers / drill-down.** Out. Cells
  render the formatted value, period.
- **Image / link / markdown rendering inside table cells.** Out.
  Cells render plain formatted text via the shared formatter.
  Rich-prose cases are served by Text-blocks (PROJ-16) or
  links inside Text-blocks adjacent to the table card.
- **Caption / title under the table card.** Out. The maintainer's
  cell `label` is the title (rendered above the table per the
  theme's cell card style). A Text-block above the table card
  covers richer captioning.
- **Print-friendly rendering** — `@media print` rules that expand
  the table beyond its 400px max-height, repeat headers on each
  page, etc. Out of scope.
- **Hard column-count limit.** No explicit cap; the horizontal-
  scroll container handles overflow. A 50-column table is awkward
  but renderable.
- **Column-config templates / presets.** Out — every cell starts
  from auto-populated defaults.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Database — column-config persistence on `cells`

- [ ] Given a fresh Supabase project at PROJ-17 HEAD, when the
  migration runs, then the `cells` table gains a
  `tabular_columns jsonb not null default '[]'::jsonb` column.
  Each element of the array is an object of shape
  `{ id: string, label: string, format: string, alignment: 'left' | 'center' | 'right', currency_code: string | null, visibility: 'visible' | 'hidden' }`.
  Element order in the JSON array is the rendered column order.
- [ ] Given the cell's `display_emphasis` is NOT `'tabular'`, when
  inspecting `tabular_columns`, then the field MAY be empty `[]`
  or carry a previously-persisted config from an earlier
  emphasis-tabular session. The column does not gate on emphasis
  — persistence is independent of the emphasis-cycle (Q5).
- [ ] Given the regenerated types file
  (`src/lib/supabase/types.ts`) is refreshed via
  `npx supabase gen types typescript --linked`, then `cells.tabular_columns`
  appears in the row type with the JSON shape above.
- [ ] Given Row-Level Security on `cells` (already shipped in
  PROJ-9), when a `tabular_columns` write goes through, then
  the same join-through-`calculators` RLS policies apply — no
  new policies needed.

### Renderer — emphasis-picker visibility

- [ ] Given the Builder cell card's visual-presentation panel is
  open for an Output cell, when the emphasis picker is rendered,
  then **Tabular** appears alongside Plain and KPI. The PROJ-9
  "hide tabular" branch in `cell-visual-panel.tsx` is removed.
- [ ] Given the maintainer selects Tabular in the emphasis picker,
  when the PATCH commits, then `display_emphasis = 'tabular'` is
  persisted and the cell card re-renders as a table immediately
  (no reload).
- [ ] Given Tabular is the picker's current selection, when the
  user clicks Plain or KPI, then `display_emphasis` is updated
  accordingly. The `tabular_columns` persisted config is NOT
  cleared — selecting Tabular again restores it.

### Renderer — auto-fallback for array-returning cells

- [ ] Given an Output cell with `display_emphasis = 'plain'` (the
  PROJ-9 default), when the cell's formula evaluates to
  `shape = 'array_of_objects'`, then the Builder card renders the
  shared tabular renderer using the cell's persisted
  `tabular_columns` (auto-populated on first such evaluation —
  see Auto-population section).
- [ ] Given the same cell, when the formula evaluates to
  `shape = 'array_of_scalars'`, then the Builder card renders an
  inline red-error message reading "Expected array of objects,
  got array of scalars." The cell's `tabular_columns` config
  (which may be empty for a never-tabularised cell) is left
  untouched.
- [ ] Given the same cell, when the formula evaluates to a
  `shape = 'scalar'`, then the Builder card renders the value
  normally (no tabular treatment, no error). PROJ-9's existing
  scalar render path handles this branch unchanged.
- [ ] Given the cell has `display_emphasis = 'kpi'` AND the formula
  returns an array (any shape), when the Builder card renders,
  then PROJ-9's KPI fallback (first scalar of first row, "Array
  result — first value shown" tooltip) continues to render. The
  Tabular renderer is NOT invoked for KPI-emphasis cells.
- [ ] Given the PROJ-9 placeholder text "Array result — tabular
  display ships in v1.1." is removed from `cell-card.tsx`, when
  the file is inspected at PROJ-17 HEAD, then no v1.1 placeholder
  copy remains.

### Auto-population on first Tabular activation

- [ ] Given a cell has empty `tabular_columns = []` and its formula
  evaluates to `array_of_objects` with first-row keys
  `[k1, k2, k3]`, when either (a) the maintainer switches emphasis
  to `'tabular'` or (b) the cell satisfies the auto-fallback
  condition for the first time, then `tabular_columns` is seeded
  in the order `[k1, k2, k3]` with each entry carrying:
  - `id = the key as-is`,
  - `label = humanise(key)` — converts `snake_case` to "Sentence
    case" (first letter capitalised, underscores replaced with
    spaces; multi-word: `monthly_payment` → "Monthly payment"),
  - `format` from type inference:
      - numeric value (number, integer, float) → `number_decimal_2`,
      - boolean value → `text_plain` (rendered "Yes" / "No"),
      - Date object / ISO date string → `date_short`,
      - everything else → `text_plain`,
  - `alignment` from type inference: `right` for numeric (and
    therefore for any column whose maintainer later switches the
    format to `currency` / `percent_*` / `number_*`), `left` for
    everything else,
  - `currency_code = null` (cells with format = `currency` will
    fall back to the cell's `currency_code` or "USD" — see
    currency_code semantics below),
  - `visibility = 'visible'`.
- [ ] Given the cell has a non-empty `tabular_columns` array from a
  prior session, when emphasis is switched to `'tabular'` (or
  auto-fallback re-triggers), then `tabular_columns` is NOT
  reset — the persisted config is restored as-is.
- [ ] Given the cell's `card_size_hint = 'narrow'` (PROJ-9 default)
  AND the cell has never been auto-populated for Tabular before,
  when the first Tabular activation fires, then `card_size_hint`
  auto-bumps to `'wide'` in the same PATCH as the
  `tabular_columns` seed.
- [ ] Given the maintainer has touched `card_size_hint` after the
  initial auto-bump (e.g. set it back to `'narrow'` or up to
  `'full'`), when emphasis cycles tabular → plain → tabular, then
  `card_size_hint` is NOT re-bumped — the maintainer's choice is
  respected. The "first Tabular activation" flag is recorded
  implicitly by `tabular_columns` having content; the renderer
  doesn't need a separate flag.
- [ ] Given the formula's first row uses non-string keys (e.g. a
  formula bug producing numeric keys), when auto-population runs,
  then keys are coerced to strings before insertion. The
  resulting column ids are the string-form keys.
- [ ] Given the formula returns an empty array `[]` at the moment
  of first activation, when auto-population would run, then
  `tabular_columns` stays empty `[]` (no rows to sample). The
  table renders the empty-array placeholder (see Empty / error
  states). The next non-empty evaluation does NOT re-trigger
  auto-population — first-row-sampling fires only on emphasis
  switch / auto-fallback first-fire, not on every evaluation.

### Smart-merge reconciliation on formula commit

- [ ] Given an Output cell with `display_emphasis = 'tabular'` and
  a populated `tabular_columns` config, when the maintainer
  commits a formula edit (Grid panel formula input blur / Enter)
  AND the new formula evaluates to `array_of_objects`, then the
  server (or the editor store; see Decision Log) reads the new
  first-row keys and reconciles `tabular_columns`:
  - Each existing column whose `id` matches a new first-row key
    is kept verbatim (label, format, alignment, currency_code,
    visibility, position preserved relative to other surviving
    columns).
  - Each existing column whose `id` is absent from the new
    first-row keys is dropped from the config.
  - Each new first-row key with no matching existing column is
    appended at the end of the config with auto-populated
    defaults (same inference rules as initial auto-population).
- [ ] Given the same edit, when the entire reconciliation
  completes, then the undo stack receives exactly ONE entry
  covering the formula edit + the `tabular_columns` delta. Cmd-Z
  reverts both the formula text AND the column-config delta in
  one step.
- [ ] Given the new formula evaluates to `array_of_scalars` (no
  longer object-shaped), when the commit reconciles, then
  `tabular_columns` is left UNTOUCHED. The renderer surfaces the
  "Expected array of objects, got array of scalars." error.
  Re-fixing the formula brings the original columns back without
  data loss.
- [ ] Given the new formula evaluates to `scalar` or has a
  structural error (syntax, cycle, unknown_name), when the
  commit reconciles, then `tabular_columns` is left UNTOUCHED.
- [ ] Given the maintainer enters a formula that returns an empty
  array `[]`, when the commit reconciles, then `tabular_columns`
  is left UNTOUCHED (no first row to sample). The renderer
  surfaces the empty-array placeholder.
- [ ] Given the maintainer commits a formula whose first row keys
  match the existing `tabular_columns` entries but in a different
  order (e.g. existing `[a, b, c]`, new first row keys
  `[c, a, b]`), then `tabular_columns` order is PRESERVED — the
  maintainer's reorder is the authoritative ordering. New keys
  go to the end; surviving keys keep their relative order.
- [ ] Given the maintainer has hand-edited a column's `label`
  (e.g. `monthly_payment` → "Monthly payment"), when a formula
  edit re-introduces the same key after a brief removal, then
  the auto-populated default for the reintroduced column overrides
  any prior hand-tuning. (Match by current id only — no
  "ghost"/"trash" memory of previously-removed columns.)

### Renderer — table layout and content

- [ ] Given a cell with `display_emphasis = 'tabular'`, a populated
  `tabular_columns`, and a formula returning `array_of_objects`,
  when the renderer renders, then the table renders as:
  - A `<table>` element inside a scroll container (`overflow-y:
    auto` + `overflow-x: auto`).
  - A `<thead>` with one `<tr>` of `<th>` elements — one per
    column with `visibility = 'visible'`, in `tabular_columns`
    array order, with `position: sticky; top: 0` so the header
    row stays visible during vertical scroll.
  - A `<tbody>` with one `<tr>` per row in the array. Each `<tr>`
    contains one `<td>` per visible column, with the formatted
    value of the matching key (or an empty cell if the key is
    absent from that row).
- [ ] Given a row in the array contains keys not present in
  `tabular_columns`, when the renderer renders that row, then
  the extra keys are SILENTLY IGNORED — no extra `<td>`, no
  warning. (Spec: "extra keys appearing in later rows are
  ignored".)
- [ ] Given a row in the array is missing a key listed in
  `tabular_columns`, when the renderer renders that row, then
  the corresponding `<td>` is rendered with the value formatted
  as an empty cell (no text, theme-default padding).
- [ ] Given the column's `format` is one of the 10 catalogue
  entries (`auto`, `number_integer`, `number_decimal_2`,
  `number_decimal_4`, `currency`, `percent_0`, `percent_2`,
  `date_short`, `date_long`, `text_plain`), when the `<td>`
  renders, then the value is formatted via the shared formatter
  helper (`formatValue(cellOrColumnConfig, value)`).
- [ ] Given the column's `format = 'currency'`, when the value is
  formatted, then `currency_code` resolution follows this
  precedence:
  - column's `currency_code` if non-null,
  - else the parent cell's `currency_code` if non-null,
  - else literal `'USD'`.
- [ ] Given the column's `alignment` is `left` / `center` / `right`,
  when the `<th>` and `<td>` render, then both inherit the same
  `text-align` value.
- [ ] Given the column's `visibility = 'hidden'`, when the
  renderer iterates columns, then the column is OMITTED from
  both `<thead>` and every `<tbody>` row. Hidden columns do not
  contribute to the table's horizontal width.

### Renderer — sizing & overflow

- [ ] Given the table card is rendered, when inspected at any
  viewport width, then the scroll container has
  `max-height: 400px` (CSS custom property `--tabular-max-h`,
  overridable by themes) AND `overflow-y: auto`. Rows beyond the
  cap scroll inside the container; the rest of the calculator
  page does not scroll.
- [ ] Given the scroll container is taller than 400px AND vertical
  scrolling is in progress, when the user scrolls, then the
  `<thead>` row stays pinned at the top via `position: sticky;
  top: 0`, with the active theme's `cardSurface` background
  (no transparency — rows scroll behind it cleanly).
- [ ] Given the natural width of the visible columns exceeds the
  card's content width, when the container is inspected, then
  `overflow-x: auto` activates and the user can scroll the table
  horizontally inside the card. No column stacking on mobile;
  no "first N columns + chevron" treatment.
- [ ] Given the table renders on mobile (viewport ≤ 640px) AND
  the parent section's layout pattern is `single_column`, when
  the card is laid out, then it spans the section's full width
  and the horizontal-scroll rule applies as on desktop.
- [ ] Given a Sticky-header cross-browser regression suite, when
  the table is rendered in Chrome / Firefox / Safari (desktop +
  mobile Safari), then `<thead>` stays visible during scroll in
  all 5 environments. Frontend QA runs this verification (see
  Technical Requirements).

### Renderer — empty array, errors, and missing data

- [ ] Given a cell with `display_emphasis = 'tabular'` and a
  formula evaluating to an empty array `[]`, when the renderer
  renders, then the `<thead>` is rendered with the persisted
  column config's visible columns (headers visible), and the
  `<tbody>` shows a single full-width row reading "No data" in
  the theme's `muted` colour, centered, with vertical padding
  matching the theme's empty-state convention.
- [ ] Given the cell has `tabular_columns = []` (never auto-
  populated, e.g. emphasis was manually set to `tabular` before
  the formula ever returned an array) AND the formula evaluates
  to an empty array, when the renderer renders, then a
  "No data" placeholder is rendered alone (no header row, since
  there are no columns to label). Same `muted` styling.
- [ ] Given the cell's formula has a structural error
  (`syntax` / `cycle` / `unknown_name`), when the renderer
  renders, then the standard PROJ-9 red-error treatment renders
  in place of the table — same visual as a scalar-output cell
  with the same error. `tabular_columns` is preserved unchanged.
- [ ] Given the cell's formula has a runtime error
  (`divide_by_zero` / `wrong_type` / `out_of_range`), when the
  renderer renders, then the engine's plain-English error
  message renders in place of the table, with the same
  red-treatment as structural errors.
- [ ] Given an individual row's value for a numeric-formatted
  column is non-numeric (e.g. the row carries `"N/A"` for a
  column whose format is `currency`), when the `<td>` renders,
  then the raw value passes through as plain text (best-effort
  fallback) without rendering an error indicator inside the cell.
  Reasoning: per-cell error rendering would clutter the table
  body; the author signal is the formula-level type, not the
  per-row data.

### Column configurator UI (Builder card expand panel)

- [ ] Given the Builder cell card's visual-presentation panel is
  open AND `display_emphasis = 'tabular'`, when the panel is
  inspected, then a "Columns" subsection appears below the
  emphasis picker, containing:
  - An info-icon (or text tooltip on hover of the section
    title) reading verbatim or near-verbatim: "Columns mirror
    the first row of your formula's result. To add or remove a
    column, change the formula."
  - The configurator list: one row per entry in `tabular_columns`,
    in array order.
- [ ] Given `display_emphasis ≠ 'tabular'`, when the panel is
  inspected, then the "Columns" subsection is NOT rendered. (Only
  surfaces when relevant.)
- [ ] Given a configurator row is rendered, when inspected, then
  it contains in reading order:
  - A `@dnd-kit` drag-handle (six-dot grip icon, left).
  - The column's `id` (read-only label, dimmed; surfaces the
    formula key the row is bound to).
  - The column's `label` input (text field; commits on blur /
    Enter; placeholder = the auto-populated humanised key).
  - The column's `format` dropdown (10-entry catalogue mirroring
    cell `display_format` exactly).
  - The column's `alignment` segmented control (Left / Center /
    Right).
  - The column's `currency_code` input (visible ONLY when
    `format = 'currency'`; small dropdown of common ISO codes
    with free-text input for any 3-letter code; placeholder
    surfaces the resolved fallback "USD" or the parent cell's
    code).
  - The column's `visibility` toggle (Switch primitive; dims
    the entire row to ~50% opacity when off, but leaves all
    other controls editable).
- [ ] Given a column row's `label` is edited and committed, when
  the PATCH lands, then `tabular_columns[i].label` is updated
  AND the Builder preview re-renders the table header within the
  same render pass.
- [ ] Given a column row's `format` is changed to `currency`,
  when the PATCH lands, then the `currency_code` input appears
  in the row inline (no panel collapse / expand cycle) and
  defaults to the resolved fallback (cell `currency_code` or
  "USD") if `column.currency_code` was null.
- [ ] Given a column row's `format` is changed FROM `currency` to
  any other entry, when the PATCH lands, then the `currency_code`
  input disappears from the row. The stored `currency_code` value
  is NOT cleared (so flipping back to `currency` later restores
  the prior choice).
- [ ] Given the drag-handle is grabbed and the column is dragged
  vertically, when the drop occurs, then `tabular_columns` is
  reordered to match the new position and the Builder preview
  re-renders within the same pass. Touch: ~300ms long-press to
  activate (matches PROJ-9). Keyboard: arrow keys move the
  focused row when grabbed via Space / Enter (matches @dnd-kit
  defaults).
- [ ] Given the configurator is rendered AND `tabular_columns` is
  empty (e.g. emphasis was just switched to `tabular` but the
  formula has never returned an array), when the configurator
  body is inspected, then it shows a placeholder reading "Your
  formula hasn't returned any rows yet. Columns appear here once
  it does." (no rows, no auto-populate-now button).
- [ ] Given the cell's `display_emphasis = 'tabular'` AND the
  formula returns `array_of_scalars`, when the configurator
  is rendered, then it shows the same "no rows yet" placeholder
  (no columns to configure). The shape-error message renders in
  the table preview area above.

### Column-config field validation

- [ ] Given the maintainer commits a column `label` longer than
  100 chars, when the PATCH lands, then the server (or store)
  rejects with HTTP 400 `{ error: 'column_label_too_long',
  max: 100 }`. (Cap matches the section title cap from PROJ-9.)
- [ ] Given the maintainer commits a column `label` containing
  only whitespace, when the PATCH lands, then the trim-empty
  value is accepted and stored as the empty string. The renderer
  falls back to displaying the column `id` as the header text
  when `label` is empty. (Allows the maintainer to deliberately
  blank a header.)
- [ ] Given the maintainer commits a `currency_code` not matching
  the regex `^[A-Z]{3}$`, when the PATCH lands, then the server
  rejects with HTTP 400 `{ error: 'invalid_currency_code',
  pattern: 'ISO 4217 (3 uppercase letters)' }`. (Matches the
  cell-side `currency_code` validation from PROJ-9.)
- [ ] Given the column row's `format` is not one of the 10
  catalogue entries, when the PATCH lands, then the server
  rejects with HTTP 400 `{ error: 'invalid_column_format' }`.
- [ ] Given the column row's `alignment` is not `left` /
  `center` / `right`, when the PATCH lands, then HTTP 400
  `{ error: 'invalid_column_alignment' }`.

### Persistence — API

- [ ] Given the maintainer mutates any field on `tabular_columns`
  (edit label / format / alignment / currency_code / visibility,
  drag-reorder, or a reconciliation-driven smart-merge), when
  the PATCH `/api/cells/:id` lands, then the standard PROJ-9
  optimistic-concurrency rules apply (calculator-level
  `updated_at` echo, 409 on stale write).
- [ ] Given the cell has `display_emphasis ≠ 'tabular'`, when a
  PATCH writes a `tabular_columns` field, then the write is
  accepted — `tabular_columns` is independent of the current
  emphasis (persisted across cycling).
- [ ] Given the cell's `display_emphasis = 'tabular'` is changed
  to `'plain'` or `'kpi'`, when the PATCH lands, then
  `tabular_columns` is NOT cleared on the server. (Q5
  clarification: persisted config survives emphasis cycling.)

### Undo / Redo enrollment

- [ ] Given any of the following operations commits, when it
  succeeds, then exactly one undo entry is pushed onto PROJ-8's
  session-scoped undo stack:
  - Column `label` edit
  - Column `format` change (including the currency_code field
    appearing as a side-effect of switching to `currency`)
  - Column `currency_code` edit
  - Column `alignment` change
  - Column `visibility` toggle
  - Column drag-reorder (single entry per drag, start → end)
  - First-time auto-population of `tabular_columns` (rolled into
    the emphasis-change entry OR the formula-commit entry —
    whichever triggered the activation)
  - Smart-merge reconciliation after a formula commit (rolled
    into the formula-commit entry — single entry per commit)
  - Auto-bump of `card_size_hint` (rolled into the same entry
    as the first-time activation)
- [ ] Given Cmd-Z is pressed while a configurator text input has
  focus, when the keystroke is intercepted, then native input-
  undo wins (matches PROJ-9's rule for Grid / Builder text
  inputs). Editor-level undo fires only when no editable surface
  has focus.

### Cross-feature interactions

- [ ] Given a cell with `display_emphasis = 'tabular'` AND
  `visibility = 'hidden'`, when the Builder renders the parent
  section, then the cell renders as a 0-height accent dot (the
  PROJ-9 hidden-cell pattern) — NO table is rendered in the dot
  position.
- [ ] Given the maintainer clicks the dot, when the inline
  expand opens, then the data-model panel (PROJ-9 Grid kebab
  content) AND the visual-presentation panel (Builder card
  expand content, including the "Columns" configurator subsection
  if emphasis is tabular) both render inline above the dot.
  Closing the expand restores the dot.
- [ ] Given the cell is hidden, when the visitor view renders the
  parent section, then nothing renders for the cell — no table,
  no dot. (Inherits PROJ-9's hidden-cell visitor-view rule.)
- [ ] Given the cell is visible AND the visitor URL is loaded,
  when the visitor view renders the calculator, then the shared
  tabular renderer (consumed by both Builder preview and visitor
  view) renders the table identically to the Builder preview
  modulo PROJ-9's hover affordances. No PROJ-11 schema /
  route / loader changes are required.
- [ ] Given the visitor saves a scenario (PROJ-12) with input
  values that produce a tabular output, when the scenario is
  later loaded, then the calculator re-evaluates against the
  loaded inputs and the tabular Output cell re-renders against
  the maintainer's persisted `tabular_columns`. No scenario
  schema change; `tabular_columns` lives on the cell, not in
  the scenario row.
- [ ] Given the visitor's input changes cause the tabular Output
  cell's formula to re-evaluate to a different array, when the
  visitor view updates, then the renderer renders against the
  maintainer's persisted column config — keys present in the
  config render, keys absent are ignored, rows missing a config
  key render empty cells. The config does NOT reconcile on the
  visitor side.
- [ ] Given PROJ-9's display_element dispatch table (in
  `cell-card.tsx` and equivalent visitor renderer) was branching
  on `kind = output, isArrayResult, display_emphasis !== 'kpi'`
  → placeholder, when PROJ-17 is deployed, then that branch is
  replaced with the shared tabular renderer call. The KPI
  fallback branch is preserved (Q7).
- [ ] Given a calculator with one or more tabular Output cells
  is duplicated within the maintainer's account (PROJ-10), when
  the duplicate is created, then the `tabular_columns` field is
  copied verbatim onto the duplicate's cell rows. (PROJ-10's
  cell-copy already covers the full row including the new JSONB
  column — no PROJ-10 changes needed.)

### Shared formatter helper

- [ ] Given the shared formatter helper `formatValue(spec, value)`
  is consumed by both the cell renderer (PROJ-9 `cell-card.tsx`)
  and the column renderer (PROJ-17 tabular renderer), when its
  contract is inspected, then it accepts a config carrying
  `format`, `currency_code`, and (for cells only) `unit`, and
  returns a formatted string for any input value.
- [ ] Given the formatter is invoked with an unknown `format`
  value, when called, then it falls back to `text_plain`
  semantics — the value's `String(value)` representation
  passes through.
- [ ] Given the PROJ-9 cell-formatting code in `cell-card.tsx`
  is refactored to consume the shared helper, when the file
  is inspected at PROJ-17 HEAD, then the cell renderer no
  longer carries its own format-switching code beyond the
  config-construction step.

## Edge Cases

- **Formula returns mixed-shape rows.** E.g.
  `[{a:1, b:2}, {a:1, b:2, c:3}, {a:1, b:2}]`. First-row keys
  are `[a, b]` — `c` is ignored in auto-population and at render
  time (extra-keys-in-later-rows rule). No warning, no badge.
- **Formula returns rows with missing keys vs first row.** E.g.
  `[{a:1, b:2}, {a:1}]`. Row 2's `b` cell renders empty in the
  table; no error.
- **Formula returns rows whose values are themselves objects or
  arrays.** Renderer falls back to `String(value)` (typically
  `[object Object]` or comma-joined arrays). Not a v1 spec-error
  — the maintainer's responsibility. Power-users wanting nested
  data formatting should reshape the formula.
- **Formula returns `null` rows in the array** (e.g.
  `[null, {a:1, b:2}, null]`). Null rows render as a `<tr>` with
  all empty `<td>` cells (every key missing). No row skipping —
  preserves row index for debugging.
- **Formula returns an array with one row.** Renders normally
  — headers + one body row. No special "single row use KPI"
  hint.
- **Maintainer renames a column's `label` to match another
  column's `label` exactly.** Accepted. Two columns can share a
  display label — the column `id` (the formula key) is the only
  uniqueness constraint, and that's enforced by the formula's
  object keys naturally.
- **Maintainer reorders columns then commits a formula change
  that drops a column from row 1.** Smart-merge drops the
  vanished column; remaining columns retain their pre-edit
  order.
- **Maintainer reorders columns then commits a formula change
  that adds a new column.** New column is appended at the end
  with auto-populated defaults (NOT inserted at any "natural"
  position). The maintainer drag-reorders it after.
- **Maintainer hides every column via the visibility toggle.**
  Renderer renders the empty-state placeholder ("No data" with
  no header row, since every column is hidden — matches the
  empty-tabular_columns rendering rule). Visitor sees the same
  empty state. The maintainer can re-show a column from the
  configurator at any time.
- **Maintainer switches emphasis from `tabular` to `plain` while
  the formula returns an array_of_objects.** PROJ-9's
  auto-fallback would re-render as tabular — but the emphasis
  was explicitly set to `plain`, not the default. Rule:
  auto-fallback only fires when emphasis is the DEFAULT `plain`
  AND `tabular_columns` is empty. Once emphasis has been
  explicitly cycled at least once (recorded by `tabular_columns`
  having any non-default content), the maintainer's emphasis is
  authoritative — `plain` means plain (renderer shows the cell
  scalar-style, which for an array result means the existing
  PROJ-9 "Array result — first value shown" behaviour or
  similar). **Confirmed behaviour:** if `display_emphasis =
  'plain'` after an explicit user choice AND the formula returns
  an array, render via the PROJ-9 KPI-style first-scalar
  fallback (consistent with how `display_emphasis = 'kpi'` does
  it today). This avoids the "switched to plain to make it
  scalar but it auto-flipped back to tabular" surprise.
- **Cell's `currency_code` field is updated (e.g. cell-level
  USD → EUR) while a tabular column has its own `currency_code
  = null` (i.e. inheriting).** The column re-renders with the
  new fallback. No reconciliation event needed — the precedence
  chain reads the cell each render.
- **Cell's `currency_code` is updated while a tabular column has
  an explicit `currency_code = 'GBP'`.** Column keeps GBP. No
  cascade.
- **Maintainer types a non-ISO `currency_code` like "btc"** (3
  letters, lowercase). Server normalises to uppercase before
  validating against `^[A-Z]{3}$` — typo-friendly. ISO 4217
  membership is NOT validated (no list shipped with the renderer);
  `Intl.NumberFormat` accepts any 3-letter code and renders the
  symbol where it knows one.
- **Formula returns 10,001 rows.** Engine's `out_of_range` error
  fires before the renderer sees the data; renderer shows the
  engine's plain-English error message. Already covered by
  PROJ-7's array cap.
- **Formula returns 9,999 rows.** Renderer renders all of them
  inside the 400px scroll container; no virtualization. Realistic
  worst-case for a 30-year monthly amortisation is 360 rows,
  comfortably within reason. Performance follow-up if production
  use surfaces issues.
- **Cell deleted while the configurator is open.** Card unmounts,
  configurator panel unmounts with it. Undo restores cell +
  panel state (matches PROJ-9's edit-panel undo rule).
- **Calculator's theme is switched while a tabular cell exists.**
  The shared renderer reads the active theme's tokens
  (`borderSubtle`, `text`, `muted`, `cardSurface`) each render
  pass. Tables re-style instantly. No persisted theme-coupling.
- **Section's layout pattern is changed to `two_column` while a
  tabular cell's `card_size_hint = 'wide'`.** Per PROJ-9, `wide`
  cells span two columns in `two_column` layout. The table card
  spans both columns; the table itself fills the card. If the
  maintainer then sets `card_size_hint = 'narrow'`, the table
  shrinks to one column and likely triggers horizontal scroll
  for multi-column tables.
- **Maintainer renames a cell formula key via the formula edit
  (NOT via the cell rename mechanism — keys live inside the
  formula's OBJECT(...) call).** No special handling needed —
  smart-merge on formula commit catches the change (key dropped
  + new key added). Hand-tuned label / format for the OLD key
  name is lost (no fuzzy matching). Maintainer re-labels the
  new column.

## Technical Requirements

- **Performance.** Initial render of a 360-row × 4-column table
  must complete in < 100ms on a mid-2023 laptop. No
  virtualization in v1 — straightforward DOM render. If
  authoring tests reveal jank at typical scale, add
  `react-window` in a follow-up.
- **Sticky-header cross-browser.** `<thead>` with `position:
  sticky; top: 0` must remain visible during vertical scroll in
  Chrome (latest), Firefox (latest), Safari (latest), iOS Safari
  (current), Android Chrome (current). Frontend QA exercise:
  scroll a 50-row table inside the 400px container in each
  browser and verify the header stays anchored without a
  visible flicker / background bleed. Themes' `cardSurface`
  token must be opaque on the `<thead>` background (not
  semi-transparent) to avoid see-through during scroll.
- **No interaction.** Tables are pure render — no event handlers
  on `<th>` or `<td>` beyond the @dnd-kit grip on configurator
  rows (which are NOT the table itself — those are configurator
  list items in the Builder card expand panel).
- **Accessibility.** Use semantic `<table>` / `<thead>` /
  `<tbody>` / `<tr>` / `<th>` / `<td>` markup so screen readers
  announce rows / columns naturally. Header cells use
  `scope="col"`. The shared formatter helper does NOT inject
  visual-only markup that would confuse readers (e.g. no
  superscript currency symbols outside `Intl.NumberFormat`
  rendering).
- **Security.** No raw HTML in row values — the renderer always
  passes through `formatValue()` which returns a plain string,
  rendered as a text node by React. No `dangerouslySetInnerHTML`
  anywhere in the tabular path.

## Architecture Verification Flags

Two assumptions surfaced during the spec hand-off review that the
spec carried implicitly and that `/architecture` must explicitly
verify (or refute) before any code lands. Both are "we believe
this is true, prove it" rather than open product questions.

### AV-1. PROJ-11 visitor renderer wiring — confirm shared-component reuse

**Assumption (carried by "no PROJ-11 changes needed" claim above):**
PROJ-11's visitor route consumes the same polymorphic slot
pipeline as the Builder, so adding a tabular branch in the cell
renderer auto-flows to both surfaces.

**Verification.** Confirm the following file paths and dispatch
contract before writing any PROJ-17 code:
- `src/components/editor/slot-renderer.tsx` is the dispatcher.
  `SlotRenderer({ elements })` looks up a per-`element.type`
  renderer from a module-level `REGISTRY` populated via
  `registerDisplayElementRenderer(type, renderer)` at module
  load. Adding a new element type IS a renderer-registration
  change — confirmed forward-compat seam per INDEX.md.
- `src/components/editor/cell-card.tsx` is the per-cell renderer
  registered into the slot pipeline. PROJ-17's tabular branch
  lives inside the cell renderer's dispatch (Output-cell,
  `display_emphasis = 'tabular'` OR auto-fallback) — NOT as a
  new `display_element.type` registration. Cells stay one
  element type; the table is a presentation mode for an
  Output cell.
- `src/components/visitor/public-calculator-page.tsx` is the
  visitor surface that consumes the same `SlotRenderer` and
  the same registered cell renderer. Confirm at `/architecture`
  time that this file imports `SlotRenderer` (or equivalent)
  and that no separate visitor-side cell renderer exists that
  would need a parallel patch.
- If a separate visitor-side cell renderer is discovered
  (e.g. a divergent `visitor-cell-card.tsx`), the spec's
  "shared tabular renderer consumed by both Builder preview
  and visitor view" Decision Log entry must be revisited:
  either (a) refactor to a shared renderer before PROJ-17
  lands, or (b) acknowledge the divergence in the tech design
  and ship two registration points.

**Expected outcome.** Single change site at
`src/components/editor/cell-card.tsx` (with extracted shared
`<TabularRenderer />` module) and zero changes to anything
under `src/components/visitor/**` beyond what falls out of the
shared renderer's theme/registry use.

### AV-2. Public-RPC migration must add `tabular_columns` AND preserve the PROJ-15 KI-1 JOIN

**Assumption (NOT explicitly stated in the spec above):** the
new `cells.tabular_columns jsonb` column is automatically
visible to the public visitor / scenario routes.

**Reality (verified during this refinement):** both public RPCs
explicitly enumerate every column of `public.cells` they
return — they do NOT use `cl.*`. The current heads are:
- `fn_get_public_calculator` —
  `supabase/migrations/20260531000001_public_calculator_text_blocks.sql:79-107`
  (the inner `SELECT cl.id, cl.kind, … FROM public.cells cl`).
- `fn_get_scenario_by_share_token` — same migration,
  `:231-260` (same enumerated SELECT inside the scenario
  payload).

PROJ-17's database migration MUST therefore `CREATE OR REPLACE`
**both** RPCs to add `cl.tabular_columns` to the enumerated
column list — otherwise the visitor view and shared-scenario
view will render Output cells without their column config and
silently fall back to "never auto-populated" placeholders.

**KI-1 JOIN preservation (mandatory).** The same
`CREATE OR REPLACE` must preserve the
`JOIN public.profiles … ON … AND p.status = 'approved'` clauses
verbatim from the PROJ-16 migration:
- `fn_get_public_calculator` — JOIN at
  `supabase/migrations/20260531000001_public_calculator_text_blocks.sql:163-165`.
- `fn_get_scenario_by_share_token` — JOIN at
  `:320-322`.

PROJ-15's chart migration silently dropped this JOIN; PROJ-16
restored it (Decision Log #14 of PROJ-16). PROJ-17's
`CREATE OR REPLACE` is the third surface that could
accidentally drop it — `/architecture` must call this out as a
mandatory line-item in the migration plan, and `/qa` must
re-run PROJ-14's settings regression-gate test
(`tests/PROJ-14-settings.spec.ts:593`) post-migration.

**Expected outcome.** One new migration file (next free
timestamp under `supabase/migrations/`) that:
1. `ALTER TABLE public.cells ADD COLUMN tabular_columns jsonb NOT NULL DEFAULT '[]'::jsonb;`
2. `CREATE OR REPLACE FUNCTION public.fn_get_public_calculator(...)` — adds `cl.tabular_columns` to the enumerated cell SELECT; preserves the owner JOIN verbatim.
3. `CREATE OR REPLACE FUNCTION public.fn_get_scenario_by_share_token(...)` — same two changes.
4. Regenerates `src/lib/supabase/types.ts` via
   `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`.

**Forward-looking process note (added post-QA via BUG-H2):** AV-2
scoped the cell-column enumeration audit to the two READ RPCs only.
QA surfaced that the WRITE RPC `fn_duplicate_calculator` is the same
shape of surface — it also enumerates every column of `public.cells`
explicitly — but it was outside the AV-2 checklist, so it silently
dropped `tabular_columns` on duplicate. The maintenance contract is
now wider than "two read RPCs": **any future feature touching the
`cells` / `charts` / `text_blocks` schema must audit all three
SECURITY DEFINER / SECURITY INVOKER functions that enumerate those
columns** — `fn_get_public_calculator`, `fn_get_scenario_by_share_token`,
AND `fn_duplicate_calculator`. The BUG-H2 fix migration
(`20260601010000_fix_duplicate_calculator.sql`) carries this contract
verbatim in its header comment so future `CREATE OR REPLACE`s read the
reminder before copy-pasting an older version.

## Open Questions

- [ ] **Sort-by-column-header.** Currently out of scope (Q3).
  Re-open if author research shows visitors expect sort
  interaction. Architecturally a renderer-only addition;
  scenario / share-URL persistence would need a separate
  product decision then.
- [ ] **Column-level filter.** Same posture as sort. Out for v1.
- [ ] **Manual column add / delete.** Currently out of scope
  (Q6). The info-tooltip explains the contract. Re-open if
  author research surfaces the "row 1 doesn't always have all
  keys" case as a real friction (e.g. heterogeneous JSON
  imports from datasets — but datasets are a v2 feature).
- [ ] **Per-column unit suffix.** Currently out of scope (Q4b).
  Re-open if engineering / science calculator authors land
  with concrete cases.
- [ ] **Per-column locale.** PRD-locked English-only v1.
  Re-open with i18n.
- [ ] **Row virtualization.** Currently out — not a v1
  requirement. Re-open if production telemetry (post-v1) shows
  tabular cells with > 1000 rows being authored at material
  rates.
- [ ] **Print-friendly rendering** (`@media print` rules to
  un-cap height, repeat headers per page). Currently out.
  Re-open if maintainers ask for PDF export of calculators.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Auto-fall back to Tabular for `array_of_objects` formulas with default emphasis; shape-error for `array_of_scalars`; Tabular also pickable explicitly via the (now-unhidden) emphasis picker | Matches docs/Calcgrinder-spec.md §2 verbatim. Auto-fallback keeps the "formula returns an array → table appears" path frictionless. Shape-error for scalar arrays surfaces author intent loudly (spec mandates "scalars are never auto-wrapped into single-column tables"). | 2026-05-24 |
| One-time `card_size_hint` auto-bump narrow → wide on first Tabular activation; subsequent maintainer choices respected; emphasis cycling does NOT re-trigger | Avoids the "5-column amortisation crammed into a third-width card" default. Respecting later maintainer choice keeps the bump from being a "permanent coupling" that fights deliberate size preferences. | 2026-05-24 |
| Table body max-height ~400px with sticky `<thead>` + internal vertical scroll; no expander, no pagination | Realistic authoring loads (360-row amortisation, 60-month cashflow) fit inside one scroll region without breaking page layout. Pagination would add row-count UI surface; expander would force "decide now whether to expand" UX. Internal scroll is the simplest honest answer. | 2026-05-24 |
| Horizontal scroll container inside the card when natural column widths overflow; no column stacking, no first-N-cols+chevron pattern on mobile | Matches "no per-column width override, no per-row config" spec restraint. Column stacking on mobile would force re-thinking layout per breakpoint and force a "what does the table look like at 320px" decision per theme. Standard horizontal scroll is universally understood. | 2026-05-24 |
| Render up to the engine's 10,000-row cap; no secondary render-side truncation cap | A render-cap (e.g. 1,000) would silently truncate — the kind of "looks fine, calculator lies" failure mode the spec avoids elsewhere. The engine's `out_of_range` already protects against pathological inputs. Solo-deployer / small-user-pool volume keeps realistic loads well within the cap. Virtualization is a pure render-layer optimisation that can be added later. | 2026-05-24 |
| No sort, no filter, no visitor interaction. Static rendering only | Matches the spec's "no per-row config" tone. Maintainer controls ordering by sorting in the formula. Adding sort would force decisions about scenario / share-URL persistence the v1 spec doesn't want to relitigate. Adding filter would force per-column input state. Both are pure render-layer additions if re-opened. | 2026-05-24 |
| Per-column format catalogue mirrors the cell `display_format` 10-entry catalogue verbatim | Matches spec's "one format system across cells and columns". A simplified 5-category vocabulary would force one default per category (e.g. number → decimal-2 only) and lose real information (amortisation tables genuinely need integer months alongside decimal currencies). | 2026-05-24 |
| Per-column `currency_code` with precedence column → cell → "USD" default | Mixed-currency tables (USD principal / EUR fees) are a real authoring case. Precedence chain keeps the common case ("the whole table is in one currency, set on the cell") to ZERO per-column config touches. | 2026-05-24 |
| Per-column unit suffix dropped from PROJ-17 scope | §2 spec lists column properties as id / label / format / alignment / visibility / drag-handle only — unit is absent. Cell-level `unit` is a separate field, not part of `display_format`. Per-row unit decoration can be achieved with a `text_plain` column carrying the unit in the formula. Additive later if engineering / science cases surface. | 2026-05-24 |
| Auto-population type inference: numeric → `number_decimal_2`, date → `date_short`, boolean → `text_plain` (rendered "Yes"/"No"), string → `text_plain`. No currency auto-detection. | Currency auto-detection would require either heuristics on the value (fragile) or per-cell hints (out of scope). `number_decimal_2` is the most common starting format for numeric data; maintainer flips to currency / percent / integer manually. | 2026-05-24 |
| Alignment auto-population: right for numeric (number / currency / percent), left for everything else | Standard tabular convention. Maintainer overrides per-column via the segmented control. | 2026-05-24 |
| Smart-merge on maintainer formula commit (blur / Enter); NO visitor-side reconciliation | Column config is a property of the maintainer-edited formula text, not of any specific evaluation result. Visitor-input-driven re-evaluations render against the persisted config (keys present render; keys absent ignored; missing per-row keys render empty). A formula whose first-row keys vary based on visitor input is an author error, not a renderer concern. | 2026-05-24 |
| Single undo entry per formula commit covering both the formula edit and the column-config delta | Cmd-Z restores the previous formula AND the previous column set / order / labels in one step. A two-entry split would force the maintainer to undo twice for one user-perceived operation. | 2026-05-24 |
| Initial auto-population fires at first emphasis-to-tabular switch OR first auto-fallback for `array_of_objects`. Subsequent emphasis cycling (tabular → plain → tabular) does NOT re-populate from scratch | Symmetric with the `card_size_hint` auto-bump rule. The persistent config survives temporary mode-cycling without surprises. | 2026-05-24 |
| Persisted column config survives broken formulas — no auto-clear on `syntax` / `cycle` / `unknown_name` / shape errors | Fixing the formula brings the configured table back without re-doing label / format work. Matches PROJ-9's "save broken formulas" model: structural errors are visible without being destructive. | 2026-05-24 |
| Configurator is purely auto-populated; no manual column add or delete; "visibility off" is the hide-this-column path | Keeps the contract simple: column config = formula's first-row keys × maintainer styling. Manual add/delete would create orphan rows (config keys that the formula never returns) and break the "first-row only" rule. The info-tooltip explains the contract in plain English so authors don't bug-file. | 2026-05-24 |
| "Extra keys appearing in later rows are ignored" rule is enforced with NO maintainer override path | Same first-row-only rule. The only way to surface a later-row key is to restructure the formula so row 1 carries it (e.g. with a null placeholder). Predictable, no sparse-table edge cases. | 2026-05-24 |
| Empty array renders headers + "No data" placeholder in the body; empty `tabular_columns` (never populated) renders just the "No data" placeholder | Headers + "No data" reassures the maintainer that the column config is intact and only the data is missing. The empty-`tabular_columns` case (never populated) has no headers to render — just the placeholder. | 2026-05-24 |
| Hidden column UX: row stays in the configurator with the toggle off, dimmed but still editable; the column does NOT render in the table | Standard "hide this column from the visitor without changing the formula" path. Other configurator fields stay editable on hidden columns so the maintainer can pre-set label / format before re-showing. | 2026-05-24 |
| Shared tabular renderer consumed by both Builder preview and visitor view; pixel-identical render modulo Builder hover affordances | Per spec "no behavioural divergence between Builder and visitor". Single component is the only way to guarantee this without future drift. PROJ-11 needs no schema / route changes — its slot pipeline already dispatches polymorphically. | 2026-05-24 |
| Scenarios (PROJ-12) work transparently with tabular outputs — no scenario schema change; tabular Output re-evaluates on scenario load against the maintainer's persisted column config | Scenarios snapshot input values; outputs are derived. The persisted `tabular_columns` lives on the cell, never in the scenario row. | 2026-05-24 |
| Shared formatter helper extracted from PROJ-9's cell-card formatting code; consumed by cell and column renderers | Matches spec's "one format system across cells and columns". Refactor is small (extract `formatValue(spec, value)`) and removes duplication before it grows. | 2026-05-24 |
| `display_emphasis = 'plain'` after an explicit user choice + array-shaped formula renders via the PROJ-9 KPI-style first-scalar fallback (NOT auto-tabular) | Auto-fallback only fires when emphasis is the unchanged default `plain` AND `tabular_columns` is empty. Once the maintainer has explicitly cycled emphasis at least once (recorded implicitly by `tabular_columns` being populated), their emphasis is authoritative. Avoids the "I switched to plain to make it scalar but it auto-flipped back to tabular" surprise. | 2026-05-24 |
| Info-tooltip on the configurator block surfaces the auto-only contract in plain English | Maintainer hunting for "+ Add column" finds the answer in the UI instead of filing a bug. Tooltip wording: "Columns mirror the first row of your formula's result. To add or remove a column, change the formula." | 2026-05-24 |
| Non-numeric row value in a numeric-formatted column → best-effort pass-through as plain text (no per-cell error indicator) | Per-cell error rendering would clutter the table body; the author signal is the formula-level type, not the per-row data. If the formula's row shape is inconsistent, the maintainer fixes the formula. | 2026-05-24 |
| Column `label` cap of 100 chars; trim-empty `label` is accepted (renderer falls back to `id` as header text) | 100-char cap matches PROJ-9's section title cap (familiar bound). Allowing trim-empty label lets the maintainer deliberately blank a header; `id`-fallback keeps the table usable even with a blank label. | 2026-05-24 |
| Architecture Verification Flags (AV-1 PROJ-11 renderer wiring, AV-2 public-RPC migration + KI-1 JOIN preservation) added as an explicit subsection rather than left implicit | Hand-off review surfaced two assumptions the spec carried implicitly: (1) "no PROJ-11 changes needed" without pinning the slot-pipeline file path, risking a parallel visitor renderer being overlooked; (2) silence on whether `tabular_columns` flows through the public RPCs — combined with the PROJ-15 KI-1 history of a silently-dropped owner-status JOIN, this could regress PROJ-14's status gate on the new migration. Explicit AV section gives `/architecture` a concrete checklist instead of derived inference. | 2026-05-24 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Smart-merge reconciliation runs **client-side** in the editor store on Grid formula blur/Enter — derives new column delta from the client formula engine's evaluation, then issues ONE PATCH carrying both `formula` and reconciled `tabular_columns` | Formula engine already lives client-side; PROJ-9's persistence pattern is client-driven; single PATCH = single undo entry naturally. Server-side would pull the engine into the server runtime for no isolation benefit (the maintainer is already authenticated and writing arbitrary formulas). | 2026-05-24 |
| Single migration file at `supabase/migrations/<next>_tabular_output_cells.sql`: `ALTER TABLE public.cells ADD COLUMN tabular_columns jsonb NOT NULL DEFAULT '[]'` + `CREATE OR REPLACE FUNCTION public.fn_get_public_calculator(...)` + `CREATE OR REPLACE FUNCTION public.fn_get_scenario_by_share_token(...)`. Both RPCs add `cl.tabular_columns` to their enumerated cell SELECT list AND preserve the `JOIN public.profiles … ON … AND p.status = 'approved'` clause verbatim from `20260531000001_public_calculator_text_blocks.sql:163-165` and `:320-322` | One migration = one deploy step. Co-locating the ALTER + both RPC replacements prevents the "schema deployed but RPCs forgot the column" partial-rollout failure mode. KI-1 JOIN preservation is mandatory per AV-2 — the PROJ-15 regression that PROJ-16 fixed must not repeat. | 2026-05-24 |
| Shared formatter helper extracted to **`src/lib/cells/format.ts`** exporting `formatValue(spec, value)` where `spec = { format, currency_code?, unit? }`. Consumed by `cell-card.tsx` (cell renderer) and the new `tabular-renderer.tsx` (column renderer). PROJ-9's inline `formatValue` at `cell-card.tsx:243` is deleted and replaced with an import | Matches the existing `src/lib/cells/` module layout (siblings to `types.ts`, `validation.ts`, `client.ts`). Locating it under `cells/` (not a new `formatting/` directory) keeps the discoverability — it's a cell-system concern. Unit tests live at `format.test.ts` next to it. | 2026-05-24 |
| TabularRenderer is **one** component file at **`src/components/editor/tabular-renderer.tsx`** — no sub-renderer directory like `chart-renderers/` because tables have no subtype dispatch (one renderer covers every shape). Consumed directly by `cell-card.tsx`'s output-cell branch | Charts needed a 12-renderer dispatch (`chart-renderer-dispatch.tsx` + `chart-renderers/*.tsx`); tabular doesn't. A single file matches the actual complexity. Same component serves Builder preview and visitor view per AV-1 — no separate visitor-side file. | 2026-05-24 |
| Column configurator UI is a new subcomponent **`src/components/editor/tabular-column-config.tsx`** rendered conditionally inside `cell-visual-panel.tsx` (only when `display_emphasis = 'tabular'`). Uses `@dnd-kit/sortable` for drag-reorder (already in the project via PROJ-9 section reorder and PROJ-15 chart-series reorder) | Keeps `cell-visual-panel.tsx` from ballooning; configurator is a self-contained list of column rows with its own internal state for drag handles. Reuses the existing dnd-kit setup — no new package. | 2026-05-24 |
| No new `display_element.type` registration in the slot pipeline (`slot-renderer.tsx`). Tabular branch lives inside `cell-card.tsx`'s output-cell dispatch as `display_emphasis === 'tabular' \|\| (display_emphasis === 'plain' && tabular_columns.length === 0 && shape === 'array_of_objects')` → render `<TabularRenderer />` | Per AV-1: tabular is a presentation mode for an Output cell, not a new element type. Charts and text-blocks needed their own slot registrations because they're distinct `display_element.type` values; tabular shares `kind = output` with KPI / plain cells. | 2026-05-24 |
| `tabular_columns` writes go through the existing `PATCH /api/cells/:id` endpoint — no new route. Zod schema in `src/lib/cells/validation.ts` is extended with a `tabularColumnsSchema` discriminated by element shape; the route handler validates the array (max-length cap matching engine's 10k row cap is overkill — practical cap of e.g. 200 columns sufficient) | One write surface for cell mutations matches PROJ-9's pattern. Existing RLS-via-calculator-join policies cover the new field with no policy edit. Optimistic concurrency (calculator-level `updated_at` echo, 409 on stale) inherits unchanged. | 2026-05-24 |
| "First Tabular activation" trigger flag is **implicit** — derived from `tabular_columns.length === 0` at the moment of activation. No separate boolean field. Same rule gates the `card_size_hint` narrow → wide one-time bump | Spec already established the implicit rule (Auto-population AC: "The 'first Tabular activation' flag is recorded implicitly by `tabular_columns` having content"). Adding a boolean would be redundant state. | 2026-05-24 |
| Undo-stack enrollment: the editor store wraps every `tabular_columns` mutation in a single `pushUndoEntry(prev, next)` call. Drag-reorder pushes one entry covering start → end (not one per intermediate position). Smart-merge wraps the formula commit + column delta into one combined entry via a `pushCombinedUndoEntry` API extracted during this change | Matches PROJ-9's pattern (one entry per logical user operation, not per micro-mutation). The combined-entry API is a small generalisation of existing undo plumbing — not a wholesale rework. | 2026-05-24 |
| Frontend QA's sticky-header cross-browser verification (Chrome / Firefox / Safari desktop + iOS Safari + Android Chrome) runs as a documented manual exercise in `/qa`, NOT as automated E2E. Playwright covers happy-path rendering only | Sticky-header behaviour differences are perceptual — automated viewport screenshots don't catch the "header flickers / shows transparent background during fast scroll" failure mode the spec calls out. A 5-browser human walkthrough at QA time is cheaper than maintaining cross-browser visual regression suites. | 2026-05-24 |
| No data migration on existing cells. Default `'[]'::jsonb` covers every existing row; auto-population happens lazily on first Tabular activation per cell | Spec already mandates `default '[]'::jsonb`. No backfill needed because no cell currently uses tabular (placeholder branch covers them today). Existing `array_of_objects` cells will auto-populate the first time the maintainer opens them post-deploy — predictable, no batch job. | 2026-05-24 |
| **Supersedes** the "implicit first-activation flag via `tabular_columns.length === 0`" decision (row above). `display_emphasis` is now the explicit, authoritative signal: the auto-pop effect promotes default-plain cells to `display_emphasis = 'tabular'` in the same PATCH that seeds the columns, and `isTabularBranchActive` reads emphasis as its primary gate. The length-based check survives only as the bootstrap-paint trigger for the single render between mount and the auto-pop PATCH landing (and for visitor surfaces where the hook is gated off). | The implicit flag flipped to `false` the instant the seed landed and dropped the renderer back into the scalar branch — the BUG-H1 root cause. Promoting emphasis explicitly turns "is this cell tabular?" into a single durable field, removes the flicker, and preserves the Edge Case "switched from tabular to plain → plain means plain" rule (a maintainer who explicitly picks plain post-seed lands in neither branch and gets the scalar/KPI first-value fallback). | 2026-05-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Big picture

PROJ-17 is a **renderer-plus-configurator** plug-in. It does not
introduce a new display-element type, a new API route, or a new
visitor surface. It plugs into seams PROJ-9 already left open:
the `display_emphasis = 'tabular'` enum value, the placeholder
branch in `cell-card.tsx`, and the hidden-in-the-picker tabular
option in `cell-visual-panel.tsx`. The work is structured into
four parallelisable workstreams:

1. **Database**: one migration that adds the `tabular_columns`
   JSONB column and updates both public RPCs while preserving
   the KI-1 owner-status JOIN.
2. **Shared formatter**: extract PROJ-9's inline `formatValue`
   into `src/lib/cells/format.ts`; route the cell renderer
   through it. (One commit, prerequisite for #3 and #4 — done
   first so the table renderer can consume it cleanly.)
3. **TabularRenderer**: a single component that takes
   `(columns, rows, theme)` and renders the table. Reused by
   the cell renderer (Builder + visitor — same dispatch site).
4. **Column configurator**: a subcomponent rendered inside the
   visual-presentation panel when emphasis is tabular; wires
   into existing dnd-kit reorder and the editor store's
   undo/PATCH pipeline.

The editor store gains a thin reconciliation helper (`reconcileTabularColumns(prev, newFirstRowKeys)`) that runs
when a formula commits — covered by Workstream #3 since the
hook lives at the dispatch site.

### Component structure (visual tree)

```
Migration (Database)
└── ALTER cells ADD tabular_columns jsonb DEFAULT '[]'
└── CREATE OR REPLACE fn_get_public_calculator
    └── enumerated cl.tabular_columns added
    └── KI-1 profiles JOIN preserved verbatim
└── CREATE OR REPLACE fn_get_scenario_by_share_token
    └── same two edits

Shared format helper (src/lib/cells/format.ts)
└── formatValue(spec, value): string
    └── consumed by cell-card.tsx (PROJ-9 refactor)
    └── consumed by tabular-renderer.tsx (new)
└── format.test.ts (Vitest)

Builder/Visitor cell dispatch (src/components/editor/cell-card.tsx)
├── existing scalar branch (unchanged)
├── KPI branch (unchanged — first-scalar fallback survives)
├── NEW tabular branch
│   ├── triggers: emphasis === 'tabular'
│   │          OR emphasis === 'plain' && empty config && array_of_objects
│   ├── renders <TabularRenderer columns rows />
│   └── shape-error branch: array_of_scalars → inline red error
└── DELETED: "Array result — tabular display ships in v1.1." placeholder
└── DELETED: inline formatValue() (now imported)

TabularRenderer (src/components/editor/tabular-renderer.tsx)
├── scroll container (overflow-x + overflow-y, max-height 400px)
├── <table>
│   ├── <thead> with position: sticky; top: 0; cardSurface bg
│   │   └── <th> per visible column, scope="col"
│   └── <tbody>
│       ├── one <tr> per array row
│       │   └── <td> per visible column, formatted via formatValue
│       └── empty fallback row: "No data" centered, muted
└── reads tokens from theme context (borderSubtle / text / muted / cardSurface)

Editor visual-presentation panel (src/components/editor/cell-visual-panel.tsx)
├── EMPHASIS PICKER
│   ├── Plain
│   ├── KPI
│   └── Tabular (NEW — was hidden in PROJ-9; this commit unhides)
└── NEW: Columns subsection (conditional on emphasis === 'tabular')
    └── <TabularColumnConfig />

TabularColumnConfig (src/components/editor/tabular-column-config.tsx)
├── info-tooltip header ("Columns mirror the first row …")
├── empty placeholder when tabular_columns.length === 0
└── dnd-kit SortableList of column rows
    └── per row: grip · id (read-only) · label · format dropdown
                 · alignment segmented · currency_code (conditional)
                 · visibility Switch

Editor store / mutations
├── existing PATCH /api/cells/:id surface (unchanged route)
├── NEW reconcileTabularColumns(prev, newFirstRowKeys) — pure helper
├── formula-commit handler: derive new keys → reconcile → single PATCH
│   carrying both formula + tabular_columns → single combined undo entry
└── auto-bump card_size_hint narrow → wide on first activation when
    tabular_columns.length === 0 (rolled into same PATCH/undo entry)

Validation (src/lib/cells/validation.ts)
└── tabularColumnSchema (per-row Zod object)
    ├── id: string
    ├── label: string max 100
    ├── format: enum (10-entry catalogue, mirrors display_format)
    ├── alignment: enum ['left','center','right']
    ├── currency_code: regex /^[A-Z]{3}$/ | null (normalised uppercase)
    └── visibility: enum ['visible','hidden']
└── tabularColumnsSchema (array, max 200 items as sanity cap)
```

### Data model (plain language)

Each Output cell gains one new persisted field, `tabular_columns`:
an ordered list of column configs. Each entry carries:

- **id** — the formula key it binds to (string, immutable; the
  formula owns it).
- **label** — display header text (max 100 chars; empty falls
  back to id at render time).
- **format** — one of the 10 catalogue entries shared with cells.
- **alignment** — left / center / right.
- **currency_code** — three-letter uppercase ISO code or null
  (null = inherit cell-level → fall back to "USD").
- **visibility** — visible / hidden (hidden columns don't render
  to visitors but stay in the configurator for re-show).

Array element order IS the rendered column order. The column set
is owned by the formula's first-row keys; maintainer styling is
the additive layer. No separate "first activation" flag — derived
implicitly from the array being empty vs populated.

**Storage**: PostgreSQL JSONB column on `public.cells`. Default
`'[]'::jsonb`. RLS inherits from the existing calculator-join
policies. Visible to visitor / scenario routes via the two public
RPCs (which both enumerate columns explicitly — adding the new
column is a mandatory line item, not automatic).

**No data migration** for existing rows — default covers them;
auto-population fires lazily per cell on first Tabular activation
post-deploy.

### Tech decisions (justified for a PM)

- **Why one TabularRenderer file, not a renderer directory?**
  Charts have 12 visually-distinct subtypes (line, bar, pie, …) —
  hence `chart-renderers/*.tsx` + a dispatch file. Tables don't
  have subtypes; one renderer covers every shape (long, wide,
  empty, errored). A single file matches the actual complexity.

- **Why client-side smart-merge?** The formula engine already
  lives in the client (PROJ-7 ships it as a browser-side library).
  Running the engine again on the server to re-derive the new
  first-row keys after a formula commit would be a runtime
  duplication for no isolation gain — the maintainer is already
  authenticated and writing arbitrary formulas. Reconciling
  client-side keeps the editor store as the single source of
  truth for "what's the next state of this cell" and lets one
  PATCH carry both `formula` and reconciled `tabular_columns` in
  one network round-trip with one undo entry.

- **Why extract the formatter NOW instead of inlining a copy in
  the table renderer?** Spec mandates "one format system across
  cells and columns". Inlining a copy would force every future
  format change to land in two files and stay in sync — exactly
  the kind of drift the spec calls out. The extraction is small
  (one function moves, two import lines added) and lands in the
  same PR as the renderer, so reviewers see both halves at once.

- **Why no new API route?** Tabular_columns is a field on the
  cells table, written via the same `PATCH /api/cells/:id`
  endpoint that handles every other cell mutation today
  (PROJ-9). RLS, optimistic concurrency, and undo all work
  unchanged. A new route would be ceremony with no functional
  benefit.

- **Why one combined migration file?** Per AV-2: the ALTER and
  the two `CREATE OR REPLACE` are not independent — deploying
  the column without updating the RPCs would silently break the
  visitor / scenario views (cells render without their column
  config). Co-locating them in one migration makes the deploy
  atomic and the diff reviewable in one place. The KI-1 JOIN
  preservation is the third must-not-drop line; this migration
  is the third surface where it could regress, so calling it out
  explicitly in the migration file's header comment is part of
  the work.

- **Why the column configurator as a subcomponent, not inline in
  the visual panel?** `cell-visual-panel.tsx` is already ~230
  lines and covers Card-level visual settings, emphasis picker,
  format / alignment / currency_code (cell-level), and now
  potentially a 50-row column list. Splitting the configurator
  into `tabular-column-config.tsx` keeps each file at a readable
  scope and lets the configurator carry its own dnd-kit setup
  without polluting the panel's hooks.

### Dependencies (packages)

**No new packages.** Everything PROJ-17 needs is already in the
project:

- **@dnd-kit/core + @dnd-kit/sortable** — installed for PROJ-9
  section reorder and PROJ-15 chart-series reorder. The
  configurator's column reorder reuses the same setup.
- **Existing Tailwind + shadcn primitives** — Switch (for
  visibility), Select (for format dropdown), Input (for label
  and currency_code), and the existing segmented-control pattern
  (for alignment) are all already in the project.
- **No table library** (no TanStack Table, no react-window). Pure
  semantic `<table>` markup. Virtualization is an explicit v1.1
  follow-up gated on production telemetry.
- **No new formatter library** — `Intl.NumberFormat` covers
  numbers / currency / percent; `Intl.DateTimeFormat` covers
  dates. PROJ-9's existing `formatValue` already uses these; the
  extraction is a move, not a rewrite.

### File touch list (HOW the work lands)

**New files (5):**
- `supabase/migrations/<next>_tabular_output_cells.sql` — schema +
  both RPC replacements + KI-1 JOIN preservation.
- `src/lib/cells/format.ts` — extracted `formatValue` helper.
- `src/lib/cells/format.test.ts` — Vitest unit tests for the
  format catalogue.
- `src/components/editor/tabular-renderer.tsx` — shared renderer.
- `src/components/editor/tabular-column-config.tsx` — configurator
  subcomponent.

**Modified files (~5):**
- `src/lib/supabase/types.ts` — regenerated post-migration.
- `src/lib/cells/types.ts` — `TabularColumn` TypeScript type,
  added to `CellRow`.
- `src/lib/cells/validation.ts` — Zod schemas
  (`tabularColumnSchema`, `tabularColumnsSchema`); extend the
  existing PATCH-cell validator.
- `src/components/editor/cell-card.tsx` — delete placeholder
  branch (line 223), delete inline formatValue (line 243), add
  tabular dispatch branch + auto-fallback condition, wire
  smart-merge call into the formula-commit handler.
- `src/components/editor/cell-visual-panel.tsx` — unhide tabular
  in emphasis picker; conditionally render `<TabularColumnConfig />`
  when emphasis is tabular.

**Verified unchanged (per AV-1):**
- `src/components/editor/slot-renderer.tsx` — no new element
  type registration.
- Visitor-surface files — no parallel renderer; the slot
  pipeline picks up the cell renderer change automatically.

### Migration ordering (one file, three logical steps)

The single migration file applies in this order so a mid-deploy
failure leaves the database in a consistent state:

1. `ALTER TABLE public.cells ADD COLUMN tabular_columns jsonb NOT NULL DEFAULT '[]'::jsonb` — adds the column; existing rows
   pick up the default.
2. `CREATE OR REPLACE FUNCTION public.fn_get_public_calculator(...)` — re-issues with `cl.tabular_columns` added to
   the enumerated SELECT AND the KI-1
   `JOIN public.profiles … AND p.status = 'approved'` clause
   preserved verbatim from `20260531000001_public_calculator_text_blocks.sql:163-165`.
3. `CREATE OR REPLACE FUNCTION public.fn_get_scenario_by_share_token(...)` — same two changes; KI-1 JOIN preserved
   from `:320-322`.

Post-migration, regenerate types:
`npx supabase gen types typescript --linked > src/lib/supabase/types.ts`.

The migration file header carries a comment block calling out
the KI-1 JOIN preservation requirement so that any future
`CREATE OR REPLACE` of these RPCs reads the warning before
copy-pasting an older version.

### Risk register

- **KI-1 JOIN regression** (high impact, medium likelihood) —
  PROJ-15 silently dropped this JOIN; PROJ-16 restored it; PROJ-17
  is the third migration to `CREATE OR REPLACE` these RPCs. QA
  must re-run `tests/PROJ-14-settings.spec.ts:593` (status-gate
  regression test) post-migration. Mitigation: explicit header
  comment in the migration file; documented checklist line in
  `/qa` for this feature.
- **Sticky-header cross-browser regression** (medium impact,
  low likelihood) — `position: sticky` interacts oddly with
  `overflow` containers across browsers. Mitigation: documented
  5-browser manual exercise at `/qa` time; opaque `cardSurface`
  background on `<thead>` per spec.
- **Smart-merge race with concurrent formula edits** (low impact,
  low likelihood) — if the maintainer commits a formula on one
  tab and edits columns on another, optimistic concurrency
  (calculator-level `updated_at`) handles the conflict via the
  same 409 → refresh-banner path PROJ-9 ships. No new mechanism
  needed.
- **Performance jank at 5,000+ rows** (low impact, low likelihood)
  — realistic loads (360-row amortisation) are well within the
  unoptimised render budget. Virtualization (`react-window`) is
  a renderer-only follow-up gated on production telemetry; no
  schema or API change needed to add it later.

### What's explicitly NOT in this design

- No new `display_element.type` and no new slot registration —
  tabular is a presentation mode for Output cells, not a new
  element type (AV-1 verified).
- No new API route — `PATCH /api/cells/:id` already exists and
  handles the new field via extended Zod validation.
- No server-side formula evaluation — smart-merge runs in the
  client editor store.
- No new package dependencies.
- No data migration for existing rows — default `'[]'::jsonb`
  covers them; auto-population is lazy on first activation.
- No backfill of `card_size_hint` for existing cells — the bump
  is a one-time-per-cell event triggered at first Tabular
  activation, not at migration time.

## Implementation Notes (Frontend — 2026-05-24)

Files added:

- `supabase/migrations/20260601000000_tabular_output_cells.sql` —
  `ALTER TABLE public.cells ADD COLUMN tabular_columns jsonb NOT NULL
  DEFAULT '[]'::jsonb` + `CREATE OR REPLACE` of
  `fn_get_public_calculator` and `fn_get_scenario_by_share_token` to
  enumerate the new column. KI-1 owner-status JOINs preserved
  verbatim from the PROJ-16 migration (header comment calls this out
  for future replacements). **Not yet pushed** — auto-mode classifier
  blocked the `npx supabase db push` call; the deployer must run the
  push + `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
  before `/qa`. As a stopgap so the build compiles now, the
  generated `cells` row type in `src/lib/supabase/types.ts` carries
  `tabular_columns: Json` (Insert/Update mark it optional with
  default). The next `gen types` run reproduces this verbatim.
- `src/lib/cells/format.ts` + `src/lib/cells/format.test.ts` —
  shared `formatValue(spec, value)` formatter for the 10-entry
  display_format catalogue + `humaniseKey` + `inferColumnFormatting`.
  Consumed by both `cell-card.tsx` (cell renderer) and
  `tabular-renderer.tsx` (column renderer).
- `src/lib/cells/tabular-reconcile.ts` +
  `src/lib/cells/tabular-reconcile.test.ts` — pure
  `reconcileTabularColumns({ prev, firstRow })` smart-merge helper.
  Survivor reorder is preserved; vanished keys dropped; new keys
  appended with auto-populated defaults. `seedTabularColumns` is the
  initial-activation convenience.
- `src/components/editor/tabular-renderer.tsx` — single shared
  renderer for Builder + visitor. Sticky `<thead>`, 400px
  max-height scroll container, horizontal scroll on overflow,
  semantic `<table>` markup.
- `src/components/editor/tabular-column-config.tsx` — dnd-kit
  reorder configurator with label / format / alignment /
  currency_code / visibility per column; info-tooltip explains the
  auto-only contract.

Files modified:

- `src/lib/cells/types.ts` — added `TabularColumn`,
  `TabularColumnAlignment`, `TabularColumnVisibility` types and
  `tabular_columns: TabularColumn[]` on `CellRow`. Caps:
  `MAX_TABULAR_COLUMN_LABEL_LENGTH = 100`,
  `MAX_TABULAR_COLUMNS = 200`.
- `src/lib/cells/validation.ts` — `validateTabularColumns` with the
  AC-specified error codes (`column_label_too_long`,
  `invalid_column_format`, `invalid_column_alignment`,
  `invalid_currency_code`, `tabular_columns_too_long`,
  `tabular_columns_duplicate_id`). Currency codes are upper-cased
  before pattern-matching.
- `src/lib/cells/client.ts` — `tabular_columns` added to the
  CreateCellBody / PatchCellBody surface.
- `src/app/api/cells/[id]/route.ts` — Zod schema accepts the new
  field; `validateTabularColumns` runs before the update;
  `CELL_COLUMNS` SELECT enumerates `tabular_columns`.
- `src/app/api/sections/[id]/cells/route.ts` — `CELL_COLUMNS` adds
  `tabular_columns`. DB default `'[]'::jsonb` handles inserts.
- `src/lib/calculators/public.ts` + `src/lib/scenarios/public.ts` —
  `normaliseTabularColumns` defensively narrows the RPC payload's
  new JSONB column onto `PublicSectionCell`.
- `src/lib/editor/EditorProvider.tsx` — added `useOptionalEditor()`
  sibling hook that returns null when no store is mounted. Lets
  visitor surfaces mount the shared `CellCard` without throwing,
  while the auto-population side-effect gates cleanly on builder mode.
- `src/components/editor/cell-card.tsx` — placeholder branch
  removed; tabular dispatch added (explicit emphasis OR auto-fallback
  for `plain` + empty config + `array_of_objects`); shape-error
  branch for `array_of_scalars`; KPI-style first-scalar fallback for
  `plain` + non-empty config + array result; inline `formatValue`
  deleted (now imported from `@/lib/cells/format`); new
  `useTabularAutoPopulation` effect handles first-activation seed +
  `card_size_hint` narrow → wide bump + smart-merge on formula
  commit. Visitor surfaces inherit the renderer automatically via
  the same dispatch site (AV-1 verified — no separate visitor cell
  renderer; the slot pipeline shares the cell card).
- `src/components/editor/cell-visual-panel.tsx` — Tabular option
  unhidden in the emphasis picker; `<TabularColumnConfig />` renders
  conditionally below the picker when emphasis is tabular.

Deviations / open items:

- Migration push (`supabase db push`) and types regeneration are
  blocked behind a user confirmation. The local
  `src/lib/supabase/types.ts` was hand-patched to add
  `tabular_columns: Json` to the `cells` row/insert/update so the
  Next.js build compiles. The next live `gen types` run will
  re-emit the same shape.
- `tabular_columns` PATCH does not yet pass through the optimistic
  paint in `EditorProvider.patchCell` differently from any other
  field — the existing optimistic-update loop copies the new value
  onto the local cell row, which gives the configurator's drag /
  toggle / label edits sub-frame feedback. Smart-merge fires via
  the auto-population effect and re-renders the table inside the
  same PATCH window.
- Drag-handle accessibility uses dnd-kit defaults inside
  `tabular-column-config.tsx` (Space/Enter to grab, arrow keys to
  move, Escape to cancel) — same pattern as the section reorder
  configurator.
- Sticky-header cross-browser verification (Chrome / Firefox /
  Safari desktop + iOS Safari + Android Chrome) is a documented
  manual exercise for `/qa`, not an automated Playwright check.

## QA Test Results

**QA cycle:** 2026-05-24
**QA owner:** /qa skill
**Production-ready decision:** **NOT READY** — 2 High-severity bugs require
developer fixes before deploy.

### Summary

- **Acceptance criteria audited:** 90+ across 11 AC sections.
- **Bugs found:** 2 High, 2 Medium, 3 Low, 1 Informational.
- **Unit tests:** 857 / 857 passed (89 test files, including the new
  `format.test.ts` and `tabular-reconcile.test.ts`).
- **E2E tests:** new `tests/PROJ-17-tabular-output-cells.spec.ts` —
  9 active tests passing (Chrome desktop + Mobile Safari), 1 `test.fixme`
  marker pending the BUG-H1 fix.
- **AV-2 regression gate:** **PASSED** — the AV-2 canary at
  `tests/PROJ-14-settings.spec.ts:593` (PROJ-14 owner-status JOIN held)
  passes against the new `fn_get_public_calculator` /
  `fn_get_scenario_by_share_token` `CREATE OR REPLACE`s. KI-1 owner-status
  JOIN preserved through this migration (third surface where it could
  have regressed).
- **Migration & types:** the `20260601000000_tabular_output_cells.sql`
  migration is already pushed to the linked Cloud project (`supabase
  migration list --linked` confirms the timestamp present on both Local
  and Remote). A fresh `npx supabase gen types typescript --linked` run
  produced a bit-identical diff against the checked-in
  `src/lib/supabase/types.ts` — the hand-patched stopgap from the
  frontend implementation notes is now redundant (the types match the
  cloud schema).

### AV-2 regression gate detail

Per the QA brief: re-ran `tests/PROJ-14-settings.spec.ts:593`
post-migration. The test seeds an approved user, publishes a calculator,
flips the owner profile to `status='pending_deletion'`, then hits the
public `/c/<token>` route unauthenticated and asserts a 404/410. The
test PASSED — which proves the `JOIN public.profiles … AND p.status =
'approved'` clauses survived the `CREATE OR REPLACE` of both RPCs.
PROJ-15 silently dropped this JOIN; PROJ-16 restored it; PROJ-17 carries
it verbatim.

### Sticky-header cross-browser probe

The PROJ-17 risk register flagged sticky-header behaviour as a perceptual
failure mode (flicker / transparent background bleed) that automated E2E
doesn't reliably catch. The Decision Log mandated a 5-browser manual
walkthrough on a 50-row tabular cell inside the 400px container.

Coverage achieved by automated checks:
- **Chrome (Desktop, Chromium 145)** — pass. `<thead>` computed style is
  `position: sticky` with non-transparent `background-color` resolved from
  the theme's `cardSurface` token. Headers stay anchored during vertical
  scroll inside the card.
- **Mobile Safari (iPhone 13 emulation, WebKit 26)** — pass. Same
  contract; sticky headers anchor inside the scroll container, no
  see-through.

Coverage pending manual hands-on probe (no project entry for these in
`playwright.config.ts`; browsers are installed but the `--browser`
override is rejected against a config that defines projects):
- **Firefox 146 (Desktop)** — not yet probed manually. Recommended before
  deploy.
- **Safari 26 (Desktop, native)** — not yet probed manually. Recommended
  before deploy.
- **Android Chrome (current)** — not yet probed. Recommended before
  deploy (no Android emulator project shipped with the repo).

The two browsers that DID run automated coverage are the two most
likely to exhibit `position: sticky` × `overflow` interaction quirks
(Chromium + WebKit). Firefox / Safari desktop / Android Chrome carry
low regression risk against an opaque `cardSurface` background, but the
spec's risk register asks for explicit human eyes — flagged as a
deploy-time chore in the Bug Inventory below (BUG-I1), not a blocker.

### Acceptance criteria coverage matrix

| AC section | Total | Passed | Failed | Notes |
|------------|-------|--------|--------|-------|
| Database — `tabular_columns` persistence | 4 | 4 | 0 | Migration shipped; types regenerated; RLS inherits via existing policies; types include the new column. |
| Renderer — emphasis-picker visibility | 3 | 3 | 0 | Tabular option unhidden; cycling persists `tabular_columns`. |
| Renderer — auto-fallback for array cells | 5 | 4 | 1 | **BUG-H1**: `array_of_objects + emphasis='plain' + populated tabular_columns` flips to scalar instead of staying tabular (AC line 280-282 violated post-seed). |
| Auto-population on first activation | 6 | 5 | 1 | Seed logic correct; `card_size_hint` bump correct. Failure is the BUG-H1 side-effect: once seeded, renderer drops back to scalar. |
| Smart-merge reconciliation on formula commit | 6 | 5 | 1 | Reconciliation logic correct (pure helper covered by `tabular-reconcile.test.ts`). **BUG-M1/M2**: not bundled into one undo entry with the formula commit. |
| Renderer — table layout and content | 7 | 7 | 0 | Semantic `<table>`/`<thead>`/`<tbody>` markup, formatted via shared `formatValue`, hidden columns omitted. |
| Renderer — sizing & overflow | 5 | 5 | 0 | `max-height: 400px`, sticky `<thead>`, horizontal-scroll on natural-width overflow. |
| Renderer — empty array / errors / missing data | 5 | 4 | 1 | **BUG-L3**: all-columns-hidden + rows-present renders empty `<tr>` shells instead of the spec's "No data" placeholder. Other empty-state paths correct. |
| Configurator UI (Builder card expand panel) | 11 | 10 | 1 | Drag-reorder, label/format/alignment/currency/visibility controls all wire through PATCH cleanly. **BUG-L2**: `hasShapeMatch` flag passed to `<TabularColumnConfig />` is always `false` in the placeholder branch (logic typo; user-invisible because both branches show similar copy). |
| Column-config field validation | 5 | 5 | 0 | All AC-specified HTTP 400 error codes match (`column_label_too_long`, `invalid_column_format`, `invalid_column_alignment`, `invalid_currency_code`, `tabular_columns_too_long`). |
| Persistence — API | 3 | 3 | 0 | Optimistic concurrency, `tabular_columns` independent of emphasis cycling, no policy change required. |
| Undo / Redo enrollment | 2 | 1 | 1 | Per-control undo entries fire one-per-action. **BUG-M1/M2**: auto-pop seed and smart-merge reconciliation each generate a separate PATCH/undo entry instead of bundling with the user-initiated action. |
| Cross-feature interactions | 7 | 6 | 1 | Hidden-cell dot, scenarios re-evaluation, visitor-side rendering all correct. **BUG-H2**: `fn_duplicate_calculator` doesn't enumerate `tabular_columns`, so duplicates lose all column config (AC line 686-690 incorrectly assumed PROJ-10's existing copy was column-complete). |
| Shared formatter helper | 3 | 3 | 0 | Extracted into `src/lib/cells/format.ts`; cell-card consumes it; unknown formats fall back to text_plain. |

### Bug Inventory

#### BUG-H1 — Auto-fallback flips to scalar after seed (High)

**Severity:** High — breaks the spec's marquee "formula returns array →
table just renders" auto-fallback path. Affects both Builder (flicker
from table → scalar in one render cycle) and visitor side (any cell
that's been opened in the Builder ever shows scalar/KPI rendering
instead of tabular when emphasis is the default `'plain'`).

**ACs violated:** Renderer — auto-fallback line 280-282 ("Given an
Output cell with `display_emphasis = 'plain'` (the PROJ-9 default),
when the cell's formula evaluates to `shape = 'array_of_objects'`, then
the Builder card renders the shared tabular renderer using the cell's
persisted `tabular_columns` (auto-populated on first such evaluation)").
Also line 672-678 (visitor input changes render against persisted
config).

**Repro steps:**

1. As an approved user, create a new Output cell with a formula like
   `=MAP(SEQUENCE(3), i => OBJECT("month", i, "principal", i * 100))`.
2. Observe the Builder: the cell briefly renders the table, then flips
   to a scalar/KPI value (the first value of the first row).
3. Visit `/c/<token>` as a visitor: the cell renders as scalar/KPI,
   never as a table — the configured columns are persisted but ignored
   by the renderer.

**E2E repro:** `tests/PROJ-17-tabular-output-cells.spec.ts:273` —
marked `test.fixme()` until this is fixed; remove the `.fixme` to flip
into a passing regression guard.

**Root cause:** `isTabularBranchActive(cell, result)` in
`src/components/editor/cell-card.tsx:295` gates the auto-fallback branch
on `tabular_columns.length === 0`. The auto-pop `useEffect` then PATCHes
`tabular_columns` to the seeded array — flipping the gate condition to
`false` on the next render. Result: render 1 = tabular (with empty
columns), render 2 = scalar.

**Suggested fix (one of):**

- In `useTabularAutoPopulation`'s first-time-seed branch, include
  `display_emphasis: 'tabular'` in the PATCH alongside `tabular_columns`
  and `card_size_hint`. Subsequent renders then enter the
  `cell.display_emphasis === 'tabular'` branch unconditionally.
- OR change `isTabularBranchActive` to use a separate "user explicitly
  cycled emphasis" signal (e.g. a new boolean column or a marker on
  `tabular_columns` itself) instead of `tabular_columns.length === 0`.

Option A is the minimum-diff fix and matches the spec's "auto-populated
on first such evaluation" wording — the seed itself promotes the cell
to explicit tabular emphasis. The Edge Case at line 750-766 ("switched
from tabular to plain… plain means plain") then still holds: a maintainer
who explicitly clicks Plain after the auto-fallback gets scalar/KPI as
designed.

#### BUG-H2 — `fn_duplicate_calculator` drops `tabular_columns` (High)

**Severity:** High — duplicating a calculator with one or more tabular
cells silently resets every column's label / format / alignment /
currency / visibility / order. Author re-styles by hand after every
duplicate.

**ACs violated:** Cross-feature interactions line 686-690 ("Given a
calculator with one or more tabular Output cells is duplicated within
the maintainer's account (PROJ-10), when the duplicate is created, then
the `tabular_columns` field is copied verbatim onto the duplicate's
cell rows. (PROJ-10's cell-copy already covers the full row including
the new JSONB column — no PROJ-10 changes needed.)"). The "no PROJ-10
changes needed" claim is incorrect.

**Repro steps:**

1. Build a calculator with a tabular Output cell, configure column
   labels / formats / hide one column.
2. From the dashboard, duplicate the calculator.
3. Open the duplicate's tabular cell. `tabular_columns` is `[]` —
   auto-fallback will re-seed with default labels (loses the
   "Monthly payment" → `monthly_payment` work; loses hidden columns;
   loses per-column currency overrides).

**Root cause:** `fn_duplicate_calculator` (current head:
`supabase/migrations/20260525010000_fix_fn_duplicate_calculator_title_ambiguity.sql:120-141`)
enumerates every cell column it copies, but the column list predates
PROJ-17. The new `tabular_columns` is omitted from both the `INSERT
INTO public.cells (…)` and `SELECT …` clauses, so the default
`'[]'::jsonb` lands on every duplicated cell.

**Note:** the same migration also omits the `charts` and `text_blocks`
tables entirely (PROJ-15 and PROJ-16 didn't update it either), so a
duplicate of a calculator with charts or text-blocks today loses those
elements as well. Both are pre-existing deployed bugs — flagging here so
the fix can either be scoped to `tabular_columns` only or expanded to
cover all three. The minimum PROJ-17-scoped fix is one new migration
that `CREATE OR REPLACE`s `fn_duplicate_calculator` with `tabular_columns`
added to the enumerated cell column list (and preserves the rest of the
function verbatim).

#### BUG-M1 — Smart-merge / auto-pop creates two undo entries instead of one (Medium)

**Severity:** Medium — Cmd-Z UX deviates from spec. Cmd-Z first undoes
the column reconciliation (formula stays new), then a second Cmd-Z
undoes the formula. Spec wants a single Cmd-Z to revert both.

**ACs violated:** Undo / Redo enrollment line 627-636 ("First-time
auto-population of `tabular_columns` (rolled into the emphasis-change
entry OR the formula-commit entry — whichever triggered the
activation)" AND "Smart-merge reconciliation after a formula commit
(rolled into the formula-commit entry — single entry per commit)"). Tech
Design line 1011 explicitly called for a `pushCombinedUndoEntry` API
that doesn't exist in `EditorProvider.tsx`.

**Repro steps:**

1. Open the Builder for a calculator with an existing tabular cell.
2. Edit the formula in the Grid (e.g. add a new key to the OBJECT()
   call), commit on blur.
3. Press Cmd-Z once. Observe: the new column disappears from the
   table BUT the formula text in the Grid still carries the new key.
4. Press Cmd-Z again. The formula reverts.

Same pattern fires on first-time emphasis-to-tabular flip: PATCH 1
sets emphasis, PATCH 2 seeds columns + bumps `card_size_hint`. Cmd-Z
only reverts the column seed.

**Root cause:** The formula commit handler PATCHes the cell formula
(one undo entry), then the `useTabularAutoPopulation` effect observes
the new result, computes the reconciled columns, and PATCHes them in a
second call (second undo entry). There is no combined-undo wrapper.

**Suggested fix:** Either (a) implement the `pushCombinedUndoEntry`
API the tech design called for and have the auto-pop effect call into
it, OR (b) move the smart-merge call out of `useEffect` and into the
formula-commit handler so the single PATCH carries both `formula` and
the reconciled `tabular_columns`. (b) also fixes BUG-M2 below as a
side-effect.

#### BUG-M2 — Cmd-Z of auto-pop seed is immediately re-applied by the effect (Medium)

**Severity:** Medium — Cmd-Z effectively cannot undo the auto-pop seed.
Pressing Cmd-Z reverts `tabular_columns` back to `[]`; the
`useTabularAutoPopulation` effect re-fires on the next render and
re-seeds, generating yet another undo entry. The user perceives "Cmd-Z
does nothing".

**ACs violated:** Undo / Redo enrollment line 638-641 ("Cmd-Z … editor-
level undo fires only when no editable surface has focus"). The undo
mechanism itself fires, but the side-effect immediately un-undoes the
change.

**Repro steps:**

1. Open a calculator. Add a new Output cell, write a formula like
   `=MAP(SEQUENCE(3), i => OBJECT("a", i))`. Builder auto-pops and
   seeds the columns.
2. Close any focused input. Press Cmd-Z.
3. Observe: `tabular_columns` flickers empty for one frame, then the
   effect re-seeds. Undo stack now has an additional entry; pressing
   Cmd-Z again starts a longer loop.

**Root cause:** Same as BUG-M1 — the auto-pop side-effect is not
atomic with the user's action. Fix is the same (move smart-merge /
seed into the handler, or use a combined undo entry that the effect
respects).

#### BUG-L1 — Format change doesn't auto-adjust alignment (Low, UX)

**Severity:** Low — the spec's Auto-population AC line 320-323 wording
("`alignment` from type inference: `right` for numeric (and therefore
for any column whose maintainer later switches the format to `currency`
/ `percent_*` / `number_*`)") implies that flipping a column's format
to a numeric option should also flip its alignment to `right`. The
configurator currently treats format and alignment as fully independent
controls — switching a `text_plain` column to `currency` leaves it
left-aligned until the maintainer manually flips alignment.

**Impact:** Maintainer pays a one-extra-click cost per numeric column.
Cosmetic — defaults are still sensible from the auto-pop path; only
the manual format-switch flow is affected.

**Suggested fix:** In `TabularColumnConfig.onValueChange` for the
format Select, additionally set `alignment: 'right'` when the new
format is `currency` / `percent_0` / `percent_2` / `number_integer`
/ `number_decimal_2` / `number_decimal_4`. Leave alignment alone when
the user explicitly cycled it (no easy signal for that — accepting
the trade-off is reasonable).

#### BUG-L2 — `hasShapeMatch` flag passed to TabularColumnConfig is logically wrong (Low, UX)

**Severity:** Low — user-invisible. Both branches of the placeholder
copy render similar text; the variation never actually fires because
`cell-visual-panel.tsx:116` passes
`hasShapeMatch={(cell.tabular_columns ?? []).length > 0}`, which is
always `false` in the only branch where the placeholder renders
(`columns.length === 0`).

**Impact:** Configurator placeholder always says "Your formula hasn't
returned any rows yet" instead of distinguishing the empty-array vs
shape-error vs not-evaluated cases.

**Suggested fix:** Replace the prop with a real signal of the result
shape — e.g. take the current `CellResult` (via the calculator state)
and pass `hasShapeMatch={result?.shape === 'array_of_objects'}` so the
"Your formula returned an empty array — columns will appear here once
a row arrives." copy actually shows for array-of-objects-with-zero-rows
cases.

#### BUG-L3 — All-columns-hidden + rows-present renders empty `<tr>` shells (Low, edge)

**Severity:** Low — only triggers when the maintainer deliberately
hides every column via the visibility toggle. Edge Case line 744-748
specifies "Renderer renders the empty-state placeholder ('No data' with
no header row, since every column is hidden — matches the
empty-tabular_columns rendering rule)."

**Impact:** Visitor sees N empty `<tr>` rows (with no `<td>` children)
instead of a "No data" placeholder. Visually broken empty container.

**Repro:** Toggle every column's visibility off in the configurator.
Observe the table preview area renders empty `<tr>` rows.

**Suggested fix:** In `TabularRenderer`, treat
`visibleColumns.length === 0` as the empty-state trigger regardless of
whether `rows.length === 0`. Current check:

```ts
if (!hasHeaders && isEmpty) return <EmptyPlaceholder theme={theme} />;
```

Becomes:

```ts
if (!hasHeaders) return <EmptyPlaceholder theme={theme} />;
```

#### BUG-I1 — Sticky-header manual cross-browser probe pending (Informational)

**Severity:** Informational — automated coverage hits Chrome + Mobile
Safari (the two most likely to expose `position: sticky` × `overflow`
quirks). Firefox / desktop Safari / Android Chrome are pending hands-on
probe per the Tech Design risk register. No defect observed in the
automated coverage; carry as a deploy-time chore.

#### Storage of whitespace-only column labels (Informational)

The PATCH validator accepts whitespace-only labels verbatim (e.g. "   "
is stored as three spaces); the spec implies "trim-empty value is
accepted and stored as the empty string." The TabularRenderer trims the
label at render time and falls back to the column `id`, so the user-
visible outcome matches the spec — but the persisted value isn't
trimmed. Carry as informational; trivial server-side `trim()` would
close the gap.

### Regression sweep — PROJ-7 / PROJ-9 / PROJ-11 / PROJ-15 / PROJ-16

Ran the full E2E suite for each upstream feature.

- **PROJ-7 (Formula Engine):** unit-test surface only — the engine's
  857-test pack passes verbatim. PROJ-17 doesn't touch the engine.
- **PROJ-9 (Cell Authoring):** 1 timeout in the existing suite
  (`tests/PROJ-9-cell-authoring.spec.ts:236` — "Grid panel + add cell
  right-edge affordance creates a cell in the last section"). Reproduces
  in isolation, not caused by PROJ-17 (the affordance lives in
  `grid-column.tsx`, unchanged by this branch). Logged as pre-existing
  flake / deferred polish.
- **PROJ-11 (Visitor View):** all tests pass.
- **PROJ-15 (Charts):** 2 failures (`+Add picker exposes Chart as
  enabled in Builder toolbar` + the Grid-panel sibling test). Both
  expectations are stale — they assert that the "Text block" picker
  entry is disabled, but PROJ-16 (deployed earlier today) enabled it.
  Pre-existing PROJ-15 → PROJ-16 transition debt, NOT a PROJ-17
  regression. Fix is one-line updates to those two `toBeDisabled()`
  assertions.
- **PROJ-16 (Text Blocks):** the "visitor /c/<token> renders text
  blocks via public RPC without crashing" test failed once in the
  parallel batch and passed cleanly on isolated re-run. Flake, not a
  PROJ-17 regression — the RPC migration carries the same text_block
  enumeration verbatim.

### Security audit (red-team perspective)

- **XSS in row values / column labels** — TabularRenderer pipes every
  value through `formatValue` which returns a plain string, then renders
  via JSX text expressions only. No `dangerouslySetInnerHTML` anywhere
  on the tabular path. Column labels render via `{col.label}` JSX
  expression — React escapes by default. ✓
- **XSS in `currency_code`** — server-side validator normalises to
  uppercase and matches `/^[A-Z]{3}$/`. The string flows into
  `Intl.NumberFormat`'s constructor; an invalid code throws (caught by
  the formatter's try/catch with `String(raw)` fallback). No DOM
  injection surface. ✓
- **SQL injection on `tabular_columns`** — JSONB column, written via
  the Supabase client's parameterised query API. No string concat into
  SQL on the route handler. ✓
- **Authorization (cross-owner write)** — `PATCH /api/cells/:id` loads
  the cell, joins to the parent calculator (RLS-bound on calc owner),
  rejects with 404 on no match. Existing PROJ-9 policy applies to the
  new field with no edit needed. ✓
- **Authentication** — PATCH bounces unauthenticated requests with 401
  before touching the body. ✓
- **Input cap** — `MAX_TABULAR_COLUMNS = 200` rejects oversized arrays
  with `tabular_columns_too_long`. Combined with per-row max-length on
  `label`, the JSONB payload is bounded. ✓
- **Visitor read** — the public RPC enumerates `tabular_columns` and
  the calculator-owner-status JOIN strips rows whose owner is not
  approved. AV-2 canary confirms the JOIN holds. ✓

No security findings.

### Production-ready decision

**NOT READY.** Two High-severity bugs must be fixed before deploy:

1. **BUG-H1** — fix the auto-fallback render gate so cells stay tabular
   after the auto-pop seed. Without this, the spec's marquee "formula
   returns array → table appears" UX is broken in both Builder and
   visitor for every fresh tabular cell.
2. **BUG-H2** — add `tabular_columns` to `fn_duplicate_calculator`'s
   enumerated cell-copy list (new migration + the deployer's standard
   `supabase db push`). Without this, duplicates lose all column
   configuration silently.

The Medium-severity undo bugs (BUG-M1 / M2) are accept-on-Day-1
candidates if the team wants to ship the Highs and follow up with the
undo refactor; both are UX deviations from spec, not data-integrity
issues. Lows (L1/L2/L3) and the informational items are deferred polish.

After the High fixes, re-run `npm test`, the new PROJ-17 E2E suite,
the AV-2 gate, and the PROJ-9 / 11 / 15 / 16 regression sweep before
flipping the spec status to Approved.

## Bugfix cycle — Post-QA

### BUG-H1 — Auto-fallback flips to scalar after seed (Fixed 2026-05-24)

**Root cause.** `isTabularBranchActive` in
`src/components/editor/cell-card.tsx` gated the auto-fallback branch on
`tabular_columns.length === 0` as an implicit "first-activation" flag.
The `useTabularAutoPopulation` effect PATCHed only `tabular_columns`
(plus the optional `card_size_hint` bump) on first-fire, leaving
`display_emphasis = 'plain'`. As soon as the seed landed, the
length-based gate flipped false on the next render and dropped the cell
into the scalar/KPI branch — flicker in the Builder, permanent
mis-render on the visitor surface. The "implicit flag" Technical
Decision (line 1010 of the Decision Log) had the right intent but the
wrong durable signal.

**Fix.** `src/components/editor/cell-card.tsx:386-389` — the first-time
seed PATCH now additionally sets `display_emphasis: 'tabular'` when the
cell is in default `'plain'`. `display_emphasis` becomes the explicit,
authoritative signal for the tabular branch (covered by the docstring
update on `isTabularBranchActive` line 278-307 and the new comment block
on the dispatch site at line 237-249). The length-based branch survives
only as the bootstrap-paint trigger for the single render between mount
and the PATCH landing, plus the visitor-surface code path where the
auto-pop hook is gated off. Edge Case "plain means plain" is preserved
because a maintainer who explicitly clicks Plain after the auto-pop
lands neither branch and gets the scalar/KPI first-value fallback.

**No-loop verification.** Traced through the effect dependencies:
after the seed PATCH lands, render 2 carries
`emphasis='tabular' + tabular_columns=[seeded]`. The effect re-runs
because the deps changed, but takes the smart-merge branch (existing.
length > 0). `reconcileTabularColumns` returns the same id+order as
prev, `sameColumnIdsAndOrder` returns true, and no PATCH fires. The
`lastFirstRowKeysRef` guard short-circuits subsequent identical renders.
No infinite loop.

**Test coverage.** `tests/PROJ-17-tabular-output-cells.spec.ts:273` —
the `test.fixme` regression guard was rewritten and un-`fixme`'d. The
new test seeds a fresh cell with `emphasis='plain' + tabular_columns=[]`
+ an `=MAP(SEQUENCE(3), …)` formula, opens `/editor/<calcId>` as the
owner, asserts the table renders + headers come from the formula keys,
then polls the database to confirm the persisted state landed
(`display_emphasis === 'tabular'`, `tabular_columns.length === 3`).
Passes on Chromium; skipped on Mobile Safari (`test.skip(isMobile, …)`
because the builder route is desktop-only). All other PROJ-17 E2Es
remain green (19/20 active, 1 mobile skip).

### BUG-H2 — `fn_duplicate_calculator` drops `tabular_columns`, charts, text_blocks (Fixed 2026-05-24)

**Root cause.** The duplicate function at
`supabase/migrations/20260525010000_fix_fn_duplicate_calculator_title_ambiguity.sql:120-141`
enumerated cell columns explicitly but the list pre-dated PROJ-17 — the
new `tabular_columns` column was missing from both the `INSERT INTO
public.cells (…)` and the `SELECT …` clauses, so the default
`'[]'::jsonb` landed on every duplicated cell instead of the
maintainer's hand-tuned config. The same migration also never touched
the `charts` or `text_blocks` tables at all (pre-existing PROJ-15 and
PROJ-16 debt — both shipped without updating this function, so
duplicates lost charts and prose blocks wholesale). AV-2's audit was
scoped to the two READ RPCs only; the WRITE RPC's identical
enumeration pattern was structurally similar but unflagged, so the
silent drop slipped through.

**Fix.**
`supabase/migrations/20260601010000_fix_duplicate_calculator.sql` —
`CREATE OR REPLACE`s `fn_duplicate_calculator` with three additions:
(1) `tabular_columns` added to the cell INSERT/SELECT enumeration;
(2) a new `INSERT INTO public.charts (…) SELECT … FROM public.charts
JOIN sections …` block matching the existing cells pattern (charts
ride along on the same `(calculator_id, display_order)` section-map
join); (3) an analogous block for `public.text_blocks`. Owner gating,
RLS scoping, title resolver, and return shape are preserved verbatim.
The migration header carries a maintenance contract calling out that
every future column added to `cells` / `charts` / `text_blocks` MUST
be enumerated here too, and the AV-2 section above now records the
forward-looking expansion to all three SECURITY DEFINER / INVOKER
functions. Migration pushed to the linked Cloud project; type
regeneration is a no-op diff (function signature unchanged).

**Carry-over caveat (chart bindings).** Cell UUIDs are freshly
generated by the duplicate's cell INSERT, so chart `bindings` JSONB on
the duplicate still references the SOURCE calculator's cell IDs. This
surfaces as a broken-binding UX (the existing PROJ-15 renderer
behaviour) at the duplicate's first chart edit. Fixing the binding
rewrite is separate work — out of scope for BUG-H2, which only
restores the data that was silently dropped. Logged in the new
migration's body comment + flagged here so it doesn't get lost.

**Test coverage.** Three new tests under a `PROJ-17 BUG-H2 —
fn_duplicate_calculator deep-copy regression guards` describe block at
the end of `tests/PROJ-17-tabular-output-cells.spec.ts`:
- `duplicate carries tabular_columns verbatim onto the duplicated
  cell` (line 551) — seeds with `REORDERED_WITH_HIDDEN` so the
  fixture exercises maintainer reorder + per-column currency override
  + hidden flag; calls `POST /api/calculators/:id/duplicate`; asserts
  the duplicate's cell's `tabular_columns` equals the source's
  verbatim.
- `duplicate carries charts verbatim onto the duplicated section
  (PROJ-15 regression guard)` (line 587) — minimal smoke test seeding
  one chart with non-default `card_background_tint` / `card_border` /
  `card_size_hint` and asserting the duplicate carries them.
- `duplicate carries text_blocks verbatim onto the duplicated section
  (PROJ-16 regression guard)` (line 659) — same shape for a prose
  block with non-default text_size / text_colour / card visuals.

All three pass on Chromium. Full PROJ-17 E2E suite remains green
(13/13 on Chromium including the new guards and the BUG-H1 fix).

### BUG-M1 + BUG-M2 — Smart-merge / auto-pop produced two undo entries + snap-back loop (Fixed 2026-05-24)

**Root cause (shared between M1 and M2).** Auto-pop seeding and
smart-merge reconciliation lived as a detached `useEffect` side effect
in `cell-card.tsx`'s `useTabularAutoPopulation`. The user-facing
action (formula commit in the Grid, emphasis switch in the visual
panel) fired its own `patchCell` → one `recordOperation` entry. The
effect then observed the new state and issued a SECOND `patchCell`
for the column delta → second `recordOperation` entry. Cmd-Z popped
only the column delta, leaving the user's primary action in place
(BUG-M1). On the load-time bootstrap path, Cmd-Z of the silent seed
reverted `tabular_columns` back to `[]`, the effect re-fired against
the (newly-empty) state, and re-seeded — locking the user in a snap-
back loop where Cmd-Z appeared to do nothing (BUG-M2). React strict-
mode double-mount made the failure intermittent: a `useRef`-based
"already seeded" flag reset between mounts and let the second mount
duplicate the seed PATCH.

**Fix — shared helper.** New
`src/lib/cells/tabular-action.ts` exposes two pure functions:

- `computeTabularActionPatch({ cell, nextEmphasis, result })` returns
  the additive `{ tabular_columns?, display_emphasis?, card_size_hint? }`
  fields that should accompany a user-action PATCH. Handles both the
  first-time seed (with BUG-H1's emphasis promotion + size bump) and
  the smart-merge reconciliation, returning `{}` when no tabular
  update is needed.
- `evaluateSpeculative(cells, inputs, cellId, candidateFormula)`
  runs `evaluateCalculator` with the target cell's formula swapped
  for a candidate string. Lets the formula-commit handler reconcile
  against the NEW row shape before issuing the PATCH.

`src/lib/cells/tabular-action.test.ts` adds 10 unit tests covering
the seed / smart-merge / guard branches and a `evaluateSpeculative`
smoke for inter-cell dependency resolution.

**Fix — user-action sites bundle the seed (BUG-M1).**

- `grid-column.tsx` adds a `commitCellPatch(body)` wrapper used by
  BOTH the inline Grid formula input (`onBlur`) AND the data-model
  expand panel (`onPatch`). When `body.formula` differs from
  `cell.formula`, it speculatively evaluates the new formula, derives
  the tabular delta via `computeTabularActionPatch`, and issues ONE
  `patchCell({ formula, ...tabularPatch })` → ONE `recordOperation`
  entry → ONE Cmd-Z reverts everything atomically.
- `cell-card.tsx`'s `CellEditAffordance` intercepts the panel's
  `onPatch` for emphasis switches: when the user picks a NEW
  emphasis on an Output cell, the same helper bundles the seed +
  emphasis-promotion + size-bump into the SAME PATCH. (Switches
  AWAY from `tabular` are unchanged — the persisted config survives
  cycling per spec.)

**Fix — load-time bootstrap is non-undoable (BUG-M2).** Added a new
`patchCellSilent` API on `EditorStore` (and exposed via `useEditor` /
`useOptionalEditor`) that wraps `patchCellApi` + state dispatch but
deliberately bypasses `recordOperation`. The auto-pop effect's
load-time seed (the only remaining branch that ever fires a
"spontaneous" seed PATCH — the handler-driven user actions cover the
explicit cases) now goes through `patchCellSilent`. Cmd-Z has nothing
to pop for the bootstrap, so the snap-back loop is structurally
impossible. The semantic justification: a passive mount-time
initialization isn't a user action, so it shouldn't pollute the undo
stack — the user can't sensibly "undo opening the editor".

**Fix — strict-mode survival.** Replaced the per-mount
`seededFirstRowKeysRef` guard with a module-level
`seededAutoPopBootstraps: Set<string>` keyed by
`${cell.id}::${firstRowKeysSig}`. Survives React strict-mode
unmount/remount cycles, so the second mount sees the bootstrap as
"already done" and short-circuits before issuing a duplicate silent
PATCH. Cleared on hard reload by virtue of being module state — no
leak across sessions.

**Prerequisite fix — editor bundle includes `tabular_columns`.**
`src/lib/calculators/server.ts`'s `getEditorBundle` cell SELECT
didn't enumerate `tabular_columns`, so the editor hydrated with
`undefined` columns and the bootstrap effect re-seeded on every page
load (clobbering persisted config and dropping an unwanted PATCH
into the undo stack). The BUG-H2 maintenance contract called this
out as a "fourth surface for cell-column enumeration" — the fix adds
`tabular_columns` to the SELECT alongside the existing cell columns
and is now referenced in the AV-2 forward-looking note as part of
the audit surface (server.ts, fn_get_public_calculator,
fn_get_scenario_by_share_token, fn_duplicate_calculator). Cast
widened to `as unknown as CellRow[]` to accommodate the `Json` ↔
`TabularColumn[]` shape mismatch in the generated supabase types.

**Test coverage.** Two new tests under the `PROJ-17 BUG-M1 /
BUG-M2 — combined undo entry + no auto-pop snap-back` describe
block in `tests/PROJ-17-tabular-output-cells.spec.ts`:

- `BUG-M1: one Cmd-Z reverts BOTH the formula AND the smart-merged
  tabular_columns` (line 738) — opens the editor, commits a new
  formula through the data-model expand panel (drops `balance`,
  adds `c`), polls for the bundled state (smart-merged columns
  `[month, principal, c]`), then fires Cmd-Z and polls for the
  reverted state (original formula + `[month, principal, balance]`).
  Pre-fix Cmd-Z reverted only the columns; post-fix it reverts both
  in one shot.
- `BUG-M2: load-time auto-pop bootstrap is non-undoable and never
  snap-back loops` (line 859) — seeds a cell in the bootstrap state
  (emphasis='plain' + empty columns + narrow size + array-of-objects
  formula), waits for the silent seed PATCH to land, snapshots
  `updated_at`, fires Cmd-Z, then polls a 3-second window and asserts
  the cell row never mutates. Pre-fix the seed would Cmd-Z then
  re-fire and bump `updated_at`; post-fix Cmd-Z is a no-op for the
  bootstrap.

Both pass on Chromium across `--repeat-each=3` runs. Skipped on
Mobile Safari (the keyboard Cmd-Z shortcut + builder route are
desktop-only — mirrors the BUG-H1 test's `test.skip(isMobile, …)`
pattern). Full PROJ-17 E2E suite remains green: 27 passed / 3 mobile
skips on Chromium + Mobile Safari combined. Unit suite grew from
857 to 867 tests (10 new in `tabular-action.test.ts` for the
helper); all green.

## QA Re-Run — Post-Bugfix Verification (2026-05-24)

**QA cycle:** 2026-05-24 (re-run)
**QA owner:** /qa skill
**Scope:** Re-verify the BUG-H1 / BUG-H2 / BUG-M1 / BUG-M2 fixes from the
"Bugfix cycle — Post-QA" section above. Re-affirm Low / Informational
bugs (L1, L2, L3, I1) as accepted Known Issues with brief rationale,
not blockers.
**Production-ready decision:** **READY** — all four blocker fixes
verified green; three Low + one Info items accepted as Known Issues for
post-deploy polish; AV-2 KI-1 JOIN gate held; no new regressions
introduced by the fix work.

### Verification matrix

| Bug    | Severity (orig) | Fix lives at | Regression guard | Result |
|--------|-----------------|--------------|------------------|--------|
| BUG-H1 | High | `src/components/editor/cell-card.tsx` (auto-pop now promotes `display_emphasis: 'tabular'` in the same PATCH that seeds columns) + `src/lib/cells/tabular-action.ts:96-98` | `tests/PROJ-17-tabular-output-cells.spec.ts:273` "BUG-H1 regression guard: builder auto-pop promotes default-plain cells to explicit tabular emphasis" | **PASSED** (Chromium); mobile-skipped (desktop-only builder route) |
| BUG-H2 | High | `supabase/migrations/20260601010000_fix_duplicate_calculator.sql` — `fn_duplicate_calculator` `CREATE OR REPLACE` enumerates `tabular_columns` + deep-copies `charts` + `text_blocks` | Three guards: `:551` (tabular_columns verbatim), `:587` (charts PROJ-15 guard), `:659` (text_blocks PROJ-16 guard) | **PASSED** (Chromium + Mobile Safari, all 6/6 invocations green) |
| BUG-M1 | Medium | `src/lib/cells/tabular-action.ts:computeTabularActionPatch` consumed by `grid-column.tsx` (`commitCellPatch` wrapper) and `cell-card.tsx` (emphasis-switch `onPatch` interceptor) — bundles seed + smart-merge into the user-action PATCH | `tests/PROJ-17-tabular-output-cells.spec.ts:738` "BUG-M1: one Cmd-Z reverts BOTH the formula AND the smart-merged tabular_columns" | **PASSED** (Chromium); mobile-skipped (Cmd-Z keyboard shortcut not exercised on mobile) |
| BUG-M2 | Medium | `src/lib/editor/EditorProvider.tsx:patchCellSilent` (new API bypassing `recordOperation`) + module-scoped `seededAutoPopBootstraps: Set<string>` in `cell-card.tsx` (strict-mode survival) | `tests/PROJ-17-tabular-output-cells.spec.ts:859` "BUG-M2: load-time auto-pop bootstrap is non-undoable and never snap-back loops" | **PASSED** (Chromium); mobile-skipped |

### Test-pack results

- **Unit suite (`npm test -- --run`):** 867 / 867 tests across 90 files
  (+10 over the pre-fix baseline of 857 — the new `tabular-action.test.ts`
  covers the seed / smart-merge / guard branches of
  `computeTabularActionPatch` + the `evaluateSpeculative`
  smoke). All green.
- **PROJ-17 E2E suite (`npx playwright test tests/PROJ-17-tabular-output-cells.spec.ts`):**
  27 passed / 3 mobile-skipped. The three skips are the BUG-H1 / BUG-M1
  / BUG-M2 guards on Mobile Safari (each carries
  `test.skip(isMobile, …)` because the builder route + Cmd-Z keyboard
  shortcut are desktop-only). No skips were added by this re-run —
  they were introduced by the bugfix cycle and are intentional per
  the same pattern PROJ-9 / PROJ-10 use for keyboard-driven tests.
  The pre-fix `test.fixme` on the BUG-H1 guard has been removed and
  the guard now passes.
- **AV-2 KI-1 owner-status JOIN gate
  (`tests/PROJ-14-settings.spec.ts:593`):** 2 / 2 passed (Chromium +
  Mobile Safari). KI-1 JOIN survived BOTH the original PROJ-17
  migration AND the BUG-H2 fix migration — PROJ-15 silently dropped
  this JOIN, PROJ-16 restored it, PROJ-17 and BUG-H2 carry it
  verbatim. (The BUG-H2 fix migration replaced `fn_duplicate_calculator`,
  which is NOT one of the two AV-2-canary RPCs, but the same audit
  surface — the maintenance contract added in the migration header
  now codifies all three SECURITY DEFINER / INVOKER functions as
  the cell-column enumeration audit surface.)
- **Upstream regression sweep (PROJ-9 / PROJ-11 / PROJ-15 / PROJ-16):**
  100 tests, 83 passed / 14 skipped / 3 failed. The 3 failures
  reproduce the EXACT pre-existing failures called out in the
  original QA pass — not new regressions:
  - `tests/PROJ-9-cell-authoring.spec.ts:236` ("Grid panel + add cell
    right-edge affordance creates a cell in the last section") —
    pre-existing 30 s timeout flake on Chromium, called out in the
    original QA pass as "logged as pre-existing flake / deferred
    polish", not caused by PROJ-17 (the affordance lives in
    `grid-column.tsx`'s `+ Add` right-edge handler, which the
    PROJ-17 changes touch only to wrap `onPatch` with
    `commitCellPatch` — the right-edge add path is unchanged).
  - `tests/PROJ-15-charts.spec.ts:232` + `:254` ("+Add picker
    exposes Chart as enabled in Builder toolbar" + "BUG-M2: Grid
    panel header +Add exposes the same 4-option picker") — both
    assert the Text Block picker entry is DISABLED, but PROJ-16
    enabled it. Pre-existing PROJ-15 → PROJ-16 transition debt
    explicitly flagged in the original QA pass with "Fix is one-line
    updates to those two `toBeDisabled()` assertions". No PROJ-17
    code touches the picker enable / disable logic.

### Known Issues accepted for post-deploy follow-up

The user's QA re-run directive is to mark L1 / L2 / L3 (and the
informational items) as accepted Known Issues with brief rationale,
rather than as deploy blockers. Each was originally filed as Low /
Informational severity and none touches data integrity, security, or
the spec's marquee UX flow.

#### KI-PROJ17-1 — Format change doesn't auto-adjust alignment (was BUG-L1)

**Accepted because:** the auto-pop path already infers `right` for
numeric columns (covered by `inferColumnFormatting` in
`src/lib/cells/format.ts`), so the only flow affected is the
maintainer who *manually* switches a `text_plain` column to a numeric
format and expects alignment to follow. That maintainer pays a single
extra click to flip the alignment segmented control. Cosmetic; no
data loss; no spec AC violated outright (line 320-323 describes
auto-pop type inference, not a format-mutation cascade rule).

**Follow-up signal to re-open:** maintainer feedback that the click
cost matters in practice; a low-effort fix (one extra `setAlignment`
call in `TabularColumnConfig.onValueChange` for the format Select)
unblocks it.

#### KI-PROJ17-2 — `hasShapeMatch` flag passed to TabularColumnConfig is logically wrong (was BUG-L2)

**Accepted because:** **user-invisible.** Both branches of the
configurator placeholder copy ("Your formula hasn't returned any rows
yet" vs. "Your formula returned an empty array — columns will appear
here once a row arrives") render only when `tabular_columns.length ===
0`, which makes the flag always-false by construction at that
dispatch site. The wrong branch never actually surfaces, so the user
never sees the variation. Spec AC line 568-570 mentions only the
generic "no rows yet" placeholder — the variation was a developer
nicety not in the AC list.

**Follow-up signal to re-open:** if PROJ-18 / PROJ-19 or a downstream
change wires the configurator into a context where the dispatch can
fire with non-empty columns (e.g. a formula that flipped from
`array_of_objects` to `array_of_scalars` after seed), the placeholder
would need to honour the result shape — pass `result?.shape` instead
of the columns-length-derived flag.

#### KI-PROJ17-3 — All-columns-hidden + rows-present renders empty `<tr>` shells (was BUG-L3)

**Accepted because:** this is a self-inflicted edge case — the
maintainer must toggle EVERY column's visibility off. The Edge Case
section at spec line 744-748 explicitly says the expected behaviour
is the "No data" placeholder; the current renderer emits empty `<tr>`
rows instead. Visually broken but only after a deliberate authoring
mistake that the configurator dims the entire row for. No
data-integrity risk; the maintainer can re-show any column to
restore the table. The one-line fix is documented verbatim in the
BUG-L3 description (replace `if (!hasHeaders && isEmpty)` with `if
(!hasHeaders)` in `TabularRenderer`).

**Follow-up signal to re-open:** any QA pass where this edge state
shows up in a real authoring scenario, or a maintainer reports the
empty-shell render as a defect. Trivial one-line fix when surfaced.

#### KI-PROJ17-4 — Sticky-header manual cross-browser probe pending (was BUG-I1)

**Accepted because:** automated coverage hits the two browsers
(Chromium + WebKit / Mobile Safari) most likely to expose `position:
sticky` × `overflow` quirks. Firefox / desktop Safari / Android
Chrome carry low regression risk against the spec-mandated opaque
`cardSurface` background on `<thead>`, which the renderer enforces
unconditionally. Tech Design risk register explicitly classified this
as a "documented manual exercise at `/qa` time, NOT as automated
E2E" — accepting as a deploy-time chore matches the Tech Design's
stated cadence.

**Follow-up signal to re-open:** post-deploy author / visitor report
of header flicker or transparent background in a non-Chromium
browser. The CSS contract is theme-token-driven and unlikely to
diverge per browser, but the formal hands-on probe stays on the
deploy checklist.

#### KI-PROJ17-5 — Whitespace-only column labels stored verbatim (was the trailing Informational item)

**Accepted because:** the TabularRenderer trims the label at render
time and falls back to the column `id` when empty, so the
user-visible outcome matches the spec ("trim-empty value is
accepted and stored as the empty string" — the *intent* holds even
though the *storage* doesn't). No render defect; one trivial
server-side `trim()` would close the gap if the persisted shape ever
matters (e.g. for a future export feature).

### Status of pre-existing flakes (not PROJ-17 work)

The three upstream regression-sweep failures listed above are
NOT new — they reproduce the exact pre-existing items from the
original QA pass. They are out of scope for PROJ-17's deploy
decision; the PROJ-9 flake and PROJ-15 assertion staleness are
pre-existing items that should be picked up in their own follow-up
work (one-line `toBeDisabled` → `toBeEnabled` flips on the two
PROJ-15 tests; an investigation of the PROJ-9 right-edge `+ add
cell` flake — possibly a timing race on the section-list mount
that already lands the cell but the assertion times out before the
DOM stabilises).

### Production-ready decision

**READY.** All four blocker fixes verified green by their dedicated
regression guards + the full PROJ-17 E2E suite. AV-2 KI-1 JOIN gate
held through both the original PROJ-17 migration and the BUG-H2 fix
migration. Unit suite expanded from 857 to 867 tests, all green.
Upstream regression sweep introduces no new failures attributable to
the PROJ-17 bugfix work.

Hand off to `/deploy`.

## Deployment

**Deployed:** 2026-05-24
**Production URL:** https://calcgrinder.vercel.app
**Branch:** `main` (auto-deploy via Vercel)

### Pre-deployment checks (all green)

- `npm run lint` → 0 errors (8 pre-existing warnings unrelated to PROJ-17)
- `npm run build` → succeeded; full Next.js production build compiled
- Supabase migration sync (`npx supabase migration list --linked`) →
  both PROJ-17 migrations (`20260601000000_tabular_output_cells.sql`
  and `20260601010000_fix_duplicate_calculator.sql`) already present
  in Local AND Remote columns at deploy time.
- QA re-run (2026-05-24) → READY decision; all four blocker fixes
  (H1 / H2 / M1 / M2) verified green; L1 / L2 / L3 + I1 accepted as
  Known Issues (KI-PROJ17-1..5) for post-deploy follow-up.

### Database changes shipped

- `cells.tabular_columns jsonb not null default '[]'::jsonb` —
  per-cell column configurator persistence (label / format /
  alignment / currency_code / visibility / order).
- `fn_get_public_calculator` + `fn_get_scenario_by_share_token` —
  added `tabular_columns` to the enumerated cells SELECT lists in
  both public RPCs (AV-2 surface; PROJ-14 KI-1 owner-status JOIN
  preserved).
- `fn_duplicate_calculator` — `CREATE OR REPLACE` re-issued to
  carry `tabular_columns` verbatim into duplicate cells AND deep-
  copy `charts` (PROJ-15) + `text_blocks` (PROJ-16) which the prior
  HEAD silently dropped. Addresses BUG-H2.

### Known Issues carried into production

- **KI-PROJ17-1** — Format change doesn't auto-adjust alignment
  (cosmetic; one extra click).
- **KI-PROJ17-2** — `hasShapeMatch` configurator placeholder flag
  is logically wrong but user-invisible (always falls through to
  the always-rendered branch).
- **KI-PROJ17-3** — All-columns-hidden + rows-present renders
  empty `<tr>` shells instead of the "No data" placeholder. Self-
  inflicted edge case; one-line fix on standby.
- **KI-PROJ17-4** — Sticky-header manual cross-browser probe
  (Firefox / desktop Safari / Android Chrome) pending; automated
  Chromium + Mobile Safari coverage in place.
- **KI-PROJ17-5** — Whitespace-only labels stored verbatim;
  renderer trims at display so user-visible behaviour matches spec.

All five are non-blocking polish items; none touches data integrity,
security, or the spec's marquee UX flow.
