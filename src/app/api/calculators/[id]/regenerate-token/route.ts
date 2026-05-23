// PROJ-10 — POST /api/calculators/:id/regenerate-token
//
// Owner-only token rotation. Overwrites public_token with a fresh 22-char
// URL-safe base64 string (~128 bits of entropy from Node's
// crypto.randomBytes(16)). The token alphabet matches the migration's
// pgcrypto-backed DEFAULT — old / default-minted / regenerated tokens
// are visually indistinguishable in the URL.
//
// Carries the same optimistic-concurrency contract as PATCH: client
// echoes `updated_at`; stale value rejects with 409 { error: 'stale' };
// success returns the updated row + the bumped updated_at.

import { randomBytes } from 'node:crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const ROW_COLUMNS =
  'id, title, description, theme_id, updated_at, published, public_token' as const;

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    updated_at: z.string().min(1),
  })
  .strip();

function mintToken(): string {
  return randomBytes(16).toString('base64url');
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { updated_at: staleUpdatedAt } = parsed.data;

  const newToken = mintToken();

  const { data: updated, error: updateErr } = await supabase
    .from('calculators')
    .update({ public_token: newToken })
    .eq('id', id)
    .eq('updated_at', staleUpdatedAt)
    .is('soft_delete_at', null)
    .select(ROW_COLUMNS)
    .maybeSingle();

  if (updateErr) {
    console.error(
      `POST /api/calculators/${id}/regenerate-token: update failed`,
      updateErr,
    );
    return NextResponse.json({ error: 'regenerate_failed' }, { status: 500 });
  }
  if (updated) {
    return NextResponse.json(updated);
  }

  // Disambiguate 404 vs 409.
  const { data: current, error: readErr } = await supabase
    .from('calculators')
    .select('updated_at')
    .eq('id', id)
    .is('soft_delete_at', null)
    .maybeSingle();

  if (readErr) {
    console.error(
      `POST /api/calculators/${id}/regenerate-token: read-after-miss failed`,
      readErr,
    );
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(
    { error: 'stale', server_updated_at: current.updated_at },
    { status: 409 },
  );
}
