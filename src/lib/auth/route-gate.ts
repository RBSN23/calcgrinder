/**
 * PROJ-3 — Pure route-gating decision function.
 *
 * The actual redirect plumbing lives in middleware and in the
 * `(app)` / `(auth)` route-group layouts. This module is the single
 * source of truth for the matrix of who-can-go-where, so the 15-case
 * acceptance test matrix can exercise the logic without booting Next.
 *
 * The function returns a `RouteDecision`:
 *   - `{ kind: 'pass' }` — the request may proceed.
 *   - `{ kind: 'redirect', to: '/auth/login' | ... }` — middleware /
 *     layout should issue a 302 to `to`.
 *
 * Inputs:
 *   - `pathname`  — the request path (no query string).
 *   - `auth`      — `null` for anonymous, or `{ status }` for a
 *                   signed-in user. We only need the approval status
 *                   to decide; profile name/email/role are out of scope.
 *
 * Decision order (top wins):
 *   1. Public paths bypass every gate (visitor surface, admin click,
 *      Supabase OTP callback, sign-out POST, static assets).
 *   2. Pre-auth surfaces (`/auth/*` minus public ones):
 *      • anonymous → pass (except /auth/cancel-deletion which 302s to
 *        /auth/login — no session means no grace-window screen).
 *      • approved → pass on /auth/email-confirmed (PROJ-14: post-email-
 *        change landing — anonymous OK too); redirect away from
 *        /auth/cancel-deletion; otherwise redirect to /dashboard.
 *      • pending / declined on /auth/waiting-for-approval → pass.
 *      • pending / declined elsewhere under /auth → redirect to
 *        /auth/waiting-for-approval (signed-in pending user has no
 *        business on /auth/login etc.).
 *      • pending_deletion on /auth/cancel-deletion → pass.
 *      • pending_deletion elsewhere under /auth → redirect to
 *        /auth/cancel-deletion (the grace-window screen is the only
 *        auth surface this user can reach).
 *   3. Private paths (`/dashboard`, `/editor/*`, `/settings`, `/api/*`
 *      excluding `/api/cron/*`):
 *      • anonymous → redirect to /auth/login?next=<pathname>.
 *      • pending / declined → redirect to /auth/waiting-for-approval.
 *      • pending_deletion → redirect to /auth/cancel-deletion.
 *      • approved → pass.
 *   4. Anything else (root `/` and unmatched paths) → pass; the page
 *      handler decides.
 */

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'pending_deletion';

export type RouteGateAuth =
  | null
  | { status: ApprovalStatus };

export type RouteDecision =
  | { kind: 'pass' }
  | { kind: 'redirect'; to: string };

const PASS: RouteDecision = { kind: 'pass' };

// Public paths that bypass every gate. Order matters only for legibility.
const PUBLIC_PREFIXES = [
  '/c/',                  // visitor calculator surface (PROJ-11)
  '/auth/admin/',         // sysadmin approve/decline click-from-email
  '/auth/account/',       // PROJ-14 deletion-confirm click-from-email
  '/auth/confirm',        // Supabase Auth OTP callback
  '/auth/email-confirmed',// PROJ-14 post-email-change landing (anonymous OK)
  '/auth/sign-out',       // no-JS POST sign-out
  '/api/cron/',           // Vercel-invoked, authed via CRON_SECRET header
  '/_next/',              // Next.js assets
] as const;

const PUBLIC_EXACT = new Set<string>([
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

// Pre-auth surfaces under `(auth)` — every page lives under /auth/<slug>.
const AUTH_PREFIX = '/auth/';

// Private surfaces under `(app)`. We match by prefix so /editor/<id> works.
const PRIVATE_PREFIXES = [
  '/dashboard',
  '/editor',
  '/settings',
] as const;

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function isAuthSurface(pathname: string): boolean {
  // /auth itself or anything under /auth/. Note: public auth paths are
  // already filtered out before this is called.
  return pathname === '/auth' || pathname.startsWith(AUTH_PREFIX);
}

function isPrivate(pathname: string): boolean {
  for (const prefix of PRIVATE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  // Private API surface (anything under /api/ that isn't /api/cron/).
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/cron/')) {
    return true;
  }
  return false;
}

export function routeGate(
  pathname: string,
  auth: RouteGateAuth,
): RouteDecision {
  if (isPublic(pathname)) return PASS;

  if (isAuthSurface(pathname)) {
    if (!auth) {
      // Anonymous browser on /auth/cancel-deletion has no session to read
      // the grace-window state from — bounce to login.
      if (pathname === '/auth/cancel-deletion') {
        return { kind: 'redirect', to: '/auth/login' };
      }
      return PASS;
    }
    if (auth.status === 'approved') {
      return { kind: 'redirect', to: '/dashboard' };
    }
    if (auth.status === 'pending_deletion') {
      if (pathname === '/auth/cancel-deletion') return PASS;
      return { kind: 'redirect', to: '/auth/cancel-deletion' };
    }
    // pending / declined are allowed only on the waiting-for-approval screen.
    if (pathname === '/auth/waiting-for-approval') return PASS;
    return { kind: 'redirect', to: '/auth/waiting-for-approval' };
  }

  if (isPrivate(pathname)) {
    if (!auth) {
      return {
        kind: 'redirect',
        to: `/auth/login?next=${encodeURIComponent(pathname)}`,
      };
    }
    if (auth.status === 'pending_deletion') {
      return { kind: 'redirect', to: '/auth/cancel-deletion' };
    }
    if (auth.status !== 'approved') {
      return { kind: 'redirect', to: '/auth/waiting-for-approval' };
    }
    return PASS;
  }

  // Catch-all (root `/`, unmatched). Pass through; the page decides.
  return PASS;
}
