-- PROJ-16: Text Blocks — visitor RPC extension + bundled KI-1 fix.
--
-- This migration `CREATE OR REPLACE`s **both** public-surface RPCs and
-- carries two changes at once on each:
--
--   1. PROJ-16 — add `text_blocks` to the per-section JSONB payload (so
--      the visitor route /c/<token> and the scenario route
--      /c/<calc_token>/s/<share_token> both receive prose blocks).
--   2. KI-1 fix — restore the
--          JOIN public.profiles ... ON ... AND status = 'approved'
--      clause that PROJ-15's chart wire-through
--      (20260530000000_public_calculator_charts.sql + 20260530000001_scenario_charts.sql)
--      silently dropped from PROJ-14's owner-status gate
--      (20260528000000_settings_page.sql:239-243 and :354-356).
--
-- Why bundle: PROJ-16 already has to CREATE OR REPLACE both RPCs to add
-- the text_blocks payload — restoring the JOIN is a one-line addition
-- with zero incremental migration cost, and closes KI-1 (PROJ-14
-- regression-gate tests/PROJ-14-settings.spec.ts:593) on the same
-- migration boundary. See PROJ-16 Decision Log #14.
--
-- BUG-M1 PROJ-14 (visitor /c/<token> returning 404 instead of 410 when
-- the owner is pending_deletion): with the JOIN restored the RPC returns
-- zero rows for pending_deletion owners; the visitor route handler's
-- existing not-found / soft-delete branch then decides the status code.
-- Verified at QA time — no route-handler patch ships in this migration.
--
-- Caller semantics unchanged at the SQL surface. Existing visitor
-- consumers that ignore the new `text_blocks` key continue to work;
-- PROJ-16's visitor adapter reads it to render text blocks.

-- =========================================================================
-- 1. fn_get_public_calculator — adds text_blocks; restores owner JOIN.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_get_public_calculator(
  p_token TEXT
)
RETURNS TABLE (
  id              UUID,
  owner_id        UUID,
  title           TEXT,
  description     TEXT,
  theme_id        TEXT,
  public_token    TEXT,
  published       BOOLEAN,
  soft_delete_at  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  sections        JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    c.id,
    c.owner_id,
    c.title,
    c.description,
    c.theme_id,
    c.public_token,
    c.published,
    c.soft_delete_at,
    c.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(section_row ORDER BY section_row.display_order)
          FROM (
            SELECT
              s.id,
              s.title,
              s.description,
              s.layout_pattern_id,
              s.display_order,
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
                      WHERE cl.section_id = s.id
                    ) AS cell_row
                ),
                '[]'::jsonb
              ) AS cells,
              COALESCE(
                (
                  SELECT jsonb_agg(chart_row ORDER BY chart_row.display_order)
                    FROM (
                      SELECT
                        ch.id,
                        ch.name,
                        ch.chart_type,
                        ch.title,
                        ch.subtitle,
                        ch.bindings,
                        ch.style,
                        ch.card_accent,
                        ch.card_background_tint,
                        ch.card_border,
                        ch.card_size_hint,
                        ch.display_order
                      FROM public.charts ch
                      WHERE ch.section_id = s.id
                    ) AS chart_row
                ),
                '[]'::jsonb
              ) AS charts,
              COALESCE(
                (
                  SELECT jsonb_agg(text_block_row ORDER BY text_block_row.display_order)
                    FROM (
                      SELECT
                        tb.id,
                        tb.body,
                        tb.card_accent,
                        tb.card_background_tint,
                        tb.card_border,
                        tb.card_size_hint,
                        tb.text_size,
                        tb.text_colour,
                        tb.display_order
                      FROM public.text_blocks tb
                      WHERE tb.section_id = s.id
                    ) AS text_block_row
                ),
                '[]'::jsonb
              ) AS text_blocks
            FROM public.sections s
            WHERE s.calculator_id = c.id
          ) AS section_row
      ),
      '[]'::jsonb
    ) AS sections
  FROM public.calculators c
  JOIN public.profiles p
    ON p.id = c.owner_id
   AND p.status = 'approved'
  WHERE c.public_token = p_token;
$$;

COMMENT ON FUNCTION public.fn_get_public_calculator(TEXT) IS
  'PROJ-11 + PROJ-14 + PROJ-15 + PROJ-16. SECURITY DEFINER read path for the anonymous /c/<token> visitor route. Returns the calculator row + a JSONB array of sections; each section carries `cells`, `charts`, AND `text_blocks` arrays already ordered by display_order. Returns 0 rows on no token-match OR when the owner is not in status=''approved'' (pending/declined/pending_deletion); the caller maps to 404/410. Returns the row even when soft_delete_at IS NOT NULL (caller → 410). published is NOT a gate.';

REVOKE EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO service_role;

-- =========================================================================
-- 2. fn_get_scenario_by_share_token — adds text_blocks; restores owner JOIN.
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
                ) AS cells,
                COALESCE(
                  (
                    SELECT jsonb_agg(chart_row ORDER BY chart_row.display_order)
                      FROM (
                        SELECT
                          ch.id,
                          ch.name,
                          ch.chart_type,
                          ch.title,
                          ch.subtitle,
                          ch.bindings,
                          ch.style,
                          ch.card_accent,
                          ch.card_background_tint,
                          ch.card_border,
                          ch.card_size_hint,
                          ch.display_order
                        FROM public.charts ch
                        WHERE ch.section_id = sec.id
                      ) AS chart_row
                  ),
                  '[]'::jsonb
                ) AS charts,
                COALESCE(
                  (
                    SELECT jsonb_agg(text_block_row ORDER BY text_block_row.display_order)
                      FROM (
                        SELECT
                          tb.id,
                          tb.body,
                          tb.card_accent,
                          tb.card_background_tint,
                          tb.card_border,
                          tb.card_size_hint,
                          tb.text_size,
                          tb.text_colour,
                          tb.display_order
                        FROM public.text_blocks tb
                        WHERE tb.section_id = sec.id
                      ) AS text_block_row
                  ),
                  '[]'::jsonb
                ) AS text_blocks
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
  JOIN public.profiles owner_profile
    ON owner_profile.id = c.owner_id
   AND owner_profile.status = 'approved'
  LEFT JOIN public.profiles p
    ON p.id = s.owner_id
  WHERE s.share_token = p_share_token;
$$;

COMMENT ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) IS
  'PROJ-12 + PROJ-14 + PROJ-15 + PROJ-16. SECURITY DEFINER read path for the anonymous /c/<calc_token>/s/<share_token> visitor route. Single round-trip returning the scenario + parent calculator (sections, each with cells, charts, AND text_blocks) + scenario-owner display name. Returns 0 rows on share_token miss, calc_token mismatch (cross-calc forge defence), orphan scenarios, soft-deleted calculator, OR when the calculator-owner is not in status=''approved'' (pending/declined/pending_deletion).';

REVOKE EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO service_role;
