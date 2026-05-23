import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-4 — App Shell, Routing & Top-Level Navigation.
 *
 * Bootstraps an *already-approved* user directly against the linked
 * Supabase Cloud project, then walks the signed-in chrome:
 *   dashboard → avatar popover → dark theme → settings (breadcrumb
 *   visible) → /dashboard/nope → not-found → Go to Dashboard.
 *
 * Cleanup deletes the user on test teardown.
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
};

async function bootstrapApprovedUser(): Promise<ApprovedUser> {
  const suffix = randomBytes(4).toString('hex');
  const email = `e2e-proj4-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `Ada ${suffix}` },
  });
  if (createErr || !created.user) {
    throw new Error(`failed to bootstrap user: ${createErr?.message ?? 'no user'}`);
  }
  const userId = created.user.id;

  // The handle_new_user trigger created a pending profiles row. Approve it
  // and ensure the name matches the metadata.
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ status: 'approved', name: `Ada ${suffix}` })
    .eq('id', userId);
  if (updateErr) {
    throw new Error(`failed to approve profile: ${updateErr.message}`);
  }

  return { userId, email, password };
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

test.describe('PROJ-4 — App Shell walkthrough', () => {
  test('dashboard → popover → dark theme → settings → not-found → back to dashboard', async ({
    page,
    isMobile,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);

      // 1. AppShell renders on /dashboard. The desktop bar shows a
      //    breadcrumb nav with an active "Dashboard" segment; the
      //    mobile bar shows the brand title in its center segment.
      if (isMobile) {
        await expect(
          page.getByRole('navigation', { name: /breadcrumb/i }),
        ).toHaveCount(0);
        await expect(page.getByRole('banner').getByText('Calcgrinder')).toBeVisible();
      } else {
        await expect(
          page.getByRole('navigation', { name: /breadcrumb/i }),
        ).toBeVisible();
        await expect(page.locator('[aria-current="page"]')).toHaveText('Dashboard');
      }

      // 2. Open avatar popover (works on desktop & mobile — the visible
      // top bar is whichever one is rendered for the viewport).
      await page
        .getByRole('button', { name: /open account menu/i })
        .first()
        .click();
      const menu = page.getByRole('menu', { name: /account menu/i });
      await expect(menu).toBeVisible();

      // 3. Switch to Dark theme — body picks up the `dark` class.
      await menu.getByRole('radio', { name: /dark/i }).click();
      await expect(page.locator('html')).toHaveClass(/dark/);

      // 4. Click Settings → arrive at /settings.
      await menu.getByRole('menuitem', { name: /settings/i }).click();
      await page.waitForURL(/\/settings$/);
      if (isMobile) {
        await expect(page.getByRole('banner').getByText('Settings')).toBeVisible();
      } else {
        const settingsCrumbs = page.getByRole('navigation', { name: /breadcrumb/i });
        await expect(settingsCrumbs).toContainText('Dashboard');
        await expect(settingsCrumbs).toContainText('Settings');
      }

      // 5. Type a nonsense URL → not-found page.
      await page.goto('/dashboard/nope');
      await expect(
        page.getByRole('heading', { name: /page not found/i }),
      ).toBeVisible();

      // 6. Click "Go to Dashboard" → /dashboard.
      await Promise.all([
        page.waitForURL(/\/dashboard$/),
        page.getByRole('link', { name: /go to dashboard/i }).click(),
      ]);
      if (isMobile) {
        await expect(page.getByRole('banner').getByText('Calcgrinder')).toBeVisible();
      } else {
        await expect(page.locator('[aria-current="page"]')).toHaveText('Dashboard');
      }
    } finally {
      await teardown(user.userId);
    }
  });

  test('production security headers are present on all responses', async ({ request }) => {
    // No auth needed — the rule is on /:path*. Hitting /auth/login is enough.
    const res = await request.get('/auth/login');
    const headers = res.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('origin-when-cross-origin');
    expect(headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });

  test('"+ New calculator" top-bar button is enabled and clickable', async ({
    page,
    isMobile,
  }) => {
    // The button is desktop-only — skip on Mobile Safari.
    test.skip(isMobile, 'desktop-only affordance');

    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      // Scope to the top-bar banner — the dashboard Hero adds a second
      // "Build a new calculator" button that would otherwise match.
      const newCalc = page
        .getByRole('banner')
        .getByRole('button', { name: /^new calculator$/i });
      await expect(newCalc).toBeVisible();
      await expect(newCalc).toBeEnabled();
      await expect(newCalc).not.toHaveAttribute('aria-disabled', 'true');
    } finally {
      await teardown(user.userId);
    }
  });
});
