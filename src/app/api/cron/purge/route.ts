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
 * automatically (PROJ-1). The handler runs two purges in sequence:
 *
 * 1. Calculator purge (PROJ-13). Any calculator whose `soft_delete_at`
 *    is older than `RETENTION_PERIOD_DAYS` is hard-deleted. FK CASCADE
 *    removes child `sections` and `cells`; the FK on
 *    `scenarios.calculator_id` is `ON DELETE SET NULL`, so scenarios
 *    survive as orphans for the dashboard banner to surface.
 *
 * 2. Account purge (PROJ-14). Any profile in `status='pending_deletion'`
 *    whose `pending_deletion_at` is older than the same retention window
 *    has its `auth.users` row hard-deleted via the admin auth API. The
 *    CASCADE on `auth.users.id` then removes the profile, all owned
 *    calculators, and all owned scenarios. The corresponding
 *    `account_deletion_requests` row is removed in the same cascade.
 *
 * Uses the admin (service-role) client because the job is system-level
 * and must operate across all users — there is no `auth.uid()` in cron
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
  // Cutoff is absolute: rows with timestamp < (NOW - retention).
  // Strict `<` rather than `≤` means users get up to one extra
  // dashboard-tick of grace past the configured window (a feature).
  const cutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const admin = createAdminClient();

  // ---- Calculator purge (PROJ-13) -------------------------------------
  const { data: purgedCalcs, error: calcError } = await admin
    .from('calculators')
    .delete()
    .not('soft_delete_at', 'is', null)
    .lt('soft_delete_at', cutoff)
    .select('id');

  if (calcError) {
    console.error('cron/purge: calculator delete failed', calcError);
    return NextResponse.json({ error: 'purge_failed' }, { status: 500 });
  }

  const purgedCalculators = purgedCalcs?.length ?? 0;

  // ---- Account purge (PROJ-14) ----------------------------------------
  // Select expired pending_deletion profiles and hard-delete each one's
  // auth.users row. The FK CASCADE on profiles.id → auth.users.id (and
  // on every downstream owner_id column) handles the rest.
  const { data: expiredProfiles, error: profilesError } = await admin
    .from('profiles')
    .select('id')
    .eq('status', 'pending_deletion')
    .not('pending_deletion_at', 'is', null)
    .lt('pending_deletion_at', cutoff);

  if (profilesError) {
    console.error('cron/purge: pending_deletion query failed', profilesError);
    return NextResponse.json({ error: 'purge_failed' }, { status: 500 });
  }

  let purgedAccounts = 0;
  for (const profile of expiredProfiles ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(
      profile.id,
    );
    if (deleteError) {
      // Log and continue. A per-user failure shouldn't poison the rest
      // of the batch; the next cron tick will retry the survivors.
      console.error(
        `cron/purge: deleteUser failed for ${profile.id}`,
        deleteError,
      );
      continue;
    }
    purgedAccounts += 1;
  }

  console.log(
    `cron/purge: ok (purged_calculators=${purgedCalculators}, ` +
      `purged_accounts=${purgedAccounts}, retention_days=${retentionDays})`,
  );

  return NextResponse.json({
    ok: true,
    // `purged` is retained for backwards compat with the original
    // PROJ-13 response shape. The two named counters are the canonical
    // values going forward.
    purged: purgedCalculators,
    purged_calculators: purgedCalculators,
    purged_accounts: purgedAccounts,
    retention_days: retentionDays,
  });
}
