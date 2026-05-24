// PROJ-16 — PATCH + DELETE /api/text_blocks/:id
//
// Owner-only mutations.
//
// PATCH carries the calculator-level optimistic-concurrency token via the
// `updated_at` field on the body. A stale value returns 409 + the server's
// current updated_at, same shape PROJ-8/9/15 established.
//
// Writable fields: body + the six card-level visual columns
// (card_accent, card_background_tint, card_border, card_size_hint,
// text_size, text_colour) + display_order. The body is byte-capped at
// MAX_TEXT_BLOCK_BODY_BYTES (50 KB UTF-8) before the database is touched.
//
// Reorders are within-section only via `display_order`; cross-section
// moves (`section_id` in body) are rejected with 422
// `cross_section_move_unsupported`.
//
// DELETE is hard; PROJ-13's soft-delete is calculator-level. Surviving
// siblings in the same section are re-packed (display_order shifted
// down) so the section stays gap-free.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { validateTextBlockBody } from '@/lib/text-blocks/validation';
import { textBlocksTable } from '@/lib/text-blocks/server';

export const runtime = 'nodejs';

const TEXT_BLOCK_COLUMNS =
  'id, calculator_id, section_id, body, card_accent, card_background_tint, card_border, card_size_hint, text_size, text_colour, display_order, created_at, updated_at' as const;

const patchSchema = z
  .object({
    updated_at: z.string().min(1),
    body: z.string().optional(),
    card_accent: z.string().optional(),
    card_background_tint: z.enum(['none', 'soft', 'strong']).optional(),
    card_border: z.enum(['none', 'hairline', 'strong']).optional(),
    card_size_hint: z.enum(['narrow', 'wide', 'full']).optional(),
    text_size: z.enum(['s', 'm', 'l', 'xl']).optional(),
    text_colour: z.enum(['default', 'accent_1', 'accent_2']).optional(),
    display_order: z.number().int().min(0).optional(),
    // Cross-section moves rejected at the API in v1.
    section_id: z.string().uuid().optional(),
  })
  .strip();

type Ctx = { params: Promise<{ id: string }> };

interface TextBlockRowDB {
  id: string;
  calculator_id: string;
  section_id: string;
  body: string;
  card_accent: string;
  card_background_tint: 'none' | 'soft' | 'strong';
  card_border: 'none' | 'hairline' | 'strong';
  card_size_hint: 'narrow' | 'wide' | 'full';
  text_size: 's' | 'm' | 'l' | 'xl';
  text_colour: 'default' | 'accent_1' | 'accent_2';
  display_order: number;
  created_at: string;
  updated_at: string;
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id: blockId } = await params;
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
  const { updated_at: staleUpdatedAt, ...patch } = parsed.data;

  // Reject cross-section moves (v1).
  if (patch.section_id !== undefined) {
    return NextResponse.json(
      { error: 'cross_section_move_unsupported' },
      { status: 422 },
    );
  }

  // Body byte-cap pre-check (50 KB UTF-8 backstop). Must happen before any
  // DB write — spec says "before touching the database."
  if (patch.body !== undefined) {
    const bv = validateTextBlockBody(patch.body);
    if (!bv.ok) {
      return NextResponse.json(bv.body, { status: bv.status });
    }
  }

  // Load the text block (RLS-bound).
  const { data: currentRaw } = await textBlocksTable(supabase)
    .select(TEXT_BLOCK_COLUMNS)
    .eq('id', blockId)
    .maybeSingle();
  if (!currentRaw) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const current = currentRaw as TextBlockRowDB;

  const { data: calculator } = await supabase
    .from('calculators')
    .select('id, updated_at')
    .eq('id', current.calculator_id)
    .is('soft_delete_at', null)
    .maybeSingle();
  if (!calculator) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (calculator.updated_at !== staleUpdatedAt) {
    return NextResponse.json(
      { error: 'stale', server_updated_at: calculator.updated_at },
      { status: 409 },
    );
  }

  // Build the partial UPDATE patch.
  const updates: Record<string, unknown> = {};
  if (patch.body !== undefined) updates.body = patch.body;
  if (patch.card_accent !== undefined) updates.card_accent = patch.card_accent;
  if (patch.card_background_tint !== undefined)
    updates.card_background_tint = patch.card_background_tint;
  if (patch.card_border !== undefined) updates.card_border = patch.card_border;
  if (patch.card_size_hint !== undefined)
    updates.card_size_hint = patch.card_size_hint;
  if (patch.text_size !== undefined) updates.text_size = patch.text_size;
  if (patch.text_colour !== undefined) updates.text_colour = patch.text_colour;

  // Reorder: walk siblings within the same section. Same algorithm as the
  // chart PATCH route — park current at a temp slot, then shift the
  // affected range up/down, then settle current at the target.
  const reorderRequested =
    patch.display_order !== undefined &&
    patch.display_order !== current.display_order;
  if (reorderRequested) {
    const { data: siblings, error: sibErr } = await textBlocksTable(supabase)
      .select('id, display_order')
      .eq('section_id', current.section_id)
      .order('display_order', { ascending: true });
    if (sibErr) {
      console.error('PATCH text_block: sibling read failed', sibErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    const all = (siblings ?? []) as Array<{ id: string; display_order: number }>;
    const target = Math.max(0, Math.min(all.length - 1, patch.display_order!));

    const temp = all.length + 1;
    const { error: parkErr } = await textBlocksTable(supabase)
      .update({ display_order: temp })
      .eq('id', blockId);
    if (parkErr) {
      console.error('PATCH text_block: park failed', parkErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    if (target > current.display_order) {
      const shifting = all
        .filter(
          (s) =>
            s.id !== blockId &&
            s.display_order > current.display_order &&
            s.display_order <= target,
        )
        .sort((a, b) => a.display_order - b.display_order);
      for (const row of shifting) {
        const { error } = await textBlocksTable(supabase)
          .update({ display_order: row.display_order - 1 })
          .eq('id', row.id);
        if (error) {
          console.error('PATCH text_block: shift down failed', error);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
      }
    } else {
      const shifting = all
        .filter(
          (s) =>
            s.id !== blockId &&
            s.display_order >= target &&
            s.display_order < current.display_order,
        )
        .sort((a, b) => b.display_order - a.display_order);
      for (const row of shifting) {
        const { error } = await textBlocksTable(supabase)
          .update({ display_order: row.display_order + 1 })
          .eq('id', row.id);
        if (error) {
          console.error('PATCH text_block: shift up failed', error);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
      }
    }
    updates.display_order = target;
  }

  let lastBumpAt: string = calculator.updated_at;

  if (Object.keys(updates).length > 0) {
    const { data: updated, error: updErr } = await textBlocksTable(supabase)
      .update(updates)
      .eq('id', blockId)
      .select('updated_at')
      .single();
    if (updErr) {
      console.error('PATCH text_block: update failed', updErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    const u = updated as { updated_at?: string } | null;
    if (u?.updated_at) lastBumpAt = u.updated_at;
  }

  const { data: refreshed } = await textBlocksTable(supabase)
    .select(TEXT_BLOCK_COLUMNS)
    .eq('id', blockId)
    .maybeSingle();
  if (!refreshed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    text_block: refreshed,
    calculator_updated_at: lastBumpAt,
  });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const { id: blockId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: block } = await textBlocksTable(supabase)
    .select('id, calculator_id, section_id, display_order')
    .eq('id', blockId)
    .maybeSingle();
  if (!block) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const blockRow = block as {
    id: string;
    calculator_id: string;
    section_id: string;
    display_order: number;
  };

  const { data: calculator } = await supabase
    .from('calculators')
    .select('id')
    .eq('id', blockRow.calculator_id)
    .is('soft_delete_at', null)
    .maybeSingle();
  if (!calculator) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error: deleteErr } = await textBlocksTable(supabase)
    .delete()
    .eq('id', blockId);
  if (deleteErr) {
    console.error('DELETE text_block: failed', deleteErr);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  // Re-pack display_order on the surviving siblings.
  const { data: surviving } = await textBlocksTable(supabase)
    .select('id, display_order')
    .eq('section_id', blockRow.section_id)
    .gt('display_order', blockRow.display_order)
    .order('display_order', { ascending: true });
  for (const row of (surviving ?? []) as Array<{
    id: string;
    display_order: number;
  }>) {
    const { error } = await textBlocksTable(supabase)
      .update({ display_order: row.display_order - 1 })
      .eq('id', row.id);
    if (error) {
      console.error('DELETE text_block: repack failed', error);
      break;
    }
  }

  // Echo the bumped calculator.updated_at. Keeps response shape consistent
  // with PATCH/POST.
  const { data: bumped } = await supabase
    .from('calculators')
    .select('updated_at')
    .eq('id', blockRow.calculator_id)
    .maybeSingle();

  return NextResponse.json({
    calculator_updated_at: bumped?.updated_at ?? null,
  });
}
