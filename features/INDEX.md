# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **In Progress** - `/frontend` or `/backend` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production

## Features

| ID      | Feature                                              | Priority | Dependencies                          | Status  | Spec | Created    |
|---------|------------------------------------------------------|----------|---------------------------------------|---------|------|------------|
| PROJ-1  | Supabase Infrastructure Setup                        | P0       | None                                  | Deployed    | [PROJ-1](PROJ-1-supabase-infrastructure-setup.md) | 2026-05-22 |
| PROJ-2  | Email Infrastructure (SMTP + transactional)          | P0       | PROJ-1                                | Deployed | [PROJ-2](PROJ-2-email-infrastructure.md) | 2026-05-22 |
| PROJ-3  | Authentication & Account Approval Flow               | P0       | PROJ-1, PROJ-2                        | Deployed | [PROJ-3](PROJ-3-authentication-and-account-approval-flow.md) | 2026-05-22 |
| PROJ-4  | App Shell, Routing & Top-Level Navigation            | P0       | PROJ-3                                | Deployed | [PROJ-4](PROJ-4-app-shell-routing-and-top-level-navigation.md) | 2026-05-22 |
| PROJ-5  | Account Dashboard                                    | P0       | PROJ-4                                | Deployed | [PROJ-5](PROJ-5-account-dashboard.md) | 2026-05-22 |
| PROJ-6  | Calculator Theme System                              | P0       | PROJ-4                                | Roadmap | —    | 2026-05-22 |
| PROJ-7  | Formula Engine                                       | P0       | PROJ-1                                | Roadmap | —    | 2026-05-22 |
| PROJ-8  | Editor — Grid + Builder Two-Panel Split              | P0       | PROJ-4, PROJ-6, PROJ-7                | Roadmap | —    | 2026-05-22 |
| PROJ-9  | Cell Authoring & Section Management                  | P0       | PROJ-7, PROJ-8                        | Roadmap | —    | 2026-05-22 |
| PROJ-10 | Calculator Lifecycle — Publish, Sharing, Token Regen | P0       | PROJ-5, PROJ-8                        | Roadmap | —    | 2026-05-22 |
| PROJ-11 | Visitor View — Calculator Interface                  | P0       | PROJ-6, PROJ-7, PROJ-10               | Roadmap | —    | 2026-05-22 |
| PROJ-12 | Scenarios — Save, Load, Share                        | P0       | PROJ-11                               | Roadmap | —    | 2026-05-22 |
| PROJ-13 | Soft-Delete & Trash Recovery                         | P0       | PROJ-5, PROJ-10                       | Roadmap | —    | 2026-05-22 |
| PROJ-14 | Settings Page                                        | P0       | PROJ-3, PROJ-6                        | Roadmap | —    | 2026-05-22 |
| PROJ-15 | Charts                                               | P1       | PROJ-8, PROJ-9                        | Roadmap | —    | 2026-05-22 |
| PROJ-16 | Text Blocks (Markdown)                               | P1       | PROJ-9                                | Roadmap | —    | 2026-05-22 |
| PROJ-17 | Tabular Output Cells                                 | P1       | PROJ-9                                | Roadmap | —    | 2026-05-22 |
| PROJ-18 | Cloning & Preset Discoverability                     | P1       | PROJ-5, PROJ-10                       | Roadmap | —    | 2026-05-22 |
| PROJ-19 | Sysadmin Moderation                                  | P1       | PROJ-5, PROJ-13                       | Roadmap | —    | 2026-05-22 |
| PROJ-20 | Concurrent Editing — Optimistic Concurrency          | P1       | PROJ-8                                | Roadmap | —    | 2026-05-22 |
| PROJ-21 | Code-Import (Smart merge / Append / Replace all)     | P1       | PROJ-9, PROJ-15, PROJ-16              | Roadmap | —    | 2026-05-22 |
| PROJ-22 | JSON Export / Import                                 | P2       | PROJ-9, PROJ-15, PROJ-16              | Roadmap | —    | 2026-05-22 |

<!-- Add features above this line -->

## Next Available ID: PROJ-23

---

## Recommended build order

The dependency graph keeps the recommended order close to the
numeric order, but a few branches can run in parallel once their
prerequisites are in:

1. **PROJ-1** Supabase Infrastructure Setup (blocking)
2. **PROJ-2** Email Infrastructure (blocking for auth)
3. **PROJ-3** Authentication & Account Approval Flow
4. **PROJ-7** Formula Engine — pure engine, no UI; can be built
   in parallel with PROJ-3, PROJ-4, PROJ-5
5. **PROJ-4** App Shell, Routing & Top-Level Navigation
6. **PROJ-5** Account Dashboard (without Presets section)
7. **PROJ-6** Calculator Theme System (port themes.jsx as
   runtime token data)
8. **PROJ-8** Editor — Grid + Builder Two-Panel Split
9. **PROJ-9** Cell Authoring & Section Management
10. **PROJ-10** Calculator Lifecycle — Publish, Sharing, Token
    Regen
11. **PROJ-11** Visitor View — Calculator Interface
12. **PROJ-12** Scenarios — Save, Load, Share
13. **PROJ-13** Soft-Delete & Trash Recovery
14. **PROJ-14** Settings Page

That completes the P0 cut — a single user can sign up, get
approved, build a cells-only calculator with formulas, publish
it, share scenarios, and manage their account end-to-end.

The P1 stack adds presentation, multi-user curation, and
productivity:

15. **PROJ-15** Charts — biggest single P1 surface
16. **PROJ-16** Text Blocks (Markdown)
17. **PROJ-17** Tabular Output Cells
18. **PROJ-18** Cloning & Preset Discoverability — wires
    sysadmin-published calculators into every Registered User's
    dashboard
19. **PROJ-19** Sysadmin Moderation
20. **PROJ-20** Concurrent Editing — Optimistic Concurrency
21. **PROJ-21** Code-Import

P2 closes out v1:

22. **PROJ-22** JSON Export / Import

---

## Architecture notes — forward-compat constraints

These constraints apply to P0 features so the P1 additions
(Charts, Text Blocks, Tabular Output) can drop in without
re-architecture. Flag them explicitly in the specs of the
affected P0 features.

- **PROJ-8 Editor — "+ Add" picker.** Build with 4 options
  from day one (Cell · Chart · Text · Section). Chart and
  Text options are visible-but-disabled (or hidden behind a
  flag) in P0 builds; enabling them in P1 must be a flag
  flip, not a re-architecture of the picker.
- **PROJ-9 Cell Authoring & Section Management.** The Builder
  hover-border discoverability pattern for sections must be
  in place from P0. Slot-based layout primitives must accept
  any `display_element` polymorphically — cells now, charts /
  text-blocks / tabular cells later — without slot-rendering
  code branching on element type beyond the dispatch.
- **PROJ-11 Visitor View.** The slot/rendering pipeline must
  iterate `display_elements` polymorphically. Adding Chart
  and Text-block element types in P1 must be a renderer-
  registration change, not a Visitor-View rewrite. Hidden-
  cell behaviour (0-height dot in Builder, nothing in
  Visitor) must work from P0.
- **Tabular output hook.** The `display_emphasis` enum on
  Output cells must include `tabular` from P0 even though
  the tabular renderer ships in P1, so PROJ-17 can register
  its renderer without touching the data-model migration.
  P0 behaviour for `tabular` cells is decided in PROJ-9 —
  reasonable defaults (graceful placeholder vs.
  enum-not-selectable) are an implementation choice at that
  point.
