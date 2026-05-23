-- PROJ-10 BUG-C1 follow-up: fix 42702 "column reference 'title' is ambiguous"
-- in fn_duplicate_calculator.
--
-- Root cause: the original migration's WHILE EXISTS title-resolve loop
-- referenced an unqualified `title` in the WHERE clause. Because the
-- function's RETURNS TABLE declaration includes a column also named
-- `title`, PL/pgSQL cannot resolve the reference and raises 42702 at
-- runtime — every same-owner duplicate call returned 500.
--
-- Fix: qualify the column as `public.calculators.title` in the loop's
-- WHERE clause so PL/pgSQL binds it to the underlying table column,
-- not the RETURNS TABLE output column. The rest of the function body
-- is unchanged from 20260525000000_calculator_lifecycle.sql.

CREATE OR REPLACE FUNCTION public.fn_duplicate_calculator(
  source_id UUID
)
RETURNS TABLE (
  id                  UUID,
  title               TEXT,
  description         TEXT,
  theme_id            TEXT,
  updated_at          TIMESTAMPTZ,
  published           BOOLEAN,
  public_token        TEXT,
  default_section_id  UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id           UUID := auth.uid();
  src                 public.calculators%ROWTYPE;
  new_calc_id         UUID;
  new_title           TEXT;
  base_title          TEXT;
  attempt             INT;
  candidate_title     TEXT;
  default_section     UUID;
  has_sections        BOOLEAN;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Load the source row (RLS scopes by owner; cross-owner reads return
  -- zero rows, which we surface as 'not_found' so the API layer can map
  -- to a 404 — opacity rule).
  SELECT * INTO src
    FROM public.calculators
   WHERE public.calculators.id = source_id
     AND soft_delete_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Auto-resolve the duplicate's title. "Copy of <X>", then "Copy of <X> (2)", …
  base_title := 'Copy of ' || src.title;
  -- Defensive trim to the column's max-100 constraint. The suffix can push
  -- past 100 even from a 92-char base; truncate the base to leave room.
  IF length(base_title) > 96 THEN
    base_title := left(base_title, 96);
  END IF;
  new_title := base_title;
  attempt := 2;
  WHILE EXISTS (
    SELECT 1 FROM public.calculators
     WHERE owner_id = caller_id
       AND public.calculators.title = new_title
       AND soft_delete_at IS NULL
  ) LOOP
    new_title := base_title || ' (' || attempt || ')';
    attempt := attempt + 1;
    IF attempt > 100 THEN
      RAISE EXCEPTION 'title auto-resolve exhausted' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  -- Insert the new calculator row. public_token defaults via the column
  -- DEFAULT; published explicitly resets to FALSE per the spec.
  INSERT INTO public.calculators (
    owner_id, title, description, theme_id, published
  )
  VALUES (
    caller_id, new_title, src.description, src.theme_id, FALSE
  )
  RETURNING public.calculators.id INTO new_calc_id;

  -- Deep-copy sections preserving display_order. The DEFERRABLE
  -- (calculator_id, display_order) UNIQUE constraint on sections is fine
  -- for a single batch insert (no in-statement swap).
  INSERT INTO public.sections (
    calculator_id, title, description, layout_pattern_id, display_order
  )
  SELECT new_calc_id, s.title, s.description, s.layout_pattern_id, s.display_order
    FROM public.sections s
   WHERE s.calculator_id = source_id
   ORDER BY s.display_order;

  -- Defensive: if the source had zero sections (legacy pre-PROJ-9 row
  -- that escaped the backfill), synthesize the default "Section 1" so
  -- the editor loader doesn't have to backfill on first open.
  SELECT EXISTS (
    SELECT 1 FROM public.sections WHERE calculator_id = new_calc_id
  ) INTO has_sections;
  IF NOT has_sections THEN
    INSERT INTO public.sections (
      calculator_id, title, description, layout_pattern_id, display_order
    ) VALUES (
      new_calc_id, 'Section 1', '', 'single_column', 0
    );
  END IF;

  -- Deep-copy cells. Map source section_id -> new section_id via a join on
  -- (calculator_id, display_order) which is unique per calculator. Cell
  -- `name` (the formula identifier) is preserved as-is — it is unique
  -- per calculator, not per owner, so duplicating across calculator_ids
  -- carries no collision risk.
  INSERT INTO public.cells (
    calculator_id, section_id, kind, name, label, description, description_render,
    value_type, visibility, editability, default_value, formula,
    display_widget, display_format, display_emphasis, unit,
    numeric_min, numeric_max, numeric_step, select_options, currency_code,
    card_accent, card_background_tint, card_border, card_size_hint,
    text_size, text_colour, display_order
  )
  SELECT
    new_calc_id, new_s.id, c.kind, c.name, c.label, c.description, c.description_render,
    c.value_type, c.visibility, c.editability, c.default_value, c.formula,
    c.display_widget, c.display_format, c.display_emphasis, c.unit,
    c.numeric_min, c.numeric_max, c.numeric_step, c.select_options, c.currency_code,
    c.card_accent, c.card_background_tint, c.card_border, c.card_size_hint,
    c.text_size, c.text_colour, c.display_order
    FROM public.cells c
    JOIN public.sections src_s
      ON src_s.id = c.section_id
    JOIN public.sections new_s
      ON new_s.calculator_id = new_calc_id
     AND new_s.display_order = src_s.display_order
   WHERE c.calculator_id = source_id;

  -- Resolve the default_section_id = first section by display_order.
  SELECT s.id INTO default_section
    FROM public.sections s
   WHERE s.calculator_id = new_calc_id
   ORDER BY s.display_order
   LIMIT 1;

  -- Return the public row shape + default_section_id.
  RETURN QUERY
    SELECT c.id, c.title, c.description, c.theme_id, c.updated_at,
           c.published, c.public_token, default_section
      FROM public.calculators c
     WHERE c.id = new_calc_id;
END;
$$;

COMMENT ON FUNCTION public.fn_duplicate_calculator(UUID) IS
  'PROJ-10. Deep-copies a calculator (row + sections + cells) under the calling user, with a fresh public_token, published=false, and an auto-resolved "Copy of <X>" title. SECURITY INVOKER + RLS-scoped: cross-owner duplicate raises not_found. Returns the new row plus its default_section_id in one round-trip.';

GRANT EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID) TO service_role;
