import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from './types';

/**
 * Returns a privileged Supabase client backed by the secret key.
 * RLS is bypassed — use only from trusted server contexts:
 *   - route handlers under /api/cron/**
 *   - scripts under scripts/**
 *   - server actions / route handlers that need privileged writes
 *     (sysadmin approval, account deletion, etc.)
 *
 * Never import this module from client components — the `server-only`
 * import above turns that mistake into a build error.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required to construct the admin client');
  }
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required to construct the admin client');
  }

  return createSupabaseClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
