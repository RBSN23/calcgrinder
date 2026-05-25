-- PROJ-25: Performance — Core Interaction Speed (dashboard RPC)
--
-- Collapses the 6 parallel HTTP round-trips that the dashboard page
-- (`src/app/(app)/dashboard/page.tsx`) makes on every load into a single
-- SECURITY INVOKER RPC. The function reads:
--   1. My Calculators     — active, non-soft-deleted, owned by caller
--   2. My Scenarios       — LEFT JOIN with parent calculator info
--   3. Trashed Calculators — soft-deleted, owned by caller
--   4. Orphan Scenario Count — scenarios whose parent was hard-deleted
--   5. Presets            — delegates to existing fn_list_presets()
--   6. User Calculators   — sysadmin-only, delegates to fn_list_all_user_calculators()
--
-- Returns a single JSONB object. SECURITY INVOKER so RLS applies to the
-- direct table reads (queries 1–4); the two SECURITY DEFINER sub-calls
-- (queries 5–6) handle their own access control internally.

CREATE OR REPLACE FUNCTION public.fn_get_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id        UUID := auth.uid();
  v_is_sysadmin    BOOLEAN;
  v_calculators    JSONB;
  v_scenarios      JSONB;
  v_trashed        JSONB;
  v_orphan_count   BIGINT;
  v_presets         JSONB;
  v_user_calcs     JSONB;
BEGIN
  -- -----------------------------------------------------------------------
  -- Auth gate
  -- -----------------------------------------------------------------------
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- -----------------------------------------------------------------------
  -- Sysadmin flag (used for the user_calculators branch below)
  -- -----------------------------------------------------------------------
  SELECT (p.role = 'sysadmin')
    INTO v_is_sysadmin
    FROM public.profiles p
   WHERE p.id = caller_id;

  -- Defensive: if no profile row exists (should not happen for an
  -- authenticated user, but be safe), default to non-sysadmin.
  IF v_is_sysadmin IS NULL THEN
    v_is_sysadmin := FALSE;
  END IF;

  -- -----------------------------------------------------------------------
  -- 1. My Calculators (active, non-soft-deleted)
  -- -----------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',           c.id,
      'title',        c.title,
      'description',  c.description,
      'theme_id',     c.theme_id,
      'updated_at',   c.updated_at,
      'published',    c.published,
      'public_token', c.public_token
    ) ORDER BY c.updated_at DESC
  ), '[]'::jsonb)
    INTO v_calculators
    FROM public.calculators c
   WHERE c.owner_id = caller_id
     AND c.soft_delete_at IS NULL;

  -- -----------------------------------------------------------------------
  -- 2. My Scenarios (LEFT JOIN with parent calculator info)
  -- -----------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             s.id,
      'calculator_id',  s.calculator_id,
      'owner_id',       s.owner_id,
      'title',          s.title,
      'description',    s.description,
      'values',         s.values,
      'share_token',    s.share_token,
      'created_at',     s.created_at,
      'updated_at',     s.updated_at,
      'calculator',     CASE
                          WHEN c.id IS NOT NULL THEN
                            json_build_object(
                              'id',             c.id,
                              'title',          c.title,
                              'public_token',   c.public_token,
                              'soft_delete_at', c.soft_delete_at
                            )
                          ELSE NULL
                        END
    ) ORDER BY s.updated_at DESC
  ), '[]'::jsonb)
    INTO v_scenarios
    FROM (
      SELECT *
        FROM public.scenarios sc
       WHERE sc.owner_id = caller_id
       ORDER BY sc.updated_at DESC
       LIMIT 1000
    ) s
    LEFT JOIN public.calculators c ON c.id = s.calculator_id;

  -- -----------------------------------------------------------------------
  -- 3. Trashed Calculators (soft-deleted)
  -- -----------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             c.id,
      'title',          c.title,
      'description',    c.description,
      'theme_id',       c.theme_id,
      'updated_at',     c.updated_at,
      'published',      c.published,
      'public_token',   c.public_token,
      'soft_delete_at', c.soft_delete_at
    ) ORDER BY c.soft_delete_at DESC
  ), '[]'::jsonb)
    INTO v_trashed
    FROM public.calculators c
   WHERE c.owner_id = caller_id
     AND c.soft_delete_at IS NOT NULL;

  -- -----------------------------------------------------------------------
  -- 4. Orphan Scenario Count
  -- -----------------------------------------------------------------------
  SELECT COUNT(*)
    INTO v_orphan_count
    FROM public.scenarios s
   WHERE s.owner_id = caller_id
     AND s.calculator_id IS NULL;

  -- -----------------------------------------------------------------------
  -- 5. Presets (delegate to existing SECURITY DEFINER RPC)
  -- -----------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',           pr.id,
      'title',        pr.title,
      'description',  pr.description,
      'theme_id',     pr.theme_id,
      'updated_at',   pr.updated_at,
      'published',    pr.published,
      'public_token', pr.public_token,
      'owner_id',     pr.owner_id,
      'owner_name',   pr.owner_name
    )
  ), '[]'::jsonb)
    INTO v_presets
    FROM public.fn_list_presets() pr;

  -- -----------------------------------------------------------------------
  -- 6. User Calculators (sysadmin-only; delegate to existing RPC)
  -- -----------------------------------------------------------------------
  IF v_is_sysadmin THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',           uc.id,
        'title',        uc.title,
        'description',  uc.description,
        'theme_id',     uc.theme_id,
        'updated_at',   uc.updated_at,
        'published',    uc.published,
        'public_token', uc.public_token,
        'owner_id',     uc.owner_id,
        'owner_name',   uc.owner_name
      )
    ), '[]'::jsonb)
      INTO v_user_calcs
      FROM public.fn_list_all_user_calculators() uc;
  ELSE
    v_user_calcs := '[]'::jsonb;
  END IF;

  -- -----------------------------------------------------------------------
  -- Assemble and return
  -- -----------------------------------------------------------------------
  RETURN jsonb_build_object(
    'calculators',           v_calculators,
    'scenarios',             v_scenarios,
    'trashed_calculators',   v_trashed,
    'orphan_scenario_count', v_orphan_count,
    'presets',               v_presets,
    'user_calculators',      v_user_calcs,
    'is_sysadmin',           v_is_sysadmin
  );
END;
$$;

COMMENT ON FUNCTION public.fn_get_dashboard() IS
  'PROJ-25. Single-RPC dashboard loader. Collapses the 6 parallel HTTP round-trips that the dashboard page makes into one server-side function call. SECURITY INVOKER so RLS applies to the direct table reads (calculators, scenarios); the presets and user_calculators sub-queries delegate to existing SECURITY DEFINER RPCs that handle their own access control. Returns a JSONB object with keys: calculators, scenarios, trashed_calculators, orphan_scenario_count, presets, user_calculators, is_sysadmin.';

REVOKE EXECUTE ON FUNCTION public.fn_get_dashboard() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_dashboard() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_get_dashboard() TO service_role;
