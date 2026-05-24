-- PROJ-15: Charts — visitor RPC extension.
--
-- Extends public.fn_get_public_calculator(p_token) so the JSONB `sections`
-- payload carries each section's charts alongside its cells. PROJ-11's
-- original RPC (20260526000000_public_calculator_rpc.sql) shipped before
-- PROJ-15 existed; QA caught the missing wire-through in the BUG-C1
-- fix-cycle on 2026-05-24.
--
-- Caller semantics unchanged — return shape unchanged at the top level
-- (same column set), only the inner `sections` JSONB elements gain a
-- `charts: jsonb` array, defaulting to `[]` for sections with no charts.
-- Existing PROJ-11 visitor consumers that ignore the new key continue to
-- work; PROJ-15's visitor adapter (visitor-calculator-state-adapter.tsx)
-- consumes it to render charts on the public surface.
--
-- Why CREATE OR REPLACE rather than ALTER:
--   Postgres SQL functions are immutable in shape — the return TABLE
--   columns are the same (sections is JSONB), only the inner JSON
--   composition changes. CREATE OR REPLACE drops in cleanly.
--
-- Why charts are nested under sections, not a top-level array:
--   Charts and cells share the section-scoped display_order positioning,
--   so the natural shape mirrors the editor bundle: each section owns
--   its display elements. The visitor adapter then flattens them into
--   the CalculatorStateProvider's section + chart slices.
--
-- See features/PROJ-15-charts.md (QA Test Results §BUG-C1).

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
              ) AS charts
            FROM public.sections s
            WHERE s.calculator_id = c.id
          ) AS section_row
      ),
      '[]'::jsonb
    ) AS sections
  FROM public.calculators c
  WHERE c.public_token = p_token;
$$;

COMMENT ON FUNCTION public.fn_get_public_calculator(TEXT) IS
  'PROJ-11 (extended by PROJ-15). SECURITY DEFINER read path for the anonymous /c/<token> visitor route. Returns the calculator row + a JSONB array of sections; each section carries `cells` and `charts` arrays already ordered by display_order. Returns 0 rows on no token-match (caller → 404). Returns the row even when soft_delete_at IS NOT NULL (caller → 410). published is NOT a gate.';

-- Re-grant EXECUTE so the new function body inherits the same access shape
-- as the original. (CREATE OR REPLACE preserves grants in practice, but
-- being explicit keeps the migration audit-trail clear.)
REVOKE EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO service_role;
