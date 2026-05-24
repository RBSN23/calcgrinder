// PROJ-15 — POST /api/sections/:id/charts
//
// Owner-only chart creation. An empty body creates a default Line chart
// with name `chart_N` (next free integer among existing chart names on the
// calculator), title/subtitle empty, default style, default empty bindings
// for the chosen chart_type, card-level visuals at their defaults, and
// display_order appended at the end of the section's chart list.
//
// Supports `insert_after_element_id` for the between-elements seam: when
// the referenced element is another chart in the same section, the new
// chart's display_order is placed immediately after it and sibling
// display_orders are transactionally renumbered to stay gap-free.
//
// The route enforces the MAX_CHARTS cap, the snake_case name pattern, the
// RESERVED_WORDS rejection, the per-table UNIQUE(calculator_id, name)
// constraint via 409, and per-chart_type bindings validation. The DB has
// the same constraints as a belt-and-braces backstop.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_CHART_STYLE,
  type ChartStyle,
  type ChartType,
  CHART_TYPES,
  nextDefaultChartName,
} from '@/lib/charts/types';
import { MAX_CHARTS } from '@/lib/charts/limits';
import { defaultBindings } from '@/lib/charts/bindings';
import {
  validateBindings,
  validateChartNameField,
  validateSubtitleField,
  validateTitleField,
} from '@/lib/charts/validation';

export const runtime = 'nodejs';

const CHART_COLUMNS =
  'id, calculator_id, section_id, name, chart_type, title, subtitle, bindings, style, card_accent, card_background_tint, card_border, card_size_hint, display_order, created_at, updated_at' as const;

const styleSchema = z
  .object({
    legend: z.enum(['auto', 'always', 'hide']).optional(),
    axis_labels: z.enum(['auto', 'always', 'hide']).optional(),
    animation: z.boolean().optional(),
    smooth_lines: z.boolean().optional(),
  })
  .strip()
  .optional();

const postSchema = z
  .object({
    id: z.string().uuid().optional(),
    chart_type: z.enum(CHART_TYPES).optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    bindings: z.unknown().optional(),
    style: styleSchema,
    card_accent: z.string().optional(),
    card_background_tint: z.enum(['none', 'soft', 'strong']).optional(),
    card_border: z.enum(['none', 'hairline', 'strong']).optional(),
    card_size_hint: z.enum(['narrow', 'wide', 'full']).optional(),
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

  // Verify the section exists and the caller owns it (via calculators RLS join).
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

  // MAX_CHARTS cap per-calculator.
  const { count: chartCount, error: countErr } = await supabase
    .from('charts')
    .select('id', { count: 'exact', head: true })
    .eq('calculator_id', section.calculator_id);
  if (countErr) {
    console.error('POST chart: count failed', countErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
  if ((chartCount ?? 0) >= MAX_CHARTS) {
    return NextResponse.json(
      { error: 'chart_cap_reached', max: MAX_CHARTS },
      { status: 422 },
    );
  }

  const chart_type: ChartType = body.chart_type ?? 'line';

  // Resolve name. If not supplied, scan existing chart names on this
  // calculator and pick the next free `chart_N`.
  let name = body.name;
  if (name === undefined) {
    const { data: existingCharts, error: namesErr } = await supabase
      .from('charts')
      .select('name')
      .eq('calculator_id', section.calculator_id);
    if (namesErr) {
      console.error('POST chart: name read failed', namesErr);
      return NextResponse.json({ error: 'create_failed' }, { status: 500 });
    }
    name = nextDefaultChartName(
      ((existingCharts ?? []) as Array<{ name: string }>).map((c) => c.name),
    );
  } else {
    name = name.trim();
    const v = validateChartNameField(name);
    if (!v.ok) return NextResponse.json(v.body, { status: v.status });
  }

  // Title / subtitle length checks.
  const title = body.title ?? '';
  const subtitle = body.subtitle ?? '';
  const tv = validateTitleField(title);
  if (!tv.ok) return NextResponse.json(tv.body, { status: tv.status });
  const sv = validateSubtitleField(subtitle);
  if (!sv.ok) return NextResponse.json(sv.body, { status: sv.status });

  // Bindings — default to the empty shape for this chart_type, otherwise
  // validate the caller's bindings against the chart_type-specific schema.
  let bindings: unknown;
  if (body.bindings === undefined) {
    bindings = defaultBindings(chart_type);
  } else {
    const bv = validateBindings(chart_type, body.bindings);
    if (!bv.ok) return NextResponse.json(bv.body, { status: bv.status });
    bindings = bv.value;
  }

  // Style — merge caller overrides into the default style object.
  const style: ChartStyle = {
    ...DEFAULT_CHART_STYLE,
    ...(body.style ?? {}),
  };

  // Resolve display_order. Three paths:
  //   1. explicit display_order in body — placed there + renumber.
  //   2. insert_after_element_id pointing to another chart in this
  //      section — place immediately after it + renumber.
  //   3. fallback — append at the end of the section's chart list.
  let display_order = body.display_order;

  if (
    display_order === undefined &&
    body.insert_after_element_id !== undefined
  ) {
    const { data: anchorChart } = await supabase
      .from('charts')
      .select('id, display_order, section_id')
      .eq('id', body.insert_after_element_id)
      .eq('section_id', sectionId)
      .maybeSingle();
    if (anchorChart) {
      display_order =
        (anchorChart as { display_order: number }).display_order + 1;
    }
    // If the id is not a chart in this section (e.g. it's a cell, or a
    // chart in a different section), silently fall through to "append".
  }

  if (display_order === undefined) {
    const { count: siblingCount } = await supabase
      .from('charts')
      .select('id', { count: 'exact', head: true })
      .eq('section_id', sectionId);
    display_order = siblingCount ?? 0;
  } else {
    // Renumber: shift every chart in the section whose display_order >=
    // the target up by one. The UNIQUE(section_id, display_order)
    // constraint is DEFERRABLE so the in-flight collisions resolve at
    // statement boundary.
    const { data: siblings } = await supabase
      .from('charts')
      .select('id, display_order')
      .eq('section_id', sectionId)
      .gte('display_order', display_order)
      .order('display_order', { ascending: false });
    for (const row of (siblings ?? []) as Array<{
      id: string;
      display_order: number;
    }>) {
      const { error } = await supabase
        .from('charts')
        .update({ display_order: row.display_order + 1 } as never)
        .eq('id', row.id);
      if (error) {
        console.error('POST chart: renumber failed', error);
        return NextResponse.json({ error: 'create_failed' }, { status: 500 });
      }
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('charts')
    .insert({
      ...(body.id ? { id: body.id } : {}),
      calculator_id: section.calculator_id,
      section_id: sectionId,
      name,
      chart_type,
      title,
      subtitle,
      bindings,
      style,
      card_accent: body.card_accent ?? 'theme',
      card_background_tint: body.card_background_tint ?? 'none',
      card_border: body.card_border ?? 'none',
      card_size_hint: body.card_size_hint ?? 'narrow',
      display_order,
    } as never)
    .select(CHART_COLUMNS)
    .single();

  if (insertErr || !inserted) {
    const msg = insertErr?.message ?? '';
    if (
      msg.toLowerCase().includes('unique') ||
      msg.toLowerCase().includes('duplicate')
    ) {
      return NextResponse.json(
        { error: 'name_collision' },
        { status: 409 },
      );
    }
    console.error('POST chart: insert failed', insertErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  const row = inserted as unknown as { updated_at: string };
  return NextResponse.json(
    {
      chart: inserted,
      calculator_updated_at: row.updated_at,
    },
    { status: 201 },
  );
}
