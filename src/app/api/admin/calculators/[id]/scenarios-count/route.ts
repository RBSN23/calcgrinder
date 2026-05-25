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

  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (profile.role !== 'sysadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: calc, error: calcErr } = await admin
    .from('calculators')
    .select('id')
    .eq('id', id)
    .is('soft_delete_at', null)
    .maybeSingle();

  if (calcErr) {
    console.error(
      `GET /api/admin/calculators/${id}/scenarios-count: read failed`,
      calcErr,
    );
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!calc) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { count, error: countErr } = await admin
    .from('scenarios')
    .select('id', { count: 'exact', head: true })
    .eq('calculator_id', id);

  if (countErr) {
    console.error(
      `GET /api/admin/calculators/${id}/scenarios-count: count failed`,
      countErr,
    );
    return NextResponse.json({ error: 'count_failed' }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
