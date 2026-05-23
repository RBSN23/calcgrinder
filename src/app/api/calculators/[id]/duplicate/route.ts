// PROJ-10 — POST /api/calculators/:id/duplicate
//
// Owner-only deep-copy. Thin wrapper over the `fn_duplicate_calculator`
// stored procedure (which runs the whole copy in a single transaction —
// see supabase/migrations/20260525000000_calculator_lifecycle.sql).
// The stored procedure handles RLS (SECURITY INVOKER + an explicit
// auth.uid() check), title auto-resolve to the first free
// "Copy of <X>" / "Copy of <X> (N)" slot, public_token mint, and the
// default_section_id lookup.
//
// Maps the procedure's RAISE EXCEPTION codes to HTTP statuses:
//   * 42501 (insufficient_privilege) → 401
//   * P0002 (no_data_found)          → 404 (cross-owner / missing / soft-deleted; opacity rule)
//   * 23505 (unique_violation)       → 500 (title auto-resolve exhausted)

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('fn_duplicate_calculator', {
    source_id: id,
  });

  if (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === '42501') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (code === 'P0002') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error(`POST /api/calculators/${id}/duplicate: rpc failed`, error);
    return NextResponse.json({ error: 'duplicate_failed' }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    // The stored procedure always returns one row on success; reaching
    // here means it returned an empty result (shouldn't happen, but
    // surface as 404 for the cross-owner / missing case).
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: row.id,
      title: row.title,
      description: row.description,
      theme_id: row.theme_id,
      updated_at: row.updated_at,
      published: row.published,
      public_token: row.public_token,
      default_section_id: row.default_section_id,
    },
    { status: 201 },
  );
}
