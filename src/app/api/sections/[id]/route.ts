// PROJ-9 — PATCH + DELETE /api/sections/:id
//
// Owner-only mutations. PATCH carries the same optimistic-concurrency
// shape as PATCH /api/calculators/:id: the client echoes the parent
// calculator's `updated_at`; a stale value rejects with 409 and the
// server's current updated_at.
//
// DELETE refuses to delete the last remaining section (a calculator
// must always have at least one section). When the section has
// children, the caller must opt in via
// `?confirm_delete_with_children=true`; otherwise the route returns
// 409 with the child count so the client can surface its bottom-sheet
// confirmation.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  MAX_SECTION_TITLE_LENGTH,
  validateSectionTitle,
} from '@/lib/sections/types';

export const runtime = 'nodejs';

const SECTION_COLUMNS =
  'id, calculator_id, title, description, layout_pattern_id, display_order, created_at, updated_at' as const;

const patchSchema = z
  .object({
    updated_at: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    layout_pattern_id: z.string().optional(),
    display_order: z.number().int().min(0).optional(),
  })
  .strip();

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id: sectionId } = await params;
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
    layout_pattern_id,
    display_order,
  } = parsed.data;

  // Load the section + its calculator (RLS-bound) to confirm ownership
  // and to discover whether the requested display_order needs a
  // renumber pass.
  const { data: section } = await supabase
    .from('sections')
    .select(SECTION_COLUMNS)
    .eq('id', sectionId)
    .maybeSingle();
  if (!section) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: calculator } = await supabase
    .from('calculators')
    .select('id, updated_at')
    .eq('id', section.calculator_id)
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

  const updates: {
    title?: string;
    description?: string;
    layout_pattern_id?: string;
  } = {};

  if (title !== undefined) {
    const v = validateSectionTitle(title);
    if (!v.ok) {
      return NextResponse.json(
        v.reason === 'title_too_long'
          ? { error: 'title_too_long', max: MAX_SECTION_TITLE_LENGTH }
          : { error: 'title_required' },
        { status: 400 },
      );
    }
    updates.title = v.value;
  }
  if (description !== undefined) updates.description = description;
  if (layout_pattern_id !== undefined)
    updates.layout_pattern_id = layout_pattern_id;

  // Reorder: renumber siblings transactionally so display_order stays
  // gap-free. The unique constraint on (calculator_id, display_order)
  // is DEFERRABLE INITIALLY DEFERRED, but Supabase REST runs each
  // update as a separate statement — we sidestep collisions by
  // walking siblings in the direction that frees the slot first.
  if (display_order !== undefined && display_order !== section.display_order) {
    const { data: siblings, error: sibErr } = await supabase
      .from('sections')
      .select('id, display_order')
      .eq('calculator_id', section.calculator_id)
      .order('display_order', { ascending: true });
    if (sibErr) {
      console.error('PATCH section: sibling read failed', sibErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    const all = siblings ?? [];
    const target = Math.max(0, Math.min(all.length - 1, display_order));

    // Step 1: move the target row out of the way to a temporary slot
    // (count + 1) — guaranteed unused.
    const temp = all.length + 1;
    const { error: parkErr } = await supabase
      .from('sections')
      .update({ display_order: temp })
      .eq('id', sectionId);
    if (parkErr) {
      console.error('PATCH section: park failed', parkErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    if (target > section.display_order) {
      // Shift rows in (section.display_order, target] DOWN by 1.
      const shifting = all
        .filter(
          (s) =>
            s.id !== sectionId &&
            s.display_order > section.display_order &&
            s.display_order <= target,
        )
        .sort((a, b) => a.display_order - b.display_order);
      for (const row of shifting) {
        const { error } = await supabase
          .from('sections')
          .update({ display_order: row.display_order - 1 })
          .eq('id', row.id);
        if (error) {
          console.error('PATCH section: shift down failed', error);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
      }
    } else {
      // Shift rows in [target, section.display_order) UP by 1.
      const shifting = all
        .filter(
          (s) =>
            s.id !== sectionId &&
            s.display_order >= target &&
            s.display_order < section.display_order,
        )
        .sort((a, b) => b.display_order - a.display_order);
      for (const row of shifting) {
        const { error } = await supabase
          .from('sections')
          .update({ display_order: row.display_order + 1 })
          .eq('id', row.id);
        if (error) {
          console.error('PATCH section: shift up failed', error);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
      }
    }

    // Step 2: park → target.
    const { error: finalErr } = await supabase
      .from('sections')
      .update({ display_order: target })
      .eq('id', sectionId);
    if (finalErr) {
      console.error('PATCH section: final position failed', finalErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase
      .from('sections')
      .update(updates)
      .eq('id', sectionId);
    if (updErr) {
      console.error('PATCH section: update failed', updErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
  }

  const { data: refreshed } = await supabase
    .from('sections')
    .select(SECTION_COLUMNS)
    .eq('id', sectionId)
    .maybeSingle();
  if (!refreshed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(refreshed);
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id: sectionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const confirm = url.searchParams.get('confirm_delete_with_children') === 'true';

  // Load the section + its calculator (RLS-bound) to confirm ownership.
  const { data: section } = await supabase
    .from('sections')
    .select('id, calculator_id, display_order')
    .eq('id', sectionId)
    .maybeSingle();
  if (!section) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: calculator } = await supabase
    .from('calculators')
    .select('id')
    .eq('id', section.calculator_id)
    .is('soft_delete_at', null)
    .maybeSingle();
  if (!calculator) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Last-section guard — a calculator must always have at least one.
  const { count: siblingCount, error: countErr } = await supabase
    .from('sections')
    .select('id', { count: 'exact', head: true })
    .eq('calculator_id', section.calculator_id);
  if (countErr) {
    console.error('DELETE section: sibling count failed', countErr);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
  if ((siblingCount ?? 0) <= 1) {
    return NextResponse.json(
      { error: 'cannot_delete_last_section' },
      { status: 422 },
    );
  }

  // Child-cell count: if non-zero and confirm is missing, refuse.
  const { count: childCount, error: childErr } = await supabase
    .from('cells')
    .select('id', { count: 'exact', head: true })
    .eq('section_id', sectionId);
  if (childErr) {
    console.error('DELETE section: child count failed', childErr);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
  if ((childCount ?? 0) > 0 && !confirm) {
    return NextResponse.json(
      { error: 'section_not_empty', child_count: childCount },
      { status: 409 },
    );
  }

  const { error: deleteErr } = await supabase
    .from('sections')
    .delete()
    .eq('id', sectionId);
  if (deleteErr) {
    console.error('DELETE section: delete failed', deleteErr);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  // Re-pack display_order so the surviving sections stay gap-free.
  // No-op if the deleted section was already last.
  const { data: surviving } = await supabase
    .from('sections')
    .select('id, display_order')
    .eq('calculator_id', section.calculator_id)
    .gt('display_order', section.display_order)
    .order('display_order', { ascending: true });

  for (const row of surviving ?? []) {
    const { error } = await supabase
      .from('sections')
      .update({ display_order: row.display_order - 1 })
      .eq('id', row.id);
    if (error) {
      console.error('DELETE section: repack failed', error);
      // Repacking is best-effort — the deleted section is gone, so we
      // don't fail the response on a repack glitch.
      break;
    }
  }

  return new Response(null, { status: 204 });
}
