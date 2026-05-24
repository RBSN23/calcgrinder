// PROJ-16 — POST /api/sections/:id/text_blocks
//
// Owner-only text-block creation. An empty body creates a default text
// block with `body = ''`, card-level visuals at their defaults, and
// `display_order` appended at the end of the section's text-block list.
// Supports `insert_after_element_id` for the between-elements seam: when
// the referenced element is another text block in the same section, the
// new block's `display_order` is placed immediately after it and sibling
// `display_order`s are transactionally renumbered to stay gap-free.
//
// The route enforces:
//   - MAX_TEXT_BLOCKS = 30 per-calculator cap.
//   - MAX_TEXT_BLOCK_BODY_BYTES = 51200 server-side Zod backstop on body.
//   - Owner-only access via the parent calculator lookup (RLS-bound).
//
// Text blocks have NO `name` column (deliberate spec deviation — Builder-
// only, not referenced by formulas), so no name validation or collision
// check applies here.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { MAX_TEXT_BLOCKS } from '@/lib/text-blocks/limits';
import { validateTextBlockBody } from '@/lib/text-blocks/validation';
import { textBlocksTable } from '@/lib/text-blocks/server';

export const runtime = 'nodejs';

const TEXT_BLOCK_COLUMNS =
  'id, calculator_id, section_id, body, card_accent, card_background_tint, card_border, card_size_hint, text_size, text_colour, display_order, created_at, updated_at' as const;

const postSchema = z
  .object({
    id: z.string().uuid().optional(),
    body: z.string().optional(),
    card_accent: z.string().optional(),
    card_background_tint: z.enum(['none', 'soft', 'strong']).optional(),
    card_border: z.enum(['none', 'hairline', 'strong']).optional(),
    card_size_hint: z.enum(['narrow', 'wide', 'full']).optional(),
    text_size: z.enum(['s', 'm', 'l', 'xl']).optional(),
    text_colour: z.enum(['default', 'accent_1', 'accent_2']).optional(),
    display_order: z.number().int().min(0).optional(),
    insert_after_element_id: z.string().uuid().optional(),
  })
  .strip();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id: sectionId } = await params;
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

  // Body byte-cap check (50 KB UTF-8 backstop).
  const bodyText = body.body ?? '';
  const bv = validateTextBlockBody(bodyText);
  if (!bv.ok) {
    return NextResponse.json(bv.body, { status: bv.status });
  }

  // Verify the section exists and the caller owns its parent calculator
  // (RLS scopes the read; soft-deleted calcs are filtered out below).
  const { data: section } = await supabase
    .from('sections')
    .select('id, calculator_id')
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

  // MAX_TEXT_BLOCKS cap per-calculator.
  const { count: blockCount, error: countErr } = await textBlocksTable(
    supabase,
  )
    .select('id', { count: 'exact', head: true })
    .eq('calculator_id', section.calculator_id);
  if (countErr) {
    console.error('POST text_block: count failed', countErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
  if ((blockCount ?? 0) >= MAX_TEXT_BLOCKS) {
    return NextResponse.json(
      { error: 'text_block_cap_reached', max: MAX_TEXT_BLOCKS },
      { status: 422 },
    );
  }

  // Resolve display_order. Three paths:
  //   1. explicit display_order in body — placed there + renumber.
  //   2. insert_after_element_id pointing to another text block in this
  //      section — place immediately after it + renumber.
  //   3. fallback — append at the end of the section's text-block list.
  let display_order = body.display_order;

  if (
    display_order === undefined &&
    body.insert_after_element_id !== undefined
  ) {
    const { data: anchor } = await textBlocksTable(supabase)
      .select('id, display_order, section_id')
      .eq('id', body.insert_after_element_id)
      .eq('section_id', sectionId)
      .maybeSingle();
    if (anchor) {
      display_order =
        (anchor as { display_order: number }).display_order + 1;
    }
    // If the id is not a text block in this section, silently fall
    // through to "append" — consistent with the chart route.
  }

  if (display_order === undefined) {
    const { count: siblingCount } = await textBlocksTable(supabase)
      .select('id', { count: 'exact', head: true })
      .eq('section_id', sectionId);
    display_order = siblingCount ?? 0;
  } else {
    // Renumber: shift every text block in the section whose display_order
    // >= the target up by one. The UNIQUE(section_id, display_order)
    // constraint is DEFERRABLE so the in-flight collisions resolve at
    // statement boundary.
    const { data: siblings } = await textBlocksTable(supabase)
      .select('id, display_order')
      .eq('section_id', sectionId)
      .gte('display_order', display_order)
      .order('display_order', { ascending: false });
    for (const row of (siblings ?? []) as Array<{
      id: string;
      display_order: number;
    }>) {
      const { error } = await textBlocksTable(supabase)
        .update({ display_order: row.display_order + 1 })
        .eq('id', row.id);
      if (error) {
        console.error('POST text_block: renumber failed', error);
        return NextResponse.json({ error: 'create_failed' }, { status: 500 });
      }
    }
  }

  const insertRow = {
    ...(body.id ? { id: body.id } : {}),
    calculator_id: section.calculator_id,
    section_id: sectionId,
    body: bodyText,
    card_accent: body.card_accent ?? 'theme',
    card_background_tint: body.card_background_tint ?? 'none',
    card_border: body.card_border ?? 'none',
    card_size_hint: body.card_size_hint ?? 'wide',
    text_size: body.text_size ?? 'm',
    text_colour: body.text_colour ?? 'default',
    display_order,
  };

  const { data: inserted, error: insertErr } = await textBlocksTable(supabase)
    .insert(insertRow)
    .select(TEXT_BLOCK_COLUMNS)
    .single();

  if (insertErr || !inserted) {
    console.error('POST text_block: insert failed', insertErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  const row = inserted as { updated_at: string };
  return NextResponse.json(
    {
      text_block: inserted,
      calculator_updated_at: row.updated_at,
    },
    { status: 201 },
  );
}
