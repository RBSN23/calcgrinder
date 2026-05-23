// PROJ-8 + PROJ-10 — GET + PATCH + DELETE /api/calculators/:id
//
// Owner-only read + update + soft-delete. The 404 opacity rule collapses
// three branches (not yours / not found / soft-deleted) into a single
// response so an attacker cannot enumerate IDs across owners.
//
// PATCH carries optimistic concurrency via the client-echoed updated_at:
// a stale value rejects with 409 + the server's current updated_at so
// the client can surface "reload to retry" (PROJ-8) or a banner (PROJ-20).
//
// PROJ-10 additions:
//   * Whitelist extended with `published: boolean`.
//   * 23505 unique-violation on (owner_id, title) maps to 409
//     { error: 'title_taken' } — distinct from the 409 'stale' contract.
//   * DELETE soft-deletes the row (sets soft_delete_at = NOW()); recovery
//     lives in PROJ-13.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { MAX_TITLE_LENGTH, validateTitle } from '@/lib/calculators/types';

export const runtime = 'nodejs';

const ROW_COLUMNS =
  'id, title, description, theme_id, updated_at, published, public_token' as const;

type Ctx = { params: Promise<{ id: string }> };

// Strip — not strict — so unknown keys (`public_token`, `owner_id`,
// `soft_delete_at`, `created_at`, `id`, `updated_at` in the update slot,
// etc.) are silently dropped, per the spec's whitelist AC.
const patchSchema = z
  .object({
    updated_at: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    theme_id: z.string().optional(),
    // PROJ-10: extended whitelist — publish toggle rides on PATCH so it
    // shares the same optimistic-concurrency contract as other edits.
    published: z.boolean().optional(),
  })
  .strip();

const deleteSchema = z
  .object({
    updated_at: z.string().min(1),
  })
  .strip();

function isUniqueTitleViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (code !== '23505') return false;
  // Disambiguate from the public_token unique index (also 23505 — vanishingly
  // unlikely but theoretically possible). The partial unique index on
  // (owner_id, title) is the only one with that name; the message / details
  // surface the constraint name.
  const details = String((err as { details?: unknown }).details ?? '');
  const message = String((err as { message?: unknown }).message ?? '');
  return (
    details.includes('owner_id') ||
    message.includes('idx_calculators_owner_title_active') ||
    // Defensive: when neither field carries the index name, fall back to
    // treating any 23505 on calculators as title collision — public_token
    // collisions are astronomically improbable from a 128-bit token.
    (details === '' && message === '')
  );
}

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
  const {
    updated_at: staleUpdatedAt,
    title,
    description,
    theme_id,
    published,
  } = parsed.data;

  const updates: {
    title?: string;
    description?: string;
    theme_id?: string;
    published?: boolean;
  } = {};

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
  if (published !== undefined) updates.published = published;

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
      if (isUniqueTitleViolation(updateErr)) {
        return NextResponse.json({ error: 'title_taken' }, { status: 409 });
      }
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

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
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

  const parsed = deleteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { updated_at: staleUpdatedAt } = parsed.data;

  // Stale-checked soft-delete. NOW() bumps via DB; the trigger refreshes
  // updated_at to the new timestamp.
  const { data: updated, error: updateErr } = await supabase
    .from('calculators')
    .update({ soft_delete_at: new Date().toISOString() })
    .eq('id', id)
    .eq('updated_at', staleUpdatedAt)
    .is('soft_delete_at', null)
    .select('updated_at')
    .maybeSingle();

  if (updateErr) {
    console.error(`DELETE /api/calculators/${id}: update failed`, updateErr);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
  if (updated) {
    return NextResponse.json({ updated_at: updated.updated_at });
  }

  // Disambiguate 404 vs 409 (stale).
  const { data: current, error: readErr } = await supabase
    .from('calculators')
    .select('updated_at')
    .eq('id', id)
    .is('soft_delete_at', null)
    .maybeSingle();

  if (readErr) {
    console.error(`DELETE /api/calculators/${id}: read-after-miss failed`, readErr);
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
