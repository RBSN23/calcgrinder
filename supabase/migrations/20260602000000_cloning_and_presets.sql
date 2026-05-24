-- PROJ-18: Cloning & Preset Discoverability
--
-- Three atomic pieces, one migration:
--   1. ALTER calculators ADD source_calculator_id (nullable self-FK,
--      ON DELETE SET NULL) — attribution column for cross-user clones.
--      Same-owner duplicates leave it NULL; only the cross-user branch
--      sets it.
--   2. CREATE OR REPLACE fn_duplicate_calculator(source_id, source_token)
--      — switches the function to SECURITY DEFINER and adds the optional
--      `source_token` second parameter. With source_token NULL the
--      caller gets the same-owner duplicate path (verbatim semantics
--      vs. the previous body, but now under the unified " — Copy" suffix
--      convention). With source_token non-NULL the caller gets the
--      cross-user clone path: token-gated read (bypasses RLS), Sysadmin-
--      Preset carve-out for the title rule, attribution column set.
--      The unified suffix supersedes PROJ-10's "Copy of <X>" prefix.
--   3. CREATE fn_list_presets() — read RPC for the dashboard's Presets
--      section. SECURITY DEFINER, returns sysadmin-owned + published +
--      non-deleted calculators (joined to profiles for owner_name),
--      `updated_at DESC LIMIT 100`. Centralises the visibility rule in
--      one function rather than relaxing owner-only RLS.
--
-- See features/PROJ-18-cloning-and-preset-discoverability.md (Tech
-- Design + Decision Log) for the architectural rationale.
--
-- MAINTENANCE CONTRACT (inherits + extends 20260601010000):
--   The cell / chart / text_block INSERT/SELECT enumeration inside
--   fn_duplicate_calculator must stay in sync with every column added
--   to those three child tables. The full enumeration is reproduced
--   here verbatim from the previous body; future column additions must
--   land in this function as well.

-- =========================================================================
-- 1. Schema extension: source_calculator_id
-- =========================================================================

ALTER TABLE public.calculators
  ADD COLUMN source_calculator_id UUID
    REFERENCES public.calculators(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.calculators.source_calculator_id IS
  'PROJ-18. Cross-user clone attribution. Set to source.id when a row is created via the cross-user clone path (fn_duplicate_calculator with non-NULL source_token); NULL for rows created via /api/calculators, same-owner duplicate, or migration backfill. ON DELETE SET NULL: a hard-deleted source does not take its clones down. PATCH /api/calculators/:id is allowlist-shaped (Zod schema enumerates writable fields) so this column is server-controlled — set only via the cross-user clone branch of fn_duplicate_calculator.';

-- =========================================================================
-- 2. fn_duplicate_calculator(source_id, source_token) — extended in place
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_duplicate_calculator(
  source_id     UUID,
  source_token  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  title                 TEXT,
  description           TEXT,
  theme_id              TEXT,
  updated_at            TIMESTAMPTZ,
  published             BOOLEAN,
  public_token          TEXT,
  default_section_id    UUID,
  source_calculator_id  UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id           UUID := auth.uid();
  src                 public.calculators%ROWTYPE;
  is_cross_user       BOOLEAN;
  is_preset           BOOLEAN;
  new_calc_id         UUID;
  attribution_id      UUID;
  new_title           TEXT;
  base_title          TEXT;
  attempt             INT;
  default_section     UUID;
  has_sections        BOOLEAN;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Branch discriminator. `source_token IS NULL` (or empty after the
  -- route layer's Zod parse — empty strings are normalised away there)
  -- means the legacy same-owner duplicate path. A non-NULL token means
  -- the cross-user clone path.
  is_cross_user := source_token IS NOT NULL;

  IF is_cross_user THEN
    -- Cross-user clone: token-gated read. SECURITY DEFINER bypasses RLS;
    -- the (id, public_token) pair is the unforgeable handle — same trust
    -- model as PROJ-11's /c/<token> visitor route. Soft-deleted sources
    -- ARE clonable (reachable via scenario URLs); hard-deleted sources
    -- are not (row gone → P0002 → 404).
    SELECT * INTO src
      FROM public.calculators
     WHERE public.calculators.id = source_id
       AND public.calculators.public_token = source_token;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    -- Sysadmin Preset carve-out: source.owner has role='sysadmin' (and
    -- approved) AND source.published = TRUE → no " — Copy" suffix on
    -- the clone's title. Presets are intentional starting points; the
    -- suffix would read as "I haven't customised this yet" and add
    -- noise to a clean Mortgage Calculator title.
    SELECT EXISTS (
      SELECT 1
        FROM public.profiles p
       WHERE p.id = src.owner_id
         AND p.role = 'sysadmin'
         AND p.status = 'approved'
    ) AND src.published INTO is_preset;

    attribution_id := src.id;
  ELSE
    -- Same-owner duplicate: explicit owner_id check (we no longer rely
    -- on RLS because the function is now SECURITY DEFINER). Soft-deleted
    -- sources are NOT clonable via this path (the dashboard kebab cannot
    -- reach Trashed rows; if you want to clone from Trash, use the
    -- cross-user path via a scenario URL).
    SELECT * INTO src
      FROM public.calculators
     WHERE public.calculators.id = source_id
       AND public.calculators.owner_id = caller_id
       AND public.calculators.soft_delete_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    is_preset := FALSE;
    attribution_id := NULL;
  END IF;

  -- Title-resolve helper (shared across both branches).
  --   * is_preset       → base = src.title (Preset; no suffix)
  --   * everything else → base = src.title || ' — Copy'
  -- Then walk `<base>`, `<base> (2)`, … until the first free
  -- (owner_id, title) slot in the caller's active set. Capped at 100
  -- attempts (sanity bound — realistic users rename their clones long
  -- before this).
  IF is_preset THEN
    base_title := src.title;
  ELSE
    base_title := src.title || ' — Copy';
  END IF;

  -- Defensive trim: keep base_title under 96 chars to leave headroom for
  -- the collision suffix " (N)". The em-dash in " — Copy" is a single
  -- codepoint under length() so the 7-char suffix counts as 7 chars.
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
  -- DEFAULT (PROJ-10 gen_calculator_public_token); published explicitly
  -- resets to FALSE per the spec (a clone is always a fresh Draft, even
  -- if the source was published); source_calculator_id is set only on
  -- the cross-user branch.
  INSERT INTO public.calculators (
    owner_id, title, description, theme_id, published, source_calculator_id
  )
  VALUES (
    caller_id, new_title, src.description, src.theme_id, FALSE, attribution_id
  )
  RETURNING public.calculators.id INTO new_calc_id;

  -- Deep-copy sections preserving display_order.
  INSERT INTO public.sections (
    calculator_id, title, description, layout_pattern_id, display_order
  )
  SELECT new_calc_id, s.title, s.description, s.layout_pattern_id, s.display_order
    FROM public.sections s
   WHERE s.calculator_id = source_id
   ORDER BY s.display_order;

  -- Defensive: if the source had zero sections (legacy pre-PROJ-9 row),
  -- synthesize the default "Section 1" so the editor loader doesn't
  -- need to backfill on first open.
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

  -- Deep-copy cells. Source section_id → new section_id via the
  -- (calculator_id, display_order) join; UNIQUE per calculator. Cell
  -- `name` (formula identifier) is preserved as-is — unique per
  -- calculator, so duplicating across calculator_ids carries no
  -- collision risk. `tabular_columns` (PROJ-17) is included per the
  -- BUG-H2 maintenance contract; see the migration header.
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

  -- Deep-copy charts (PROJ-15). `bindings` JSONB carries cell UUID
  -- references that point at the SOURCE calculator's cells — this is
  -- pre-existing PROJ-15 debt (the duplicate path doesn't rewrite
  -- bindings; the renderer's stale-cell handling surfaces the issue
  -- on the duplicate's first edit). Logged in PROJ-15 regression notes.
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

  -- Deep-copy text_blocks (PROJ-16). No `name` column (PROJ-16 excluded
  -- text blocks from the formula identifier grid).
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

  -- Resolve default_section_id = first section by display_order on the
  -- clone.
  SELECT s.id INTO default_section
    FROM public.sections s
   WHERE s.calculator_id = new_calc_id
   ORDER BY s.display_order
   LIMIT 1;

  -- Return the public row shape + default_section_id + source_calculator_id.
  RETURN QUERY
    SELECT c.id, c.title, c.description, c.theme_id, c.updated_at,
           c.published, c.public_token, default_section, c.source_calculator_id
      FROM public.calculators c
     WHERE c.id = new_calc_id;
END;
$$;

COMMENT ON FUNCTION public.fn_duplicate_calculator(UUID, TEXT) IS
  'PROJ-18. Deep-copies a calculator (row + sections + cells incl. tabular_columns + charts + text_blocks) under the calling user. With source_token NULL → same-owner duplicate (RLS-equivalent via explicit owner_id = auth.uid() filter). With source_token non-NULL → cross-user clone (token-gated read; Sysadmin-Preset titles preserved verbatim, all other sources get the unified " — Copy" suffix; source_calculator_id records the source). SECURITY DEFINER + explicit auth.uid() check; cross-owner duplicates are surfaced as not_found (P0002) by the same-owner branch and by the cross-user branch when the (id, public_token) pair does not match. Returns the new row + default_section_id + source_calculator_id in one round-trip. MAINTENANCE: every column added to public.cells / public.charts / public.text_blocks MUST also be enumerated in this function''s INSERT/SELECTs — see the migration header.';

-- Drop the obsolete single-arg overload so callers cannot accidentally
-- bypass the new SECURITY DEFINER body. PostgREST resolves rpc() calls
-- by argument names; with the new function in place, supabase.rpc(
-- 'fn_duplicate_calculator', { source_id }) and supabase.rpc(...,
-- { source_id, source_token }) both resolve to the new two-arg function
-- thanks to the DEFAULT NULL.
DROP FUNCTION IF EXISTS public.fn_duplicate_calculator(UUID);

-- Tighten grants. SECURITY DEFINER functions run with the function-
-- owner's privileges; restrict who can CALL.
REVOKE EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID, TEXT) TO service_role;

-- =========================================================================
-- 3. fn_list_presets() — Presets read RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_list_presets()
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  description   TEXT,
  theme_id      TEXT,
  updated_at    TIMESTAMPTZ,
  published     BOOLEAN,
  public_token  TEXT,
  owner_id      UUID,
  owner_name    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      c.id,
      c.title,
      c.description,
      c.theme_id,
      c.updated_at,
      c.published,
      c.public_token,
      c.owner_id,
      p.name AS owner_name
    FROM public.calculators c
    JOIN public.profiles p ON p.id = c.owner_id
   WHERE p.role = 'sysadmin'
     AND p.status = 'approved'
     AND c.published = TRUE
     AND c.soft_delete_at IS NULL
   ORDER BY c.updated_at DESC
   LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.fn_list_presets() IS
  'PROJ-18. Read RPC for the dashboard''s Presets section. Returns sysadmin-owned + published + non-soft-deleted calculators joined to profiles for owner_name (forward-compat with the deferred attribution display). SECURITY DEFINER bypasses owner-only RLS on calculators (centralises the cross-user visibility rule in one function rather than relaxing the policy); explicit auth.uid() check at entry. Ordered updated_at DESC, capped at 100 rows. owner_name is included for the deferred attribution display banner — PROJ-18''s UI ignores it.';

REVOKE EXECUTE ON FUNCTION public.fn_list_presets() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_list_presets() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_presets() TO service_role;
