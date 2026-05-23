# Calcgrinder App — Specification

Working title: **Calcgrinder**. Brand name should be reachable
via a single source so a rebrand is one-line.

---

## 1. What & why

### Motivation

Interactive calculators — fixed input schema, live formula
evaluation, charts, sharable URLs with calculator-interface
with themes. Calcgrinder is a webapp where users build
interactive calculators in a builder UI, then share them under
public URLs with live recomputation as visitors type. Visitors
can save their input values as scenarios (locally if anonymous,
in their account if registered) and share scenarios via URL.
Registered users can clone any published calculator into their
own account as a starting point for variations.

### User roles

Three role tiers.

**Public User (anonymous, no account):**
- Access only via public-token URL of a published calculator
- Can use the calculator (enter values, see live recomputation,
  view charts)
- Can save input scenarios to browser localStorage
- Cannot create, clone, edit, publish or save server-side

**Registered User (account, not sysadmin):**
- Everything Public User can do, plus:
- Save scenarios server-side in their account
- Create, edit, duplicate, soft-delete own calculators
- Publish own calculators (gets a public-token URL to share) or
  keep them private
- Clone any published calculator (sysadmin preset or another
  user's published calculator). Clone is a one-time snapshot
  saved into the cloner's account.

**Sysadmin (account with sysadmin status):**
- Everything Registered User can do, plus:
- When sysadmin publishes one of their own calculators, that
  calculator appears in every Registered User's dashboard under
  "Presets"
- Moderation surface: can see and delete any calculator on the
  system, for handling rule-violating content

The "Preset" status is implicit: any published calculator
owned by a sysadmin acts as a preset.

On login, an anonymous visitor's localStorage scenarios are
migrated to their account.


### The two surfaces

The app has two distinct frontend experiences:

**Calculator interface (public-facing).** What anyone sees at a
calculator's public URL. Themed, calculator-only, no app chrome
(no preset list, no build affordances, no account menu).
Registered Users and Sysadmin see a small Clone button; Public
Users do not.

**App surface (builder + account).** What Registered Users and
Sysadmin see when signed in. Includes account dashboard, builder
for editing a calculator, scenario picker, settings page, and
(for sysadmin) the dashboard-embedded moderation section.

The Calculator interface is loadable without signing in, gets a
much smaller code surface, and must stay lean.

Compare mode is deferred to v2 (see §3 Out of scope for v1).

---

## 2. Data model

The Calculator is the central object.

### Entities

- **Calculator** — owned by one user. Has:
  - `title` — mandatory, plain text, max 100 chars after trim.
    Non-empty (validated on save / on blur of the edit
    surface). New calculators default to "Untitled
    calculator" until renamed.
  - `description` — optional, plain text, no enforced length
    cap. May be left empty; placeholder text shown in the
    Builder hero only ("Add a short description"), never in
    the visitor view.
  - Theme reference, `published` flag, public-share token,
    soft-delete timestamp.

  Neither field accepts Markdown — Markdown is reserved for
  Text-block display elements (see §2 Display elements).
- **Cell** — an Input or Output cell within a calculator. See
  Cell model below.
- **Display element** — anything that takes up a slot on the
  calculator frontend: a cell, a chart, a text/title block. The
  implementer chooses whether this is one polymorphic table or
  several.
- **Section** — a named grouping of display elements with a
  layout. Has a title, optional description, layout pattern
  from the active theme, ordering within calculator.
- **Chart** — a chart configuration referencing one or more
  series cells. See [§3 Charts](#charts).
- **Scenario** — a saved set of input values for a specific
  calculator instance. Has a mandatory title, optional
  description, owner, saved-at timestamp.
- **User** — account record. Has name, email, role (registered
  or sysadmin), pending-deletion timestamp (for email-
  confirmation account deletion).

Tables include audit timestamps and created-by / updated-by
references. Exact convention follows the chosen backend stack.
Implementer chooses exact column types, JSON-vs-relational
split, indexing.

### Cell model

Two cell categories, plus orthogonal visibility and editability:

- **Input cell** — value from user entry. Has a `value_type`
  (number, currency, percent, date, boolean, select, text).
- **Output cell** — value from a formula written against other
  cells.

Per-cell properties:
- `name` — internal identifier (used in formulas)
- `label` — display label for the calculator frontend
- `description` — help text. Either persistent caption (default)
  or tooltip, configured per cell.
- `visibility` — `visible` or `hidden`
- `editability` — only relevant when visible. `editable` lets
  the visitor change the value; `readonly` shows-only. Output
  cells default to `readonly`; Input cells default to
  `editable`.
- `value` — for Input cells: stored default (mandatory if
  `readonly`, optional if `editable`)
- `formula` — for Output cells
- `display_format` — see below
- `display_widget` — for Input cells, see below
- `display_emphasis` — for Output cells, see below
- `unit`, `min`, `max`, `step` — numeric constraints

### Cell scenarios

All practical scenarios are expressible with the two cell types
plus visibility and editability:

| Cell type | Visibility | Editability | Use case |
|-----------|------------|-------------|----------|
| Input | visible | editable | Normal user input |
| Input | visible | readonly | Fixed display value (e.g. "5% rate" shown but not editable) |
| Input | hidden | — | Internal constant referenced by formulas |
| Output | visible | readonly | Normal computed output |
| Output | visible | editable | Visitor can override the computed value |
| Output | hidden | — | Intermediate computation feeding other formulas |

**Note on readonly input rendering.** A visible-readonly Input
cell renders as styled text (with the same formatting options
as Output cells — size, colour rules, etc.), not as a disabled
form widget. The cell is effectively a maintainer-fixed display
value.

### Display formats

Both Input and Output cells can be displayed with a format:
Number (default), Percent, Currency (selectable currency),
Time, Date, Plain text. Comparable to Google Sheets mixed with
Airtable.

### Input widgets

For Input cells, valid widgets per `value_type`:
- Number / currency / percent: number field, slider with
  numeric readout, stepper (+/− buttons)
- Boolean: toggle switch, radio pair
- Select: dropdown, radio buttons
- Date: date picker

### Output display modes

Output cells render computed values in one of these modes,
configured per cell:

- **Plain value** — formatted number/currency/etc., with
  optional emphasis (font size, weight, accent colour, or
  auto-positive/negative colour-coding for numeric outputs)
- **KPI / big number** — large prominent value, optional
  inline sparkline below, optional delta indicator
  ("▲ 8% vs. target"), optional status pill ("Healthy")
- **Tabular output** — multi-row tabular value (e.g.
  amortisation schedule). The output cell's formula returns
  an array; the table renders it with configurable columns.

KPI mode is a render variant of an output cell, not a separate
entity. Tabular output is also a render variant — distinct
from the Chart entity but conceptually adjacent.

**Default render mode for array-returning Output cells.** An
Output cell whose formula evaluates to an array (rather than a
scalar) and whose `display_emphasis` has not been explicitly set
falls back to **Tabular** render mode by default. This avoids
the ambiguous state where an array-returning cell renders as
nothing. Maintainers who prefer a different presentation pick
it in the Builder card's expand surface (e.g. Sparkline for an
inline silhouette).

**Tabular output — data model and column configuration.**

- **Data shape:** the formula must return an **array of
  objects**. Each object is one row; its keys are column ids.
  Example: `[{month:1, principal:493, interest:2160},
  {month:2, principal:503, interest:2150}, …]`.
- **Array of scalars** (e.g. `[1, 2, 3, 4]`) is rejected with
  the standard formula-shape error message ("expected array
  of objects, got array of scalars"). The maintainer either
  rewrites the formula to return objects or picks a different
  render mode (Sparkline / KPI). Scalars are never
  auto-wrapped into single-column tables.
- **Column configuration** lives in the Builder cell card's
  expand surface, visible only when `display_emphasis =
  tabular`. The configurator is a repeating list, one entry
  per column, each with:
  - Column **id** — matches the key in the row objects;
    populated automatically on first Tabular selection (see
    auto-population below). Not maintainer-edited; bound to
    the formula key.
  - Column **label** — plain text, maintainer-edited.
  - Column **format** — uses the same vocabulary as cell
    `display_format` (Number / Currency / Percent / Date /
    Plain text). One format system across cells and columns.
  - Column **alignment** — Left / Center / Right (default:
    Right for numeric, Left otherwise).
  - Column **visibility** — visible / hidden toggle.
  - Drag-handle to reorder columns.
- **No per-column width override in v1.** Columns take their
  natural width from the theme's table styling. Power-user
  width control deferred to later.
- **Auto-population on first Tabular selection.** The first
  time a maintainer switches an Output cell into Tabular
  mode, the cell card reads the keys from the **first row**
  of the latest evaluation and creates a column entry per
  key, with label = humanised key (`monthly_payment` →
  "Monthly payment"), format inferred from the value type
  (numeric → Number, currency-shaped → Currency, etc.),
  alignment from inferred type, all columns visible.
  Maintainer refines from there.
- **Inconsistent keys across rows.** Auto-population uses
  **only** keys from the first row; extra keys appearing in
  later rows are ignored and not auto-added as columns. If
  the maintainer wants such columns, they add them manually.
  This keeps behaviour predictable and avoids sparse-table
  edge cases.
- **Key changes after edit.** If the formula is later edited
  and a key disappears (e.g. `principal` →
  `principal_paid`), the column configuration for the
  removed key is dropped, and the new key gets a default
  auto-populated column entry. Same matching-by-name
  behaviour as code-import Smart merge.
- **Empty array** → renders an empty-table state ("No data"
  placeholder in the table area). Formula errors → standard
  red-error treatment (§3 Live sync).
- **No per-row configuration in v1** — no row striping
  toggle, no row selection, no row drill-down. Table renders
  the array as-is with the configured columns.
- **No CSV/JSON export from a tabular output cell in v1** —
  display-only.

**Series detection is implicit, never an explicit cell flag.**
The formula engine determines array-ness from the formula's
evaluation result. There is no `is_series` flag on cells and no
third Grid pill (cells remain Input or Output only). Charts
filter their data pickers by evaluation shape — see §3 Charts.

### Card-level visual settings

Every display element (Cell, Chart, Text-block) has visual
presentation settings that the maintainer can override on top
of the active theme's defaults. These settings live in the
Builder, on the element's card-expand surface — never in the
Grid (the Grid handles data model only; see §3 Editor
architecture).

**Shared across all element types** — the four card-level
properties:

- Accent colour for the card (default: theme accent; choices
  restricted to the theme's palette — no arbitrary HTML colour
  input)
- Background tint: None / Soft / Strong
- Border: None / Hairline / Strong
- Size hint: Narrow / Wide / Full (builder layout suggestion)

**Cell-specific visual settings** (added to the card-level
four):

- Display widget — see §2 Input widgets for the valid widgets
  per `value_type`.
- Display format — e.g. `$ 0,0.00` for currency, `0.00 %` for
  percent. Format string driven by `value_type`.
- Text size — 4–5 preset sizes.
- Text colour — Default / Accent 1 / Accent 2, restricted to
  the theme's palette.
- Output cells additionally have `display_emphasis` choices
  (KPI mode, inline sparkline, delta indicator, status pill —
  see Output display modes above).

**Chart-specific visual settings** (added to the card-level
four):

- Type, Data, Style as defined in §3 Charts (the full
  configurator).

**Text-block-specific visual settings** (added to the
card-level four):

- Text size — same preset sizes as for cells.
- Text colour — Default / Accent 1 / Accent 2, theme palette.

The theme provides sensible defaults for everything. Per-
element overrides let the maintainer emphasise specific cards
without leaving the theme system.

### Display elements

Three kinds sit in slots within sections:
- **Cells** (Input or Output)
- **Charts** — see [§3 Charts](#charts)
- **Text/title blocks** — free maintainer-written prose
  (Markdown). Not tied to any cell. See Text-block rendering
  below.

All three are placed in slots and reordered via drag-and-drop
within a slot or moved between slots. Free-form drag-and-drop
(x/y positioning) is explicitly not supported — slots only.

**Text-block rendering & markdown subset.**

Text-blocks render a GitHub-flavored markdown subset. The
same renderer is used in the Builder preview and the visitor
view, with no behavioural divergence.

- **Supported elements:** paragraphs, bold / italic,
  headings (H2–H4 only; H1 is reserved for the calculator
  hero), unordered and ordered lists, blockquotes, inline
  code, fenced code blocks, horizontal rules, links, and
  images.
- **No syntax highlighting in v1.** Fenced code blocks
  render in plain monospaced styling. A highlighting library
  (Prism / Shiki) is post-v1.
- **Auto-link plain URLs.** Bare `https://` URLs in text
  become clickable links automatically — no need for
  `[text](url)` syntax. GFM-standard behaviour.
- **GFM-style soft breaks.** A single newline becomes a
  visible line break (not a new paragraph). A blank line
  separates paragraphs. More forgiving for prose-writing
  maintainers than CommonMark.
- **Links open in a new tab** with
  `rel="noopener noreferrer"`, injected by the renderer.
- **Images:** external HTTPS URLs only — `https?://` is
  the only accepted scheme. `data:` URIs are rejected by
  the sanitizer schema. No file upload / Supabase Storage
  path in v1. Images render at natural pixel size up to the
  card's content width (`max-width: 100%; height: auto`);
  oversized source images scale down with aspect ratio
  preserved.
- **External image privacy & breakage** (accepted v1 trade-
  off): externally-hosted images leak the visitor's IP to
  the image host and may break if the host is removed. The
  text-block edit surface shows a small inline hint when a
  maintainer adds an image: "Hosted externally — may break
  if the source moves." No proxy, no upload-to-Storage
  fallback in v1.

**Sanitization.**

- **No raw HTML allowed.** Markdown that contains raw HTML
  tags (e.g. typed `<script>alert(1)</script>` in the
  source) is rendered as escaped literal text in both the
  Builder and the visitor view — never executed.
- **Strict allowlist** via `rehype-sanitize` with the
  default schema **minus any HTML pass-through**. The
  pipeline is markdown → AST → sanitize → render-to-React;
  no custom string-based sanitizer.
- **Stripped/rejected:** `<script>`, `<iframe>`, `<object>`,
  `<embed>`, inline event handlers (`onclick`, `onload`,
  etc.), `javascript:` URLs in `href` or `src`, `data:`
  URLs in `src`.
- **No math, no Mermaid, no third-party embeds in v1.** No
  LaTeX renderer, no diagram engines, no YouTube/X/Twitter
  embed cards. Visualisation needs are served by Chart
  elements.

**Length policy.** No enforced character cap on text-block
content (mirrors the calculator-description policy in §2
Entities). Visual layout self-limits — a 10,000-character
text-block looks bad but is not rejected.

**Heading-level vs Card-level Text-size interaction.** The
text-block has a Card-level Text-size setting (4–5 preset
sizes, §2 Card-level visual settings) that sets the block's
overall scale. Markdown headings (H2–H4) inside the block
scale relatively to that base size. Maintainers who want a
"section header" feel commonly pick a larger Card-level
Text-size and write prose, rather than using a markdown
heading — both patterns compose, they don't conflict.

### Calculator visibility — the `published` flag

The `published` flag is an **intent flag**, not a URL gate.
It does NOT control whether the public-token URL is
reachable — tokens are unguessable, so a Draft calculator is
reachable by anyone who has its link. See §3 Publish for the
maintainer-facing behaviour and §3 Public-token URLs for the
URL access rules.

What `published` does control:

- **Presets discoverability for sysadmin-owned
  calculators.** A published calculator owned by a sysadmin
  appears in every Registered User's "Presets" dashboard
  section. A sysadmin-owned Draft calculator does NOT.
- **Maintainer-facing status.** Dashboard cards and the
  editor toolbar show a Published / Draft pill so the
  maintainer can see at a glance which calculators are
  "ready to share".

URL reachability is gated by token validity and soft-delete
state only (§3 Public-token URLs):

- Valid token, calculator exists, not soft-deleted → 200
  (regardless of `published`)
- Token doesn't match any calculator → 404
- Token matches a soft-deleted calculator → 410 during the
  recovery window, then 404 after auto-purge

Drafts start as `published = false`; the maintainer toggles
to `true` to mark "ready to share".

Duplicated (same-account, PROJ-10) and cloned (cross-user,
PROJ-18) calculators are always created with `published =
false` so the new owner reviews before publishing.

### Soft delete

Calculators are soft-deleted on user delete action; final purge
after a configurable retention period — controlled by the
`RETENTION_PERIOD_DAYS` env var (default 30). Auto-purge runs
as a scheduled background job (Supabase scheduled function /
cron) daily, hard-deleting any calculator whose soft-delete
timestamp is older than the retention period. See §4 Account
dashboard / Trash for the recovery surface.

Scenarios are hard-deleted on user action. Scenarios linked to
a soft-deleted calculator become orphan and surface a
"calculator no longer available" page. Registered Users with
orphan scenarios for a still-recoverable calculator get a clone
option; once the calculator is finally purged, orphan scenarios
show an error message to their owner, with the option to
bulk-delete them.

Hard-delete (whether sysadmin "Delete permanently" or auto-
purge) does NOT cascade-delete scenarios. Scenarios remain as
orphan rows so their owners can see and bulk-clear them. Any
destructive-confirm copy for hard-delete must mention this
explicitly: "N scenarios will become orphan."

### Clone attribution

A cloned calculator stores a reference to its source. If the
source is still public, the clone displays "based on
<calculator name>" with a link. If the source has become
unreachable (unpublished, deleted), the attribution becomes an
inactive label. The clone is otherwise fully independent —
edits to either side don't propagate.

---

## 3. Rules & behaviour

### Out of scope for v1

These features are explicitly deferred:

- **Compare mode** — side-by-side scenario comparison on the
  visitor view. Comparison Bar chart (see §3 Charts) is in v1
  but redefined as two cell-array series side-by-side, not
  two-scenario overlay.
- **Datasets** — CSV-imported lookup tables. The dataset
  entity and lookup formulas are not in v1.

### Validation

- Input cell with `editable` MAY have a default value or be left
  empty
- Input cell with `readonly` MUST have a value set by the
  maintainer; the calculator cannot be saved/published otherwise
- Input cell with `hidden` visibility MUST have a value
- Output cell MUST have a formula

### Save model

Calcgrinder uses an **incremental save model**: there is no
"Save" button in cell edit cards.

- **Setting changes** (visibility, editability, widget, format,
  label, description, emphasis, type) save **immediately** on
  change of the control (toggle, dropdown, etc.)
- **Content changes** (name, default value, formula) save **on
  blur** of the form field — i.e. when focus leaves the field
  (Tab, click elsewhere, or Enter for single-line fields)
- This matches the grid panel's behaviour: editing a cell value
  in the grid commits on blur/Enter
- Settings page (profile, security, preferences, danger zone)
  follows the same incremental-save model: no global Save /
  Cancel bar.

To undo unintended changes, the app provides **Undo / Redo** as
a session-scoped feature:
- Cmd-Z / Ctrl-Z and Cmd-Shift-Z / Ctrl-Y keyboard shortcuts
- Undo / Redo buttons in the editor toolbar
- Stack scope: per-calculator-editing-session. Setting changes
  and content changes share one stack.

### Live sync between grid and preview

The editor's two panels (grid and frontend-builder preview)
stay in sync continuously. What "live" means depends on the
change type:

- **Add / remove cell** (and resulting cards) — preview
  updates immediately
- **Setting changes** (any setting; matches save-model
  immediate-save behaviour) — preview updates immediately
- **Input cell value changes** — preview updates immediately
  as the user types in the grid (or on blur/Enter if the
  implementation finds character-by-character recompute too
  expensive — implementer's call)
- **Output cell formula changes** — preview updates **only
  on commit** (blur/Enter). Half-typed formulas don't
  trigger recompute or surface error states until the user
  commits.

**Formula validation feedback.** When an invalid formula is
committed (syntax error, undefined cell reference, cycle):
- The formula text in the grid cell renders with red
  highlighting
- The corresponding output card in the preview renders with
  a red border and a short error message in place of the
  computed value
- Both states clear automatically when the formula becomes
  valid again

The same red-error visual treatment applies when an input
cell receives a value outside its declared range or wrong
type.

### Concurrent editing

A maintainer can have two browser tabs open editing the same
calculator. A sysadmin may be moderating in User Calculators
while the owner is editing. The incremental-save model
amplifies the risk: every committed setting/content change
is its own write.

**Model: optimistic concurrency at calculator-level
granularity.**

- Every write to any part of the calculator (title, theme,
  cells, sections, charts, text-blocks, publish flag, etc.)
  goes through a path that also reads + increments the
  calculator's `updated_at` timestamp.
- Each write request from the client includes the
  `updated_at` the client last saw. If the server's current
  `updated_at` is newer, the write is rejected with HTTP
  409 (stale).
- Cell-level locking is intentionally NOT used. Cell-level
  granularity admits subtle data-divergence — e.g. Tab 1
  edits a formula referencing a cell name that Tab 2 already
  renamed; both writes succeed individually but produce a
  broken calculator. Calculator-level locking keeps the
  model honest.

**Banner UX on 409.**

- The client catches the 409 and surfaces a non-modal banner
  at the top of the editor:
  > "Another session has changed this calculator. Your
  > unsaved changes will be lost on reload."
  >
  > [ Reload ]
- The banner uses the same `EmptyOrErrorState` component
  (banner variant) used elsewhere.
- Until the user reloads, further writes also 409. The
  banner stays visible; there are NO per-write error toasts
  (would be noisy on top of the banner).
- Inputs and edit affordances are NOT disabled. The
  maintainer can still see and interact with their current
  edit state. Effectively a read-only-on-server state until
  reload, with the user's working draft still visible
  locally.
- On reload, the user's in-flight uncommitted changes
  (e.g. mid-formula text) are lost — matches the
  no-autosave behaviour everywhere else.

**Sysadmin-trash variant.** When a sysadmin "Move to Trash"
or "Delete permanently" lands while the owner is editing,
the owner's writes start 410-ing (calculator no longer
addressable). The banner copy adapts:
> "This calculator was moved to Trash by an admin. Your
> unsaved changes won't be saved."
>
> [ Back to Dashboard ]

The action takes the user to the dashboard, bypassing
reload.

### Formula system

What users get:

- Excel-compatible operators and literals
- A large library of built-in functions: math, conditional,
  logical, string, date, financial (PMT, FV, PV, NPV, IRR,
  RATE, etc.), statistical, aggregation, array operations
- Cell references by name (not A1 coordinates)
- Constants (PI, E, TODAY, etc.)

Hard requirements on the engine:

- Reactive recompute on input change
- Cycle detection (no infinite recursion)
- Error propagation as UI error states rather than crashes
- No `eval`. Formulas parse to an AST and evaluate against a
  declared function table. Cell values are data, not code.

### Editor architecture — Grid and Builder surfaces

The editor has two panels on desktop, both visible: **Grid
panel** (top) and **Frontend-builder panel** (bottom). On mobile,
the Builder is always present and the Grid is a toggleable bottom
drawer. They stay live-synced — editing in one updates the other
immediately (matches the live-sync model below).

How each element type is edited — Grid handles the data model,
Builder handles the visual presentation. The two surfaces are
complementary, not duplicate entry points:

**Cells.** Edited from both surfaces, with different
responsibilities:
- Grid panel kebab → inline-expanded column with **data-model
  settings**: Name, Value type (number / currency / percent /
  date / boolean / select / text), Visibility (visible /
  hidden), Editability (editable / readonly), Description,
  Formula (for Output cells).
- Builder card edit-icon → inline-expanded settings card
  below the rendered cell card with **visual-presentation
  settings**: Display widget, Display format, Text size, Text
  colour, plus the four card-level visual settings (Accent,
  Background tint, Border, Size hint). See §2 Card-level
  visual settings for the full list.

The two settings sets do not overlap. Changes in either
surface sync live.

**Charts.** Edited only from the Builder, never from the Grid.
Grid Chart columns are listing-only and narrower than Cell
columns — they show name + chart-type summary + Chart-pill +
kebab. The kebab does NOT inline-expand within the Grid; it
scrolls the Builder to the chart's card, expands it there
(showing the chart-configurator), and pulses a brief ~600ms
highlight on the Grid column to anchor attention. The chart
configurator lives only in the Builder because chart editing
fundamentally requires live preview — the chart renders at the
top of the expanded card, configurator below, live-updating as
the user changes any setting.

**Text-blocks.** Behave like Charts at the Grid level: Grid
column is listing-only and narrower, kebab jumps to the Builder.
In the Builder, expanded text-block cards host the rich-text
editor.

On mobile (no Grid/Builder split — see Hard UI constraints),
the desktop rule above carries over unchanged:

- **Cells** are edited in the Grid drawer's focused-expand
  state. Builder cell cards on mobile have no
  click-to-expand behaviour.
- **Charts** and **Text-blocks** are edited in the Builder,
  not in the drawer. Their drawer rows are listing-only —
  identical in role to the desktop Grid columns. Tapping a
  chart or text-block row in the drawer slides the drawer
  down out of the way (or dismisses it), scrolls the
  builder canvas to the corresponding card, and expands the
  configurator there. The chart's live preview renders at
  the top of the same expanded card, exactly as on desktop.

The rule: the drawer's focused-expand is for Cells only.
Charts and Text-blocks always edit in the Builder because
they need the in-place live preview at the top of the
expanded card.

### Calculator title & description editing

The calculator's `title` and `description` (§2 Entities) have
two edit entry points; the description has one. Both fields
commit incrementally on blur/Enter, like the rest of the
editor.

**Builder hero (in-place, desktop and mobile).**
- The Builder canvas renders the calculator pixel-identical
  to the visitor view, including the hero title and
  description.
- Hovering or focusing the title in the Builder reveals an
  inline edit affordance (no layout shift in the resting
  state). Clicking turns the title into an editable input
  using the active calculator theme's hero typography;
  commits on blur or Enter, reverts on Esc.
- Description has the same in-place pattern but expands to a
  multi-line input. If `description` is empty, the Builder
  renders a faded placeholder ("Add a short description")
  that the visitor view never shows.
- The visitor view has no hero edit affordance.

**Desktop top-bar breadcrumb (in-place, desktop only).**
- The breadcrumb shows `Dashboard / <Calculator name>`.
  Clicking the calculator-name segment turns it into an
  inline rename input; commits on blur or Enter.
- Title changes here propagate live to the Builder hero, and
  vice versa.
- Mobile has no breadcrumb (the top bar is cramped — single
  row with wordmark + calculator name + avatar). Mobile
  title editing happens via the Builder hero only.

The hero in the design files renders a third optional
position above the title (`titleLabel` / eyebrow). That
position is theme demo data and is NOT a calculator
property — themes that use that slot fill it themselves
(e.g. with the section name or a brand label). Only `title`
and `description` are user-editable.

### Section management

Sections (§2 Entities) are pure layout containers in the
Builder. They never appear in the Grid; the Grid stays
section-agnostic and lists every cell in the calculator
regardless of section assignment.

**Edit-in-place section headers.** Each section's title and
optional description are edit-in-place on hover/focus in the
Builder canvas, identical to the calculator hero. Title
commits on blur/Enter; description on blur. Same pattern,
same incremental-save model.

**Section toolbar on hover/focus.** A compact toolbar
attached to the section header is invisible in the resting
state (preserves pixel-identical preview) and reveals on
hover or focus. Contents: drag handle (reorder), layout-
pattern picker (small icon dropdown listing the layout
patterns the active theme exposes for a section), kebab
("Delete section").

**Section hover-border discoverability.** In some themes,
sections are visible cards with backgrounds and borders; in
others they're transparent groupings, distinguished only by
spacing. To keep sections discoverable when transparent, the
Builder canvas draws a subtle hover border around the
section boundary when the maintainer hovers over a section
area. Builder-only — the visitor view never shows this
border. Resting Builder state still matches the visitor view
pixel-for-pixel; hover is not the resting state.

**Add section.** Two paths, both producing an empty section
with default title "New section" and the theme's default
layout pattern:

- The unified "+ Add" picker (Cell · Chart · Text block ·
  Section) — surfaced from the Builder toolbar's "+ Add"
  button and the between-elements seam affordance. Section
  description in the picker reads "Group elements together"
  or similar.
- A persistent "+ Add section" button below the last section
  in the Builder canvas, as a convenience affordance for
  appending sections without going through the picker.

Placement on creation:
- Picker triggered from the Builder toolbar → new section
  appended after the last section.
- Picker triggered from a between-sections seam → new
  section inserted at that seam.
- "+ Add section" convenience button → appended after the
  last section.

**Reorder via drag.** Section drag-handle drags the entire
section block up/down within the calculator. Sections are
flat — no nesting.

**Delete a section.** The section header's kebab → "Delete
section":
- If the section is empty, delete is immediate, no confirm.
- If the section has display elements, a destructive-confirm
  bottom sheet opens: "Delete section «X»? Its N elements
  will be removed too." Elements inside the deleted section
  are removed alongside the section — they do NOT fall back
  into an "Unassigned" bucket.

**Empty section state.** A section with no elements renders
a placeholder card in the Builder reading "Drop elements
here, or use + Add". The visitor view renders the section
title + description and nothing below (no placeholder bleed
through).

**New-element placement defaults.**
- "+ Add" from the Builder toolbar → last section
- "+ Add" from a between-sections seam → section above the
  seam (or new section, if Section is the chosen picker
  option)
- "+ Add cell" from the Grid header → last section
- Code import: see §3 Code import — Smart merge / Append
  new cells go to the last section; Replace all rebuilds a
  single default "Section 1".

**Default starting section.** A new calculator starts with
one empty default section titled "Section 1", using the
theme's default layout pattern. Maintainers can rename it
or add more. Single-section calculators are valid; the
section title is purely a layout-grouping concern.

### Charts

The chart vocabulary v1 supports:
- **Line**, **Bar**, **Area** — series over a domain
- **Pie**, **Donut** — proportional parts of a whole
- **Stacked bar** — categories × sub-categories
- **Comparison bar** — two cell-array series shown as
  side-by-side bars over a shared category axis. Designed
  for comparing two values or value groups within one
  calculator, not for cross-scenario comparison.
- **Sparkline** — minimal silhouette of a single series,
  typically inline in a KPI card
- **Waterfall** — additive/subtractive contribution to a total
- **Bullet** — single value vs. target, with qualitative bands
- **Heatmap** — two-dimensional categorical data as colour
  intensity
- **Radial progress** — single value as a ring fill, percentage
  of a goal

(In v2, Compare Mode lets visitors overlay two scenarios on
any chart type generically. Comparison Bar is not
Compare-Mode-specific.)

Tabular output (e.g. amortisation schedule) is **not** a chart
— it is an output cell render mode. See [§2 Output display
modes](#output-display-modes).

Data source: one or more series cells (cells whose formula
returns an array). Array-ness is detected implicitly from the
formula's evaluation shape — there is no `is_series` flag and
no third Grid pill. The chart data picker filters candidate
cells to those whose latest evaluation is an array. Cells that
temporarily error or change to return a scalar drop out of the
picker; charts that already reference them render an error
state until the formula returns an array again.

Each chart has its own settings: chart type,
series picker referencing grid cells, axis labels, accent
colours from the theme palette, legend on/off, animation
on/off. Chart cards inherit card-level visual settings from
[§2 Card-level visual settings](#card-level-visual-settings).

Smooth animation on value changes (ease-out, no hard cuts).

**Chart configurator structure.** The chart configurator is a
card-expansion in the Builder with the chart rendered live at
the top and three tabs below: Type · Data · Style.

- **Type tab.** 4×3 grid of chart-type tiles (12 tiles).
  Selected tile has accent border + tinted background.
  Changing type commits immediately and applies smart defaults
  (see below).
- **Data tab.** Chart-type-specific data picker with
  user-friendly labels (see Field labels below). For
  multi-series chart types (Line, Bar, Area, Stacked Bar),
  the series list supports drag-to-reorder via a grip-handle
  on the left of each row. Reorder changes legend order,
  stacking order where applicable, and z-order for
  overlapping marks. Colour swatches stay with the series
  identity, not the position.
- **Style tab.** Title · Subtitle · Legend (Auto/Always/Hide)
  · Axis labels (Auto/Always/Hide, greyed for axis-less
  types: Pie, Donut, Sparkline, Radial Progress, Bullet) ·
  Animation toggle · Smooth lines (Line/Area only). Below a
  separator: Card-Level Visual Settings (Accent · Background
  tint · Border · Size hint) — see §2 Card-level visual
  settings.

No Save / Cancel buttons. Settings save incrementally. Close
via chevron-down icon top-right of the settings region.

**Field labels by chart type.** Labels in the Data tab avoid
chart-engine vocabulary ("Domain", "Series") and use
type-specific words that match what the visitor sees:

| Chart type | Field labels |
|---|---|
| Line | "X-axis" + "Lines" + "+ Add a line" |
| Bar | "X-axis" + "Bars" + "+ Add a bar" |
| Area | "X-axis" + "Areas" + "+ Add an area" |
| Pie | "Slice labels" + "Slice sizes" |
| Donut | "Slice labels" + "Slice sizes" + "Centre label" + "Centre value" |
| Stacked Bar | "X-axis" + "Stack layers" + "+ Add a layer" |
| Comparison Bar | "X-axis" + "Series A" + "Series B" + "Labels" |
| Sparkline | "Values" |
| Waterfall | "Steps" + "Change at each step" |
| Bullet | "Actual value" + "Target" + "Performance bands" |
| Heatmap | "Columns" + "Rows" + "Cell colours" |
| Radial Progress | "Current value" + "Goal" + "Centre label" |

Empty-state placeholder wording in pickers uses plain English,
never engine-speak. "Choose which value to plot" or "Choose a
value with multiple entries" — never "Pick a cell that returns
an array".

**Smart defaults on type switch.**
- Type switch carries forward compatible bindings (e.g. Line
  → Bar keeps X-axis and series mappings, just relabels them).
- Type switch to a less-expressive shape (e.g. Line with 3
  lines → Pie which takes 1 series) triggers an inline warning
  row above the type grid: "Pie shows one set of values.
  Switching keeps 'Revenue' and removes 'Cost', 'Profit'." +
  Confirm button. The user can also dismiss by clicking
  another type. This is the only destructive-confirm step in
  the configurator.
- For empty bindings on a fresh chart, defaults are filled
  where the calculator has an obvious candidate: if exactly
  one cell returns an array, it becomes the first X-axis or
  Values picker. No magic beyond "obvious single candidate".

### Scenarios

A scenario is one saved set of input values for one specific
calculator instance, plus a mandatory **title** and an
optional **description**.

**Anonymous saves:** localStorage per browser, per calculator.
Survive across visits. On login, migrated to the user's account
and localStorage cleared.

**Authenticated saves:** server-side in `scenario` table. Owned
by the saving user regardless of who owns the calculator.
Always private. No autosave: changes to a saved scenario are
ephemeral until explicit save (the visitor surface has a Save
Scenario button — distinct from the builder's incremental save
model). Navigation away with unsaved changes triggers a
confirm dialog. Each scenario is bound to one calculator
instance — no automatic linking across preset-and-clone.

**Save-Scenario sheet.** The Save Scenario button opens a
bottom-sheet with: scenario title (mandatory) + scenario
description (optional, multi-line) + list of the user's
existing scenarios for this calculator. The user can either
type a new title (Save button label = "Save") or tap an
existing scenario in the list to overwrite it (Save button
label = "Overwrite"). When the user is currently viewing one
of their own scenarios, that scenario is pre-selected and
marked "(current)".

**Sharing via URL.** Scenarios are sharable via a
server-side share token on the scenario row.

- **URL shape:** `/c/<calc-token>?s=<scenario-share-token>`.
- **Token format:** unguessable, 22-char base64url, ~128
  bits of entropy — same format as the calculator's
  `public_token`. Stored on the scenario row as
  `share_token`.
- **Lazy generation.** The share token is null until the
  scenario's owner presses "Copy link" for the first time
  on that scenario. On first press, the server mints a token
  and persists it; the URL is then copied to the clipboard.
  All subsequent Copy-link presses reuse the same token.
- **Copy-link surfaces.** "Copy link" is shown on every
  Scenarios surface (My Scenarios card kebab, scenario
  header on the visitor view for the scenario owner, Save
  Scenario sheet's existing-scenarios list) regardless of
  whether a token currently exists. Click mints the token if
  needed, then copies.
- **No regeneration / revocation in v1.** Once a share
  token is minted, it persists for the life of the scenario.
  To stop sharing, the owner deletes the scenario (and
  recreates it if they want to keep the values). A
  regenerate-token affordance may come later.
- **Anonymous users have no shareable scenario URLs.**
  Anonymous saves are localStorage-only; the Save Scenario
  sheet for anonymous users surfaces no Copy-link
  affordance. Sign-in is the gate for sharing. After login
  the migrated server-side scenarios can be shared like any
  other (lazy token generation as above).

Arriving via a shared-scenario URL renders the Calculator
interface with:
- All editable input cards locked by default (see Per-field
  lock mechanism)
- A scenario header block between the calculator title and
  the first content section, showing: scenario title,
  optional description, "by <username> · saved <date>"
- A Reset button anchored to the calculator title, visible
  only when the user has diverged from the loaded state

**Structure drift between scenario and current calculator.**

A scenario stores values keyed by cell name. The calculator
may have changed since the scenario was saved — cells
renamed, removed, type-changed, or new cells added.
Best-effort match on apply:

- **Cell renamed or removed** since save → the scenario's
  value for that key is silently skipped.
- **Cell `value_type` changed** since save → skip the
  scenario's value for that cell and use the calculator's
  current default. No per-cell error message.
- **New cells in the calculator** that didn't exist at save
  time → use the calculator's default (or empty if the
  default is empty).

When any value was skipped (i.e. the applied state differs
from the saved state for reasons other than the visitor
unlocking and changing values), a non-modal dismissible
banner appears above the scenario header:

> "Some of this scenario's values couldn't be applied
> because the calculator was updated."

The visitor's "(modified)" indicator on the scenario header
continues to mean only "the visitor has changed something
since load", not "structure drift was applied".

**Scenario-URL deletion / unreachable cases.**

| Source state | Visitor surface |
|---|---|
| Calculator exists, scenario `share_token` matches a row | 200 — apply scenario, render visitor view |
| Calculator exists, no scenario row matches the token | 404 (standard "Scenario not found") |
| Calculator soft-deleted (still in recovery window) | 410 — calculator unavailable, scenario URL inaccessible regardless |
| Calculator hard-deleted / purged | 404 |

Orphan scenarios for the scenario's OWNER are handled
separately via the orphan-scenarios surfaces in §2 Soft
delete; the share-token URL just shows the standard public
error pages.

**Per-field lock mechanism.** Every editable input card in the
Visitor view exposes a lock toggle (open/closed padlock icon)
in the top-right corner of the card, replacing the Builder's
edit-icon slot. The lock is independent of the cell's
`editability` property — it is a visitor-side, temporary,
per-field flag that prevents accidental edits.

Default state:
- Normal calculator URL: all locks open
- Scenario URL: all locks closed

Visualization of locked state:
- Lock icon in theme accent colour, filled (closed padlock)
- Sliders: track and thumb desaturate to ~40% opacity; numeric
  value above the slider stays full opacity
- Number/currency/percent fields: non-interactive; value text
  stays full opacity (never dimmed — would read as placeholder)
- Toggles/radios/dropdowns: non-interactive, slightly
  desaturated
- No card border change; locked state must not break the
  calculator's overall composition

Interaction: tapping the lock icon toggles the field's lock
state. Tapping a locked widget does nothing (no auto-unlock,
no toast). Output cells, hidden cells, and readonly Input
cells are not affected by the lock mechanism.

**Modified indicator.** When the user has unlocked and changed
any value(s) compared to the loaded state (scenario values for
a scenario URL, calculator defaults for a normal URL), the
scenario header block (if present) gets a "(modified)" suffix
next to the scenario title in muted italic, and the
description below greys to ~60% opacity.

**Reset behaviour.** The Reset button appears only when the
state has diverged from initial.
- On a scenario URL: restores input values to the scenario's
  saved values AND re-locks all input cards. Returns the view
  to its initial scenario-loaded state.
- On a normal calculator URL: restores input values to the
  calculator's defaults AND unlocks all input cards.

To return to original calculator defaults from a scenario URL,
the visitor reloads the calculator without the scenario URL
parameters — there is no in-scenario "Reset to original
calculator defaults" affordance.

**Orphan scenarios** — see [§2 Soft delete](#soft-delete).

### Calculator management

Maintainers can:
- Create new (empty)
- Rename, duplicate, soft-delete own calculator
- Export as JSON (backup, external versioning)
- Import calculator from JSON
- Clone any published calculator (sysadmin preset or other
  user's). Clone copies cells, formulas, sections, layout,
  theme, charts, text blocks. Does **not** copy: public token
  (new one minted), scenarios, ownership. Records source's id
  for attribution.

### Code import

A maintenance accelerator, not a core authoring path.

Scope: cells and their properties only — name, type,
value/formula, label, description, unit, min/max/step, display
widget, format. Sections, layout, theming, charts, text
blocks are **not** generated by import. (See note below on
how imported cells get placed into sections.)

Entry point: import button in the grid panel header (sparkles
icon — see [§4 UI](#4-ui)). Click opens a paste surface as an
anchored popover (desktop) or bottom sheet (mobile). Paste
auto-detection: pasting content matching the import format
anywhere in the grid surfaces the same dialog prefilled.

**Three import modes** — the maintainer picks one via a
segmented control at the top of the import surface. Default
is Smart merge.

**Mode A — Smart merge (default).**
- Imported cells are matched to existing cells by `name`.
- **NEW** — source name doesn't exist → cell is added,
  placed in the last section of the calculator (same
  behaviour as "+ Add cell" in the Grid).
- **REPLACED** — source name exists with different content →
  the existing cell is overwritten on the imported
  properties (formula, value, type, format, widget,
  description). The cell keeps its current section and
  position; only its data-model fields are updated.
- **UNCHANGED** — source name exists with identical content →
  skipped, no write.
- Cells that exist in the calculator but NOT in the source
  are preserved untouched. Smart merge is additive/update
  and never destructive.

**Mode B — Append.**
- Strict append, no name matching.
- Source cells are added in source order, all landing in
  the last section.
- Name conflict (source cell has the same `name` as an
  existing cell) → import is blocked with an inline error
  identifying the conflict cell(s). The maintainer switches
  mode or edits source.

**Mode C — Replace all.**
- Destructive: wipes ALL existing cells and ALL sections of
  the calculator.
- Source cells are inserted in source order into a single
  default section ("Section 1").
- Requires a destructive-confirm bottom sheet before
  applying ("This will delete N existing cells and M
  sections. Continue?").
- The maintainer rearranges and re-groups cells into
  sections manually in the Builder afterward.

**Four states in the import surface** (same popover/sheet
container, content swaps):

1. **Paste** — initial state. Mode toggle (Smart merge /
   Append / Replace all, default Smart merge) at the top,
   paste textarea below, "Preview changes" + "Cancel"
   buttons, helper footnote.
2. **Paste with inline errors** — same as Paste, but with
   error rows below the textarea ("Line N: <message>") in
   red. Preview button is disabled while errors exist.
3. **Preview** — header changes to "Preview changes". Helper
   line and preview list adapt to the active mode:
   - **Smart merge:** helper "X new · Y updated · Z
     unchanged". One row per cell with status pill (NEW
     green / REPLACED amber / UNCHANGED muted grey), cell
     name in mono, change summary on the right ("input ·
     currency · default 450000" for NEW; "rate: 5.85% →
     6.20%" for REPLACED; empty for UNCHANGED). Sort: NEW →
     REPLACED → UNCHANGED; UNCHANGED at reduced opacity.
     Footer primary button: "Apply changes".
   - **Append:** helper "X cells to append". All rows render
     as NEW. If any source name conflicts with an existing
     cell, a warning banner names the conflict cell(s) and
     the primary button is disabled. Footer primary button:
     "Append cells".
   - **Replace all:** helper "X cells will replace N
     existing cells and M sections". All rows render as
     NEW. Footer primary button: "Replace and import" in
     destructive (red) styling; clicking opens the
     destructive-confirm bottom sheet before applying.
   - Long lists scroll internally; header and footer stay
     fixed. Secondary buttons in all modes: "Back to code"
     ghost + "Cancel" ghost.
4. **Applied** — surface closes; a toast appears at the top
   of the editor for ~3s with "Imported X cells (N new,
   M updated)" — wording adapts to the mode. The toast is a
   standard editor pattern, not a separate design.

Behaviour:
- Operates on existing calculators
- Operates on partial content: a single cell, several, or a
  full calculator. App detects scope from the code itself
- Default state after import: imported cells are visible

Exact code format syntax is an Open Question — locked at the
Code-import phase. A Claude skill for the format is part of
the deliverables.

### Auth & accounts

Eight auth surfaces in v1:

1. **Login** — email + password
2. **Request access** (signup) — email + password; submits a
   pending account
3. **Waiting for approval** — landing page after signup; same
   page is shown if a denied user tries to log in (denied
   and pending look identical to the user)
4. **Forgot password** — email entry
5. **Sent confirmation** — confirmation that a reset link was
   sent (if the email is known)
6. **Reset password** — landed-on via the reset-link email
7. **Reset success** — confirmation that the password was
   updated
8. **Admin landing** — sysadmin's view when clicking the
   approve/decline link in a signup-notification email
   (approve and decline variants; sysadmin-internal)

**Sysadmin provisioning.** The first sysadmin is provisioned
out-of-band by the deployer via an idempotent npm script
(`npm run seed:sysadmin`) that reads two env vars:

- `SYSADMIN_EMAIL` — login email of the first sysadmin
  account
- `SYSADMIN_INITIAL_PASSWORD` — initial password the
  deployer uses for first login (sysadmin changes it from
  the Settings page after first login)

The script creates the Supabase Auth user via the Admin API
if no user with that email exists, then upserts a
`profiles` row with `role = 'sysadmin'` and `status =
'approved'`. The script is idempotent (re-runnable). It
also accepts `--promote <email>` to elevate an
already-approved user to sysadmin later (covers the rare
"add a second sysadmin" case without a separate tool). No
`--demote` in v1.

There is no first-user-bootstrap on signup.

**Distinct env vars for sysadmin identities and operations.**

- `SYSADMIN_EMAIL` — login account for the first sysadmin
  (above)
- `SYSADMIN_NOTIFICATION_EMAIL` — recipient address for
  signup-notification emails (e.g.
  `notifications@<my-domain>`); read independently by the
  notification-sending code. NOT the same value as
  `SYSADMIN_EMAIL`.
- `RETENTION_PERIOD_DAYS` — soft-delete retention window in
  days (default `30`). Auto-purge cron uses this; see §2
  Soft delete.

**Approval flow:**
- Signup creates user in a pending state
- Notification mail sent to configured sysadmin with
  approve/reject link → Admin landing page on click
- User cannot log in until approved; sees Waiting for
  approval if attempting
- On approval, the user is notified by email and can log in
- On decline, no email is sent to the user. A declined user
  who tries to log in sees the same "Waiting for approval"
  screen as a pending user — the decision is not surfaced.
  This is intentional: denied users should not know they were
  decided against.

**Declined-status reversibility.** Once a user's status is
`declined`, they cannot self-re-apply — re-attempting to log
in keeps showing the same "Waiting for approval" screen
indefinitely. However, a sysadmin CAN manually flip a
`declined` user back to `pending` or directly to `approved`
through a privileged path (rare-use case: "I declined Bob by
mistake"). The privileged surface lives in the
auth-and-approval feature (PROJ-3) or sysadmin moderation
(PROJ-19), not in the infrastructure layer (PROJ-1). At the
database level, the `status` column's CHECK constraint allows
arbitrary transitions between `pending` ↔ `approved` ↔
`declined`; there is no DB-level immutability of `declined`.

Email + password only.

### Account settings

Reached via avatar popover → "Settings". Four sections:

1. **Profile**
   - Name (text, inline editable, save on blur)
   - Email (text, inline editable, save on blur triggers
     verification flow: a verification link is sent to the new
     address; until the user clicks it, the change is pending.
     Pending state is visually indicated on the email field
     with the pending address shown and "Resend" / "Cancel
     change" links.)
   - Role pill — small red filled "SYSADMIN" pill next to the
     row, visible only for sysadmin users. Omitted entirely
     for normal users.

2. **Security**
   - Password change: current password + new + confirm + a
     single "Update password" button. Success shows an
     auto-dismissing inline confirmation. Errors (mismatch,
     wrong current password) show inline.

3. **Preferences**
   - App theme: segmented control (Light / Dark / System).
     Synced with the avatar popover's theme picker.
   - Default calculator theme for new calculators: dropdown
     listing all shipped themes (see Themes shipped in v1).
     Affects new calculators only; existing calculators are
     unchanged.

4. **Danger zone** (visually offset card with subtle red
   border)
   - Delete account: explanatory paragraph + "Delete account"
     destructive button. Opens a destructive confirm bottom-
     sheet. After confirming, the user sees a pending-deletion
     inline info row at the top of Danger zone with "Resend
     verification" / "Cancel pending deletion" links. Final
     deletion happens after the user clicks the confirmation
     link in the email they receive.

Two associated full-page surfaces (no app chrome, wordmark
centred at top, matching auth screens' framing):
- **Email change confirmed** — landed-on via the verification
  link in the new email
- **Account deletion confirmed** — landed-on via the deletion
  confirmation link

### Publish

The `published` flag (§2 Calculator visibility) is an
intent flag. It marks the calculator as ready to share and,
for sysadmin-owned calculators, makes it appear in other
users' Presets section. It does NOT gate URL access (see
Public-token URLs below).

**Maintainer surfaces for the publish toggle:**

1. **Editor toolbar.** The Builder toolbar exposes a
   persistent `Status: Draft / Published` segmented control
   or pill button, right of "+ Add" and the viewport-width
   picker. Clicking it commits immediately (incremental
   save). The first time a calculator is published, an
   inline confirmation appears below the pill with the share
   URL and a copy-link button. Subsequent toggles flip the
   status without re-confirming.
2. **Dashboard card kebab.** Each calculator card on the
   dashboard exposes "Publish / Unpublish" in its kebab menu
   alongside Open, Rename, Duplicate, Delete. Same
   `published` value as the editor toolbar — two entry
   points into the same flag.

**Status pill on dashboard cards.** All dashboard sections
(My Calculators, Presets, User Calculators) display a
Published / Draft pill on every calculator card.

**No publish-version concept in v1.** Publish does not
snapshot. Edits to a published calculator are live for
visitors immediately. Version history is out of scope for
v1 (only session-scoped Undo/Redo).

**Preview button.** The Builder toolbar's Preview button
opens the calculator's public-token URL in a new tab,
regardless of `published` state. Because URLs are
unguessable, opening a Draft calculator's URL is safe — only
the maintainer (and anyone they've shared the link with)
can reach it.

**Duplicated and cloned calculators always start
`published = false`** — already in §2 Calculator
visibility.

### URL structure

The app uses three URL namespaces, kept strictly separate:

- **`/c/<token>`** — the public visitor surface. Token is
  the calculator's `public_token` (see Public-token URLs
  below). Anonymous and authenticated users both land here.
  This namespace has no app chrome (§1 Two surfaces).
- **`/editor/<id>`**, **`/dashboard`**, **`/settings`** —
  the app surface for signed-in maintainers. `<id>` is the
  calculator's internal UUID — NOT the public token.
  Regenerating the public token does not change the
  editor URL, so a maintainer's bookmark to their own editor
  keeps working. Tokens are public-surface only.
- **`/auth/*`** — pre-auth screens: `/auth/login`,
  `/auth/signup`, `/auth/forgot-password`,
  `/auth/sent-confirmation`, `/auth/reset-password`,
  `/auth/reset-success`, `/auth/waiting-for-approval`. The
  sysadmin approve/decline links from signup-notification
  emails also live under `/auth/admin/<approve-token>` with
  approve / decline path variants.

No human-readable slug rewrite (e.g. `/c/<token>/<slug>`)
in v1 — the token URL is short enough, and slug uniqueness
+ title-rename redirects add complexity for zero v1
benefit.

Trailing-slash policy follows the Next.js default; no
trailing-slash rewriting.

The editor's "Preview" button opens the calculator's
`/c/<token>` URL in a new tab, regardless of `published`
state (§3 Publish).

### Public-token URLs

- Tokens are **22-char base64url-encoded random** (~128 bits
  of entropy), generated via a crypto-strong RNG. One token
  per calculator at any time, stored on the calculator row
  as `public_token`.
- Tokens are unguessable, revocable, regenerable. The URL
  shape is fixed: `/c/<token>` (see URL structure above).
- Per-IP rate-limiting on the public surface.
- 404 when the URL doesn't match an existing calculator
  (handles tokens that were regenerated, revoked, mistyped,
  or whose calculator was fully purged after the soft-delete
  window).
- 410 on URLs of soft-deleted calculators during the recovery
  window.
- The `published` flag does NOT gate URL access. URLs are
  unguessable; a calculator with `published = false` is
  reachable by anyone with its link. Published is an intent
  flag — it marks the calculator as ready to share and (for
  sysadmin-owned calculators) makes it appear in other users'
  Presets section.

**Regenerate token surface.** The editor toolbar exposes a
"Sharing" inline-popover next to the publish pill (or via a
kebab on the pill — implementer's call). It shows: the
current `/c/<token>` URL, a Copy button, and a Regenerate
button. Regenerate opens a destructive-confirm bottom sheet:
> "Regenerate URL? All previously-shared links will stop
> working."

On confirm, a new token replaces the old one immediately;
the old URL starts 404-ing. There is no transition window
and no multi-token (multiple-link) sharing in v1.

### Sysadmin moderation

Sysadmin moderation lives **as a section on the dashboard**,
not on a separate route. The dashboard for sysadmin users
contains a fourth collapsible section "User Calculators" at
the bottom, with all calculators across all users.

- Default collapsed
- Visual differentiation: the section's surrounding container
  uses a subtle red tint instead of the neutral surface tint
  used by other sections. No left border, no SYSADMIN pill on
  the section header.
- Card content: same `CalcCard` visual as "My Calculators",
  plus an owner footer row ("by <username> · Edited <date>")
  on the left and status pill (Published/Draft) on the right
- Per-card kebab menu: **Open**, **Move to Trash**, and
  **Delete permanently**.

  - **Move to Trash** — sysadmin-triggered soft-delete with
    the standard retention window (`RETENTION_PERIOD_DAYS`,
    default 30). The card lands in the owner's Trash, not
    the sysadmin's. The owner can restore it. Use case:
    routine moderation cleanup (abandoned test calculators,
    duplicates, etc.). Destructive-confirm body: "Move
    «<title>» to Trash? Owned by <username>. The owner can
    restore this calculator within
    `RETENTION_PERIOD_DAYS` days."
  - **Delete permanently** — bypasses the retention window
    and hard-deletes the calculator immediately. The owner
    cannot restore it. Destructive-confirm bottom-sheet with
    explicit warning: "Permanently delete «<title>»? Owned
    by <username>. This bypasses the
    `RETENTION_PERIOD_DAYS`-day recovery window. The owner
    cannot restore this calculator. N scenarios will become
    orphan." Use case: illegal content, DMCA takedowns,
    policy violations, GDPR erasure requests.

The avatar popover's "Admin" link (sysadmin only) scrolls to
the User Calculators section on the dashboard. Navigating
back to dashboard happens first if the user is not on it.

### Dashboard section behaviour (all users)

All dashboard sections (My Calculators, Presets, My
Scenarios, User Calculators for sysadmin) follow these rules:

- Each section is collapsible. Default: My Calculators
  expanded, others collapsed.
- Section header: chevron + title + count badge.
- When the expanded section's content height exceeds roughly
  two card-rows plus padding, the content area gets
  `overflow-y: auto` and scrolls internally. The section
  itself stops growing.
- Below the height threshold, the section grows to fit its
  content.

No search field, no filter chips, no sort controls, no
pagination. The single-user-leaning scope of v1 doesn't
warrant them.

---

## 4. UI

UI is specified visually, not in prose. The canonical reference
is the design package at `docs/design/` — a working React
prototype of all maintainer-facing and visitor-facing surfaces.
Claude Code should treat the design files as the source of
truth for layout, spacing, typography, colours, and interaction
patterns; this spec only locks the structural rules and
constraints that the design must continue to satisfy.

### Themes shipped in v1

Per design at `docs/design/themes.jsx`. Two calculator themes
ship in v1:

1. **Calcgrinder · Light** — stone neutrals, indigo accent
   (#4F46E5), Geist typography. App-aligned theme. Default for
   new calculators.
2. **Vessel** — contrasting theme, deep neutrals with neon
   accent.

The design file `themes.jsx` defines additional themes
(Editorial · Cream, Calcgrinder · CI, Minimal · Linear, Bento ·
Vibrant, Bento · Glassy, Terminal · Cyber) as design
exploration — these are NOT shipped in v1. The theme system
must be built extensibly: themes are data, not hardcoded
component trees, so additional themes can be added post-v1
without component rewrites.

Calculator-theme choice is per-calculator, maintainer-set in
the builder via the theme picker. The Calculator theme renders
the calculator in both the editor's frontend-builder preview
and at the public visitor URL, identically.

### App theme vs. Calculator theme — two distinct concepts

The app exposes two independent theme settings:

- **App theme** (Light / Dark / System) — controls how the
  app chrome looks: top bar, dashboard, editor frame,
  popovers, settings page. Stored locally per browser /
  device (not synced across devices). Affects only the
  signed-in surfaces.
- **Calculator theme** (one of the shipped themes — see
  Themes shipped in v1) — controls how the calculator interface
  itself looks, both in the editor's frontend-builder preview
  and at the public visitor URL. Set per-calculator in the
  builder. Affects only calculator rendering.

The app chrome stays in the user's chosen App theme regardless
of which Calculator theme any individual calculator uses.

### Hard UI constraints

These constraints prevail over any visual change to the design
package. If a design change conflicts with one of these, the
constraint wins.

**Mobile-first.** No modal dialogs anywhere. App-level menus
surface as bottom sheets (swipe-dismissible). Anchored
popovers (avatar menu, hidden-cells list, import dialog) are
allowed because they don't block the surface.

**Slot-based layout.** Display elements live in slots provided
by the active calculator theme. No free-form x/y positioning.
Themes can have different slot structures.

**Calculator frontend has no app chrome.** No preset list,
no build affordances, no account menu. Only: the calculator
itself, plus Clone button (Registered/Sysadmin only) and Save
scenario.

**Pixel-identical builder preview.** The frontend-builder
panel in the editor renders the calculator pixel-identical to
the public visitor view at the same viewport width. Edit
affordances sit on or inside cards; they do not push card
positions. A maintainer can mentally overlay the builder and
the visitor URL without misalignment.

**Hidden cells render as 0-height dots in the builder.**
Hidden cells must not consume slot space in the builder
preview (would shift layout). They render as small glowing
accent dots positioned between adjacent cards in the slot.
The dot consumes 0 vertical space. Clicking the dot opens the
cell's edit card inline (which DOES temporarily shift layout,
by design; collapses back to a dot on close). In the public
visitor view, hidden cells render NOTHING — not even the dot.
Plus a builder-toolbar pill indicator "X hidden cells" → click
opens an anchored popover listing them by name.

**Add affordances live outside the canvas.** The
frontend-builder panel itself contains no "+ Add" button
(would shift layout). Three add-paths exist instead:
- Grid panel keeps a "+ add cell" affordance at its right edge
- Frontend-builder canvas (when hover is supported by the
  device — typically desktop): a hover-triggered
  between-cards affordance that occupies 0px in the resting
  state and expands to ~3-4px on hover, surfacing a small
  "+". On touch-only devices this affordance does not
  render; the toolbar button below is the path instead.
- Builder toolbar contains a persistent "+ Add" affordance
  that surfaces a small picker (Cell · Chart · Text block ·
  Section) before placing the new element. The between-cards
  seam affordance surfaces the same picker.

**Editor is split-view on desktop, drawer-overlay on mobile.**
On desktop, Grid panel and frontend-builder panel are both
visible at once, separated by a horizontal resize handle.
Editing in one panel updates the other live. On mobile
(where split-view doesn't fit), the layout becomes:
- App top bar (single row)
- Editor toolbar (single row)
- Frontend-builder canvas occupies the rest of the viewport
- A bottom footer nav with three actions: undo/redo group
  on the left, Grid drawer toggle in the centre, view-mode
  / preview on the right
- Tapping the Grid drawer toggle slides up a bottom-docked
  Grid drawer. The drawer overlays the lower portion of the
  builder canvas. The Grid in this drawer is rotated:
  one cell per row instead of one column per cell.
- Tapping a **cell** row in the Grid drawer
  **focused-expands** just that cell's edit card inline.
  The drawer shows only the expanded card; other cells
  collapse to make room. The drawer's height is
  content-driven, capped at 70% of the viewport so the
  builder preview retains ≥30% above. Chevron-down on the
  expanded card closes the focused-expand; the kebab on the
  card also closes it.
- Tapping a **chart** or **text-block** row in the drawer
  does NOT focused-expand inside the drawer. It dismisses
  (or slides down) the drawer, scrolls the builder canvas
  to the corresponding card, and expands the configurator
  in place on that card. Live preview renders at the top of
  the expanded card — same behaviour as desktop. The drawer
  rows for charts and text-blocks are listing-only
  navigation entry points; they have no inline edit surface
  in the drawer.

**Inline-expanding cards, not modals.** Editing a cell's
settings — from either the grid panel header (column expands
downward) or a card in the frontend builder (card grows in
place) — uses inline expansion. No modal dialogs. This is
consistent across desktop and mobile.

**Bottom sheets are the modal-replacement.** Three sheet
variants in v1:
- Save Scenario sheet (scenario title + description + list of
  existing scenarios)
- Destructive confirm sheet (account deletion, calculator
  deletion, scenario deletion)
- Unsaved-changes confirm sheet (navigation guard on visitor
  scenario edits)

All sheets follow the same visual pattern: dim overlay
~`rgba(0,0,0,0.20)`, top-left/right radius 16px, drag handle
36×4px, `t.shadowLg` top shadow.

**Avatar popover is the one allowed popover at app level.**
Top-right circular initial-avatar; click opens a small
anchored popover with name + email, App theme picker
(Light/Dark/System), optional Admin link for sysadmin,
Settings, Sign out.

### Account dashboard

Per design at `docs/design/dashboard.jsx`. Structural rules:

- Hero entry point: prominent "Build a new calculator" button
  at the top — always visible, regardless of section state.
- The dashboard hosts up to five sections in this order:
  **My Calculators**, **My Scenarios**, **Presets**,
  **Trash**, **User Calculators** (sysadmin only).
- **Default expansion:**
  - When the user has at least one own calculator or
    scenario: My Calculators expanded, all others collapsed.
  - When the user has zero own calculators AND zero own
    scenarios: My Calculators and My Scenarios hide entirely
    (see visibility rule below); Presets is shown
    expanded by default as the primary content.
- **Section visibility — hide-when-empty rule.** A section
  is hidden entirely (no header, no placeholder, no "no
  items yet" card) when it has zero content for the current
  user. This applies to:
  - **My Calculators** — hidden when the user has zero
    non-trashed own calculators.
  - **My Scenarios** — hidden when the user has zero saved
    scenarios.
  - **Trash** — hidden when the user has zero soft-deleted
    own calculators (already specified).
  - **User Calculators** (sysadmin) — hidden when there are
    zero other-user calculators in the system (rare; not
    really an empty state in practice).

  **Presets** is the only section that does NOT hide when
  empty. Presets is the primary discovery path for a new
  user and shows its empty state when no sysadmin has
  published any presets yet. (`EmptyOrErrorState`
  variant='empty' inside the section.)

- Welcome line includes a SYSADMIN red pill for sysadmin
  users ("Welcome back, Ada • SYSADMIN").
- Listing shape (applies anywhere multiple calculators are
  listed side by side): only title, description, timestamp,
  plus the card-specific icon-button row (see Card icon sets
  below). User Calculators additionally shows "by <username>"
  in the card footer. No per-cell content, no cell count, no
  "input cells preview". Calculators are heterogeneous —
  column-based comparison across calculators is structurally
  meaningless.
- Section internal scroll when content exceeds two card-rows
  (see §3 Dashboard section behaviour).

**Card click behaviour & icon sets.**

Across all calculator-card surfaces on the dashboard, the
card itself is clickable and opens the calculator's
**public visitor URL (`/c/<token>`) in a new tab**. The
card click is "look at this calculator" — not "edit it".
Per-card actions sit in an icon-button row in the card
footer, with different icon sets per surface:

- **My Calculators** card — 3 icon-buttons:
  - Edit (`Icons.Pencil`) — opens `/editor/<id>` in the
    **same tab**.
  - Public-view (`Icons.External`) — opens `/c/<token>` in
    a new tab (same as card click; explicit affordance for
    discoverability).
  - **Duplicate** (`Icons.Copy`) — creates a same-account
    copy owned by the current user (default Draft, new
    public token), navigates to the new row's
    `/editor/<id>` in the same tab. Naming note:
    "Duplicate" is reserved for the same-account copy
    flow; "Clone" is reserved for the cross-user / Preset
    flow on the Presets card (PROJ-18) — never use "Clone"
    for the same-account action.
  - A kebab menu provides additional actions: Public Link
    (opens `/c/<token>` in a new tab), Rename, Duplicate,
    Publish/Unpublish, Delete (soft-delete → Trash).
- **Presets** card — 2 icon-buttons:
  - Public-view (`Icons.External`) — opens `/c/<token>`
    in a new tab (same as card click; explicit affordance).
  - Clone (`Icons.Copy`) — creates a clone owned by the
    current user (default Draft, new public token),
    navigates to the clone's `/editor/<id>` in the same
    tab. The clone records the preset's id for attribution
    (§2 Clone attribution).
  - No Edit icon — users cannot edit someone else's
    calculator without cloning first.
- **User Calculators** card (sysadmin only) — kebab only.
  See §3 Sysadmin moderation for action set (Open / Move to
  Trash / Delete permanently).
- **Trash** card — kebab only (Restore / Delete
  permanently). See Trash section above.

**My Scenarios surface (list, not cards).**

My Scenarios renders as a list (one row per scenario), not
the card grid used elsewhere. Each row shows: scenario
title, calculator title (the scenario's parent), saved date.
Two row-buttons:

- Edit (`Icons.Pencil`) — opens the parent calculator's
  `/c/<calc-token>?s=<scenario-share-token>` URL **in the
  same tab**, with all locks **open** (the owner is the
  visitor; they don't need locks).
- Public-view (`Icons.External`) — opens the same scenario
  URL in a **new tab**, with all locks **closed** (the
  shared-view rendering, useful for "what does this look
  like to someone I share it with").

Row-level kebab provides: Copy link (lazy-mints the share
token on first press; see §3 Scenarios), Rename, Delete.

**Design-file alignment note.** The design at
`docs/design/dashboard.jsx` currently renders the section
formerly named "Templates" with implicit "click to clone"
behaviour and no per-card icon-button row. It also renders
an inline `EmptyMyCalcs` component as a placeholder when My
Calculators is empty. The implementation must:

- Rename Templates → Presets throughout the surface.
- Add the per-card icon-button rows specified above (3 for
  My Calculators, 2 for Presets).
- Switch card click from clone-action to public-URL-in-new-
  tab.
- Replace `EmptyMyCalcs` placeholder behaviour with the
  hide-when-empty rule (My Calculators and My Scenarios
  render NO header or placeholder when empty; only Presets
  shows an empty state when it has no items).
- Reorder sections to: My Calculators → My Scenarios →
  Presets → Trash → User Calculators (sysadmin).

**Bookmarking arbitrary other users' calculators is a v2
feature.** With the Preset rebrand and the click-to-public-
view behaviour, presets cover the sysadmin-curated case
(effectively a sysadmin-pre-bookmarked set). A general
user-bookmarks surface for non-preset calculators is not in
v1 scope.

**Trash section — soft-delete recovery.**

The Trash section lists the signed-in user's own
soft-deleted calculators. Hidden when empty; appears only
when at least one soft-deleted calculator exists.

- **Card visual** — same `CalcCard` as My Calculators, with
  adjustments:
  - Footer text: "Deleted N days ago · Purges in M days"
    (instead of "Edited <date>").
  - Status pill: small grey "Deleted" pill (replaces
    Published/Draft).
  - Kebab menu: **Restore** and **Delete permanently**.
    Open / Rename / Duplicate / Publish are not available
    from Trash — restoring is the only path back to those.
- **Restore.** Sets the soft-delete timestamp to null,
  preserves the calculator's prior Published/Draft state
  and its public-share token (so existing shared links work
  again post-restore). Orphan scenarios that reference this
  calculator automatically become live again.
  The restored card disappears from Trash and reappears in
  My Calculators in the **same render pass** — no page
  reload, no manual refresh. Animation follows the same
  pattern as undo/redo state changes elsewhere.
- **Delete permanently.** Bypasses the retention window and
  hard-deletes immediately. Opens a destructive-confirm
  bottom-sheet: "Permanently delete «X»? This cannot be
  undone. N scenarios that reference this calculator will
  become orphan." On confirm, hard-delete now.
- **Auto-purge.** A scheduled background job runs daily and
  hard-deletes calculators whose soft-delete timestamp is
  older than `RETENTION_PERIOD_DAYS` (env var, default 30 —
  see §3 Auth & accounts / Sysadmin provisioning). System-
  driven; users don't need to trigger it.

The Trash section never appears on the public visitor URL;
soft-deleted calculators 410 at their public-token URLs
during the recovery window (§3 Public-token URLs).

### Editor

Per designs at `docs/design/editor.jsx`,
`editor-grid.jsx`, `editor-builder.jsx`, `editor-elements.jsx`,
`chart-settings.jsx`. Structural rules:

**Desktop layout:**
- App top bar: wordmark + breadcrumb tab ("Dashboard /
  <Calculator name>") + Calculator-theme picker (visible only
  when editing a calculator) + secondary "+ New calculator"
  button + avatar
- Two-panel split: **Grid panel** (top, compact) +
  **Frontend-builder panel** (bottom, larger). Horizontal
  resize handle between them.
- The Grid panel has a chevron-up control in its header that
  collapses it to a strip (~40px tall) when the maintainer
  wants more builder-canvas space. Re-click expands.

**Grid panel** — spreadsheet-style. One Cell of the calculator
becomes one column. Exactly one data row (the default values
/ formulas). So a 15-cell calculator is 15 columns × 1 row.
Cell column header has name + type pill (Input/Output) +
settings kebab.

The data-row content per cell type:
- Input cells: stored default value (editable inline; commits
  on blur/Enter).
- Output cells: the formula text — regardless of whether the
  formula evaluates to a scalar or an array. Array-ness
  surfaces in the Builder card (via the chosen render mode —
  Tabular, Sparkline, KPI) and in chart data pickers; it is
  not surfaced in the Grid. Kebab expands the header downward inline (all
columns gain matching height to keep the data row aligned).
The inline-expanded card hosts **data-model settings only**
(name, value type, visibility, editability, description,
numeric constraints, default value, formula for Outputs).
Visual-presentation settings (widget, format, text size, text
colour, card-level visuals) are NOT in the Grid — they live
in the Builder. See §3 Editor architecture. Right edge of
the row: "+ Add" affordance that opens the
Cell/Chart/Text-block picker. Grid header strip also contains
an Import button (sparkles icon) opening the code-import
popover, and the Grid-collapse chevron.

Charts and Text-blocks also appear as columns in the Grid,
but visually narrower than Cell columns (listing-only). Their
kebab does NOT inline-expand within the Grid. Instead it
jumps focus to the Builder, expands the corresponding card
in place, and briefly pulses the Grid column to anchor
attention.

**Frontend-builder panel** — renders the calculator in its
live themed look with edit affordances overlaid. Cards
expose hover drag-handle (top-left) and edit-icon
(top-right). Click the edit-icon → inline-expanding settings
card opens in place, content below the live render of the
card itself.

- **Cell card expanded:** inline-expanded settings card opens
  below the rendered card. Hosts **visual-presentation
  settings only** (see §2 Card-level visual settings):
  Display widget, Display format, Text size, Text colour,
  plus the four card-level visual settings (Accent,
  Background tint, Border, Size hint). Data-model fields are
  NOT duplicated here — they live in the Grid surface only.
- **Text-block card expanded:** the edit surface is a
  **plain-text markdown source editor** with a live preview
  rendered alongside (or directly below the source — design
  detail). It is NOT a WYSIWYG editor; a rich
  contenteditable / TipTap / Lexical-style editor is out of
  scope for v1. The live preview uses the same renderer as
  the visitor view (§2 Display elements / Text-block
  rendering), so what the maintainer sees is what visitors
  see. Below the source/preview surface sit the
  visual-presentation settings: Text size, Text colour, and
  the four card-level visual settings. When the maintainer
  adds an image in the source, a small inline hint appears:
  "Hosted externally — may break if the source moves."
- **Chart card expanded:** chart rendered live at top (using
  `charts.jsx` components), three-tab configurator below
  (Type / Data / Style) — see §3 Charts for tab content.
  Live preview updates as the user changes any setting.

See "Hard UI constraints" for pixel-identity and hidden-cell
behaviour.

**Builder toolbar** (between resize handle and canvas):
Preview button (opens public token URL in new tab) ·
hidden-cells pill (if applicable) · "+ Add" (opens
Cell/Chart/Text-block picker) · viewport-width picker
(Desktop/Tablet/Mobile).

**Undo / Redo** controls — keyboard shortcuts plus visible
buttons in the editor toolbar. Per-calculator-session stack.

**Mobile layout** — see Hard UI constraints / Editor is
split-view on desktop, drawer-overlay on mobile.

- **Cell** edit settings live in the Grid drawer's
  focused-expand state on mobile. Builder cell cards on
  mobile have no click-to-expand-in-place behaviour.
- **Chart** and **Text-block** edit settings live on the
  Builder cards in place — same as desktop. Their Grid
  drawer rows are listing-only navigation entry points;
  tapping a row slides the drawer down, scrolls the
  builder canvas to the card, and expands the configurator
  there with the live preview at the top.

### Visitor view

Per designs at `docs/design/visitor-view.jsx`,
`visitor-3col.jsx`, `visitor-locks.jsx`, `cafe-margin.jsx`.
Structural rules:

- No app chrome
- Optional small top-corner Clone button (Registered/Sysadmin
  only)
- Save-scenario affordance
- Calculator title (hero, themed), optional description, then
  themed content (sections, slots, cards)
- When loaded via scenario URL: scenario header block
  between calculator title/description and content; Reset
  button anchored to the calculator title when state has
  diverged
- Per-field lock toggle on every editable input card (see
  §3 Per-field lock mechanism)
- Small "by <brand name>" subbrand in the footer, linking
  back to the app

### Auth screens

Per design at `docs/design/auth.jsx`. Structural rules:

- All eight auth surfaces share a common framing: centred
  card, wordmark at the top, no app chrome
- Email + password fields are the only inputs
- Admin landing surfaces are sysadmin-internal — reached via
  the approve/decline link in signup-notification emails

### Empty and error states

Per design at `docs/design/states.jsx`. A single reusable
component `EmptyOrErrorState` handles all empty-section and
error surfaces with two variants:

- `variant='empty'` — dashed border, surface2 background.
  Used only for the Presets section's empty state ("no
  presets yet"). My Calculators and My Scenarios sections
  do NOT show this state — they hide entirely when empty
  (see §4 Account dashboard / hide-when-empty rule).
- `variant='error'` — solid border or `framed={false}` for
  full-page contexts. Used for orphan-scenario pages
  (recoverable and final), public-URL errors —
  "Calculator not found" (404) and "Calculator deleted"
  (410) — and email-confirmation landing pages. User-facing
  copy on these pages avoids backend vocabulary like "token"
  or "revoked"; speak in user-level terms ("a calculator
  that doesn't exist" / "a calculator that was deleted").

### Settings page

Per design at `docs/design/settings.jsx`. Structural rules
match §3 Account settings — single-column, four sections,
incremental save, destructive bottom-sheet for account
deletion, red SYSADMIN pill on the role row for sysadmins.

### Moderation surface

Lives on the dashboard, not on a separate route. See §3
Sysadmin moderation for behaviour.

---

## Related (once repo exists)

- `README.md` — install, dev, deploy, env vars
- `docs/design/` — design package referenced throughout §4
- `features/` — per-feature specs created via `/write-spec`
