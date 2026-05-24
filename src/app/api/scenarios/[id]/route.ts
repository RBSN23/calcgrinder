// PROJ-12 — PUT + DELETE /api/scenarios/:id
//
// Owner-only update + hard-delete. RLS scopes both ops to
// `owner_id = auth.uid()`; cross-owner / missing-row both surface as
// 404 (opacity rule). PUT updates title / description / values; the
// `share_token` column is intentionally NOT writeable from this route —
// minting goes through /api/scenarios/:id/share, and the spec rules
// out token rotation outright (PRD non-goal: "Public scenario URL
// regeneration / revocation").
//
// No optimistic-concurrency `updated_at` echo on this surface — per
// edge-case AC: "Two browser tabs open on the same `?s=` URL. Concurrent
// overwrite is last-write-wins. No optimistic-concurrency check in v1."
//
// Per-user write rate-limit applies to both PUT and DELETE.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { checkScenarioWrite } from '@/lib/rate-limit';
import {
  MAX_SCENARIO_DESCRIPTION_LENGTH,
  MAX_SCENARIO_TITLE_LENGTH,
  validateScenarioTitle,
} from '@/lib/scenarios/types';

export const runtime = 'nodejs';

const SCENARIO_COLUMNS =
  'id, calculator_id, owner_id, title, description, values, share_token, created_at, updated_at' as const;

type Ctx = { params: Promise<{ id: string }> };

const putSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    values: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = putSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { title, description, values } = parsed.data;

  const updates: {
    title?: string;
    description?: string;
    values?: unknown;
  } = {};

  if (title !== undefined) {
    const titleResult = validateScenarioTitle(title);
    if (!titleResult.ok) {
      if (titleResult.reason === 'title_required') {
        return NextResponse.json({ error: 'title_required' }, { status: 400 });
      }
      return NextResponse.json(
        { error: 'title_too_long', max: MAX_SCENARIO_TITLE_LENGTH },
        { status: 400 },
      );
    }
    updates.title = titleResult.value;
  }
  if (description !== undefined) {
    if (description.length > MAX_SCENARIO_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: 'description_too_long', max: MAX_SCENARIO_DESCRIPTION_LENGTH },
        { status: 400 },
      );
    }
    updates.description = description;
  }
  if (values !== undefined) {
    updates.values = values;
  }

  if (Object.keys(updates).length === 0) {
    // Nothing to update — read the current row so the caller still
    // gets a fresh snapshot (consistent with the calculators PATCH
    // behaviour when only updated_at is sent).
    const { data: current, error: readErr } = await supabase
      .from('scenarios')
      .select(SCENARIO_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (readErr) {
      console.error(`PUT /api/scenarios/${id}: read failed`, readErr);
      return NextResponse.json({ error: 'read_failed' }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json(current);
  }

  const { data: updated, error: updateErr } = await supabase
    .from('scenarios')
    .update(updates as never)
    .eq('id', id)
    .select(SCENARIO_COLUMNS)
    .maybeSingle();

  if (updateErr) {
    if ((updateErr as { code?: unknown }).code === '23514') {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    console.error(`PUT /api/scenarios/${id}: update failed`, updateErr);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  if (!updated) {
    // RLS-rejected, missing, or cross-owner — opacity rule collapses
    // all three into 404.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: Ctx,
): Promise<Response> {
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

  // Hard-delete with id selection so we can disambiguate 404 vs success
  // in one round-trip (RLS rejection returns 0 rows).
  const { data, error } = await supabase
    .from('scenarios')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`DELETE /api/scenarios/${id}: delete failed`, error);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
