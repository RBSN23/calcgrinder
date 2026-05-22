import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-3 — Authentication & Approval Flow.
 *
 * These tests run against the dev server (started by
 * playwright.config.ts → webServer) and against the linked Supabase
 * Cloud project. They cover the full click-through sequence specified
 * in the Acceptance Criteria:
 *
 *   signup form → sent-confirmation → admin approve via direct URL →
 *   re-login → dashboard
 *
 * To keep CI deterministic without burning real signup-notification
 * emails, the test bootstraps the user directly via the Supabase admin
 * client (email already confirmed, profile already in pending state)
 * and inserts the signup_approvals row with a known token. The HTTP
 * plumbing of the admin click, login form, and route-gate are then
 * exercised end-to-end through the dev server.
 *
 * Cleanup deletes the user (which cascades to profiles and
 * signup_approvals) on test teardown.
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

type Bootstrap = {
  userId: string;
  email: string;
  password: string;
  token: string;
};

async function bootstrapPendingUser(): Promise<Bootstrap> {
  const suffix = randomBytes(4).toString('hex');
  const email = `e2e-proj3-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `E2E ${suffix}` },
  });
  if (createErr || !created.user) {
    throw new Error(`failed to bootstrap user: ${createErr?.message ?? 'no user'}`);
  }
  const userId = created.user.id;

  // The handle_new_user trigger created the profiles row in pending
  // state already. Make sure the name is the one we set in metadata.
  await admin.from('profiles').update({ name: `E2E ${suffix}` }).eq('id', userId);

  // Insert the approval row directly with a known token.
  const token = randomBytes(32).toString('base64url');
  const { error: approvalErr } = await admin
    .from('signup_approvals')
    .insert({ user_id: userId, token });
  if (approvalErr) {
    throw new Error(`failed to insert signup_approvals: ${approvalErr.message}`);
  }

  return { userId, email, password, token };
}

async function teardown(userId: string) {
  // Deleting the auth user cascades through profiles and signup_approvals.
  await admin.auth.admin.deleteUser(userId);
}

test.describe('PROJ-3 — full happy path', () => {
  test('anonymous user is redirected from /dashboard to /auth/login?next=/dashboard', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fdashboard$/);
  });

  test('the eight auth pages render with 200', async ({ page }) => {
    for (const path of [
      '/auth/login',
      '/auth/signup',
      '/auth/forgot-password',
      '/auth/sent-confirmation',
      '/auth/reset-password',
      '/auth/reset-success',
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should respond with 200`).toBeLessThan(400);
    }
  });

  test('admin approve via direct token URL → "Account approved" landing → re-login → /dashboard', async ({ page, request, context }) => {
    const boot = await bootstrapPendingUser();
    try {
      // Pre-approval: logging in lands on /auth/waiting-for-approval.
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', boot.email);
      await page.fill('input[name="password"]', boot.password);
      await Promise.all([
        page.waitForURL(/\/auth\/waiting-for-approval$/),
        page.click('button[type="submit"]'),
      ]);
      await expect(
        page.getByRole('heading', { name: /Waiting for approval/i }),
      ).toBeVisible();

      // Sign out from the waiting screen via the no-JS form post.
      const signOut = await request.post('/auth/sign-out', {
        maxRedirects: 0,
      });
      expect(signOut.status()).toBe(303);
      expect(signOut.headers().location).toMatch(/\/auth\/login$/);

      // Clear cookies so the next request looks anonymous to the dev server.
      await context.clearCookies();

      // Sysadmin clicks the approve link.
      const approveUrl = `/auth/admin/${boot.token}/approve`;
      const adminRes = await page.goto(approveUrl);
      expect(adminRes?.status()).toBeLessThan(400);
      await expect(
        page.getByRole('heading', { name: /Account approved/i }),
      ).toBeVisible();

      // Re-click the approve link → "Already approved" landing.
      const repeatRes = await page.goto(approveUrl);
      expect(repeatRes?.status()).toBeLessThan(400);
      await expect(
        page.getByRole('heading', { name: /Already approved/i }),
      ).toBeVisible();

      // Decline the same token now → also "Already approved" (sticky).
      const declineRes = await page.goto(`/auth/admin/${boot.token}/decline`);
      expect(declineRes?.status()).toBeLessThan(400);
      await expect(
        page.getByRole('heading', { name: /Already approved/i }),
      ).toBeVisible();

      // Log in again — should land on /dashboard.
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', boot.email);
      await page.fill('input[name="password"]', boot.password);
      await Promise.all([
        page.waitForURL(/\/dashboard$/),
        page.click('button[type="submit"]'),
      ]);
    } finally {
      await teardown(boot.userId);
    }
  });

  test('invalid admin token → "Link not valid" landing', async ({ page }) => {
    const res = await page.goto('/auth/admin/not-a-real-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx/approve');
    expect(res?.status()).toBeLessThan(400);
    await expect(
      page.getByRole('heading', { name: /Link not valid/i }),
    ).toBeVisible();
  });

  test('unknown admin action → 404', async ({ request }) => {
    const res = await request.get('/auth/admin/anytoken/bogus');
    expect(res.status()).toBe(404);
  });
});
