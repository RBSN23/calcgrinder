import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { routeGate } from '@/lib/auth/route-gate';

import type { Database } from './types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANT: refreshes the auth token. Do not put logic between
  // createServerClient() and getUser() — Supabase's docs are explicit.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // PROJ-3 route gating, Layer 1.
  //
  // Middleware handles ONLY the anonymous-user redirect on private
  // paths (cases 1–3 in the 15-case matrix). The status-based redirects
  // (cases 8–14) need `profiles.status`, which we deliberately do NOT
  // read at the edge — that lookup happens in the `(app)` / `(auth)`
  // route-group layouts where the DB roundtrip is already amortised.
  if (!user) {
    const decision = routeGate(request.nextUrl.pathname, null);
    if (decision.kind === 'redirect') {
      const url = request.nextUrl.clone();
      const [pathname, search = ''] = decision.to.split('?');
      url.pathname = pathname;
      url.search = search ? `?${search}` : '';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
