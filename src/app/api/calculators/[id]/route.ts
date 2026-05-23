// PROJ-8 — GET + PATCH /api/calculators/:id
//
// Owner-only read + update. The 404 opacity rule collapses three branches
// (not yours / not found / soft-deleted) into a single response so an
// attacker cannot enumerate IDs across owners.
//
// PATCH carries optimistic concurrency via the client-echoed updated_at:
// a stale value rejects with 409 + the server's current updated_at so
// the client can surface "reload to retry" (PROJ-8) or a banner (PROJ-20).

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { MAX_TITLE_LENGTH, validateTitle } from '@/lib/calculators/types';

export const runtime = 'nodejs';

const ROW_COLUMNS = 'id, title, description, theme_id, updated_at' as const;

type Ctx = { params: Promise<{ id: string }> };

// Strip — not strict — so unknown keys (`published`, `public_token`,
// `owner_id`, `soft_delete_at`, `created_at`, `id`, `updated_at` in the
// update slot, etc.) are silently dropped, per the spec's whitelist AC.
const patchSchema = z
  .object({
    updated_at: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    theme_id: z.string().optional(),
  })
  .strip();

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('calculators')
    .select(ROW_COLUMNS)
    .eq('id', id)
    .is('soft_delete_at', null)
    .maybeSingle();

  if (error) {
    console.error(`GET /api/calculators/${id}: select failed`, error);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
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

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { updated_at: staleUpdatedAt, title, description, theme_id } = parsed.data;

  const updates: { title?: string; description?: string; theme_id?: string } = {};

  if (title !== undefined) {
    const validation = validateTitle(title);
    if (!validation.ok) {
      const status = 400;
      if (validation.reason === 'title_required') {
        return NextResponse.json({ error: 'title_required' }, { status });
      }
      return NextResponse.json(
        { error: 'title_too_long', max: MAX_TITLE_LENGTH },
        { status },
      );
    }
    updates.title = validation.value;
  }
  if (description !== undefined) updates.description = description;
  if (theme_id !== undefined) updates.theme_id = theme_id;

  // Happy path: a stale-checked UPDATE that returns the new row in one
  // round-trip when everything lines up.
  if (Object.keys(updates).length > 0) {
    const { data: updated, error: updateErr } = await supabase
      .from('calculators')
      .update(updates)
      .eq('id', id)
      .eq('updated_at', staleUpdatedAt)
      .is('soft_delete_at', null)
      .select(ROW_COLUMNS)
      .maybeSingle();

    if (updateErr) {
      console.error(`PATCH /api/calculators/${id}: update failed`, updateErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    if (updated) {
      return NextResponse.json(updated);
    }
    // Fall through to disambiguate 404 vs 409.
  }

  // Either the UPDATE matched 0 rows (RLS-rejected, missing, soft-deleted,
  // or stale) or there was nothing to update. SELECT to figure out which.
  const { data: current, error: readErr } = await supabase
    .from('calculators')
    .select(ROW_COLUMNS)
    .eq('id', id)
    .is('soft_delete_at', null)
    .maybeSingle();

  if (readErr) {
    console.error(`PATCH /api/calculators/${id}: read-after-miss failed`, readErr);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (current.updated_at !== staleUpdatedAt) {
    return NextResponse.json(
      { error: 'stale', server_updated_at: current.updated_at },
      { status: 409 },
    );
  }

  // Stale value matched and no field needed updating — return current row.
  return NextResponse.json(current);
}
