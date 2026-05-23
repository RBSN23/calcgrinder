// PROJ-8 — POST /api/calculators
//
// Owner-only create endpoint. Always creates a row with the calculator
// defaults (title="Untitled calculator", description="", theme_id="calcgrinder")
// and returns the public CalculatorRow shape (no owner_id, no
// soft_delete_at) — matching what the client helpers consume.

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('calculators')
    .insert({ owner_id: user.id })
    .select('id, title, description, theme_id, updated_at')
    .single();

  if (error || !data) {
    console.error('POST /api/calculators: insert failed', error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
