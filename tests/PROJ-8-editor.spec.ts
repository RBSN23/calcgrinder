import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-8 — Editor: Grid + Builder Two-Panel Split.
 *
 * Bootstraps approved users directly against the linked Supabase Cloud
 * project, then exercises the editor shell:
 *   - dashboard Hero + top-bar "+ New calculator" buttons create a row
 *     and land in /editor/<id>
 *   - inline breadcrumb rename (Enter / Esc / blur / maxLength) commits
 *     via PATCH and re-renders the hero
 *   - theme picker swaps the calculator's stored theme_id
 *   - Cmd-Z / Cmd-Shift-Z reverse / replay the rename + theme change
 *   - cross-owner /editor/<id> returns 404 (no chrome flash)
 *   - unauthenticated visitor is redirected to /auth/login?next=…
 *
 * Cleanup deletes the test user(s) on teardown.
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
  const email = `e2e-proj8-${suffix}@example.com`;
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
    .update({ status: 'approved', name, role: 'registered' })
    .eq('id', userId);
  if (updateErr) {
    throw new Error(`failed to approve profile: ${updateErr.message}`);
  }

  return { userId, email, password, name };
}

async function teardown(userId: string) {
  // Cascade deletes the user's calculators via the owner_id FK.
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

test.describe('PROJ-8 — Editor shell', () => {
  test('unauthenticated visitor is redirected to /auth/login?next=/editor/<id>', async ({
    page,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await page.goto(`/editor/${fakeId}`);
    // Middleware redirects via ?next= (the spec's typo says ?redirect=; the
    // technical-decisions log calls this out as a documented divergence).
    await page.waitForURL(/\/auth\/login\?next=/);
    const url = new URL(page.url());
    expect(url.searchParams.get('next')).toBe(`/editor/${fakeId}`);
  });

  test('dashboard Hero "Build a new calculator" creates a row and lands in /editor/<id>', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);

      // Hero is always visible (PROJ-5's visibility deferral is retired).
      const heroButton = page.getByRole('button', {
        name: /build a new calculator/i,
      });
      await expect(heroButton).toBeVisible();

      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        heroButton.click(),
      ]);

      // The editor mounts with the default "Untitled calculator" title
      // in the themed hero.
      await expect(
        page.getByRole('heading', { level: 1, name: /untitled calculator/i }),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('top-bar "+ New calculator" button creates a row and navigates to the editor', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, '"+ New calculator" is desktop-only chrome');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);

      // Exact-match: there's also a Dashboard Hero button labelled "Build a
      // new calculator" — only the top-bar pill reads "New calculator".
      const newButton = page.getByRole('button', { name: /^new calculator$/i });
      await expect(newButton).toBeEnabled();

      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        newButton.click(),
      ]);
    } finally {
      await teardown(user.userId);
    }
  });

  test('inline breadcrumb rename commits via Enter and updates the hero', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Breadcrumb rename is desktop-only (mobile gets the Builder hero edit in PROJ-9)');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        page.getByRole('button', { name: /build a new calculator/i }).click(),
      ]);

      // Click the active breadcrumb segment to enter rename mode.
      const segment = page.getByRole('button', {
        name: /rename calculator/i,
      });
      await segment.click();

      const input = page.getByRole('textbox', { name: /rename calculator/i });
      await expect(input).toBeFocused();
      // Selected text → typing replaces; press Enter to commit.
      await input.fill('Mortgage');
      await input.press('Enter');

      // After commit, the segment returns to display mode showing the new label.
      await expect(
        page.getByRole('button', { name: /rename calculator \(current title: Mortgage\)/i }),
      ).toBeVisible();
      // Builder hero re-renders within the same render pass.
      await expect(
        page.getByRole('heading', { level: 1, name: 'Mortgage' }),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('Esc cancels the rename and reverts to the original title', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Breadcrumb rename is desktop-only');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        page.getByRole('button', { name: /build a new calculator/i }).click(),
      ]);

      await page.getByRole('button', { name: /rename calculator/i }).click();
      const input = page.getByRole('textbox', { name: /rename calculator/i });
      await input.fill('This will be discarded');
      await input.press('Escape');

      // Segment returns showing the prior label, hero unchanged.
      await expect(
        page.getByRole('button', { name: /rename calculator \(current title: Untitled calculator\)/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 1, name: /untitled calculator/i }),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('empty title after trim is rejected client-side; input stays focused', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Breadcrumb rename is desktop-only');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        page.getByRole('button', { name: /build a new calculator/i }).click(),
      ]);

      await page.getByRole('button', { name: /rename calculator/i }).click();
      const input = page.getByRole('textbox', { name: /rename calculator/i });
      await input.fill('   ');
      await input.press('Enter');

      // Validation failed → aria-invalid + still focused for retry.
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toBeFocused();
    } finally {
      await teardown(user.userId);
    }
  });

  test('theme picker switches the calculator theme and persists across reload', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Theme picker UI differs on mobile; covered separately');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        page.getByRole('button', { name: /build a new calculator/i }).click(),
      ]);

      // Picker trigger initial label = Calcgrinder · Light (default theme).
      const picker = page.getByRole('button', {
        name: /change calculator theme/i,
      });
      await expect(picker).toBeVisible();
      await picker.click();

      // Pick a known non-default theme by label substring.
      const vesselRow = page.getByRole('option').filter({ hasText: /vessel/i }).first();
      await vesselRow.click();

      // Trigger button updates to Vessel label after PATCH resolves.
      await expect(picker).toContainText(/vessel/i);

      // Reload → server returns the persisted theme.
      await page.reload();
      await expect(
        page.getByRole('button', { name: /change calculator theme/i }),
      ).toContainText(/vessel/i);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Cmd-Z / Cmd-Shift-Z undo and redo the title rename', async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(isMobile, 'Cmd-Z behaviour is desktop-only');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        page.getByRole('button', { name: /build a new calculator/i }).click(),
      ]);

      await page.getByRole('button', { name: /rename calculator/i }).click();
      const input = page.getByRole('textbox', { name: /rename calculator/i });
      await input.fill('Mortgage');
      await input.press('Enter');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Mortgage' }),
      ).toBeVisible();

      // Click outside any input so the document-level keyboard handler fires.
      await page.getByRole('region', { name: /calculator preview/i }).click();

      const meta = browserName === 'webkit' || browserName === 'chromium' ? 'Meta' : 'Control';
      await page.keyboard.press(`${meta}+z`);
      // Undo reverts the title.
      await expect(
        page.getByRole('heading', { level: 1, name: /untitled calculator/i }),
      ).toBeVisible();

      await page.keyboard.press(`${meta}+Shift+z`);
      // Redo restores the rename.
      await expect(
        page.getByRole('heading', { level: 1, name: 'Mortgage' }),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('cross-owner /editor/<id> returns 404 (not 403) — no chrome flash', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Cross-owner check is route-level; one viewport is enough');
    const owner = await bootstrapApprovedUser();
    const intruder = await bootstrapApprovedUser();
    try {
      // Create a calculator owned by the first user via admin client.
      const { data: row, error } = await admin
        .from('calculators')
        .insert({ owner_id: owner.userId })
        .select('id')
        .single();
      if (error || !row) {
        throw new Error(`failed to seed calculator: ${error?.message ?? 'no row'}`);
      }

      // Sign in as the intruder and try to load the owner's editor.
      await signIn(page, intruder);
      const res = await page.goto(`/editor/${row.id}`);
      expect(res?.status()).toBe(404);
      // Should NOT show the editor chrome (Builder toolbar / theme picker).
      await expect(
        page.getByRole('toolbar', { name: /builder toolbar/i }),
      ).toHaveCount(0);
    } finally {
      await teardown(owner.userId);
      await teardown(intruder.userId);
    }
  });

  test('Builder toolbar shows Undo · Redo · ViewportPicker · "+ Add" with Cell+Section enabled (PROJ-9), Chart+Text disabled', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Builder toolbar layout is desktop-only; mobile has footer nav');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        page.getByRole('button', { name: /build a new calculator/i }).click(),
      ]);

      const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
      await expect(toolbar).toBeVisible();
      await expect(toolbar.getByRole('button', { name: 'Undo' })).toBeDisabled();
      await expect(toolbar.getByRole('button', { name: 'Redo' })).toBeDisabled();
      await expect(
        toolbar.getByRole('radiogroup', { name: /builder preview width/i }),
      ).toBeVisible();

      const addButton = toolbar.getByRole('button', { name: /add element/i });
      await addButton.click();
      // PROJ-9 flips Cell + Section from disabled to enabled.
      for (const label of ['Cell', 'Section']) {
        const opt = page.getByRole('menuitem', { name: new RegExp(`^${label}`, 'i') });
        await expect(opt).toBeVisible();
        await expect(opt).toBeEnabled();
      }
      // Chart + Text block stay disabled with v1.1 tooltips.
      for (const label of ['Chart', 'Text block']) {
        const opt = page.getByRole('menuitem', { name: new RegExp(label, 'i') });
        await expect(opt).toBeVisible();
        await expect(opt).toBeDisabled();
      }

      // Preview button NOT present in PROJ-8 (ships with PROJ-10).
      await expect(
        toolbar.getByRole('button', { name: /preview/i }),
      ).toHaveCount(0);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Grid panel chevron collapses and re-expands to the prior height', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Grid panel chevron is desktop-only');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await Promise.all([
        page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
        page.getByRole('button', { name: /build a new calculator/i }).click(),
      ]);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      await expect(gridRegion).toBeVisible();
      const collapseButton = gridRegion.getByRole('button', {
        name: /collapse grid panel/i,
      });
      await collapseButton.click();
      await expect(gridRegion).toHaveAttribute('style', /height: 40px/);

      // Re-expand returns to the default height (164px).
      await gridRegion
        .getByRole('button', { name: /expand grid panel/i })
        .click();
      await expect(gridRegion).toHaveAttribute('style', /height: 164px/);
    } finally {
      await teardown(user.userId);
    }
  });
});
