-- PROJ-10: Calculator Lifecycle — Publish, Sharing, Token Regen
-- Extends public.calculators with the lifecycle columns and constraints:
--   * published        — author's intent flag (read by PROJ-11's visitor
--                        route to decide render vs. "Not published" splash).
--   * public_token     — stable, rotatable URL slug at /c/<token>.
--                        Always present; SQL DEFAULT mints a 22-char
--                        URL-safe base64 string via pgcrypto so the
--                        create endpoint, the migration backfill, and the
--                        duplicate stored procedure can't drift in token
--                        format.
--   * (owner_id, title) partial unique index — titles unique per owner
--                        across the active (non-soft-deleted) set.
--                        Soft-deleted rows are excluded so a deleted
--                        "Mortgage" doesn't block a new "Mortgage".
-- The backfill mints tokens for every pre-existing row and dedupes any
-- pre-existing title collisions by suffixing ` (2)`, ` (3)`, … until
-- unique within the active set.
-- Also adds the duplicate stored procedure (fn_duplicate_calculator)
-- which deep-copies a calculator + sections + cells in one transaction.

-- =========================================================================
-- Defensive extension load (Supabase Cloud enables pgcrypto by default).
-- gen_random_bytes lives in pgcrypto.
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- Token-mint helper. Centralises the format so every caller (column
-- DEFAULT, migration backfill, duplicate stored procedure) produces the
-- same 22-char URL-safe base64 alphabet [A-Za-z0-9_-] from 16 random
-- bytes (~128 bits of entropy). Node's crypto.randomBytes(16)
-- .toString('base64url') in the regenerate-token route produces the
-- same shape.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.gen_calculator_public_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT translate(
           rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='),
           '+/',
           '-_'
         );
$$;

COMMENT ON FUNCTION public.gen_calculator_public_token() IS
  'PROJ-10. Mints a 22-char URL-safe base64 token (~128 bits of entropy) for calculators.public_token. Used as the column DEFAULT, by the migration backfill, and by fn_duplicate_calculator. Node-side regenerate-token uses crypto.randomBytes(16).toString(''base64url'') which produces the same shape.';

-- =========================================================================
-- 1. Add the lifecycle columns.
-- =========================================================================
ALTER TABLE public.calculators
  ADD COLUMN published BOOLEAN NOT NULL DEFAULT FALSE;

-- Add public_token nullable first so we can backfill existing rows
-- without violating the NOT NULL constraint, then tighten.
ALTER TABLE public.calculators
  ADD COLUMN public_token TEXT;

-- =========================================================================
-- 2. Backfill: mint a token for every pre-existing row, then dedupe
--    pre-existing (owner_id, title) collisions across the active set.
-- =========================================================================
UPDATE public.calculators
   SET public_token = public.gen_calculator_public_token()
 WHERE public_token IS NULL;

-- Defensive: if (vanishingly unlikely) two backfilled rows collided on the
-- random token, re-mint until unique. gen_random_bytes is cryptographically
-- random so collisions across a deployer-sized population (dozens-to-
-- hundreds of rows) have effectively zero probability, but the loop keeps
-- the migration deterministic.
DO $$
DECLARE
  dup_id UUID;
BEGIN
  LOOP
    SELECT id INTO dup_id
      FROM (
        SELECT id, public_token,
               ROW_NUMBER() OVER (PARTITION BY public_token ORDER BY id) AS rn
          FROM public.calculators
      ) t
     WHERE rn > 1
     LIMIT 1;
    EXIT WHEN dup_id IS NULL;
    UPDATE public.calculators
       SET public_token = public.gen_calculator_public_token()
     WHERE id = dup_id;
  END LOOP;
END $$;

-- Dedupe pre-existing (owner_id, title) collisions across the active set.
-- The second/third/… occurrence (ordered by created_at, id) gets
-- suffixed with ` (2)`, ` (3)`, … walking until the first free slot is
-- found within the active set. Capped at 100 attempts (mirrors the
-- application-side helper).
DO $$
DECLARE
  collision RECORD;
  candidate TEXT;
  base TEXT;
  attempt INT;
BEGIN
  FOR collision IN
    SELECT id, owner_id, title
      FROM (
        SELECT id, owner_id, title,
               ROW_NUMBER() OVER (
                 PARTITION BY owner_id, title
                 ORDER BY created_at, id
               ) AS rn
          FROM public.calculators
         WHERE soft_delete_at IS NULL
      ) t
     WHERE rn > 1
  LOOP
    base := collision.title;
    attempt := 2;
    LOOP
      candidate := base || ' (' || attempt || ')';
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.calculators
         WHERE owner_id = collision.owner_id
           AND title = candidate
           AND soft_delete_at IS NULL
      );
      attempt := attempt + 1;
      IF attempt > 100 THEN
        RAISE EXCEPTION 'PROJ-10 dedupe: exhausted 100 attempts resolving title collision for calculator %', collision.id;
      END IF;
    END LOOP;
    UPDATE public.calculators
       SET title = candidate
     WHERE id = collision.id;
  END LOOP;
END $$;

-- =========================================================================
-- 3. Tighten constraints now that every row has a value.
-- =========================================================================
ALTER TABLE public.calculators
  ALTER COLUMN public_token SET NOT NULL;

ALTER TABLE public.calculators
  ALTER COLUMN public_token SET DEFAULT public.gen_calculator_public_token();

ALTER TABLE public.calculators
  ADD CONSTRAINT calculators_public_token_key UNIQUE (public_token);

-- (owner_id, title) UNIQUE across the active set. Soft-deleted rows are
-- excluded — a deleted "Mortgage" doesn't block a new "Mortgage".
CREATE UNIQUE INDEX idx_calculators_owner_title_active
  ON public.calculators (owner_id, title)
  WHERE soft_delete_at IS NULL;

COMMENT ON COLUMN public.calculators.published IS
  'PROJ-10. Author''s intent to expose the calculator publicly. PROJ-11''s visitor route at /c/<token> reads this to decide between rendering the calculator or a "Not published" splash. The public_token URL is reachable regardless of this flag (so it is still copyable + previewable from the editor while a calculator is in Draft).';

COMMENT ON COLUMN public.calculators.public_token IS
  'PROJ-10. 22-char URL-safe base64 (alphabet [A-Za-z0-9_-], ~128 bits of entropy from pgcrypto.gen_random_bytes(16)). Stable per row until rotated via POST /api/calculators/:id/regenerate-token. The column DEFAULT mints one on every INSERT so create / duplicate / migration backfill cannot drift in format.';

-- =========================================================================
-- 4. fn_duplicate_calculator — deep-copy stored procedure
-- One round trip per duplicate call (regardless of section / cell count).
-- Runs inside a single transaction so partial-failure cleanup is
-- unnecessary. RLS is enforced inside the function (the function is
-- SECURITY INVOKER so the caller's auth.uid() must match the source's
-- owner_id; otherwise the initial SELECT returns 0 rows and the
-- function raises insufficient_privilege).
-- =========================================================================
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
       AND title = new_title
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

-- The function is invoked via supabase.rpc(...) from /api/calculators/:id/duplicate.
-- service_role gets EXECUTE for parity with the rest of the schema; authenticated
-- gets EXECUTE for the standard authenticated caller path.
GRANT EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_duplicate_calculator(UUID) TO service_role;
