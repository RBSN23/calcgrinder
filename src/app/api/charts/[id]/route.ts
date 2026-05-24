// PROJ-15 — PATCH + DELETE /api/charts/:id
//
// Owner-only mutations.
//
// PATCH carries the calculator-level optimistic-concurrency token via the
// `updated_at` field on the body. A stale value returns 409 + the server's
// current updated_at, same shape PROJ-8/9 established.
//
// chart_type swaps:
//   * Within a carry-forward family (X-axis+N-series or Labels+Values) the
//     server transforms `bindings` via `carryForwardBindings` so a Line
//     chart's `lines` array gets re-keyed to `bars` on a Bar switch.
//   * Across families the server resets `bindings` to the new chart_type's
//     empty default (backstop — the client also gates with the
//     destructive-confirm row).
//   * When the caller supplies bindings explicitly in the body, those win
//     (validated against the new chart_type's schema).
//
// Reorders are within-section only via `display_order`; cross-section
// moves (`section_id` in body) are rejected with 422.
//
// DELETE is hard; PROJ-13's soft-delete is calculator-level.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  CHART_TYPES,
  type ChartType,
  type ChartStyle,
} from '@/lib/charts/types';
import { carryForwardBindings } from '@/lib/charts/bindings';
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

const patchSchema = z
  .object({
    updated_at: z.string().min(1),
    name: z.string().optional(),
    chart_type: z.enum(CHART_TYPES).optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    bindings: z.unknown().optional(),
    style: styleSchema,
    card_accent: z.string().optional(),
    card_background_tint: z.enum(['none', 'soft', 'strong']).optional(),
    card_border: z.enum(['none', 'hairline', 'strong']).optional(),
    card_size_hint: z.enum(['narrow', 'wide', 'full']).optional(),
    display_order: z.number().int().min(0).optional(),
    // Cross-section moves rejected at the API in v1.
    section_id: z.string().uuid().optional(),
  })
  .strip();

type Ctx = { params: Promise<{ id: string }> };

interface ChartRowDB {
  id: string;
  calculator_id: string;
  section_id: string;
  name: string;
  chart_type: ChartType;
  title: string;
  subtitle: string;
  bindings: unknown;
  style: ChartStyle | Record<string, unknown>;
  card_accent: string;
  card_background_tint: 'none' | 'soft' | 'strong';
  card_border: 'none' | 'hairline' | 'strong';
  card_size_hint: 'narrow' | 'wide' | 'full';
  display_order: number;
  created_at: string;
  updated_at: string;
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id: chartId } = await params;
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

  // Load the chart (RLS-bound).
  const { data: currentRaw } = await supabase
    .from('charts')
    .select(CHART_COLUMNS)
    .eq('id', chartId)
    .maybeSingle();
  if (!currentRaw) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const current = currentRaw as unknown as ChartRowDB;

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

  // Resolve next chart_type. If it changes, transform bindings either via
  // carry-forward (within-family) or reset to the new default (cross-family).
  const nextChartType: ChartType = patch.chart_type ?? current.chart_type;
  const chartTypeChanged =
    patch.chart_type !== undefined && patch.chart_type !== current.chart_type;

  let nextBindings: unknown = current.bindings;
  if (patch.bindings !== undefined) {
    // Caller-supplied bindings win; validate against the next chart_type.
    const bv = validateBindings(nextChartType, patch.bindings);
    if (!bv.ok) return NextResponse.json(bv.body, { status: bv.status });
    nextBindings = bv.value;
  } else if (chartTypeChanged) {
    const cf = carryForwardBindings(
      current.chart_type,
      nextChartType,
      current.bindings as never,
    );
    nextBindings = cf.next;
  }

  // Field validations.
  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed !== current.name) {
      const v = validateChartNameField(trimmed);
      if (!v.ok) return NextResponse.json(v.body, { status: v.status });

      // Pre-check collision against another chart on the same calculator.
      const { data: clash } = await supabase
        .from('charts')
        .select('id')
        .eq('calculator_id', current.calculator_id)
        .eq('name', trimmed)
        .neq('id', chartId)
        .maybeSingle();
      if (clash) {
        return NextResponse.json(
          {
            error: 'name_collision',
            conflicting_chart_id: (clash as { id: string }).id,
          },
          { status: 409 },
        );
      }
      updates.name = trimmed;
    }
  }

  if (patch.title !== undefined) {
    const v = validateTitleField(patch.title);
    if (!v.ok) return NextResponse.json(v.body, { status: v.status });
    updates.title = patch.title;
  }
  if (patch.subtitle !== undefined) {
    const v = validateSubtitleField(patch.subtitle);
    if (!v.ok) return NextResponse.json(v.body, { status: v.status });
    updates.subtitle = patch.subtitle;
  }

  if (chartTypeChanged) updates.chart_type = nextChartType;
  if (
    patch.bindings !== undefined ||
    chartTypeChanged
  ) {
    updates.bindings = nextBindings;
  }
  if (patch.style !== undefined) {
    // Merge into the existing style so partial-style PATCHes preserve
    // unsent fields (toggles vs. segmented vs. text inputs).
    updates.style = {
      ...(current.style as Record<string, unknown>),
      ...patch.style,
    };
  }
  if (patch.card_accent !== undefined) updates.card_accent = patch.card_accent;
  if (patch.card_background_tint !== undefined)
    updates.card_background_tint = patch.card_background_tint;
  if (patch.card_border !== undefined) updates.card_border = patch.card_border;
  if (patch.card_size_hint !== undefined)
    updates.card_size_hint = patch.card_size_hint;

  // Reorder: walk siblings within the same section.
  const reorderRequested =
    patch.display_order !== undefined &&
    patch.display_order !== current.display_order;
  if (reorderRequested) {
    const { data: siblings, error: sibErr } = await supabase
      .from('charts')
      .select('id, display_order')
      .eq('section_id', current.section_id)
      .order('display_order', { ascending: true });
    if (sibErr) {
      console.error('PATCH chart: sibling read failed', sibErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    const all = (siblings ?? []) as Array<{ id: string; display_order: number }>;
    const target = Math.max(0, Math.min(all.length - 1, patch.display_order!));

    // Park current chart at a temporary slot.
    const temp = all.length + 1;
    const { error: parkErr } = await supabase
      .from('charts')
      .update({ display_order: temp } as never)
      .eq('id', chartId);
    if (parkErr) {
      console.error('PATCH chart: park failed', parkErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    if (target > current.display_order) {
      const shifting = all
        .filter(
          (s) =>
            s.id !== chartId &&
            s.display_order > current.display_order &&
            s.display_order <= target,
        )
        .sort((a, b) => a.display_order - b.display_order);
      for (const row of shifting) {
        const { error } = await supabase
          .from('charts')
          .update({ display_order: row.display_order - 1 } as never)
          .eq('id', row.id);
        if (error) {
          console.error('PATCH chart: shift down failed', error);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
      }
    } else {
      const shifting = all
        .filter(
          (s) =>
            s.id !== chartId &&
            s.display_order >= target &&
            s.display_order < current.display_order,
        )
        .sort((a, b) => b.display_order - a.display_order);
      for (const row of shifting) {
        const { error } = await supabase
          .from('charts')
          .update({ display_order: row.display_order + 1 } as never)
          .eq('id', row.id);
        if (error) {
          console.error('PATCH chart: shift up failed', error);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
      }
    }
    updates.display_order = target;
  }

  // The chart-table BEFORE-UPDATE trigger sets NEW.updated_at = NOW() and
  // the parent-bump trigger sets calculators.updated_at = NOW() in the
  // same transaction, so the value returned via RETURNING is the truth.
  let lastBumpAt: string = calculator.updated_at;

  if (Object.keys(updates).length > 0) {
    const { data: updated, error: updErr } = await supabase
      .from('charts')
      .update(updates as never)
      .eq('id', chartId)
      .select('updated_at')
      .single();
    if (updErr) {
      const msg = updErr.message ?? '';
      if (
        updates.name !== undefined &&
        (msg.toLowerCase().includes('unique') ||
          msg.toLowerCase().includes('duplicate'))
      ) {
        return NextResponse.json(
          { error: 'name_collision' },
          { status: 409 },
        );
      }
      console.error('PATCH chart: update failed', updErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    const u = updated as unknown as { updated_at?: string };
    if (u?.updated_at) lastBumpAt = u.updated_at;
  }

  const { data: refreshed } = await supabase
    .from('charts')
    .select(CHART_COLUMNS)
    .eq('id', chartId)
    .maybeSingle();
  if (!refreshed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    chart: refreshed,
    calculator_updated_at: lastBumpAt,
  });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const { id: chartId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: chart } = await supabase
    .from('charts')
    .select('id, calculator_id, section_id, display_order')
    .eq('id', chartId)
    .maybeSingle();
  if (!chart) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const chartRow = chart as unknown as {
    id: string;
    calculator_id: string;
    section_id: string;
    display_order: number;
  };

  const { data: calculator } = await supabase
    .from('calculators')
    .select('id')
    .eq('id', chartRow.calculator_id)
    .is('soft_delete_at', null)
    .maybeSingle();
  if (!calculator) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error: deleteErr } = await supabase
    .from('charts')
    .delete()
    .eq('id', chartId);
  if (deleteErr) {
    console.error('DELETE chart: failed', deleteErr);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  // Re-pack display_order on the surviving siblings.
  const { data: surviving } = await supabase
    .from('charts')
    .select('id, display_order')
    .eq('section_id', chartRow.section_id)
    .gt('display_order', chartRow.display_order)
    .order('display_order', { ascending: true });
  for (const row of (surviving ?? []) as Array<{
    id: string;
    display_order: number;
  }>) {
    const { error } = await supabase
      .from('charts')
      .update({ display_order: row.display_order - 1 } as never)
      .eq('id', row.id);
    if (error) {
      console.error('DELETE chart: repack failed', error);
      break;
    }
  }

  // Echo the bumped calculator.updated_at (delete + repack both fired the
  // parent-bump trigger). Keeps response shape consistent with PATCH/POST.
  const { data: bumped } = await supabase
    .from('calculators')
    .select('updated_at')
    .eq('id', chartRow.calculator_id)
    .maybeSingle();

  return NextResponse.json({
    calculator_updated_at: bumped?.updated_at ?? null,
  });
}
