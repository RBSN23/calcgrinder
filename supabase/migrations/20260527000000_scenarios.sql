-- PROJ-12: Scenarios — Save, Load, Share
--
-- Adds public.scenarios — one row per saved scenario (a user-named,
-- user-described snapshot of a calculator's input values). Each scenario
-- is owned by the user who saved it (NOT the calculator's owner — a
-- visitor who saves a scenario for someone else's published calculator
-- owns that scenario row). Sharing is via a separate, unguessable
-- share_token that is lazy-minted on first Copy link.
--
-- Two read paths:
--   1. Owner reads (dashboard, Save sheet) — direct table SELECT scoped
--      by `owner_id = auth.uid()` via RLS.
--   2. Public visitor reads (`/c/<token>?s=<share_token>`) — through the
--      SECURITY DEFINER `fn_get_scenario_by_share_token(p_share_token,
--      p_calc_token)` RPC. The two-arg signature enforces the cross-calc
--      forge defence inside the function (returns 0 rows if the share
--      token's parent calculator's `public_token` doesn't match
--      `p_calc_token`). The function bypasses RLS for read but is itself
--      gated by the unguessable 22-char share_token (~128 bits entropy).
--
-- FK semantics (spec line 186–199):
--   * calculator_id ON DELETE SET NULL — hard-delete of the parent
--     calculator does NOT cascade-delete scenarios. PROJ-13's orphan-
--     management surface operates on these rows.
--   * owner_id     ON DELETE CASCADE — account deletion purges scenarios.
--
-- Indexes:
--   * (owner_id, updated_at DESC) — dashboard My Scenarios list and the
--     Save sheet's existing-list both order by most-recently-saved first.
--   * (share_token) partial WHERE share_token IS NOT NULL — RPC lookup.
--   * FK index on calculator_id (Postgres does not auto-create one).

-- =========================================================================
-- scenarios table
-- =========================================================================
CREATE TABLE public.scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculator_id   UUID
                    REFERENCES public.calculators(id) ON DELETE SET NULL,
  owner_id        UUID NOT NULL
                    REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  values          JSONB NOT NULL DEFAULT '{}'::jsonb,
  share_token     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scenarios_title_nonempty_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT scenarios_title_length_check
    CHECK (length(title) <= 200),
  CONSTRAINT scenarios_description_length_check
    CHECK (length(description) <= 2000),
  CONSTRAINT scenarios_values_is_object_check
    CHECK (jsonb_typeof(values) = 'object')
);

COMMENT ON TABLE public.scenarios IS
  'PROJ-12. One row per saved scenario. owner_id = the user who saved it (not necessarily the calculator owner). values is the full input snapshot keyed by cell name (per spec line 1017). share_token is lazy-minted on first Copy link and never rotates (per PRD non-goals: "Public scenario URL regeneration / revocation").';

COMMENT ON COLUMN public.scenarios.calculator_id IS
  'PROJ-12. FK to calculators.id with ON DELETE SET NULL — hard-delete of the parent calculator leaves orphan scenario rows for PROJ-13 to surface in the dashboard.';

COMMENT ON COLUMN public.scenarios.values IS
  'PROJ-12. Full input snapshot keyed by cell name (the user-meaningful identifier from PROJ-9, not the cell id). Rename / removal / type-change in the parent calculator skips affected keys at apply time (drift banner — see frontend).';

COMMENT ON COLUMN public.scenarios.share_token IS
  'PROJ-12. 22-char URL-safe base64 (~128 bits entropy). NULL until the owner presses Copy link on any surface; minted by /api/scenarios/[id]/share. UNIQUE when not null.';

-- =========================================================================
-- Indexes
-- =========================================================================
-- Dashboard My Scenarios + Save sheet existing-list both filter on
-- owner_id (via RLS) and order by updated_at DESC.
CREATE INDEX idx_scenarios_owner_updated_at_desc
  ON public.scenarios (owner_id, updated_at DESC);

-- Partial unique index serves both (a) the RPC lookup by share_token and
-- (b) the share_token uniqueness invariant (only enforced for non-null
-- values so unminted scenarios don't collide with each other).
CREATE UNIQUE INDEX idx_scenarios_share_token
  ON public.scenarios (share_token)
  WHERE share_token IS NOT NULL;

-- FK index — Postgres does not auto-create one. PROJ-13's calculator-side
-- joins (orphan-management surfaces) will read by calculator_id.
CREATE INDEX idx_scenarios_calculator_id
  ON public.scenarios (calculator_id);

-- =========================================================================
-- updated_at trigger (re-uses public.set_updated_at from PROJ-1)
-- =========================================================================
CREATE TRIGGER trg_scenarios_set_updated_at
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Row Level Security — owner-only on all four ops
-- =========================================================================
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

-- SELECT: owner only. Cross-owner reads return zero rows; the public
-- visitor path is the SECURITY DEFINER RPC, never the table.
CREATE POLICY scenarios_select_own
  ON public.scenarios
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- INSERT: a user can only create rows they own.
CREATE POLICY scenarios_insert_own
  ON public.scenarios
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: owner only.
CREATE POLICY scenarios_update_own
  ON public.scenarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE: owner only.
CREATE POLICY scenarios_delete_own
  ON public.scenarios
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- =========================================================================
-- GRANTs
-- Authenticated users get row-level CRUD (scoped by RLS); service_role
-- bypasses RLS for admin paths.
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;
GRANT ALL                            ON public.scenarios TO service_role;

-- =========================================================================
-- fn_get_scenario_by_share_token
--
-- Single round-trip for the public `/c/<token>?s=<share_token>` visitor
-- page. Returns the scenario row joined with the parent calculator's
-- full payload (same JSON shape as fn_get_public_calculator's `sections`
-- column) and the owner's display name.
--
-- Returns 0 rows when:
--   * share_token doesn't match any scenario, OR
--   * the calculator's current public_token doesn't match p_calc_token
--     (cross-calc URL forge defence — defence in depth alongside the
--     page-level check), OR
--   * the parent calculator is soft-deleted OR hard-deleted (orphan
--     scenario; calculator-level state takes precedence per spec line
--     1049).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_get_scenario_by_share_token(
  p_share_token TEXT,
  p_calc_token  TEXT
)
RETURNS TABLE (
  scenario_id           UUID,
  scenario_title        TEXT,
  scenario_description  TEXT,
  scenario_values       JSONB,
  scenario_owner_id     UUID,
  scenario_owner_name   TEXT,
  scenario_updated_at   TIMESTAMPTZ,
  calculator_payload    JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    s.id                                    AS scenario_id,
    s.title                                 AS scenario_title,
    s.description                           AS scenario_description,
    s.values                                AS scenario_values,
    s.owner_id                              AS scenario_owner_id,
    COALESCE(p.name, '')                    AS scenario_owner_name,
    s.updated_at                            AS scenario_updated_at,
    jsonb_build_object(
      'id',             c.id,
      'owner_id',       c.owner_id,
      'title',          c.title,
      'description',    c.description,
      'theme_id',       c.theme_id,
      'public_token',   c.public_token,
      'published',      c.published,
      'soft_delete_at', c.soft_delete_at,
      'updated_at',     c.updated_at,
      'sections',       COALESCE(
        (
          SELECT jsonb_agg(section_row ORDER BY section_row.display_order)
            FROM (
              SELECT
                sec.id,
                sec.title,
                sec.description,
                sec.layout_pattern_id,
                sec.display_order,
                COALESCE(
                  (
                    SELECT jsonb_agg(cell_row ORDER BY cell_row.display_order)
                      FROM (
                        SELECT
                          cl.id,
                          cl.kind,
                          cl.name,
                          cl.label,
                          cl.description,
                          cl.description_render,
                          cl.value_type,
                          cl.visibility,
                          cl.editability,
                          cl.default_value,
                          cl.formula,
                          cl.display_widget,
                          cl.display_format,
                          cl.display_emphasis,
                          cl.unit,
                          cl.numeric_min,
                          cl.numeric_max,
                          cl.numeric_step,
                          cl.select_options,
                          cl.currency_code,
                          cl.card_accent,
                          cl.card_background_tint,
                          cl.card_border,
                          cl.card_size_hint,
                          cl.text_size,
                          cl.text_colour,
                          cl.display_order
                        FROM public.cells cl
                        WHERE cl.section_id = sec.id
                      ) AS cell_row
                  ),
                  '[]'::jsonb
                ) AS cells
              FROM public.sections sec
              WHERE sec.calculator_id = c.id
            ) AS section_row
        ),
        '[]'::jsonb
      )
    )                                       AS calculator_payload
  FROM public.scenarios s
  JOIN public.calculators c
    ON c.id = s.calculator_id
   AND c.public_token = p_calc_token
   AND c.soft_delete_at IS NULL
  LEFT JOIN public.profiles p
    ON p.id = s.owner_id
  WHERE s.share_token = p_share_token;
$$;

COMMENT ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) IS
  'PROJ-12. SECURITY DEFINER read path for the anonymous /c/<token>?s=<share_token> visitor route. Single round-trip returning the scenario + parent calculator (sections + cells) + owner name. Returns 0 rows on share_token miss, calc_token mismatch (cross-calc forge defence), orphan scenarios (calculator hard-deleted), or soft-deleted calculator.';

REVOKE EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO service_role;
