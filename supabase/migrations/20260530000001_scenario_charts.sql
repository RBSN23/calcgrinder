-- PROJ-15: Charts — scenario RPC extension.
--
-- Extends public.fn_get_scenario_by_share_token(p_share_token, p_calc_token)
-- so the calculator_payload's sections also carry their charts. The
-- companion fix to 20260530000000_public_calculator_charts.sql: that
-- migration wired charts into /c/<token>; this one wires them into the
-- scenario-link surface /c/<token>?s=<share_token>.
--
-- Per PROJ-15 spec edge case: "A scenario URL (PROJ-12) loads a calculator
-- with charts. The charts re-render with the scenario's input values."
--
-- Same shape note as the public calculator RPC: charts are nested under
-- each section (mirroring the editor bundle), defaulting to `[]` when
-- absent. Existing consumers that ignored the section payload's keys
-- continue to work; PROJ-15's scenarios fetcher reads the new key to
-- propagate charts to the visitor adapter.

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
                ) AS charts
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
  'PROJ-12 (extended by PROJ-15). SECURITY DEFINER read path for the anonymous /c/<token>?s=<share_token> visitor route. Single round-trip returning the scenario + parent calculator (sections, each with cells and charts) + owner name. Returns 0 rows on share_token miss, calc_token mismatch (cross-calc forge defence), orphan scenarios (calculator hard-deleted), or soft-deleted calculator.';

REVOKE EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO service_role;
