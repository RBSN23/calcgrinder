-- PROJ-3: Authentication & Account Approval Flow
-- Creates the signup_approvals table backing the sysadmin approve/decline
-- click-from-email mechanism. One row per signup; both URL paths
-- (/auth/admin/<token>/approve and .../decline) consume the same row.
--
-- Authentication model: knowledge of the token IS the credential. The
-- table is touched only by trusted server contexts via the service-role
-- client (the signup server action and the admin route handler) and is
-- never exposed to end-user clients. RLS is enabled with ZERO policies
-- so any anon / authenticated read or write is denied.

-- =========================================================================
-- signup_approvals table
-- =========================================================================
CREATE TABLE public.signup_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE
                 REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at  TIMESTAMPTZ,
  outcome      TEXT
                 CHECK (outcome IN ('approved', 'declined'))
);

-- Token lookup is the hot path (admin click) — UNIQUE already adds a
-- btree index, so no extra index is required.
CREATE INDEX idx_signup_approvals_user_id ON public.signup_approvals(user_id);

COMMENT ON TABLE public.signup_approvals IS
  'One row per signup. token-as-credential model: rows are read/written exclusively by the server via the service-role client. RLS is enabled with NO policies on purpose — end-user RLS paths cannot make a correct authorisation decision under the token-as-credential model, so all direct access is denied. Do NOT add a policy without reading PROJ-3 § C and § D.';

COMMENT ON COLUMN public.signup_approvals.token IS
  '43-char base64url string from crypto.randomBytes(32). Single-use, never expires.';

COMMENT ON COLUMN public.signup_approvals.consumed_at IS
  'Set on the first approve/decline click. Idempotency is enforced via UPDATE … WHERE consumed_at IS NULL.';

-- =========================================================================
-- Row Level Security
-- =========================================================================
-- RLS is ON, but we deliberately do not add any policies. All access
-- happens through the service-role client which bypasses RLS. End-user
-- (anon / authenticated) access is denied wholesale by RLS-with-no-
-- policies — this is the explicit posture, not a missing policy.
ALTER TABLE public.signup_approvals ENABLE ROW LEVEL SECURITY;

-- service_role is the only path; anon / authenticated get nothing.
GRANT ALL ON public.signup_approvals TO service_role;
REVOKE ALL ON public.signup_approvals FROM anon, authenticated;
