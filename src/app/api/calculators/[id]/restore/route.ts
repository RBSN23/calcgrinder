// PROJ-13 — POST /api/calculators/:id/restore
//
// Brings a soft-deleted calculator back. Sets `soft_delete_at = NULL`
// while preserving `published` and `public_token` so any previously-
// shared `/c/<token>` URLs resume serving content. If the calculator's
// original title now collides with an active row owned by the same
// user, the restored row is auto-suffixed via `resolveUniqueTitle`
// (same helper used by create + duplicate); the response body's
// `title` carries the new value so the client can toast the rename.
//
// Optimistic concurrency mirrors PROJ-10's PATCH/DELETE contract:
// stale `updated_at` → 409 `{ error: 'stale', server_updated_at }`.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveUniqueTitle } from '@/lib/calculators/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const ROW_COLUMNS =
  'id, title, description, theme_id, updated_at, published, public_token' as const;

type Ctx = { params: Promise<{ id: string }> };

const restoreSchema = z
  .object({
    updated_at: z.string().min(1),
  })
  .strip();

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

  const parsed = restoreSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { updated_at: staleUpdatedAt } = parsed.data;

  // Read the soft-deleted row to (a) confirm ownership + soft-delete
  // status (RLS gates ownership; the `NOT NULL` filter gates state)
  // and (b) capture the current title so we can resolve collisions
  // before the UPDATE runs.
  const { data: trashed, error: readErr } = await supabase
    .from('calculators')
    .select(`${ROW_COLUMNS}, soft_delete_at`)
    .eq('id', id)
    .not('soft_delete_at', 'is', null)
    .maybeSingle();

  if (readErr) {
    console.error(`POST /api/calculators/${id}/restore: read failed`, readErr);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!trashed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (trashed.updated_at !== staleUpdatedAt) {
    return NextResponse.json(
      { error: 'stale', server_updated_at: trashed.updated_at },
      { status: 409 },
    );
  }

  // Resolve title collision against the user's active rows. The
  // partial unique index on (owner_id, title) WHERE soft_delete_at IS
  // NULL excludes the trashed row itself, so the lookup naturally
  // returns the first free suffix without special-casing the row id.
  const resolvedTitle = await resolveUniqueTitle(
    supabase,
    user.id,
    trashed.title,
  );
  if (!resolvedTitle) {
    console.error(
      `POST /api/calculators/${id}/restore: title auto-resolve exhausted`,
    );
    return NextResponse.json(
      { error: 'title_resolution_exhausted' },
      { status: 500 },
    );
  }

  const renamed = resolvedTitle !== trashed.title;
  const updates: { soft_delete_at: null; title?: string } = {
    soft_delete_at: null,
  };
  if (renamed) updates.title = resolvedTitle;

  const { data: restored, error: updateErr } = await supabase
    .from('calculators')
    .update(updates)
    .eq('id', id)
    .eq('updated_at', staleUpdatedAt)
    .not('soft_delete_at', 'is', null)
    .select(ROW_COLUMNS)
    .maybeSingle();

  if (updateErr) {
    console.error(
      `POST /api/calculators/${id}/restore: update failed`,
      updateErr,
    );
    return NextResponse.json({ error: 'restore_failed' }, { status: 500 });
  }
  if (!restored) {
    // The row was modified between our read and our write (another
    // tab restored it, the cron purged it, etc.). Disambiguate.
    const { data: current } = await supabase
      .from('calculators')
      .select('updated_at, soft_delete_at')
      .eq('id', id)
      .maybeSingle();
    if (!current || current.soft_delete_at === null) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'stale', server_updated_at: current.updated_at },
      { status: 409 },
    );
  }

  return NextResponse.json({ ...restored, renamed });
}
