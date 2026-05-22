import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the following:
     *   - _next/static    Next.js static assets
     *   - _next/image     Next.js image optimization
     *   - favicon.ico
     *   - common image extensions in /public
     *
     * Route gating (redirect-on-unauthenticated) is not added here — that
     * lives in PROJ-3. This middleware only refreshes the auth session.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
