// PROJ-8 + PROJ-9 + PROJ-10 — POST /api/calculators
//
// Owner-only create endpoint. Always creates a row with the calculator
// defaults (title="Untitled calculator", description="",
// theme_id="calcgrinder") AND a default first section in one atomic
// flow. Returns the public CalculatorRow shape augmented with
// `default_section_id` so the client can scroll into the default
// section on first paint.
//
// PROJ-10 additions:
//   * Title auto-resolves on the (owner_id, title) partial unique index:
//     "Untitled calculator" → "Untitled calculator (2)" → "(3)" → …
//     Never returns 409 on the default-title path.
//   * Response includes `published` and `public_token` (the column
//     DEFAULT mints the token in the same INSERT).
//
// "Atomic" here is best-effort at the API layer: if the section insert
// fails, we delete the just-inserted calculator before returning 500.
// Supabase doesn't expose multi-table transactions through its REST
// client; a stored procedure would let us wrap both inserts in a real
// transaction, but the failure mode (a calculator row with no
// sections) is already handled by the editor loader's first-load
// backfill (PROJ-9), so the consolation cleanup keeps the unhappy
// path simple.

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { DEFAULT_TITLE } from '@/lib/calculators/types';
import { resolveUniqueTitle } from '@/lib/calculators/server';
import { DEFAULT_SECTION_TITLE } from '@/lib/sections/types';

export const runtime = 'nodejs';

const CALCULATOR_ROW_COLUMNS =
  'id, title, description, theme_id, updated_at, published, public_token' as const;

export async function POST(): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // PROJ-10: pre-resolve the default title against the owner's active
  // set. Avoids a 23505 round-trip on the common "n-th Untitled
  // calculator" path.
  const resolvedTitle = await resolveUniqueTitle(
    supabase,
    user.id,
    DEFAULT_TITLE,
  );
  if (!resolvedTitle) {
    console.error(
      `POST /api/calculators: title auto-resolve exhausted for owner ${user.id}`,
    );
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  // PROJ-14: honour the user's preferred starting theme. NULL falls
  // through to the calculators.theme_id column DEFAULT ('calcgrinder').
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_calculator_theme')
    .eq('id', user.id)
    .maybeSingle();

  const insertRow: {
    owner_id: string;
    title: string;
    theme_id?: string;
  } = { owner_id: user.id, title: resolvedTitle };
  if (profile?.default_calculator_theme) {
    insertRow.theme_id = profile.default_calculator_theme;
  }

  const { data: calculator, error: calcErr } = await supabase
    .from('calculators')
    .insert(insertRow)
    .select(CALCULATOR_ROW_COLUMNS)
    .single();

  if (calcErr || !calculator) {
    console.error('POST /api/calculators: insert failed', calcErr);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  const { data: section, error: sectionErr } = await supabase
    .from('sections')
    .insert({
      calculator_id: calculator.id,
      title: DEFAULT_SECTION_TITLE,
      description: '',
      layout_pattern_id: 'single_column',
      display_order: 0,
    })
    .select('id, updated_at')
    .single();

  if (sectionErr || !section) {
    console.error(
      'POST /api/calculators: default section insert failed',
      sectionErr,
    );
    // Best-effort rollback so the editor doesn't load a sectionless row
    // (the backfill would also catch it, but cleaning up keeps state
    // consistent for callers that retry).
    await supabase.from('calculators').delete().eq('id', calculator.id);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  // The section insert bumped calculators.updated_at via the
  // parent-bump trigger — re-read it so the client's optimistic
  // concurrency token matches the row's true state.
  const { data: refreshed } = await supabase
    .from('calculators')
    .select('updated_at')
    .eq('id', calculator.id)
    .maybeSingle();

  return NextResponse.json(
    {
      ...calculator,
      updated_at: refreshed?.updated_at ?? calculator.updated_at,
      default_section_id: section.id,
    },
    { status: 201 },
  );
}
