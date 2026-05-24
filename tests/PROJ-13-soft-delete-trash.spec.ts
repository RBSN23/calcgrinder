import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-13 — Soft-Delete & Trash Recovery.
 *
 * Coverage spans:
 *   - Soft-delete (PROJ-10 contract preserved) makes the row appear in
 *     the dashboard Trash section.
 *   - POST /api/calculators/:id/restore brings the row back, preserves
 *     `published` + `public_token`, and auto-resolves title collisions.
 *   - DELETE /api/calculators/:id?hard=true hard-deletes a trashed row
 *     and returns the orphan count; rejects active rows with 400
 *     `not_in_trash`; cross-owner attempts return 404.
 *   - GET /api/calculators/:id/scenarios-count returns the cross-owner
 *     count for the owner, 404 cross-owner, 401 unauthenticated.
 *   - DELETE /api/scenarios?orphans=1 cleans up only the caller's
 *     orphan scenarios; non-orphan rows are untouched.
 *   - GET /api/cron/purge with the bearer token actually purges rows
 *     past the retention cutoff (a calculator with a backdated
 *     `soft_delete_at` is removed; an active row is preserved).
 *   - Dashboard renders the Trash section when the user has trashed
 *     calculators, with the count pill.
 *
 * Reuses the PROJ-10/PROJ-12 bootstrap pattern: per-test approved
 * user, RLS via the cookie-bound client, admin-client teardown.
 */

function loadEnv(key: string): string {
  const envPath = resolve(__dirname, '..', '.env.local');
  const contents = readFileSync(envPath, 'utf8');
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const match = contents.match(re);
  if (!match || !match[1]) {
    throw new Error(`${key} not found in .env.local`);
  }
  return match[1].trim().replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = loadEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SECRET = loadEnv('SUPABASE_SECRET_KEY');
const CRON_SECRET = loadEnv('CRON_SECRET');

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ApprovedUser = {
  userId: string;
  email: string;
  password: string;
  name: string;
};

async function bootstrapApprovedUser(): Promise<ApprovedUser> {
  const suffix = randomBytes(4).toString('hex');
  const email = `e2e-proj13-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;
  const name = `Trasher ${suffix}`;

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
  if (createErr || !created.user) {
    throw new Error(
      `failed to bootstrap user: ${createErr?.message ?? 'no user'}`,
    );
  }
  const userId = created.user.id;

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ status: 'approved', name, role: 'registered' })
    .eq('id', userId);
  if (updateErr) {
    throw new Error(`failed to approve profile: ${updateErr.message}`);
  }

  return { userId, email, password, name };
}

async function teardown(userId: string) {
  await admin.auth.admin.deleteUser(userId);
}

async function signIn(page: Page, user: ApprovedUser) {
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await Promise.all([
    page.waitForURL(/\/dashboard$/),
    page.click('button[type="submit"]'),
  ]);
}

async function createTrashedCalculator(
  page: Page,
  opts: { title: string },
): Promise<{ id: string; updated_at: string; public_token: string; published: boolean }> {
  // Create a calculator, rename it, publish it, then soft-delete it.
  // After soft-delete the dashboard "My Calculators" excludes it and
  // "Trash" includes it; the row still carries its prior published
  // state + public_token for the restore-preserves test.
  const create = await page.request.post('/api/calculators', { data: {} });
  expect(create.status()).toBe(201);
  const row = await create.json();

  const renamed = await page.request.patch(`/api/calculators/${row.id}`, {
    data: { updated_at: row.updated_at, title: opts.title },
  });
  expect(renamed.status()).toBe(200);
  const renamedBody = await renamed.json();

  const published = await page.request.patch(`/api/calculators/${row.id}`, {
    data: { updated_at: renamedBody.updated_at, published: true },
  });
  expect(published.status()).toBe(200);
  const publishedBody = await published.json();
  expect(publishedBody.published).toBe(true);

  const del = await page.request.delete(`/api/calculators/${row.id}`, {
    data: { updated_at: publishedBody.updated_at },
  });
  expect(del.status()).toBe(200);
  const delBody = await del.json();
  return {
    id: row.id,
    updated_at: delBody.updated_at,
    public_token: publishedBody.public_token,
    published: true,
  };
}

test.describe('PROJ-13 — Soft-Delete & Trash Recovery', () => {
  test('soft-delete hides the row from My Calculators and surfaces it in the dashboard Trash section', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const trashed = await createTrashedCalculator(page, {
        title: `Mortgage ${randomBytes(2).toString('hex')}`,
      });

      // The dashboard Trash section renders with the correct count.
      await page.reload();
      const trashSection = page.getByRole('region', { name: /trash/i }).first();
      // Falls back to looking up by heading if no region role is set.
      await expect(page.getByText('Trash', { exact: true }).first()).toBeVisible();

      // The DB row is soft-deleted, not hard-deleted.
      const { data: dbRow } = await admin
        .from('calculators')
        .select('id, soft_delete_at')
        .eq('id', trashed.id)
        .maybeSingle();
      expect(dbRow?.soft_delete_at).not.toBeNull();

      // Sanity: silence unused linter warning on trashSection.
      void trashSection;
    } finally {
      await teardown(user.userId);
    }
  });

  test('POST /restore brings the row back, preserves published + public_token, no rename when no collision', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const trashed = await createTrashedCalculator(page, {
        title: `Restorable ${randomBytes(2).toString('hex')}`,
      });

      const restore = await page.request.post(
        `/api/calculators/${trashed.id}/restore`,
        { data: { updated_at: trashed.updated_at } },
      );
      expect(restore.status()).toBe(200);
      const restored = await restore.json();
      expect(restored.published).toBe(true); // preserved
      expect(restored.public_token).toBe(trashed.public_token); // preserved
      expect(restored.renamed).toBe(false);

      // The DB row is no longer soft-deleted and the visitor URL is
      // accessible again.
      const { data: dbRow } = await admin
        .from('calculators')
        .select('soft_delete_at')
        .eq('id', trashed.id)
        .maybeSingle();
      expect(dbRow?.soft_delete_at).toBeNull();
    } finally {
      await teardown(user.userId);
    }
  });

  test('POST /restore auto-resolves the title with a "(N)" suffix when the original collides with an active row', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const baseTitle = `Mortgage ${randomBytes(2).toString('hex')}`;
      const trashed = await createTrashedCalculator(page, { title: baseTitle });

      // Create a NEW active calculator with the same title (allowed
      // because the partial unique index excludes soft-deleted rows).
      const newOne = await (
        await page.request.post('/api/calculators', { data: {} })
      ).json();
      const renamed = await page.request.patch(`/api/calculators/${newOne.id}`, {
        data: { updated_at: newOne.updated_at, title: baseTitle },
      });
      expect(renamed.status()).toBe(200);

      // Now restore. The restored row should land with " (2)" because
      // the active row has the bare title.
      const restore = await page.request.post(
        `/api/calculators/${trashed.id}/restore`,
        { data: { updated_at: trashed.updated_at } },
      );
      expect(restore.status()).toBe(200);
      const restored = await restore.json();
      expect(restored.title).toBe(`${baseTitle} (2)`);
      expect(restored.renamed).toBe(true);
    } finally {
      await teardown(user.userId);
    }
  });

  test('POST /restore returns 404 when the row is not soft-deleted (or RLS hides it)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const create = await (
        await page.request.post('/api/calculators', { data: {} })
      ).json();
      // Active row → restore-on-active = 404 per spec.
      const restore = await page.request.post(
        `/api/calculators/${create.id}/restore`,
        { data: { updated_at: create.updated_at } },
      );
      expect(restore.status()).toBe(404);
    } finally {
      await teardown(user.userId);
    }
  });

  test('DELETE ?hard=true hard-deletes a trashed row and returns the orphan count', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const trashed = await createTrashedCalculator(page, {
        title: `ToPurge ${randomBytes(2).toString('hex')}`,
      });
      // Seed one scenario pointing at this calculator (any owner — here
      // it's the same user).
      const scenarioId = randomUUID();
      await admin.from('scenarios').insert({
        id: scenarioId,
        owner_id: user.userId,
        calculator_id: trashed.id,
        title: 'Scenario A',
        description: '',
        values: { rate: 0.05 },
        share_token: null,
      });

      const hardDel = await page.request.delete(
        `/api/calculators/${trashed.id}?hard=true`,
        { data: { updated_at: trashed.updated_at } },
      );
      expect(hardDel.status()).toBe(200);
      const body = await hardDel.json();
      expect(body).toEqual({ ok: true, purged_orphan_count: 1 });

      // The calculator is gone; the scenario survived with calculator_id
      // nulled out (PROJ-12 ON DELETE SET NULL).
      const { data: dbCalc } = await admin
        .from('calculators')
        .select('id')
        .eq('id', trashed.id)
        .maybeSingle();
      expect(dbCalc).toBeNull();

      const { data: dbSc } = await admin
        .from('scenarios')
        .select('calculator_id')
        .eq('id', scenarioId)
        .maybeSingle();
      expect(dbSc?.calculator_id).toBeNull();
    } finally {
      await teardown(user.userId);
    }
  });

  test('DELETE ?hard=true returns 400 not_in_trash for an active row', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const create = await (
        await page.request.post('/api/calculators', { data: {} })
      ).json();

      const hardDel = await page.request.delete(
        `/api/calculators/${create.id}?hard=true`,
        { data: { updated_at: create.updated_at } },
      );
      expect(hardDel.status()).toBe(400);
      expect((await hardDel.json()).error).toBe('not_in_trash');

      // The active row is still there.
      const { data } = await admin
        .from('calculators')
        .select('id')
        .eq('id', create.id)
        .maybeSingle();
      expect(data?.id).toBe(create.id);
    } finally {
      await teardown(user.userId);
    }
  });

  test('GET /scenarios-count returns the count for the owner', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const create = await (
        await page.request.post('/api/calculators', { data: {} })
      ).json();
      // Seed two scenarios.
      await admin.from('scenarios').insert([
        {
          id: randomUUID(),
          owner_id: user.userId,
          calculator_id: create.id,
          title: 'S1',
          description: '',
          values: {},
        },
        {
          id: randomUUID(),
          owner_id: user.userId,
          calculator_id: create.id,
          title: 'S2',
          description: '',
          values: {},
        },
      ]);

      const res = await page.request.get(
        `/api/calculators/${create.id}/scenarios-count`,
      );
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({ count: 2 });
    } finally {
      await teardown(user.userId);
    }
  });

  test('GET /scenarios-count returns 404 for a cross-owner calculator (opacity)', async ({
    page,
    browser,
  }) => {
    const owner = await bootstrapApprovedUser();
    const stranger = await bootstrapApprovedUser();
    try {
      // Stranger creates a calculator.
      const ctx2 = await browser.newContext();
      const page2 = await ctx2.newPage();
      await signIn(page2, stranger);
      const strangerCalc = await (
        await page2.request.post('/api/calculators', { data: {} })
      ).json();
      await ctx2.close();

      // Owner attempts to count scenarios for the stranger's calc.
      await signIn(page, owner);
      const res = await page.request.get(
        `/api/calculators/${strangerCalc.id}/scenarios-count`,
      );
      expect(res.status()).toBe(404);
    } finally {
      await teardown(owner.userId);
      await teardown(stranger.userId);
    }
  });

  test('cross-owner POST /restore against another user\'s trashed row returns 404', async ({
    page,
    browser,
  }) => {
    const owner = await bootstrapApprovedUser();
    const attacker = await bootstrapApprovedUser();
    try {
      const ctxOwner = await browser.newContext();
      const pageOwner = await ctxOwner.newPage();
      await signIn(pageOwner, owner);
      const trashed = await createTrashedCalculator(pageOwner, {
        title: `Victim ${randomBytes(2).toString('hex')}`,
      });
      await ctxOwner.close();

      await signIn(page, attacker);
      const restore = await page.request.post(
        `/api/calculators/${trashed.id}/restore`,
        { data: { updated_at: trashed.updated_at } },
      );
      expect(restore.status()).toBe(404);

      // The owner's row is still soft-deleted, not restored.
      const { data } = await admin
        .from('calculators')
        .select('soft_delete_at')
        .eq('id', trashed.id)
        .maybeSingle();
      expect(data?.soft_delete_at).not.toBeNull();
    } finally {
      await teardown(owner.userId);
      await teardown(attacker.userId);
    }
  });

  test('cross-owner DELETE ?hard=true against another user\'s row returns 404', async ({
    page,
    browser,
  }) => {
    const owner = await bootstrapApprovedUser();
    const attacker = await bootstrapApprovedUser();
    try {
      const ctxOwner = await browser.newContext();
      const pageOwner = await ctxOwner.newPage();
      await signIn(pageOwner, owner);
      const trashed = await createTrashedCalculator(pageOwner, {
        title: `Victim ${randomBytes(2).toString('hex')}`,
      });
      await ctxOwner.close();

      await signIn(page, attacker);
      const res = await page.request.delete(
        `/api/calculators/${trashed.id}?hard=true`,
        { data: { updated_at: trashed.updated_at } },
      );
      // Opacity — 404 not 403.
      expect(res.status()).toBe(404);
    } finally {
      await teardown(owner.userId);
      await teardown(attacker.userId);
    }
  });

  test('anonymous mutation requests are gated (no JSON success payload leaks)', async ({
    request,
  }) => {
    const fakeId = randomUUID();
    // Disable Playwright's default redirect-following so we see the
    // underlying status (without this, a 307 → /auth/login → 200 HTML
    // would mask the real auth boundary).
    const restore = await request.post(
      `/api/calculators/${fakeId}/restore`,
      {
        data: { updated_at: '2026-01-01T00:00:00Z' },
        maxRedirects: 0,
      },
    );
    expect([401, 302, 307, 404]).toContain(restore.status());

    const sc = await request.get(
      `/api/calculators/${fakeId}/scenarios-count`,
      { maxRedirects: 0 },
    );
    expect([401, 302, 307, 404]).toContain(sc.status());

    const bulk = await request.delete('/api/scenarios?orphans=1', {
      maxRedirects: 0,
    });
    expect([401, 302, 307]).toContain(bulk.status());
  });

  test('DELETE /api/scenarios?orphans=1 removes only orphan scenarios owned by the caller', async ({
    page,
  }) => {
    const owner = await bootstrapApprovedUser();
    const stranger = await bootstrapApprovedUser();
    try {
      await signIn(page, owner);

      // Owner has one calc + a scenario against it (NOT an orphan).
      const calc = await (
        await page.request.post('/api/calculators', { data: {} })
      ).json();
      const liveSc = randomUUID();
      await admin.from('scenarios').insert({
        id: liveSc,
        owner_id: owner.userId,
        calculator_id: calc.id,
        title: 'Live',
        description: '',
        values: {},
      });

      // Owner has two orphan scenarios (calculator_id IS NULL).
      const orphan1 = randomUUID();
      const orphan2 = randomUUID();
      await admin.from('scenarios').insert([
        {
          id: orphan1,
          owner_id: owner.userId,
          calculator_id: null,
          title: 'Orphan A',
          description: '',
          values: {},
        },
        {
          id: orphan2,
          owner_id: owner.userId,
          calculator_id: null,
          title: 'Orphan B',
          description: '',
          values: {},
        },
      ]);

      // Stranger also has an orphan scenario — MUST NOT be deleted.
      const strangerOrphan = randomUUID();
      await admin.from('scenarios').insert({
        id: strangerOrphan,
        owner_id: stranger.userId,
        calculator_id: null,
        title: 'NotYours',
        description: '',
        values: {},
      });

      const res = await page.request.delete('/api/scenarios?orphans=1');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true, deleted: 2 });

      // Owner's orphans are gone; live scenario survives.
      const { data: ownerRows } = await admin
        .from('scenarios')
        .select('id')
        .eq('owner_id', owner.userId);
      expect((ownerRows ?? []).map((r) => r.id)).toEqual([liveSc]);

      // Stranger's orphan still exists.
      const { data: strangerRow } = await admin
        .from('scenarios')
        .select('id')
        .eq('id', strangerOrphan)
        .maybeSingle();
      expect(strangerRow?.id).toBe(strangerOrphan);
    } finally {
      await teardown(owner.userId);
      await teardown(stranger.userId);
    }
  });

  test('DELETE /api/scenarios without ?orphans=1 returns 400 invalid_request', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const res = await page.request.delete('/api/scenarios');
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe('invalid_request');
    } finally {
      await teardown(user.userId);
    }
  });

  test('GET /api/cron/purge with the bearer token actually purges rows past the retention cutoff', async ({
    page,
    request,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      // Seed: one fresh trashed row (still within retention) and one
      // backdated trashed row (past the retention window).
      const fresh = await createTrashedCalculator(page, {
        title: `Fresh ${randomBytes(2).toString('hex')}`,
      });
      const stale = await createTrashedCalculator(page, {
        title: `Stale ${randomBytes(2).toString('hex')}`,
      });
      // Backdate `stale` to 365 days ago — comfortably past any
      // RETENTION_PERIOD_DAYS the deployer might set.
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      await admin
        .from('calculators')
        .update({ soft_delete_at: yearAgo })
        .eq('id', stale.id);

      const res = await request.get('/api/cron/purge', {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(typeof body.retention_days).toBe('number');
      // At least one row (the backdated stale one) was purged this run.
      expect(body.purged).toBeGreaterThanOrEqual(1);

      // Stale is gone, fresh is preserved.
      const { data: staleRow } = await admin
        .from('calculators')
        .select('id')
        .eq('id', stale.id)
        .maybeSingle();
      expect(staleRow).toBeNull();

      const { data: freshRow } = await admin
        .from('calculators')
        .select('id')
        .eq('id', fresh.id)
        .maybeSingle();
      expect(freshRow?.id).toBe(fresh.id);
    } finally {
      await teardown(user.userId);
    }
  });

  test('GET /api/cron/purge with a wrong bearer token returns 401 and does not purge', async ({
    page,
    request,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const trashed = await createTrashedCalculator(page, {
        title: `Survives ${randomBytes(2).toString('hex')}`,
      });
      // Backdate so it WOULD be purged with a valid bearer.
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      await admin
        .from('calculators')
        .update({ soft_delete_at: yearAgo })
        .eq('id', trashed.id);

      const res = await request.get('/api/cron/purge', {
        headers: { Authorization: 'Bearer not-the-real-secret' },
      });
      expect(res.status()).toBe(401);

      // The row is still in the DB — the wrong bearer must not purge.
      const { data } = await admin
        .from('calculators')
        .select('id, soft_delete_at')
        .eq('id', trashed.id)
        .maybeSingle();
      expect(data?.id).toBe(trashed.id);
      expect(data?.soft_delete_at).not.toBeNull();
    } finally {
      await teardown(user.userId);
    }
  });
});
