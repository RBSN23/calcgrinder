-- PROJ-9: Cell Authoring & Section Management
-- Adds the public.sections and public.cells tables that the editor route
-- at /editor/<id> reads and the /api/sections/* + /api/cells/* routes
-- write. Owner-only access enforced by Row-Level Security joining through
-- the parent calculators row; optimistic concurrency at the calculator
-- level via a trigger that bumps calculators.updated_at on every INSERT,
-- UPDATE, or DELETE against either table.
--
-- Forward-compat: display_emphasis carries 'tabular' from day one so
-- PROJ-17 can register the tabular renderer without a schema migration.
-- See features/PROJ-9-cell-authoring-and-section-management.md.

-- =========================================================================
-- sections table
-- =========================================================================
CREATE TABLE public.sections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculator_id       UUID NOT NULL
                        REFERENCES public.calculators(id) ON DELETE CASCADE,
  title               TEXT NOT NULL DEFAULT 'New section',
  description         TEXT NOT NULL DEFAULT '',
  layout_pattern_id   TEXT NOT NULL DEFAULT 'single_column',
  display_order       INT  NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sections_title_nonempty_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT sections_title_length_check
    CHECK (length(trim(title)) <= 100)
);

-- (calculator_id, display_order) UNIQUE — but DEFERRABLE so transactional
-- renumber can swap rows without colliding mid-statement.
ALTER TABLE public.sections
  ADD CONSTRAINT sections_calculator_display_order_key
  UNIQUE (calculator_id, display_order)
  DEFERRABLE INITIALLY DEFERRED;

COMMENT ON TABLE public.sections IS
  'PROJ-9. Per-calculator named layout containers. layout_pattern_id is a string id resolved per-render through the theme registry (themes publish layoutPatterns). Display order is gap-free per calculator, renumbered transactionally.';

-- =========================================================================
-- cells table
-- =========================================================================
CREATE TABLE public.cells (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculator_id           UUID NOT NULL
                            REFERENCES public.calculators(id) ON DELETE CASCADE,
  section_id              UUID NOT NULL
                            REFERENCES public.sections(id) ON DELETE CASCADE,
  kind                    TEXT NOT NULL
                            CHECK (kind IN ('input', 'output')),
  name                    TEXT NOT NULL,
  label                   TEXT NOT NULL DEFAULT 'New cell',
  description             TEXT NOT NULL DEFAULT '',
  description_render      TEXT NOT NULL DEFAULT 'caption'
                            CHECK (description_render IN ('caption', 'tooltip')),
  value_type              TEXT NOT NULL
                            CHECK (value_type IN (
                              'number', 'currency', 'percent',
                              'date', 'boolean', 'select', 'text'
                            )),
  visibility              TEXT NOT NULL DEFAULT 'visible'
                            CHECK (visibility IN ('visible', 'hidden')),
  editability             TEXT NOT NULL
                            CHECK (editability IN ('editable', 'readonly')),
  default_value           JSONB,
  formula                 TEXT,
  display_widget          TEXT,
  display_format          TEXT NOT NULL DEFAULT 'auto',
  display_emphasis        TEXT NOT NULL DEFAULT 'plain'
                            CHECK (display_emphasis IN ('plain', 'kpi', 'tabular')),
  unit                    TEXT,
  numeric_min             NUMERIC,
  numeric_max             NUMERIC,
  numeric_step            NUMERIC,
  select_options          JSONB,
  currency_code           TEXT,
  card_accent             TEXT NOT NULL DEFAULT 'theme',
  card_background_tint    TEXT NOT NULL DEFAULT 'none'
                            CHECK (card_background_tint IN ('none', 'soft', 'strong')),
  card_border             TEXT NOT NULL DEFAULT 'none'
                            CHECK (card_border IN ('none', 'hairline', 'strong')),
  card_size_hint          TEXT NOT NULL DEFAULT 'narrow'
                            CHECK (card_size_hint IN ('narrow', 'wide', 'full')),
  text_size               TEXT NOT NULL DEFAULT 'm',
  text_colour             TEXT NOT NULL DEFAULT 'default',
  display_order           INT  NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- name: snake_case identifier, max 40 chars, starts with a letter.
  CONSTRAINT cells_name_pattern_check
    CHECK (name ~ '^[a-z][a-z0-9_]{0,39}$'),

  -- Output cells must carry a non-null formula. An empty-string formula
  -- IS allowed; the engine surfaces it as a syntax / unknown_name error.
  CONSTRAINT cells_output_requires_formula_check
    CHECK (kind <> 'output' OR formula IS NOT NULL),

  -- Hidden cells must carry a default_value (visitor can never edit them).
  CONSTRAINT cells_hidden_requires_value_check
    CHECK (visibility <> 'hidden' OR default_value IS NOT NULL),

  -- Readonly Input cells must carry a default_value (engine reads from it).
  CONSTRAINT cells_readonly_input_requires_value_check
    CHECK (NOT (kind = 'input' AND editability = 'readonly'
                AND default_value IS NULL))
);

-- (calculator_id, name) UNIQUE — formulas reference cells by name, so the
-- name space is per calculator. Case-sensitive (names are all lowercase
-- per the regex check).
ALTER TABLE public.cells
  ADD CONSTRAINT cells_calculator_name_key
  UNIQUE (calculator_id, name);

-- (section_id, display_order) UNIQUE — gap-free per section, renumbered
-- transactionally on reorder. DEFERRABLE so swap statements don't collide.
ALTER TABLE public.cells
  ADD CONSTRAINT cells_section_display_order_key
  UNIQUE (section_id, display_order)
  DEFERRABLE INITIALLY DEFERRED;

COMMENT ON TABLE public.cells IS
  'PROJ-9. One row per data-model cell. kind discriminates input/output. default_value (Inputs) / formula (Outputs) carry the runtime data; everything else is display configuration. Reserved-word collisions are rejected at the API (the formula function table is not visible to Postgres).';

-- =========================================================================
-- Indexes
-- =========================================================================
-- RLS join uses (calculator_id); reads & PATCHes also lean on it.
CREATE INDEX idx_sections_calculator_id ON public.sections(calculator_id);
CREATE INDEX idx_cells_calculator_id    ON public.cells(calculator_id);
CREATE INDEX idx_cells_section_id       ON public.cells(section_id);

-- Editor loader orders by display_order — composite indexes serve those.
CREATE INDEX idx_sections_calc_order
  ON public.sections(calculator_id, display_order);
CREATE INDEX idx_cells_section_order
  ON public.cells(section_id, display_order);

-- =========================================================================
-- updated_at triggers (re-use public.set_updated_at from PROJ-1)
-- =========================================================================
CREATE TRIGGER trg_sections_set_updated_at
  BEFORE UPDATE ON public.sections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_cells_set_updated_at
  BEFORE UPDATE ON public.cells
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Parent-bump trigger: bump calculators.updated_at on any cell / section
-- INSERT, UPDATE, or DELETE so PROJ-8's optimistic concurrency model
-- (one updated_at per calculator) catches writes at any granularity.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.bump_parent_calculator_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    parent_id := OLD.calculator_id;
  ELSE
    parent_id := NEW.calculator_id;
  END IF;

  UPDATE public.calculators
     SET updated_at = NOW()
   WHERE id = parent_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sections_bump_parent
  AFTER INSERT OR UPDATE OR DELETE ON public.sections
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_parent_calculator_updated_at();

CREATE TRIGGER trg_cells_bump_parent
  AFTER INSERT OR UPDATE OR DELETE ON public.cells
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_parent_calculator_updated_at();

-- =========================================================================
-- Row Level Security — sections
-- =========================================================================
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY sections_select_own
  ON public.sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = sections.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY sections_insert_own
  ON public.sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = sections.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY sections_update_own
  ON public.sections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = sections.calculator_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = sections.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY sections_delete_own
  ON public.sections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = sections.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

-- =========================================================================
-- Row Level Security — cells
-- =========================================================================
ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY cells_select_own
  ON public.cells
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = cells.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY cells_insert_own
  ON public.cells
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = cells.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY cells_update_own
  ON public.cells
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = cells.calculator_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = cells.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY cells_delete_own
  ON public.cells
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = cells.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

-- =========================================================================
-- GRANTs
-- Authenticated users get row-level CRUD (scoped by RLS).
-- service_role bypasses RLS for admin paths.
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cells    TO authenticated;
GRANT ALL                            ON public.sections TO service_role;
GRANT ALL                            ON public.cells    TO service_role;
