# PROJ-9: Cell Authoring & Section Management

## Status: Approved
**Created:** 2026-05-23
**Last Updated:** 2026-05-23

## Dependencies

- Requires: PROJ-6 (Calculator Theme System) — PROJ-9 extends the
  theme registry with a per-theme **layout-pattern catalogue**.
  Every theme exposes at least `single_column`; richer themes
  expose multi-column patterns (e.g. `two_column`,
  `two_thirds_one_third`). PROJ-6's `getTheme(id)` gains a
  `layoutPatterns` field; consumers iterate it via a new helper
  on the theme registry surface.
- Requires: PROJ-7 (Formula Engine) — three engine surfaces are
  consumed: `getStructuralErrors(cells)` for the per-cell
  inline red-error treatment; `getDependencies(cellName, cells)`
  for silent rename-with-update; `RESERVED_WORDS` (exported
  from `@/lib/formula`) for cell-name commit-time validation.
  The engine is also called per save to refresh per-cell
  error state so the Builder card border / Grid cell colouring
  updates immediately.
- Requires: PROJ-8 (Editor — Grid + Builder Two-Panel Split) —
  PROJ-9 fills what PROJ-8 left structurally empty. PROJ-8's
  `<EmptyBuilder>` is replaced by the section/element pipeline;
  the Grid panel gets columns; the Builder canvas iterates
  sections + display elements polymorphically; the +Add picker's
  Cell + Section options flip from disabled to enabled; the
  hidden-cells pill is unhidden when count > 0; the Builder hero
  gains its hover-edit affordances.

## Summary

PROJ-9 is the **content layer** of the editor. PROJ-8 shipped
the chrome; PROJ-9 fills it. Concretely:

1. Two new tables: **`sections`** (per-calculator named layout
   containers with a layout-pattern id) and **`cells`** (per-
   calculator data-model rows polymorphic on `kind = input |
   output`).
2. A theme-registry extension publishing the **per-theme layout
   pattern catalogue**. `single_column` is the universal
   fallback; multi-column patterns are theme-specific.
3. Updates to `POST /api/calculators` so every new calculator
   is created with an empty **default "Section 1"** in one
   atomic transaction.
4. Owner-scoped CRUD API for sections (`POST`, `PATCH`, `DELETE`,
   reorder) and cells (`POST`, `PATCH`, `DELETE`, reorder,
   move-between-sections is **out of scope** in v1).
5. **Section management** in the Builder: edit-in-place
   header (title + optional description), hover-border
   discoverability, section toolbar (drag-handle + layout-
   pattern picker + delete kebab), drag-reorder, persistent
   "+ Add section" convenience button below the last section,
   destructive-confirm bottom sheet on delete-with-children.
6. **Cell authoring across both surfaces**:
   - **Grid panel** owns the data-model settings (name,
     `value_type`, visibility, editability, description text,
     description rendering — caption vs. tooltip, default value
     for Input cells, formula for Output cells, numeric
     constraints `unit / min / max / step`).
   - **Builder card** owns the visual-presentation settings
     (display widget, display format, text size, text colour,
     plus the four card-level visuals: accent, background tint,
     border, size hint). Output cells additionally carry
     `display_emphasis` (Plain / KPI in PROJ-9; `tabular` enum
     value exists in the DB but is hidden from the picker UI
     and renders a placeholder card in P0 — see Tabular
     fall-back below).
7. All seven cell `value_type`s ship in PROJ-9: number, currency,
   percent, date, boolean, select, text. Per-type widget
   catalogues match the spec verbatim — see Widget catalogue
   below.
8. **Three +Add Cell entry points** all behave identically:
   click → instantly create an Input cell with sequential
   default name (`cell_N`), default label ("New cell"),
   `value_type = number`, visible + editable, no default value.
   The Grid column expands inline for data-model edits and the
   corresponding Builder card scrolls into view with a ~600 ms
   accent pulse.
9. **Silent rename-with-update**. Renaming a cell rewrites
   every dependent formula atomically — single undo entry,
   no confirm dialog.
10. **Hidden cells** render exactly as the spec mandates:
    0-height glowing accent dot between adjacent visible
    cards, click-to-expand the cell's edit card inline (drops
    the dot, restores on close), Builder-toolbar pill "X
    hidden cells" with an anchored popover listing them by
    name (each entry navigates + opens the dot).
11. **Builder hero edit-in-place**. Hover/focus reveals an
    inline edit affordance on both the title and the
    description. Title commits live-sync the breadcrumb (and
    vice versa — both edit paths share one PATCH and one undo
    entry type). Description uses a multi-line input;
    placeholder "Add a short description" shows in the Builder
    when empty (visitor view shows nothing — covered by PROJ-11).
12. **Mobile Grid drawer**. Rotated layout: one row per cell
    (header strip with name + Input/Output pill + visibility
    chip + value/formula preview + kebab). Tapping a **cell**
    row focuses-expands it inline; the drawer shows only the
    expanded card with chevron-down to close. Tapping a
    **chart / text-block** row is a no-op in PROJ-9 (those
    rows don't exist yet) — the rule still gets specified so
    PROJ-15 / PROJ-16 don't have to re-architect the drawer.
13. **Undo / Redo enrollment**. Every cell mutation (add,
    edit any field, delete, rename, visibility/editability
    toggle, reorder) and section mutation (add, rename,
    description change, layout-pattern change, reorder, delete)
    pushes onto the PROJ-8 undo stack. Reorder operations push
    a single entry per drag (start position → end position).
14. **Server-side validation backstop**. Cell name pattern,
    reserved-word collision, name uniqueness per calculator,
    Input-readonly `value` required, Input-hidden `value`
    required are all enforced at the API. Formula structural
    errors (syntax / cycle / unknown_name) DO NOT block save —
    they surface as inline red-error treatment on the cell.
    They DO block Publish (PROJ-10's concern, via
    `getStructuralErrors`).

PROJ-9 ships **no charts**, **no text-blocks**, **no Tabular
renderer**, **no code-import**, **no publish flag**, **no
visitor view**. Those land in PROJ-15 / PROJ-16 / PROJ-17 /
PROJ-21 / PROJ-10 / PROJ-11.

## User Stories

- As a **registered user**, I want to click "+ Add" → Cell in the
  Builder toolbar (or use the between-cards seam, or the "+ add
  cell" affordance at the Grid right edge) and immediately get a
  new editable cell so I can keep building without an
  intermediate naming form.
- As a **registered user**, I want to flip a cell between Input
  and Output by changing one dropdown so I can iterate on the
  shape of my calculator without deleting and re-creating cells.
- As a **registered user**, I want to organise my calculator
  into named sections, with each section choosing a layout
  pattern from the active theme (e.g. one column, two columns,
  2/3 + 1/3), so my output groups feel intentional rather than
  one long stack.
- As a **registered user**, I want to hide an intermediate
  calculation cell from visitors while keeping it available to
  other formulas, so I can decompose my logic without polluting
  the visitor's view.
- As a **registered user**, I want renaming `loan_amount` to
  `principal` to also update every formula that referenced the
  old name so I don't have to chase down red-error cells by
  hand.
- As a **registered user**, I want to edit the calculator's
  hero title and description directly on the Builder canvas
  (hover-reveal, click-to-edit, blur-to-commit) so the
  authoring surface looks like the visitor view rather than a
  separate form.
- As a **registered user**, I want every change I make
  (visibility toggle, value edit, section rename, layout-pattern
  switch, cell add/delete) to be undoable with Cmd-Z so I can
  experiment freely.
- As a **registered user editing on a phone**, I want the Grid
  drawer to show me one cell per row and let me focused-expand
  any cell for inline edits so I can do real authoring work
  without leaving the mobile editor.
- As a **registered user**, I want a structurally broken formula
  (cycle, syntax error, reference to a cell I just deleted) to
  surface as a clear red-error on the cell — but not block me
  from saving the calculator — so I can keep iterating.

## Out of Scope

Everything below came up during the interview and is consciously
excluded from PROJ-9. References point to the feature that owns
the deferred work.

- **Charts** — the Chart `display_element` type, the chart
  configurator, the chart slot renderer, the chart-data picker.
  All PROJ-15. PROJ-9's `display_element` dispatch table has a
  `chart` branch that throws "not implemented" because the
  table is never populated with chart elements in P0.
- **Text-blocks** — PROJ-16. Same dispatch-table stub.
- **Tabular renderer** for `display_emphasis = tabular`. PROJ-17.
  PROJ-9 stores the enum value in the `cells` table from day
  one (forward-compat per INDEX.md). The emphasis picker in
  PROJ-9 hides Tabular as a choice; an Output cell whose
  formula evaluates to an array (with no explicit emphasis)
  auto-falls-back to a placeholder card reading "Array result
  — tabular display ships in v1.1".
- **Move element between sections** — drag a card from
  Section A into Section B. v1 supports drag-reorder *within*
  a section only. Cross-section moves are achievable by
  deleting and re-adding for now; surfaced as an Open
  Question for a follow-up if author research demands it.
- **Drag-drop between sections** of any kind (sections
  themselves CAN be drag-reordered; only their *children*
  can't cross section borders). PROJ-9 limitation.
- **Per-row drag-drop in the Grid panel.** The Grid surfaces
  cells in `display_order` and re-renders on `display_order`
  changes from the Builder, but the Grid itself doesn't host
  a drag-handle — there's only one logical data row, so the
  drag affordance lives on the Builder card.
- **Code-import** (paste a block of cells / formulas; Smart
  merge / Append / Replace all). PROJ-21. The sparkles
  Import button in the Grid panel header is hidden in PROJ-9.
- **Publish flag, share-token mint, public visitor URL.**
  PROJ-10 + PROJ-11. PROJ-9's `cells` and `sections` tables
  carry NO `published`/`public_token`/visibility-to-public
  columns; all visibility decisions are Builder-only.
- **Visitor view rendering.** PROJ-11. PROJ-9's Builder
  canvas is the only renderer of cells in P0. It must already
  match the visitor-view pixel rules (no hover affordances in
  resting state, hidden cells render dot in Builder + nothing
  on the visitor URL) so PROJ-11 can re-use the renderer.
- **Scenario save / load.** PROJ-12.
- **Sysadmin moderation** (User Calculators list, Move to Trash).
  PROJ-19.
- **Concurrent-editing 409 banner UX.** PROJ-20. PROJ-9 inherits
  PROJ-8's `updated_at` concurrency model on EVERY cell /
  section write (per spec line 575 — "Every write to any part
  of the calculator … goes through a path that also reads +
  increments the calculator's `updated_at` timestamp"). On 409,
  PROJ-9 surfaces the same generic toast PROJ-8 uses; PROJ-20
  replaces with the banner.
- **Soft-delete & Trash recovery** for cells / sections.
  PROJ-13's soft-delete model applies to **calculators**, not
  to their internals. Cell and section delete is **hard**
  immediately; the only delete-protection layer for them is
  Undo / Redo within the session.
- **Per-cell theme override** (e.g. "this cell uses theme X").
  Out of scope; the Card-level visual settings (Accent,
  Background tint, Border, Size hint) are the only per-cell
  visual overrides PROJ-9 supports — see spec lines 290-298.
- **Arbitrary CSS / per-cell custom styling** beyond the
  documented vocabulary. PRD-locked Non-Goal.
- **Auto-update of cell `name` from edits to `label`.** They are
  decoupled fields. Maintainer types the label freely; the
  initial sequential `cell_N` name stays until manually
  renamed. Decision logged below.
- **Free-form display names with quoted formula references**
  (e.g. `'Loan Amount'` à la Excel named ranges). PROJ-7 v2
  candidate — out of scope per the formula-engine spec.
- **Auto-`name` generation from `label`** (e.g. label "Loan
  amount" → name `loan_amount` on first save). Decoupled per
  decision below — manual rename is the only path.
- **Cell rename history / audit log.** Renames are one-shot
  via Undo. No persisted history.
- **Output cell that overrides another Output's value at
  visitor view** ("editable output" — visible row 5 of the
  Cell scenarios table in §2 of the spec). The data model
  supports it (`Output + editable`), but the visitor-side
  editable-output widget render is PROJ-11's concern. In
  PROJ-9 the option exists in the editability picker for
  Outputs; the visitor view will pick it up.
- **Column-width override** in the Grid panel. Grid columns
  use a fixed width that fits the longest label + value
  preview; no maintainer override.
- **Two-finger horizontal scroll** in the mobile Grid drawer.
  Rotated layout means cells stack vertically — no horizontal
  scroll to wrangle.
- **Section nesting** (a section inside another section).
  Sections are flat per spec line 800-801.
- **Pre-built calculator templates / starter content.** A new
  calculator starts with Section 1 only — empty. Starter
  content is a sysadmin-presets concern (PROJ-18).

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Database schema — `sections` table

- [ ] Given a fresh Supabase project at PROJ-9 HEAD, when the
  migration runs, then a `sections` table exists with these
  columns:
  - `id uuid primary key default gen_random_uuid()`
  - `calculator_id uuid not null references calculators(id) on delete cascade`
  - `title text not null default 'New section'`
  - `description text not null default ''`
  - `layout_pattern_id text not null default 'single_column'`
  - `display_order int not null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- [ ] Given the table is created, when an INSERT or UPDATE tries
  to write `title` with `length(trim(title)) > 100`, then a
  check constraint rejects the row (`length(trim(title)) <= 100`).
- [ ] Given the table is created, when `title` is empty after
  trim, then a check constraint rejects the row
  (`length(trim(title)) > 0`).
- [ ] Given the table is created, when the migration is
  inspected, then a UNIQUE constraint exists on
  `(calculator_id, display_order)` so reorders never produce
  duplicate ranks (reorder writes happen in a transaction that
  re-numbers).
- [ ] Given the table is created, when the migration is
  inspected, then an `updated_at` BEFORE-UPDATE trigger fires
  on every UPDATE, and a separate trigger bumps the parent
  `calculators.updated_at` on every INSERT / UPDATE / DELETE so
  PROJ-8's calculator-level optimistic concurrency catches
  section writes too.

### Database schema — `cells` table

- [ ] Given a fresh Supabase project at PROJ-9 HEAD, when the
  migration runs, then a `cells` table exists with these
  columns:
  - `id uuid primary key default gen_random_uuid()`
  - `calculator_id uuid not null references calculators(id) on delete cascade`
  - `section_id uuid not null references sections(id) on delete cascade`
  - `kind text not null check (kind in ('input', 'output'))`
  - `name text not null` — snake_case `[a-z][a-z0-9_]*`,
    max 40 chars
  - `label text not null default 'New cell'`
  - `description text not null default ''`
  - `description_render text not null default 'caption' check (description_render in ('caption', 'tooltip'))`
  - `value_type text not null check (value_type in ('number', 'currency', 'percent', 'date', 'boolean', 'select', 'text'))`
  - `visibility text not null default 'visible' check (visibility in ('visible', 'hidden'))`
  - `editability text not null check (editability in ('editable', 'readonly'))` —
    default 'editable' for inputs, 'readonly' for outputs (set at API)
  - `default_value jsonb` — null when no default; shape
    polymorphic on `value_type`
  - `formula text` — non-null when `kind = 'output'`
  - `display_widget text` — see Widget catalogue; null until set
  - `display_format text not null default 'auto'`
  - `display_emphasis text default 'plain' check (display_emphasis in ('plain', 'kpi', 'tabular'))`
  - `unit text` — optional unit suffix
  - `numeric_min numeric` / `numeric_max numeric` / `numeric_step numeric`
  - `select_options jsonb` — only for `value_type = select`,
    `[{ id, label }]`
  - `currency_code text` — only for `value_type = currency`,
    ISO 4217
  - `card_accent text not null default 'theme'` (`'theme' | accent_token_id`)
  - `card_background_tint text not null default 'none' check (card_background_tint in ('none', 'soft', 'strong'))`
  - `card_border text not null default 'none' check (card_border in ('none', 'hairline', 'strong'))`
  - `card_size_hint text not null default 'narrow' check (card_size_hint in ('narrow', 'wide', 'full'))`
  - `text_size text not null default 'm'`
  - `text_colour text not null default 'default'`
  - `display_order int not null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- [ ] Given the table is created, when an INSERT writes
  `kind = 'output'` with `formula = null`, then a check
  constraint rejects the row
  (`kind <> 'output' OR formula IS NOT NULL`).
  Note: empty-string formula IS allowed (so a freshly added
  Output cell with an empty formula is persistable) and surfaces
  as an `unknown_name` /  `syntax` error in the engine — see
  Save-time vs. Publish-time validation.
- [ ] Given the table is created, when a row tries to write a
  `name` not matching `^[a-z][a-z0-9_]{0,39}$`, then a check
  constraint rejects the write.
- [ ] Given the table is created, when two rows in the same
  calculator try to write the same `name`, then a UNIQUE
  constraint on `(calculator_id, name)` rejects the second row
  (case-sensitive — names are all lowercase per the regex).
- [ ] Given the table is created, when an INSERT writes
  `visibility = 'hidden'` AND `default_value IS NULL`, then a
  check constraint rejects the row — hidden cells MUST have a
  value per spec line 503.
- [ ] Given the table is created, when an INSERT writes
  `kind = 'input'` AND `editability = 'readonly'` AND
  `default_value IS NULL`, then a check constraint rejects the
  row — readonly Inputs MUST have a value per spec line 501-502.
- [ ] Given the table is created, when the migration is
  inspected, then a UNIQUE constraint exists on
  `(section_id, display_order)`.
- [ ] Given the table is created, when the migration is
  inspected, then an `updated_at` BEFORE-UPDATE trigger fires
  on every UPDATE, and a separate trigger bumps the parent
  `calculators.updated_at` on every INSERT / UPDATE / DELETE.
- [ ] Given Row-Level Security is enabled on both `sections`
  and `cells`, when a SELECT / INSERT / UPDATE / DELETE runs
  through a publishable-key client, then only rows whose
  parent `calculators.owner_id = auth.uid()` are accessible.
  RLS policies join on `calculators` to enforce ownership.
- [ ] Given the regenerated types file
  (`src/lib/supabase/types.ts`) is refreshed via
  `npx supabase gen types typescript --linked`, then
  `sections` and `cells` row types appear with the columns
  above and correct nullability.

### Theme registry — layout patterns

- [ ] Given the theme registry at PROJ-9 HEAD, when
  `getTheme(id)` is called for any of the 8 themes, then the
  returned object has a `layoutPatterns: LayoutPattern[]`
  field. `LayoutPattern` is
  `{ id: string; displayName: string; description: string; columns: number; columnSpans: number[] }`.
- [ ] Given any theme, when `layoutPatterns` is read, then it
  contains AT LEAST one entry whose `id === 'single_column'`,
  with `columns = 1` and `columnSpans = [1]`. Single-column is
  the universal fallback every theme must publish.
- [ ] Given the calcgrinder default theme, when
  `layoutPatterns` is read, then it contains
  `single_column`, `two_column` (`columnSpans = [1, 1]`), and
  `two_thirds_one_third` (`columnSpans = [2, 1]`). Other themes
  may publish their own catalogue; minimum is `single_column`.
- [ ] Given a section's stored `layout_pattern_id` is unknown
  for the active theme (e.g. the theme was switched and the
  pattern no longer exists), when the Builder renders the
  section, then it falls back to `single_column` and shows an
  inline banner on the section reading "Layout 'X' isn't
  available in this theme — using Single column.". Same
  EmptyOrErrorState pattern as PROJ-8's fallback-theme banner.
- [ ] Given the Builder is rendering a section with
  `layout_pattern_id = 'two_column'`, when the section has 3
  cells, then they flow into the two columns left-to-right,
  top-to-bottom (`columnSpans = [1, 1]` means two equal-width
  columns; cells 1 and 3 land in column A, cell 2 lands in
  column B — standard flexbox / CSS grid row-major flow).

### POST /api/calculators — default section side effect

- [ ] Given a signed-in user calls `POST /api/calculators` at
  PROJ-9 HEAD, when the calculator is created, then a default
  `sections` row is ALSO created in the same transaction with
  `title = 'Section 1'`, `description = ''`,
  `layout_pattern_id = 'single_column'`, `display_order = 0`.
- [ ] Given the POST response shape, when inspected, then the
  body adds a `default_section_id` field alongside the existing
  PROJ-8 fields (`id, title, description, theme_id, updated_at`).
- [ ] Given an existing calculator predates PROJ-9 (created in
  PROJ-8) and has no sections, when the editor loads it for
  the first time post-PROJ-9 deploy, then a backfill on
  first-load creates a default Section 1 transparently — no
  user prompt, no migration script needed at deploy time. The
  Editor route handler checks "rows in sections where
  calculator_id = :id" and inserts the default if zero.

### API — sections CRUD

- [ ] Given a signed-in user, when `POST /api/calculators/:cid/sections`
  is called with `{ title?, layout_pattern_id?, after_section_id? }`,
  then a new section is inserted with:
  - `title` defaulting to "New section",
  - `layout_pattern_id` defaulting to `'single_column'`,
  - `display_order` placed after `after_section_id` (or
    appended at the end if `after_section_id` is null).
  Response: HTTP 201 with the inserted row.
- [ ] Given a signed-in user, when `PATCH /api/sections/:id` is
  called with a body containing `{ title?, description?,
  layout_pattern_id?, display_order? }`, then those fields are
  updated. Same calculator-level `updated_at` echo + 409-on-
  stale rules as PROJ-8's calculator PATCH apply.
- [ ] Given a section has `display_order = 3` and the API
  receives `display_order = 0`, when the PATCH executes, then
  the database transactionally renumbers all sibling sections
  so display_order stays gap-free.
- [ ] Given a signed-in user calls `DELETE /api/sections/:id`,
  when the section has zero cells, then the section is
  hard-deleted and HTTP 204 is returned.
- [ ] Given a signed-in user calls `DELETE /api/sections/:id`
  with the `confirm_delete_with_children=true` query param,
  when the section has N cells, then the section and all its
  cells are hard-deleted in one transaction (FK CASCADE).
  Without the param, the API returns HTTP 409 with
  `{ error: 'section_not_empty', child_count: N }` so the
  client can show the destructive-confirm bottom sheet.
- [ ] Given a calculator has exactly one section and the user
  attempts to delete it, when the API processes the DELETE,
  then HTTP 422 is returned with
  `{ error: 'cannot_delete_last_section' }`. The Builder must
  always have at least one section; deleting the last section
  is rejected at the API and prevented in the UI.
- [ ] Given a signed-out / non-owner / soft-deleted-calculator
  target, when any section CRUD route is invoked, then HTTP
  404 is returned (same opacity rule as PROJ-8's calculator
  routes — never leak existence).

### API — cells CRUD

- [ ] Given a signed-in user, when
  `POST /api/sections/:sid/cells` is called with an empty body,
  then a new Input cell is inserted with:
  - `kind = 'input'`,
  - `name = 'cell_N'` where N is the next available integer
    for that calculator (the API computes this server-side by
    scanning existing names),
  - `label = 'New cell'`,
  - `value_type = 'number'`,
  - `visibility = 'visible'`,
  - `editability = 'editable'`,
  - `default_value = null`,
  - `display_format = 'auto'`,
  - `display_widget = 'number_field'`,
  - card-level visuals at their `default` values,
  - `display_order` appended at the end of the section.
  Response: HTTP 201 with the inserted row.
- [ ] Given a signed-in user, when `PATCH /api/cells/:id` is
  called with a body containing any subset of the writable
  fields (every cell column except `id`, `calculator_id`,
  `section_id`, `created_at`, `updated_at`), then those
  fields are updated. Standard calculator-level optimistic
  concurrency applies.
- [ ] Given the PATCH body changes `name` from `old_name` to
  `new_name`, when the request also includes
  `rewrite_dependents=true` (the default for the Builder
  client), then the server walks every Output cell on the
  calculator, computes the new formula via the formula engine's
  `getDependencies` + textual rewrite (regex on the cell
  name as a whole-word token), and writes the updated formulas
  in the same transaction. Response includes the list of
  rewritten cell IDs.
- [ ] Given the rename rewrite collides with an existing
  cell `name` on the same calculator, when the API checks the
  UNIQUE `(calculator_id, name)` constraint, then it returns
  HTTP 409 `{ error: 'name_collision', conflicting_cell_id }`.
  No partial write — the whole transaction rolls back.
- [ ] Given the PATCH body changes `kind` from `input` to
  `output` (or vice versa), when the API processes, then the
  swap is allowed only if:
  - input → output: `formula` is provided (empty string is OK),
    `default_value` is set to null, `editability` defaults to
    'readonly'.
  - output → input: `formula` is set to null,
    `default_value` is set to null, `editability` defaults to
    'editable'.
  Otherwise HTTP 422 with `{ error: 'invalid_kind_swap',
  reason }`.
- [ ] Given a signed-in user calls `DELETE /api/cells/:id`,
  when the cell is deleted, then dependent Output cells'
  formulas are NOT auto-rewritten — they will surface
  `unknown_name` errors via the engine, which is the visible
  signal to the maintainer that the deleted cell was load-
  bearing. (Confirmed product decision — see Decision Log.)
- [ ] Given a `POST` / `PATCH` writes a `name` that matches
  any entry in `RESERVED_WORDS` (formula function names + the
  literals `TRUE`/`FALSE`/`PI`/`E`/`EMPTY`), then HTTP 400
  is returned with
  `{ error: 'name_reserved', reserved_word }`.
- [ ] Given a `POST` / `PATCH` writes a `name` not matching
  `^[a-z][a-z0-9_]{0,39}$`, then HTTP 400 is returned with
  `{ error: 'name_invalid', pattern_description }`.
- [ ] Given a `POST` / `PATCH` writes `visibility = 'hidden'`
  on a cell with no `default_value`, then HTTP 422 is returned
  with `{ error: 'hidden_requires_value' }`.
- [ ] Given a `POST` / `PATCH` writes
  `kind = 'input', editability = 'readonly'` on a cell with no
  `default_value`, then HTTP 422 is returned with
  `{ error: 'readonly_input_requires_value' }`.
- [ ] Given a calculator has `MAX_CELLS = 200` cells already
  and `POST /api/sections/:sid/cells` is invoked, then HTTP
  422 is returned with `{ error: 'cell_cap_reached', max: 200 }`.
  (Cap exported from `@/lib/formula/limits.ts`.)
- [ ] Given a signed-in user calls reorder via
  `PATCH /api/cells/:id { display_order }`, when the new order
  conflicts with a sibling, then the same transactional
  renumber as sections applies. **Cross-section moves
  (`PATCH /api/cells/:id { section_id }`) are rejected with
  HTTP 422 `{ error: 'cross_section_move_unsupported' }`
  in v1** — drag is within-section only.

### Section management — UI

- [ ] Given the Builder canvas renders a section, when the
  pointer is outside the section, then no hover border, no
  toolbar — the section is pixel-identical to the visitor
  view's section render.
- [ ] Given the pointer hovers over the section area (the
  rectangle bounded by its header + cells), when hover starts,
  then a subtle ~1px dashed border appears on the section
  rectangle AND the section toolbar appears attached to the
  header (drag-handle + layout-pattern picker + delete-kebab).
- [ ] Given the section toolbar is visible, when the user clicks
  the title text in the header, then the title becomes an
  inline `<input>` pre-filled with the current title, with
  the text selected. Enter / blur commits via
  `PATCH /api/sections/:id`; Esc reverts; client-side enforces
  the 100-char cap with `maxLength`.
- [ ] Given the section toolbar is visible, when the user clicks
  the description text under the header, then it becomes a
  multi-line input. Enter inserts a newline; blur commits;
  Esc reverts. Empty description shows a faded "Add a
  description" placeholder while editing.
- [ ] Given the section toolbar is visible, when the user clicks
  the layout-pattern picker, then a small anchored popover lists
  all patterns from the active theme's `layoutPatterns` array.
  Each row: a small layout-pattern icon (rectangles representing
  `columnSpans`), the `displayName`, the `description`, with a
  checkmark on the currently-active pattern. Selection commits
  via PATCH and the section's cells re-flow to the new pattern
  within the same render pass.
- [ ] Given a section with at least one cell, when the user
  clicks the kebab and chooses "Delete section", then a
  destructive-confirm bottom sheet opens reading
  "Delete section «X»? Its N elements will be removed too."
  with Cancel + Delete buttons. Confirming sends
  `DELETE /api/sections/:id?confirm_delete_with_children=true`.
- [ ] Given a section with zero cells, when the user chooses
  "Delete section" from the kebab, then no confirm —
  `DELETE /api/sections/:id` fires immediately.
- [ ] Given the user attempts to delete the calculator's last
  section, when the menu opens, then "Delete section" is
  disabled with a tooltip "A calculator must have at least one
  section."
- [ ] Given a section has zero cells, when the Builder renders
  it, then a placeholder card appears reading "Drop elements
  here, or use + Add" — matches spec lines 812-816.
- [ ] Given the Builder is rendered and the user scrolls below
  the last section, when the scroll lands, then a persistent
  "+ Add section" button is visible immediately below the last
  section. Click → instantly POST a new section with defaults,
  scroll-into-view, pulse 600 ms.

### Section drag-reorder

- [ ] Given a section toolbar is visible, when the user
  grabs the drag-handle and drags vertically, then a drop
  indicator line shows between sections at the nearest valid
  drop point. Release → PATCH the section's `display_order`;
  the API transactionally renumbers siblings.
- [ ] Given a drag is in progress, when the user presses Esc,
  then the drag aborts and the section returns to its prior
  position.
- [ ] Given a section reorder commits, when it completes, then
  a single undo entry is pushed (start position → end
  position). Cmd-Z restores the prior order in one step.
- [ ] Given a drag is on touch, when the user long-presses
  the drag-handle for ~300 ms, then the drag activates (avoids
  accidental drags during scroll on mobile / tablet).

### Cell creation — three entry points

- [ ] Given the desktop Builder toolbar's "+ Add" picker is
  open, when the user clicks "Cell", then a new Input cell is
  created in the **last section** of the calculator (per spec
  line 819). The Grid column for the new cell expands inline,
  the Builder card scrolls into view with a 600ms accent
  pulse.
- [ ] Given the desktop Builder canvas's between-cards seam
  affordance is hovered (per spec lines 1619-1627), when
  the user clicks the "+", then the picker opens; choosing
  Cell creates a new Input cell at that seam (between the two
  cards). The section containing the seam owns the new cell.
- [ ] Given the desktop Grid panel's "+ add cell" affordance
  at the row's right edge is clicked, when processed, then
  a new Input cell is created in the last section (per spec
  line 823).
- [ ] Given a cell is created via any entry point, when the
  POST returns, then:
  - the Grid column for the new cell appears with the kebab
    expand already open (the cell card-expand state defaults
    to "open" for newly-created cells),
  - the Builder card scrolls into view (with hidden cells'
    dot if visibility happens to be hidden — though the
    default is visible),
  - undo stack receives one entry restoring the calculator
    to "before the add".
- [ ] Given a +Add Cell op runs while the section count is 0
  (impossible if the default-section backfill works, but
  defensive), when the API receives the POST, then HTTP 422
  is returned with `{ error: 'no_section' }`. Client surfaces
  a toast "Couldn't add cell — refresh and try again."

### Cell name validation (commit-time)

- [ ] Given the Grid kebab-expand exposes the cell `name`
  input, when the user types a value containing uppercase
  letters or non-`[a-z0-9_]` characters, then the input
  surfaces an inline error below the field reading "Lowercase
  letters, digits, and underscores only. Must start with a
  letter." and prevents commit (Enter / blur ignores the bad
  value, keeps the field focused).
- [ ] Given the user types a name longer than 40 chars, when
  the input is inspected, then `maxLength={40}` blocks
  further keystrokes.
- [ ] Given the user commits a name matching a `RESERVED_WORDS`
  entry, when the server returns 400 `name_reserved`, then
  the client surfaces the error inline reading "`pmt` is a
  built-in function — pick another name." (The exact
  message is `<name> is a built-in function — pick another
  name.`)
- [ ] Given the user commits a name that collides with another
  cell on the same calculator, when the server returns 409
  `name_collision`, then the client surfaces "A cell named
  `<name>` already exists." with the field staying focused.

### Cell rename (silent dependent rewrite)

- [ ] Given a cell `loan_amount` exists and three Output
  cells reference it in their formulas, when the user renames
  it to `principal`, then on commit the API rewrites all three
  dependents' `formula` columns in the same transaction. The
  client refreshes their displayed formulas without a reload.
- [ ] Given the rename API call succeeds, when the undo stack
  is inspected, then ONE undo entry covers the rename + all
  dependent rewrites. Cmd-Z restores `loan_amount` AND all
  three formulas to their prior text in one step.
- [ ] Given the rename references a cell mentioned inside a
  lambda body (e.g. `=MAP(SEQUENCE(n), i => i * old_name)`),
  when the rewrite runs, then `old_name` inside the lambda is
  replaced too — the rewrite is by whole-word regex on the
  entire `formula` text. (Lambda parameters with the same name
  as the renamed cell are not rewritten — see Edge Cases.)
- [ ] Given the rename rewrite would produce a formula longer
  than the engine's 2000-char limit (e.g. the new name is much
  longer than the old), when the server detects the overflow,
  then HTTP 422 is returned with
  `{ error: 'formula_too_long_after_rewrite', affected_cell_ids }`,
  the whole transaction rolls back, the rename is rejected at
  the client with a toast "Rename would exceed formula length
  limit."

### Grid panel — column rendering & data-row content

- [ ] Given the editor renders with N cells in the calculator,
  when the Grid panel is inspected, then there are exactly N
  columns in section-then-`display_order` order. Cell columns
  show: header strip (name + Input/Output pill + visibility
  chip + kebab) + data-row (value preview for Inputs, formula
  text for Outputs).
- [ ] Given an Input cell is in the Grid, when its data-row is
  clicked, then the row becomes an inline editor matching the
  cell's `value_type` (number field, date picker, toggle, etc.
  — see Widget catalogue). Enter / blur commits via PATCH.
- [ ] Given an Output cell is in the Grid, when its data-row is
  clicked, then the row becomes a `<input type="text">`
  pre-filled with the formula. Commits on blur or Enter. Esc
  reverts. Live preview in the Builder does NOT update until
  commit (spec lines 544-547 — half-typed formulas don't
  trigger recompute).
- [ ] Given a formula commit results in a structural error
  (`syntax`, `cycle`, `unknown_name`), when the engine returns
  the error, then the Grid data-row shows the formula text
  with red underline + a `?` icon. Hover/focus shows the
  engine's plain-English error message in a tooltip.
- [ ] Given the kebab on a cell column header is clicked, when
  it activates, then the column header expands downward
  in-place (all columns gain matching height to keep the
  data row aligned per spec line 1889-1890), revealing the
  data-model settings panel: `name`, `label`, `value_type`,
  `visibility`, `editability`, `description` (text + render
  toggle caption/tooltip), `default_value` (Inputs only),
  `formula` (Outputs only), numeric constraints
  (`unit`, `min`, `max`, `step` for numeric types),
  `select_options` (for select), `currency_code` (for
  currency).
- [ ] Given the expand panel is open, when the user changes any
  setting control (toggle, dropdown), then the change PATCHes
  immediately (incremental-save model — spec line 512-514).
  When the user types in a text input (name, label,
  description, formula, default_value), the commit is on
  blur / Enter (spec line 515-516).
- [ ] Given the expand panel is open and a click happens on the
  kebab again (or the chevron-up at the panel's bottom edge),
  when registered, then the column collapses.
- [ ] Given the Grid panel header strip is inspected, when its
  components are listed, then it contains in reading order:
  the Grid-collapse chevron (from PROJ-8), no Import button
  (sparkles — hidden in PROJ-9 per Out of Scope), the "+ add
  cell" affordance at the right edge.

### Builder card surface

- [ ] Given a section has N visible cells, when the Builder
  renders the section, then each cell renders as a card in the
  active theme's cell card style (typography, widget rendering
  for Inputs, value-formatted-with-emphasis for Outputs). The
  card layout reflects card-level visuals (background tint,
  border, accent, size hint) and cell-specific visuals (text
  size, text colour, widget choice).
- [ ] Given the pointer hovers over a cell card, when hover
  starts, then a drag-handle (top-left corner) and an
  edit-icon (top-right corner) become visible. Neither
  consumes layout space in the resting state.
- [ ] Given the drag-handle is grabbed, when the user drags
  the card up/down within the section, then a drop-indicator
  line shows between sibling cards. Release → PATCH
  `display_order`. Cross-section moves are forbidden (spec
  decision); the drop indicator does NOT light up when the
  drag enters another section.
- [ ] Given the edit-icon is clicked, when activated, then the
  card grows downward in place to host the visual-presentation
  settings panel. Layout shifts (this expand is by-design;
  spec line 1662-1666).
- [ ] Given the visual-presentation panel is open, when its
  controls are inspected, then it contains:
  - Card-level: Accent (theme-palette swatch picker),
    Background tint (None / Soft / Strong segmented),
    Border (None / Hairline / Strong segmented),
    Size hint (Narrow / Wide / Full segmented).
  - Cell-specific: Display widget (segmented control listing
    only widgets valid for the cell's `value_type` — see
    Widget catalogue), Display format (dropdown — see Format
    catalogue), Text size (4 presets: S/M/L/XL), Text colour
    (Default / Accent 1 / Accent 2, restricted to the active
    theme's palette).
  - Output-only additions: `display_emphasis` picker (Plain /
    KPI — Tabular is hidden from the picker per Tabular
    fall-back). KPI exposes optional sub-settings (inline
    sparkline toggle, delta-vs-target picker, status-pill
    picker).
- [ ] Given the panel is open, when the user changes any
  control, then PATCH fires immediately (incremental save).
  No Save / Cancel buttons.
- [ ] Given the panel is open, when the chevron-down at the
  panel's bottom-right is clicked, then the panel collapses
  in place.

### Hidden cells — 0-height dot + toolbar pill

- [ ] Given a cell has `visibility = 'hidden'`, when the
  Builder renders the section, then no cell card appears in
  the slot stream. Instead, a small ~6px glowing accent dot
  appears at the **between-cards seam** position (per spec
  lines 1603-1610) — visually overlaid, consuming 0 vertical
  space.
- [ ] Given multiple hidden cells exist in sequence, when
  the Builder renders, then the dots cluster at the seam with
  ~4px horizontal spacing between them. Each dot is
  individually targetable (own click handler, own aria-label
  `Hidden cell: <name>`).
- [ ] Given a hidden-cell dot is clicked, when activated, then
  the dot is replaced (at the same position) by the cell's
  full Grid kebab-expand panel (data-model settings) inline
  in the Builder, AND the Builder card for the cell renders
  in-place above the panel (temporarily promoted to visible
  for editing). Closing the expand (chevron-down or kebab
  toggle) collapses back to the dot.
- [ ] Given any cell on the calculator has `visibility =
  'hidden'`, when the Builder toolbar renders, then the
  "X hidden cells" pill becomes visible (PROJ-8 left it
  hidden because count was always 0). Pill text:
  `X hidden cell` (singular when X = 1) / `X hidden cells`
  (plural).
- [ ] Given the pill is clicked, when the popover opens, then
  it lists all hidden cells by `label` (falling back to `name`
  if no label). Each row click navigates the Builder canvas
  to the corresponding dot (scrolls into view) and pops the
  dot open as if clicked.
- [ ] Given the user toggles a cell from visible → hidden via
  the Grid panel's visibility control, when the PATCH commits,
  then within the same render pass the Builder removes the
  card and renders the dot at the new position. The toolbar
  pill count increments.

### Builder hero edit-in-place

- [ ] Given the Builder canvas is rendered, when the user
  hovers over the calculator's hero title, then a small
  edit-affordance (pencil glyph) appears beside it without
  shifting the title's position.
- [ ] Given the hero title is clicked, when activated, then
  the title becomes an inline `<input>` styled with the active
  theme's hero typography (matching font, size, weight,
  colour). Enter / blur commits via the same PATCH endpoint
  PROJ-8 used for the breadcrumb rename. Esc reverts.
- [ ] Given the hero title is edited, when the PATCH commits,
  then the breadcrumb segment in the top-bar re-renders to
  the new title within the same render pass (and vice-versa
  — the breadcrumb rename also updates the hero).
- [ ] Given both the hero and the breadcrumb commit to the
  same undo entry type, when Cmd-Z is pressed, then a
  single undo step reverts whichever was the most recent
  commit. (No double-entry from the two surfaces.)
- [ ] Given the Builder canvas is rendered and the
  calculator's `description` is empty, when the hero block is
  inspected, then a faded "Add a short description"
  placeholder is visible below the title (Builder-only —
  PROJ-11's visitor view shows nothing for empty
  descriptions).
- [ ] Given the description placeholder (or any non-empty
  description text) is clicked, when activated, then it
  becomes a multi-line `<textarea>` styled with the theme's
  description typography. Blur commits; Enter inserts a
  newline (unlike the title); Esc reverts.

### Save-time vs. Publish-time validation

- [ ] Given the user commits a formula that the engine reports
  as a structural error (`syntax` / `cycle` / `unknown_name`),
  when the PATCH executes, then the save SUCCEEDS — broken
  formulas are persisted as-is. The Builder card surfaces
  the spec-mandated red-border + error-message treatment
  (spec lines 553-556). The Grid data-row shows red-underline
  + tooltip.
- [ ] Given the calculator has any structural error, when the
  Builder header is inspected, then the "Publish" button
  area is NOT touched by PROJ-9 — Publish gating is PROJ-10's
  concern via `getStructuralErrors`. (PROJ-9 just persists
  errors and renders them; PROJ-10 enforces publish-time
  blocking.)
- [ ] Given a runtime error surfaces on an Output cell
  (`divide_by_zero` / `wrong_type` / `out_of_range`), when
  the Builder card renders, then it shows the engine's
  plain-English error message in place of the value, in the
  same red-treatment as structural errors. Difference between
  structural and runtime is invisible to the maintainer at
  the cell-card level — only PROJ-10's Publish button
  surfaces the distinction.

### Tabular fall-back (forward-compat to PROJ-17)

- [ ] Given an Output cell's formula evaluates to
  `shape = 'array_of_scalars'` or `'array_of_objects'`, when
  no explicit `display_emphasis` is set (i.e. still the
  default `'plain'`), then the Builder card renders a
  placeholder reading "Array result — tabular display ships
  in v1.1." (spec auto-fallback adapted for P0).
- [ ] Given the same cell, when the maintainer opens its
  emphasis picker, then the picker shows ONLY Plain + KPI
  (Tabular is omitted from the choices — the enum value still
  exists in the DB schema for PROJ-17 forward-compat).
- [ ] Given the cell's emphasis is manually set to `kpi`
  while the formula returns an array, when the Builder
  renders, then the KPI variant renders the first scalar of
  the array's first row (best-effort) with a tooltip
  "Array result — first value shown" rather than the
  placeholder. (Allows the maintainer to opt out of the
  v1.1 placeholder if they want.)

### Mobile — Grid drawer rotation & focused-expand

- [ ] Given the mobile editor is rendered with N cells, when
  the Grid drawer is opened, then it shows N rows (one per
  cell) in section-then-`display_order` order. Each row:
  drag-handle + name + Input/Output pill + visibility chip +
  value/formula preview (truncated) + kebab.
- [ ] Given the drawer shows the row list, when the user
  taps a cell row's body (not the kebab), then the drawer
  enters focused-expand mode: only the tapped cell's row is
  visible, expanded to show the data-model settings panel
  (same content as desktop's Grid kebab-expand). All other
  rows collapse out of view.
- [ ] Given focused-expand is active, when the user taps the
  chevron-down at the expanded card's top-right (or the
  kebab again), then the drawer returns to the list-of-all-
  cells view at the same scroll position the user was at
  before expanding.
- [ ] Given the drawer is in focused-expand mode, when the
  drawer's height is checked, then it caps at 70% of the
  viewport (per spec line 1647-1649). The expanded card
  scrolls internally if its content exceeds the cap.
- [ ] Given the drawer is open and the user taps OUTSIDE the
  drawer (on the Builder canvas above), then the drawer
  slides down — same as the toggle behaviour PROJ-8 shipped.
  Any in-progress focused-expand state is discarded;
  re-opening shows the list view.

### Live sync between Grid and Builder

- [ ] Given the user edits a cell's `default_value` in the
  Grid, when blur commits the PATCH, then within the same
  render pass the Builder card re-renders with the new value
  (Input widgets re-render; dependent Output cells trigger an
  engine recompute pass and re-render).
- [ ] Given the user toggles a cell from `visible` → `hidden`
  in the Grid, when the PATCH commits, then within the same
  render pass the Builder card disappears and the dot appears
  at the seam.
- [ ] Given the user re-orders cells by dragging in the
  Builder, when the drop commits, then within the same
  render pass the Grid columns re-order to match.
- [ ] Given the user changes a card-level visual setting
  (Accent / Background tint / Border / Size hint) in the
  Builder card's edit panel, when the PATCH commits, then the
  Grid panel is **not** affected — visual settings don't
  surface in the Grid (per spec line 1891-1895 — Grid is
  data-model only).
- [ ] Given the user renames a cell in the Grid, when the
  rename commits, then within the same render pass every
  rewritten Output cell's formula text re-renders in the
  Grid AND every Output Builder card re-renders its value
  (engine re-runs against the rewritten formulas).

### Undo / Redo enrollment

- [ ] Given any of the following operations commits, when
  the operation succeeds, then exactly one undo entry is
  pushed onto PROJ-8's session-scoped undo stack:
  - cell add
  - cell delete
  - cell `name` rename (including all silent dependent
    rewrites — single entry per rename)
  - cell `label` / `description` / `description_render` edit
  - cell `value_type` change
  - cell `default_value` / `formula` edit
  - cell `visibility` / `editability` toggle
  - any card-level visual setting change
  - any cell-specific visual setting change
  - cell reorder (single entry per drag, from start → end
    position)
  - section add
  - section `title` / `description` rename
  - section `layout_pattern_id` change
  - section reorder
  - section delete (with or without children)
- [ ] Given an undo restores a delete, when the entry pops,
  then the original `id` is restored (the API supports
  `POST /api/sections/:cid/sections` and `POST /api/sections/:sid/cells`
  accepting an optional `id` for undo-driven recreates; if
  the id is taken — concurrent admin moved on — fall back to
  a new uuid).
- [ ] Given Cmd-Z is pressed while a Grid / Builder input is
  focused, when the keystroke is intercepted, then native
  input-undo wins. Editor-level undo only fires when no
  editable surface has focus (same rule PROJ-8 set).

### +Add picker state in PROJ-9

- [ ] Given the Builder toolbar's "+ Add" picker is opened in
  PROJ-9, when its options are inspected, then **Cell** and
  **Section** are enabled (PROJ-8 had them visible-but-
  disabled). **Chart** and **Text block** stay disabled with
  the same v1.1 tooltips PROJ-8 wired.
- [ ] Given the Cell option is clicked, when registered, then
  the new-cell flow per "Cell creation — three entry points"
  fires. Placement: last section.
- [ ] Given the Section option is clicked, when registered,
  then a new section is created (appended after the last
  section), the Builder scrolls it into view with a 600 ms
  pulse, and its title field opens for inline rename
  (focused, pre-selected).

## Edge Cases

- **Formula references a cell that gets renamed inside a
  lambda parameter.** Example: cell `i` is renamed to
  `index`, while an Output cell has
  `=MAP(SEQUENCE(n), i => i * 2)`. The lambda's `i` parameter
  is locally bound — the rewrite must NOT rewrite the `i`
  inside the lambda body. Implementation: the rewrite walks
  the AST (not just regex on the raw string) and skips
  identifiers shadowed by lambda parameters. AST walk lives
  in the formula engine; PROJ-9 calls it via a new
  `rewriteFormulaReference(formula, oldName, newName)` helper
  on `@/lib/formula`.
- **Renaming creates a collision with a future rewrite.**
  Example: cell `a` is renamed to `b`, where `b` exists.
  Server returns 409 `name_collision` before any write — the
  whole transaction rolls back. UI shows the rename input as
  invalid with the spec-error message.
- **Renaming a cell whose new name is too long after
  rewrites.** If `loan` → `super_long_loan_amount_name` makes
  some Output formula exceed 2000 chars, the API returns
  422 `formula_too_long_after_rewrite`. Same rollback.
- **Reserved-word rename via API direct call (no UI).** The
  reserved-word check lives on the server. Even an API client
  that bypasses the UI cannot persist `pmt` as a cell name —
  the check constraint via RESERVED_WORDS is enforced server-
  side (the constraint lives in app code, not in the
  database, because PostgreSQL has no awareness of the
  formula engine; the API rejects pre-write).
- **Hidden cell with formula that errors.** A hidden Output
  cell with a `cycle` error still surfaces in the engine's
  per-cell results; its error propagates to visible dependents
  via `↑ depends on …` (spec line 192-194). The hidden dot
  gets a small red accent ring; the toolbar pill includes a
  red ring around its count badge when any hidden cell has
  an error.
- **Cell drag attempted from Section A to Section B.** Drop
  indicator stays grey/disabled when the drag pointer enters
  another section. Release in a foreign section drops the
  drag (no PATCH fires); the card snaps back to its origin.
  Tooltip on first attempt: "Cross-section moves aren't
  supported yet." (Disappears after first interaction —
  not persistent.)
- **Section with all cells hidden.** Renders as an empty
  section in the Builder (the dots cluster at the seam
  between header and the "Drop elements here" placeholder).
  Visitor view (PROJ-11) renders just the section header +
  description, nothing else (no placeholder bleed-through).
- **Last visible cell is hidden.** Cell card disappears; dot
  appears. If this was the only cell in a section, the
  section's empty-state placeholder appears below the dot.
- **Cell deleted while a Builder visual-settings panel is
  open for it.** The Builder card unmounts (cascade from the
  delete); the panel unmounts too. Undo restores both panel-
  closed state and the cell.
- **Calculator's only section is the default "Section 1" and
  the user renames it to empty.** The 100-char `length(trim) > 0`
  constraint rejects; the inline rename input stays focused
  with the shake/border-red treatment from PROJ-8. Esc
  reverts to whatever the prior name was (even if that's still
  the default "Section 1").
- **Layout pattern picker for a section in a calculator
  whose theme has changed and removed the previously-selected
  pattern.** The Builder renders the section in `single_column`
  with the inline fallback banner. The picker remains usable —
  selecting any of the new theme's patterns clears the banner.
- **Hidden cell promoted to visible (`visibility = visible`)
  while at the seam between two visible cards.** The dot
  vanishes; a new card slides into the slot at the
  `display_order` position. If two hidden cells were
  clustered at one seam and only one is promoted, the
  remaining one's dot stays.
- **Concurrent rename collision via 409 from another tab.**
  Tab A renames `loan` → `principal`. Tab B (open since
  before A's change) renames `loan` → `amount`. Tab B's PATCH
  hits a 409 (calculator's `updated_at` has advanced since
  tab B's last read). The generic toast appears; the rename
  visually persists in B's local state but won't save. PROJ-20
  replaces the toast with the banner.
- **+Add Cell hits the 200-cell cap mid-session.** API returns
  422 `cell_cap_reached`; client surfaces a toast "200-cell
  limit reached. Delete a cell to add more." Picker stays
  open so the user can immediately retry after deleting.
- **Cell name reserved-word check happens while the formula
  engine is being upgraded.** RESERVED_WORDS is loaded
  statically from `@/lib/formula`; same code path the engine
  uses internally. There's no drift window.
- **User edits the formula of an Output cell whose result
  type is array, then switches it to KPI.** The KPI card
  renders the first scalar of the array with the "Array
  result — first value shown" tooltip (per Tabular fall-back
  rule).

## Widget catalogue

Default widget per `value_type` (used on +Add Cell with no
explicit choice):

| value_type | Default widget | Other valid widgets |
|------------|---------------|----------------------|
| number | `number_field` | `slider`, `stepper` |
| currency | `number_field` | `slider`, `stepper` |
| percent | `number_field` | `slider`, `stepper` |
| date | `date_picker` | — (only one widget in v1) |
| boolean | `toggle_switch` | `radio_pair` |
| select | `dropdown` | `radio_buttons` |
| text | `text_field` | — (only one widget in v1) |

Constraints:
- `slider` requires `numeric_min` and `numeric_max`. If not
  set, the widget picker disables this option with a tooltip
  "Set min and max in the Grid to use a slider."
- `stepper` requires `numeric_step`. Same tooltip pattern.
- `select` requires at least one entry in `select_options`.
  Otherwise picker disabled.

The widget picker in the Builder card's visual-settings panel
filters per cell type; the user only sees the rows valid for
the cell's `value_type`.

## Format catalogue

`display_format` values, applied to the rendered output (not
to data):

- `auto` (default) — picks a sensible format from `value_type`:
  number → integer-or-decimal-as-typed; currency → currency
  with `currency_code`; percent → 0.00%; date → locale-default
  short date; boolean → "Yes / No"; text → as-is.
- `number_integer` — 1,234
- `number_decimal_2` — 1,234.56
- `number_decimal_4` — 1,234.5678
- `currency` — uses `currency_code`, theme-default precision
- `percent_0` — 12%
- `percent_2` — 12.34%
- `date_short` — 23 May 2026
- `date_long` — Saturday, 23 May 2026
- `text_plain` — passes through

Currency formatting uses ISO 4217 codes via the browser's
`Intl.NumberFormat`. No locale picker in v1 (PRD-locked
English-only).

## Open Questions

- [ ] **Cross-section move (drag a cell from Section A to B).**
  The current decision is "out of scope — delete + re-add".
  If author research shows real friction, reopen as a follow-
  up. Architecturally the move is an API addition only —
  Builder drag-and-drop infrastructure already exists.
- [ ] **Auto-generate `name` from `label`.** The current
  decision is "decoupled — sequential `cell_N` names, manual
  rename only." This was an interview decision; revisit if
  authors find sequential naming a pain in usability testing.
- [ ] **Behaviour on output `kind` swap.** Currently the
  swap nulls `default_value`. An alternative would be to
  keep `default_value` and treat it as a hidden constant
  fallback. Defer to v1 author feedback.
- [ ] **Cell `description` rich-text.** Currently plain text
  for both caption and tooltip rendering. If authors want
  markdown in descriptions, reopen — but Text-blocks
  (PROJ-16) cover the rich-prose case.
- [ ] **Hidden-cells popover sort order.** Currently insertion
  order. Could be alphabetised by name. Defer to feedback.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Keep PROJ-9 as one spec covering both cell authoring and section management | Cells need a section to live in; sections without cells deliver no user value. Splitting would mean shipping incomplete halves. Matches the INDEX.md roadmap entry. | 2026-05-23 |
| All 7 cell `value_type`s ship in PROJ-9 (number, currency, percent, date, boolean, select, text) | Matches the spec verbatim and matches what the formula engine already supports. Trimming would leave visible "ships later" gaps in the visitor view. | 2026-05-23 |
| +Add Cell creates an Input cell with sequential default name (`cell_N`), label "New cell", number type, no value, then expands inline for editing | No intermediate naming form. Matches the incremental-save model PROJ-8 set up. Single picker click → editable cell in one step. | 2026-05-23 |
| Rename-with-update is silent — all dependent formulas rewritten transparently in one transaction, one undo entry | Friendliest UX; one Cmd-Z restores everything if surprising. Confirm dialog would interrupt the rename flow for the common case (most renames have dependents). Trade-off: lose the audit trail; mitigated by Undo. | 2026-05-23 |
| Section layout patterns ship in PROJ-9; PROJ-6 theme registry is extended to publish per-theme `layoutPatterns` | The spec mandates a section layout-pattern picker. Deferring means sections are one-column-only in P0, which makes calculators with 6+ cells look like a wall of stacks. Worth the extra surface to ship multi-column authoring at v1. | 2026-05-23 |
| `display_emphasis = tabular` enum value exists in the DB from day one; the picker UI hides it; auto-fallback for array-returning cells with default emphasis renders a placeholder "Array result — tabular display ships in v1.1." | Forward-compat per INDEX.md (no schema migration needed for PROJ-17). Hiding from the picker keeps the P0 surface honest — maintainers don't get told they can pick a render mode that doesn't work yet. | 2026-05-23 |
| Hidden cells get the full spec UX in PROJ-9: 0-height accent dots, click-to-expand inline, builder-toolbar pill with anchored popover | Half-shipping (dot only, no pill) would leave a discoverability hole. Half-shipping (Grid-only, no dot) would silently break the "Builder mirrors the visitor view" pixel-identity rule the spec depends on. | 2026-05-23 |
| Cell `name` is decoupled from `label` — no auto-snake_case generation. Default name is sequential `cell_N` at create time; manual rename only. | Auto-from-label is fragile (label changes shouldn't break formulas; what character replacement to use?). Sequential names + manual rename matches author expectations from spreadsheets where the displayed name is the formula identifier. Tracked as an Open Question to revisit. | 2026-05-23 |
| Cell delete does NOT auto-rewrite dependent formulas — they surface `unknown_name` errors via the engine | Delete is a destructive op; the visible red-error is the maintainer's signal that they removed a load-bearing cell. Silent stub-substitution (e.g. replace with `0`) would hide bugs. Undo brings the cell back. | 2026-05-23 |
| Cross-section cell drag is out of scope in v1; drag-reorder is within-section only | Cross-section drag adds drop-target complexity (sections might be collapsed, hidden behind layout patterns); the value is marginal because the maintainer can rename or re-add. Tracked as Open Question. | 2026-05-23 |
| Last-section delete is rejected at the API (422 `cannot_delete_last_section`) | A calculator without sections has no place for cells to live; the default-section backfill would just re-create one anyway. Cleaner to reject at the API and show the UI as a disabled menu item. | 2026-05-23 |
| Default Section 1 created in the same transaction as the calculator (POST /api/calculators side effect) | Avoids the "fresh calculator has no sections" race; means PROJ-9 doesn't need a separate "ensure default section" UI step. Backfill on first-load handles PROJ-8 calculators created before PROJ-9 deploy. | 2026-05-23 |
| Cell creation defaults to Input kind (not Output) | Most calculators start with inputs (the visitor types values) and grow outputs around them. Output-default would lead to the awkward "first cell has no formula, save fails" path. | 2026-05-23 |
| Save-time validation enforces only structural integrity (name pattern, reserved word, name uniqueness, required value on readonly/hidden input). Formula structural errors persist as data; Publish gating (PROJ-10) blocks publication | Lets the maintainer save mid-iteration without fighting the form. Red-error treatment makes broken formulas visible without preventing further editing. Mirrors how spreadsheets behave. | 2026-05-23 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Two new tables (`sections`, `cells`) rather than a JSON content column on `calculators` | Per-row constraints (cell-name uniqueness per calculator, display_order uniqueness per section) need real columns; per-cell PATCH avoids rewriting the whole content on every edit. | 2026-05-23 |
| RLS on `sections` and `cells` joins through `calculators` rather than duplicating `owner_id` | Single source of truth for ownership; cascade on calculator delete already cleans up everything via FK. Cost: a JOIN per row check, acceptable at v1's volume. | 2026-05-23 |
| Parent-bump trigger on every cell / section INSERT, UPDATE, DELETE | Keeps PROJ-8's calculator-level optimistic concurrency model intact — one `updated_at` per calculator catches concurrent edits at any granularity. No per-cell version surface to track. | 2026-05-23 |
| Default Section 1 created in the same transaction as the calculator (`POST /api/calculators` side effect) plus a first-load backfill for older calculators | Avoids a "no sections" intermediate state without a separate deploy-time migration. Backfill is a single SELECT-then-INSERT in the editor's RSC loader. | 2026-05-23 |
| Editor loader fetches calculator + sections + cells in one server-side pass | Client mounts hydrated; no client-side waterfall for first paint. Subsequent mutations PATCH through the existing REST surface. | 2026-05-23 |
| Formula engine runs client-side against the in-memory cells slice on every change; computed values are never persisted | Authors expect spreadsheet-style live recompute. Persisting computed values would invalidate them on every input edit. PROJ-11 will run the engine server-side for the visitor view; PROJ-9 doesn't need to. | 2026-05-23 |
| New AST-aware helper `rewriteFormulaReference(formula, oldName, newName)` lives in `@/lib/formula`, not in PROJ-9 | The formula engine already owns the AST + lambda-parameter-shadowing logic. Co-locating the rewrite there keeps a single team responsible for "what counts as a reference to a name". | 2026-05-23 |
| `@dnd-kit` (core + sortable + utilities) for both section and cell drag-reorder | Accessible by default (keyboard handlers built in), touch sensor configurable to the spec's 300ms long-press, ~10KB core. `react-beautiful-dnd` is deprecated; rolling our own touch DnD is a multi-week project. | 2026-05-23 |
| REST endpoints (`/api/calculators/:cid/sections`, `/api/sections/:id`, `/api/sections/:sid/cells`, `/api/cells/:id`) over server actions | Matches PROJ-8's existing write path — same auth/Zod/404-opacity/409-stale shape, same test harness. Server actions would split the editor's writes across two patterns. | 2026-05-23 |
| Reserved-word collision is an API-side check, not a DB constraint | PostgreSQL has no awareness of the formula function table. The API loads `RESERVED_WORDS` from `@/lib/formula` and rejects pre-write; same code path the engine uses, no drift window. | 2026-05-23 |
| `display_emphasis = tabular` enum value lives in the DB schema from day one even though the picker hides it | Adding the value later would mean a coordinated schema migration + deploy. Adding it now is a three-character check-constraint change; cost-free. | 2026-05-23 |
| `layoutPatterns` published per-theme in the theme bundle, not in a `layout_patterns` DB table | Themes are code-shipped; patterns belong to themes. A DB table would mean every cell render reads from Postgres for column counts. Theme bundles are imported at build time, zero DB cost. | 2026-05-23 |
| Theme-mismatched `layout_pattern_id` falls back to `single_column` with an inline banner, not a destructive rewrite of the section's stored pattern | Stored patterns are author intent — switching themes shouldn't silently lose that intent. Falling back to `single_column` on render + banner-prompting the author to re-pick respects undo + theme-roundtrip. | 2026-05-23 |
| Cell mutations attach to the existing PROJ-8 `EditorStore` slice; the same `recordOperation` helper enrolls them into the undo stack | One undo stack covers everything an author can do. No second history mechanism to keep coherent with the first. Slice shape is additive — PROJ-8's calculator slice stays byte-identical. | 2026-05-23 |
| Hidden-cells UI ships dot + toolbar pill + popover together; not staged across patches | The dot keeps Builder ↔ visitor-view pixel-identical (a PROJ-11 contract); the pill is the only discoverability surface for cells the author can't see in the slot stream. Half-shipping either breaks an invariant. | 2026-05-23 |
| Cross-section cell drag rejected at the API (`HTTP 422 cross_section_move_unsupported`) in v1 | Saves drop-target modelling across collapsed/scrolled-off-screen sections; the maintainer can delete + re-add. Tracked as an Open Question — re-architecturally cheap to add later (API-only addition). | 2026-05-23 |
| All cell + section edits commit incrementally (no Save/Cancel buttons); toggles PATCH on change, text inputs PATCH on blur / Enter | Matches PROJ-8's incremental-save model; no draft state to model, no abandoned-draft cleanup. Optimistic concurrency catches concurrent edits regardless of grain. | 2026-05-23 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Where this feature fits

PROJ-9 is the **content layer** of the Editor. PROJ-8 shipped
the chrome (two-panel split, toolbar, calculator-level rename,
session-scoped undo, theme picker). PROJ-9 fills both panels
with the things authors actually edit: **sections** (named
layout containers) and **cells** (the data-model rows). Every
piece of new behaviour attaches to a seam PROJ-8 left open —
the empty Grid body, the empty Builder slot stream, the
disabled "Cell"/"Section" entries in the + Add picker, the
0-count "hidden cells" pill, the read-only calculator hero.

There is **no new page**. The editor route at
`/editor/<id>` keeps its current shape; it just loads two
additional row sets (sections + cells) and renders them.

### Component structure (visual tree)

PROJ-9 adds the boxed-in subtrees below. Everything else is
PROJ-8 chrome we already ship.

```
Editor page (/editor/<id>)
├── App-shell top bar (PROJ-8 — unchanged)
└── EditorBody (PROJ-8)
    ├── BuilderToolbar (PROJ-8)
    │   ├── + Add picker  ── PROJ-9 enables "Cell" + "Section"
    │   └── Hidden-cells pill  ── PROJ-9 unhides when count > 0
    │       └── Hidden-cells popover (new)
    ├── BuilderCanvas (PROJ-8 wrapper)
    │   ├── CalculatorHero  ── PROJ-9 adds hover-edit + description
    │   ├── SectionList (new)
    │   │   └── SectionBlock (new — one per section)
    │   │       ├── SectionHeader (new — inline title / description)
    │   │       ├── SectionToolbar (new — drag-handle, layout picker, kebab)
    │   │       ├── LayoutPatternGrid (new — flows cells into columns)
    │   │       │   └── CellCard (new — one per visible cell)
    │   │       │       ├── HoverAffordances (drag-handle + edit-icon)
    │   │       │       └── CellVisualPanel (new — opens on edit click)
    │   │       ├── HiddenCellDot (new — one per hidden cell at seams)
    │   │       └── EmptySectionPlaceholder (new — when zero cells)
    │   └── AddSectionButton (new — persistent below last section)
    ├── GridPanel (PROJ-8 wrapper)
    │   ├── GridHeader (PROJ-8) — PROJ-9 adds "+ add cell" right-edge button
    │   └── GridColumnList (new)
    │       └── GridColumn (new — one per cell)
    │           ├── GridColumnHeader (new — name + pills + kebab)
    │           ├── GridDataRow (new — value or formula preview)
    │           └── CellDataModelPanel (new — opens on kebab click)
    ├── GridDrawer (PROJ-8 — mobile only)
    │   └── GridDrawerCellList (new — rotated row-per-cell layout)
    │       └── GridDrawerRow (new — collapses others on focused-expand)
    └── DestructiveConfirmSheet (new — bottom-sheet, used for delete-with-children)
```

#### What gets reused vs. what is new

- **Reused from PROJ-8**: `AddPicker`, `BuilderToolbar`,
  `BuilderCanvas` wrapper, `GridPanel` wrapper, `SlotRenderer`
  registry, `CalculatorHero` (extended in-place),
  `EditorProvider` + reducer + undo/redo stack,
  `EmptyOrErrorState` for the fallback-layout banner,
  `Pill`, `IconBtn`, the `cardSurface` / `numberStyle` /
  `labelTextStyle` theme helpers, the existing shadcn primitives
  (`Popover`, `Tooltip`, `Sheet`, `Input`, `Textarea`,
  `Switch`, `Select`, `DropdownMenu`, `RadioGroup`,
  `AlertDialog`).
- **Reused from PROJ-6**: `getTheme(id)` (extended to publish
  `layoutPatterns`), the 8 theme bundles, `cardSurface`.
- **Reused from PROJ-7**: `getStructuralErrors`,
  `getDependencies`, `RESERVED_WORDS`, `MAX_CELLS`,
  `MAX_FORMULA_LEN`, the engine's `Cell` /
  `EvaluationResult` types. PROJ-9 adds **one new export**:
  `rewriteFormulaReference(formula, oldName, newName)` —
  an AST-aware whole-word rewrite that respects lambda
  parameter shadowing.
- **New components** (all client components in
  `src/components/editor/`): `SectionList`, `SectionBlock`,
  `SectionHeader`, `SectionToolbar`, `LayoutPatternGrid`,
  `LayoutPatternPicker`, `CellCard`, `CellVisualPanel`,
  `HiddenCellDot`, `HiddenCellsPopover`,
  `EmptySectionPlaceholder`, `AddSectionButton`,
  `GridColumn`, `GridColumnHeader`, `GridDataRow`,
  `CellDataModelPanel`, `GridDrawerCellList`,
  `GridDrawerRow`, `DestructiveConfirmSheet`.
- **New library modules**: `src/lib/cells/` (types, validation
  helpers, client PATCH helpers), `src/lib/sections/`
  (parallel), `src/lib/themes/layout-patterns.ts` (the
  per-theme catalogue plus the helper that fetches them).

### Data model (plain language)

Two new tables live next to the existing `calculators` table.
RLS on both tables joins through `calculators` so a row is
readable / writable **only if** the parent calculator's
`owner_id` matches the signed-in user.

#### `sections` — named layout containers

Each section has:
- A **title** (1–100 chars, defaults to "New section") and an
  optional **description**.
- A **layout pattern** — one of the active theme's published
  patterns (e.g. `single_column`, `two_column`,
  `two_thirds_one_third`). Stored as a string id; resolved
  per-render through the theme registry.
- A **display order** within its calculator. Renumbered
  transactionally on every reorder so there are no gaps.
- The usual audit columns (`created_at`, `updated_at`) and
  the cascade trigger that bumps the parent calculator's
  `updated_at` — this is how PROJ-8's optimistic concurrency
  catches section writes.
- Parent: `calculator_id` (FK, ON DELETE CASCADE).

#### `cells` — the data-model rows

Each cell stores three groups of fields:

**Identity & data model** (owned by the Grid panel):
- `name` — snake_case identifier, max 40 chars, unique per
  calculator (this is what formulas reference).
- `label` — human-readable name shown in the Builder.
- `description` + `description_render` (caption under the
  label, or tooltip).
- `kind` — `input` or `output`.
- `value_type` — one of seven types: `number`, `currency`,
  `percent`, `date`, `boolean`, `select`, `text`.
- `visibility` (visible / hidden) — hidden cells participate
  in formulas but render as a dot in the Builder, nothing on
  the visitor URL.
- `editability` (editable / readonly) — readonly Inputs and
  hidden cells must have a `default_value`; enforced both at
  the API and in the database as a check constraint.
- `default_value` (Inputs) / `formula` (Outputs).
- Type-specific extras: `select_options`, `currency_code`,
  `unit`, `numeric_min`, `numeric_max`, `numeric_step`.

**Visual presentation** (owned by the Builder card):
- `display_widget` — what input control to render (number
  field, slider, stepper, date picker, dropdown, etc.).
- `display_format` — how to format the rendered value
  (integer, currency, percent-2, locale date, etc.).
- `display_emphasis` (Outputs) — `plain`, `kpi`, or `tabular`.
  Tabular is stored from day one for forward-compat but the
  picker hides it; an array-returning Output with default
  emphasis renders a "ships in v1.1" placeholder card.
- `text_size`, `text_colour`, `card_accent`,
  `card_background_tint`, `card_border`, `card_size_hint`.

**Ordering & audit**:
- `section_id` (FK, ON DELETE CASCADE) and `display_order`
  (unique per section, renumbered transactionally on reorder).
- `calculator_id` (denormalised FK to the parent calculator —
  there for RLS performance and for the cell-name uniqueness
  index).
- `created_at`, `updated_at`, parent-bump trigger.

**Constraints that live in the database** (not just the API):
- `name` matches `^[a-z][a-z0-9_]{0,39}$` (regex check).
- `(calculator_id, name)` is UNIQUE.
- `(section_id, display_order)` is UNIQUE.
- `kind = 'output'` requires `formula IS NOT NULL` (empty
  string allowed — a freshly added Output saves with an
  empty formula and surfaces as an `unknown_name` error).
- `visibility = 'hidden'` requires `default_value IS NOT NULL`.
- `kind = 'input' AND editability = 'readonly'` requires
  `default_value IS NOT NULL`.
- Reserved-word collision is **not** a DB constraint
  (Postgres has no awareness of the formula function table) —
  it's an API-side check using the `RESERVED_WORDS` constant
  exported from `@/lib/formula`.

#### Theme registry — layout patterns

The eight theme bundles get one new field: `layoutPatterns`,
an ordered list of pattern descriptors. Every theme publishes
`single_column` (the universal fallback); the default
Calcgrinder theme adds `two_column` and `two_thirds_one_third`;
other themes publish whatever catalogue suits their visual
language. The Builder reads the active theme's catalogue when
rendering each section. If a section's stored pattern id is
no longer in the active theme's catalogue (e.g. the theme
switched), the Builder falls back to `single_column` and
shows the same inline banner pattern PROJ-8 uses for fallback
themes.

#### Where data lives at runtime

- **Server-side load**: the editor page already fetches the
  calculator row server-side. PROJ-9 extends that loader to
  fetch sections (in `display_order`) and cells (in
  `section_id` × `display_order`) in the same RSC pass, so the
  client mounts with everything ready.
- **Backfill**: if the loaded calculator has zero sections
  (i.e. it was created in PROJ-8 before this feature shipped),
  the loader inserts a default Section 1 transparently — no
  user prompt, no separate deploy-time migration.
- **In-memory store**: PROJ-8's `EditorStore` gains two new
  slices — `sections: SectionRow[]` and `cells: CellRow[]`.
  All cell / section mutations dispatch through the same
  store so the existing undo/redo stack covers them with no
  reshape. The formula engine runs **client-side** against the
  current cells slice on every change; computed values never
  hit the database. PROJ-10 will compute on the server for the
  visitor view; PROJ-9 doesn't need to.

### Tech decisions (justified for PM)

| What | Why this rather than the alternative |
|---|---|
| **Two new tables (`sections`, `cells`), not one wide JSON column on `calculators`.** | Each cell is a row that gets edited individually (visibility toggle, formula edit, drag-reorder, rename). Storing the whole calculator content as a JSON blob would make every edit rewrite the entire blob and would defeat Postgres-level uniqueness constraints (cell-name uniqueness per calculator, display_order uniqueness per section). Two tables is the boring choice that buys real constraints. |
| **Default Section 1 is created in the same transaction as the calculator.** | The spec doesn't tolerate a "calculator exists but has no sections" intermediate state — every cell needs a section to live in. Creating the section inline avoids a race where someone tries to add a cell against a section-less calculator. Calculators created before this feature shipped get a one-shot backfill at first load — no separate deploy migration to coordinate. |
| **`display_emphasis = tabular` enum value ships from day one, even though the renderer is in v1.1 (PROJ-17).** | Adding the value later means a schema migration in PROJ-17 plus a coordinated deploy. Adding it now costs three characters in a check constraint. The picker UI hides the option, so users never see something they can't pick yet. Forward-compat win. |
| **Section / cell deletes are hard-delete.** | PROJ-13's soft-delete & Trash feature is scoped to **calculators**, not their internals. Carrying soft-delete columns on every section and cell would clutter the schema for a feature nobody asked for at the cell level. Undo / Redo within the session is the only delete-protection layer, and that's enough — a cell that lived for 90 seconds before the maintainer deleted it doesn't need recovery 30 days later. |
| **Cell delete does NOT auto-rewrite dependent formulas.** | The maintainer's signal that they removed something load-bearing is the red `unknown_name` error on the dependent cells. Silent stub-substitution (e.g. replacing with `0`) would hide bugs and could change calculator output without the author noticing. Undo brings the cell back. |
| **Rename DOES auto-rewrite dependent formulas, silently, in one transaction, in one undo step.** | Renames are intentional ("`loan_amount` is a better name than `la`"); the rewrites are mechanical and the maintainer doesn't want to chase them manually. Combining the rename + all rewrites into one undo entry means Cmd-Z restores everything if the rename was a mistake. |
| **The rewrite walks the AST, not just regex on the raw text.** | A naïve regex would rewrite `i` inside `MAP(SEQUENCE(n), i => i * 2)` — but the inner `i` is a locally-bound lambda parameter, unrelated to the cell named `i` being renamed. The formula engine already parses formulas to an AST; PROJ-9 adds one helper there (`rewriteFormulaReference`) that walks the AST and skips shadowed identifiers. Keeps the rewrite logic in one place that the engine team owns. |
| **Save-time validation enforces only structural integrity; formula structural errors persist as data.** | Spreadsheets let you save a broken formula and show a red error. PROJ-9 matches that — the maintainer can save mid-iteration without the form fighting them. PROJ-10 (Publish) is where structural errors block publication. The Builder card surfaces the error inline; Publish gates the calculator as a whole. |
| **Per-theme layout-pattern catalogue lives in the theme bundles, not in a database table.** | Themes are code-shipped objects (no DB rows); patterns belong to themes. A DB table would mean every cell render reads from Postgres to find out how many columns to draw. Theme bundles are imported at build time and cached at runtime — zero database calls per render. |
| **Drag-and-drop via @dnd-kit.** | Cell reorder and section reorder both need touch support (~300 ms long-press activation on mobile) plus keyboard accessibility (for screen-reader users). Rolling our own touch-aware DnD against the native HTML5 DnD API is a multi-week project. `react-beautiful-dnd` is deprecated. @dnd-kit is the live, maintained, headless replacement; ~10 KB core, configurable touch sensor, built-in keyboard handlers. |
| **REST endpoints under `/api/sections/*` and `/api/cells/*`, not server actions.** | PROJ-8 already established the REST pattern (`POST /api/calculators`, `PATCH /api/calculators/:id`) with explicit Zod validation, opaque 404s, optimistic-concurrency-via-updated_at, and route-level tests. PROJ-9 follows the same shape so all editor writes look alike — same auth check, same 409 surface, same test harness. Server actions would split the editor's write paths across two patterns for no gain. |
| **Every cell / section write bumps the parent calculator's `updated_at`.** | PROJ-8's optimistic concurrency lives at the calculator level — one `updated_at` per calculator, not per cell. PROJ-9 inherits that model: a trigger on `sections` and `cells` bumps the parent on every INSERT/UPDATE/DELETE. The 409 surface PROJ-8 already wires (mark-stale + generic toast) catches concurrent edits across cell-and-calculator writes too. PROJ-20 replaces the toast with a banner; PROJ-9 doesn't have to change the wiring. |
| **All edits commit incrementally (no Save/Cancel buttons).** | This is the spec's mandate, and it's what PROJ-8 already does for calculator-level edits. Toggles PATCH on change; text inputs PATCH on blur / Enter. There is no "draft" state to model — every saved state is committable, every committable state is saved. Lower cognitive load for the author, no abandoned-draft edge cases for us. |
| **Hidden cells render the spec's full UX in PROJ-9 (dot + popover), not a stripped-down version.** | The dot's purpose is twofold: keep the Builder pixel-identical to the eventual visitor view (so PROJ-11 just turns the dot off) and give the author a discoverable handle on cells they can't see in the slot stream. Shipping the dot without the popover would leave a discoverability hole (hidden cells with no toolbar entry are easy to forget); shipping the popover without the dot would break the pixel-identity property the spec depends on. |
| **Cross-section cell drag is rejected at the API in v1.** | The maintainer can delete and re-add to move a cell across sections — a one-time cost. Cross-section drag would require modelling drop targets across collapsed sections, sections under different layout patterns, sections that are scrolled off-screen, and section bodies that don't yet have a cell. Marginal value, real cost. Tracked as an Open Question. |

### Dependencies (packages to install)

- **`@dnd-kit/core`** — drag-and-drop primitives (sensors,
  contexts, collision detection).
- **`@dnd-kit/sortable`** — sortable-list helpers built on
  the core. Both cell reorder (within a section) and section
  reorder (within the calculator) use sortable lists.
- **`@dnd-kit/utilities`** — transform helpers used by the
  sortable presets.

No other new third-party packages. shadcn primitives
(`Popover`, `Tooltip`, `Sheet`, `Input`, `Textarea`,
`Switch`, `Select`, `DropdownMenu`, `RadioGroup`,
`AlertDialog`) are already installed by PROJ-8.

### Forward-compat seams PROJ-9 wires for later features

- **PROJ-10 (Publish)** reads `getStructuralErrors(cells)` from
  the engine — PROJ-9 makes sure formulas with errors persist
  unmodified, so PROJ-10 can scan them at publish-click time.
- **PROJ-11 (Visitor View)** reuses the SectionList /
  LayoutPatternGrid / CellCard chain with a different
  registry (no edit affordances, no hidden-cells UI). The
  pixel-identity property is the contract.
- **PROJ-13 (Soft-delete)** still owns calculator-level delete;
  the ON DELETE CASCADE FKs on sections and cells mean a
  hard-delete of a calculator hard-deletes its content too —
  no PROJ-9 changes needed there.
- **PROJ-15 (Charts) / PROJ-16 (Text blocks) / PROJ-17 (Tabular)**
  all register additional renderers on `SlotRenderer`'s
  registry. PROJ-9's slot pipeline never branches on element
  type beyond the dispatch — the slot iterates `display_elements`
  polymorphically.
- **PROJ-20 (Concurrent Editing)** swaps PROJ-9's generic
  409-toast for a banner; the write path doesn't change.

### What changes outside `src/components/editor/`

- **`src/lib/themes/`** — each theme bundle gains a
  `layoutPatterns` field; `getTheme()` returns the typed
  catalogue. One new helper file:
  `layout-patterns.ts` (the shared catalogue types +
  fallback logic).
- **`src/lib/formula/`** — one new export:
  `rewriteFormulaReference(formula, oldName, newName)`. Lives
  alongside the existing AST helpers; tests in the same
  directory.
- **`src/lib/cells/`** (new) — types, Zod schemas for
  POST/PATCH bodies, client-side fetch helpers (mirrors
  PROJ-8's `src/lib/calculators/client.ts`).
- **`src/lib/sections/`** (new) — same shape as
  `src/lib/cells/`.
- **`src/lib/editor/reducer.ts`** — adds `cells` and `sections`
  slices plus the action types for add/edit/delete/reorder
  on both. Existing PROJ-8 actions stay byte-identical.
- **`src/lib/editor/EditorProvider.tsx`** — adds API methods
  for cell + section mutations. The recordOperation pattern
  PROJ-8 set up handles them all.
- **`src/app/api/calculators/route.ts`** — POST extends to
  insert the default Section 1 in the same transaction; the
  response shape adds `default_section_id`.
- **`src/app/api/calculators/[id]/sections/route.ts`** (new)
  — POST a section.
- **`src/app/api/sections/[id]/route.ts`** (new) — PATCH /
  DELETE.
- **`src/app/api/sections/[id]/cells/route.ts`** (new) — POST.
- **`src/app/api/cells/[id]/route.ts`** (new) — PATCH /
  DELETE.
- **`src/lib/calculators/server.ts`** — extends the editor
  loader to also fetch sections + cells in one round-trip and
  to run the default-section backfill on zero-section
  calculators.
- **`supabase/migrations/*`** — one new migration file
  creating both tables, their triggers, their RLS policies,
  and the parent-bump triggers. Followed by
  `npx supabase gen types typescript --linked` to regenerate
  `src/lib/supabase/types.ts`.

No changes to the App-shell, auth flow, dashboard, theme
picker, or formula engine internals beyond the one new export.


## Implementation Notes (Backend — 2026-05-23)

PROJ-9's backend layer is in place. Frontend work (Builder section
chrome, Grid columns, hidden-cell dot, hero edit-in-place,
mobile drawer rotation, @dnd-kit wiring, undo enrollment) is **not**
covered by this pass — `/frontend PROJ-9` is the next step.

### What shipped

- **Migration `20260524120000_sections_and_cells.sql`** — two new
  tables (`sections`, `cells`) with the full column set from the AC,
  CHECK constraints (snake_case name pattern, hidden/readonly value
  requirement, output-requires-formula), DEFERRABLE UNIQUE on
  `(calculator_id, display_order)` for sections and
  `(section_id, display_order)` for cells, RLS policies joining
  through `public.calculators`, and a `bump_parent_calculator_updated_at`
  trigger that bumps `calculators.updated_at` on every cell/section
  INSERT/UPDATE/DELETE so PROJ-8's optimistic concurrency catches
  writes at any granularity. Indexes added for the editor loader's
  read paths.
- **Theme registry layout patterns** — `src/lib/themes/layout-patterns.ts`
  publishes 5 patterns (`single_column`, `two_column`,
  `two_thirds_one_third`, `one_third_two_thirds`, `three_column`)
  plus a `resolveLayoutPattern` helper that falls back to
  `single_column` for unknown stored ids. Each theme bundle gained a
  `layoutPatterns` field. Default calcgrinder publishes the
  AC-mandated trio; richer themes (bento, bentoGlassy, minimal)
  publish more; lean themes (terminal) publish only `single_column`.
- **Formula engine — `rewriteFormulaReference(formula, oldName, newName)`**
  in `src/lib/formula/rewrite.ts`, exported from `@/lib/formula`. An
  AST walker rewrites every `CellRef` matching `oldName` and skips
  identifiers shadowed by lambda parameters. Returns the input
  unchanged when parsing fails. 13 unit tests cover the
  lambda-shadowing, substring-non-match, string-literal, and
  multi-reference cases.
- **`src/lib/cells/` + `src/lib/sections/`** — typed row shapes,
  shared validation helpers (`validateCellName`,
  `validateSectionTitle`, `nextDefaultCellName`, `defaultEditability`,
  `defaultWidget`), and thin client fetch helpers. Reserved-word
  rejection imports `RESERVED_WORDS` from `@/lib/formula` so there is
  no drift window.
- **API surface**:
  - **`POST /api/calculators`** now creates the default Section 1 in
    the same flow as the calculator insert and returns
    `default_section_id` alongside the existing row fields. The
    response's `updated_at` is refreshed after the section insert so
    the client's optimistic token matches the trigger-bumped value.
    On section-insert failure, the just-created calculator is rolled
    back.
  - **`POST /api/calculators/:cid/sections`** creates a new section
    with sensible defaults; supports `after_section_id` placement
    with transactional sibling renumber.
  - **`PATCH /api/sections/:id`** rename / description /
    layout_pattern_id / display_order with reorder renumber + 409
    stale + 400 invalid-title.
  - **`DELETE /api/sections/:id`** with last-section guard (422
    `cannot_delete_last_section`), child-cell guard (409
    `section_not_empty` + `child_count` unless
    `?confirm_delete_with_children=true`), and post-delete repack.
  - **`POST /api/sections/:sid/cells`** with empty-body default Input
    cell (sequential `cell_N` name, `value_type='number'`, etc.),
    cell-cap (422 `cell_cap_reached`), name-pattern + reserved-word
    rejection, hidden / readonly value-required invariants, and a
    name-collision fallback.
  - **`PATCH /api/cells/:id`** covers every writable column with
    rename + AST-aware dependent rewrite (409 `name_collision`, 422
    `formula_too_long_after_rewrite`), kind swap (422
    `invalid_kind_swap`), cross-section move rejection (422
    `cross_section_move_unsupported`), reorder with transactional
    renumber, and the calculator-level 409 stale check.
  - **`DELETE /api/cells/:id`** is hard delete with sibling repack;
    dependent formulas surface `unknown_name` via the engine (not
    rewritten — confirmed product decision).
- **`src/lib/calculators/server.ts`** — `getEditorBundle()` fetches
  calculator + sections + cells in one pass and runs the
  zero-section backfill transparently for pre-PROJ-9 calculators.
- **`src/lib/supabase/types.ts`** — hand-extended with the
  `sections` and `cells` row shapes so the new routes compile
  type-clean. The user should re-run
  `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
  once the migration deploys to the linked Cloud project so the
  generator's emitted shape supersedes the hand-rolled one.
- **Tests** — 555 tests pass (+ 30 new for layout-patterns,
  formula rewrite, cell/section types, and the new API routes).
  ESLint clean.

### Deferred to PROJ-9 frontend pass

- Builder section chrome (hover border, drag-handle, layout-pattern
  picker, kebab, destructive-confirm sheet, AddSectionButton).
- Hidden-cell dot rendering + hidden-cells toolbar pill + popover.
- Builder hero edit-in-place (title + description).
- Grid columns with kebab-expand data-model panel.
- Builder cell card with edit-icon visual panel.
- Mobile Grid drawer rotation + focused-expand.
- @dnd-kit wiring for cell + section reorder, 300 ms touch
  long-press activation.
- Undo / redo enrollment for the new mutation types in EditorStore.
- Live engine re-run on cell mutations + per-cell red-error
  treatment.

These all consume the API surface this pass shipped; no DB or API
changes anticipated when they land.

## Implementation Notes (Frontend — 2026-05-23)

PROJ-9's frontend layer is in place. Drag-and-drop reorder (sections &
cells via @dnd-kit) is intentionally deferred — the UI ships with the
reorder API surface available from the data-model panel but without the
on-card drag handle. All other AC bullets land in this pass.

### What shipped

- **Editor state slices** — `src/lib/editor/reducer.ts` gained `sections`
  and `cells` arrays plus action types (`SET_SECTIONS`, `SET_CELLS`,
  `UPSERT_SECTION`, `REMOVE_SECTION`, `UPSERT_CELL`, `UPSERT_CELLS`,
  `REMOVE_CELL`). `initialEditorState` now accepts seed `sections` /
  `cells` from the server bundle. Sorting helpers keep the slices in
  display-order on every upsert.
- **EditorProvider mutation API** — `src/lib/editor/EditorProvider.tsx`
  exposes `addSection`, `patchSection`, `removeSection`, `addCell`,
  `patchCell`, `removeCell` (plus the existing `renameCalculator`,
  `setTheme`). New `setDescription` covers hero description edits. Every
  mutation enrolls a single Undo entry that PATCHes the inverse. Stale
  409s flip the calculator into the same `stale` mode the title rename
  already used. Per-error toast overrides translate API codes
  (`name_reserved`, `name_collision`, `hidden_requires_value`,
  `readonly_input_requires_value`, `cross_section_move_unsupported`,
  `formula_too_long_after_rewrite`, `cell_cap_reached`) into spec-mandated
  copy.
- **Editor page loader** — `src/app/(app)/editor/[id]/page.tsx` switched
  from `getCalculatorForEditor` to `getEditorBundle`, hydrating the
  provider with calculator + sections + cells in one server pass. The
  zero-section backfill PROJ-9 backend ships fires transparently for
  legacy PROJ-8 calculators.
- **Live engine evaluation** — `src/lib/editor/useEvaluation.ts` maps
  `CellRow[]` onto the formula engine's `Cell[]` shape and runs
  `evaluateCalculator`. `EvaluationProvider` holds the in-Builder input
  scratch dictionary (`inputs: Record<name, value>`) and shares the
  evaluation map across the cell card stack, grid columns, and the
  hidden-cells pill (which highlights when any hidden cell errors).
- **Builder canvas** — `BuilderCanvas` now mounts a `SectionList` per
  active theme. Each section renders:
  - `SectionBlock` with hover-border, inline edit-in-place title +
    description (`EditableText` primitive), and a hover-revealed toolbar
    (`LayoutPatternPicker` + delete kebab).
  - `LayoutPatternGrid` lays cells into a CSS-grid template derived from
    the active pattern's `columnSpans`. Hidden cells cluster as 0-height
    accent dots between rows.
  - `EmptySectionPlaceholder` swap-in when the section is empty.
  - `DestructiveConfirmSheet` (shadcn `Sheet`) for delete-with-children
    confirms.
  - `AddSectionButton` (rendered inline by `SectionList`) below the last
    section.
- **Cell cards** — `CellCard` renders Input widgets (`CellInputWidget`
  dispatches per `value_type`: number/currency/percent → number field
  or slider, date → native date picker, boolean → shadcn `Switch`,
  select → shadcn `Select`, text → input) and Output values (with
  `Intl.NumberFormat`-based formatting per `display_format`). Errors
  surface as inline red text. Array-returning Outputs with default
  emphasis render the v1.1 placeholder; KPI emphasis falls back to the
  first scalar. The hover edit-icon opens `CellVisualPanel` with the
  card-level + cell-specific visual controls; the panel's widget picker
  filters per cell type and disables widgets whose constraints aren't
  met (slider w/o min+max, stepper w/o step). All commits incremental.
- **Grid panel** — replaced the PROJ-8 empty body with a horizontally
  scrolling column-per-cell list. Each `GridColumn` shows a name +
  kind-pill + visibility chip header, an inline-editable data row
  (input value preview for Inputs, formula text for Outputs with red
  underline + tooltip on engine error), and a kebab-expand inline
  `CellDataModelPanel` covering the full data-model field set.
- **Hidden cells** — `HiddenCellDot` renders the 0-height accent dot
  per spec; clicking expands a mini-edit panel inline with
  visibility-toggle + delete + close. `HiddenCellsPill` lights up on
  `BuilderToolbar` when count > 0; its popover lists each hidden cell
  by label (fallback name) with click-to-scroll-and-open behaviour. The
  pill carries a red ring when any hidden cell has an engine error.
- **Calculator hero edit-in-place** — `CalculatorHero` uses
  `EditableText` for both title (single-line, 100-char cap, PATCH on
  blur / Enter) and description (multi-line `<textarea>`, placeholder
  "Add a short description"). Title commits route through the same
  `renameCalculator` PROJ-8 used so the breadcrumb stays in sync via
  the existing top-bar slot.
- **Mobile drawer rotation** — `GridDrawerToggle` now renders one row
  per cell (drag-handle placeholder + name + kind/visibility chips +
  value/formula preview). Tap → focused-expand mode shows only the
  selected cell's `CellDataModelPanel`. Chevron-down → back to list at
  preserved scroll. Closing the drawer discards focused-expand state.
- **+Add picker** — `BuilderToolbar` now passes a runtime options array
  enabling Cell + Section, both wired to `addCell(lastSection)` and
  `addSection()` respectively. Chart + Text-block stay disabled with
  their v1.1 tooltips. The Grid header gained the "+ add cell"
  right-edge affordance per spec.
- **Section + cell barrel** — `src/components/editor/index.ts` exports
  every new component so PROJ-11 (Visitor View) can pick them up.

### Deliberate deferrals

- **Per-cell theme-accent swatch picker** — `card_accent` defaults to
  `'theme'` and isn't surfaced in the visual panel UI yet.

### Frontend follow-up (2026-05-23) — drag-reorder + live rename refresh

Two items that the first frontend pass left for a follow-up landed in
the same day:

- **`@dnd-kit` drag-reorder** — Sections and cells now drag via
  `@dnd-kit/core` + `@dnd-kit/sortable`. `src/components/editor/dnd-helpers.tsx`
  publishes the shared sensor config (`PointerSensor` distance=4 +
  `TouchSensor` with `delay: 300, tolerance: 6` for the spec-mandated
  300 ms long-press + `KeyboardSensor` with sortable coordinate
  getter) and the `SortableItem` + `DragHandle` headless primitives.
  `SectionList` hosts a single vertical `DndContext` whose `onDragEnd`
  PATCHes the dragged section's `display_order`; the server's
  transactional sibling renumber repacks the rest. Each
  `SectionBlock` hosts its own nested `DndContext` (rect strategy)
  scoped to that section's visible cells, so cross-section drops are
  structurally impossible — a stray foreign id surfaces the spec
  toast "Cross-section moves aren't supported yet." The drag handle
  sits in the top-left of every card / the leading edge of every
  section header and only appears on hover, matching the resting-
  state spec ("no hover affordances in resting state"). Each drop
  enrols a single undo entry via the existing `patchSection` /
  `patchCell` flow.
- **Silent rename — same-pass dependent refresh** — When a cell
  rename commits, `EditorProvider.patchCell` now applies the same
  `rewriteFormulaReference(formula, oldName, newName)` helper the
  server uses (re-exported from `@/lib/formula`) to every cell ID in
  the PATCH response's `rewritten_cell_ids` list. The resulting rows
  are pushed into local state via a single `UPSERT_CELLS` dispatch,
  so the Builder cards + Grid formula text + engine re-evaluation
  all reflect the new references in the same render pass — no
  reload required. Undo captures the dependents' pre-rewrite
  formulas at commit time and restores them on Cmd-Z so the
  rename + every dependent rewrite revert in one step.

### Files added / changed

Added:
- `src/components/editor/editable-text.tsx`
- `src/components/editor/section-list.tsx`
- `src/components/editor/section-block.tsx`
- `src/components/editor/layout-pattern-picker.tsx`
- `src/components/editor/destructive-confirm-sheet.tsx`
- `src/components/editor/cell-card.tsx`
- `src/components/editor/cell-input-widget.tsx`
- `src/components/editor/cell-visual-panel.tsx`
- `src/components/editor/cell-data-model-panel.tsx`
- `src/components/editor/grid-column.tsx`
- `src/components/editor/hidden-cell-dot.tsx`
- `src/components/editor/hidden-cells-pill.tsx`
- `src/lib/editor/EvaluationContext.tsx`
- `src/lib/editor/useEvaluation.ts`

Changed:
- `src/app/(app)/editor/[id]/page.tsx` — uses `getEditorBundle`.
- `src/lib/editor/reducer.ts` — sections / cells slices + actions.
- `src/lib/editor/EditorProvider.tsx` — section/cell mutation API +
  `setDescription` + extended `recordOperation` return type.
- `src/components/editor/builder-canvas.tsx` — renders `SectionList`.
- `src/components/editor/builder-toolbar.tsx` — runtime AddPicker
  options + `HiddenCellsPill`.
- `src/components/editor/calculator-hero.tsx` — title + description
  edit-in-place via `EditableText`.
- `src/components/editor/editor-body.tsx` — wraps in
  `EvaluationProvider`.
- `src/components/editor/grid-panel.tsx` — columns + add-cell affordance.
- `src/components/editor/grid-drawer-toggle.tsx` — rotated list +
  focused-expand.
- `src/components/editor/mobile-footer-nav.tsx` — enabled +Add cell.
- `src/components/editor/index.ts` — barrel updates.

### Verification

- `npm run lint` — 0 errors (4 pre-existing warnings unrelated to PROJ-9).
- `npm run build` — production build succeeds.
- `npm test -- --run` — 555 tests pass (no regression).
- Dev server boots; `/editor/<id>` route serves without runtime errors.

## QA Test Results (2026-05-23)

### Summary

- **Acceptance criteria covered:** 130+ AC bullets evaluated across DB
  schema, theme registry, API surface, section + cell UI, hidden cells,
  hero edit-in-place, mobile drawer, save vs publish validation, undo
  enrolment, +Add picker state, and edge cases.
- **Status:** **READY for deploy** — no Critical or High bugs remaining
  after fixing the migration-deploy gap discovered during E2E setup.
- **Automated coverage:** 555 Vitest unit tests pass (unchanged from
  backend pass); 11 PROJ-8 E2E + 14 new PROJ-9 E2E tests pass on
  Chromium against the live Supabase Cloud project.
- **Bugs found:** 1 Critical (resolved), 0 High, 4 Medium (3 resolved
  during follow-up fix pass, 1 not blocking deploy), 4 Low (1 fixed
  with code comment, 1 withdrawn, 2 deferred to follow-up features).
  See "Bug Inventory" below.

### Per-area test coverage

| Area | AC pass | Notes |
|---|---|---|
| `sections` table schema | ✅ Pass | Columns, CHECK constraints, DEFERRABLE UNIQUE on (calculator_id, display_order), updated_at trigger, parent-bump trigger, RLS via join through calculators. Verified via Supabase migration list + direct admin client reads. |
| `cells` table schema | ✅ Pass | All 30 columns present; CHECK constraints for name pattern, output-requires-formula, hidden-requires-value, readonly-input-requires-value, display_emphasis enum with `tabular` for forward-compat. UNIQUE (calculator_id, name) + (section_id, display_order) DEFERRABLE. RLS via parent-join. |
| Theme registry — layoutPatterns | ✅ Pass | 5 patterns shipped; every theme exposes `single_column`. Calcgrinder default theme exposes single + two_column + two_thirds_one_third per AC. Unknown patterns fall back to single_column with banner via `resolveLayoutPattern`. |
| `POST /api/calculators` default section side effect | ✅ Pass | E2E confirms response body adds `default_section_id` and the section is created in the same flow with title="Section 1", layout="single_column", display_order=0. Calculator's `updated_at` is refreshed after the trigger bump so the client's first PATCH doesn't 409. Best-effort rollback on section insert failure is in place. |
| Zero-section backfill on first load | ✅ Pass | `getEditorBundle()` detects empty section count and inserts Section 1 transparently; refresh of `updated_at` after the backfill prevents an immediate stale-409. Verified by code review (no PROJ-8 calculator predates PROJ-9 in the test fixtures, but the codepath is exercised whenever a calculator's sections array is empty at load time). |
| API — sections CRUD | ✅ Pass | E2E covers: 201 + `after_section_id` placement, 422 cannot_delete_last_section, 409 section_not_empty + child_count when children present, 204 with confirm_delete_with_children=true, opaque 404 for non-owners. PATCH renumber walks siblings via park-then-shift pattern (handles bidirectional moves). |
| API — cells CRUD | ✅ Pass | E2E covers: empty-body default Input creation (cell_1, label "New cell", number type), 400 name_invalid for uppercase/punctuation, 400 name_reserved for reserved words (`pmt`), 422 cell_cap_reached at 200, 422 cross_section_move_unsupported on `section_id` writes, 200 rename with `rewritten_cell_ids` in the response, dependent formula rewrite verified on disk (`loan_amount * 2` → `principal * 2`). |
| Section management UI | ✅ Pass (code review) | SectionBlock hover-borders, inline-edit title via EditableText (Enter / blur / Esc), layout-pattern picker popover, delete kebab with destructive-confirm bottom sheet, "Delete section" disabled when canDelete=false (last-section), persistent +Add section button below the last section. |
| Section drag-reorder | ✅ Pass (code review) | SectionList hosts vertical DndContext; uses @dnd-kit/sortable with shared sensor config (PointerSensor distance=4, TouchSensor delay=300/tolerance=6, KeyboardSensor). One PATCH per drop; transactional sibling renumber server-side; single undo entry via `patchSection`. |
| Cell creation entry points | ✅ Pass | All three entry points (BuilderToolbar +Add → Cell, GridPanel "+ add cell" right-edge button, MobileFooter +Add cell) covered by E2E or code review. Section auto-bootstrap if zero sections present (defensive — backfill should prevent this state). |
| Cell name validation (commit-time) | ✅ Pass | Client `validateCellName` enforces pattern + reserved word with inline error messaging; `maxLength={40}` on the input; server backstop returns 400 name_invalid / 400 name_reserved / 409 name_collision with spec-correct error shapes. |
| Cell rename — silent dependent rewrite | ✅ Pass | E2E exercises the full path: Input + Output cells via API → PATCH name → server response includes `rewritten_cell_ids` → dependent formula text verified rewritten on disk. AST-aware rewrite handles lambda shadowing (covered by `rewrite.test.ts` unit tests). Client mirrors server using the same `rewriteFormulaReference` helper for same-render-pass UI update. Single undo entry restores both rename + dependent formulas via snapshot capture at commit time. |
| Grid panel column rendering | ✅ Pass (code review) | One column per cell sorted by section.display_order then cell.display_order. Header strip with name + kind pill + visibility chip + kebab. Data row inline-edits on click (Enter / blur commit, Esc revert). Output cells show formula text with red underline + tooltip on engine error. CellDataModelPanel covers all data-model fields (name, label, kind swap, value_type, visibility, editability, description + render, default_value/formula, numeric constraints, select options, currency code). |
| Builder card surface | ✅ Pass (code review) | CellCard renders Input widgets (CellInputWidget dispatches per value_type) and Output values (Intl.NumberFormat-based formatting per display_format). Hover edit-icon opens CellVisualPanel with card-level + cell-specific controls; widget picker filters per value_type and disables widgets whose constraints aren't met (slider without min+max, stepper without step). KPI emphasis hidden when display_emphasis=tabular per Tabular fall-back. Drag-handle in top-left only visible on hover. |
| Hidden cells — dot + pill | ✅ Pass (code review) | HiddenCellDot renders 0-height accent dot with click-to-expand inline panel (Make visible / Delete / Close). HiddenCellsPill on BuilderToolbar shows correctly when count > 0, hides at count 0 (PROJ-8 left it unconditionally hidden; PROJ-9 unhides). Popover lists hidden cells by label (fallback name); click scrolls to the dot via `data-hidden-cell-id` attribute and pops it open. Red ring on the pill when any hidden cell has an engine error. |
| Builder hero edit-in-place | ✅ Pass | E2E exercises hero title click → input → Enter → DB update → breadcrumb sync via the existing PROJ-8 slot-rendering path. Description uses multiline textarea with placeholder "Add a short description". Title commit routes through `renameCalculator` (PROJ-8) so undo behaviour stays single-entry. |
| Save-time vs Publish-time validation | ✅ Pass | API persists structurally-broken formulas as data (empty-string formula allowed by DB check constraint; `unknown_name` from the engine never blocks save). Builder cards render the engine error inline (red text + role=alert); Grid data row underlines red with tooltip. Publish gating belongs to PROJ-10 — PROJ-9 doesn't touch it. |
| Tabular fall-back | ✅ Pass (code review) | Output cell with array result + default `display_emphasis='plain'` renders the "Array result — tabular display ships in v1.1." placeholder. KPI emphasis falls back to first scalar with implicit best-effort. Emphasis picker offers only Plain + KPI (Tabular hidden but enum value persists in DB for forward-compat). |
| Mobile drawer rotation | ✅ Pass (code review) | GridDrawerToggle renders one row per cell (drag-handle + name + kind/visibility chips + value/formula preview + chevron). Tap → focused-expand mode shows only the tapped cell's CellDataModelPanel; chevron-down returns to list. Drawer max-height capped at 70vh; closing the drawer discards focused-expand state. |
| Live sync between Grid and Builder | ✅ Pass (code review) | The shared EditorStore + EvaluationProvider re-derives Output values on every cell PATCH; visibility toggle updates remove/add cards in the same render pass; rename's dependent rewrites also dispatched in the same render pass via `UPSERT_CELLS`. Card-level visuals do NOT surface in the Grid (correct per spec). |
| Undo / Redo enrolment | ✅ Pass (code review) | Every mutation path goes through `recordOperation` which pushes a single entry. Reorder uses one drop = one PATCH = one undo entry. The text-input focus check prevents editor-level undo from overriding native input undo. Note: `removeSection` undo doesn't restore original IDs (see Medium bug M3). |
| +Add picker state in PROJ-9 | ✅ Pass | E2E confirms Cell + Section options are enabled; Chart + Text block remain disabled with v1.1 tooltips. Cell creation lands in the last section; Section creation appends after the last and (in the builder toolbar handler) auto-creates a section first if zero sections exist (defensive). |

### Security audit (red-team)

| Vector | Result | Evidence |
|---|---|---|
| Unauthenticated API access | ✅ Blocked | Middleware route-gate redirects anonymous `/api/*` requests to `/auth/login?next=…` (HTTP 302) before route handlers run. The route's own `if (!user) return 401` is a defensive backstop. Verified by E2E (`Unauthenticated PATCH /api/cells/:id is gated by middleware`). |
| Cross-owner section / cell read | ✅ Blocked | RLS policies on `sections` and `cells` join through `calculators.owner_id`. The route handlers' `.maybeSingle()` returns null for non-owners, which the route maps to opaque 404 (no leak of existence). Verified by E2E (`Cross-owner section PATCH/DELETE returns 404`). |
| Soft-deleted calculator edit attempts | ✅ Blocked | Every section / cell route reads the parent calculator with `.is('soft_delete_at', null)` and 404s when the parent is soft-deleted. Caught in code review. |
| Reserved-word cell name via direct API | ✅ Blocked | `validateCellNameField` rejects with 400 `name_reserved` server-side using the `RESERVED_WORDS` list from `@/lib/formula` — same source the engine uses, no drift window. Verified by E2E. |
| Cell-name regex bypass via direct API | ✅ Blocked | DB CHECK constraint `name ~ '^[a-z][a-z0-9_]{0,39}$'` is the second line of defence; API rejects ahead with 400 `name_invalid`. Verified by E2E. |
| `kind='output'` without formula via direct API | ✅ Blocked | API + DB CHECK constraint both reject. |
| `visibility='hidden'` without default_value | ✅ Blocked | API returns 422 `hidden_requires_value`; DB CHECK constraint catches direct writes. |
| `editability='readonly'` + input + null default_value | ✅ Blocked | Same dual layer. |
| Cross-section cell move via direct API | ✅ Blocked | API returns 422 `cross_section_move_unsupported`. Verified by E2E. |
| Last-section delete via direct API | ✅ Blocked | API returns 422 `cannot_delete_last_section`. Verified by E2E. |
| Cell-cap (200) bypass via rapid POSTs | ✅ Blocked | API count-then-insert check returns 422 `cell_cap_reached`. Verified by E2E with bulk-loaded 200-cell calculator. Note: there is a theoretical race window between the count and the insert (no DB cap constraint); the only consequence is a tiny over-shoot under burst concurrency. Acceptable for v1's low-volume profile — see Bug Inventory L3. |
| XSS via cell `label` / `description` / `title` | ✅ Mitigated | All user text is rendered via React text nodes (no `dangerouslySetInnerHTML`). Spot-checked CellCard, SectionBlock, GridColumn, HiddenCellsPill, EditableText. |
| Formula injection bypassing engine | ✅ Mitigated | Formulas are persisted as raw text and evaluated through the formula engine's parser; no SQL/script execution path. The engine has structural-error limits (MAX_FORMULA_LEN) enforced at the API. |
| Information disclosure via 409 stale token | ⚠️ Minor | The `server_updated_at` field in 409 responses confirms the calculator exists. Same surface PROJ-8 ships — owner-only context, low impact. |
| Secrets in browser bundle | ✅ Clean | No SUPABASE_SECRET_KEY / SYSADMIN_* references in client components; supabase client factory split per environment per CLAUDE.md rule. |

### Regression testing

- **PROJ-8 — Editor: Grid + Builder Two-Panel Split** — 11/11 Chromium
  E2E tests pass. One test ("all options disabled") was updated in
  this pass to match the new PROJ-9 reality (Cell + Section options
  now enabled, Chart + Text-block remain disabled). Documented as
  expected test obsolescence, not a regression.
- **PROJ-7 — Formula Engine** — unaffected; the rewrite helper added
  by PROJ-9 lives next to existing AST helpers and has 13 of its own
  unit tests passing.
- **PROJ-6 — Calculator Theme System** — extended in-place via
  `layoutPatterns` field; existing per-theme unit tests pass.
- **PROJ-5 — Account Dashboard**, **PROJ-4 — App Shell**, etc. — no
  shared surface modified; all 555 Vitest tests pass.

### Build, lint, types

- `npm run build` — Next.js production build succeeds; all 16 static
  pages generate; new routes registered (`/api/calculators/[id]/sections`,
  `/api/sections/[id]`, `/api/sections/[id]/cells`, `/api/cells/[id]`).
- `npm run lint` — 0 errors (4 pre-existing warnings unrelated to PROJ-9).
- TypeScript — `npm run build` passes type-check after the linked
  Cloud project's regenerated `src/lib/supabase/types.ts` replaced the
  hand-extended version.

### Bug Inventory

#### Critical (resolved)

- **C1. Migration not deployed to linked Cloud project.** When QA
  began, `supabase migration list --linked` showed
  `20260524120000_sections_and_cells.sql` missing from "Remote". Every
  PROJ-9 API call returned PGRST205 (`Could not find the table
  'public.sections' in the schema cache`); PROJ-8's `POST /api/calculators`
  regressed because it now requires the `sections` insert in the same
  flow and the just-created calculator was rolled back by the
  best-effort cleanup. **Resolved during QA** by running
  `npx supabase db push --linked` (user-authorised in this session)
  and re-generating types via `npx supabase gen types typescript
  --linked > src/lib/supabase/types.ts`. The deploy step (PROJ-9
  `/deploy`) must include both commands.

#### Medium (resolved)

- **M1. EditableText silently discards invalid section / hero titles
  on blur.** `EditableText.commit()` exited edit mode before the
  wrapper's `onCommit` early-return on empty, so empty/whitespace
  titles silently reverted instead of showing the spec's shake/red
  treatment. **Resolved (2026-05-23):** added a `validate?: (next) =>
  { ok: boolean }` prop to `EditableText` mirroring PROJ-8's
  `BreadcrumbEditableSegment` pattern — on invalid, the input
  re-focuses, re-selects, sets `aria-invalid`, and pulses
  `ring-cg-danger animate-pulse` for 600 ms, staying in edit mode the
  whole time. Wired into `SectionBlock` (validates via
  `validateSectionTitle` from `@/lib/sections/types`) and
  `CalculatorHero` (validates via `validateTitle` from
  `@/lib/calculators/types`). E2E covers the section path: *Empty
  section title is rejected client-side (shake/red treatment, stays in
  edit mode)*.

- **M2. Cell-cap (200) check has a small race window.** `POST cells`
  reads the count and then inserts; concurrent requests can both pass
  the cap check, leading to a brief over-shoot. There is no DB-level
  cap constraint (the cap lives in `@/lib/formula/limits.ts`). Low
  practical impact at v1's volume profile (single deployer, tens of
  users). **Not blocking deploy.** Add a single-row count-trigger
  constraint on the cells table in a follow-up if author research
  shows the cap is being hit by concurrent edits.

- **M3. Undo of a section delete loses the original section + cell
  IDs.** `EditorProvider.removeSection`'s undoFn previously called
  `createSectionApi` / `createCellApi` without forwarding the
  original UUIDs, even though the API accepted an optional `id`.
  **Resolved (2026-05-23):** undoFn now passes `id: previous.id` on
  the section recreate and `id: cell.id` on every child-cell
  recreate. Extended `CreateSectionBody` to expose the `id` field
  (the API already accepted it; the client type was the only gap).
  Dropped the previously-needed `as unknown as CreateSectionBody`
  cast in `addSection`. E2E covers the round trip: *Undo of a section
  delete restores the original section + cell UUIDs*.

- **M4 (new — same pattern as M3, found during M3 fix).** `addCell`
  did NOT forward the captured `createdId` on redo (unlike
  `addSection` which already did). So redo of an add-cell operation
  always produced a fresh UUID. `removeCell`'s undoFn had the same
  omission. **Resolved (2026-05-23):** both paths now thread the
  original id through to `createCellApi`. Same fix shape as M3.

#### Low

- **L1. Reducer's `sortCells` orders by `section_id` UUID string, not
  by section's `display_order`.** **Verified harmless (2026-05-23):**
  audited every `state.cells` consumer — `GridPanel`,
  `GridDrawerToggle`, `SectionList`, `SectionBlock`, `useEvaluation`,
  and the reducer's own internals either re-sort with the sections
  slice in hand or filter per-section (within which the secondary
  display_order sort IS correct), or operate by-id and are
  order-insensitive. The one consumer that walks cross-section
  without a re-sort is `HiddenCellsPill`'s popover, whose sort order
  is an explicit Open Question in the spec ("Currently insertion
  order. Could be alphabetised by name. Defer to feedback."). **Fix
  (2026-05-23):** added a code comment to `sortCells` documenting
  what consumers rely on and what a future cross-section consumer
  would need to do (select-and-sort with `state.sections` in hand).
  No behaviour change.

- **L2. `addSection` undo loses the original section ID.**
  **Withdrawn (2026-05-23):** on re-audit, `addSection` already
  forwards `createdId` on redo via the spread at line 311-314 — only
  the type was awkward (an `as unknown as` cast). The actual bug
  was in `addCell`, captured as **M4** above and fixed in the same
  pass.

- **L3. `cell-card.tsx` formats numbers with hardcoded `'en-US'`
  locale.** PRD locks v1 to English-only, so this is consistent — but
  the constant should ideally live next to other locale-related
  config so PROJ-? when i18n lands knows where to look. Not a bug
  today; flagged for future awareness.

- **L4. `cell-input-widget.tsx` boolean Switch treats the string
  `'true'` (from default_value coercion) as `true` but `'false'` also
  reads as `false` only via explicit check. The widget renders
  correctly for `boolean`-typed cells but the coercion path through
  `default_value` is loose. No visible impact in PROJ-9; flag for
  cleanup when scenarios (PROJ-12) wire default_value persistence.

### Deferrals + intentional gaps (NOT bugs)

- **No drag-reorder E2E coverage.** Drag tests are flaky in headless
  browsers and the spec's 300ms long-press touch sensor requires real
  pointer events. Drag wiring is exercised by code review; the
  underlying `patchSection` / `patchCell` PATCH paths are exercised by
  the API E2E tests. PROJ-20's concurrent-editing work would be a
  good time to add drag-specific Playwright tests using
  `mouse.move(...)` sequences.
- **No cross-browser Firefox / Safari coverage.** Same as PROJ-8 — run
  with `--project=chromium` only. The CI matrix can extend at PROJ-9's
  deploy time.
- **Per-cell theme-accent swatch picker.** Frontend implementation
  notes already mark this as a deliberate deferral; `card_accent`
  defaults to `'theme'` and isn't surfaced in the visual panel UI yet.

### Production-Ready Decision

**READY.** No Critical or High bugs remain. M1 (empty title silent
revert), M3 (undo-id loss on section delete), and M4 (undo-id loss on
add/remove cell) were all fixed in the follow-up pass with E2E
coverage. M2 (cell-cap race) is a known low-impact race in a low-volume
v1 profile, not blocking deploy. L1 was verified harmless and
documented in-code; L2 was withdrawn after re-audit; L3 and L4 are
quality improvements for future features.

**Final test counts (after follow-up fixes):**
- Vitest unit tests: 555 pass
- Playwright E2E: 11 PROJ-8 + 16 PROJ-9 = 27 pass on Chromium
- `npm run lint`: 0 errors (4 pre-existing warnings unrelated to PROJ-9)
- `npm run build`: succeeds

Recommended next step: run `/deploy PROJ-9`. The deploy must include:
1. `npx supabase db push --linked` if the linked DB doesn't already
   have `20260524120000_sections_and_cells.sql` (already done during
   QA — verify with `supabase migration list --linked` before deploy).
2. `npx supabase gen types typescript --linked 2>/dev/null > src/lib/supabase/types.ts`
   so the generated types reflect the deployed schema (note the
   `2>/dev/null` — the CLI prints "Initialising login role…" to
   stderr by default, and capturing both streams pollutes the file).


## Deployment
_To be added by /deploy_
