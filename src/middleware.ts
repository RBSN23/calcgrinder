import { NextResponse, type NextRequest } from 'next/server';

import { probePublicCalculatorStatus } from '@/lib/calculators/public-status';
import { checkPageLoad } from '@/lib/rate-limit';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_TOKEN_RE = /^\/c\/([^/]+)\/?$/;

/**
 * Extract the client IP. Vercel populates `x-forwarded-for` (RFC 7239 CSV);
 * the first entry is the original visitor. Falls back to the legacy
 * `x-real-ip` header for self-hosted reverse proxies. Returns null if
 * neither is present (local dev) — the caller's rate-limit helper falls
 * open in that case.
 */
function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return null;
}

export async function middleware(request: NextRequest) {
  // PROJ-11 — page-load rate limit on /c/<token>. Runs BEFORE the
  // Supabase session refresh so a 429'd visitor never touches the DB.
  // Fail-open is built into checkPageLoad — any limiter error or
  // missing env returns { success: true }.
  const tokenMatch = PUBLIC_TOKEN_RE.exec(request.nextUrl.pathname);
  if (tokenMatch) {
    const ip = getClientIp(request);
    const result = await checkPageLoad(ip);
    if (!result.success) {
      // Plain HTML body. No calculator data leaked.
      const body =
        '<!doctype html><html lang="en"><head>' +
        '<meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>Too many requests — Calcgrinder</title>' +
        '<meta name="robots" content="noindex, nofollow">' +
        '<style>body{font-family:system-ui,-apple-system,sans-serif;' +
        'max-width:560px;margin:80px auto;padding:0 24px;color:#222;}' +
        'h1{font-size:1.5rem;margin-bottom:12px;}p{line-height:1.5;}</style>' +
        '</head><body>' +
        '<h1>Slow down — too many requests</h1>' +
        '<p>Please wait about a minute and try again.</p>' +
        '</body></html>';
      const headers: HeadersInit = {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      };
      if (result.reset > 0) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((result.reset - Date.now()) / 1000),
        );
        (headers as Record<string, string>)['retry-after'] = String(retryAfterSeconds);
      }
      return new NextResponse(body, { status: 429, headers });
    }

    // PROJ-11 — 410 (Gone) gate. Next.js App Router cannot co-locate
    // route.ts + page.tsx at the same dynamic segment, so the
    // architecture's "Route Handler shim" lives here in middleware
    // instead. Fail-open on `unknown` (network/Supabase error) so a
    // transient outage never blocks the visitor surface.
    const token = decodeURIComponent(tokenMatch[1] ?? '');
    if (token) {
      const probe = await probePublicCalculatorStatus(request, token);
      if (probe.status === 'gone') {
        const body =
          '<!doctype html><html lang="en"><head>' +
          '<meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<title>Calculator no longer available — Calcgrinder</title>' +
          '<meta name="robots" content="noindex, nofollow">' +
          '<style>body{font-family:system-ui,-apple-system,sans-serif;' +
          'max-width:560px;margin:80px auto;padding:0 24px;color:#222;}' +
          'h1{font-size:1.5rem;margin-bottom:12px;}p{line-height:1.5;}</style>' +
          '</head><body>' +
          '<h1>This calculator is no longer available</h1>' +
          "<p>The link is still valid, but the calculator's author has removed it.</p>" +
          '</body></html>';
        return new NextResponse(body, {
          status: 410,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'x-robots-tag': 'noindex, nofollow',
          },
        });
      }
    }
  }

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
