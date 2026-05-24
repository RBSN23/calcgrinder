-- PROJ-14: Settings Page
--
-- One additive migration covering the schema delta for the Settings page
-- (account deletion grace-window + per-user default calculator theme + the
-- pending email-change cancel mechanism + the visitor-side owner-status
-- filter).
--
-- Changes:
--   1. profiles: add `default_calculator_theme TEXT NULL` (per-user
--      override; NULL means "use getDefaultThemeId() at create time").
--   2. profiles.status CHECK: extend to allow 'pending_deletion'
--      (the existing `pending_deletion_at TIMESTAMPTZ` column from
--      PROJ-1 is now actually populated by the deletion-confirm flow).
--   3. account_deletion_requests: new table, one active row per user
--      (UNIQUE(user_id)), service-role-only (RLS-on + zero policies),
--      mirroring the signup_approvals posture.
--   4. fn_clear_pending_email_change(p_user_id UUID): SECURITY DEFINER
--      function that clears the five canonical email_change_* fields on
--      auth.users. The only application-side raw `auth.users` write in
--      the codebase outside Supabase's own paths. Called via the
--      `clearPendingEmailChange()` helper at src/lib/auth/email-change.ts.
--   5. fn_get_public_calculator + fn_get_scenario_by_share_token:
--      re-defined with an inner-join filter requiring the owner's
--      profiles.status = 'approved' (visitors get zero rows when the
--      owner is pending/declined/pending_deletion → existing 410-Gone
--      treatment in PROJ-11 / PROJ-12).
--
-- Forward-compat: the SECURITY DEFINER RPC takes a single user_id arg
-- and is wrapped in a `'server-only'` helper so the raw `auth.users`
-- touch-point is grep-able. PROJ-19 (sysadmin moderation) may reuse the
-- helper if/when it ships a "force-cancel pending email change" admin
-- surface.

-- =========================================================================
-- 1. profiles.default_calculator_theme
-- =========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_calculator_theme TEXT;

COMMENT ON COLUMN public.profiles.default_calculator_theme IS
  'PROJ-14. Per-user default calculator theme id. NULL means "use the system default (getDefaultThemeId()) when creating a new calculator". Written by the Settings page server action via the admin client; never validated at the DB layer (validation lives in the action''s Zod schema against the in-memory theme registry).';

-- =========================================================================
-- 2. Extend profiles.status CHECK to include 'pending_deletion'
-- =========================================================================
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'approved', 'declined', 'pending_deletion'));

-- =========================================================================
-- 3. account_deletion_requests table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE
                  REFERENCES auth.users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at   TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ
);

-- user_id is already UNIQUE (carries a btree index); token is UNIQUE
-- (carries a btree index). No extra indexes needed for the v1 read paths
-- (per-user lookup + per-token lookup are both index-backed).

COMMENT ON TABLE public.account_deletion_requests IS
  'PROJ-14. One active row per user. UPSERT pattern (UNIQUE(user_id)) — re-requesting deletion mutates the existing row with a fresh token and clears consumed_at/cancelled_at. token-as-credential model: rows are read/written exclusively by the server via the service-role client (the Settings actions and the confirm-delete route handler) and are never exposed to end-user clients. RLS is enabled with NO policies on purpose — end-user RLS paths cannot make a correct authorisation decision under the token-as-credential model, so all direct access is denied. Mirrors signup_approvals posture (PROJ-3).';

COMMENT ON COLUMN public.account_deletion_requests.token IS
  '43-char base64url from crypto.randomBytes(32). Single-use, never expires; the grace window is the time-bound mechanic (RETENTION_PERIOD_DAYS), not the click window.';

COMMENT ON COLUMN public.account_deletion_requests.consumed_at IS
  'Set on the first confirm-delete click. Idempotency is enforced by the route handler (re-click reads back).';

COMMENT ON COLUMN public.account_deletion_requests.cancelled_at IS
  'Set when the user cancels — either pre-click (Danger-zone banner) or post-click (cancel-deletion screen).';

-- =========================================================================
-- Row Level Security — service-role only (mirrors signup_approvals)
-- =========================================================================
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- service_role is the only path; anon / authenticated get nothing.
-- Settings actions use the admin client (service_role) precisely because
-- the user themselves must not be able to enumerate or mutate these rows.
GRANT ALL    ON public.account_deletion_requests TO service_role;
REVOKE ALL   ON public.account_deletion_requests FROM anon, authenticated;

-- =========================================================================
-- 4. fn_clear_pending_email_change
--
-- Why a SECURITY DEFINER RPC instead of an SDK call:
--   - The Supabase Admin SDK's AdminUserAttributes surface does NOT
--     include email_change_*; passing them in updateUserById is silently
--     ignored by GoTrue.
--   - supabase-js exposes no direct SQL execution path.
--   - The SDK-friendly alternative (updateUserById({ email: currentEmail }))
--     can emit a notification email to the original address — wrong UX
--     for a Cancel.
--
-- Clears all five canonical fields involved in an in-flight email change:
--   email_change                  (the pending target address)
--   email_change_token_new        (the OTP hash sent to the new address)
--   email_change_token_current    (the OTP hash sent to the current addr;
--                                  set when "Secure email change" is on)
--   email_change_sent_at          (timestamp of the change attempt)
--   email_change_confirm_status   (integer counter; reset to 0)
--
-- search_path is pinned to '' per Supabase "Securing Functions" docs.
-- Caller must already have authenticated the user (we trust the helper's
-- single call-site at src/lib/auth/email-change.ts which itself runs only
-- via the Settings server actions behind the (app) gate). Service_role
-- is the only role granted EXECUTE — anon/authenticated cannot reach
-- this function directly.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_clear_pending_email_change(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
     SET email_change                = '',
         email_change_token_new      = '',
         email_change_token_current  = '',
         email_change_sent_at        = NULL,
         email_change_confirm_status = 0
   WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.fn_clear_pending_email_change(UUID) IS
  'PROJ-14. SECURITY DEFINER write into auth.users to clear the five canonical email_change_* fields. The only application-side raw auth.users write in the codebase outside Supabase''s own paths. Called from src/lib/auth/email-change.ts via the admin (service_role) client; no anon/authenticated EXECUTE grant. Sets text fields to empty string (not NULL) because the GoTrue schema declares them NOT NULL DEFAULT ''''.';

REVOKE EXECUTE ON FUNCTION public.fn_clear_pending_email_change(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_clear_pending_email_change(UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_clear_pending_email_change(UUID) TO service_role;

-- =========================================================================
-- 5a. fn_get_public_calculator — re-defined with owner-status filter
--
-- Adds an INNER JOIN to profiles requiring status='approved'. Visitors
-- get zero rows when the owner is in any non-approved state (pending,
-- declined, pending_deletion); the calling route handler falls back to
-- the 410-Gone treatment that PROJ-11 already ships for soft-deleted
-- calculators.
-- =========================================================================
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
  JOIN public.profiles p
    ON p.id = c.owner_id
   AND p.status = 'approved'
  WHERE c.public_token = p_token;
$$;

COMMENT ON FUNCTION public.fn_get_public_calculator(TEXT) IS
  'PROJ-11 + PROJ-14. SECURITY DEFINER read path for the anonymous /c/<token> visitor route. Returns the calculator row + a JSONB array of sections (each with its cells) in one call. Returns 0 rows on no token-match OR when the owner is not in status=''approved'' (pending/declined/pending_deletion); both routes 404/410 in the caller. Returns the row even when soft_delete_at IS NOT NULL (caller → 410). published is NOT a gate — Draft calculators are reachable at their public token by design.';

REVOKE EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_public_calculator(TEXT) TO service_role;

-- =========================================================================
-- 5b. fn_get_scenario_by_share_token — re-defined with owner-status filter
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_get_scenario_by_share_token(
  p_share_token TEXT,
  p_calc_token  TEXT
)
RETURNS TABLE (
  scenario_id           UUID,
  scenario_title        TEXT,
  scenario_description  TEXT,
  scenario_values       JSONB,
  scenario_owner_id     UUID,
  scenario_owner_name   TEXT,
  scenario_updated_at   TIMESTAMPTZ,
  calculator_payload    JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    s.id                                    AS scenario_id,
    s.title                                 AS scenario_title,
    s.description                           AS scenario_description,
    s.values                                AS scenario_values,
    s.owner_id                              AS scenario_owner_id,
    COALESCE(p.name, '')                    AS scenario_owner_name,
    s.updated_at                            AS scenario_updated_at,
    jsonb_build_object(
      'id',             c.id,
      'owner_id',       c.owner_id,
      'title',          c.title,
      'description',    c.description,
      'theme_id',       c.theme_id,
      'public_token',   c.public_token,
      'published',      c.published,
      'soft_delete_at', c.soft_delete_at,
      'updated_at',     c.updated_at,
      'sections',       COALESCE(
        (
          SELECT jsonb_agg(section_row ORDER BY section_row.display_order)
            FROM (
              SELECT
                sec.id,
                sec.title,
                sec.description,
                sec.layout_pattern_id,
                sec.display_order,
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
                        WHERE cl.section_id = sec.id
                      ) AS cell_row
                  ),
                  '[]'::jsonb
                ) AS cells
              FROM public.sections sec
              WHERE sec.calculator_id = c.id
            ) AS section_row
        ),
        '[]'::jsonb
      )
    )                                       AS calculator_payload
  FROM public.scenarios s
  JOIN public.calculators c
    ON c.id = s.calculator_id
   AND c.public_token = p_calc_token
   AND c.soft_delete_at IS NULL
  JOIN public.profiles owner_profile
    ON owner_profile.id = c.owner_id
   AND owner_profile.status = 'approved'
  LEFT JOIN public.profiles p
    ON p.id = s.owner_id
  WHERE s.share_token = p_share_token;
$$;

COMMENT ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) IS
  'PROJ-12 + PROJ-14. SECURITY DEFINER read path for the anonymous /c/<token>?s=<share_token> visitor route. Single round-trip returning the scenario + parent calculator (sections + cells) + scenario-owner display name. Returns 0 rows on share_token miss, calc_token mismatch (cross-calc forge defence), orphan scenarios, soft-deleted calculator, OR when the calculator-owner is not in status=''approved'' (pending/declined/pending_deletion).';

REVOKE EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_scenario_by_share_token(TEXT, TEXT) TO service_role;
