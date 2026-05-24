// PROJ-13 — GET /api/calculators/:id/scenarios-count
//
// Returns the number of `scenarios` rows whose `calculator_id = :id`,
// regardless of who owns those scenarios. Used by the dashboard
// Delete-permanently destructive-confirm sheet to render the orphan
// warning copy ("{N} scenario(s) that reference this calculator will
// become orphan").
//
// Two-step auth: the user-scoped client proves the caller owns the
// calculator (RLS); the admin client then runs the cross-owner COUNT.
// Because the only data we expose is an integer (no scenario titles,
// no owner attribution), the cross-owner aggregate is safe — the
// calculator owner already knows their calculator was published and
// could be saved against by anyone.

import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Confirm the caller owns this calculator (RLS does the heavy
  // lifting). We allow soft-deleted rows here because the sheet opens
  // from the Trash card.
  const { data: calc, error: readErr } = await supabase
    .from('calculators')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (readErr) {
    console.error(
      `GET /api/calculators/${id}/scenarios-count: read failed`,
      readErr,
    );
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!calc) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { count, error: countErr } = await admin
    .from('scenarios')
    .select('id', { count: 'exact', head: true })
    .eq('calculator_id', id);

  if (countErr) {
    console.error(
      `GET /api/calculators/${id}/scenarios-count: count failed`,
      countErr,
    );
    return NextResponse.json({ error: 'count_failed' }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
