// PROJ-11 — Edge-runtime helper for the middleware soft-delete gate.
//
// `fetchPublicCalculator()` (`./public.ts`) uses the server-only
// Supabase client (cookies / next/headers) and cannot run in
// middleware. This helper makes the same RPC via `@supabase/ssr`'s
// `createServerClient`, returning only the status we need to decide
// between 200 / 404 / 410. Keep the surface minimal — middleware
// runs on every `/c/<token>` request, so allocating the full JSON
// payload here is wasteful.

import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

import type { Database } from '@/lib/supabase/types';

export type PublicCalculatorStatus =
  | { status: 'ok' }
  | { status: 'gone'; soft_delete_at: string }
  | { status: 'not_found' }
  | { status: 'unknown' };

/**
 * Edge-runtime status probe. Returns `'unknown'` (fail-open) on any
 * configuration / network error so a Supabase outage never blocks the
 * visitor surface.
 */
export async function probePublicCalculatorStatus(
  request: NextRequest,
  token: string,
): Promise<PublicCalculatorStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { status: 'unknown' };

  try {
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op — the probe never writes cookies.
        },
      },
    });
    const { data, error } = await supabase.rpc('fn_get_public_calculator', {
      p_token: token,
    });
    if (error) return { status: 'unknown' };
    if (!data || data.length === 0) return { status: 'not_found' };
    const row = data[0];
    if (row.soft_delete_at) {
      return { status: 'gone', soft_delete_at: row.soft_delete_at };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'unknown' };
  }
}
