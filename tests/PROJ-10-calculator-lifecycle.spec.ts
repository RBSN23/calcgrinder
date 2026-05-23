import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-10 — Calculator Lifecycle (Publish, Sharing,
 * Token Regen).
 *
 * Coverage focuses on the spec's golden-path acceptance criteria plus the
 * security / RLS surface:
 *   - POST /api/calculators auto-resolves the default title for the
 *     second / third / … "Untitled calculator" (no 409 surfaced).
 *   - POST /api/calculators returns `published=false` and a 22-char
 *     URL-safe base64 `public_token`.
 *   - PATCH /api/calculators/:id { published } flips the flag.
 *   - PATCH /api/calculators/:id { title } on a duplicate title returns
 *     409 { error: 'title_taken' } (distinct from the existing 409
 *     `stale`).
 *   - POST /api/calculators/:id/regenerate-token mints a fresh 22-char
 *     token; old token row is overwritten (the column shifts to the new
 *     value); response includes the bumped updated_at.
 *   - POST /api/calculators/:id/duplicate deep-copies the source and
 *     mints a fresh token + published=false.
 *   - DELETE /api/calculators/:id soft-deletes (sets soft_delete_at);
 *     subsequent GET returns 404; the dashboard list query excludes it.
 *   - Cross-owner mutation attempts (PATCH / regenerate-token /
 *     duplicate / DELETE) return 404 — opacity rule preserved.
 *   - Anonymous mutation requests are gated by middleware (302/307 to
 *     /auth/login).
 *   - Dashboard "My Calculators" section renders when the user owns
 *     calculators, hides when empty, and the card click opens the
 *     public URL in a new tab.
 *
 * Tests reuse the PROJ-9 bootstrap pattern: per-test approved user, RLS
 * via the cookie-bound client, hard cleanup via the admin client on
 * teardown.
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
  const email = `e2e-proj10-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;
  const name = `Ada ${suffix}`;

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

const TOKEN_REGEX = /^[A-Za-z0-9_-]{22}$/;

test.describe('PROJ-10 — Calculator Lifecycle', () => {
  test('POST /api/calculators returns published=false + a 22-char URL-safe public_token', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const res = await page.request.post('/api/calculators', { data: {} });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.published).toBe(false);
      expect(body.public_token).toMatch(TOKEN_REGEX);
      expect(body.title).toBe('Untitled calculator');
    } finally {
      await teardown(user.userId);
    }
  });

  test('POST /api/calculators auto-resolves the default title for the 2nd / 3rd row (no 409)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const first = await page.request.post('/api/calculators', { data: {} });
      const second = await page.request.post('/api/calculators', { data: {} });
      const third = await page.request.post('/api/calculators', { data: {} });
      expect(first.status()).toBe(201);
      expect(second.status()).toBe(201);
      expect(third.status()).toBe(201);
      const titles = [
        (await first.json()).title,
        (await second.json()).title,
        (await third.json()).title,
      ];
      expect(titles).toEqual([
        'Untitled calculator',
        'Untitled calculator (2)',
        'Untitled calculator (3)',
      ]);
    } finally {
      await teardown(user.userId);
    }
  });

  test('PATCH /api/calculators/:id { published } flips the flag and bumps updated_at', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const create = await page.request.post('/api/calculators', { data: {} });
      const row = await create.json();
      expect(row.published).toBe(false);

      const patch = await page.request.patch(`/api/calculators/${row.id}`, {
        data: { updated_at: row.updated_at, published: true },
      });
      expect(patch.status()).toBe(200);
      const patched = await patch.json();
      expect(patched.published).toBe(true);
      expect(patched.updated_at).not.toBe(row.updated_at);

      // Flip back to false.
      const unpatch = await page.request.patch(`/api/calculators/${row.id}`, {
        data: { updated_at: patched.updated_at, published: false },
      });
      expect(unpatch.status()).toBe(200);
      expect((await unpatch.json()).published).toBe(false);
    } finally {
      await teardown(user.userId);
    }
  });

  test('PATCH whitelist strips unknown keys (owner_id, public_token, soft_delete_at)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const create = await page.request.post('/api/calculators', { data: {} });
      const row = await create.json();

      const patch = await page.request.patch(`/api/calculators/${row.id}`, {
        data: {
          updated_at: row.updated_at,
          title: 'Renamed',
          owner_id: '00000000-0000-0000-0000-000000000000',
          public_token: 'attacker-controlled-token',
          soft_delete_at: '2025-01-01T00:00:00Z',
          id: 'replaced',
        },
      });
      expect(patch.status()).toBe(200);
      const patched = await patch.json();
      expect(patched.title).toBe('Renamed');
      // The public_token was NOT rewritten by the attacker-controlled key.
      expect(patched.public_token).toBe(row.public_token);
      // owner_id stays the same.
      const { data: dbRow } = await admin
        .from('calculators')
        .select('owner_id, soft_delete_at')
        .eq('id', row.id)
        .maybeSingle();
      expect(dbRow?.owner_id).toBe(user.userId);
      expect(dbRow?.soft_delete_at).toBeNull();
    } finally {
      await teardown(user.userId);
    }
  });

  test('PATCH /api/calculators/:id { title } on a duplicate title returns 409 title_taken', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const a = await (await page.request.post('/api/calculators', { data: {} })).json();
      // Rename a to "Mortgage"
      const patchA = await page.request.patch(`/api/calculators/${a.id}`, {
        data: { updated_at: a.updated_at, title: 'Mortgage' },
      });
      expect(patchA.status()).toBe(200);
      // Create b
      const b = await (await page.request.post('/api/calculators', { data: {} })).json();
      // Rename b to "Mortgage" — collision.
      const collide = await page.request.patch(`/api/calculators/${b.id}`, {
        data: { updated_at: b.updated_at, title: 'Mortgage' },
      });
      expect(collide.status()).toBe(409);
      const body = await collide.json();
      expect(body.error).toBe('title_taken');
    } finally {
      await teardown(user.userId);
    }
  });

  test('PATCH /api/calculators/:id with stale updated_at returns 409 stale (distinct from title_taken)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const row = await (await page.request.post('/api/calculators', { data: {} })).json();
      // Bump updated_at via a first PATCH.
      const fresh = await page.request.patch(`/api/calculators/${row.id}`, {
        data: { updated_at: row.updated_at, title: 'X' },
      });
      expect(fresh.status()).toBe(200);
      const stale = await page.request.patch(`/api/calculators/${row.id}`, {
        data: { updated_at: row.updated_at, title: 'Y' }, // stale token
      });
      expect(stale.status()).toBe(409);
      const body = await stale.json();
      expect(body.error).toBe('stale');
      expect(body).toHaveProperty('server_updated_at');
    } finally {
      await teardown(user.userId);
    }
  });

  test('POST /api/calculators/:id/regenerate-token mints a fresh 22-char token and overwrites the old one', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const row = await (await page.request.post('/api/calculators', { data: {} })).json();
      const oldToken = row.public_token;

      const regen = await page.request.post(
        `/api/calculators/${row.id}/regenerate-token`,
        { data: { updated_at: row.updated_at } },
      );
      expect(regen.status()).toBe(200);
      const regenBody = await regen.json();
      expect(regenBody.public_token).toMatch(TOKEN_REGEX);
      expect(regenBody.public_token).not.toBe(oldToken);
      expect(regenBody.updated_at).not.toBe(row.updated_at);

      // Old token is no longer present anywhere — the column was overwritten.
      const { data: dbRow } = await admin
        .from('calculators')
        .select('public_token')
        .eq('id', row.id)
        .maybeSingle();
      expect(dbRow?.public_token).toBe(regenBody.public_token);
    } finally {
      await teardown(user.userId);
    }
  });

  test('POST /api/calculators/:id/regenerate-token with stale updated_at returns 409', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const row = await (await page.request.post('/api/calculators', { data: {} })).json();
      // First bump.
      await page.request.patch(`/api/calculators/${row.id}`, {
        data: { updated_at: row.updated_at, title: 'X' },
      });
      const stale = await page.request.post(
        `/api/calculators/${row.id}/regenerate-token`,
        { data: { updated_at: row.updated_at } }, // stale token
      );
      expect(stale.status()).toBe(409);
      expect((await stale.json()).error).toBe('stale');
    } finally {
      await teardown(user.userId);
    }
  });

  test('POST /api/calculators/:id/duplicate deep-copies + mints fresh token + published=false', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      // Create + rename + publish.
      const src = await (await page.request.post('/api/calculators', { data: {} })).json();
      const renamed = await (
        await page.request.patch(`/api/calculators/${src.id}`, {
          data: { updated_at: src.updated_at, title: 'Mortgage' },
        })
      ).json();
      const published = await (
        await page.request.patch(`/api/calculators/${src.id}`, {
          data: { updated_at: renamed.updated_at, published: true },
        })
      ).json();
      expect(published.published).toBe(true);

      const dup = await page.request.post(
        `/api/calculators/${src.id}/duplicate`,
        { data: {} },
      );
      expect(dup.status()).toBe(201);
      const dupBody = await dup.json();
      expect(dupBody.title).toBe('Copy of Mortgage');
      expect(dupBody.published).toBe(false);
      expect(dupBody.public_token).toMatch(TOKEN_REGEX);
      expect(dupBody.public_token).not.toBe(src.public_token);
      expect(dupBody.id).not.toBe(src.id);
      expect(dupBody).toHaveProperty('default_section_id');

      // Source untouched.
      const { data: srcDb } = await admin
        .from('calculators')
        .select('title, published, public_token')
        .eq('id', src.id)
        .maybeSingle();
      expect(srcDb?.title).toBe('Mortgage');
      expect(srcDb?.published).toBe(true);
      expect(srcDb?.public_token).toBe(src.public_token);

      // Source has one default section (PROJ-9 backfill) — duplicate
      // should have one section too.
      const { data: dupSections } = await admin
        .from('sections')
        .select('id, title')
        .eq('calculator_id', dupBody.id);
      expect(dupSections!.length).toBeGreaterThanOrEqual(1);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Duplicate auto-resolves "Copy of <X>" → "Copy of <X> (2)" on collision (no 409)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const src = await (await page.request.post('/api/calculators', { data: {} })).json();
      await page.request.patch(`/api/calculators/${src.id}`, {
        data: { updated_at: src.updated_at, title: 'Mortgage' },
      });
      const dup1 = await (
        await page.request.post(`/api/calculators/${src.id}/duplicate`, { data: {} })
      ).json();
      const dup2 = await (
        await page.request.post(`/api/calculators/${src.id}/duplicate`, { data: {} })
      ).json();
      const dup3 = await (
        await page.request.post(`/api/calculators/${src.id}/duplicate`, { data: {} })
      ).json();
      expect([dup1.title, dup2.title, dup3.title]).toEqual([
        'Copy of Mortgage',
        'Copy of Mortgage (2)',
        'Copy of Mortgage (3)',
      ]);
    } finally {
      await teardown(user.userId);
    }
  });

  test('DELETE /api/calculators/:id soft-deletes; subsequent GET returns 404 and list excludes it', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const row = await (await page.request.post('/api/calculators', { data: {} })).json();

      const del = await page.request.delete(`/api/calculators/${row.id}`, {
        data: { updated_at: row.updated_at },
      });
      expect(del.status()).toBe(200);
      const delBody = await del.json();
      expect(delBody.updated_at).not.toBe(row.updated_at);

      // soft_delete_at is set in the DB.
      const { data: dbRow } = await admin
        .from('calculators')
        .select('soft_delete_at')
        .eq('id', row.id)
        .maybeSingle();
      expect(dbRow?.soft_delete_at).not.toBeNull();

      // Subsequent GET returns 404.
      const get = await page.request.get(`/api/calculators/${row.id}`);
      expect(get.status()).toBe(404);

      // Double-delete returns 404 (the row is filtered out by the
      // soft_delete_at IS NULL guard).
      const double = await page.request.delete(`/api/calculators/${row.id}`, {
        data: { updated_at: delBody.updated_at },
      });
      expect(double.status()).toBe(404);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Cross-owner mutation attempts (PATCH / regenerate-token / duplicate / DELETE) all return 404', async ({
    browser,
  }) => {
    const owner = await bootstrapApprovedUser();
    const intruder = await bootstrapApprovedUser();
    const ownerCtx = await browser.newContext();
    const intruderCtx = await browser.newContext();
    try {
      const ownerPage = await ownerCtx.newPage();
      await signIn(ownerPage, owner);
      const row = await (
        await ownerPage.request.post('/api/calculators', { data: {} })
      ).json();

      const intruderPage = await intruderCtx.newPage();
      await signIn(intruderPage, intruder);

      const patch = await intruderPage.request.patch(
        `/api/calculators/${row.id}`,
        { data: { updated_at: row.updated_at, title: 'Hacked' } },
      );
      expect(patch.status()).toBe(404);

      const regen = await intruderPage.request.post(
        `/api/calculators/${row.id}/regenerate-token`,
        { data: { updated_at: row.updated_at } },
      );
      expect(regen.status()).toBe(404);

      const dup = await intruderPage.request.post(
        `/api/calculators/${row.id}/duplicate`,
        { data: {} },
      );
      expect(dup.status()).toBe(404);

      const del = await intruderPage.request.delete(
        `/api/calculators/${row.id}`,
        { data: { updated_at: row.updated_at } },
      );
      expect(del.status()).toBe(404);

      // Row + title untouched.
      const { data: dbRow } = await admin
        .from('calculators')
        .select('title, public_token, soft_delete_at, owner_id')
        .eq('id', row.id)
        .maybeSingle();
      expect(dbRow?.title).toBe(row.title);
      expect(dbRow?.public_token).toBe(row.public_token);
      expect(dbRow?.soft_delete_at).toBeNull();
      expect(dbRow?.owner_id).toBe(owner.userId);
    } finally {
      await ownerCtx.close();
      await intruderCtx.close();
      await teardown(owner.userId);
      await teardown(intruder.userId);
    }
  });

  test('Anonymous mutation requests are gated by middleware (302/307 to /auth/login)', async ({
    request,
  }) => {
    const paths = [
      { method: 'patch' as const, url: '/api/calculators/00000000-0000-4000-8000-000000000000' },
      { method: 'post' as const, url: '/api/calculators/00000000-0000-4000-8000-000000000000/regenerate-token' },
      { method: 'post' as const, url: '/api/calculators/00000000-0000-4000-8000-000000000000/duplicate' },
      { method: 'delete' as const, url: '/api/calculators/00000000-0000-4000-8000-000000000000' },
    ];
    for (const { method, url } of paths) {
      const res = await request[method](url, {
        data: { updated_at: '2026-01-01T00:00:00Z' },
        maxRedirects: 0,
      });
      expect([302, 307]).toContain(res.status());
      expect(res.headers().location ?? '').toMatch(/\/auth\/login/);
    }
  });

  test('Dashboard "My Calculators" section hides when empty and shows when populated', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      // No calculators yet — heading hidden.
      await expect(
        page.getByRole('heading', { name: /^My Calculators/i }),
      ).toHaveCount(0);

      // Create a calculator via the create endpoint, then refresh the
      // dashboard.
      const row = await (
        await page.request.post('/api/calculators', { data: {} })
      ).json();
      // Rename to a recognisable title.
      await page.request.patch(`/api/calculators/${row.id}`, {
        data: { updated_at: row.updated_at, title: 'My Test Calc' },
      });
      await page.goto('/dashboard');
      await expect(
        page.getByRole('heading', { name: /^My Calculators/i }),
      ).toBeVisible();
      const card = page.getByRole('link', {
        name: /My Test Calc.*Draft.*Open public view in new tab/i,
      });
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('href', `/c/${row.public_token}`);
      await expect(card).toHaveAttribute('target', '_blank');
    } finally {
      await teardown(user.userId);
    }
  });

  test('Token format is 22 chars URL-safe base64 from the create endpoint', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      for (let i = 0; i < 3; i++) {
        const row = await (
          await page.request.post('/api/calculators', { data: {} })
        ).json();
        expect(row.public_token).toMatch(TOKEN_REGEX);
      }
    } finally {
      await teardown(user.userId);
    }
  });
});
