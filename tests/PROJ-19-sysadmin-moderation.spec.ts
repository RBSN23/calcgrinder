import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-19 — Sysadmin Moderation.
 *
 * The Supabase Cloud instance is shared and may contain pre-existing data
 * from other test runs. All tests use random suffixes in calculator titles
 * and verify only their own seeded data — never exact counts or empty states.
 */

function loadEnv(key: string): string {
  const envPath = resolve(__dirname, '..', '.env.local');
  const contents = readFileSync(envPath, 'utf8');
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const match = contents.match(re);
  if (!match || !match[1]) throw new Error(`${key} not found in .env.local`);
  return match[1].trim().replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = loadEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SECRET = loadEnv('SUPABASE_SECRET_KEY');

const sb = createClient(SUPABASE_URL, SUPABASE_SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ApprovedUser = {
  userId: string;
  email: string;
  password: string;
  name: string;
  role: 'registered' | 'sysadmin';
};

function uid(): string {
  return randomBytes(4).toString('hex');
}

async function bootstrapUser(role: 'registered' | 'sysadmin'): Promise<ApprovedUser> {
  const suffix = uid();
  const email = `e2e-proj19-${role}-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;
  const name = `${role === 'sysadmin' ? 'Sys' : 'Reg'} ${suffix}`;
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });
  if (createErr || !created.user) throw new Error(`bootstrap: ${createErr?.message}`);
  const userId = created.user.id;
  const { error: updateErr } = await sb
    .from('profiles').update({ status: 'approved', name, role }).eq('id', userId);
  if (updateErr) throw new Error(`approve: ${updateErr.message}`);
  return { userId, email, password, name, role };
}

async function teardown(userId: string) {
  await sb.from('calculators').delete().eq('owner_id', userId);
  await sb.from('scenarios').delete().eq('visitor_id', userId);
  await sb.auth.admin.deleteUser(userId);
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

async function createCalcAs(
  ownerId: string,
  title: string,
  opts: { published?: boolean; soft_delete_at?: string | null; description?: string } = {},
): Promise<{ id: string; public_token: string; title: string; updated_at: string }> {
  const { data, error } = await sb
    .from('calculators')
    .insert({
      owner_id: ownerId, title, description: opts.description ?? '', theme_id: 'calcgrinder',
      published: opts.published ?? false,
      soft_delete_at: opts.soft_delete_at ?? null,
    })
    .select('id, public_token, title, updated_at')
    .single();
  if (error || !data) throw new Error(`seed: ${error?.message}`);
  return data;
}

async function createScenarioFor(
  calcId: string,
  ownerId: string,
  label: string = 'Test',
): Promise<string> {
  const { data, error } = await sb
    .from('scenarios')
    .insert({
      calculator_id: calcId,
      owner_id: ownerId,
      title: `Scenario ${label}`,
      description: '',
      values: {},
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`scenario: ${error?.message}`);
  return data.id;
}

function sectionLocator(page: Page) {
  return page.locator('section').filter({
    has: page.locator('h2', { hasText: 'User Calculators' }),
  });
}

function expandSection(section: ReturnType<typeof sectionLocator>) {
  return section.locator('button').first().click();
}

function cardLocator(section: ReturnType<typeof sectionLocator>, title: string) {
  return section.locator('a').filter({ hasText: title });
}

// ---------------------------------------------------------------------------
// Section Visibility
// ---------------------------------------------------------------------------

test.describe('PROJ-19 — Section visibility', () => {
  test('AC1: Sysadmin sees "User Calculators" section with danger tint', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(regular.userId, `Vis-${tag}`, { published: false });
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expect(section).toBeVisible();
      await expect(section).toHaveClass(/cg-danger/);

      const allSections = page.locator('.flex.flex-col.gap-3 section');
      const count = await allSections.count();
      expect(count).toBeGreaterThan(0);
      const lastSection = allSections.nth(count - 1);
      await expect(lastSection.locator('h2', { hasText: 'User Calculators' })).toBeVisible();
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC2: Non-sysadmin does NOT see the "User Calculators" section', async ({ page }) => {
    test.setTimeout(60_000);
    const regular = await bootstrapUser('registered');
    const other = await bootstrapUser('registered');
    try {
      await createCalcAs(other.userId, `Hidden-${uid()}`, { published: true });
      await signIn(page, regular);
      await expect(sectionLocator(page)).toHaveCount(0);
    } finally {
      await teardown(other.userId);
      await teardown(regular.userId);
    }
  });

  test('AC3: Sysadmin own calculators do not appear in User Calculators section', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(sysadmin.userId, `OwnOnly-${tag}`, { published: true });
      await createCalcAs(regular.userId, `Other-${tag}`, { published: false });
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      await expect(cardLocator(section, `Other-${tag}`)).toBeVisible();
      await expect(cardLocator(section, `OwnOnly-${tag}`)).toHaveCount(0);
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// Section Content
// ---------------------------------------------------------------------------

test.describe('PROJ-19 — Section content', () => {
  test('AC4: Card shows title, description, owner name, timestamp, Published pill, Public Link icon', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(regular.userId, `Mortgage-${tag}`, {
        published: true,
        description: 'A detailed mortgage calculator.',
      });
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `Mortgage-${tag}`);
      await expect(card).toBeVisible();
      await expect(card.locator('p', { hasText: 'A detailed mortgage calculator' })).toBeVisible();
      await expect(card.locator(`text=by ${regular.name}`)).toBeVisible();
      await expect(card.locator('text=Edited')).toBeVisible();
      await expect(card.locator('text=Published')).toBeVisible();
      await expect(card.locator('button[aria-label="Open public view in new tab"]')).toBeVisible();
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC4 (Draft): Draft calculator shows Draft pill', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(regular.userId, `Draft-${tag}`, { published: false });
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `Draft-${tag}`);
      await expect(card).toBeVisible();
      await expect(card.getByText('Draft', { exact: true })).toBeVisible();
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC6: Count pill reflects seeded calculators', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(regular.userId, `A-${tag}`);
      await createCalcAs(regular.userId, `B-${tag}`);
      await createCalcAs(regular.userId, `C-${tag}`);

      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      const countPill = section.locator('span.font-mono');
      const countText = await countPill.textContent();
      const count = parseInt(countText ?? '0', 10);
      expect(count).toBeGreaterThanOrEqual(3);

      await expandSection(section);
      await expect(cardLocator(section, `A-${tag}`)).toBeVisible();
      await expect(cardLocator(section, `B-${tag}`)).toBeVisible();
      await expect(cardLocator(section, `C-${tag}`)).toBeVisible();
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC7: Published calculator card links to public view in new tab', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      const calc = await createCalcAs(regular.userId, `Pub-${tag}`, { published: true });
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `Pub-${tag}`);
      await expect(card).toBeVisible();
      const href = await card.getAttribute('href');
      expect(href).toBe(`/c/${calc.public_token}`);
      const target = await card.getAttribute('target');
      expect(target).toBe('_blank');
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// Delete Permanently Action
// ---------------------------------------------------------------------------

test.describe('PROJ-19 — Delete permanently action', () => {
  test('AC8: Kebab menu has single "Delete permanently" option in red', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(regular.userId, `Kebab-${tag}`);
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `Kebab-${tag}`);
      await card.locator('button[aria-label="More actions"]').click();

      const dropdown = page.locator('[role="menu"]');
      await expect(dropdown).toBeVisible();
      const menuItems = dropdown.locator('[role="menuitem"]');
      await expect(menuItems).toHaveCount(1);
      const deleteItem = menuItems.first();
      await expect(deleteItem).toHaveText(/Delete permanently/);
      await expect(deleteItem).toHaveClass(/text-red-600/);
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC9: Confirmation sheet displays correct message with calculator title', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(regular.userId, `Sheet-${tag}`);
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `Sheet-${tag}`);
      await card.locator('button[aria-label="More actions"]').click();
      await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Delete permanently' }).click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(`Sheet-${tag}`);
      await expect(dialog).toContainText('This will also delete all scenarios linked to this calculator');
      await expect(dialog).toContainText('This cannot be undone');
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC10: Confirmation sheet shows scenarios count when > 0', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      const calc = await createCalcAs(regular.userId, `Scen-${tag}`, { published: true });
      await createScenarioFor(calc.id, regular.userId, 'Alice');
      await createScenarioFor(calc.id, regular.userId, 'Bob');
      await createScenarioFor(calc.id, regular.userId, 'Charlie');

      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `Scen-${tag}`);
      await card.locator('button[aria-label="More actions"]').click();
      await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Delete permanently' }).click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('3 scenarios will be permanently deleted', { timeout: 10_000 });
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC10 (zero scenarios): Count line omitted when N = 0', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(regular.userId, `NoScen-${tag}`);
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `NoScen-${tag}`);
      await card.locator('button[aria-label="More actions"]').click();
      await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Delete permanently' }).click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(2_000);

      const dialogText = await dialog.textContent();
      expect(dialogText).not.toContain('scenarios will be permanently deleted');
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC11: Successful delete shows toast, card disappears, DB row gone', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      const calc = await createCalcAs(regular.userId, `Del-${tag}`);
      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `Del-${tag}`);
      await expect(card).toBeVisible();

      await card.locator('button[aria-label="More actions"]').click();
      await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Delete permanently' }).click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await dialog.locator('button', { hasText: 'Delete permanently' }).click();

      await expect(page.locator('[data-sonner-toast]')).toContainText(
        'Permanently deleted',
        { timeout: 10_000 },
      );
      await expect(page.locator('a').filter({ hasText: `Del-${tag}` })).toHaveCount(0, { timeout: 10_000 });

      const { data: dbRow } = await sb
        .from('calculators').select('id').eq('id', calc.id).maybeSingle();
      expect(dbRow).toBeNull();
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('AC11 cascade: Scenarios are hard-deleted alongside the calculator', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      const calc = await createCalcAs(regular.userId, `Casc-${tag}`, { published: true });
      const s1 = await createScenarioFor(calc.id, regular.userId, 'Alice');
      const s2 = await createScenarioFor(calc.id, regular.userId, 'Bob');

      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      const card = cardLocator(section, `Casc-${tag}`);
      await card.locator('button[aria-label="More actions"]').click();
      await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Delete permanently' }).click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await dialog.locator('button', { hasText: 'Delete permanently' }).click();

      await expect(page.locator('[data-sonner-toast]')).toContainText(
        'Permanently deleted',
        { timeout: 10_000 },
      );

      const { data: scenarios } = await sb
        .from('scenarios').select('id').in('id', [s1, s2]);
      expect(scenarios).toEqual([]);
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// API Authorization
// ---------------------------------------------------------------------------

test.describe('PROJ-19 — API authorization', () => {
  test('AC13: Non-sysadmin calling DELETE /api/admin/calculators/:id gets 403', async ({ page }) => {
    test.setTimeout(60_000);
    const regular = await bootstrapUser('registered');
    const other = await bootstrapUser('registered');
    try {
      const calc = await createCalcAs(other.userId, `Forbid-${uid()}`);
      await signIn(page, regular);

      const res = await page.request.delete(`/api/admin/calculators/${calc.id}`);
      expect(res.status()).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
    } finally {
      await teardown(other.userId);
      await teardown(regular.userId);
    }
  });

  test('AC14: Unauthenticated request is blocked (middleware 307 redirect)', async () => {
    test.setTimeout(60_000);
    const regular = await bootstrapUser('registered');
    try {
      const calc = await createCalcAs(regular.userId, `Unauth-${uid()}`);

      // The app's middleware intercepts unauthenticated requests on private
      // paths and issues a 307 redirect to /auth/login BEFORE the route
      // handler runs. The route handler's own 401 is defense-in-depth.
      const res = await fetch(
        `http://localhost:3000/api/admin/calculators/${calc.id}`,
        { method: 'DELETE', redirect: 'manual' },
      );
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/login');
    } finally {
      await teardown(regular.userId);
    }
  });

  test('AC15: Sysadmin deleting non-existent calculator gets 404', async ({ page }) => {
    test.setTimeout(60_000);
    const sysadmin = await bootstrapUser('sysadmin');
    try {
      await signIn(page, sysadmin);
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await page.request.delete(`/api/admin/calculators/${fakeId}`);
      expect(res.status()).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    } finally {
      await teardown(sysadmin.userId);
    }
  });

  test('Sysadmin cannot delete own calculator via moderation endpoint (403)', async ({ page }) => {
    test.setTimeout(60_000);
    const sysadmin = await bootstrapUser('sysadmin');
    try {
      const calc = await createCalcAs(sysadmin.userId, `Own-${uid()}`);
      await signIn(page, sysadmin);

      const res = await page.request.delete(`/api/admin/calculators/${calc.id}`);
      expect(res.status()).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
    } finally {
      await teardown(sysadmin.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// Server-side Data Fetch
// ---------------------------------------------------------------------------

test.describe('PROJ-19 — Server-side data fetch', () => {
  test('AC16 + AC17: Active calculators visible, soft-deleted excluded', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const regular = await bootstrapUser('registered');
    try {
      await createCalcAs(regular.userId, `Active-${tag}`, { published: true });
      await createCalcAs(regular.userId, `Trashed-${tag}`, {
        published: true,
        soft_delete_at: new Date().toISOString(),
      });

      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      await expect(cardLocator(section, `Active-${tag}`)).toBeVisible();
      await expect(cardLocator(section, `Trashed-${tag}`)).toHaveCount(0);
    } finally {
      await teardown(regular.userId);
      await teardown(sysadmin.userId);
    }
  });

  test('Multiple users calculators appear with correct owner names', async ({ page }) => {
    test.setTimeout(60_000);
    const tag = uid();
    const sysadmin = await bootstrapUser('sysadmin');
    const user1 = await bootstrapUser('registered');
    const user2 = await bootstrapUser('registered');
    try {
      await createCalcAs(user1.userId, `U1A-${tag}`, { published: true });
      await createCalcAs(user1.userId, `U1B-${tag}`);
      await createCalcAs(user2.userId, `U2X-${tag}`, { published: true });

      await signIn(page, sysadmin);

      const section = sectionLocator(page);
      await expandSection(section);

      await expect(cardLocator(section, `U1A-${tag}`)).toBeVisible();
      await expect(cardLocator(section, `U1B-${tag}`)).toBeVisible();
      await expect(cardLocator(section, `U2X-${tag}`)).toBeVisible();

      await expect(section.locator(`text=by ${user1.name}`)).toHaveCount(2);
      await expect(section.locator(`text=by ${user2.name}`)).toHaveCount(1);
    } finally {
      await teardown(user2.userId);
      await teardown(user1.userId);
      await teardown(sysadmin.userId);
    }
  });
});
