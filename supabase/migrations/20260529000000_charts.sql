-- PROJ-15: Charts
-- Adds the public.charts table — the visualisation layer of the calculator.
-- Charts live inside sections alongside cells, reference cells by UUID via
-- a polymorphic JSONB `bindings` column, and inherit PROJ-8's calculator-
-- level optimistic-concurrency model via the same parent-bump trigger
-- pattern PROJ-9's sections/cells use.
--
-- See features/PROJ-15-charts.md.

-- =========================================================================
-- charts table
-- =========================================================================
CREATE TABLE public.charts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculator_id           UUID NOT NULL
                            REFERENCES public.calculators(id) ON DELETE CASCADE,
  section_id              UUID NOT NULL
                            REFERENCES public.sections(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  chart_type              TEXT NOT NULL
                            CHECK (chart_type IN (
                              'line', 'bar', 'area', 'pie', 'donut',
                              'stacked_bar', 'comparison_bar', 'sparkline',
                              'waterfall', 'bullet', 'heatmap', 'radial_progress'
                            )),
  title                   TEXT NOT NULL DEFAULT '',
  subtitle                TEXT NOT NULL DEFAULT '',
  bindings                JSONB NOT NULL DEFAULT '{}'::jsonb,
  style                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  card_accent             TEXT NOT NULL DEFAULT 'theme',
  card_background_tint    TEXT NOT NULL DEFAULT 'none'
                            CHECK (card_background_tint IN ('none', 'soft', 'strong')),
  card_border             TEXT NOT NULL DEFAULT 'none'
                            CHECK (card_border IN ('none', 'hairline', 'strong')),
  card_size_hint          TEXT NOT NULL DEFAULT 'narrow'
                            CHECK (card_size_hint IN ('narrow', 'wide', 'full')),
  display_order           INT  NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- snake_case identifier, max 40 chars, starts with a letter.
  CONSTRAINT charts_name_pattern_check
    CHECK (name ~ '^[a-z][a-z0-9_]{0,39}$'),

  -- Title / subtitle length cap (free-text, default empty).
  CONSTRAINT charts_title_length_check
    CHECK (length(title) <= 200),
  CONSTRAINT charts_subtitle_length_check
    CHECK (length(subtitle) <= 200)
);

-- (calculator_id, name) UNIQUE — mirrors PROJ-9's cells constraint. Per-table
-- only; a chart and a cell on the same calculator MAY share a name. Bindings
-- reference cells by UUID, so formulas never disambiguate by name.
ALTER TABLE public.charts
  ADD CONSTRAINT charts_calculator_name_key
  UNIQUE (calculator_id, name);

-- (section_id, display_order) UNIQUE — DEFERRABLE so transactional renumber
-- can swap rows without colliding mid-statement.
ALTER TABLE public.charts
  ADD CONSTRAINT charts_section_display_order_key
  UNIQUE (section_id, display_order)
  DEFERRABLE INITIALLY DEFERRED;

COMMENT ON TABLE public.charts IS
  'PROJ-15. Per-calculator chart rows. bindings JSONB is polymorphic on chart_type (one Zod schema per type validates at the API boundary). Charts reference cells by cell_id (UUID); rename is invisible to bindings, delete invalidates them (surfaced as broken-binding UX at render time).';

-- =========================================================================
-- Indexes
-- =========================================================================
CREATE INDEX idx_charts_calculator_id ON public.charts(calculator_id);
CREATE INDEX idx_charts_section_id    ON public.charts(section_id);
CREATE INDEX idx_charts_section_order
  ON public.charts(section_id, display_order);

-- =========================================================================
-- updated_at trigger (re-use public.set_updated_at)
-- =========================================================================
CREATE TRIGGER trg_charts_set_updated_at
  BEFORE UPDATE ON public.charts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Parent-bump trigger: bump calculators.updated_at on any chart INSERT,
-- UPDATE, or DELETE so PROJ-8's optimistic concurrency surface catches
-- chart writes uniformly with cell/section writes.
-- =========================================================================
CREATE TRIGGER trg_charts_bump_parent
  AFTER INSERT OR UPDATE OR DELETE ON public.charts
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_parent_calculator_updated_at();

-- =========================================================================
-- Row Level Security — charts
-- Owner-scoped via join to calculators.owner_id = auth.uid().
-- Same shape as cells/sections policies.
-- =========================================================================
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY charts_select_own
  ON public.charts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = charts.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY charts_insert_own
  ON public.charts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = charts.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY charts_update_own
  ON public.charts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = charts.calculator_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = charts.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY charts_delete_own
  ON public.charts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = charts.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

-- =========================================================================
-- GRANTs
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charts TO authenticated;
GRANT ALL                            ON public.charts TO service_role;
