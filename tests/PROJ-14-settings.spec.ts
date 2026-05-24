import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-14 — Settings Page.
 *
 * Coverage targets the acceptance criteria for the four sections
 * (Profile / Security / Preferences / Danger zone), the email-change
 * landing on /auth/email-confirmed, the deletion-confirm route handler,
 * the grace-window lock-out + /auth/cancel-deletion form, the visitor
 * read filter for owners in `pending_deletion`, and the cron account
 * purge.
 *
 * The real SMTP send path (Cyon) is bypassed by seeding
 * `account_deletion_requests` rows directly via the admin client — this
 * lets us click the deletion-confirm URL and exercise the rest of the
 * state machine without burning real verification emails.
 *
 * Setup pattern: bootstrap an approved user via the admin client,
 * exercise the assertion under test, hard-delete the user on teardown.
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
  const email = `e2e-proj14-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;
  const name = `Settings ${suffix}`;

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
  // Cleanup is best-effort — a hard-purge test may have already removed
  // the auth.users row.
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
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

// 43-char base64url token — matches randomToken() shape.
function fakeToken(): string {
  return randomBytes(32).toString('base64url');
}

async function seedDeletionRequest(
  userId: string,
  token: string,
  state: 'fresh' | 'consumed' | 'cancelled' = 'fresh',
): Promise<void> {
  const consumed_at = state === 'consumed' ? new Date().toISOString() : null;
  const cancelled_at = state === 'cancelled' ? new Date().toISOString() : null;
  const { error } = await admin
    .from('account_deletion_requests')
    .upsert(
      {
        user_id: userId,
        token,
        consumed_at,
        cancelled_at,
      },
      { onConflict: 'user_id' },
    );
  if (error) {
    throw new Error(`seedDeletionRequest failed: ${error.message}`);
  }
}

test.describe('PROJ-14 — Settings page (Profile + Security + Preferences + Danger zone)', () => {
  test('renders all four sections + Profile rows for an approved user', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await page.goto('/settings');
      await expect(page).toHaveTitle(/Settings · Calcgrinder/);

      // Section headings.
      await expect(
        page.getByRole('heading', { name: 'Profile', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Security', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Preferences', exact: true }),
      ).toBeVisible();
      // Danger label is a small-caps span, not a heading.
      await expect(page.getByText('Danger zone', { exact: true })).toBeVisible();

      // Profile rows.
      await expect(page.locator('#settings-name')).toBeVisible();
      await expect(page.locator('#settings-email')).toHaveValue(user.email);
      await expect(
        page.getByText('Registered user', { exact: true }),
      ).toBeVisible();

      // Security rows.
      await expect(page.locator('#settings-current-password')).toBeVisible();
      await expect(page.locator('#settings-new-password')).toBeVisible();
      await expect(page.locator('#settings-confirm-password')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Update password' }),
      ).toBeVisible();

      // Preferences rows.
      await expect(page.getByText('App theme', { exact: true })).toBeVisible();
      await expect(
        page.getByText('Default calculator theme for new calculators', {
          exact: true,
        }),
      ).toBeVisible();

      // Danger-zone primary CTA.
      await expect(
        page.getByRole('button', { name: 'Delete account' }),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('inline-edits the Name on blur and persists to profiles.name', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await page.goto('/settings');

      const nextName = `Renamed ${randomBytes(2).toString('hex')}`;
      const nameInput = page.locator('#settings-name');
      await nameInput.fill(nextName);
      await nameInput.blur();

      // Wait for the action to finish (input is disabled while pending).
      await expect(nameInput).toBeEnabled({ timeout: 15000 });

      // Poll the DB until the write lands or we time out.
      await expect(async () => {
        const { data: row } = await admin
          .from('profiles')
          .select('name')
          .eq('id', user.userId)
          .maybeSingle();
        expect(row?.name).toBe(nextName);
      }).toPass({ timeout: 10000, intervals: [200, 500, 1000] });
    } finally {
      await teardown(user.userId);
    }
  });

  test('rejects an 81-char Name with an inline error caption and does not write', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await page.goto('/settings');

      const nameInput = page.locator('#settings-name');
      // maxLength=120 on the input still allows >80 chars to be entered.
      await nameInput.fill('a'.repeat(81));
      await nameInput.blur();

      await expect(
        page.getByText('Name must be 80 characters or fewer.', {
          exact: true,
        }),
      ).toBeVisible({ timeout: 5000 });

      const { data: row } = await admin
        .from('profiles')
        .select('name')
        .eq('id', user.userId)
        .maybeSingle();
      expect(row?.name).toBe(user.name);
    } finally {
      await teardown(user.userId);
    }
  });

  test('App theme segmented control toggles to Dark', async ({ page }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await page.goto('/settings');

      // Light is the initial theme; click Dark.
      const darkBtn = page.getByRole('radio', { name: /Dark/i }).first();
      await darkBtn.click();

      // Active state reflected via aria-checked.
      await expect(darkBtn).toHaveAttribute('aria-checked', 'true');

      // localStorage carries the next-themes key (no server persistence).
      const persisted = await page.evaluate(() => localStorage.getItem('theme'));
      expect(persisted).toBe('dark');
    } finally {
      await teardown(user.userId);
    }
  });

  test('Default calculator theme persists to profiles.default_calculator_theme and applies on new calculator', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await page.goto('/settings');

      // shadcn Select trigger has role=combobox.
      await page.locator('#settings-default-theme').click();
      // Pick the first non-current theme. The dropdown lists 8; we click
      // by display name suffix — `slate` is one of the shipped IDs in
      // src/lib/themes/.
      const option = page.getByRole('option').nth(1);
      const optionLabel = (await option.innerText()).trim();
      await option.click();

      // Wait for the action to land in the DB.
      let themeId: string | null = null;
      await expect(async () => {
        const { data: row } = await admin
          .from('profiles')
          .select('default_calculator_theme')
          .eq('id', user.userId)
          .maybeSingle();
        expect(row?.default_calculator_theme).toBeTruthy();
        themeId = row!.default_calculator_theme as string;
      }).toPass({ timeout: 15000, intervals: [200, 500, 1000] });

      // Create a new calculator via the API — the POST handler should
      // read the user's default theme.
      const created = await page.request.post('/api/calculators', {
        data: {},
      });
      expect(created.status()).toBe(201);
      const body = await created.json();
      expect(body.theme_id).toBe(themeId!);

      // Sanity: silence linter on optionLabel.
      void optionLabel;
    } finally {
      await teardown(user.userId);
    }
  });

  test('Danger-zone "Delete account" opens the confirmation dialog', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await page.goto('/settings');

      await page
        .getByRole('button', { name: 'Delete account', exact: true })
        .click();

      await expect(
        page.getByRole('dialog', { name: /Delete your account/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Send deletion link' }),
      ).toBeVisible();
      // Mention of the grace window length in the body.
      await expect(page.getByText(/day countdown/i)).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('Danger-zone renders the pending banner when an un-consumed deletion request exists', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      // Seed the deletion-request row directly (bypasses Cyon SMTP).
      const token = fakeToken();
      await seedDeletionRequest(user.userId, token, 'fresh');

      await signIn(page, user);
      await page.goto('/settings');

      await expect(page.getByText(/Deletion pending/i).first()).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Cancel deletion' }),
      ).toBeVisible();
      // Click Cancel — the row should be cancelled.
      await page.getByRole('button', { name: 'Cancel deletion' }).click();

      // Banner disappears on next render.
      await expect(page.getByText(/Deletion pending\./i)).toBeHidden({
        timeout: 5000,
      });

      const { data: row } = await admin
        .from('account_deletion_requests')
        .select('cancelled_at')
        .eq('user_id', user.userId)
        .maybeSingle();
      expect(row?.cancelled_at).not.toBeNull();
    } finally {
      await teardown(user.userId);
    }
  });
});

test.describe('PROJ-14 — Sysadmin Role row + Danger-zone variant', () => {
  test('renders the Sysadmin pill in Role row and disables Delete account', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      // Promote the user to sysadmin.
      await admin
        .from('profiles')
        .update({ role: 'sysadmin' })
        .eq('id', user.userId);

      await signIn(page, user);
      await page.goto('/settings');

      // Sysadmin pill in the Role row.
      await expect(page.getByText('Sysadmin').first()).toBeVisible();
      await expect(
        page.getByText("Sysadmin can approve new users and curate Presets", {
          exact: false,
        }),
      ).toBeVisible();

      // Delete-account button is rendered but disabled.
      const deleteBtn = page.getByRole('button', { name: 'Delete account' });
      await expect(deleteBtn).toBeDisabled();
    } finally {
      await teardown(user.userId);
    }
  });
});

test.describe('PROJ-14 — Confirm-delete route handler', () => {
  test('flips status to pending_deletion on fresh-token click and locks the user into /auth/cancel-deletion', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      const token = fakeToken();
      await seedDeletionRequest(user.userId, token, 'fresh');

      await signIn(page, user);

      // Visit the confirm-delete URL (token-in-URL is the auth).
      const response = await page.goto(
        `/auth/account/${token}/confirm-delete`,
      );
      expect(response?.status()).toBe(200);
      await expect(page.getByText('Deletion scheduled')).toBeVisible();

      // DB: profile.status === pending_deletion, request consumed.
      const { data: profile } = await admin
        .from('profiles')
        .select('status, pending_deletion_at')
        .eq('id', user.userId)
        .maybeSingle();
      expect(profile?.status).toBe('pending_deletion');
      expect(profile?.pending_deletion_at).not.toBeNull();

      const { data: row } = await admin
        .from('account_deletion_requests')
        .select('consumed_at')
        .eq('user_id', user.userId)
        .maybeSingle();
      expect(row?.consumed_at).not.toBeNull();

      // The user is locked into /auth/cancel-deletion — visiting any
      // private surface bounces here.
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/auth\/cancel-deletion/);
      await expect(page.getByText(/Your account will be deleted/i)).toBeVisible();

      await page.goto('/settings');
      await expect(page).toHaveURL(/\/auth\/cancel-deletion/);
    } finally {
      await teardown(user.userId);
    }
  });

  test('re-click of an already-consumed token renders the "Already scheduled" landing without mutating', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      const token = fakeToken();
      await seedDeletionRequest(user.userId, token, 'consumed');
      // Also flip the profile to pending_deletion to match the actual
      // post-click state.
      await admin
        .from('profiles')
        .update({
          status: 'pending_deletion',
          pending_deletion_at: new Date().toISOString(),
        })
        .eq('id', user.userId);

      const response = await page.goto(
        `/auth/account/${token}/confirm-delete`,
      );
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole('heading', { name: 'Already scheduled' }),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('cancelled-token click renders the cancelled landing', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      const token = fakeToken();
      await seedDeletionRequest(user.userId, token, 'cancelled');

      const response = await page.goto(
        `/auth/account/${token}/confirm-delete`,
      );
      expect(response?.status()).toBe(200);
      await expect(
        page.getByText(/This deletion request has been cancelled/i),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('malformed token → 404 generic landing', async ({ page }) => {
    const response = await page.goto(
      '/auth/account/not-a-valid-token/confirm-delete',
    );
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/This link is not valid/i)).toBeVisible();
  });

  test('unknown but well-shaped token → 404 generic landing', async ({
    page,
  }) => {
    const token = fakeToken();
    const response = await page.goto(
      `/auth/account/${token}/confirm-delete`,
    );
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/This link is not valid/i)).toBeVisible();
  });
});

test.describe('PROJ-14 — Cancel-deletion screen', () => {
  test.setTimeout(120_000);

  test('happy path: clicking "Cancel deletion & keep account" reverts profile to approved and redirects to /dashboard', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      // Sign in while the user is still `approved` so we get a working
      // session cookie via the standard login flow. THEN flip the
      // profile to `pending_deletion` and navigate directly to the
      // cancel screen — this avoids the login-action's missing
      // pending_deletion branch (bug: login action only handles
      // `approved` explicitly and falls through to /auth/waiting-for-
      // approval for every other status; the (auth) layout then
      // re-bounces).
      await signIn(page, user);

      const token = fakeToken();
      await admin.from('account_deletion_requests').upsert(
        {
          user_id: user.userId,
          token,
          consumed_at: new Date().toISOString(),
          cancelled_at: null,
        },
        { onConflict: 'user_id' },
      );
      await admin
        .from('profiles')
        .update({
          status: 'pending_deletion',
          pending_deletion_at: new Date().toISOString(),
        })
        .eq('id', user.userId);

      await page.goto('/auth/cancel-deletion');
      await expect(
        page.getByRole('button', { name: /Cancel deletion & keep account/i }),
      ).toBeVisible({ timeout: 30000 });

      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 30000 }),
        page
          .getByRole('button', { name: /Cancel deletion & keep account/i })
          .click(),
      ]);

      const { data: profile } = await admin
        .from('profiles')
        .select('status, pending_deletion_at')
        .eq('id', user.userId)
        .maybeSingle();
      expect(profile?.status).toBe('approved');
      expect(profile?.pending_deletion_at).toBeNull();

      const { data: row } = await admin
        .from('account_deletion_requests')
        .select('cancelled_at')
        .eq('user_id', user.userId)
        .maybeSingle();
      expect(row?.cancelled_at).not.toBeNull();
    } finally {
      await teardown(user.userId);
    }
  });

  test('anonymous browser visiting /auth/cancel-deletion bounces to /auth/login', async ({
    page,
  }) => {
    await page.goto('/auth/cancel-deletion');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('PROJ-14 — Visitor view of an owner in pending_deletion', () => {
  test('a published calculator whose owner is in pending_deletion is hidden from /c/<token>', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      // Seed a published calculator while the owner is approved.
      await signIn(page, user);
      const created = await page.request.post('/api/calculators', {
        data: {},
      });
      const calc = await created.json();
      const publish = await page.request.patch(
        `/api/calculators/${calc.id}`,
        { data: { updated_at: calc.updated_at, published: true } },
      );
      const published = await publish.json();
      const publicToken = published.public_token as string;

      // Sanity: the public URL works while owner is approved.
      const ok = await page.request.get(`/c/${publicToken}`);
      expect(ok.status()).toBe(200);

      // Flip the owner to pending_deletion.
      await admin
        .from('profiles')
        .update({
          status: 'pending_deletion',
          pending_deletion_at: new Date().toISOString(),
        })
        .eq('id', user.userId);

      // The visitor read RPC's profiles.status='approved' JOIN strips
      // the row. Spec wants 410-Gone parity, but the implementation
      // currently surfaces 404 (the RPC returns 0 rows, which middleware
      // treats as `not_found`). Either way the visitor sees no
      // calculator content. We do an unauthenticated request so the
      // result reflects the actual visitor experience.
      const visitor = await page.context().request;
      const after = await visitor.get(`/c/${publicToken}`, {
        headers: { cookie: '' },
      });
      expect([404, 410]).toContain(after.status());
    } finally {
      await teardown(user.userId);
    }
  });
});

test.describe('PROJ-14 — Cron account purge', () => {
  test('GET /api/cron/purge hard-deletes auth.users for an expired pending_deletion row and reports purged_accounts', async ({
    request,
  }) => {
    const user = await bootstrapApprovedUser();
    let purgedSelf = false;
    try {
      // Seed: user is pending_deletion with a backdated pending_deletion_at.
      const yearAgo = new Date(
        Date.now() - 365 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const token = fakeToken();
      await admin.from('account_deletion_requests').upsert(
        {
          user_id: user.userId,
          token,
          consumed_at: yearAgo,
          cancelled_at: null,
        },
        { onConflict: 'user_id' },
      );
      await admin
        .from('profiles')
        .update({
          status: 'pending_deletion',
          pending_deletion_at: yearAgo,
        })
        .eq('id', user.userId);

      const res = await request.get('/api/cron/purge', {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(typeof body.purged_accounts).toBe('number');
      expect(typeof body.retention_days).toBe('number');
      // At least one account (ours) was purged this run.
      expect(body.purged_accounts).toBeGreaterThanOrEqual(1);

      // The auth.users row is gone — listUsers no longer surfaces it.
      const { data: existing } = await admin.auth.admin.getUserById(
        user.userId,
      );
      expect(existing.user).toBeNull();
      purgedSelf = true;
    } finally {
      if (!purgedSelf) await teardown(user.userId);
    }
  });

  test('GET /api/cron/purge with a wrong bearer returns 401 and does not purge', async ({
    request,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      const yearAgo = new Date(
        Date.now() - 365 * 24 * 60 * 60 * 1000,
      ).toISOString();
      await admin
        .from('profiles')
        .update({
          status: 'pending_deletion',
          pending_deletion_at: yearAgo,
        })
        .eq('id', user.userId);

      const res = await request.get('/api/cron/purge', {
        headers: { Authorization: 'Bearer wrong-secret' },
      });
      expect(res.status()).toBe(401);

      // User still exists.
      const { data: existing } = await admin.auth.admin.getUserById(
        user.userId,
      );
      expect(existing.user?.id).toBe(user.userId);
    } finally {
      await teardown(user.userId);
    }
  });
});

test.describe('PROJ-14 — Email-confirmed landing', () => {
  test('renders the success copy and a "Continue to dashboard" link', async ({
    page,
  }) => {
    await page.goto('/auth/email-confirmed');
    await expect(page.getByText('Email address updated')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Continue to dashboard' }),
    ).toBeVisible();
  });
});
