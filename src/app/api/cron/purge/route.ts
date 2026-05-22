import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

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
 * PROJ-1 stub for the daily auto-purge cron endpoint.
 *
 * Vercel Cron Jobs invoke this with `Authorization: Bearer <CRON_SECRET>`
 * automatically. The real purge SQL (delete soft-deleted calculators
 * older than RETENTION_PERIOD_DAYS) lands in PROJ-13. This stub returns
 * a count of 0 — keeping the response shape stable so the contract
 * doesn't change when PROJ-13 fills in the body.
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
  console.log(`cron/purge: ok (purged=0, retention_days=${retentionDays})`);

  return NextResponse.json({
    ok: true,
    purged: 0,
    retention_days: retentionDays,
  });
}
