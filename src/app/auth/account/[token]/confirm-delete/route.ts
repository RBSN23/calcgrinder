import { NextResponse, type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const RETENTION_DAYS = Number(process.env.RETENTION_PERIOD_DAYS) || 30;

// 43-char base64url tokens. Mirrors PROJ-3's `signup_approvals.token`
// shape — see `src/lib/auth/token.ts`.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

type LandingVariant =
  | 'scheduled'
  | 'already_scheduled'
  | 'cancelled'
  | 'unknown';

type Glyph = 'trash' | 'check' | 'x';

const GLYPH_PATHS: Record<Glyph, string> = {
  trash:
    '<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>',
  check: '<path d="M5 12l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
};

function landingHtml(
  variant: LandingVariant,
  deletionDate?: string,
): string {
  let title: string;
  let body: string;
  let glyph: Glyph;

  switch (variant) {
    case 'scheduled':
      title = 'Deletion scheduled';
      body = `Your account is scheduled for deletion on ${deletionDate}. Until then, sign back in to cancel.`;
      glyph = 'trash';
      break;
    case 'already_scheduled':
      title = 'Already scheduled';
      body = `Your account is already scheduled for deletion on ${deletionDate}. Sign back in to cancel.`;
      glyph = 'trash';
      break;
    case 'cancelled':
      title = 'This deletion request has been cancelled';
      body = 'Your account is no longer scheduled for deletion.';
      glyph = 'check';
      break;
    case 'unknown':
    default:
      title = 'This link is not valid';
      body = 'The deletion link is missing or expired.';
      glyph = 'x';
      break;
  }

  return renderLandingPage({ title, body, glyph });
}

function renderLandingPage({
  title,
  body,
  glyph,
}: {
  title: string;
  body: string;
  glyph: Glyph;
}): string {

  // Self-contained server-rendered HTML — this route handler intentionally
  // doesn't render a React page (it's a GET-with-side-effects + landing).
  // The styling apes the AuthShell so the visual register matches the
  // rest of the auth surface.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} · Calcgrinder</title>
    <style>
      :root {
        color-scheme: light dark;
        --fg: #1c1917;
        --fg-muted: #78716c;
        --bg: #fafaf9;
        --surface: #ffffff;
        --border: #e7e5e4;
        --accent: #4f46e5;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --fg: #f5f5f4;
          --fg-muted: #a8a29e;
          --bg: #0c0a09;
          --surface: #161412;
          --border: #292524;
          --accent: #818cf8;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 0;
        background: var(--bg); color: var(--fg);
        font-family: -apple-system, system-ui, sans-serif;
        min-height: 100vh;
      }
      .shell { max-width: 360px; margin: 0 auto; padding: 88px 24px 24px; }
      .wordmark { display: flex; align-items: center; gap: 10px; margin-bottom: 48px; }
      .wordmark .badge {
        width: 28px; height: 28px; border-radius: 6px;
        background: var(--fg); color: var(--bg);
        font-family: ui-monospace, "SF Mono", monospace;
        font-weight: 600; font-size: 16px;
        display: flex; align-items: center; justify-content: center;
      }
      .wordmark .name { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
      .glyph {
        margin: 0 auto 20px;
        width: 64px; height: 64px; border-radius: 50%;
        background: rgba(120, 113, 108, 0.12); color: var(--fg-muted);
        display: flex; align-items: center; justify-content: center;
      }
      h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.3px; margin: 0 0 8px; text-align: center; }
      p  { font-size: 14px; color: var(--fg-muted); margin: 0; text-align: center; line-height: 1.5; }
      .foot { margin-top: 32px; text-align: center; font-size: 13px; }
      .foot a { color: var(--accent); text-decoration: none; }
      .foot a:hover { opacity: 0.8; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="wordmark">
        <div class="badge">c</div>
        <div class="name">Calcgrinder</div>
      </div>
      <div class="glyph" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.75"
             stroke-linecap="round" stroke-linejoin="round">
          ${GLYPH_PATHS[glyph]}
        </svg>
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
      <div class="foot">
        <a href="/auth/login">Back to login &rarr;</a>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlResponse(body: string, status: number): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function formatDate(iso: string, retentionDays: number): string {
  const start = new Date(iso);
  const deletionAt = new Date(start.getTime() + retentionDays * 86_400_000);
  return deletionAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * PROJ-14 — GET /auth/account/[token]/confirm-delete
 *
 * Token IS the auth (no session check). Branches:
 *   - unknown / malformed token → 404 + generic "not valid" landing
 *   - cancelled token           → 200 + "cancelled" landing
 *   - already consumed token    → 200 + "already scheduled" landing
 *   - fresh token               → transactionally mutates state +
 *                                 200 + "scheduled" landing
 *
 * Mutation on fresh token:
 *   - account_deletion_requests.consumed_at = NOW()
 *   - profiles.status = 'pending_deletion'
 *   - profiles.pending_deletion_at = NOW()
 *
 * No email is sent from this branch — the user already received the
 * scheduled-deletion confirmation before clicking. Re-clicks are
 * idempotent (no DB write, read-back landing).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;

  if (!token || !TOKEN_SHAPE.test(token)) {
    return htmlResponse(landingHtml('unknown'), 404);
  }

  const admin = createAdminClient();

  const { data: row, error: fetchError } = await admin
    .from('account_deletion_requests')
    .select('id, user_id, consumed_at, cancelled_at')
    .eq('token', token)
    .maybeSingle();

  if (fetchError) {
    console.error('confirm-delete: lookup failed', fetchError);
    return htmlResponse(landingHtml('unknown'), 500);
  }

  if (!row) {
    return htmlResponse(landingHtml('unknown'), 404);
  }

  if (row.cancelled_at) {
    return htmlResponse(landingHtml('cancelled'), 200);
  }

  if (row.consumed_at) {
    // Re-click of an already-consumed token: read the profile's
    // pending_deletion_at to surface the same date the user already saw.
    const { data: profile } = await admin
      .from('profiles')
      .select('pending_deletion_at')
      .eq('id', row.user_id)
      .single();
    const date = profile?.pending_deletion_at
      ? formatDate(profile.pending_deletion_at, RETENTION_DAYS)
      : 'soon';
    return htmlResponse(landingHtml('already_scheduled', date), 200);
  }

  // Fresh token — commit the transition. Two writes, profile first (the
  // authoritative state) then mark the request consumed.
  const now = new Date().toISOString();
  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      status: 'pending_deletion',
      pending_deletion_at: now,
    })
    .eq('id', row.user_id);

  if (profileErr) {
    console.error('confirm-delete: profile mutate failed', profileErr);
    return htmlResponse(landingHtml('unknown'), 500);
  }

  await admin
    .from('account_deletion_requests')
    .update({ consumed_at: now })
    .eq('id', row.id);

  return htmlResponse(
    landingHtml('scheduled', formatDate(now, RETENTION_DAYS)),
    200,
  );
}
