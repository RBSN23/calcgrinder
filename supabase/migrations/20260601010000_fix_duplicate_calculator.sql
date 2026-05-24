-- PROJ-17 BUG-H2 follow-up: `fn_duplicate_calculator` deep-copy was
-- silently dropping three sets of fields:
--   (1) `cells.tabular_columns` — added in PROJ-17 but not enumerated
--       in the duplicate's cell INSERT/SELECT column list. Duplicating
--       a calc with tabular Output cells lost every column label,
--       format, alignment, currency override, visibility, and reorder.
--   (2) `charts.*` — the entire charts table is absent from the
--       duplicate. Pre-existing PROJ-15 debt that the BUG-H2 QA pass
--       surfaced (PROJ-15 shipped without updating this function;
--       duplicating a calc with charts loses every chart row).
--   (3) `text_blocks.*` — same shape as (2). PROJ-16 shipped without
--       updating this function; duplicating a calc with text blocks
--       loses every text-block row.
--
-- This migration replaces `fn_duplicate_calculator` with one body that
-- enumerates every column on the three child tables (cells, charts,
-- text_blocks) as they stand at HEAD. The function continues to map
-- source → destination sections by (calculator_id, display_order) —
-- the same join the existing cell copy uses, now extended to charts
-- and text_blocks.
--
-- MAINTENANCE CONTRACT (read this before editing any of the three
-- child-table schemas):
--   * `public.cells` — every column added by a future migration MUST
--     also be added to the cell INSERT/SELECT enumeration below.
--     `tabular_columns` is the most recent example — adding it
--     elsewhere (DB column + read-RPCs + write APIs) without touching
--     this function silently breaks duplicate. Same applies to any
--     new column on `public.charts` and `public.text_blocks`.
--   * The pattern PROJ-17 used for its read-RPCs (AV-2: explicit
--     cell-column enumeration in `fn_get_public_calculator` and
--     `fn_get_scenario_by_share_token`) extends to this write-RPC:
--     cell-column enumeration lives in three SECURITY DEFINER /
--     SECURITY INVOKER functions, not just the two read paths.
--     Future features touching the cells/charts/text_blocks schema
--     should treat all three RPCs as a single audit surface.
--   * Owner gating (`auth.uid()`), RLS scoping, the "Copy of <X>"
--     title resolver, and the `default_section_id` return shape are
--     preserved verbatim from `20260525010000_…sql`. Only the body
--     additions (tabular_columns enumeration + charts copy + text_blocks
--     copy) are new in this migration.

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
  --
  -- `tabular_columns` (PROJ-17) is the most recent addition; see the
  -- maintenance contract in the header.
  INSERT INTO public.cells (
    calculator_id, section_id, kind, name, label, description, description_render,
    value_type, visibility, editability, default_value, formula,
    display_widget, display_format, display_emphasis, unit,
    numeric_min, numeric_max, numeric_step, select_options, currency_code,
    card_accent, card_background_tint, card_border, card_size_hint,
    text_size, text_colour, tabular_columns, display_order
  )
  SELECT
    new_calc_id, new_s.id, c.kind, c.name, c.label, c.description, c.description_render,
    c.value_type, c.visibility, c.editability, c.default_value, c.formula,
    c.display_widget, c.display_format, c.display_emphasis, c.unit,
    c.numeric_min, c.numeric_max, c.numeric_step, c.select_options, c.currency_code,
    c.card_accent, c.card_background_tint, c.card_border, c.card_size_hint,
    c.text_size, c.text_colour, c.tabular_columns, c.display_order
    FROM public.cells c
    JOIN public.sections src_s
      ON src_s.id = c.section_id
    JOIN public.sections new_s
      ON new_s.calculator_id = new_calc_id
     AND new_s.display_order = src_s.display_order
   WHERE c.calculator_id = source_id;

  -- Deep-copy charts (PROJ-15). Same section-map join as cells. Chart
  -- `name` (calculator-scoped UNIQUE) is preserved verbatim — the new
  -- calculator_id keeps the key unique. `bindings` JSONB carries cell
  -- UUID references; the cell deep-copy above does NOT preserve cell
  -- UUIDs (they're freshly generated by the INSERT), so chart bindings
  -- on the duplicate point at the SOURCE calculator's cells.
  --
  -- That cross-calculator binding is a pre-existing PROJ-15 behaviour
  -- (the previous version of this function dropped charts entirely, so
  -- the question never came up). Fixing the binding-rewrite is a
  -- separate piece of work — out of scope for BUG-H2, which only
  -- restores the data that's been silently dropped. Adding the chart
  -- copy at least makes the duplicate visually carry its chart cards;
  -- broken-binding UX (the existing renderer behaviour for stale
  -- cell_ids) surfaces the issue to the maintainer at the duplicate's
  -- first edit, who can re-bind from the chart configurator. Logged in
  -- the PROJ-15 spec's regression notes as a follow-up.
  INSERT INTO public.charts (
    calculator_id, section_id, name, chart_type, title, subtitle,
    bindings, style, card_accent, card_background_tint, card_border,
    card_size_hint, display_order
  )
  SELECT
    new_calc_id, new_s.id, ch.name, ch.chart_type, ch.title, ch.subtitle,
    ch.bindings, ch.style, ch.card_accent, ch.card_background_tint, ch.card_border,
    ch.card_size_hint, ch.display_order
    FROM public.charts ch
    JOIN public.sections src_s
      ON src_s.id = ch.section_id
    JOIN public.sections new_s
      ON new_s.calculator_id = new_calc_id
     AND new_s.display_order = src_s.display_order
   WHERE ch.calculator_id = source_id;

  -- Deep-copy text_blocks (PROJ-16). Same section-map join. No `name`
  -- column on this table (PROJ-16 deliberately excluded it — text
  -- blocks are Builder-only and never referenced by formulas).
  INSERT INTO public.text_blocks (
    calculator_id, section_id, body, card_accent, card_background_tint,
    card_border, card_size_hint, text_size, text_colour, display_order
  )
  SELECT
    new_calc_id, new_s.id, tb.body, tb.card_accent, tb.card_background_tint,
    tb.card_border, tb.card_size_hint, tb.text_size, tb.text_colour, tb.display_order
    FROM public.text_blocks tb
    JOIN public.sections src_s
      ON src_s.id = tb.section_id
    JOIN public.sections new_s
      ON new_s.calculator_id = new_calc_id
     AND new_s.display_order = src_s.display_order
   WHERE tb.calculator_id = source_id;

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
  'PROJ-10 + PROJ-15 + PROJ-16 + PROJ-17. Deep-copies a calculator (row + sections + cells incl. tabular_columns + charts + text_blocks) under the calling user, with a fresh public_token, published=false, and an auto-resolved "Copy of <X>" title. SECURITY INVOKER + RLS-scoped: cross-owner duplicate raises not_found. Returns the new row plus its default_section_id in one round-trip. MAINTENANCE: every column added to public.cells / public.charts / public.text_blocks MUST also be enumerated in this function''s INSERT/SELECTs — see the migration header for the contract.';

GRANT EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID) TO service_role;
