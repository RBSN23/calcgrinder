-- PROJ-8: Editor — Grid + Builder Two-Panel Split
-- Adds the public.calculators table that the editor route at /editor/<id>
-- reads and the /api/calculators routes write. Owner-only access enforced
-- by Row-Level Security; optimistic concurrency via the updated_at trigger
-- (re-used from PROJ-1's set_updated_at helper).
--
-- Forward-compat columns deliberately NOT added in PROJ-8:
--   * published / public_token    → PROJ-10 (token-bearing public URLs)
--   * source_calculator_id        → PROJ-18 (cloning + preset attribution)
-- The soft_delete_at column IS added now so PROJ-13 can land its Trash
-- recovery flow without a second migration.

-- =========================================================================
-- calculators table
-- =========================================================================
CREATE TABLE public.calculators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL
                    REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Untitled calculator',
  description     TEXT NOT NULL DEFAULT '',
  theme_id        TEXT NOT NULL DEFAULT 'calcgrinder',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete_at  TIMESTAMPTZ,
  CONSTRAINT calculators_title_nonempty_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT calculators_title_length_check
    CHECK (length(trim(title)) <= 100)
);

COMMENT ON TABLE public.calculators IS
  'One row per calculator. owner_id scopes RLS; updated_at doubles as the optimistic-concurrency version (bumped by trg_calculators_set_updated_at on every UPDATE). soft_delete_at is read by PROJ-13/PROJ-19; PROJ-8 itself never writes it.';

-- =========================================================================
-- Indexes
-- =========================================================================
-- (owner_id, soft_delete_at) — PROJ-13's Trash list filters by both.
CREATE INDEX idx_calculators_owner_soft_delete
  ON public.calculators (owner_id, soft_delete_at);

-- (owner_id, updated_at DESC) — PROJ-10's dashboard "My Calculators"
-- list orders by most-recently-edited.
CREATE INDEX idx_calculators_owner_updated_at_desc
  ON public.calculators (owner_id, updated_at DESC);

-- =========================================================================
-- updated_at trigger (re-uses public.set_updated_at from PROJ-1)
-- =========================================================================
CREATE TRIGGER trg_calculators_set_updated_at
  BEFORE UPDATE ON public.calculators
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Row Level Security
-- =========================================================================
ALTER TABLE public.calculators ENABLE ROW LEVEL SECURITY;

-- SELECT: owner only. Cross-owner reads return zero rows; the API surfaces
-- 404 (never 403) so an attacker cannot enumerate IDs across owners.
CREATE POLICY calculators_select_own
  ON public.calculators
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- INSERT: a user can only create rows they own. Setting owner_id to a
-- different user's id is rejected by WITH CHECK.
CREATE POLICY calculators_insert_own
  ON public.calculators
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: owner only. A non-owner UPDATE matches 0 rows (silent RLS
-- rejection — never throws). The PATCH API uses this for opacity.
CREATE POLICY calculators_update_own
  ON public.calculators
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- No DELETE policy: hard deletes are admin-only paths in PROJ-13 /
-- PROJ-19. PROJ-8 has no hard-delete API.

-- =========================================================================
-- GRANTs
-- Authenticated users get row-level CRUD (scoped by RLS); service_role
-- bypasses RLS for the admin paths in PROJ-13 / PROJ-19.
-- =========================================================================
GRANT SELECT, INSERT, UPDATE ON public.calculators TO authenticated;
GRANT ALL                    ON public.calculators TO service_role;
