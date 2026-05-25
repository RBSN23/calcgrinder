// PROJ-9 — POST /api/sections/:id/cells
//
// Owner-only cell creation. An empty body creates the default Input
// cell described in the AC: kind = 'input', name = next free
// `cell_N`, label = 'New cell', value_type = 'number',
// visibility = 'visible', editability = 'editable',
// default_value = null, display_widget = 'number_field',
// display_format = 'auto', appended at the end of the section.
//
// The route enforces the 200-cell cap, the snake_case name pattern,
// the RESERVED_WORDS rejection, and the visibility / readonly /
// output invariants. The DB then has the same constraints as a
// belt-and-braces backstop.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { MAX_CELLS } from '@/lib/formula';
import {
  DEFAULT_CELL_LABEL,
  defaultEditability,
  defaultWidget,
  nextDefaultCellName,
} from '@/lib/cells/types';
import {
  validateCellInvariants,
  validateCellNameField,
  validateFormulaLength,
  validateValueType,
} from '@/lib/cells/validation';

export const runtime = 'nodejs';

const CELL_COLUMNS =
  'id, calculator_id, section_id, kind, name, label, description, description_render, value_type, visibility, editability, default_value, formula, display_widget, display_format, display_emphasis, unit, numeric_min, numeric_max, numeric_step, select_options, currency_code, card_accent, card_background_tint, card_border, card_size_hint, text_size, text_colour, tabular_columns, display_order, created_at, updated_at' as const;

const postSchema = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(['input', 'output']).optional(),
    name: z.string().optional(),
    label: z.string().optional(),
    description: z.string().optional(),
    description_render: z.enum(['caption', 'tooltip']).optional(),
    value_type: z
      .enum(['number', 'currency', 'percent', 'date', 'boolean', 'select', 'text'])
      .optional(),
    visibility: z.enum(['visible', 'hidden']).optional(),
    editability: z.enum(['editable', 'readonly']).optional(),
    default_value: z.unknown().optional(),
    formula: z.string().optional(),
    display_widget: z.string().optional(),
    display_format: z.string().optional(),
    display_emphasis: z.enum(['plain', 'kpi', 'tabular']).optional(),
    unit: z.string().optional(),
    numeric_min: z.number().optional(),
    numeric_max: z.number().optional(),
    numeric_step: z.number().optional(),
    select_options: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .optional(),
    currency_code: z.string().optional(),
    card_accent: z.string().optional(),
    card_background_tint: z.enum(['none', 'soft', 'strong']).optional(),
    card_border: z.enum(['none', 'hairline', 'strong']).optional(),
    card_size_hint: z.enum(['narrow', 'wide', 'full']).optional(),
    text_size: z.string().optional(),
    text_colour: z.string().optional(),
    display_order: z.number().int().min(0).optional(),
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

  // Verify the section exists and the caller owns it.
  const { data: section } = await supabase
    .from('sections')
    .select('id, calculator_id')
    .eq('id', sectionId)
    .maybeSingle();
  if (!section) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // PROJ-25 — run ownership check and cell lookup in parallel (previously sequential).
  const [calcResult, cellsResult] = await Promise.all([
    supabase
      .from('calculators')
      .select('id')
      .eq('id', section.calculator_id)
      .is('soft_delete_at', null)
      .maybeSingle(),
    supabase
      .from('cells')
      .select('name, section_id')
      .eq('calculator_id', section.calculator_id),
  ]);

  if (!calcResult.data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (cellsResult.error) {
    console.error('POST cell: cells read failed', cellsResult.error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
  const cellRows = cellsResult.data ?? [];

  // Cell-cap guard.
  if (cellRows.length >= MAX_CELLS) {
    return NextResponse.json(
      { error: 'cell_cap_reached', max: MAX_CELLS },
      { status: 422 },
    );
  }

  // Resolve name.
  let name = body.name;
  if (name === undefined) {
    name = nextDefaultCellName(cellRows.map((c) => c.name));
  } else {
    name = name.trim();
    const v = validateCellNameField(name);
    if (!v.ok) return NextResponse.json(v.body, { status: v.status });
  }

  // Resolve value_type (defaults to 'number').
  const value_type = body.value_type ?? 'number';
  const vt = validateValueType(value_type);
  if (!vt.ok) return NextResponse.json(vt.body, { status: vt.status });

  const kind = body.kind ?? 'input';
  const visibility = body.visibility ?? 'visible';
  const editability = body.editability ?? defaultEditability(kind);
  const formula =
    body.formula !== undefined ? body.formula : kind === 'output' ? '' : null;
  if (formula !== null) {
    const f = validateFormulaLength(formula);
    if (!f.ok) return NextResponse.json(f.body, { status: f.status });
  }
  const default_value =
    body.default_value !== undefined ? (body.default_value as never) : null;

  const inv = validateCellInvariants({
    kind,
    visibility,
    editability,
    default_value,
    formula,
  });
  if (!inv.ok) return NextResponse.json(inv.body, { status: inv.status });

  // Resolve display_order: append at end of section unless explicitly placed.
  let display_order = body.display_order;
  if (display_order === undefined) {
    display_order = cellRows.filter((c) => c.section_id === sectionId).length;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('cells')
    .insert({
      ...(body.id ? { id: body.id } : {}),
      calculator_id: section.calculator_id,
      section_id: sectionId,
      kind,
      name,
      label: body.label ?? DEFAULT_CELL_LABEL,
      description: body.description ?? '',
      description_render: body.description_render ?? 'caption',
      value_type,
      visibility,
      editability,
      default_value,
      formula,
      display_widget: body.display_widget ?? defaultWidget(value_type),
      display_format: body.display_format ?? 'auto',
      display_emphasis: body.display_emphasis ?? 'plain',
      unit: body.unit ?? null,
      numeric_min: body.numeric_min ?? null,
      numeric_max: body.numeric_max ?? null,
      numeric_step: body.numeric_step ?? null,
      select_options: body.select_options ?? null,
      currency_code: body.currency_code ?? null,
      card_accent: body.card_accent ?? 'theme',
      card_background_tint: body.card_background_tint ?? 'none',
      card_border: body.card_border ?? 'none',
      card_size_hint: body.card_size_hint ?? 'narrow',
      text_size: body.text_size ?? 'm',
      text_colour: body.text_colour ?? 'default',
      display_order,
    })
    .select(CELL_COLUMNS)
    .single();

  if (insertErr || !inserted) {
    // Likely a unique-violation on (calculator_id, name) from a race.
    const msg = insertErr?.message ?? '';
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
      return NextResponse.json(
        { error: 'name_collision' },
        { status: 409 },
      );
    }
    console.error('POST cell: insert failed', insertErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  // `inserted.updated_at` and calculators.updated_at are both set by
  // triggers using NOW() inside the same transaction, so they're equal.
  // Returning inserted.updated_at avoids the post-write SELECT race
  // that surfaces stale tokens via the PostgREST/PgBouncer pool.
  return NextResponse.json(
    {
      cell: inserted,
      calculator_updated_at: inserted.updated_at,
    },
    { status: 201 },
  );
}
