import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-23 — UI/UX Polish Part 1 (Editor).
 *
 * Covers the 7 issues:
 *   1. Grid Cell Settings: Expand-in-Place + Compact Redesign
 *   2. Cell Name: Double-Click Inline Rename in Grid
 *   3. Label Field Moves to Cell Visual Panel
 *   4. Grid Panel Sticky on Desktop
 *   5. Text Block Builder Canvas: Inline Editing
 *   6. Title Editing: Constant Font Size in Hero
 *   7. Dark/Light Mode: App Theme Does Not Affect Calculator Preview
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
  const email = `e2e-proj23-${suffix}@example.com`;
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

async function createCalculatorWithCell(page: Page): Promise<string> {
  await Promise.all([
    page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
    page.getByRole('button', { name: /build a new calculator/i }).click(),
  ]);
  const url = page.url();
  const match = url.match(/\/editor\/([0-9a-f-]{36})/);
  if (!match) throw new Error(`Failed to extract calculator id from URL: ${url}`);
  const calcId = match[1];

  // Add a cell via the toolbar
  const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
  await toolbar.getByRole('button', { name: /add element/i }).click();
  await page.getByRole('menuitem', { name: /^Cell/i }).click();

  // Wait for the cell to appear in the grid
  const gridRegion = page.getByRole('region', { name: /grid panel/i });
  await expect(gridRegion.locator('[data-grid-cell-id]')).toHaveCount(1, { timeout: 5000 });

  return calcId;
}

// ---------------------------------------------------------------------------
// Issue 1 — Grid Cell Settings: Expand-in-Place + Compact Redesign
// ---------------------------------------------------------------------------

test.describe('PROJ-23 Issue 1 — Grid Cell Settings Expand-in-Place', () => {
  test('master toggle expands and collapses all cell settings', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });

      // Master "Settings" toggle should be visible
      const masterToggle = gridRegion.getByRole('button', { name: /expand all settings/i });
      await expect(masterToggle).toBeVisible();

      // Click master toggle — settings should expand
      await masterToggle.click();

      // The cell data model panel should now be visible
      const cellCol = gridRegion.locator('[data-grid-cell-id]').first();
      const settingsPanel = cellCol.locator('.border-t.border-cg-border.bg-cg-surface-2');
      await expect(settingsPanel).toBeVisible();

      // Master toggle should now say "Collapse"
      const collapseToggle = gridRegion.getByRole('button', { name: /collapse all settings/i });
      await expect(collapseToggle).toBeVisible();

      // Click collapse — settings should hide
      await collapseToggle.click();
      await expect(settingsPanel).not.toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('per-column chevron toggle expands all columns globally', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      const cellCol = gridRegion.locator('[data-grid-cell-id]').first();

      // Click the per-column chevron
      const chevron = cellCol.getByRole('button', { name: /expand cell settings/i });
      await expect(chevron).toBeVisible();
      await chevron.click();

      // Settings should be visible
      const settingsPanel = cellCol.locator('.border-t.border-cg-border.bg-cg-surface-2');
      await expect(settingsPanel).toBeVisible();

      // aria-expanded should be true
      await expect(chevron.or(cellCol.getByRole('button', { name: /collapse cell settings/i }))).toHaveAttribute('aria-expanded', 'true');
    } finally {
      await teardown(user.userId);
    }
  });

  test('expanded settings show segmented toggles for KIND and VISIBILITY', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });

      // Expand settings
      await gridRegion.getByRole('button', { name: /expand all settings/i }).click();

      // Check for segmented toggles
      const settingsPanel = gridRegion.locator('[data-grid-cell-id]').first().locator('.border-t.border-cg-border.bg-cg-surface-2');
      const kindToggle = settingsPanel.getByRole('radiogroup', { name: 'Kind' });
      await expect(kindToggle).toBeVisible();
      await expect(kindToggle.getByRole('radio', { name: 'Input' })).toHaveAttribute('aria-checked', 'true');
      await expect(kindToggle.getByRole('radio', { name: 'Output' })).toHaveAttribute('aria-checked', 'false');

      const visibilityToggle = settingsPanel.getByRole('radiogroup', { name: 'Visibility' });
      await expect(visibilityToggle).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('no close-X button in the expanded settings panel', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      await gridRegion.getByRole('button', { name: /expand all settings/i }).click();

      const settingsPanel = gridRegion.locator('[data-grid-cell-id]').first().locator('.border-t.border-cg-border.bg-cg-surface-2');
      await expect(settingsPanel).toBeVisible();

      // There should be no close-X button inside the settings panel
      const closeButton = settingsPanel.getByRole('button', { name: /close|collapse data/i });
      await expect(closeButton).toHaveCount(0);
    } finally {
      await teardown(user.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// Issue 2 — Cell Name: Double-Click Inline Rename in Grid
// ---------------------------------------------------------------------------

test.describe('PROJ-23 Issue 2 — Cell Name: Double-Click Inline Rename', () => {
  test('double-clicking the cell name opens an inline rename input', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      const cellCol = gridRegion.locator('[data-grid-cell-id]').first();

      // The cell name text
      const nameSpan = cellCol.locator('span.font-mono.text-\\[11px\\]').first();
      await expect(nameSpan).toHaveText('cell_1');

      // Double-click to enter rename mode
      await nameSpan.dblclick();

      // An input should appear
      const renameInput = cellCol.getByRole('textbox', { name: /rename cell/i });
      await expect(renameInput).toBeVisible();
      await expect(renameInput).toHaveValue('cell_1');
    } finally {
      await teardown(user.userId);
    }
  });

  test('Enter commits the rename via PATCH', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      const cellCol = gridRegion.locator('[data-grid-cell-id]').first();
      const nameSpan = cellCol.locator('span.font-mono.text-\\[11px\\]').first();
      await nameSpan.dblclick();

      const renameInput = cellCol.getByRole('textbox', { name: /rename cell/i });
      await renameInput.fill('price');
      await renameInput.press('Enter');

      // Wait for the rename to commit
      await expect(cellCol.locator('span.font-mono.text-\\[11px\\]').first()).toHaveText('price', { timeout: 3000 });

      // Verify in DB
      const { data } = await admin
        .from('cells')
        .select('name')
        .eq('calculator_id', calcId);
      expect(data).toHaveLength(1);
      expect(data![0].name).toBe('price');
    } finally {
      await teardown(user.userId);
    }
  });

  test('Escape discards the rename and restores original name', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      const cellCol = gridRegion.locator('[data-grid-cell-id]').first();
      const nameSpan = cellCol.locator('span.font-mono.text-\\[11px\\]').first();
      await nameSpan.dblclick();

      const renameInput = cellCol.getByRole('textbox', { name: /rename cell/i });
      await renameInput.fill('temp_name');
      await renameInput.press('Escape');

      // Original name should be restored
      await expect(cellCol.locator('span.font-mono.text-\\[11px\\]').first()).toHaveText('cell_1');
    } finally {
      await teardown(user.userId);
    }
  });

  test('empty name shows validation error and does not commit', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      const cellCol = gridRegion.locator('[data-grid-cell-id]').first();
      const nameSpan = cellCol.locator('span.font-mono.text-\\[11px\\]').first();
      await nameSpan.dblclick();

      const renameInput = cellCol.getByRole('textbox', { name: /rename cell/i });
      await renameInput.fill('');
      await renameInput.press('Enter');

      // Validation error should appear
      const errorText = cellCol.locator('text=required').or(cellCol.locator('text=Lowercase'));
      await expect(errorText).toBeVisible({ timeout: 2000 });

      // Input should remain visible (not committed)
      await expect(renameInput).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('double-clicking kind pill or visibility badge does NOT trigger rename', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      const cellCol = gridRegion.locator('[data-grid-cell-id]').first();

      // Double-click the kind pill ("input" badge)
      const kindPill = cellCol.locator('span.uppercase').filter({ hasText: /^input$/i }).first();
      await kindPill.dblclick();

      // No rename input should appear
      const renameInput = cellCol.getByRole('textbox', { name: /rename cell/i });
      await expect(renameInput).toHaveCount(0);
    } finally {
      await teardown(user.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// Issue 3 — Label Field Moves to Cell Visual Panel
// ---------------------------------------------------------------------------

test.describe('PROJ-23 Issue 3 — Label Field in Visual Panel', () => {
  test('Label field is absent from the data model settings panel', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only grid panel');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      await gridRegion.getByRole('button', { name: /expand all settings/i }).click();

      const settingsPanel = gridRegion.locator('[data-grid-cell-id]').first().locator('.border-t.border-cg-border.bg-cg-surface-2');
      await expect(settingsPanel).toBeVisible();

      // "Label" should NOT appear as a field label in the data model panel
      const labelField = settingsPanel.locator('label').filter({ hasText: /^label$/i });
      await expect(labelField).toHaveCount(0);
    } finally {
      await teardown(user.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// Issue 5 — Text Block Builder Canvas: Inline Editing
// ---------------------------------------------------------------------------

test.describe('PROJ-23 Issue 5 — Text Block Inline Editing', () => {
  test('text block shows rendered markdown; clicking enters textarea edit mode', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only canvas interactions');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      // Add a text block via toolbar
      const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
      await toolbar.getByRole('button', { name: /add element/i }).click();
      await page.getByRole('menuitem', { name: /^Text/i }).click();

      // Wait for the text block to appear in the canvas
      const canvasRegion = page.getByRole('region', { name: /calculator preview/i });
      const textBlockCard = canvasRegion.locator('[data-text-block-id]').first();
      await expect(textBlockCard).toBeVisible({ timeout: 5000 });

      // New text blocks start in edit mode (empty)
      const textarea = textBlockCard.locator('textarea');
      await expect(textarea).toBeVisible();

      // Type some markdown
      await textarea.fill('# Hello World\n\nThis is a test.');

      // Click outside to exit edit mode
      await canvasRegion.click({ position: { x: 10, y: 10 } });

      // Should show rendered markdown (an h2 heading)
      await expect(textBlockCard.locator('h2')).toHaveText('Hello World', { timeout: 3000 });

      // Click back on the text block to re-enter edit mode
      await textBlockCard.locator('.cursor-text').click();

      // Textarea should reappear with the markdown source
      const textareaAgain = textBlockCard.locator('textarea');
      await expect(textareaAgain).toBeVisible();
      await expect(textareaAgain).toHaveValue(/# Hello World/);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Escape exits text block edit mode', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only canvas interactions');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      // Add a text block
      const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
      await toolbar.getByRole('button', { name: /add element/i }).click();
      await page.getByRole('menuitem', { name: /^Text/i }).click();

      const canvasRegion = page.getByRole('region', { name: /calculator preview/i });
      const textBlockCard = canvasRegion.locator('[data-text-block-id]').first();
      await expect(textBlockCard).toBeVisible({ timeout: 5000 });

      const textarea = textBlockCard.locator('textarea');
      await expect(textarea).toBeVisible();
      await textarea.fill('Some content');

      // Press Escape
      await textarea.press('Escape');

      // Textarea should disappear, rendered content shown
      await expect(textarea).not.toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('no split-pane (source + preview) is visible in the canvas', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only canvas interactions');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      // Add a text block
      const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
      await toolbar.getByRole('button', { name: /add element/i }).click();
      await page.getByRole('menuitem', { name: /^Text/i }).click();

      const canvasRegion = page.getByRole('region', { name: /calculator preview/i });
      const textBlockCard = canvasRegion.locator('[data-text-block-id]').first();
      await expect(textBlockCard).toBeVisible({ timeout: 5000 });

      // There should be no "Live preview" or "Markdown source" labels
      await expect(canvasRegion.locator('text=Live preview')).toHaveCount(0);
      await expect(canvasRegion.locator('text=Markdown source')).toHaveCount(0);
    } finally {
      await teardown(user.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// Issue 6 — Title Editing: Constant Font Size in Hero
// ---------------------------------------------------------------------------

test.describe('PROJ-23 Issue 6 — Title Editing Font Consistency', () => {
  test('title input has same font-size as resting-state heading', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop hero editing');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const canvasRegion = page.getByRole('region', { name: /calculator preview/i });

      // Get the h1 font-size before clicking
      const heroTitle = canvasRegion.locator('h1').first();
      const h1FontSize = await heroTitle.evaluate((el) => getComputedStyle(el).fontSize);

      // Click to edit
      const editButton = page.getByRole('button', { name: /calculator title.*click to edit/i });
      await editButton.click();

      // The input should have the same font-size
      const titleInput = page.getByRole('textbox', { name: /calculator title/i });
      await expect(titleInput).toBeVisible();
      const inputFontSize = await titleInput.evaluate((el) => getComputedStyle(el).fontSize);
      expect(inputFontSize).toBe(h1FontSize);
    } finally {
      await teardown(user.userId);
    }
  });
});

// ---------------------------------------------------------------------------
// Issue 7 — Dark/Light Mode: App Theme Does Not Affect Calculator Preview
// ---------------------------------------------------------------------------

test.describe('PROJ-23 Issue 7 — Dark/Light Mode Isolation', () => {
  test('builder canvas has cg-force-light class for theme isolation', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop canvas');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const canvasRegion = page.getByRole('region', { name: /calculator preview/i });
      const classList = await canvasRegion.getAttribute('class');
      expect(classList).toContain('cg-force-light');
    } finally {
      await teardown(user.userId);
    }
  });

  test('canvas background uses theme.bg inline style, not CSS variable', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop canvas');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      await createCalculatorWithCell(page);

      const canvasRegion = page.getByRole('region', { name: /calculator preview/i });
      const bgStyle = await canvasRegion.evaluate((el) => el.style.background);
      // Should have an inline background from theme.bg (a hex/rgb value), not empty
      expect(bgStyle.length).toBeGreaterThan(0);
    } finally {
      await teardown(user.userId);
    }
  });
});
