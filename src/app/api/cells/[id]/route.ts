// PROJ-9 — PATCH + DELETE /api/cells/:id
//
// Owner-only mutations.
//
// PATCH carries the calculator-level optimistic-concurrency token via
// the `updated_at` field on the body. A stale value returns 409 + the
// server's current updated_at.
//
// Two special PATCH paths:
//   1. Rename (body.name changed): the route loads every output cell
//      on the calculator and rewrites every reference to the old name
//      via `rewriteFormulaReference` from `@/lib/formula`. The rewrite
//      respects lambda-parameter shadowing. The cell rename + dependent
//      rewrites are then written; we surface name_collision (409) if
//      the new name is already in use, formula_too_long_after_rewrite
//      (422) if any rewritten formula exceeds MAX_FORMULA_LEN.
//   2. Kind swap (body.kind != current): the swap nulls default_value
//      (output) or formula (input) and resets editability per the AC.
//
// DELETE is hard; PROJ-13's soft-delete is calculator-level. Dependent
// formulas are NOT rewritten — the maintainer's signal that they
// removed a load-bearing cell is the `unknown_name` red error on the
// dependents.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  MAX_FORMULA_LEN,
  rewriteFormulaReference,
} from '@/lib/formula';
import {
  CELL_NAME_PATTERN,
  defaultEditability,
} from '@/lib/cells/types';
import {
  validateCellInvariants,
  validateCellNameField,
  validateFormulaLength,
  validateValueType,
} from '@/lib/cells/validation';

export const runtime = 'nodejs';

const CELL_COLUMNS =
  'id, calculator_id, section_id, kind, name, label, description, description_render, value_type, visibility, editability, default_value, formula, display_widget, display_format, display_emphasis, unit, numeric_min, numeric_max, numeric_step, select_options, currency_code, card_accent, card_background_tint, card_border, card_size_hint, text_size, text_colour, display_order, created_at, updated_at' as const;

const patchSchema = z
  .object({
    updated_at: z.string().min(1),
    rewrite_dependents: z.boolean().optional(),
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
    formula: z.string().nullable().optional(),
    display_widget: z.string().nullable().optional(),
    display_format: z.string().optional(),
    display_emphasis: z.enum(['plain', 'kpi', 'tabular']).optional(),
    unit: z.string().nullable().optional(),
    numeric_min: z.number().nullable().optional(),
    numeric_max: z.number().nullable().optional(),
    numeric_step: z.number().nullable().optional(),
    select_options: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .nullable()
      .optional(),
    currency_code: z.string().nullable().optional(),
    card_accent: z.string().optional(),
    card_background_tint: z.enum(['none', 'soft', 'strong']).optional(),
    card_border: z.enum(['none', 'hairline', 'strong']).optional(),
    card_size_hint: z.enum(['narrow', 'wide', 'full']).optional(),
    text_size: z.string().optional(),
    text_colour: z.string().optional(),
    display_order: z.number().int().min(0).optional(),
    // Cross-section moves are rejected at the API in v1.
    section_id: z.string().uuid().optional(),
  })
  .strip();

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id: cellId } = await params;
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
  const { updated_at: staleUpdatedAt, rewrite_dependents, ...patch } = parsed.data;

  // Reject cross-section moves (v1).
  if (patch.section_id !== undefined) {
    return NextResponse.json(
      { error: 'cross_section_move_unsupported' },
      { status: 422 },
    );
  }

  // Load current cell + parent calculator (RLS-bound).
  const { data: current } = await supabase
    .from('cells')
    .select(CELL_COLUMNS)
    .eq('id', cellId)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

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

  // Resolve the next-state values (current + patched).
  const nextKind = patch.kind ?? (current.kind as 'input' | 'output');
  const kindChanged = patch.kind !== undefined && patch.kind !== current.kind;
  let nextDefaultValue =
    patch.default_value !== undefined
      ? (patch.default_value as unknown)
      : current.default_value;
  let nextFormula: string | null =
    patch.formula !== undefined ? patch.formula : current.formula;
  let nextEditability =
    patch.editability ??
    (current.editability as 'editable' | 'readonly');

  if (kindChanged) {
    if (nextKind === 'output') {
      // input → output: formula must be provided (empty string OK).
      if (patch.formula === undefined) {
        return NextResponse.json(
          { error: 'invalid_kind_swap', reason: 'formula_required' },
          { status: 422 },
        );
      }
      nextDefaultValue = null;
      if (patch.editability === undefined) nextEditability = 'readonly';
    } else {
      // output → input: clear formula, reset editability.
      nextFormula = null;
      if (patch.default_value === undefined) nextDefaultValue = null;
      if (patch.editability === undefined) nextEditability = defaultEditability('input');
    }
  }

  // Field-level validation.
  if (patch.value_type !== undefined) {
    const v = validateValueType(patch.value_type);
    if (!v.ok) return NextResponse.json(v.body, { status: v.status });
  }
  if (nextFormula !== null) {
    const v = validateFormulaLength(nextFormula);
    if (!v.ok) return NextResponse.json(v.body, { status: v.status });
  }
  const inv = validateCellInvariants({
    kind: nextKind,
    visibility: (patch.visibility ?? (current.visibility as 'visible' | 'hidden')),
    editability: nextEditability,
    default_value: nextDefaultValue,
    formula: nextFormula,
  });
  if (!inv.ok) return NextResponse.json(inv.body, { status: inv.status });

  // Rename path (server-side AST rewrite of dependents).
  const renameRequested =
    patch.name !== undefined && patch.name.trim() !== current.name;
  const rewrites: { id: string; formula: string }[] = [];
  let nextName = current.name;

  if (renameRequested) {
    const trimmed = patch.name!.trim();
    if (!CELL_NAME_PATTERN.test(trimmed)) {
      const r = validateCellNameField(trimmed);
      if (!r.ok) return NextResponse.json(r.body, { status: r.status });
    }
    const r = validateCellNameField(trimmed);
    if (!r.ok) return NextResponse.json(r.body, { status: r.status });
    nextName = trimmed;

    // Pre-check collision against any other cell on the calculator.
    const { data: clash } = await supabase
      .from('cells')
      .select('id')
      .eq('calculator_id', current.calculator_id)
      .eq('name', nextName)
      .neq('id', cellId)
      .maybeSingle();
    if (clash) {
      return NextResponse.json(
        { error: 'name_collision', conflicting_cell_id: clash.id },
        { status: 409 },
      );
    }

    if (rewrite_dependents !== false) {
      // Find every Output cell on the calculator and rewrite its formula.
      const { data: outputs } = await supabase
        .from('cells')
        .select('id, formula')
        .eq('calculator_id', current.calculator_id)
        .eq('kind', 'output')
        .neq('id', cellId);
      for (const cell of outputs ?? []) {
        if (!cell.formula) continue;
        const rewritten = rewriteFormulaReference(
          cell.formula,
          current.name,
          nextName,
        );
        if (rewritten === cell.formula) continue;
        if (rewritten.length > MAX_FORMULA_LEN) {
          return NextResponse.json(
            {
              error: 'formula_too_long_after_rewrite',
              affected_cell_ids: [cell.id],
            },
            { status: 422 },
          );
        }
        rewrites.push({ id: cell.id, formula: rewritten });
      }
    }
  }

  // Assemble the cell update payload. Keys mirror columns on the
  // cells row; the `as never` cast at the .update() call accepts the
  // dynamic shape since Supabase's typed Update wants a closed object.
  const updates: Record<string, unknown> = {};
  if (renameRequested) updates.name = nextName;
  if (patch.label !== undefined) updates.label = patch.label;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.description_render !== undefined)
    updates.description_render = patch.description_render;
  if (patch.value_type !== undefined) updates.value_type = patch.value_type;
  if (patch.visibility !== undefined) updates.visibility = patch.visibility;
  if (
    patch.editability !== undefined ||
    (kindChanged && nextEditability !== current.editability)
  ) {
    updates.editability = nextEditability;
  }
  if (patch.default_value !== undefined || kindChanged) {
    updates.default_value = nextDefaultValue;
  }
  if (patch.formula !== undefined || kindChanged) {
    updates.formula = nextFormula;
  }
  if (kindChanged) updates.kind = nextKind;
  if (patch.display_widget !== undefined)
    updates.display_widget = patch.display_widget;
  if (patch.display_format !== undefined)
    updates.display_format = patch.display_format;
  if (patch.display_emphasis !== undefined)
    updates.display_emphasis = patch.display_emphasis;
  if (patch.unit !== undefined) updates.unit = patch.unit;
  if (patch.numeric_min !== undefined) updates.numeric_min = patch.numeric_min;
  if (patch.numeric_max !== undefined) updates.numeric_max = patch.numeric_max;
  if (patch.numeric_step !== undefined) updates.numeric_step = patch.numeric_step;
  if (patch.select_options !== undefined)
    updates.select_options = patch.select_options;
  if (patch.currency_code !== undefined)
    updates.currency_code = patch.currency_code;
  if (patch.card_accent !== undefined) updates.card_accent = patch.card_accent;
  if (patch.card_background_tint !== undefined)
    updates.card_background_tint = patch.card_background_tint;
  if (patch.card_border !== undefined) updates.card_border = patch.card_border;
  if (patch.card_size_hint !== undefined)
    updates.card_size_hint = patch.card_size_hint;
  if (patch.text_size !== undefined) updates.text_size = patch.text_size;
  if (patch.text_colour !== undefined) updates.text_colour = patch.text_colour;

  // Reorder: walk siblings within the same section.
  const reorderRequested =
    patch.display_order !== undefined &&
    patch.display_order !== current.display_order;
  if (reorderRequested) {
    const { data: siblings, error: sibErr } = await supabase
      .from('cells')
      .select('id, display_order')
      .eq('section_id', current.section_id)
      .order('display_order', { ascending: true });
    if (sibErr) {
      console.error('PATCH cell: sibling read failed', sibErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    const all = siblings ?? [];
    const target = Math.max(0, Math.min(all.length - 1, patch.display_order!));

    // Park current cell at a temporary slot.
    const temp = all.length + 1;
    const { error: parkErr } = await supabase
      .from('cells')
      .update({ display_order: temp })
      .eq('id', cellId);
    if (parkErr) {
      console.error('PATCH cell: park failed', parkErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    if (target > current.display_order) {
      const shifting = all
        .filter(
          (s) =>
            s.id !== cellId &&
            s.display_order > current.display_order &&
            s.display_order <= target,
        )
        .sort((a, b) => a.display_order - b.display_order);
      for (const row of shifting) {
        const { error } = await supabase
          .from('cells')
          .update({ display_order: row.display_order - 1 })
          .eq('id', row.id);
        if (error) {
          console.error('PATCH cell: shift down failed', error);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
      }
    } else {
      const shifting = all
        .filter(
          (s) =>
            s.id !== cellId &&
            s.display_order >= target &&
            s.display_order < current.display_order,
        )
        .sort((a, b) => b.display_order - a.display_order);
      for (const row of shifting) {
        const { error } = await supabase
          .from('cells')
          .update({ display_order: row.display_order + 1 })
          .eq('id', row.id);
        if (error) {
          console.error('PATCH cell: shift up failed', error);
          return NextResponse.json({ error: 'update_failed' }, { status: 500 });
        }
      }
    }

    updates.display_order = target;
  }

  // Track calculator.updated_at via UPDATE...RETURNING instead of a
  // post-write SELECT. The cell-table BEFORE-UPDATE trigger sets
  // NEW.updated_at = NOW() and the parent-bump trigger sets
  // calculators.updated_at = NOW() *in the same transaction*, so
  // cell.updated_at returned via RETURNING equals calculators.updated_at
  // after this write. The previous post-write SELECT could race with
  // PostgREST/PgBouncer connection pooling and surface a stale value,
  // which caused the 2nd-rename-in-a-row 409 reported as Cycle-2
  // Bug A: cell.updated_at would correctly advance, but the *separate*
  // SELECT for calc.updated_at could come back with the value as of
  // *before* the last dependent-rewrite commit.
  // Seed with the calculator's current value (already loaded for the
  // stale check above) so a no-op PATCH still returns the truth.
  let lastBumpAt: string = calculator.updated_at;

  if (Object.keys(updates).length > 0) {
    const { data: updated, error: updErr } = await supabase
      .from('cells')
      .update(updates as never)
      .eq('id', cellId)
      .select('updated_at')
      .single();
    if (updErr) {
      const msg = updErr.message ?? '';
      if (
        renameRequested &&
        (msg.toLowerCase().includes('unique') ||
          msg.toLowerCase().includes('duplicate'))
      ) {
        return NextResponse.json(
          { error: 'name_collision' },
          { status: 409 },
        );
      }
      console.error('PATCH cell: update failed', updErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    if (updated?.updated_at) lastBumpAt = updated.updated_at;
  }

  // Apply dependent-formula rewrites; each one bumps calc.updated_at
  // via the parent-bump trigger, so we keep advancing `lastBumpAt`
  // across the loop.
  for (const rw of rewrites) {
    const { data: rwUpdated, error: rwErr } = await supabase
      .from('cells')
      .update({ formula: rw.formula })
      .eq('id', rw.id)
      .select('updated_at')
      .single();
    if (rwErr) {
      console.error('PATCH cell: rewrite failed', rwErr);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    if (rwUpdated?.updated_at) lastBumpAt = rwUpdated.updated_at;
  }

  const { data: refreshed } = await supabase
    .from('cells')
    .select(CELL_COLUMNS)
    .eq('id', cellId)
    .maybeSingle();
  if (!refreshed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    cell: refreshed,
    rewritten_cell_ids: rewrites.map((r) => r.id),
    calculator_updated_at: lastBumpAt,
  });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const { id: cellId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: cell } = await supabase
    .from('cells')
    .select('id, calculator_id, section_id, display_order')
    .eq('id', cellId)
    .maybeSingle();
  if (!cell) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: calculator } = await supabase
    .from('calculators')
    .select('id')
    .eq('id', cell.calculator_id)
    .is('soft_delete_at', null)
    .maybeSingle();
  if (!calculator) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error: deleteErr } = await supabase
    .from('cells')
    .delete()
    .eq('id', cellId);
  if (deleteErr) {
    console.error('DELETE cell: failed', deleteErr);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  // Re-pack display_order on the surviving siblings.
  const { data: surviving } = await supabase
    .from('cells')
    .select('id, display_order')
    .eq('section_id', cell.section_id)
    .gt('display_order', cell.display_order)
    .order('display_order', { ascending: true });
  for (const row of surviving ?? []) {
    const { error } = await supabase
      .from('cells')
      .update({ display_order: row.display_order - 1 })
      .eq('id', row.id);
    if (error) {
      console.error('DELETE cell: repack failed', error);
      break;
    }
  }

  // Echo the bumped calculator.updated_at (delete + repack both fired
  // the parent-bump trigger). Returning a JSON body in place of the
  // prior 204 keeps the response shape consistent with PATCH/POST and
  // lets the client refresh its concurrency token.
  const { data: bumped } = await supabase
    .from('calculators')
    .select('updated_at')
    .eq('id', cell.calculator_id)
    .maybeSingle();

  return NextResponse.json({
    calculator_updated_at: bumped?.updated_at ?? null,
  });
}
