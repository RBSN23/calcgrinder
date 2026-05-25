// PROJ-10 + PROJ-18 — POST /api/calculators/:id/duplicate
//
// Owner-only same-owner duplicate (PROJ-10) AND token-gated cross-user
// clone (PROJ-18) ride on this single route. The semantic split lives
// in the optional `source_token` body field; the underlying stored
// procedure `fn_duplicate_calculator(source_id, source_token)` branches
// on it and (in PROJ-18) is SECURITY DEFINER + handles RLS internally.
//   * source_token absent   → same-owner duplicate (RLS-equivalent
//     owner check inside the function; "<X> — Copy" title prefix).
//   * source_token present  → cross-user clone (token-gated read;
//     Sysadmin Presets keep their title; everything else gets the
//     unified " — Copy" suffix; source_calculator_id is recorded).
//
// Maps the procedure's RAISE EXCEPTION codes to HTTP statuses:
//   * 42501 (insufficient_privilege) → 401
//   * P0002 (no_data_found)          → 404 (cross-owner / token-mismatch
//                                            / missing / hard-deleted;
//                                            opacity rule)
//   * 23505 (unique_violation)       → 500 (title auto-resolve exhausted)

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// Strip — not strict — so callers can send `{}` or omit the body entirely
// and still hit the same-owner duplicate path (PROJ-10 callers).
const bodySchema = z
  .object({
    // PROJ-18: the cross-user clone discriminator. Must be a non-empty
    // string when present; an explicit empty string is rejected (the
    // client either sends a real token or omits the field).
    source_token: z.string().min(1).optional(),
  })
  .strip();

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Body is optional. PROJ-10 callers send `{}` (or no body at all);
  // PROJ-18 callers send `{ source_token: "..." }`. A malformed JSON
  // body short-circuits to 400 invalid_json; a body that violates the
  // schema (e.g. empty string for source_token) maps to 400
  // invalid_source_token.
  let rawBody: unknown = {};
  const contentLength = req.headers.get('content-length');
  if (contentLength && contentLength !== '0') {
    try {
      rawBody = await req.json();
    } catch {
      // Empty body parses as a JSON syntax error in some runtimes; fall
      // back to `{}` so PROJ-10's no-body callers still work. A truly
      // malformed body (e.g. `{ source_token`) will fall through to the
      // schema check below (which rejects the resulting non-object).
      rawBody = {};
    }
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_source_token' },
      { status: 400 },
    );
  }
  const { source_token } = parsed.data;

  const { data, error } = await supabase.rpc('fn_duplicate_calculator', {
    source_id: id,
    source_token: source_token ?? undefined,
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
    // The stored procedure always returns one row on success; an empty
    // result means the cross-owner / missing / token-mismatch case.
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
      // PROJ-18 — null on same-owner duplicate, source.id on cross-user
      // clone. Lets the caller tell which branch ran without inspecting
      // the title.
      source_calculator_id: row.source_calculator_id ?? null,
    },
    { status: 201 },
  );
}
