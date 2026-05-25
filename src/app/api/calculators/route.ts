// PROJ-8 + PROJ-9 + PROJ-10 + PROJ-25 — POST /api/calculators
//
// Owner-only create endpoint. Delegates to `fn_create_calculator` RPC
// which resolves a unique title, reads the user's preferred theme,
// creates the calculator row + default section, and returns the result
// — all in a single database round-trip.

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

  const { data, error } = await supabase.rpc('fn_create_calculator');

  if (error) {
    if (error.message?.includes('unauthorized')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (error.message?.includes('title auto-resolve exhausted')) {
      console.error(
        `POST /api/calculators: title auto-resolve exhausted for owner ${user.id}`,
      );
      return NextResponse.json({ error: 'create_failed' }, { status: 500 });
    }
    console.error('POST /api/calculators: RPC failed', error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    console.error('POST /api/calculators: RPC returned no rows');
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
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
