-- PROJ-19: Sysadmin Moderation
--
-- Single piece: fn_list_all_user_calculators RPC.
-- SECURITY DEFINER function that cross-reads all active (non-soft-deleted)
-- calculators owned by users other than the caller, joined to profiles for
-- the owner's name. Gated to sysadmin callers via is_sysadmin(auth.uid()).
-- Returns calculator fields + owner_id + owner_name, ordered updated_at DESC,
-- capped at 200 rows.
--
-- The sysadmin hard-delete is handled application-side (admin client in
-- /api/admin/calculators/:id) — no new RLS policies or table changes.

CREATE OR REPLACE FUNCTION public.fn_list_all_user_calculators()
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

  IF NOT public.is_sysadmin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
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
   WHERE c.owner_id <> auth.uid()
     AND c.soft_delete_at IS NULL
   ORDER BY c.updated_at DESC
   LIMIT 200;
END;
$$;

COMMENT ON FUNCTION public.fn_list_all_user_calculators() IS
  'PROJ-19. Read RPC for the sysadmin "User Calculators" moderation section. Returns all active (non-soft-deleted) calculators owned by users other than the caller, joined to profiles for owner_name. SECURITY DEFINER bypasses owner-only RLS; explicit auth.uid() + is_sysadmin() checks at entry. Ordered updated_at DESC, capped at 200 rows.';

REVOKE EXECUTE ON FUNCTION public.fn_list_all_user_calculators() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_list_all_user_calculators() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_list_all_user_calculators() TO service_role;
