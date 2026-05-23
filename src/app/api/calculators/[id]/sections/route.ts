// PROJ-9 — POST /api/calculators/:id/sections
//
// Owner-only section creation. Inserts a new sections row scoped to the
// parent calculator. `after_section_id` controls placement: when null
// (the default), the new section appends after the last existing
// section; when provided, the new section is placed immediately after
// that sibling and following siblings are renumbered transactionally.
//
// Ownership is enforced by Row-Level Security on the sections table
// (it joins through public.calculators to auth.uid()). A non-owner
// hits an opaque 404 — same convention as the calculator routes.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  MAX_SECTION_TITLE_LENGTH,
  NEW_SECTION_TITLE,
  validateSectionTitle,
} from '@/lib/sections/types';

export const runtime = 'nodejs';

const SECTION_COLUMNS =
  'id, calculator_id, title, description, layout_pattern_id, display_order, created_at, updated_at' as const;

const postSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    layout_pattern_id: z.string().optional(),
    after_section_id: z.string().uuid().nullable().optional(),
    // Optional explicit id for undo-driven recreates.
    id: z.string().uuid().optional(),
  })
  .strip();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id: calculatorId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let rawBody: unknown = {};
  try {
    const text = await req.text();
    if (text.length > 0) rawBody = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const body = parsed.data;

  // Confirm the calculator exists and the caller owns it (RLS-bound
  // SELECT). Returns 404 for any failure to keep IDs opaque.
  const { data: calculator } = await supabase
    .from('calculators')
    .select('id')
    .eq('id', calculatorId)
    .is('soft_delete_at', null)
    .maybeSingle();
  if (!calculator) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Title: default to NEW_SECTION_TITLE; validate length.
  let title = NEW_SECTION_TITLE;
  if (body.title !== undefined) {
    const v = validateSectionTitle(body.title);
    if (!v.ok) {
      return NextResponse.json(
        v.reason === 'title_too_long'
          ? { error: 'title_too_long', max: MAX_SECTION_TITLE_LENGTH }
          : { error: 'title_required' },
        { status: 400 },
      );
    }
    title = v.value;
  }

  // Compute the desired display_order.
  const { data: siblings, error: siblingsErr } = await supabase
    .from('sections')
    .select('id, display_order')
    .eq('calculator_id', calculatorId)
    .order('display_order', { ascending: true });
  if (siblingsErr) {
    console.error('POST sections: sibling read failed', siblingsErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
  const existing = siblings ?? [];

  let insertOrder: number;
  if (body.after_section_id == null) {
    insertOrder = existing.length;
  } else {
    const anchor = existing.find((s) => s.id === body.after_section_id);
    if (!anchor) {
      return NextResponse.json(
        { error: 'after_section_not_found' },
        { status: 422 },
      );
    }
    insertOrder = anchor.display_order + 1;
    // Renumber everyone at or after insertOrder.
    const toShift = existing.filter((s) => s.display_order >= insertOrder);
    for (let i = toShift.length - 1; i >= 0; i--) {
      const row = toShift[i];
      const { error: shiftErr } = await supabase
        .from('sections')
        .update({ display_order: row.display_order + 1 })
        .eq('id', row.id);
      if (shiftErr) {
        console.error('POST sections: shift failed', shiftErr);
        return NextResponse.json({ error: 'create_failed' }, { status: 500 });
      }
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('sections')
    .insert({
      ...(body.id ? { id: body.id } : {}),
      calculator_id: calculatorId,
      title,
      description: body.description ?? '',
      layout_pattern_id: body.layout_pattern_id ?? 'single_column',
      display_order: insertOrder,
    })
    .select(SECTION_COLUMNS)
    .single();

  if (insertErr || !inserted) {
    console.error('POST sections: insert failed', insertErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  // Re-read calculator.updated_at — the section insert bumped it via
  // trigger, and the client needs the fresh value to send a non-stale
  // optimistic-concurrency token on the next mutation.
  const { data: bumped } = await supabase
    .from('calculators')
    .select('updated_at')
    .eq('id', calculatorId)
    .maybeSingle();

  return NextResponse.json(
    { section: inserted, calculator_updated_at: bumped?.updated_at ?? null },
    { status: 201 },
  );
}
