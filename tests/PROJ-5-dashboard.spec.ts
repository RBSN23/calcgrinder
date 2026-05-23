import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-5 — Account Dashboard.
 *
 * Bootstraps an approved user, signs in, and walks the dashboard chrome:
 *   - welcome line visible on desktop / hidden on mobile
 *   - exactly one section ("Presets") with the empty-state body
 *   - section header toggles the body
 *   - sysadmin sees the SYSADMIN pill inline (desktop)
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

async function bootstrapApprovedUser(
  role: 'registered' | 'sysadmin' = 'registered',
): Promise<ApprovedUser> {
  const suffix = randomBytes(4).toString('hex');
  const email = `e2e-proj5-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;
  const name = `Ada ${suffix}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createErr || !created.user) {
    throw new Error(`failed to bootstrap user: ${createErr?.message ?? 'no user'}`);
  }
  const userId = created.user.id;

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ status: 'approved', name, role })
    .eq('id', userId);
  if (updateErr) {
    throw new Error(`failed to approve profile: ${updateErr.message}`);
  }

  return { userId, email, password, name };
}

async function teardown(userId: string) {
  await admin.auth.admin.deleteUser(userId);
}

async function signIn(page: import('@playwright/test').Page, user: ApprovedUser) {
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await Promise.all([
    page.waitForURL(/\/dashboard$/),
    page.click('button[type="submit"]'),
  ]);
}

test.describe('PROJ-5 — Dashboard scaffold', () => {
  test('welcome line + Presets empty state + collapse/expand', async ({
    page,
    isMobile,
  }) => {
    const user = await bootstrapApprovedUser('registered');
    try {
      await signIn(page, user);

      const welcome = page.getByRole('heading', { level: 1, name: /welcome back/i });
      if (isMobile) {
        await expect(welcome).toHaveCount(0);
      } else {
        await expect(welcome).toBeVisible();
        await expect(welcome).toContainText(user.name);
        // No SYSADMIN pill for a regular user.
        await expect(page.locator('h1').getByText('SYSADMIN')).toHaveCount(0);
      }

      // Exactly one section rendered: Presets.
      const presetsTrigger = page.getByRole('button', { name: /presets/i });
      await expect(presetsTrigger).toHaveCount(1);
      await expect(presetsTrigger).toHaveAttribute('aria-expanded', 'true');

      // Empty state body is visible.
      await expect(
        page.getByRole('heading', { name: /no presets yet/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/curated calculators will appear here/i),
      ).toBeVisible();

      // No other sections render in PROJ-5.
      await expect(page.getByRole('button', { name: /my calculators/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /my scenarios/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^trash$/i })).toHaveCount(0);

      // Collapse → empty state hides.
      await presetsTrigger.click();
      await expect(presetsTrigger).toHaveAttribute('aria-expanded', 'false');
      await expect(
        page.getByRole('heading', { name: /no presets yet/i }),
      ).toBeHidden();

      // Expand again → empty state re-appears.
      await presetsTrigger.click();
      await expect(presetsTrigger).toHaveAttribute('aria-expanded', 'true');
      await expect(
        page.getByRole('heading', { name: /no presets yet/i }),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('sysadmin sees the SYSADMIN pill inline with the welcome heading (desktop)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'welcome line is desktop-only');

    const user = await bootstrapApprovedUser('sysadmin');
    try {
      await signIn(page, user);
      const h1 = page.getByRole('heading', { level: 1, name: /welcome back/i });
      await expect(h1).toBeVisible();
      await expect(h1.getByText('SYSADMIN')).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });
});
