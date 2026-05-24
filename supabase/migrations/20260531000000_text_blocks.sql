-- PROJ-16: Text Blocks (Markdown)
-- Adds public.text_blocks — the prose layer of the calculator. Text blocks
-- live inside sections alongside cells (PROJ-9) and charts (PROJ-15) and
-- carry the same card-level visual override columns plus two text-block-
-- specific ones (text_size, text_colour).
--
-- Deliberate deviations from the cell / chart pattern, per spec Decision
-- Log:
--   * NO `name` column. Text blocks are Builder-only — no Grid column
--     references them and no formula or chart binding can resolve them.
--   * NO UNIQUE(calculator_id, name) constraint (direct consequence).
--
-- The (section_id, display_order) DEFERRABLE INITIALLY DEFERRED UNIQUE
-- constraint mirrors PROJ-15's charts so transactional renumbers can swap
-- rows without colliding mid-statement.
--
-- See features/PROJ-16-text-blocks-markdown.md.

-- =========================================================================
-- text_blocks table
-- =========================================================================
CREATE TABLE public.text_blocks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculator_id           UUID NOT NULL
                            REFERENCES public.calculators(id) ON DELETE CASCADE,
  section_id              UUID NOT NULL
                            REFERENCES public.sections(id) ON DELETE CASCADE,
  body                    TEXT NOT NULL DEFAULT '',
  card_accent             TEXT NOT NULL DEFAULT 'theme',
  card_background_tint    TEXT NOT NULL DEFAULT 'none'
                            CHECK (card_background_tint IN ('none', 'soft', 'strong')),
  card_border             TEXT NOT NULL DEFAULT 'none'
                            CHECK (card_border IN ('none', 'hairline', 'strong')),
  card_size_hint          TEXT NOT NULL DEFAULT 'wide'
                            CHECK (card_size_hint IN ('narrow', 'wide', 'full')),
  text_size               TEXT NOT NULL DEFAULT 'm'
                            CHECK (text_size IN ('s', 'm', 'l', 'xl')),
  text_colour             TEXT NOT NULL DEFAULT 'default'
                            CHECK (text_colour IN ('default', 'accent_1', 'accent_2')),
  display_order           INT  NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (section_id, display_order) UNIQUE — DEFERRABLE so transactional renumber
-- can swap rows without colliding mid-statement. Same pattern as PROJ-9
-- cells and PROJ-15 charts.
ALTER TABLE public.text_blocks
  ADD CONSTRAINT text_blocks_section_display_order_key
  UNIQUE (section_id, display_order)
  DEFERRABLE INITIALLY DEFERRED;

COMMENT ON TABLE public.text_blocks IS
  'PROJ-16. Per-section markdown prose blocks. NO name column (deliberate spec deviation): text blocks are Builder-only with no Grid column and aren''t referenced by formulas. The 50 KB UTF-8 byte cap on body is enforced at the API layer (Zod), not via DB CHECK, so it can be raised without a migration.';

-- =========================================================================
-- Indexes
-- =========================================================================
CREATE INDEX idx_text_blocks_calculator_id ON public.text_blocks(calculator_id);
CREATE INDEX idx_text_blocks_section_id    ON public.text_blocks(section_id);
CREATE INDEX idx_text_blocks_section_order
  ON public.text_blocks(section_id, display_order);

-- =========================================================================
-- updated_at trigger (re-use public.set_updated_at)
-- =========================================================================
CREATE TRIGGER trg_text_blocks_set_updated_at
  BEFORE UPDATE ON public.text_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Parent-bump trigger: bump calculators.updated_at on any text_block INSERT,
-- UPDATE, or DELETE so PROJ-8's optimistic concurrency surface catches
-- text-block writes uniformly with cell/section/chart writes.
-- =========================================================================
CREATE TRIGGER trg_text_blocks_bump_parent
  AFTER INSERT OR UPDATE OR DELETE ON public.text_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_parent_calculator_updated_at();

-- =========================================================================
-- Row Level Security — text_blocks
-- Owner-scoped via join to calculators.owner_id = auth.uid().
-- Same shape as charts / cells / sections policies.
-- =========================================================================
ALTER TABLE public.text_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY text_blocks_select_own
  ON public.text_blocks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = text_blocks.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY text_blocks_insert_own
  ON public.text_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = text_blocks.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY text_blocks_update_own
  ON public.text_blocks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = text_blocks.calculator_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = text_blocks.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY text_blocks_delete_own
  ON public.text_blocks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculators c
      WHERE c.id = text_blocks.calculator_id
        AND c.owner_id = auth.uid()
    )
  );

-- =========================================================================
-- GRANTs
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.text_blocks TO authenticated;
GRANT ALL                            ON public.text_blocks TO service_role;
