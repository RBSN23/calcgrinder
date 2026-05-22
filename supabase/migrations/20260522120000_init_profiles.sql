-- PROJ-1: Supabase Infrastructure Setup
-- Creates the profiles table, RLS policies, triggers, and the is_sysadmin
-- helper function. Calculator-domain tables (calculators, cells, sections,
-- scenarios, charts, text_blocks) are added by the features that need them
-- (PROJ-9, PROJ-10, PROJ-12, etc.) and are NOT part of this migration.

-- =========================================================================
-- profiles table
-- =========================================================================
CREATE TABLE public.profiles (
  id                   UUID PRIMARY KEY
                         REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  role                 TEXT NOT NULL DEFAULT 'registered'
                         CHECK (role IN ('registered', 'sysadmin')),
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'declined')),
  pending_deletion_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role  ON public.profiles(role);

COMMENT ON TABLE public.profiles IS
  'One row per auth.users entry. Mirrors email from auth.users via trigger; role and status are not user-editable (enforced by column-level GRANTs).';

-- =========================================================================
-- updated_at trigger: auto-bump on every UPDATE
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- handle_new_user trigger: auth.users INSERT -> matching profiles row
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'registered',
    'pending'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_users_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- sync_user_email trigger: auth.users.email UPDATE -> profiles.email
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.profiles
       SET email = NEW.email
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_users_sync_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email();

-- =========================================================================
-- is_sysadmin helper function (reusable by every future RLS policy)
-- Hardened per Supabase "Securing Functions" docs: SECURITY DEFINER plus
-- pinned search_path to prevent search-path-injection attacks.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_sysadmin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
      FROM public.profiles
     WHERE id = uid
       AND role = 'sysadmin'
       AND status = 'approved'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_sysadmin(UUID) TO authenticated, anon;

-- =========================================================================
-- Row Level Security
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: a user reads their own row; a sysadmin reads all rows.
CREATE POLICY profiles_select_own_or_sysadmin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_sysadmin(auth.uid())
  );

-- UPDATE: a user can update only their own row. Column-level GRANTs (below)
-- additionally restrict which columns the user can actually write.
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No INSERT policy for clients: rows are inserted exclusively by the
-- handle_new_user trigger (SECURITY DEFINER, bypasses RLS).
--
-- No DELETE policy for clients: profile deletion happens via auth.users
-- CASCADE (after the pending-deletion email-confirmation flow). Direct
-- client deletes are not exposed.

-- =========================================================================
-- Column-level GRANTs
-- Authenticated users can SELECT all columns (RLS scopes the rows), but can
-- UPDATE only `name`. role/status/email/pending_deletion_at/audit columns
-- are server-controlled — they're written only via service_role paths
-- (seed script, account-deletion flow) which bypass these GRANTs.
-- =========================================================================
GRANT SELECT          ON public.profiles TO authenticated;
GRANT UPDATE (name)   ON public.profiles TO authenticated;
GRANT ALL             ON public.profiles TO service_role;
