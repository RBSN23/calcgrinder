-- PROJ-11: Visitor View — Calculator Interface
--
-- Adds public.fn_get_public_calculator(p_token TEXT) — the single read path
-- the anonymous /c/<token> visitor route uses to fetch a calculator's full
-- tree (calculator row + sections + cells) in one round trip.
--
-- Why SECURITY DEFINER:
--   RLS on calculators / sections / cells is owner-only and we do NOT want
--   to broaden it (a leaked anon key must not be able to enumerate
--   calculators). The 128-bit unguessable public_token IS the access
--   control. This function bypasses RLS for read but is itself gated by
--   the token-match — there is no enumerable surface.
--
-- Why one function (not three queries):
--   Visitor pages are link-shared and hit cold often. A single function
--   call composing calculator + sections-with-cells as JSON avoids client-
--   side fan-out and shaves an extra round trip.
--
-- Caller semantics:
--   - 0 rows  → token does not match any calculator → 404
--   - 1 row, soft_delete_at IS NULL    → 200 (render the calculator)
--   - 1 row, soft_delete_at IS NOT NULL → 410 (route handler short-circuits)
--   The `published` column is returned for completeness but is NOT a
--   gate — Draft calculators are reachable at their public token by
--   design (Preview from the editor).
--
-- See features/PROJ-11-visitor-view-calculator-interface.md (Tech Design).

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
              ) AS cells
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
  'PROJ-11. SECURITY DEFINER read path for the anonymous /c/<token> visitor route. Returns the calculator row + a JSONB array of sections (each with its cells) in one call. Returns 0 rows on no token-match (caller → 404). Returns the row even when soft_delete_at IS NOT NULL (caller → 410). published is NOT a gate — Draft calculators are reachable at their public token by design.';

-- Tighten grants. SECURITY DEFINER functions on Supabase carry the
-- function-owner's privileges; we restrict who can CALL it.
REVOKE EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO service_role;
