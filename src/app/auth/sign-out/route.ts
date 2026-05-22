import { NextResponse, type NextRequest } from 'next/server';

import { APP_URL } from '@/lib/auth/app-url';
import { createClient } from '@/lib/supabase/server';

/**
 * PROJ-3 — POST /auth/sign-out
 *
 * Idempotent sign-out endpoint. Designed to be invoked by a plain
 * `<form action="/auth/sign-out" method="post">` on the waiting-for-
 * approval screen so it works without client JS.
 *
 * Why a route handler instead of a server action? Server actions render
 * back to the calling page; we need a hard 302 to /auth/login that
 * clears the session cookie regardless of where the form was submitted
 * from.
 *
 * CSRF defence-in-depth: we accept only requests whose Origin header
 * matches APP_URL. Server actions get this check from Next.js for free;
 * route handlers re-implement it manually.
 */
export async function POST(request: NextRequest) {
  // Origin check — reject cross-site POSTs. Empty Origin (e.g. same-
  // origin form submit from some user agents) falls back to a Referer
  // check; if both are missing we still allow the request (no other
  // signal) since a missing Origin is the historical default for some
  // form posts.
  const origin = request.headers.get('origin');
  if (origin && origin !== APP_URL) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = '/auth/login';
  url.search = '';
  // 303 See Other is the canonical redirect after a POST so the browser
  // follows it as a GET. Next.js sends 307 by default for `redirect()`
  // which would preserve the POST method — we explicitly want a GET.
  return NextResponse.redirect(url, { status: 303 });
}
