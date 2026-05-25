import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
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
    .select('id, title, owner_id')
    .eq('id', id)
    .is('soft_delete_at', null)
    .maybeSingle();

  if (calcErr) {
    console.error(`DELETE /api/admin/calculators/${id}: read failed`, calcErr);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!calc) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (calc.owner_id === user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error: scenariosErr } = await admin
    .from('scenarios')
    .delete()
    .eq('calculator_id', id);

  if (scenariosErr) {
    console.error(
      `DELETE /api/admin/calculators/${id}: scenarios delete failed`,
      scenariosErr,
    );
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  const { error: deleteErr } = await admin
    .from('calculators')
    .delete()
    .eq('id', id);

  if (deleteErr) {
    console.error(
      `DELETE /api/admin/calculators/${id}: calculator delete failed`,
      deleteErr,
    );
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
