# PROJ-19: Sysadmin Moderation

## Status: Architected
**Created:** 2026-05-25
**Last Updated:** 2026-05-25

## Dependencies
- Requires: PROJ-5 (Account Dashboard) — dashboard page layout, `Section` primitive with `tint="danger"`, `CalcCard` primitive
- Requires: PROJ-13 (Soft-Delete & Trash Recovery) — `DestructiveConfirmSheet` component, admin-client hard-delete pattern

## User Stories
- As a **sysadmin**, I want to see all calculators from all users in a dedicated dashboard section so that I can monitor what has been created on the platform.
- As a **sysadmin**, I want to permanently delete any user's calculator so that I can remove inappropriate, broken, or test content from the platform.
- As a **sysadmin**, I want a confirmation step before permanent deletion so that I don't accidentally destroy a user's work.
- As a **sysadmin**, I want the section to only appear when I am logged in with a sysadmin account so that regular users never see it.
- As a **sysadmin**, I want to see the calculator owner's name on each card so that I can identify whose content I am moderating.

## Out of Scope
- **Search, filter, and pagination** — private app with a small user base (tens-to-hundreds). All calculators load in one pass with a defensive LIMIT. If scale grows, PROJ-19 can be revisited.
- **Bulk delete** — single-calculator moderation only.
- **Soft-delete / Move to Trash** — sysadmin delete is a single-step permanent hard-delete. No recovery window.
- **Notification email to the owner** — the owner discovers deletion only by its absence. No transactional email on sysadmin delete. Can be added later if needed.
- **Promote/demote sysadmin accounts via UI** — role management is CLI-only (`npm run seed:sysadmin` + direct DB update). No UI surface for role changes.
- **Edit/rename/unpublish other users' calculators** — the only moderation action is permanent delete.
- **Moderate scenarios independently** — scenarios are deleted as a side-effect of calculator deletion, not as a standalone moderation action.
- **Moderate user accounts** — account approval/decline lives in the existing PROJ-3 email-link flow. PROJ-19 is calculator-level only.
- **View other users' Trash** — the section shows only active (non-soft-deleted) calculators from all users. Soft-deleted calculators are invisible to the sysadmin section (they'll be auto-purged by the existing cron).

## Acceptance Criteria

**Section visibility**

- [ ] Given the user is a sysadmin, when the dashboard loads, then a "User Calculators" section appears as the last section (slot 5, below Trash), with a danger tint (red-washed frame).
- [ ] Given the user is a registered (non-sysadmin) user, when the dashboard loads, then the "User Calculators" section is not rendered.
- [ ] Given the user is a sysadmin and there are zero calculators from other users, when the dashboard loads, then the "User Calculators" section is hidden (same hide-when-empty convention as My Calculators).

**Section content**

- [ ] Given the user is a sysadmin and other users have active (non-soft-deleted) calculators, when the section loads, then each calculator is shown as a card displaying: title, description (2-line clamp), owner name, relative "Edited" timestamp, Published/Draft pill, and a Public Link icon-button.
- [ ] Given the user is a sysadmin, when the section loads, then the sysadmin's own calculators are excluded from the "User Calculators" section (they already appear in "My Calculators").
- [ ] Given the user is a sysadmin, when the section loads, then the count pill in the section header shows the number of other users' active calculators.
- [ ] Given the user is a sysadmin and another user's calculator is published, when the sysadmin clicks the card, then the calculator's public view opens in a new tab (same as CalcCard anchor behaviour).

**Delete permanently action**

- [ ] Given the user is a sysadmin viewing the "User Calculators" section, when they click the kebab menu on a calculator card, then a dropdown appears with a single destructive "Delete permanently" option (red text).
- [ ] Given the sysadmin selects "Delete permanently" from the kebab, when the confirmation sheet opens, then it displays: "Permanently delete «{title}»? This will also delete all scenarios linked to this calculator. This cannot be undone."
- [ ] Given the confirmation sheet is open, when the sheet fetches the scenarios count, then the body copy includes the count: "{N} scenario(s) will be permanently deleted." (or omits the count line when N = 0).
- [ ] Given the sysadmin confirms the deletion, when the API call succeeds, then:
  - The calculator row is hard-deleted from the database.
  - All scenarios linked to this calculator (from any user) are hard-deleted.
  - All sections, cells, charts, and text blocks belonging to this calculator are cascade-deleted (existing FK ON DELETE CASCADE).
  - A success toast appears: "Permanently deleted «{title}»."
  - The dashboard refreshes (router.refresh()) and the card disappears from the section.
- [ ] Given the sysadmin confirms the deletion, when the API call fails, then an error toast appears ("Couldn't delete — please try again.") and the sheet stays open.

**API authorization**

- [ ] Given a non-sysadmin user, when they call the sysadmin moderation DELETE endpoint, then they receive a 403 Forbidden response.
- [ ] Given an anonymous (unauthenticated) request, when it hits the moderation DELETE endpoint, then it receives a 401 Unauthorized response.
- [ ] Given a sysadmin, when they call the moderation DELETE endpoint for a calculator that does not exist, then they receive a 404 Not Found response.

**Server-side data fetch**

- [ ] Given a sysadmin, when the dashboard page loads, then the server fetches all active (non-soft-deleted) calculators from other users, ordered by `updated_at DESC`, with a defensive LIMIT of 200.
- [ ] Given a non-sysadmin, when the dashboard page loads, then the server does not execute the "all user calculators" query.

## Edge Cases
- **Sysadmin deletes a calculator that the owner is currently editing:** The owner's next save (PATCH) will 404. The editor's existing error handling surfaces "Calculator not found" — no special sysadmin-specific UX needed.
- **Sysadmin deletes a calculator that has active shared-scenario URLs:** All scenarios are hard-deleted, so shared scenario URLs will return 0 rows (existing graceful-degradation in `fn_get_scenario_by_share_token` returns empty result for orphan/missing scenarios). Visitors see the "Scenario not found" empty state.
- **Sysadmin deletes a calculator that was cloned by another user:** The clone's `cloned_from_id` FK is `ON DELETE SET NULL` — the clone survives, only its attribution link is severed. No cascade.
- **Sysadmin deletes a calculator that is in Trash (soft-deleted):** The "User Calculators" section only shows active (non-soft-deleted) calculators, so trashed calculators are not visible in the moderation section. They will be auto-purged by the existing cron job.
- **Race condition: two sysadmins delete the same calculator simultaneously:** The second DELETE will 404 — the confirm-sheet handler surfaces "Calculator not found" via toast.
- **Sysadmin tries to delete their own calculator via the moderation endpoint:** The section excludes the sysadmin's own calculators. Even if the endpoint is called directly, it should reject own-calculator deletion with 403 to prevent bypassing the Trash flow.

## Technical Requirements (optional)
- Security: Sysadmin role check must happen server-side (both in the page-load query and the API route). Client-side role gating is cosmetic only.
- Performance: The "list all user calculators" query runs once per dashboard page load for sysadmins; non-sysadmins never trigger it.

## Open Questions
_(None — all product decisions resolved in pre-interview.)_

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Hard-delete only (no Move to Trash) | Sysadmin moderation is a decisive action — if a sysadmin deletes, it's intentional. A Trash step adds complexity for a rare, deliberate action. The confirmation sheet is the safety net. | 2026-05-25 |
| Scenarios hard-deleted (not orphaned) | Unlike owner-initiated hard-delete (PROJ-13) which SET NULLs scenarios, sysadmin moderation means "remove this content entirely." Orphaned scenarios from moderated calculators would litter visitors' dashboards with broken references. | 2026-05-25 |
| No notification email to owner | Keeps the v1 moderation path simple. The sysadmin can reach out manually (out-of-band) if needed. Avoids designing an email template + edge cases (deleted user, bounced email). | 2026-05-25 |
| No search, filter, or pagination | Private app, tens-to-hundreds of users, each with a handful of calculators. A flat list with a defensive LIMIT 200 is sufficient. Can be revisited if the user base grows. | 2026-05-25 |
| Exclude sysadmin's own calculators from section | Sysadmin's own calculators already appear in "My Calculators." Showing them twice would be confusing and the delete semantics differ (own = Trash flow; moderation = hard-delete). | 2026-05-25 |
| Section hidden when empty | Consistent with My Calculators convention. If the sysadmin is the only user, there's nothing to moderate. | 2026-05-25 |
| No promote/demote UI | Role management is out-of-band (CLI seed script + direct DB). The single-deployer model means the sysadmin is the deployer and can run SQL. A UI for role management is overkill for v1. | 2026-05-25 |
| Block sysadmin from deleting own calculator via moderation endpoint | Prevents bypassing the Trash → Delete Permanently flow that protects against accidental self-destruction. | 2026-05-25 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| SECURITY DEFINER RPC for cross-owner query (same pattern as `fn_list_presets`) | RLS on calculators is owner-scoped. Rather than relaxing the policy, a DEFINER function centralises the cross-owner read in one auditable place with an `is_sysadmin(auth.uid())` check at entry. | 2026-05-25 |
| Separate `/api/admin/calculators/:id` endpoint (not reusing `/api/calculators/:id`) | Existing DELETE handles soft-delete + hard-delete-from-trash with different semantics (concurrency, SET NULL scenarios). Sysadmin moderation hard-deletes scenarios, rejects own-calculator, and requires role verification — a dedicated route keeps each path clear. | 2026-05-25 |
| New `ModerationCalcCard` component (not reusing `CalcCard`) | Card interaction differs significantly: shows owner name, single kebab action, no edit/rename/duplicate/publish affordances, direct hard-delete. Avoids branching inside `CalcCard`. | 2026-05-25 |
| New `ModerationDeleteSheet` (not reusing `DeletePermanentlySheet`) | Different copy ("also delete all scenarios" vs. "orphan"), different API call, no `updated_at` concurrency check. Wraps the existing `DestructiveConfirmSheet` primitive. | 2026-05-25 |
| Scenarios hard-deleted (not orphaned) | Per product decision — sysadmin moderation means "remove entirely." Endpoint hard-deletes all scenarios before deleting the calculator. Differs from PROJ-13's SET NULL approach. | 2026-05-25 |
| Server-side role gate + client-side cosmetic gate | Real authorization lives in the RPC function and the API route. The dashboard's conditional rendering is cosmetic only. | 2026-05-25 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
Dashboard Page (Server Component — already exists)
│
├── WelcomeLine
├── NewCalculatorHero
├── MyCalculatorsSection          (slot 1)
├── MyScenariosSection            (slot 2)
├── PresetsSection                (slot 3)
├── TrashSection                  (slot 4)
│
└── UserCalculatorsSection  ← NEW (slot 5, sysadmin-only)
    ├── Section (tint="danger")
    │   └── card grid (1-col mobile, 2-col sm+)
    │       └── ModerationCalcCard  ← NEW
    │           ├── icon badge + title + description (2-line clamp)
    │           ├── owner name line (new)
    │           ├── kebab menu → "Delete permanently" (single item, red)
    │           ├── footer: "Edited <relative>" + Published/Draft pill
    │           │           + Public Link icon
    │           └── ModerationDeleteSheet  ← NEW
    │               └── DestructiveConfirmSheet (existing primitive)
    │                   ├── fetches scenarios count on open
    │                   └── calls DELETE /api/admin/calculators/:id
```

### Data Model

No new database tables. Reads from existing `calculators` and `profiles`.

**New data access:**
- `fn_list_all_user_calculators` — SECURITY DEFINER RPC. Cross-reads all
  active (non-soft-deleted) calculators owned by users other than the caller,
  joined to `profiles` for the owner's name. Gated to sysadmin callers via
  `is_sysadmin(auth.uid())`. Returns: calculator fields (id, title,
  description, theme_id, updated_at, published, public_token) + owner_id
  + owner_name. Ordered `updated_at DESC`, capped at 200 rows.
- `DELETE /api/admin/calculators/:id` — sysadmin hard-delete endpoint.
  Permanently deletes a calculator and cascades to all children (sections,
  cells, charts, text blocks via existing FK ON DELETE CASCADE). Hard-deletes
  linked scenarios first (not SET NULL). Rejects non-sysadmin callers (403),
  unauthenticated requests (401), missing calculators (404), and
  own-calculator deletion (403).

**Existing data unchanged:**
- Calculator rows — no new columns.
- Scenarios — hard-deleted by moderation (differs from PROJ-13's SET NULL).
- `cloned_from_id` FK remains `ON DELETE SET NULL` — clones survive.

### Tech Decisions

1. **SECURITY DEFINER RPC** (same pattern as `fn_list_presets`) — RLS on
   calculators is owner-scoped. A DEFINER function centralises the
   cross-owner read in one auditable place rather than relaxing the policy.
2. **Separate `/api/admin/calculators/:id`** — the existing DELETE route
   handles soft-delete + hard-delete-from-trash with different semantics.
   A dedicated route keeps each path clear and independently auditable.
3. **New `ModerationCalcCard`** — card interaction differs from both
   `CalcCard` and `TrashCalcCard`: shows owner name, single kebab action,
   no edit/rename/duplicate affordances. A dedicated component avoids
   branching inside CalcCard.
4. **New `ModerationDeleteSheet`** — different copy, different API call,
   no `updated_at` concurrency check. Wraps the existing
   `DestructiveConfirmSheet` primitive.
5. **Server-side role gate + client-side cosmetic gate** — real
   authorization lives in the RPC function and the API route. Dashboard
   conditional rendering is cosmetic only.

### Dependencies

No new packages. Builds on existing infrastructure: `Section`
(tint="danger"), `DestructiveConfirmSheet`, `DropdownMenu` (shadcn),
`Icons`, `Pill`, `sonner`, `zod`, `createAdminClient`.

### New Files

| Layer | What | Where |
|-------|------|-------|
| Migration | `fn_list_all_user_calculators` RPC | `supabase/migrations/` |
| Server lib | `listAllUserCalculators()` | `src/lib/calculators/server.ts` |
| Client lib | `adminDeleteCalculator()` + `getAdminScenariosCount()` | `src/lib/calculators/client.ts` |
| API route | `DELETE /api/admin/calculators/:id` | `src/app/api/admin/calculators/[id]/route.ts` |
| API route | `GET /api/admin/calculators/:id/scenarios-count` | `src/app/api/admin/calculators/[id]/scenarios-count/route.ts` |
| Component | `ModerationCalcCard` | `src/components/dashboard/moderation-calc-card.tsx` |
| Component | `ModerationDeleteSheet` | `src/components/dashboard/moderation-delete-sheet.tsx` |
| Component | `UserCalculatorsSection` | `src/components/dashboard/user-calculators-section.tsx` |

### Touched Files (modifications only)

| File | Change |
|------|--------|
| `src/app/(app)/dashboard/page.tsx` | Conditional `listAllUserCalculators()` fetch for sysadmins; render `UserCalculatorsSection` in slot 5 |
| `src/components/dashboard/index.ts` | Export `UserCalculatorsSection` |
| `src/lib/calculators/client.ts` | Add `adminDeleteCalculator()` + `getAdminScenariosCount()` |
| `src/lib/calculators/server.ts` | Add `listAllUserCalculators()` + `ModerationCalculatorRow` type |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
