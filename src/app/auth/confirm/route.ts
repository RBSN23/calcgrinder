import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

/**
 * PROJ-3 — GET /auth/confirm
 *
 * Single handler for every Supabase Auth email-action callback:
 *   - type=signup    → user confirms their address on signup
 *   - type=recovery  → user clicks the password-reset link
 *   - type=email_change → user confirms a new email (PROJ-14)
 *
 * Reads `?token_hash=…&type=…&next=/foo` from the URL, calls
 * `supabase.auth.verifyOtp(...)`, and redirects to a sensible post-
 * callback page based on `type` (overridable via `next`).
 *
 * Failure modes converge on a single generic "link not valid" landing
 * implemented as `/auth/login?error=link_invalid` — the login page
 * renders the corresponding banner. Concrete failure detail (expired
 * vs. consumed vs. unknown) is deliberately not surfaced to the user.
 */
const ALLOWED_TYPES = new Set<EmailOtpType>([
  'signup',
  'recovery',
  'email_change',
  'invite',
  'magiclink',
]);

function defaultNext(type: EmailOtpType): string {
  switch (type) {
    case 'signup':
      return '/auth/waiting-for-approval';
    case 'recovery':
      return '/auth/reset-password';
    case 'email_change':
      // PROJ-14 will own this surface; redirect to settings once it
      // exists. For now we land on the dashboard which gates correctly.
      return '/dashboard';
    case 'invite':
    case 'magiclink':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');

  if (!token_hash || !type || !ALLOWED_TYPES.has(type)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.search = '?error=link_invalid';
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.search = '?error=link_invalid';
    return NextResponse.redirect(url);
  }

  // Path-traversal guard on `next`: must be a relative app path.
  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : defaultNext(type);

  const url = request.nextUrl.clone();
  const [pathname, search = ''] = next.split('?');
  url.pathname = pathname;
  url.search = search ? `?${search}` : '';
  return NextResponse.redirect(url);
}
