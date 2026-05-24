// PROJ-12 — POST /api/scenarios/:id/share
//
// Lazy-mint a share_token for a scenario. Idempotent:
//   * If `share_token IS NULL`, mint a fresh 22-char URL-safe base64
//     token (same alphabet / entropy as calculators.public_token —
//     ~128 bits via Node's crypto.randomBytes(16).toString('base64url'))
//     and persist it.
//   * If `share_token` already exists, reuse it.
//
// Returns `{ share_token, url }`. The URL is composed live every call so
// a calculator's `public_token` regen between two Copy-link presses is
// reflected automatically (previously-distributed URLs are broken — per
// spec line 814–817, expected).
//
// Defence-in-depth: the route checks owner_id matches auth.uid() before
// the mint, so a non-owner with the scenario id (somehow obtained) gets
// 403 — RLS would already prevent the write, but this surfaces the
// failure mode cleanly. The defence is layered with the owner-only RLS
// policy on UPDATE.
//
// Per-user write rate-limit applies.

import { randomBytes } from 'node:crypto';

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { checkScenarioWrite } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function mintToken(): string {
  return randomBytes(16).toString('base64url');
}

export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rate = await checkScenarioWrite(user.id);
  if (!rate.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Read the scenario first so we can branch on existing token + check
  // ownership explicitly (defence in depth alongside RLS).
  const { data: existing, error: readErr } = await supabase
    .from('scenarios')
    .select('id, owner_id, share_token, calculator_id')
    .eq('id', id)
    .maybeSingle();

  if (readErr) {
    console.error(`POST /api/scenarios/${id}/share: read failed`, readErr);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  // Explicit non-owner check. RLS already restricts SELECT to owners,
  // so reaching here with a different owner_id is impossible — but
  // the AC requires the 403 surface for clarity, and the assertion
  // protects against future RLS regressions.
  if (existing.owner_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (existing.calculator_id == null) {
    // Orphan scenario — the calculator was hard-deleted. Cannot mint
    // because the share URL would never resolve. Surface as 404.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let token = existing.share_token;
  if (!token) {
    token = mintToken();
    // On the astronomically unlikely chance the token collides with an
    // existing one, the unique index raises 23505 — retry once.
    let updateErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await supabase
        .from('scenarios')
        .update({ share_token: token } as never)
        .eq('id', id)
        .is('share_token', null);
      if (!error) {
        updateErr = null;
        break;
      }
      updateErr = error;
      if ((error as { code?: unknown }).code !== '23505') break;
      token = mintToken();
    }
    if (updateErr) {
      // Re-read in case a concurrent request just minted a token.
      const { data: refreshed } = await supabase
        .from('scenarios')
        .select('share_token')
        .eq('id', id)
        .maybeSingle();
      if (refreshed?.share_token) {
        token = refreshed.share_token;
      } else {
        console.error(
          `POST /api/scenarios/${id}/share: mint failed`,
          updateErr,
        );
        return NextResponse.json({ error: 'mint_failed' }, { status: 500 });
      }
    }
  }

  // Resolve the calculator's CURRENT public_token. This may differ from
  // the token in any previously-distributed URL (PROJ-10 regen).
  const { data: calc, error: calcErr } = await supabase
    .from('calculators')
    .select('public_token')
    .eq('id', existing.calculator_id)
    .maybeSingle();

  if (calcErr || !calc?.public_token) {
    // The calculator was hard-deleted between the scenario read and the
    // public_token resolve. The token-mint persisted but is now
    // un-usable — return 404 so the client surfaces the orphan state.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const origin = resolveOrigin();
  const url = `${origin}/c/${calc.public_token}?s=${token}`;
  return NextResponse.json({ share_token: token, url });
}

/**
 * Resolve the public origin for the share URL. Prefers the explicit
 * NEXT_PUBLIC_SITE_URL env var (set on Vercel for both Preview and
 * Production), then VERCEL_URL (Vercel-injected hostname without scheme),
 * then a sane localhost default. The lazy fallback keeps local dev /
 * test runs working without env setup.
 */
function resolveOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
