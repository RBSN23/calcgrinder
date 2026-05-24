import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Constant-time bearer-token comparison with a length-check short-circuit.
 * Returning early on length mismatch avoids the throw that
 * `timingSafeEqual` raises on unequal-length inputs.
 */
function safeCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Daily auto-purge cron endpoint.
 *
 * Vercel Cron Jobs invoke this with `Authorization: Bearer <CRON_SECRET>`
 * automatically (PROJ-1). The handler hard-deletes any calculator whose
 * `soft_delete_at` is older than `RETENTION_PERIOD_DAYS` (PROJ-13).
 * FK CASCADE removes child `sections` and `cells`; the FK on
 * `scenarios.calculator_id` is `ON DELETE SET NULL`, so scenarios
 * survive as orphans for the dashboard banner to surface.
 *
 * Uses the admin (service-role) client because the job is system-level
 * and must purge across all users — there is no `auth.uid()` in cron
 * context. The `server-only` import guard on the admin client prevents
 * accidental client-side usage.
 */
export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === '') {
    // Fail-closed: a missing secret means the deployer misconfigured the
    // endpoint. Serving "ok" would silently bypass auth.
    console.error('cron/purge: CRON_SECRET is not configured');
    return new NextResponse(null, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new NextResponse(null, { status: 401 });
  }

  const token = authHeader.slice('Bearer '.length);
  if (!safeCompare(token, cronSecret)) {
    return new NextResponse(null, { status: 401 });
  }

  const retentionDays = Number(process.env.RETENTION_PERIOD_DAYS) || 30;
  // Cutoff is absolute: rows with soft_delete_at < (NOW - retention).
  // Strict `<` rather than `≤` means users get up to one extra
  // dashboard-tick of grace past the configured window (a feature).
  const cutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('calculators')
    .delete()
    .not('soft_delete_at', 'is', null)
    .lt('soft_delete_at', cutoff)
    .select('id');

  if (error) {
    console.error('cron/purge: delete failed', error);
    return NextResponse.json({ error: 'purge_failed' }, { status: 500 });
  }

  const purged = data?.length ?? 0;
  console.log(`cron/purge: ok (purged=${purged}, retention_days=${retentionDays})`);

  return NextResponse.json({
    ok: true,
    purged,
    retention_days: retentionDays,
  });
}
