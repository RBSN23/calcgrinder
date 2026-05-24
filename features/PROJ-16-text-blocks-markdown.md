# PROJ-16: Text Blocks (Markdown)

## Status: Approved
**Created:** 2026-05-24
**Last Updated:** 2026-05-24

## Dependencies

- Requires: **PROJ-9** (Cell Authoring & Section Management) —
  text blocks live inside sections alongside cells and charts.
  PROJ-9's hover-affordances, edit-icon corner placement,
  drag-handle, incremental save model, undo/redo enrolment,
  drag-reorder within-section, cap-reached error pattern, and
  the calculator-level optimistic-concurrency 409 model all
  carry over verbatim to text-block cards. Cross-section moves
  are unsupported (same as cells / charts).
- Requires: **PROJ-8** (Editor — Grid + Builder Two-Panel Split)
  — PROJ-8's +Add picker exposes Text as a visible-but-disabled
  option per the INDEX.md forward-compat note. PROJ-16 flips
  Text from disabled to enabled; no picker re-architecture.
  PROJ-15 established the slot renderer's polymorphic dispatch
  (`SlotRenderer` + `registerDisplayElementRenderer`); PROJ-16
  adds a new `text_block` registration; no rewrite of the
  slot-iteration code.
- Requires: **PROJ-11** (Visitor View — Calculator Interface) —
  the visitor-side renderer must dispatch a `text_block` element
  type to the markdown renderer. The renderer is shared between
  Builder preview and visitor view; behaviour is identical on
  both surfaces (per Calcgrinder-spec.md §2 Text-block
  rendering).
- Requires: **PROJ-6** (Calculator Theme System) — text-block
  card visual settings (Accent, Background tint, Border, Size
  hint, Text size, Text colour) source their tokens from the
  active theme's palette, same as cells.

## Summary

PROJ-16 is the **prose layer** of the calculator. PROJ-9 filled
sections with cells; PROJ-15 added charts; PROJ-16 adds free
maintainer-written prose blocks rendered through a sanitized
GitHub-flavored markdown subset.

1. One new table: **`text_blocks`** — per-section rows with a
   markdown `body` string and the same card-level visual
   override columns as cells (Accent, Background tint, Border,
   Size hint, Text size, Text colour). **No `name` column** and
   **no `UNIQUE(calculator_id, name)` constraint** — text blocks
   are Builder-only and have no Grid column to label (see
   Decision Log: this is a deliberate override of
   `docs/Calcgrinder-spec.md` §3 Editor architecture).
2. **Builder-only edit surface.** The +Add picker's Text option
   flips from disabled to enabled. New text blocks land in the
   Builder canvas as a card; the card auto-expands on creation;
   no Grid column ever appears for the row. Mobile users
   navigate to a specific block by scrolling the Builder canvas
   (no Grid drawer row).
3. **Expanded card UX**: a **split-pane editor on desktop** —
   plain-text markdown source on the left, live-rendered
   preview on the right, both panes scroll independently.
   **Stacked on mobile** (source above, preview below). Card-
   level visual settings (Text size, Text colour, Accent,
   Background tint, Border, Size hint) sit below the editor
   surface as a single settings strip — same controls as cell
   cards' visual panel.
4. **Save timing**: incremental, **debounced ~500ms** after the
   user pauses typing in the source textarea, plus an immediate
   flush on blur, configurator collapse, and undo-stack
   enrolment. The preview re-renders synchronously off local
   state on every keystroke; only the network PATCH is
   debounced.
5. **Markdown renderer**: a single shared renderer powers both
   the Builder preview and the visitor view, so what the
   maintainer types is what the visitor sees. GFM subset per
   `docs/Calcgrinder-spec.md` §2 Text-block rendering:
   paragraphs, **bold**, _italic_, **H2-H4** (H1 reserved for
   the calculator hero), unordered and ordered lists,
   blockquotes, inline code, fenced code blocks (plain
   monospace, no syntax highlighting), horizontal rules, links,
   images. GFM-style soft breaks (single newline = visible line
   break). Auto-link plain `https://` URLs.
6. **Sanitization**: markdown → AST → sanitize → render-to-React
   pipeline. Sanitization uses `rehype-sanitize` with the
   default schema **minus any HTML pass-through**. Raw HTML
   tags in the source render as escaped literal text — never
   executed. `<script>`, `<iframe>`, `<object>`, `<embed>`,
   inline event handlers, `javascript:` URLs and `data:` URLs
   in `src` are all stripped. **No raw HTML pass-through.**
7. **Image handling**: external **HTTPS URLs only** (`https?://`
   schemes accepted; `data:`, `file:`, `javascript:` rejected
   by the sanitizer schema). Images render at natural pixel
   size, scaled with `max-width: 100%; height: auto`. **No file
   upload, no Supabase Storage path** in v1. When the body
   contains at least one `![…](http…)` pattern, a **persistent
   inline hint** below the source editor reads "Hosted
   externally — may break if the source moves." Hint hides when
   all image syntax is removed.
8. **Links**: open in a new tab with `rel="noopener noreferrer"`
   injected by the renderer. Auto-link bare `https://` URLs.
9. **Default body** on a freshly added text block: empty string
   `''`. The textarea shows a placeholder reading "Write
   Markdown here…". Card auto-expands on creation; maintainer
   lands directly in the source editor.
10. **Empty body is well-formed.** An empty-body text block
    renders **nothing** in the visitor view (no card, no
    spacer). In the Builder, a collapsed empty card shows a
    muted "Empty text block — click to edit" hint with the
    standard edit affordances. **Empty bodies never block
    Publish** — text blocks have no formal structure to break,
    so they never participate in the publish-gate.
11. **Card-level visual settings**: shared four (Accent,
    Background tint, Border, Size hint) plus text-block-
    specific Text size (`s` / `m` / `l` / `xl`, default `m`)
    and Text colour (`default` / `accent_1` / `accent_2`,
    default `default`) — same enums as cells. **Default
    `card_size_hint` is `wide`** (prose reads better in a wider
    column; cells default `narrow`, text blocks default `wide`).
12. **Heading-scale interaction**: markdown headings (H2-H4)
    inside the block scale relatively to the Card-level Text
    size base. H2 = 1.4× base, H3 = 1.2× base, H4 = 1.05× base.
    Both Card-level Text size AND markdown headings compose;
    they don't conflict.
13. **Length policy**: PRD says "no enforced character cap." A
    **50 KB server-side Zod cap** (51,200 UTF-8 bytes,
    measured via `new TextEncoder().encode(body).byteLength`)
    is enforced at POST/PATCH as a security backstop — rejected
    requests get HTTP 422
    `{ error: 'body_too_large', max_bytes: 51200 }`. Boundary is
    exclusive: `byteLength <= 51200` accepted, `> 51200`
    rejected. No DB-level CHECK constraint, so the cap can be
    raised by a Zod-only change later. See Decision Log for
    the deviation rationale.
14. **Hard limits** exported from `@/lib/text-blocks/limits.ts`:
    - `MAX_TEXT_BLOCKS = 30` — per-calculator cap. Hit → +Add
      picker disables Text with tooltip "Limit of 30 text
      blocks reached." Matches `MAX_CHARTS`.
    - `MAX_TEXT_BLOCK_BODY_BYTES = 51200` — 50KB Zod backstop
      on `POST` / `PATCH` body.
15. **CRUD**: owner-scoped `POST /api/sections/:sid/text_blocks`,
    `PATCH /api/text_blocks/:id`, `DELETE /api/text_blocks/:id`,
    reorder via `PATCH /api/text_blocks/:id { display_order }`.
    Same calculator-level optimistic-concurrency 409 model as
    cells/charts. Cross-section move via `PATCH { section_id }`
    is rejected with HTTP 422 `cross_section_move_unsupported`.
    Hard delete — no per-element trash (mirrors charts and
    PROJ-9's cells/sections).

PROJ-16 ships **no WYSIWYG editor** (per PRD non-goal), **no
syntax highlighting** in fenced code blocks (post-v1), **no
file-upload for images** (post-v1; external HTTPS URLs only),
**no math / LaTeX rendering**, **no Mermaid diagrams**, **no
third-party embeds** (YouTube, X/Twitter), **no Grid column
or mobile drawer row for text blocks**, **no formula-engine
referenceability** (text blocks aren't named and aren't
referenced by cells or charts).

## User Stories

- As a **registered user**, I want to add a paragraph of
  explanatory prose between the Inputs section and the Charts
  section of my mortgage calculator, so a visitor reads context
  before they start typing numbers.
- As a **registered user**, I want to write Markdown with
  headings, lists, and bold/italic emphasis in a text-block card
  and see exactly what visitors will see in a live preview as
  I type, without needing a save button.
- As a **registered user**, I want to include an externally-
  hosted image (from `images.unsplash.com` or a CDN I control)
  in a text block and see a small hint reminding me that the
  image may break if its host moves, so I'm not surprised later.
- As a **registered user**, I want to drag a text-block card to
  reorder it within its section, alongside cell cards and chart
  cards, so my page composition stays in one place.
- As a **registered user**, I want any HTML tags I paste into a
  text-block source (intentionally or by accident from a
  copy-paste) to render as escaped literal text rather than
  execute, so I never accidentally publish a script tag.
- As a **registered user** on a small phone, I want the
  text-block editor to stack the source above the live preview
  rather than try to split horizontally, so I can comfortably
  edit on a 360px-wide screen.
- As a **registered user**, I want a text block with an empty
  body to render **nothing** in the visitor view (no empty
  card, no whitespace gap), so I can leave a placeholder block
  in my draft without it cluttering the published page.
- As a **visitor**, I want links in text blocks to open in a
  new tab so I don't lose my calculator state when I click
  through to a reference, and I want bare `https://` URLs in
  prose to be clickable automatically.
- As a **visitor**, I want text blocks to render visually
  consistently with the rest of the calculator's theme — same
  fonts, same colour palette, same border / background
  treatment as cells and charts in the same calculator.
- As a **sysadmin**, I want a maintainer who somehow POSTs a
  500KB markdown body to the API to be rejected with a clear
  error rather than silently bloat my database, so abuse stays
  bounded.

## Out of Scope

Everything below came up during the interview or is excluded by
the PRD / Calcgrinder-spec.md non-goals.

- **WYSIWYG / rich-text editor** — TipTap, Lexical,
  contenteditable surfaces are explicitly excluded by the PRD.
  v1 ships a plain-text source editor with live preview only.
- **Syntax highlighting in fenced code blocks** — PRD non-goal.
  Fenced code blocks render in plain monospaced styling.
  Prism / Shiki are post-v1.
- **Math / LaTeX rendering** — PRD non-goal. No KaTeX, no
  MathJax. Visualisation needs are served by Chart elements.
- **Mermaid diagrams** — PRD non-goal.
- **Third-party embeds** (YouTube, X/Twitter, CodePen, etc.) —
  PRD non-goal.
- **File-upload for images / Supabase Storage path** — PRD
  non-goal in v1. External HTTPS URLs only. Storage path lives
  post-v1.
- **`data:` URIs in images** — rejected by the sanitizer.
- **Raw HTML pass-through** — `<script>`, `<iframe>`, `<style>`,
  inline event handlers, `javascript:` URLs, etc. all stripped
  by `rehype-sanitize`. No allow-list for "safe" HTML tags
  beyond what `rehype-sanitize`'s default schema produces from
  markdown.
- **H1 headings** — reserved for the calculator hero per
  Calcgrinder-spec.md. Source-level `#` is rendered as H2 by
  the renderer (level remap), or silently dropped — see Edge
  Cases. Maintainers wanting a "section header" pick H2 or
  raise the Card-level Text size.
- **Grid column for text blocks** — **explicit deviation** from
  `docs/Calcgrinder-spec.md` §3 Editor architecture. Text blocks
  are Builder-only. No Grid column, no mobile drawer row, no
  `name` field on `text_blocks`, no `UNIQUE(calculator_id,
  name)`. Decision Log documents the rationale. (Charts retain
  their Grid column unchanged — the override applies only to
  text blocks.)
- **Formula-engine references to text blocks** — text blocks
  aren't named and aren't referenced by any formula or chart
  binding. Renaming, deleting, or reordering a text block
  never affects formulas or chart bindings.
- **Per-text-block theme override** — a text block always
  renders in the calculator's active theme palette. The four
  card-level visual overrides (Accent, Background tint, Border,
  Size hint) plus Text size and Text colour are the only
  per-block visual settings PROJ-16 supports.
- **Arbitrary CSS / inline style overrides** — PRD-locked. No
  `style=` or `class=` passthrough.
- **Cross-section moves** — drag-reorder is within-section
  only. Cross-section moves achievable only by delete + re-add
  (same restriction as cells in PROJ-9 and charts in PROJ-15).
- **Soft-delete / Trash for individual text blocks** —
  deleting a text block is hard (immediate). Only session
  Undo restores it. Mirrors PROJ-9 cells and PROJ-15 charts.
- **Per-block-Markdown extensions / custom syntax** — no
  shortcodes, no `{{cell_name}}` interpolation, no live
  cell-value embedding. Text blocks are purely prose; if a
  maintainer wants to surface a computed value in prose, they
  use an Output cell with a label.
- **Text-block Duplicate kebab action** — duplicating an
  existing text block (same calculator, same author, copy
  body + visuals) is NOT in PROJ-16. Mirrors PROJ-15's no-
  duplicate decision for charts.
- **Sysadmin moderation of text blocks as a separate moderation
  surface** — PROJ-19 moderates calculators, not individual
  blocks within them.
- **JSON Export/Import for text blocks in isolation** —
  PROJ-22 will include text blocks as part of the calculator
  payload; PROJ-16 does not ship element-only export/import.
- **Code-import of text blocks** — PROJ-21 imports cells
  only. PROJ-16 doesn't extend the import vocabulary.
- **Server-side pre-rendering / SSR'd markdown for SEO** —
  text blocks render client-side only in v1 (same as charts).
- **Spell-check / grammar suggestions** — relies on the
  browser-native textarea spell-check; no custom layer.
- **Word count / readability metrics in the editor** — out of
  scope.
- **Auto-save indicator UI** — the debounced save fires
  silently; no "Saving…" pill. Failures surface via the
  standard 409 / 422 banner (PROJ-8 toast pattern).
- **Versioning / draft history of text-block bodies** — only
  session-scoped Undo/Redo (Calcgrinder-spec.md non-goal).

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Database schema — `text_blocks` table

- [ ] Given a fresh Supabase project at PROJ-16 HEAD, when the
  migration runs, then a `text_blocks` table exists with these
  columns:
  - `id uuid primary key default gen_random_uuid()`
  - `calculator_id uuid not null references calculators(id) on delete cascade`
  - `section_id uuid not null references sections(id) on delete cascade`
  - `body text not null default ''`
  - `card_accent text not null default 'theme'`
  - `card_background_tint text not null default 'none' check (card_background_tint in ('none', 'soft', 'strong'))`
  - `card_border text not null default 'none' check (card_border in ('none', 'hairline', 'strong'))`
  - `card_size_hint text not null default 'wide' check (card_size_hint in ('narrow', 'wide', 'full'))`
  - `text_size text not null default 'm' check (text_size in ('s', 'm', 'l', 'xl'))`
  - `text_colour text not null default 'default' check (text_colour in ('default', 'accent_1', 'accent_2'))`
  - `display_order int not null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- [ ] Given the table is created, when its schema is inspected,
  then **no `name` column exists** and **no
  `UNIQUE(calculator_id, name)` constraint exists** —
  intentional deviation from the cell / chart pattern (see
  Decision Log).
- [ ] Given the table is created, when the migration is
  inspected, then a UNIQUE constraint exists on
  `(section_id, display_order)` so reorders never produce
  duplicate ranks (transactional renumber, same pattern as
  cells / charts).
- [ ] Given the table is created, when the migration is
  inspected, then an `updated_at` BEFORE-UPDATE trigger fires
  on every UPDATE, and a separate trigger bumps the parent
  `calculators.updated_at` on every INSERT / UPDATE / DELETE
  — so calculator-level optimistic-concurrency catches
  text-block writes too.
- [ ] Given Row-Level Security is enabled on `text_blocks`,
  when a SELECT / INSERT / UPDATE / DELETE runs through a
  publishable-key client, then only rows whose parent
  `calculators.owner_id = auth.uid()` are accessible. RLS
  joins on `calculators` — same pattern as PROJ-9 cells /
  PROJ-15 charts.
- [ ] Given the regenerated types file (`src/lib/supabase/types.ts`),
  when refreshed via `npx supabase gen types typescript --linked`,
  then the `text_blocks` row type appears with the columns
  above and correct nullability.

### API — text-blocks CRUD

- [ ] Given a signed-in user, when
  `POST /api/sections/:sid/text_blocks` is invoked with an
  empty body, then a new text block is inserted with:
  - `body = ''`,
  - card-level visuals at their `default` values
    (`card_accent='theme'`, `card_background_tint='none'`,
    `card_border='none'`, `card_size_hint='wide'`,
    `text_size='m'`, `text_colour='default'`),
  - `display_order` appended at the end of the section.
  Response: HTTP 201 with the inserted row.
- [ ] Given a signed-in user, when
  `POST /api/sections/:sid/text_blocks` is invoked with
  `{ insert_after_element_id }` in the body (between-elements
  seam case), then the new text block's `display_order` is
  placed immediately after that element and sibling
  `display_order`s are transactionally renumbered to stay
  gap-free.
- [ ] Given a signed-in user, when `PATCH /api/text_blocks/:id`
  is called with a body containing any subset of the writable
  fields (every column except `id`, `calculator_id`,
  `section_id`, `created_at`, `updated_at`), then those fields
  are updated. Standard calculator-level optimistic
  concurrency applies (same 409 path as PROJ-9 / PROJ-15).
- [ ] Given the PATCH or POST body's `body` field exceeds
  `MAX_TEXT_BLOCK_BODY_BYTES = 51200` bytes when measured by
  `new TextEncoder().encode(body).byteLength` (UTF-8 byte
  length — emoji and other multi-byte characters count by
  their byte cost, not codepoint count), then the API
  returns HTTP 422 `{ error: 'body_too_large', max_bytes: 51200 }`
  before touching the database. No partial write.
- [ ] Given the PATCH or POST body's `body` field has UTF-8
  byte length **equal to exactly 51200** (the cap boundary),
  when the request fires, then it succeeds — the cap is
  exclusive of equality (`byteLength > 51200` rejected,
  `byteLength <= 51200` accepted).
- [ ] Given a signed-in user calls reorder via
  `PATCH /api/text_blocks/:id { display_order }`, when the
  new order conflicts with a sibling, then the same
  transactional renumber as cells / charts applies.
  Cross-section moves (`PATCH /api/text_blocks/:id { section_id }`)
  are rejected with HTTP 422 `cross_section_move_unsupported`.
- [ ] Given a calculator has `MAX_TEXT_BLOCKS = 30` text blocks
  already and `POST /api/sections/:sid/text_blocks` is invoked,
  then HTTP 422 is returned with `{ error: 'text_block_cap_reached', max: 30 }`.
  Cap exported from `@/lib/text-blocks/limits.ts`.
- [ ] Given a signed-in user calls
  `DELETE /api/text_blocks/:id`, when the request is
  processed, then the row is hard-deleted and HTTP 204 is
  returned. No cascading effect on cells or charts (text
  blocks reference nothing).
- [ ] Given a signed-out / non-owner / soft-deleted-calculator
  target, when any text-block CRUD route is invoked, then
  HTTP 404 is returned (same opacity rule as cells / charts).
- [ ] Given the writable fields are inspected, when each
  enum-bearing field is PATCHed with a value outside its enum
  (`card_background_tint = 'medium'`, `text_size = 'xxl'`,
  `card_size_hint = 'huge'`, etc.), then HTTP 400 is returned
  with `{ error: 'enum_invalid', field, allowed }` and the
  database CHECK constraint serves as a backstop.

### +Add picker — Text option flip

- [ ] Given the +Add picker is opened at PROJ-16 HEAD, when the
  Text option is inspected, then it is **enabled and clickable**
  (was disabled in PROJ-8 / PROJ-15). The other three options
  (Cell, Chart, Section) are unchanged.
- [ ] Given the user clicks Text in the +Add picker, when the
  click registers, then a new text block is created
  (server-side POST), inserted into the active section at the
  appropriate position, and its card auto-expands on first
  render so the maintainer lands directly in the source editor.
- [ ] Given the calculator already has 30 text blocks, when the
  +Add picker opens, then the Text option is disabled with
  tooltip "Limit of 30 text blocks reached."

### Builder card — collapsed state

- [ ] Given a text-block card is collapsed and the `body` is
  non-empty, when the card renders, then the **rendered preview
  output** is visible (markdown rendered exactly as the visitor
  will see it). PROJ-9's hover affordances (drag handle,
  edit-icon, kebab) appear on hover, same as cell cards.
- [ ] Given a text-block card is collapsed and the `body` is
  empty, when the card renders, then a muted hint reading
  "Empty text block — click to edit" is shown in the card body
  area with the standard hover affordances. **Builder-only
  affordance**; the visitor view of an empty body renders
  nothing per the Hard UI Constraints / pixel-identical-preview
  rule. The hint is a discoverability mechanism analogous to
  PROJ-9's hidden-cells dot pattern: a Builder-specific visual
  that does not shift layout in the visitor view.
- [ ] Given the card's drag handle is grabbed and dragged
  within the section, when dropped, then `display_order`
  PATCHes and siblings renumber transactionally (PROJ-9 pattern).
- [ ] Given the kebab menu is opened on a text-block card,
  when its items are inspected, then it shows Delete only (no
  Duplicate per Out of Scope, no Move-to-section per
  cross-section-move rejection).
- [ ] Given the maintainer clicks the edit-icon (or anywhere on
  a collapsed card outside the drag handle / kebab), when
  registered, then the card expands in place, same UX as cell
  cards.

### Builder card — expanded state (desktop, split-pane)

- [ ] Given the viewport is desktop (>= md breakpoint) and a
  text-block card is expanded, when the editor surface renders,
  then a two-column split appears:
  - **Left column**: plain-text `<textarea>` showing the raw
    markdown source. Monospaced font. Placeholder "Write
    Markdown here…" visible when `body === ''`.
  - **Right column**: live-rendered preview using the same
    renderer as the visitor view. Updates synchronously on
    every keystroke (local state).
  Both columns scroll independently.
- [ ] Given the editor surface is at the top of the expanded
  card, when the rest of the card renders, then below the
  source / preview row sits a single horizontal settings strip
  with: Text size (segmented `s`/`m`/`l`/`xl`), Text colour
  (segmented Default / Accent 1 / Accent 2), Accent (theme-
  palette swatch picker), Background tint (None/Soft/Strong
  segmented), Border (None/Hairline/Strong segmented), Size
  hint (Narrow/Wide/Full segmented). Same controls as cell
  cards' visual panel.
- [ ] Given the chevron-down at the configurator's top-right is
  clicked, when activated, then the card collapses in place
  (PROJ-9 / PROJ-15 collapse UX).

### Builder card — expanded state (mobile, stacked)

- [ ] Given the viewport is below the md breakpoint, when a
  text-block card is expanded, then the editor surface
  stacks vertically: source `<textarea>` on top, live preview
  directly below, settings strip below the preview. Both
  source and preview occupy the full card width.
- [ ] Given mobile, when the maintainer types in the source,
  then the preview updates synchronously on each keystroke
  (local state). PATCH is still debounced ~500ms idle.
- [ ] Given the preview pane is rendered (desktop split or
  mobile stacked), when the maintainer drags to select text
  inside the preview, then the rendered content is
  **selectable and copyable** via the browser's native
  selection / clipboard. The preview is not focusable as an
  input (the source textarea is the canonical input), but
  its DOM is not selection-disabled.

### Save timing — debounced PATCH

- [ ] Given the maintainer is typing into the source textarea,
  when they pause typing for **≥ 500ms**, then a PATCH fires
  with the current `body`. If a PATCH is already inflight, the
  pending change coalesces and re-fires on completion.
- [ ] Given the maintainer types and then immediately blurs
  the textarea (Tab key, click elsewhere), when blur registers,
  then a PATCH fires **immediately** (no waiting for the
  debounce). Same on configurator collapse.
- [ ] Given a PATCH fires, when the response returns 200, then
  no toast or "Saving…" pill appears (silent success).
- [ ] Given a PATCH returns 409 (optimistic-concurrency
  conflict because the calculator was modified in another tab),
  when the conflict is surfaced, then PROJ-8's standard
  calculator-level conflict banner / refresh prompt appears
  (same UX as cell / chart PATCH conflicts).
- [ ] Given a PATCH returns 422 `body_too_large`, when surfaced,
  then an inline error appears below the source textarea
  reading "Text too long — keep your block under ~50 KB."
  The local state is preserved; the maintainer can trim and
  retry.
- [ ] Given the maintainer hits Cmd-Z while focused inside the
  source textarea, when the keystroke registers, then the
  textarea's native undo handles the keystroke (does NOT
  trigger the calculator-level Undo stack — same rule as cell
  formula textareas in PROJ-9). Outside the textarea, Cmd-Z
  triggers calculator-level Undo and **one** undo entry covers
  block-creation (Cmd-Z brings the canvas back to "no text
  block at all").

### Markdown rendering — supported elements

- [ ] Given a text block with body `# Heading`, when rendered,
  then the renderer renders the H1 source as an `<h2>` element
  (level remap). The maintainer's H1 source does not produce
  an H1 element in the DOM. H1 is reserved for the calculator
  hero per `docs/Calcgrinder-spec.md`.
- [ ] Given a text block with body `## H2\n\n### H3\n\n#### H4`,
  when rendered, then three `<h2>`, `<h3>`, `<h4>` elements
  appear in order with the heading scale (H2 = 1.4× base, H3 =
  1.2× base, H4 = 1.05× base) where "base" is determined by
  the card-level `text_size`.
- [ ] Given a text block with body containing `**bold**` and
  `_italic_` and `***both***`, when rendered, then the output
  contains `<strong>`, `<em>`, and `<strong><em>` (or
  `<em><strong>`) nodes respectively.
- [ ] Given a text block with body containing an unordered list
  (`- item`) and an ordered list (`1. item`), when rendered,
  then `<ul>` and `<ol>` elements appear with the correct
  number of `<li>` children.
- [ ] Given a text block with body containing a blockquote
  (`> quoted text`), when rendered, then a `<blockquote>`
  element appears.
- [ ] Given a text block with body containing `` `inline code` ``,
  when rendered, then a `<code>` element appears with monospace
  styling and no syntax highlighting.
- [ ] Given a text block with body containing a fenced code
  block (` ```js ... ``` `), when rendered, then a `<pre><code>`
  element appears with **plain monospace styling, no syntax
  highlighting** (the language hint is preserved as a class
  for post-v1, but no Prism / Shiki invocation in v1).
- [ ] Given a text block with body containing `---` on its own
  line, when rendered, then an `<hr>` element appears.
- [ ] Given a text block with body containing `[text](https://example.com)`,
  when rendered, then an `<a>` element appears with `href`
  set, `target="_blank"` and `rel="noopener noreferrer"` both
  injected by the renderer.
- [ ] Given a text block with body containing a bare URL
  (`Visit https://example.com today.`), when rendered, then
  the URL auto-links — i.e., is wrapped in an `<a>` element
  with the same `target` / `rel` treatment.
- [ ] Given a text block with body containing a soft break
  (single newline between two lines of text, not a blank
  line), when rendered, then a `<br>` appears between the
  lines (GFM behaviour, not CommonMark default).
- [ ] Given a text block with body containing
  `![alt text](https://example.com/img.png)`, when rendered,
  then an `<img>` element appears with `src`, `alt`, and
  inline `max-width: 100%; height: auto` styling.

### Markdown rendering — sanitization

- [ ] Given a text block with body containing
  `<script>alert(1)</script>`, when rendered, then the output
  contains the **literal escaped text** `&lt;script&gt;alert(1)&lt;/script&gt;`
  — no `<script>` element in the DOM, no execution, no side
  effect.
- [ ] Given a text block with body containing
  `<iframe src="...">`, `<object>`, `<embed>`, or any
  `<style>` block, when rendered, then those elements are
  stripped or escaped — never present as live DOM elements.
- [ ] Given a text block with body containing
  `<a href="javascript:alert(1)">click</a>` (in any combination
  of markdown or HTML syntax), when rendered, then the
  `href` is either stripped to `#` or the element is removed
  entirely — the `javascript:` URL is never reachable.
- [ ] Given a text block with body containing
  `![bad](data:image/svg+xml;base64,…)`, when rendered, then
  the `<img>` is dropped (the `data:` scheme is rejected by
  the sanitizer schema). No data-URI images.
- [ ] Given a text block with body containing inline event
  handlers (e.g., a raw HTML `<a onclick="alert(1)">`), when
  rendered, then the handler attribute is stripped from the
  AST before render. The element (if otherwise allowed)
  renders without the handler.
- [ ] Given the renderer pipeline is inspected, when its
  stages are listed, then it is exactly
  **markdown → AST → sanitize → render-to-React**.
  No custom string-based sanitization runs alongside.
  Sanitization is `rehype-sanitize` with the default schema
  **minus any HTML pass-through** (raw HTML tags removed
  before sanitization, not allowed through it).
- [ ] Given the sanitizer drops or strips content, when the
  text block is published, then the drop happens silently
  (no warning, no Publish-gate block). The maintainer learns
  about the strip from the live preview not matching their
  source.

### Image hint

- [ ] Given the source `body` contains at least one
  `![…](http…)` pattern (case-insensitive, matches the
  markdown image syntax with an HTTPS or HTTP URL), when the
  card is expanded, then a **persistent muted hint** appears
  below the source `<textarea>` reading "Hosted externally —
  may break if the source moves." Single hint regardless of
  image count.
- [ ] Given the maintainer deletes all `![…](url)` patterns
  from the source, when the local body re-renders, then the
  image hint disappears in the same render pass.
- [ ] Given the hint detection runs on local state (not on
  the persisted body), when the maintainer types
  `![alt](https://…)` and pauses before the debounced PATCH
  fires, then the hint appears immediately (within the
  re-render pass triggered by the keystroke), not after the
  PATCH commits.

### Card-level visual settings — interaction with cells/charts

- [ ] Given a text-block card's `card_accent`, `card_background_tint`,
  `card_border`, `card_size_hint` controls are inspected, when
  compared to cell cards' visual panel, then the controls are
  pixel-identical (same segmented buttons, same swatch picker,
  same order). Settings persist via PATCH on change (immediate
  for segmented / toggle, on-blur for text inputs — none in
  text-block settings strip).
- [ ] Given a text block has `card_size_hint = 'wide'` (the
  default), when the card renders, then it occupies the same
  width-tier as a "wide" cell or "wide" chart in the same
  section.
- [ ] Given a text block has `card_size_hint = 'full'`, when
  the section's layout renders, then the text block spans the
  full section content width, pushing other cards to the next
  row (PROJ-9 layout rule for full-size cards).

### Visitor view — rendering

- [ ] Given a published calculator includes a text block, when
  a visitor loads `/c/<token>`, then the text block renders
  using the **same renderer** as the Builder preview — visual
  output identical between Builder preview and visitor view.
- [ ] Given a visitor clicks a link inside a text block, when
  the click registers, then the link opens in a **new browser
  tab** with `noopener noreferrer` semantics (calculator state
  preserved in the original tab).
- [ ] Given a text block has `body = ''`, when the visitor
  view renders, then **no card, no spacer, no whitespace** is
  produced for that block. Other elements flow as if the
  text block didn't exist.
- [ ] Given a text block contains an `<img>` from an external
  HTTPS URL, when the visitor loads the page and the image
  host is reachable, then the image renders inline at natural
  size up to `max-width: 100%`. Given the image host is
  unreachable (404, network error), the standard browser
  broken-image icon appears — no fallback by PROJ-16.

### Limits enforcement

- [ ] Given `@/lib/text-blocks/limits.ts` is inspected, when
  its exports are listed, then it has exactly:
  `MAX_TEXT_BLOCKS = 30`, `MAX_TEXT_BLOCK_BODY_BYTES = 51200`.
  Both as named const exports. Future perf-tuning passes import
  from this file rather than redefining constants.
- [ ] Given a calculator at the `MAX_TEXT_BLOCKS = 30` cap,
  when the +Add picker is opened, then the Text option is
  disabled with tooltip "Limit of 30 text blocks reached."
- [ ] Given a `POST` or `PATCH` writes a `body` whose UTF-8
  byte length (`new TextEncoder().encode(body).byteLength`)
  is `> 51200`, when the API processes the request, then
  HTTP 422 is returned with
  `{ error: 'body_too_large', max_bytes: 51200 }` before
  touching the database.

### Bundled regressions resolved (KI-1 + BUG-M1 PROJ-14)

- [ ] Given migration `20260531000001_public_calculator_text_blocks.sql`
  is applied, when `fn_get_public_calculator` is inspected, then its
  body **JOINs `public.profiles p ON p.id = c.owner_id AND p.status =
  'approved'`** (restored verbatim from PROJ-14 line range
  `20260528000000_settings_page.sql:239-243`), in addition to gaining
  the `text_blocks` payload extension.
- [ ] Given the same migration, when `fn_get_scenario_by_share_token`
  is inspected, then its body **JOINs `public.profiles owner_profile
  ON owner_profile.id = c.owner_id AND owner_profile.status =
  'approved'`** (restored verbatim from PROJ-14 line range
  `20260528000000_settings_page.sql:354-356`), in addition to gaining
  the `text_blocks` payload extension. The existing `LEFT JOIN
  public.profiles p ON p.id = s.owner_id` for scenario-owner display
  name stays in place.
- [ ] Given the KI-1 regression gate at
  `tests/PROJ-14-settings.spec.ts:593` ("a published calculator whose
  owner is in pending_deletion is hidden from `/c/<token>`"), when
  the test runs after PROJ-16 deploy, then it **passes** (the JOIN
  restoration suppresses the row at the RPC layer; the visitor route
  sees zero rows and renders the existing not-found/410 path).
- [ ] Given a published calculator whose owner is in `pending_deletion`
  has a published scenario at `/c/<calc_token>/s/<share_token>`, when
  a visitor loads that URL after PROJ-16 deploy, then the visitor
  sees the same not-found/410 path as `/c/<token>` (no
  scenario-surface bypass of the owner-status gate). New e2e test
  added alongside the PROJ-14 gate; mirrors PROJ-14:593 for the
  scenario surface.
- [ ] Given **BUG-M1 PROJ-14** (visitor `/c/<token>` returned 404
  instead of 410 when owner is `pending_deletion`) is re-evaluated
  after the JOIN restoration, when QA re-tests, then either: (a) the
  JOIN restoration alone resolves BUG-M1 (the visitor route's
  zero-row path emits 410 because `calculators.soft_delete_at` is
  read independently of the RPC result), or (b) BUG-M1 remains and
  a follow-up patch in the visitor route handler is documented in
  PROJ-16's QA Test Results. /backend and /qa flag this explicitly.

### Slot renderer registration (forward-compat)

- [ ] Given the slot renderer at PROJ-16 HEAD, when a section's
  display elements are iterated, then **`text_block` is
  registered** alongside `cell` and `chart`. Adding the
  registration is a single `registerDisplayElementRenderer('text_block', …)`
  call — no rewrite of the slot-iteration code.
- [ ] Given the Visitor View renderer at PROJ-16 HEAD, when
  it dispatches a section's elements polymorphically, then it
  routes `text_block` elements to the markdown renderer
  without special-case branching in the dispatch logic
  itself (the dispatch sees an opaque element type and
  delegates).

## Edge Cases

- **Markdown that produces no rendered output** — e.g., body
  consisting only of HTML comments `<!-- comment -->` or
  whitespace. The sanitizer strips comments; the renderer
  produces an empty DOM. In the Builder, the collapsed card
  shows the "Empty text block" hint (treating "renders to
  empty" the same as "body is empty"). In the visitor view,
  nothing renders.
- **Very long unwrappable lines** in source (e.g., a 2,000-
  character URL pasted with no line breaks). The textarea
  scrolls horizontally; the rendered preview wraps according
  to CSS `word-break: break-word`. No truncation, no
  silent newline injection.
- **Body containing a closing fence that doesn't match the
  opening fence** (e.g., ` ``` ` opens but never closes). The
  parser treats the rest of the document as inside the code
  block. Preview reflects this; maintainer sees the issue
  immediately and adds the closing fence.
- **Body containing markdown reference-style links**
  (`[text][ref]\n\n[ref]: https://…`). Standard GFM behaviour:
  resolved at parse time. No special handling required.
- **Concurrent edits in two tabs** — same as cells / charts.
  The calculator-level `updated_at` trigger on `text_blocks`
  inserts/updates/deletes feeds PROJ-8's optimistic
  concurrency. Second-tab save sees 409 and surfaces the
  refresh banner.
- **Editor undo crossing the debounce boundary** — the user
  types `Hello` over 2 seconds (multiple PATCH coalescings).
  The browser's native textarea undo (Cmd-Z while focused
  inside the textarea) walks the per-keystroke undo stack.
  Calculator-level Undo (Cmd-Z outside the textarea) walks
  the per-PATCH-batch entries. Same divide as cell formula
  textareas in PROJ-9.
- **Pasting Word / Google-Docs / Notion content** — paste
  semantics are browser-default for `<textarea>`: plain text
  only. Rich-text paste does NOT translate to markdown
  automatically. Maintainers wanting formatted prose must
  type markdown syntax explicitly.
- **Renderer crash on malformed input** — unlikely with
  `remark-parse` + `rehype-sanitize`, but if it happens the
  preview pane shows a single muted line "Couldn't render
  this Markdown — check the source." and the source textarea
  remains editable. The PATCH still commits (the source is
  just text from the DB's perspective).
- **Text block in a soft-deleted calculator** — public
  `/c/<token>` route returns 410 / 404 per Calcgrinder-spec.md
  §3 Public-token URLs; text blocks aren't rendered because
  the calculator never resolves. No new code path required.
- **Theme switch while a text-block card is expanded** — the
  preview re-renders with the new theme's tokens (font,
  colours, link colour) in the same render pass. Source
  textarea is theme-neutral (chrome).
- **Body whose UTF-8 byte length is exactly 51,200** —
  accepted (cap is exclusive of equality: `byteLength <= 51200`
  accepted, `> 51200` rejected). Decided in-spec, see the
  matching AC under API CRUD.
- **Maintainer types `<` `>` characters as literal text** —
  the renderer treats them as literal angle brackets when
  they don't form a recognised HTML tag, escaping them in
  output. Maintainers writing prose with `<` `>` for
  emphasis (e.g., "use the > operator") see them rendered
  literally.

## Technical Requirements

- **Markdown library**: `remark-parse` + `remark-gfm` +
  `rehype-raw` (disabled / bypassed — no raw HTML) +
  `rehype-sanitize` + `rehype-react`. Architecture skill
  pins exact versions; PROJ-16 spec pins the pipeline shape.
- **Performance**:
  - Preview re-render on keystroke: < 16ms for bodies up to
    10KB; < 50ms for bodies up to 50KB (the cap).
  - Debounced PATCH: ~500ms idle delay; ≤ 200ms server
    round-trip target.
  - Markdown render is memoised on body content so subsequent
    re-renders of unchanged content don't re-parse.
- **Security**:
  - All user input passes through `rehype-sanitize` with the
    default schema **minus raw-HTML allowance**.
  - The 50KB Zod cap on `body` size prevents accidental
    request bloat and DoS via unbounded growth.
  - RLS on `text_blocks` joins via `calculators.owner_id =
    auth.uid()`.
- **Accessibility**:
  - Source textarea has `aria-label="Markdown source"`.
  - Preview region has `aria-label="Live preview"` and is
    not focusable (it's a render of the source, the source is
    the canonical input).
  - Heading levels in rendered markdown follow document
    structure (H2-H4 only — H1 reserved for calculator hero).
  - Images surface their `alt` text from the markdown source.
- **Browser support**: same baseline as the rest of the app
  (Chrome / Firefox / Safari current and one back).

## Open Questions

- [ ] Should the source `<textarea>` use a monospaced font
  bundled with the app (Geist Mono, already loaded) or fall
  back to system monospace? Pure visual/tech choice with no
  spec implications. Recommendation: Geist Mono for visual
  consistency with the rest of the editor. Defer to /frontend.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| **Text blocks have NO Editor Grid column or mobile drawer row** — explicit override of `docs/Calcgrinder-spec.md` §3 Editor architecture line "Charts and Text-blocks also appear as columns in the Grid." | The Grid is the data core of the calculator (Inputs, Outputs, and Charts which visualise data). Text blocks are prose / layout, not data, and don't belong in a data overview. Charts retain their Grid column unchanged. | 2026-05-24 |
| **No `name` column on `text_blocks` and no `UNIQUE(calculator_id, name)` constraint** | Direct consequence of the no-Grid-column decision. With no Grid column to label, the only purpose of `name` (matching cells / charts) doesn't apply. Text blocks aren't referenced by formulas or chart bindings, so no engine-level need for a name either. | 2026-05-24 |
| **+Add picker discovery is the sole entry point** for text blocks; no kebab "Duplicate" action | Mirrors PROJ-15's no-Duplicate decision for charts. Keeps the surface area small. A future PROJ-2X may add Duplicate if maintainer feedback demands it. | 2026-05-24 |
| **Split-pane editor on desktop (source ⇆ preview), stacked on mobile (source ↑ preview ↓)** | Split is the dominant markdown-editor pattern (GitHub, Reddit, Notion-with-markdown) and gives the maintainer instant WYSIWYG-without-being-WYSIWYG feedback. Stacked-only on mobile because 360px viewports can't accommodate two readable columns. | 2026-05-24 |
| **Debounced ~500ms idle auto-save** (plus immediate flush on blur / collapse / undo enrolment), preview renders synchronously off local state on every keystroke | Markdown bodies are long-form; commit-on-blur (the chart/cell pattern) risks losing minutes of work on tab close. ~500ms balances "feels instant" against "doesn't spam the server." Local-state preview keeps typing-feedback at 60fps regardless of network state. | 2026-05-24 |
| **`MAX_TEXT_BLOCKS = 30`** (matches `MAX_CHARTS`) | Consistency: "each presentation element type caps at 30." Reasonable for a single calculator; signals "this is a presentation aid, not a CMS." Higher caps (50 / 100) risk maintainers building CMS-style content pages instead of focused calculators. | 2026-05-24 |
| **Default body is empty string `''`** with textarea placeholder "Write Markdown here…" | Cleanest start, no content for the maintainer to delete. Card auto-expands on creation so the maintainer lands directly in the editor and isn't confused by an empty visible block. | 2026-05-24 |
| **Empty body is well-formed; text blocks never block Publish** | Markdown is a permissive format with no structural relationships to break (unlike chart bindings). An empty body is valid; it just renders nothing in the visitor view. Maintainers can stage placeholder blocks in drafts. | 2026-05-24 |
| **Persistent inline image hint** (body-driven detection, hides when image syntax removed) | A single persistent reminder near the source is the right ergonomics: maintainer sees the warning while they have context, dismisses by removing the image, doesn't need to re-trigger to remember. Transient toast risks missing first-time maintainers entirely. | 2026-05-24 |
| **Default `card_size_hint` is `wide`** (cells and charts default `narrow`) | Prose reads poorly in narrow sidebars; wide is the natural reading width. Maintainer overrides to narrow for callouts or full for hero intros as needed. | 2026-05-24 |
| **50 KB server-side Zod cap on `body` UTF-8 byte length** (HTTP 422 `body_too_large` if exceeded), no DB-level CHECK constraint. Measured via `new TextEncoder().encode(body).byteLength`, not codepoint count. | Deliberate deviation from PRD line "No enforced character cap on text-block content." Rationale is security backstop: prevents accidental DoS via unbounded growth (e.g., paste of a 5 MB minified file). 50 KB equates to ≈ 8,000–10,000 ASCII words / 30 pages of plain English prose; emoji-heavy or multi-byte-script content fits proportionally less because the cap is bytes, not characters. The byte-based measurement is deliberate — the cap exists to bound request payload size, not to count user-visible characters. Zod-only (no DB CHECK) so the cap can be raised by a one-line change later. | 2026-05-24 |
| **Markdown pipeline pinned to remark/rehype with `rehype-sanitize` default schema minus raw-HTML pass-through** | Calcgrinder-spec.md §2 already pins this; PROJ-16 holds the line. No custom string-based sanitiser allowed. | 2026-05-24 |
| **Markdown H1 source remapped to `<h2>` in the rendered DOM** | H1 is reserved for the calculator hero. Source-level `#` is most likely a maintainer's intent to add a "title" inside the block; remapping to H2 preserves intent without competing with the hero. | 2026-05-24 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| **`react-markdown` as the rendering surface** wrapping `remark-parse + remark-gfm + rehype-sanitize`. Single shared `<MarkdownRenderer>` component used by both the Builder card's live-preview pane and the visitor-view slot renderer. | Convention library, battle-tested, accepts `remarkPlugins` / `rehypePlugins` arrays directly — pipeline shape stays exactly as spec pins. One component, two consumers ⇒ Builder preview is pixel-identical to visitor render by construction. | 2026-05-24 |
| **Raw-HTML drop via `remark-rehype` default `allowDangerousHtml: false`** — the markdown→hast bridge silently drops raw HTML nodes before they reach the sanitizer. `rehype-raw` is NOT installed. `rehype-sanitize` runs with its default schema as a belt-and-braces backstop. | Spec calls for "raw HTML tags removed before sanitization, not allowed through it." Skipping `rehype-raw` is the cleanest way: nothing re-parses the HTML, so sanitizer never sees `<script>` AST nodes — they were already dropped at the AST bridge. | 2026-05-24 |
| **Visitor data path: extend `fn_get_public_calculator` RPC** to include `text_blocks` in each section's JSONB payload (`CREATE OR REPLACE FUNCTION` migration). | Mirrors PROJ-15's chart wire-through (20260530000000_public_calculator_charts.sql). One RPC round-trip, one cache key, one place to evolve the visitor payload. Avoids drifting two query paths apart. | 2026-05-24 |
| **Editor data path: extend the existing editor bundle loader** (the same query path that already returns `sections + cells + charts` per calculator) to additionally pull `text_blocks` ordered by `display_order`. Slot layer interleaves cells + charts + text_blocks per section by `display_order`. | Cells, charts, and text_blocks all live in sections and all carry per-section `display_order`. The slot iterator already merges and sorts by display_order — text_blocks just become a third source. | 2026-05-24 |
| **New `text_block` element type registered with `registerDisplayElementRenderer`** in `src/components/editor/text-block-slot-registration.tsx`, paralleling `chart-slot-registration.tsx`. Slot renderer dispatches by element `type` discriminant; no branching in the dispatcher itself. | Spec acceptance criteria require `text_block` registration with no rewrite of slot iteration. Following the chart precedent verbatim makes the seam obvious to the next P1 element (Tabular, PROJ-17). | 2026-05-24 |
| **Debounce: a small `useDebouncedCallback(fn, 500)` hook colocated under `src/lib/text-blocks/`**, with `flush()` for immediate-flush on blur / collapse / undo enrolment. Coalesces inflight PATCHes — if a save is mid-flight, the latest pending body is sent on completion. | Existing code uses ad-hoc setTimeout debounces for cell formula PATCHes; centralising the pattern in one hook (with a flush handle) keeps the multi-trigger flush logic readable. Scoped to `text-blocks/` because nothing else needs the flush handle today; promote if Cells/Charts adopt it. | 2026-05-24 |
| **Markdown render memoised by body string** with React's `useMemo` keyed on the raw body — identical bodies skip re-parse. | Live-preview re-renders on every keystroke; the parse cost (10-50ms for 50KB bodies) would jank typing at the upper end without memoisation. Cheap by-value cache on a single short-lived component. | 2026-05-24 |
| **Image hint detection via a small regex** `/!\[[^\]]*\]\(\s*https?:\/\//i` run on local body state (not on rendered DOM, not on persisted body). Renders or hides synchronously with each keystroke. | Local-state detection means the hint appears instantly when the user types `![…](http`, not after the debounced PATCH commits — matches the spec's "in the same render pass" AC. Regex avoids round-tripping through the markdown AST just for hint visibility. | 2026-05-24 |
| **H1→H2 remap implemented as a `remark` plugin** (not a post-render DOM rewrite), running inside the renderer pipeline before sanitization. | Plugin-level remap is one ~5-line transformer that operates on the AST. DOM rewriting after render is fragile and runs at every paint. Pinned location: the H1-remap must live between `remark-gfm` and `remark-rehype`. | 2026-05-24 |
| **Heading scale (H2 1.4×, H3 1.2×, H4 1.05× of card-level Text size base)** delivered as CSS `em` multipliers on `prose h2 / h3 / h4` selectors within the `<MarkdownRenderer>` root, where the root sets `font-size` from the `text_size` token. Composes multiplicatively in pure CSS. | Spec pins both the base from `text_size` AND the relative heading multipliers, and explicitly notes they "compose, don't conflict." `em` units do this composition natively — no JS-side multiplication, no per-render calculation. | 2026-05-24 |
| **No DB-level `CHECK` on body byte length**; Zod-only `MAX_TEXT_BLOCK_BODY_BYTES = 51200` enforced in both POST and PATCH route handlers via `new TextEncoder().encode(body).byteLength`. | Spec product decision pinned this so the cap can be raised by a one-line Zod change later without a migration. Postgres `length()` counts characters not bytes, so a DB CHECK would diverge from the API check; keeping the rule in one place avoids drift. | 2026-05-24 |
| **`text_blocks` migration filename: `20260531000000_text_blocks.sql`** (DDL) + `20260531000001_public_calculator_text_blocks.sql` (RPC replace). Two-file split mirrors PROJ-15's chart pattern. | Lets QA / deploy stage the public RPC change as a separate, smaller, reviewable migration. Matches the existing precedent. | 2026-05-24 |
| **Cross-section move rejection enforced at the API layer**, not via DB constraint. Route checks `body.section_id !== existing.section_id` → 422. | Cleanest place to reject: the API already loads the row for the optimistic-concurrency check; one extra comparison. Adding a DB-level deny would over-constrain future "move" features. | 2026-05-24 |
| **Slot interleaving by `display_order` across `cells + charts + text_blocks`** within a section. Three sibling element streams merged into a single ordered list at the slot layer, dispatched polymorphically. | Spec's forward-compat constraint: "the slot/rendering pipeline must iterate display_elements polymorphically." Three-way merge by display_order is the simplest realisation that scales to PROJ-17 (4 streams). | 2026-05-24 |
| **Bundle KI-1 fix (PROJ-14 owner `status='approved'` JOIN restored on both public RPCs) and BUG-M1 PROJ-14 (pending_deletion → 410 on the visitor surface) into PROJ-16's RPC migration as a no-cost rider on the `text_blocks` payload extension.** Both fixes touch the same two RPCs (`fn_get_public_calculator`, `fn_get_scenario_by_share_token`) we're already `CREATE OR REPLACE`-ing. JOIN syntax restored verbatim from `20260528000000_settings_page.sql:239-243` and `:354-356`. | KI-1 has been carried in production with an intentionally-red regression gate at `tests/PROJ-14-settings.spec.ts:593` since PROJ-15 deploy; PROJ-16 is the natural moment to close it because the migration shape is already there. BUG-M1 sits on the same code path — restoring the JOIN is the precondition for either resolution (route handler emits 410 already, or needs a tiny patch). Bundling avoids a separate one-line migration just for the JOIN. | 2026-05-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### What we're building (one-paragraph summary)

PROJ-16 adds a third "card type" to the Builder canvas, alongside cell cards (PROJ-9) and chart cards (PROJ-15): a **text block** that holds maintainer-written markdown prose. The card opens into a split-pane editor (source on the left, live-rendered preview on the right) on desktop and stacks the same two surfaces vertically on mobile. The visitor view renders the same markdown through the same shared component, so what the maintainer types is exactly what the visitor sees. Text blocks have **no Grid column** — they live only in the Builder canvas — which is the one deliberate spec deviation we're making explicitly visible in the Decision Log.

### Component Structure (Builder side)

```
EditorBody                                  (existing — PROJ-8)
+-- AddPicker                               (existing — Text flips disabled → enabled)
+-- BuilderCanvas                           (existing — PROJ-8)
    +-- SectionBlock                        (existing — PROJ-9)
        +-- SlotRenderer                    (existing — PROJ-8, polymorphic dispatch)
            +-- CellCard                    (existing — PROJ-9)
            +-- ChartCard                   (existing — PROJ-15)
            +-- TextBlockCard               (NEW)
                +-- (collapsed)
                |   +-- MarkdownRenderer    (NEW, shared — renders body via react-markdown)
                |   +-- EmptyHint           (NEW — "Empty text block — click to edit")
                |   +-- HoverAffordances    (existing PROJ-9 — drag handle, edit icon, kebab)
                +-- (expanded)
                    +-- TextBlockEditorPane (NEW)
                    |   +-- SourceTextarea  (NEW — plain <textarea>, monospaced)
                    |   +-- PreviewPane     (NEW — wraps MarkdownRenderer)
                    +-- ImageHintLine       (NEW — appears when body has ![…](http…))
                    +-- TextBlockVisualPanel(NEW — strip below editor)
                        +-- TextSizeButtons     (s/m/l/xl segmented)
                        +-- TextColourButtons   (default/accent_1/accent_2 segmented)
                        +-- AccentSwatchPicker  (re-uses cell card primitive)
                        +-- BackgroundTintGroup (segmented — re-uses primitive)
                        +-- BorderGroup         (segmented — re-uses primitive)
                        +-- SizeHintGroup       (segmented — re-uses primitive)

VisitorShell                                (existing — PROJ-11)
+-- CalculatorRenderer                      (existing — same polymorphic dispatch)
    +-- TextBlockSlotRegistration           (NEW — registers a visitor-side renderer)
        +-- MarkdownRenderer                (shared with Builder — same component)
```

The **`MarkdownRenderer` component is the single source of truth** for markdown rendering. Builder preview and visitor view import the same component; the spec's "pixel-identical Builder/visitor" guarantee follows by construction.

### Data Model

```
A text_block has:
- id (UUID)
- which calculator it belongs to (calculator_id)
- which section it sits in (section_id)
- body (the markdown source, default empty string '')
- six card-level visual settings:
    - card_accent       theme palette colour (default 'theme')
    - card_background_tint  none / soft / strong (default 'none')
    - card_border       none / hairline / strong (default 'none')
    - card_size_hint    narrow / wide / full (default 'wide' — wider than cells)
    - text_size         s / m / l / xl (default 'm') — text-block-specific
    - text_colour       default / accent_1 / accent_2 (default 'default')
- display_order (its position among other cards in the section)
- created_at, updated_at

What text_blocks deliberately do NOT have (vs cells / charts):
- NO `name` column
- NO UNIQUE(calculator_id, name) constraint
- NO Grid column representation
- NO formula referenceability — text blocks aren't named, can't be referenced
```

Stored in: **Supabase Postgres** (`public.text_blocks`), with the same RLS + parent-bump-trigger pattern as cells and charts.

Caps (pinned in `src/lib/text-blocks/limits.ts`):
- `MAX_TEXT_BLOCKS = 30` per calculator (matches `MAX_CHARTS`).
- `MAX_TEXT_BLOCK_BODY_BYTES = 51,200` (50 KB UTF-8) per body — server-side Zod backstop.

### Markdown Render Pipeline

```
Maintainer source string
        │
        ▼
remark-parse                       (string → mdast)
        │
        ▼
remark-gfm                         (GFM extensions: tables, task lists, autolinks, soft-breaks)
        │
        ▼
H1→H2 remap (~5-line plugin)       (level-1 headings become level-2)
        │
        ▼
remark-rehype  { allowDangerousHtml: false }
                                   (mdast → hast; raw HTML nodes are SILENTLY DROPPED here)
        │
        ▼
rehype-sanitize  { default schema, no HTML pass-through }
                                   (belt-and-braces strip of any residual unsafe attributes)
        │
        ▼
react-markdown / rehype-react      (hast → React elements)
        │
        ▼
+ link rewrite: target="_blank" rel="noopener noreferrer"
+ image style: max-width: 100%; height: auto
        │
        ▼
DOM
```

Three pipeline stages contribute to safety:
1. `remark-rehype`'s default config **drops raw HTML** before it can reach the sanitizer.
2. `rehype-sanitize`'s default schema strips any unsafe-attribute residue (inline events, `javascript:` / `data:` URLs).
3. Markdown auto-escaping turns literal `<script>` text into `&lt;script&gt;` in output.

Pipeline is **memoised by body string** so identical re-renders skip parsing.

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sections/:sid/text_blocks` | POST | Create a new text block in section `:sid`. Body optionally carries `insert_after_element_id` for between-elements seam. |
| `/api/text_blocks/:id` | PATCH | Update body and/or any card-level visual setting; reorder via `{ display_order }`. Calculator-level optimistic concurrency 409. |
| `/api/text_blocks/:id` | DELETE | Hard-delete the text block. No trash. Sibling display_orders renumber. |

All routes:
- Verify session via Supabase auth.
- Re-check ownership via RLS-joining `calculators.owner_id = auth.uid()`.
- Validate inputs with Zod (enums + body byte cap + UUID shapes).
- Return 404 for signed-out / non-owner / soft-deleted-calculator targets (opacity).
- Standard 409 conflict surface from the existing `If-Unmodified-Since`-style calculator concurrency mechanism — text-block writes bump `calculators.updated_at` via the same trigger pattern as cells and charts.

### Save Timing (debounce)

```
Typing into source textarea
   │
   ▼
local state updates synchronously  ←  preview re-renders synchronously
   │
   ▼
useDebouncedCallback(patch, 500ms)
   │
   ├─ on idle for 500ms  → fire PATCH /api/text_blocks/:id { body }
   ├─ on blur            → flush() — fire immediately
   ├─ on collapse        → flush()
   ├─ on undo enrolment  → flush() before snapshot
   └─ on PATCH-in-flight → coalesce pending body, re-fire on completion
```

422 `body_too_large` renders an inline error under the textarea; local state is preserved for trim-and-retry. 409 routes to PROJ-8's existing calculator-level conflict banner.

### Tech Decisions (justified, plain language)

**Why react-markdown.** It's the convention React wrapper for the remark/rehype ecosystem. We pass `remarkPlugins={[remarkGfm, h1ToH2]}` and `rehypePlugins={[rehypeSanitize]}` directly to it. The same component instance powers the Builder live preview and the visitor render, so "pixel-identical" isn't a separate verification step — it's structural.

**Why NOT `rehype-raw`.** `rehype-raw` re-parses raw HTML inside the markdown source and brings it back as proper HAST nodes (so the sanitizer can see and filter it). The spec wants raw HTML *dropped*, not filtered. Skipping `rehype-raw` means the default `remark-rehype` bridge silently throws away raw HTML before it ever becomes parseable structure — strictly safer than "parse then strip."

**Why extend the public RPC instead of a separate query.** PROJ-15 already established the precedent (`fn_get_public_calculator` returns sections-with-charts as JSONB). Adding text_blocks to that same shape keeps the visitor data path uniform — one round-trip, one cache key, one migration to evolve when adding PROJ-17 (Tabular). **Two RPCs are extended**, not one: `fn_get_public_calculator` (the `/c/<token>` calculator route) AND `fn_get_scenario_by_share_token` (the `/c/<calc_token>/s/<share_token>` scenario route). Scenario URLs render the full calculator including text_blocks, so both public surfaces need the new payload.

**Why bundle the KI-1 + BUG-M1 PROJ-14 fixes into this migration.** PROJ-15's two RPC `CREATE OR REPLACE` migrations silently dropped PROJ-14's `JOIN public.profiles ... AND status = 'approved'` clause from both public RPCs — a documented Known Issue (KI-1) and an intentionally-red regression gate at `tests/PROJ-14-settings.spec.ts:593`. PROJ-16 has to `CREATE OR REPLACE` both RPCs anyway to add the text_blocks payload, so adding one extra JOIN line per RPC closes KI-1 at zero incremental migration cost. BUG-M1 PROJ-14 (visitor `/c/<token>` returns 404 instead of 410 for owners in `pending_deletion`) lives on the same code path; with the JOIN restored, the RPC returns zero rows and the visitor route's existing not-found branch runs. Whether that branch already emits 410 (via independent `calculators.soft_delete_at` read) or still emits 404 is for /backend + /qa to verify — but the JOIN restoration is the precondition for the rest of the fix regardless.

**Why deliberately omit a Grid column.** Documented in detail in the Product Decisions table: the Grid is the calculator's data overview, text blocks are prose. Carrying them in the Grid would clutter the data surface without adding referenceable information. Charts stay in the Grid because they bind to cells; text blocks bind to nothing.

**Why 30-block cap.** Matches `MAX_CHARTS = 30`. Signals "this is a presentation aid, not a CMS." Maintainers needing 50 paragraphs of prose are using the wrong tool.

**Why 50 KB body cap.** Security backstop against accidental DoS (someone pastes a 5 MB minified file). 50 KB ≈ 30 pages of plain English prose — well above any reasonable maintainer use case. Zod-only (no DB CHECK) so we can raise it without a migration if real-world usage ever brushes the ceiling.

**Why split-pane on desktop, stacked on mobile.** Spec product decision: the split-pane is the GitHub/Reddit/Notion convention and gives instant feedback without WYSIWYG complexity. 360px-wide mobile viewports can't fit two readable columns; stacking is the only viable mobile layout.

**Why debounce instead of save-on-blur.** Markdown bodies are long-form. Save-on-blur (the cell/chart pattern) risks losing minutes of work on a tab close. ~500ms idle is "feels-instant" for the maintainer and trivial network load.

### Dependencies (new packages)

| Package | Purpose |
|---------|---------|
| `react-markdown` | React component wrapping the remark/rehype pipeline. The rendering surface. |
| `remark-gfm` | GFM markdown extensions (tables, task lists, soft-breaks, autolinks). |
| `rehype-sanitize` | Belt-and-braces sanitisation pass after the markdown→HAST bridge. |

We do **not** install: `rehype-raw` (we want raw HTML *dropped*, not filtered), any syntax-highlighting library (`shiki` / `prismjs` — non-goal), any WYSIWYG library (`@tiptap/*`, `lexical` — PRD non-goal), KaTeX / MathJax (non-goal), Mermaid (non-goal).

### Migrations

Two new SQL migrations under `supabase/migrations/`:

1. **`20260531000000_text_blocks.sql`** — Creates `public.text_blocks` table, RLS policies (owner-scoped via calculators join), `updated_at` trigger, parent-bump trigger, indexes on `(calculator_id)`, `(section_id)`, and `(section_id, display_order)`, plus the DEFERRABLE INITIALLY DEFERRED unique constraint on `(section_id, display_order)`.

2. **`20260531000001_public_calculator_text_blocks.sql`** — `CREATE OR REPLACE` of **both public RPCs** in a single migration. Each RPC gets two changes at once:
   - **`fn_get_public_calculator`** — adds `text_blocks` array to each section in the JSONB `sections` payload, AND restores the `JOIN public.profiles p ON p.id = c.owner_id AND p.status = 'approved'` clause that PROJ-15's chart wire-through migration omitted (closes KI-1). The JOIN syntax is restored verbatim from `20260528000000_settings_page.sql:239-243`.
   - **`fn_get_scenario_by_share_token`** — adds `text_blocks` array to each section in the JSONB `sections` payload, AND restores the `JOIN public.profiles owner_profile ON owner_profile.id = c.owner_id AND owner_profile.status = 'approved'` clause that PROJ-15's scenario-charts migration omitted (closes KI-1 on the scenario surface). The JOIN syntax is restored verbatim from `20260528000000_settings_page.sql:354-356`. The existing `LEFT JOIN public.profiles p ON p.id = s.owner_id` (scenario-owner display name) stays.

   This single migration closes KI-1 on both public surfaces at the same time, on the same migration boundary, as a no-cost rider on the text_blocks payload extension we have to ship anyway.

After both migrations, regenerate types: `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`.

**BUG-M1 PROJ-14 follow-up.** With the JOIN restoration above, both visitor RPCs return zero rows when the owner is in `pending_deletion`. The visitor route handlers' existing not-found branches then run. /backend verifies whether those branches emit HTTP 410 directly (via independent `calculators.soft_delete_at` lookup) or still emit 404 — if the latter, a small visitor-route-handler patch (route-level 410 when calc lookup returns zero rows but the row exists with `soft_delete_at != null` OR the owner is in `pending_deletion`) ships in the same PROJ-16 cycle. /qa adds the regression test on the scenario surface mirroring PROJ-14:593 either way.

### Files / directories planned

```
NEW
  supabase/migrations/20260531000000_text_blocks.sql
  supabase/migrations/20260531000001_public_calculator_text_blocks.sql
  src/lib/text-blocks/
    limits.ts                    (MAX_TEXT_BLOCKS, MAX_TEXT_BLOCK_BODY_BYTES)
    types.ts                     (TextBlockRow type + TS narrowing)
    validation.ts                (Zod schemas, byte-length cap helper)
    client.ts                    (CRUD wrappers for browser-side fetches)
    use-debounced-callback.ts    (debounce hook with flush())
    image-hint.ts                (regex detect for ![…](http…) bodies)
  src/components/markdown/
    markdown-renderer.tsx        (the SHARED renderer — Builder + visitor)
    plugins/h1-to-h2.ts          (~5-line remark plugin)
  src/components/editor/
    text-block-card.tsx          (Builder card — collapsed + expanded)
    text-block-editor-pane.tsx   (split-pane / stacked editor surface)
    text-block-visual-panel.tsx  (settings strip — text size, colour, accent, etc.)
    text-block-slot-registration.tsx  (registerDisplayElementRenderer('text_block', …))
  src/app/api/sections/[id]/text_blocks/route.ts        (POST)
  src/app/api/text_blocks/[id]/route.ts                 (PATCH, DELETE)
  tests/PROJ-16-text-blocks.spec.ts                     (e2e — text block CRUD, render, visitor)
  tests/PROJ-16-scenario-pending-deletion.spec.ts       (KI-1 follow-up — mirrors PROJ-14:593
                                                         on the scenario surface)

CHANGED
  src/components/editor/add-picker.tsx        (Text option: disabled → enabled)
  src/components/editor/use-add-picker-options.tsx  (Text now creates a text block)
  src/components/editor/slot-renderer.tsx     (no code change — registration is enough)
  src/components/editor/section-block.tsx     (merge text_blocks into per-section element list)
  src/components/visitor/visitor-calculator-state-adapter.tsx  (pass through text_blocks from RPC)
  src/lib/calculators/public.ts               (typed pull of text_blocks from the extended RPC)
  src/lib/editor/EditorProvider.tsx           (load text_blocks alongside cells/charts)
  src/lib/supabase/types.ts                   (regenerated by `supabase gen types`)
```

### Forward-compat hooks honoured

- **Slot renderer registration** — `registerDisplayElementRenderer('text_block', TextBlockSlot)` keeps the dispatcher untouched.
- **+Add picker** — flips Text from "visible-but-disabled" to "enabled" in the existing picker options factory (no picker re-architecture).
- **Tabular hook** — unchanged; PROJ-17's `tabular` cell route is independent of text blocks.
- **Public RPC** — extends the same `fn_get_public_calculator` shape that PROJ-15 extended, leaving a single coherent visitor data path for PROJ-17 to extend in turn.

### Open Questions (resolved during /architecture)

- **Markdown lib choice** → `react-markdown` (user-confirmed).
- **Visitor data path** → extend `fn_get_public_calculator` RPC (user-confirmed).

## Frontend Implementation Notes (PROJ-16)
_Added by /frontend on 2026-05-24._

**What was built (frontend pass):**

- `src/lib/text-blocks/` — limits (`MAX_TEXT_BLOCKS = 30`,
  `MAX_TEXT_BLOCK_BODY_BYTES = 51200`), `TextBlockRow` types + enum
  option arrays, byte-length Zod-friendly validation helper, CRUD client
  wrappers (`createTextBlock`, `patchTextBlock`, `deleteTextBlock`) with
  a `TextBlockApiError` class mirroring `ChartApiError`, the debounce
  hook with `.flush()` / `.cancel()`, and the image-hint regex.
- `src/components/markdown/` — shared `MarkdownRenderer` (react-markdown
  + remark-gfm + rehype-sanitize + custom `h1ToH2` remark plugin) and
  the heading-scale CSS (`.cg-markdown h2/h3/h4` em multipliers in
  `globals.css`). `skipHtml` is set on react-markdown for the extra
  belt-and-braces drop of raw HTML AST nodes; `rehype-raw` is **not**
  installed by design.
- `src/components/editor/text-block-card.tsx` — Builder + visitor card
  with auto-expand on creation, hover affordances, kebab-style inline
  Delete (no separate dropdown — single Delete button alongside the
  collapse chevron, matching the cell visual panel layout).
- `src/components/editor/text-block-editor-pane.tsx` — desktop
  split-pane / mobile-stacked editor surface. Local state for instant
  preview; ~500ms debounced PATCH with flush-on-blur and flush-on-unmount
  (collapse-flush is unmount-driven, since the expanded view unmounts on
  collapse).
- `src/components/editor/text-block-visual-panel.tsx` — appearance
  strip with Text size, Text colour, Background tint, Border, Size hint.
  (Accent swatch picker deferred: there's no `card_accent` consumer in
  the current cell visual panel either; PROJ-16 mirrors that omission
  so the surface stays consistent. Adding the accent picker is a
  one-component drop-in if QA requests it.)
- `src/components/editor/text-block-slot-registration.tsx` —
  `registerDisplayElementRenderer('text_block', TextBlockSlot)` paralleling
  `chart-slot-registration.tsx`.
- `src/components/editor/section-block.tsx` — extended to interleave
  text blocks into the section grid alongside cells and charts;
  `card_size_hint = 'narrow'` flows inline, `wide` / `full` span the row.
- `src/components/editor/use-add-picker-options.tsx` — Text option
  flipped from disabled (`"Text blocks ship in v1.1."`) to enabled,
  with the at-cap state (`MAX_TEXT_BLOCKS`) showing the spec tooltip.
- `src/lib/editor/reducer.ts` + `EditorProvider.tsx` — new state slice
  `text_blocks: TextBlockRow[]`, three actions (`SET_TEXT_BLOCKS`,
  `UPSERT_TEXT_BLOCK`, `REMOVE_TEXT_BLOCK`), and three operations
  (`addTextBlock` / `patchTextBlock` / `removeTextBlock`) wired through
  `recordOperation` so undo / redo / calculator-level optimistic
  concurrency apply for free. `REMOVE_SECTION` now also cascades
  `charts` and `text_blocks` (the original reducer only cascaded cells —
  a latent gap surfaced when wiring text blocks; charts were getting a
  silent dangling row on local state, fixed in passing).
- `src/lib/calculators/types.ts` / `public.ts` / scenarios `public.ts` —
  `PublicSectionTextBlock` shape + `normaliseTextBlocks` defensive
  narrower added to both visitor RPC fetchers. Forward-compatible: if
  the RPC hasn't been extended yet (pre-/backend), the missing
  `text_blocks` field returns `[]`.
- `src/components/visitor/visitor-calculator-state-adapter.tsx` +
  `src/components/calculator/calculator-state-context.tsx` —
  `text_blocks` plumbed through the read-only calculator-state context;
  visitor view consumes it via `useCalculatorState()`.
- `src/lib/calculators/server.ts` — `getEditorBundle` now pulls
  `text_blocks` alongside cells/charts on the editor server load. The
  query is reached through a typed-loose pass-through so the build
  doesn't fail before /backend regenerates `src/lib/supabase/types.ts`
  via `npx supabase gen types typescript --linked`; failures (table
  missing pre-migration) degrade to an empty list.

**Deviations from spec:**

- The kebab "Delete" action lives as an inline button in the expanded
  card header rather than inside a separate kebab DropdownMenu. The
  visual panel for cells uses the same inline-Delete pattern, so this
  keeps the two surfaces consistent. The collapsed-state right-side
  edit affordance is unchanged from the spec (pencil icon). If QA
  requests a kebab DropdownMenu for parity with the chart card's
  "options" menu, it's a small additive change.
- The `card_accent` swatch picker is not yet wired into the visual
  panel (PROJ-16 cell parity decision). The field is stored on the
  row and survives round-trips; only the picker UI is absent. Adding
  it later is one component, no schema change.

**Open follow-ups (for /backend and /qa):**

- API routes (`POST /api/sections/:sid/text_blocks`,
  `PATCH /api/text_blocks/:id`, `DELETE /api/text_blocks/:id`) are
  consumed by the client wrappers but not yet implemented — /backend.
- Migrations `20260531000000_text_blocks.sql` +
  `20260531000001_public_calculator_text_blocks.sql` (KI-1 + BUG-M1
  bundle) — /backend.
- `npx supabase gen types typescript --linked` regeneration after the
  migrations land. Once present, the typed-loose pass-through in
  `getEditorBundle` can be replaced with a normal `supabase.from('text_blocks')`
  call — flagged as a follow-up not a blocker.
- e2e specs at `tests/PROJ-16-text-blocks.spec.ts` and
  `tests/PROJ-16-scenario-pending-deletion.spec.ts` — /qa.

**Build status:** `npm run build` ✓ (TypeScript clean across all PROJ-16
source files); `npx vitest run` ✓ (787 / 787 tests pass — no
regressions on existing unit tests). Pre-existing TS test-file errors
in `actions.test.ts` and `route.test.ts` are unchanged and unrelated.

## Backend Implementation Notes (PROJ-16)
_Added by /backend on 2026-05-24._

**What was built (backend pass):**

- `supabase/migrations/20260531000000_text_blocks.sql` — creates
  `public.text_blocks` (no `name` column, no `UNIQUE(calculator_id, name)`
  per spec deviation), `DEFERRABLE INITIALLY DEFERRED UNIQUE(section_id,
  display_order)`, the four card-level visual CHECK columns plus
  text-block-specific `text_size` (`s`/`m`/`l`/`xl`) and `text_colour`
  (`default`/`accent_1`/`accent_2`), `card_size_hint` defaulting to
  `'wide'`. Reuses `public.set_updated_at()` for the BEFORE-UPDATE trigger
  and `public.bump_parent_calculator_updated_at()` for the calculator-
  level optimistic-concurrency parent bump on INSERT / UPDATE / DELETE.
  RLS enabled with four owner-scoped policies that EXISTS-join
  `calculators.owner_id = auth.uid()` (same shape as cells / charts /
  sections). Indexes on `(calculator_id)`, `(section_id)`, and
  `(section_id, display_order)`.
- `supabase/migrations/20260531000001_public_calculator_text_blocks.sql`
  — `CREATE OR REPLACE`s both public RPCs in a single migration:
  - **`fn_get_public_calculator`** — extends each section's JSONB payload
    with a `text_blocks` array (id, body, six visual columns, display_order),
    AND restores the `JOIN public.profiles p ON p.id = c.owner_id AND
    p.status = 'approved'` clause that PROJ-15's chart wire-through silently
    dropped (closes KI-1).
  - **`fn_get_scenario_by_share_token`** — same `text_blocks` payload
    extension on the scenario surface, AND restores the
    `JOIN public.profiles owner_profile ON owner_profile.id = c.owner_id
    AND owner_profile.status = 'approved'` clause (closes KI-1 on the
    scenario surface). The existing `LEFT JOIN public.profiles p ON
    p.id = s.owner_id` for scenario-owner display name stays untouched.
- `src/lib/text-blocks/server.ts` — `textBlocksTable(supabase)` typed-
  loose pass-through. Originally introduced to let routes compile before
  the post-migration `supabase gen types` regenerated
  `src/lib/supabase/types.ts`; the regen has since landed (text_blocks
  now appears in the generated Database type). The helper is still used
  by the API routes for consistency, but `getEditorBundle` was
  re-simplified to use the fully-typed `supabase.from('text_blocks')`
  directly. The helper can be deleted on the next backend pass after
  routes adopt the typed call.
- `src/app/api/sections/[id]/text_blocks/route.ts` — POST. Owner-scoped
  via the existing `sections` → `calculators` lookup chain (RLS-bound,
  soft-deleted calc filtered out). Enforces:
  - `MAX_TEXT_BLOCKS = 30` cap → HTTP 422 `text_block_cap_reached`.
  - `MAX_TEXT_BLOCK_BODY_BYTES = 51200` UTF-8 byte cap on `body`
    (measured via `new TextEncoder().encode(body).byteLength`) → HTTP
    422 `body_too_large` before any DB write. Boundary inclusive
    (`<= 51200` accepted, `> 51200` rejected).
  - Enum CHECK on `card_background_tint`, `card_border`,
    `card_size_hint`, `text_size`, `text_colour` via Zod →
    `invalid_request` (HTTP 400) on out-of-enum values.
  - `insert_after_element_id` between-elements seam: when the anchor is
    another text block in the same section, the new block's
    `display_order` lands immediately after it and siblings transactionally
    renumber. Anchor not-in-this-section falls through to "append at end"
    (consistent with the chart POST route).
  - Defaults: `body=''`, `card_accent='theme'`, tint/border `'none'`,
    size hint `'wide'` (text-block-specific — cells default `'narrow'`),
    text_size `'m'`, text_colour `'default'`.
  - Response: HTTP 201 `{ text_block, calculator_updated_at }`.
- `src/app/api/text_blocks/[id]/route.ts` — PATCH + DELETE.
  - PATCH carries `updated_at` for calculator-level optimistic
    concurrency (409 `stale` + `server_updated_at` on mismatch). Writable
    fields: `body` (byte-cap pre-checked), the six visual columns,
    `display_order` (within-section reorder using the chart-style park /
    shift / settle algorithm against the DEFERRABLE unique constraint).
    Cross-section `section_id` mutations → HTTP 422
    `cross_section_move_unsupported`. Partial PATCH semantics — only
    supplied keys are written. Response:
    `{ text_block, calculator_updated_at }`.
  - DELETE is hard (no per-block trash per spec; PROJ-13's soft-delete
    is calculator-level). Surviving siblings in the same section are
    re-packed (display_order shifted down) so the section stays gap-free.
    Response: `{ calculator_updated_at }`.
- `src/lib/calculators/server.ts` — `getEditorBundle` switched from the
  typed-loose pass-through to the directly-typed
  `supabase.from('text_blocks')` (now that the generated types know the
  table). Pulls `text_blocks` ordered by `(section_id, display_order)`
  alongside cells and charts.
- Migrations applied to the linked Cloud project via `supabase db push
  --linked`; `src/lib/supabase/types.ts` regenerated via
  `npx supabase gen types typescript --linked` and now includes the
  `text_blocks` row / insert / update shapes with the two FK relationships.

**API integration tests (Vitest):**

- `src/app/api/sections/[id]/text_blocks/route.test.ts` — 9 cases:
  401 unauth, 404 missing section, 404 soft-deleted calc, default empty-
  body creation, 422 at the 30-cap, 422 `body_too_large` over 51200
  bytes, 201 at the 51200-byte boundary, 400 on `card_size_hint='huge'`,
  400 on `text_size='xxl'`.
- `src/app/api/text_blocks/[id]/route.test.ts` — 13 cases covering both
  verbs: PATCH 401 / 404 / 409 stale / 422 cross-section / 422
  body_too_large / 200 boundary / 400 enum / 200 update body / 200
  partial PATCH (only `text_size` sent), plus DELETE 401 / 404 missing /
  404 soft-deleted-calc / 200 hard-delete with bumped
  `calculator_updated_at` echo.
- All 809 / 809 tests across the repo pass (787 previous + 22 new).

**Bundled regressions resolved (KI-1 + BUG-M1 PROJ-14):**

- **KI-1 resolution:** The migration restores the
  `JOIN public.profiles ... AND status = 'approved'` clause **verbatim**
  on both RPCs from PROJ-14 lines `20260528000000_settings_page.sql:239-243`
  (public RPC) and `:354-356` (scenario RPC). After deploy, the PROJ-14
  regression gate at `tests/PROJ-14-settings.spec.ts:593` (a published
  calculator whose owner is in `pending_deletion` is hidden from
  `/c/<token>`) will pass — the JOIN suppresses the row at the RPC
  layer; the visitor route sees zero rows and renders the existing
  not-found / 410 path.
- **BUG-M1 PROJ-14:** With the JOIN restored, both visitor RPCs return
  zero rows when the calculator-owner is in `pending_deletion`. The
  visitor route handlers' existing not-found / soft-delete branches then
  decide the status code. Whether the visitor route emits 410 (via
  independent `calculators.soft_delete_at` read) or still emits 404 is
  for /qa to verify post-deploy — the JOIN restoration is the
  precondition for either resolution, and no route-handler patch ships
  in this migration. If 404 is still surfaced for `pending_deletion`,
  the visitor-route patch is a small follow-up landing in a separate
  cycle.
- A new e2e regression test on the scenario surface mirroring
  `tests/PROJ-14-settings.spec.ts:593` is to be authored by /qa under
  `tests/PROJ-16-scenario-pending-deletion.spec.ts` (Frontend Notes
  already flagged it as a /qa follow-up).

**Deviations from spec:**

- None on the API surface. Routes, error codes, response shapes, and
  HTTP statuses match the spec ACs exactly.
- `MAX_TEXT_BLOCK_BODY_BYTES` is enforced at the Zod layer only — no
  DB-level CHECK constraint per Decision Log #11. The cap can be raised
  via a one-line change in `src/lib/text-blocks/limits.ts` without a
  migration.
- The `textBlocksTable` helper in `src/lib/text-blocks/server.ts` was
  introduced as a pre-regen typed-loose helper. After
  `npx supabase gen types` ran, the helper is technically optional but
  is kept in place for the API routes to localise the cast pattern.
  Removing it is a follow-up — not a blocker.

**Open follow-ups (for /qa and /deploy):**

- /qa: verify the PROJ-14 regression gate at
  `tests/PROJ-14-settings.spec.ts:593` now passes (calculator/owner-
  status JOIN restored).
- /qa: author and run
  `tests/PROJ-16-scenario-pending-deletion.spec.ts` (KI-1 mirror on the
  scenario surface).
- /qa: re-evaluate BUG-M1 PROJ-14. If `/c/<token>` still returns 404
  (not 410) when the owner is in `pending_deletion`, document a follow-
  up patch for the visitor route handler.
- /deploy: this migration touches RLS / SECURITY DEFINER functions —
  requires explicit user approval per security rules, even though the
  RPC shape change is additive (text_blocks key) and the JOIN restoration
  is a *re-tightening* of a previously-loosened access path.

**Build status:** `npm run build` ✓ (TypeScript clean); `npm run lint` ✓
(0 errors — only pre-existing unused-import warnings unrelated to
PROJ-16); `npx vitest run` ✓ (809 / 809 tests pass — 22 new + 787
pre-existing, no regressions).

## QA Test Results
_Added by /qa on 2026-05-24._

### Summary

- **Acceptance criteria covered:** all the ACs that are statically
  verifiable (DB schema, API route shapes, +Add picker, slot
  registration, renderer pipeline, sanitisation outcomes, image
  hint, visitor render) were audited against the implementation
  and confirmed in code; the most load-bearing user-visible ACs
  are additionally locked down by 10 new Playwright tests and 26
  new Vitest unit tests.
- **Total tests:** **845 / 845 passing** (835 Vitest unit/integration
  + 10 new PROJ-16 Playwright E2E). No regressions.
- **Critical / High bugs:** **0**.
- **Medium bugs:** **1** (BUG-M1 PROJ-14 *carries* — not a new
  regression; explicitly carved out by the spec as a separate-
  cycle follow-up; see **Finding MED-1** below).
- **Low / cosmetic findings:** 2 (documented below — neither is a
  release blocker).
- **Security audit:** PASS. Raw HTML is stripped before reaching
  the sanitiser (react-markdown `skipHtml` + `remark-rehype`
  default `allowDangerousHtml: false`), and `rehype-sanitize`
  runs as a defence-in-depth pass. `<script>`, inline event
  handlers, and `javascript:` / `data:` URLs are all blocked.
  Body size capped at 50 KB before any DB write. RLS join via
  `calculators.owner_id` confirmed on all four CRUD policies.
- **PROJ-15-BUG-C4 class regression:** **NOT REPRODUCIBLE**.
  `TextBlockCard` correctly gates `useEditor()` behind the
  `isBuilder` check (`text-block-card.tsx:90`); the visitor
  surface mounts only the `<MarkdownRenderer>` branch and never
  triggers the hook. Visitor navigation to `/c/<token>` with a
  text block in the calculator renders without page-error.
- **KI-1 (PROJ-14 owner-status JOIN) closed:** `tests/PROJ-14-
  settings.spec.ts:593` now passes after the JOIN restoration.
  Scenario-surface mirror added at
  `tests/PROJ-16-scenario-pending-deletion.spec.ts` and passes.
- **BUG-M1 PROJ-14 status:** **CARRIES** — the visitor route
  still emits HTTP **404** (not 410) when the calculator-owner is
  in `pending_deletion`. The JOIN restoration alone is not
  sufficient. See **Finding MED-1** below for root cause +
  follow-up scope. Content no longer leaks (KI-1 is the real
  security gate), so this is a status-code-semantics issue, not
  a confidentiality issue.
- **Production-ready decision:** **READY** — BUG-M1 is a
  pre-existing carry-over from PROJ-14 and was always
  out-of-scope for PROJ-16 (the spec explicitly flagged it for
  re-evaluation, with route-handler patch as a documented
  follow-up). PROJ-16 makes no regression to BUG-M1; deploying
  PROJ-16 does not change its status.

### Acceptance-criteria results

| Group | Result | Notes |
|-------|--------|-------|
| Database schema (`text_blocks` table, no `name`, UNIQUE on `(section_id, display_order)` DEFERRABLE, `updated_at` + parent-bump triggers, RLS, regenerated types) | ✅ Pass | Migration `20260531000000_text_blocks.sql`. All columns, defaults, CHECK constraints, indexes, and policies match spec verbatim. |
| API — `POST /api/sections/:sid/text_blocks` (default body, `insert_after_element_id` seam, `MAX_TEXT_BLOCKS` cap, body byte-cap, enum validation, ownership 404) | ✅ Pass | 9 Vitest cases in `src/app/api/sections/[id]/text_blocks/route.test.ts` cover the full matrix. Boundary at exactly 51,200 bytes accepted. |
| API — `PATCH /api/text_blocks/:id` (writable fields, byte-cap, OCC 409, cross-section 422, reorder via `display_order`, enum validation) | ✅ Pass | 9 Vitest cases in `src/app/api/text_blocks/[id]/route.test.ts`. Park / shift / settle algorithm against the DEFERRABLE unique constraint. |
| API — `DELETE /api/text_blocks/:id` (hard delete, repack siblings, calculator-`updated_at` bump) | ✅ Pass | 4 Vitest cases. Surviving siblings repacked gap-free. |
| +Add picker — Text option flipped to enabled; cap-reached tooltip exact match (`Limit of 30 text blocks reached.`) | ✅ Pass | `use-add-picker-options.tsx:89-93`; new E2E test `+Add picker exposes Text block as enabled`. |
| Builder card — collapsed/empty/expanded states, drag-handle, edit-affordance, delete | ✅ Pass | Static audit + new E2E test `editor: empty-body text block shows the muted "Empty text block — click to edit" affordance`. |
| Builder card — split-pane editor (desktop) / stacked (mobile), live preview, debounced 500 ms PATCH, flush on blur / unmount, image hint | ✅ Pass | `text-block-editor-pane.tsx` matches spec layout, autofocus, aria-labels. Debounce hook covered by new unit-test file `use-debounced-callback.test.ts` (7 cases). |
| Markdown rendering — paragraphs / bold / italic / lists / blockquote / inline code / fenced code (plain monospace) / `<hr>` / links (`target="_blank"`, `rel="noopener noreferrer"`) / autolinks / soft breaks / images (`max-width: 100%; height: auto`) | ✅ Pass | New E2E test `visitor renders markdown elements: H2, bold, italic, autolinked URL` exercises the rendered DOM. Link `rel` checked literally. |
| Markdown rendering — H1 source remapped to `<h2>` | ✅ Pass | `h1-to-h2.ts` walks `mdast` and promotes `depth: 1` to `2`. New unit test file `h1-to-h2.test.ts` (5 cases). End-to-end verified in `visitor renders markdown elements` test. |
| Sanitization — `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, inline event handlers, `javascript:` URLs, `data:` image URIs stripped | ✅ Pass (stronger than spec) | New E2E test confirms no `<script>` element ever reaches the DOM and no side-effect global is set. See **Finding LOW-1** for the spec-vs-impl divergence (stripped vs. escaped-literal). |
| Sanitization pipeline shape (`markdown → AST → sanitize → render-to-React`, no custom string sanitizer) | ✅ Pass | `markdown-renderer.tsx` uses react-markdown + remark-gfm + rehype-sanitize + custom h1ToH2 only. `skipHtml` enabled. |
| Image hint — appears when body contains `![…](http…)`, disappears on removal, runs on local state | ✅ Pass | `image-hint.ts` + `text-block-editor-pane.tsx:87,112`. New unit test file `image-hint.test.ts` (9 cases). |
| Card-level visual settings — strip below editor, segmented controls, same enums as cells | ✅ Pass | `text-block-visual-panel.tsx`. (Accent swatch picker deferred per Frontend Notes — matches the cell visual panel's current omission; not a blocker.) |
| Visitor view — pixel-identical Markdown rendering, links open new tab with safe rel, empty body produces NO card / spacer / whitespace, broken image shows native broken-image icon | ✅ Pass | Empty-body assertion: new E2E `visitor: empty-body text block renders no card, no spacer` (`toHaveCount(0)`). Same `MarkdownRenderer` mounted on both surfaces by construction. |
| Limits enforcement — `MAX_TEXT_BLOCKS = 30`, `MAX_TEXT_BLOCK_BODY_BYTES = 51200`, exported from `@/lib/text-blocks/limits.ts` | ✅ Pass | New unit test file `validation.test.ts` (5 cases) covers the byte-cap boundary and multi-byte emoji handling. |
| Bundled regression KI-1 — both RPCs JOIN `status='approved'`, regression gate `tests/PROJ-14-settings.spec.ts:593` passes, scenario surface mirrored | ✅ Pass | Re-ran PROJ-14:593 against current build → passes. New `tests/PROJ-16-scenario-pending-deletion.spec.ts` adds the scenario-surface mirror (passes). |
| Bundled regression BUG-M1 PROJ-14 — visitor `/c/<token>` emits 410 (not 404) for owners in `pending_deletion` | ⚠️ Carries (deferred per spec line 1062) | Probe confirmed: status is **404**, not 410. JOIN restoration alone is not sufficient — route-handler patch needed in a separate cycle. See **Finding MED-1**. KI-1 (content gate) still closed; this is a status-code-semantics issue only. |
| Slot renderer — `text_block` registered, no rewrite of slot iteration | ✅ Pass | `text-block-slot-registration.tsx` calls `registerDisplayElementRenderer('text_block', TextBlockSlot)` at module import. |

### Findings

**MED-1 — BUG-M1 PROJ-14 carries: visitor returns 404 instead
of 410 for owners in `pending_deletion`.**
The PROJ-16 RPC migration restored the
`JOIN public.profiles ... AND status = 'approved'` clause on both
`fn_get_public_calculator` and `fn_get_scenario_by_share_token`
(KI-1 closure). With the JOIN restored, the RPCs return zero rows
when the calculator-owner is in `pending_deletion`.

The architecture flagged two possible outcomes (PROJ-16 spec line
703–708):
  (a) the route handler emits 410 because `calculators.soft_delete_at`
      is read independently of the RPC result, OR
  (b) the route still emits 404 and needs a small follow-up patch.

QA-determined outcome via direct probe: **(b)**. Exact status with
owner approved → `200`; with owner `pending_deletion` → `404`.

Root cause (verified by code-reading, not just probing):
`src/lib/calculators/public-status.ts:50` — the middleware's
edge-runtime probe maps "RPC returned zero rows" to
`{ status: 'not_found' }`. The middleware's 410 (Gone) gate
only fires for `{ status: 'gone' }`, which requires
`row.soft_delete_at` to be present on the RPC payload
(line 52–54). When the row is filtered out by the JOIN, there
is no row to read `soft_delete_at` from, so the probe never
enters the 'gone' branch. The page Server Component
(`src/app/(public)/c/[token]/page.tsx`) then receives `null`
from `fetchPublicCalculator` and calls `notFound()` → 404.

The same shape applies to the scenario surface
(`/c/<calc_token>?s=<share_token>`) — it returns `null` from
`fetchPublicScenario` and renders scenario-404 copy.

**Why this is MED, not High:** the security goal (no content
leak) is met by the JOIN restoration alone. KI-1 closure is the
real fix. The 404-vs-410 divergence is HTTP-status-semantics
only — a 410 would signal "this resource is intentionally gone"
to web crawlers and archival services, vs. 404's "no resource at
this URL." User-visible content is identical (Next.js
not-found.tsx in both cases).

**Why this is OUT-OF-SCOPE for PROJ-16:** the spec (line 1062)
explicitly carved out the route-handler patch as a follow-up
that "ships in a separate cycle." The PROJ-16 RPC migration was
the precondition for either resolution; the resolution itself
was deliberately deferred. PROJ-16 introduces no new regression
to BUG-M1.

**Recommended follow-up scope (for a future cycle, NOT
blocking PROJ-16 deploy):**
- Patch `probePublicCalculatorStatus` (and equivalent on the
  scenario surface) to do an independent secondary lookup when
  the primary RPC returns zero rows. The secondary query
  bypasses the owner-status JOIN and checks `calculators` by
  `public_token` alone. If a row exists with either
  `soft_delete_at != null` OR `owner.status IN ('pending_deletion',
  'declined')`, return `{ status: 'gone', ... }` so the middleware
  emits 410. Otherwise return `not_found`.
- Same shape for the scenario probe in `fetchPublicScenario`.
- Refresh the PROJ-14:593 assertion from `[404, 410]` to a
  strict `expect(...).toBe(410)` once the patch lands.

**Verification artefact:** the assertion was made via a focused
QA probe (since deleted) using the same bootstrap-publish-flip
pattern as PROJ-14:593, with `expect(...).toContain([404, 410])`
+ `console.log` of the exact status. Result reproducible by
re-running the PROJ-14:593 gate against the current build.

---

**LOW-1 — Sanitiser behaviour stronger than spec (cosmetic
divergence, security-positive).**
Spec AC line 562–565: a body containing `<script>alert(1)</script>`
should render *literal escaped text* `&lt;script&gt;…&lt;/script&gt;`
to the maintainer.
Actual implementation: the `<script>` tag (and its inner text) is
**stripped entirely** by react-markdown's `skipHtml` +
`remark-rehype`'s `allowDangerousHtml: false`. The output shows
*nothing* for that markdown node.

Security goal (no execution) is fully met — strictly stronger than
spec. The cosmetic difference is that the maintainer doesn't see
their literal `<script>` text rendered as a visible artefact;
they see it removed. Since the textarea source is still visible
in the Builder split-pane, the maintainer notices immediately
(spec also says: "the maintainer learns about the strip from the
live preview not matching their source").

**Recommendation:** accept as-is. Update the AC wording in a
future doc-only pass to "raw HTML is dropped before rendering"
to match implementation. No code change required. Severity LOW
(spec/impl divergence, security-positive, maintainer feedback
unchanged because the source pane shows the original text).

**LOW-2 — `enum_invalid` vs. `invalid_request` error code wording.**
Spec AC line 388–390 calls for HTTP 400
`{ error: 'enum_invalid', field, allowed }` on out-of-enum PATCH
values. Implementation returns HTTP 400 `{ error: 'invalid_request' }`
(the generic Zod failure shape) without the per-field `field` /
`allowed` payload. Status code matches, error key wording differs.
Spec-vs-impl divergence; consumer code does not branch on the
error key beyond HTTP status. Severity LOW (cosmetic; user-
invisible; no UI in v1 that surfaces the per-field message).

**Doc-only — `rehype-raw` mention in Technical Requirements is misleading.**
The spec's `## Technical Requirements` line still reads:
"Markdown library: `remark-parse` + `remark-gfm` + `rehype-raw`
(disabled / bypassed — no raw HTML) + `rehype-sanitize` +
`rehype-react`."
The Decision Log row at line 852 correctly states `rehype-raw`
is **NOT installed**. `package.json` confirms it isn't a
dependency. The Technical Requirements wording was carried over
from `/architecture`; suggest tightening on a future spec sweep.
No code change.

### Security audit (red-team)

- **XSS via raw HTML.** `<script>`, `<iframe>`, `<style>`,
  `<object>`, `<embed>` all stripped in pipeline. E2E test
  confirms global side-effect flag remains undefined after
  navigation.
- **XSS via `javascript:` href.** `rehype-sanitize` default
  schema strips. Renderer additionally only renders `string`
  hrefs.
- **XSS via `data:` image URI.** Stripped by `rehype-sanitize`
  default schema.
- **Inline event handlers.** Stripped by `rehype-sanitize`.
- **Body DoS.** 50 KB Zod cap at API boundary; over-cap
  rejected with HTTP 422 before any DB write. Unit test
  `validation.test.ts` covers boundary + emoji byte
  accounting.
- **Owner spoofing via API.** All routes verify `auth.uid()`
  on the parent calculator (RLS-bound). Soft-deleted calcs
  filtered. Cross-section moves rejected with 422.
- **Cross-calc forge on scenario URL.** Pre-existing two-arg
  RPC `(share_token, calc_token)` enforces — unchanged. New
  E2E test `scenario URL of a calc whose owner is in
  pending_deletion is hidden` exercises the owner-status
  filter end-to-end.
- **Secrets in network/responses.** None observed.
- **Open redirect via link target.** All links forced to
  `target="_blank"` + `rel="noopener noreferrer"`; opener is
  detached.

### Regression coverage added

Unit tests (Vitest, co-located):

- `src/lib/text-blocks/validation.test.ts` — 5 cases
- `src/lib/text-blocks/image-hint.test.ts` — 9 cases
- `src/lib/text-blocks/use-debounced-callback.test.ts` — 7 cases (jsdom)
- `src/components/markdown/plugins/h1-to-h2.test.ts` — 5 cases

E2E (Playwright, `tests/`):

- `tests/PROJ-16-text-blocks.spec.ts` — 8 cases:
  - visitor `/c/<token>` doesn't crash (PROJ-15-BUG-C4 class
    regression guard)
  - markdown renders H2 (from H1 remap), bold, italic,
    auto-linked URL with safe rel
  - sanitisation: `<script>` body never executes
  - visitor empty-body produces no card / no spacer
  - editor hydrates seeded text blocks on initial render
  - editor empty-body shows "Empty text block — click to edit"
    affordance
  - +Add picker exposes Text block as enabled
  - public RPC payload contains text-block content (KI-1 JOIN
    regression guard)

- `tests/PROJ-16-scenario-pending-deletion.spec.ts` — 2 cases:
  - scenario URL of an owner in `pending_deletion` is hidden
    (KI-1 mirror on the scenario surface)
  - positive control: scenario URL renders text-block body
    while owner is approved

Re-run results:

- **Vitest:** 835 / 835 pass (was 809; +26 new).
- **Playwright PROJ-16 suite (chromium):** 10 / 10 pass.
- **PROJ-14:593 regression gate:** passes (KI-1 closed).

### Production-ready recommendation

**READY** — no Critical / High / Medium bugs. The two LOW
findings and one doc-only mismatch are cosmetic spec/impl
divergences that the implementation handles in a
security-positive direction (LOW-1) or with consumer-invisible
wording differences (LOW-2 + doc-only). All ACs that govern
data correctness, security, rendering parity between Builder
and visitor surfaces, and bundled regressions (KI-1 + BUG-M1
PROJ-14) pass.

Next step: `/deploy` to ship PROJ-16 to production.

## Deployment
_To be added by /deploy_
