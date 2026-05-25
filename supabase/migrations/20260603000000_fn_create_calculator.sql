-- PROJ-25: fn_create_calculator
--
-- Collapses the 5-round-trip "create calculator" workflow into a single
-- database call. Previously the POST /api/calculators handler made
-- sequential Supabase calls for: title uniqueness check, profile theme
-- lookup, calculator INSERT, default section INSERT, and updated_at
-- re-read. This function performs all five steps in one invocation.
--
-- The title-resolution loop follows the same pattern as
-- fn_duplicate_calculator: "Untitled calculator", then
-- "Untitled calculator (2)", "Untitled calculator (3)", etc., capped
-- at 100 attempts against the owner's active (non-soft-deleted)
-- calculators.
--
-- SECURITY INVOKER: RLS policies on public.calculators, public.sections,
-- and public.profiles apply normally. The caller must be authenticated.

CREATE OR REPLACE FUNCTION public.fn_create_calculator()
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
  new_calc_id         UUID;
  new_title           TEXT;
  base_title          TEXT := 'Untitled calculator';
  attempt             INT;
  resolved_theme      TEXT;
  default_section     UUID;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Resolve a unique title against the owner's active calculators.
  -- "Untitled calculator", "Untitled calculator (2)", …
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

  -- Read the user's preferred theme. If NULL or not set, fall back to
  -- the column DEFAULT ('calcgrinder') by passing NULL to COALESCE.
  SELECT p.default_calculator_theme INTO resolved_theme
    FROM public.profiles p
   WHERE p.id = caller_id;

  -- Insert the new calculator row. public_token uses the column DEFAULT
  -- (auto-generated). If the user has no theme preference, let the
  -- column DEFAULT ('calcgrinder') apply via COALESCE.
  INSERT INTO public.calculators (
    owner_id, title, description, theme_id, published
  )
  VALUES (
    caller_id, new_title, '', COALESCE(resolved_theme, 'calcgrinder'), FALSE
  )
  RETURNING public.calculators.id INTO new_calc_id;

  -- Insert the default section.
  INSERT INTO public.sections (
    calculator_id, title, description, layout_pattern_id, display_order
  )
  VALUES (
    new_calc_id, 'Section 1', '', 'single_column', 0
  )
  RETURNING public.sections.id INTO default_section;

  -- Return the calculator row (re-read to pick up the trigger-bumped
  -- updated_at from the section insert) plus the default section id.
  RETURN QUERY
    SELECT c.id, c.title, c.description, c.theme_id, c.updated_at,
           c.published, c.public_token, default_section
      FROM public.calculators c
     WHERE c.id = new_calc_id;
END;
$$;

COMMENT ON FUNCTION public.fn_create_calculator() IS
  'PROJ-25. Creates a new calculator for the calling user in a single round-trip: resolves a unique "Untitled calculator" title, reads the user''s default theme preference, inserts the calculator row and a default "Section 1", and returns the complete row plus default_section_id. SECURITY INVOKER + RLS-scoped.';

GRANT EXECUTE ON FUNCTION public.fn_create_calculator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_calculator() TO service_role;
