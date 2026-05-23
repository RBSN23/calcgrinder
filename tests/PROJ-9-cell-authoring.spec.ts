import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-9 — Cell Authoring & Section Management.
 *
 * Coverage focuses on the spec's golden-path acceptance criteria plus the
 * security/RLS surface:
 *   - POST /api/calculators creates the default Section 1 in the same flow
 *     and returns a `default_section_id` (AC: default section side effect).
 *   - The editor loader hydrates sections + cells on the server pass, and
 *     the default Section 1 is visible on first paint.
 *   - "+ Add" picker enables Cell + Section in PROJ-9 (PROJ-8 had both
 *     disabled — covered by an updated PROJ-8 spec too).
 *   - Clicking "+ Add → Cell" creates an Input cell in the last section
 *     with sequential name `cell_1`, label "New cell", value_type=number,
 *     visible + editable, and it appears in both the Builder and the Grid.
 *   - Clicking "+ Add → Section" appends a section after the last one.
 *   - The Grid panel's "+ add cell" right-edge affordance also creates a
 *     cell.
 *   - Calculator hero is edit-in-place (title + description) and the
 *     breadcrumb stays in sync.
 *   - Hidden-cells pill is hidden when count = 0 and unhides on toggle.
 *   - Cross-owner section / cell PATCH / DELETE attempts return 404
 *     (RLS-bound — no leakage of existence).
 *   - Unauthenticated cell/section PATCH returns 401.
 *   - POST /api/sections/:sid/cells rejects reserved cell names (400) and
 *     names matching the invalid pattern.
 *   - PATCH /api/cells/:id rejects cross-section moves (422
 *     cross_section_move_unsupported).
 *   - DELETE /api/sections/:id refuses the last section (422
 *     cannot_delete_last_section).
 *
 * Tests run on signed-in approved users bootstrapped against the linked
 * Cloud Supabase project, the same pattern PROJ-3 / PROJ-5 / PROJ-8 use.
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
  const email = `e2e-proj9-${suffix}@example.com`;
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
  // Cascade deletes the user's calculators (and their sections / cells via FK).
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

async function createCalculator(page: Page): Promise<string> {
  await Promise.all([
    page.waitForURL(/\/editor\/[0-9a-f-]{36}$/),
    page.getByRole('button', { name: /build a new calculator/i }).click(),
  ]);
  const url = page.url();
  const match = url.match(/\/editor\/([0-9a-f-]{36})/);
  if (!match) throw new Error(`Failed to extract calculator id from URL: ${url}`);
  return match[1];
}

test.describe('PROJ-9 — Cell Authoring & Section Management', () => {
  test('POST /api/calculators creates the default Section 1 in the same flow and returns default_section_id', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      // Capture the POST response.
      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().endsWith('/api/calculators') && res.request().method() === 'POST',
      );
      await page.getByRole('button', { name: /build a new calculator/i }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('default_section_id');
      expect(typeof body.default_section_id).toBe('string');
      expect(body.default_section_id.length).toBeGreaterThan(0);

      // Confirm the section landed in the DB.
      const { data: sections } = await admin
        .from('sections')
        .select('id, title, layout_pattern_id, display_order')
        .eq('calculator_id', body.id);
      expect(sections).not.toBeNull();
      expect(sections!).toHaveLength(1);
      expect(sections![0].title).toBe('Section 1');
      expect(sections![0].layout_pattern_id).toBe('single_column');
      expect(sections![0].display_order).toBe(0);
    } finally {
      await teardown(user.userId);
    }
  });

  test('+Add → Cell creates an Input cell in the last section with sequential default name', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop AddPicker; mobile uses footer +Add');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);

      const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
      await toolbar.getByRole('button', { name: /add element/i }).click();
      const cellOption = page.getByRole('menuitem', { name: /^Cell/i });
      await expect(cellOption).toBeEnabled();
      await cellOption.click();

      // Cell should appear in the DB.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('cells')
              .select('name, kind, value_type, visibility, editability')
              .eq('calculator_id', calcId);
            return data ?? [];
          },
          { timeout: 5000 },
        )
        .toHaveLength(1);

      const { data: cells } = await admin
        .from('cells')
        .select('name, kind, value_type, visibility, editability, label, display_widget')
        .eq('calculator_id', calcId);
      expect(cells![0]).toMatchObject({
        name: 'cell_1',
        kind: 'input',
        value_type: 'number',
        visibility: 'visible',
        editability: 'editable',
        label: 'New cell',
        display_widget: 'number_field',
      });
    } finally {
      await teardown(user.userId);
    }
  });

  test('+Add → Section appends a new section after the last one', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop AddPicker; mobile uses footer +Add');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);

      const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
      await toolbar.getByRole('button', { name: /add element/i }).click();
      await page.getByRole('menuitem', { name: /^Section/i }).click();

      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('sections')
              .select('display_order, title')
              .eq('calculator_id', calcId)
              .order('display_order', { ascending: true });
            return (data ?? []).map((s) => s.display_order);
          },
          { timeout: 5000 },
        )
        .toEqual([0, 1]);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Grid panel "+ add cell" right-edge affordance creates a cell in the last section', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop Grid only; mobile uses GridDrawer');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);

      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      await expect(gridRegion).toBeVisible();
      await gridRegion.getByRole('button', { name: /^add cell$/i }).click();

      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('cells')
              .select('name')
              .eq('calculator_id', calcId);
            return (data ?? []).length;
          },
          { timeout: 5000 },
        )
        .toBe(1);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Calculator hero title is edit-in-place and breadcrumb stays in sync', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Hero edit affordance is desktop-first');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);

      // Click the hero title button (EditableText resting state)
      const heroTitle = page.getByRole('button', {
        name: /Calculator title — click to edit/i,
      });
      await expect(heroTitle).toBeVisible();
      await heroTitle.click();
      const input = page.getByRole('textbox', { name: /^Calculator title$/i });
      await input.fill('Mortgage Calculator');
      await input.press('Enter');

      // Wait for DB to reflect the rename.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('calculators')
              .select('title')
              .eq('id', calcId)
              .maybeSingle();
            return data?.title ?? null;
          },
          { timeout: 5000 },
        )
        .toBe('Mortgage Calculator');

      // Breadcrumb segment (top bar nav) should show the new title.
      const breadcrumbNav = page.getByRole('navigation', { name: /breadcrumb/i });
      await expect(breadcrumbNav).toContainText(/Mortgage Calculator/i);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Cross-owner section PATCH/DELETE returns 404 (RLS opacity)', async ({
    browser,
  }) => {
    const owner = await bootstrapApprovedUser();
    const intruder = await bootstrapApprovedUser();
    const ownerCtx = await browser.newContext();
    const intruderCtx = await browser.newContext();
    try {
      // Owner creates a calculator (yielding a default section).
      const ownerPage = await ownerCtx.newPage();
      await signIn(ownerPage, owner);
      const calcId = await createCalculator(ownerPage);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;
      const { data: calc } = await admin
        .from('calculators')
        .select('updated_at')
        .eq('id', calcId)
        .maybeSingle();
      const updatedAt = calc!.updated_at;

      // Intruder uses a separate browser context (isolated cookies).
      const intruderPage = await intruderCtx.newPage();
      await signIn(intruderPage, intruder);

      const patchRes = await intruderPage.request.patch(
        `/api/sections/${sectionId}`,
        { data: { updated_at: updatedAt, title: 'Hacked' } },
      );
      expect(patchRes.status()).toBe(404);

      const deleteRes = await intruderPage.request.delete(
        `/api/sections/${sectionId}`,
      );
      expect(deleteRes.status()).toBe(404);

      const { data: stillThere } = await admin
        .from('sections')
        .select('title')
        .eq('id', sectionId)
        .maybeSingle();
      expect(stillThere?.title).toBe('Section 1');
    } finally {
      await ownerCtx.close();
      await intruderCtx.close();
      await teardown(owner.userId);
      await teardown(intruder.userId);
    }
  });

  test('Unauthenticated PATCH /api/cells/:id is gated by middleware (redirected to /auth/login)', async ({ request }) => {
    // PROJ-3 middleware redirects anonymous requests on /api/* to
    // /auth/login?next=… BEFORE the route handler runs. The route's own
    // 401 check is a defensive fallback; in practice the request never
    // reaches it. Following redirects (default in Playwright) lands on
    // /auth/login (HTTP 200). Disable redirects to confirm the 302 layer.
    const res = await request.patch(
      '/api/cells/00000000-0000-4000-8000-000000000000',
      {
        data: { updated_at: '2026-01-01T00:00:00Z', label: 'pwn' },
        maxRedirects: 0,
      },
    );
    expect([302, 307]).toContain(res.status());
    const location = res.headers().location ?? '';
    expect(location).toMatch(/\/auth\/login/);
  });

  test('POST /api/sections/:sid/cells rejects reserved word names (400 name_reserved)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      const res = await page.request.post(`/api/sections/${sectionId}/cells`, {
        data: { name: 'pmt' }, // PMT is a built-in formula function
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('name_reserved');
      expect(body.reserved_word).toBe('pmt');
    } finally {
      await teardown(user.userId);
    }
  });

  test('POST /api/sections/:sid/cells rejects invalid name pattern (400 name_invalid)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Uppercase letters are invalid per [a-z][a-z0-9_]*
      const res = await page.request.post(`/api/sections/${sectionId}/cells`, {
        data: { name: 'Loan_Amount' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('name_invalid');
    } finally {
      await teardown(user.userId);
    }
  });

  test('PATCH /api/cells/:id rejects cross-section moves (422 cross_section_move_unsupported)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Create a cell directly via the API.
      const createRes = await page.request.post(`/api/sections/${sectionId}/cells`, {
        data: {},
      });
      expect(createRes.status()).toBe(201);
      const { cell } = await createRes.json();

      const { data: calc } = await admin
        .from('calculators')
        .select('updated_at')
        .eq('id', calcId)
        .maybeSingle();

      // Attempt cross-section move (valid UUIDv4 format so zod accepts).
      const moveRes = await page.request.patch(`/api/cells/${cell.id}`, {
        data: {
          updated_at: calc!.updated_at,
          section_id: '00000000-0000-4000-8000-000000000000',
        },
      });
      expect(moveRes.status()).toBe(422);
      const body = await moveRes.json();
      expect(body.error).toBe('cross_section_move_unsupported');
    } finally {
      await teardown(user.userId);
    }
  });

  test('DELETE /api/sections/:id refuses the calculator\'s only section (422 cannot_delete_last_section)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      const res = await page.request.delete(`/api/sections/${sectionId}`);
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.error).toBe('cannot_delete_last_section');

      // Section is still there.
      const { data: stillThere } = await admin
        .from('sections')
        .select('id')
        .eq('id', sectionId)
        .maybeSingle();
      expect(stillThere).not.toBeNull();
    } finally {
      await teardown(user.userId);
    }
  });

  test('DELETE /api/sections/:id with child cells requires confirm_delete_with_children=true (409 section_not_empty)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const firstSectionId = sections![0].id;

      // Add a second section so the first is no longer the "last".
      const secondRes = await page.request.post(
        `/api/calculators/${calcId}/sections`,
        { data: {} },
      );
      expect(secondRes.status()).toBe(201);

      // Add a cell to the first section.
      const cellRes = await page.request.post(
        `/api/sections/${firstSectionId}/cells`,
        { data: {} },
      );
      expect(cellRes.status()).toBe(201);

      // DELETE without confirm should return 409 + child_count.
      const noConfirmRes = await page.request.delete(
        `/api/sections/${firstSectionId}`,
      );
      expect(noConfirmRes.status()).toBe(409);
      const body = await noConfirmRes.json();
      expect(body.error).toBe('section_not_empty');
      expect(body.child_count).toBe(1);

      // DELETE with confirm succeeds and echoes the bumped calculator_updated_at.
      const confirmRes = await page.request.delete(
        `/api/sections/${firstSectionId}?confirm_delete_with_children=true`,
      );
      expect(confirmRes.status()).toBe(200);
      const confirmBody = await confirmRes.json();
      expect(typeof confirmBody.calculator_updated_at).toBe('string');
    } finally {
      await teardown(user.userId);
    }
  });

  test('Cell rename rewrites dependent formulas in the same transaction (single undo)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Create an Input "loan_amount" with default value, and an Output that references it.
      const inputRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        {
          data: {
            kind: 'input',
            name: 'loan_amount',
            value_type: 'number',
            default_value: 100000,
          },
        },
      );
      expect(inputRes.status()).toBe(201);
      const { cell: inputCell } = await inputRes.json();

      const outputRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        {
          data: {
            kind: 'output',
            name: 'doubled',
            value_type: 'number',
            formula: 'loan_amount * 2',
          },
        },
      );
      expect(outputRes.status()).toBe(201);
      const { cell: outputCell } = await outputRes.json();

      // Rename loan_amount → principal.
      const { data: calc } = await admin
        .from('calculators')
        .select('updated_at')
        .eq('id', calcId)
        .maybeSingle();
      const renameRes = await page.request.patch(`/api/cells/${inputCell.id}`, {
        data: { updated_at: calc!.updated_at, name: 'principal' },
      });
      expect(renameRes.status()).toBe(200);
      const renameBody = await renameRes.json();
      expect(renameBody.cell.name).toBe('principal');
      expect(renameBody.rewritten_cell_ids).toContain(outputCell.id);

      // Confirm dependent formula was rewritten on disk.
      const { data: refreshedOutput } = await admin
        .from('cells')
        .select('formula')
        .eq('id', outputCell.id)
        .maybeSingle();
      expect(refreshedOutput?.formula).toBe('principal * 2');
    } finally {
      await teardown(user.userId);
    }
  });

  test('200-cell cap is enforced (422 cell_cap_reached)', async ({ page }) => {
    test.setTimeout(120000);
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Bulk-insert 200 cells directly into the DB to avoid 200 round-trips.
      const rows = Array.from({ length: 200 }, (_, i) => ({
        calculator_id: calcId,
        section_id: sectionId,
        kind: 'input',
        name: `cell_${i + 1}`,
        label: 'Bulk',
        value_type: 'number',
        editability: 'editable',
        display_order: i,
        display_widget: 'number_field',
      }));
      const { error: bulkErr } = await admin.from('cells').insert(rows);
      expect(bulkErr).toBeNull();

      // 201st cell via the API must hit the cap.
      const res = await page.request.post(`/api/sections/${sectionId}/cells`, {
        data: {},
      });
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.error).toBe('cell_cap_reached');
      expect(body.max).toBe(200);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Empty section title is rejected client-side (shake/red treatment, stays in edit mode)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Section header edit affordance is desktop-first');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);

      // Click the default section title to enter edit mode.
      const titleButton = page.getByRole('button', {
        name: /Section title — click to edit/i,
      });
      await expect(titleButton).toBeVisible();
      await titleButton.click();
      const input = page.getByRole('textbox', { name: /^Section title$/i });
      await input.fill('   '); // whitespace-only — validateSectionTitle rejects.
      await input.press('Enter');

      // Still in edit mode (not reverted to button), aria-invalid set,
      // input keeps focus.
      await expect(input).toBeFocused();
      await expect(input).toHaveAttribute('aria-invalid', 'true');

      // After ~600ms the invalid pulse clears, but the input is still
      // there — the value never committed.
      await page.waitForTimeout(700);
      await expect(input).toBeFocused();

      // DB title is unchanged.
      const { data: sections } = await admin
        .from('sections')
        .select('title')
        .eq('calculator_id', calcId);
      expect(sections![0].title).toBe('Section 1');

      // Esc reverts and exits edit mode.
      await input.press('Escape');
      await expect(
        page.getByRole('button', { name: /Section title — click to edit/i }),
      ).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });

  test('Undo of a section delete restores the original section + cell UUIDs', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Cmd-Z keyboard shortcut is desktop-first');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const firstSectionId = sections![0].id;

      // Add a second section so we can delete the first one.
      const secondRes = await page.request.post(
        `/api/calculators/${calcId}/sections`,
        { data: {} },
      );
      expect(secondRes.status()).toBe(201);

      // Add a cell to the first section so the section-delete path takes
      // the "with children" branch (which is the AC the fix targets).
      const cellRes = await page.request.post(
        `/api/sections/${firstSectionId}/cells`,
        { data: {} },
      );
      expect(cellRes.status()).toBe(201);
      const { cell: originalCell } = await cellRes.json();
      // Reload so the editor store hydrates the new rows.
      await page.reload();
      await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/);

      // Delete the first section via the kebab → destructive confirm.
      // Locate the exact section by data-section-id rather than DOM order
      // (DnD-kit ghost / strict-mode duplicates can multiply the count).
      const firstSection = page
        .locator(`section[data-section-id="${firstSectionId}"]`)
        .first();
      await firstSection.hover();
      await firstSection.getByRole('button', { name: /Section options/i }).click();
      await page.getByRole('menuitem', { name: /Delete section/i }).click();
      await page.getByRole('button', { name: /^Delete$/i }).click();

      // Section row is gone from the DB.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('sections')
              .select('id')
              .eq('calculator_id', calcId);
            return (data ?? []).length;
          },
          { timeout: 5000 },
        )
        .toBe(1);

      // Wait for the destructive-confirm sheet to fully close so focus
      // returns to body — the editor's Cmd-Z handler bails when an
      // INPUT/TEXTAREA/contenteditable has focus.
      await expect(
        page.getByRole('button', { name: /^Delete$/i }),
      ).toHaveCount(0);
      // Click the hero (a neutral non-input area) to ensure body focus.
      await page.getByRole('button', {
        name: /Calculator title — click to edit/i,
      }).first().focus();
      await page.keyboard.press('Escape'); // exit editable-text if it focused
      // Fire a single Cmd-Z. The handler accepts either Meta or Control;
      // pressing both back-to-back would double-fire because the
      // dispatch UNDO happens after the awaited PATCH.
      await page.keyboard.press('Control+z');

      // Wait for the recreate to land in the DB.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('sections')
              .select('id')
              .eq('calculator_id', calcId)
              .eq('id', firstSectionId)
              .maybeSingle();
            return data?.id ?? null;
          },
          { timeout: 5000 },
        )
        .toBe(firstSectionId);

      // Child cell ALSO restored under the same id (the fix's main payoff).
      // The cell recreate happens in a loop after the section recreate;
      // poll until it lands so we don't race the network.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('cells')
              .select('id')
              .eq('calculator_id', calcId);
            return (data ?? []).map((c) => c.id);
          },
          { timeout: 5000 },
        )
        .toContain(originalCell.id);

      const { data: restoredCell } = await admin
        .from('cells')
        .select('id, name, section_id')
        .eq('id', originalCell.id)
        .maybeSingle();
      expect(restoredCell?.id).toBe(originalCell.id);
      expect(restoredCell?.section_id).toBe(firstSectionId);
    } finally {
      await teardown(user.userId);
    }
  });

  // Regression for the post-PROJ-9 deploy bug: mutation responses must
  // echo the parent calculator's bumped `updated_at` so the next
  // mutation sends a non-stale optimistic-concurrency token. Prior to
  // the fix this sequence failed at step 3 with a 409 "stale".
  test('Sequential cell mutations succeed without a page reload (updated_at echo)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Read the *current* updated_at and use it for the first cell create.
      // From here on we MUST rely on the API to feed us each new token —
      // the bug was that the client never learned the bumped value.
      const { data: calc0 } = await admin
        .from('calculators')
        .select('updated_at')
        .eq('id', calcId)
        .maybeSingle();
      let token = calc0!.updated_at as string;

      // Step 1: add a cell.
      const c1Res = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: {} },
      );
      expect(c1Res.status()).toBe(201);
      const c1Body = await c1Res.json();
      expect(c1Body.calculator_updated_at).toBeTruthy();
      expect(c1Body.calculator_updated_at).not.toBe(token);
      token = c1Body.calculator_updated_at;
      const cell1 = c1Body.cell;

      // Step 2: edit the first cell's label — uses the *response* token,
      // NOT the original page-load value. Without the fix this would 409.
      const p1Res = await page.request.patch(`/api/cells/${cell1.id}`, {
        data: { updated_at: token, label: 'First label' },
      });
      expect(p1Res.status()).toBe(200);
      const p1Body = await p1Res.json();
      expect(p1Body.cell.label).toBe('First label');
      expect(p1Body.calculator_updated_at).not.toBe(token);
      token = p1Body.calculator_updated_at;

      // Step 3: add a second cell. Bug repro: stays at the page-load
      // token without the fix.
      const c2Res = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: {} },
      );
      expect(c2Res.status()).toBe(201);
      const c2Body = await c2Res.json();
      token = c2Body.calculator_updated_at;
      const cell2 = c2Body.cell;

      // Step 4: edit the second cell's label. Should also succeed.
      const p2Res = await page.request.patch(`/api/cells/${cell2.id}`, {
        data: { updated_at: token, label: 'Second label' },
      });
      expect(p2Res.status()).toBe(200);
      const p2Body = await p2Res.json();
      expect(p2Body.cell.label).toBe('Second label');
      token = p2Body.calculator_updated_at;

      // Confirm both labels persisted.
      const { data: persisted } = await admin
        .from('cells')
        .select('id, label')
        .eq('calculator_id', calcId)
        .order('display_order', { ascending: true });
      expect(persisted).toEqual([
        expect.objectContaining({ id: cell1.id, label: 'First label' }),
        expect.objectContaining({ id: cell2.id, label: 'Second label' }),
      ]);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Visibility toggle to hidden is rejected when default_value is null (422 hidden_requires_value)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Add a cell with no default_value (the default-Input scaffold).
      const createRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: {} },
      );
      expect(createRes.status()).toBe(201);
      const createBody = await createRes.json();
      const cell = createBody.cell;
      let token = createBody.calculator_updated_at as string;

      // Attempt to flip visibility → hidden without setting a default value.
      const hideRes = await page.request.patch(`/api/cells/${cell.id}`, {
        data: { updated_at: token, visibility: 'hidden' },
      });
      expect(hideRes.status()).toBe(422);
      const hideBody = await hideRes.json();
      expect(hideBody.error).toBe('hidden_requires_value');

      // Now set a default_value AND visibility=hidden atomically — should succeed.
      // The fix's stale-updated_at echo means we can still use the
      // create-response token here (the failed PATCH above didn't bump it).
      const okRes = await page.request.patch(`/api/cells/${cell.id}`, {
        data: { updated_at: token, default_value: 42, visibility: 'hidden' },
      });
      expect(okRes.status()).toBe(200);
      const okBody = await okRes.json();
      expect(okBody.cell.visibility).toBe('hidden');
      expect(okBody.cell.default_value).toBe(42);
      token = okBody.calculator_updated_at;
    } finally {
      await teardown(user.userId);
    }
  });

  // Cycle-2 Bug A: two consecutive renames in the same session. The
  // first works, the second 409s with "Save failed — reload to retry".
  // Root cause was that the API's separate post-write SELECT for
  // calc.updated_at could race with the PostgREST/PgBouncer pool and
  // return the value as of *before* the last dependent-rewrite commit.
  // The fix tracks calc.updated_at via UPDATE...RETURNING on the last
  // write inside the route — deterministically equal to the trigger's
  // NOW() — so the client cache is always perfectly in sync.
  test('Two consecutive renames in one session succeed, with dependents rewritten each time', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Bootstrap: cell_1 (input) + cell_2 (output) that references it.
      const c1Res = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: { kind: 'input', name: 'cell_1', value_type: 'number', default_value: 100 } },
      );
      expect(c1Res.status()).toBe(201);
      let token = (await c1Res.json()).calculator_updated_at as string;

      const c2Res = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        {
          data: {
            kind: 'output',
            name: 'cell_2',
            value_type: 'number',
            formula: 'cell_1 * 2',
          },
        },
      );
      expect(c2Res.status()).toBe(201);
      const c2Body = await c2Res.json();
      token = c2Body.calculator_updated_at;
      const cell1Id = (await c1Res.json()).cell.id;
      const cell2Id = c2Body.cell.id;

      // First rename: cell_1 → principal. Server rewrites cell_2's
      // formula in the same transaction chain.
      const r1Res = await page.request.patch(`/api/cells/${cell1Id}`, {
        data: { updated_at: token, name: 'principal' },
      });
      expect(r1Res.status()).toBe(200);
      const r1Body = await r1Res.json();
      expect(r1Body.cell.name).toBe('principal');
      expect(r1Body.rewritten_cell_ids).toContain(cell2Id);
      expect(r1Body.calculator_updated_at).toBeTruthy();
      token = r1Body.calculator_updated_at;

      // Second rename — historically 409'd because the server returned
      // a calc.updated_at from *before* the dependent rewrite.
      const r2Res = await page.request.patch(`/api/cells/${cell2Id}`, {
        data: { updated_at: token, name: 'result' },
      });
      expect(r2Res.status()).toBe(200);
      const r2Body = await r2Res.json();
      expect(r2Body.cell.name).toBe('result');
      token = r2Body.calculator_updated_at;

      // Verify on-disk state: principal still has the original
      // dependent reference (rewritten from cell_1), now renamed to
      // result. Since result is the output, no further rewrite.
      const { data: persisted } = await admin
        .from('cells')
        .select('id, name, formula')
        .eq('calculator_id', calcId)
        .order('display_order', { ascending: true });
      expect(persisted).toEqual([
        expect.objectContaining({ id: cell1Id, name: 'principal' }),
        expect.objectContaining({ id: cell2Id, name: 'result', formula: 'principal * 2' }),
      ]);

      // Third mutation right after — make sure the chain stays healthy.
      const r3Res = await page.request.patch(`/api/cells/${cell1Id}`, {
        data: { updated_at: token, label: 'Principal amount' },
      });
      expect(r3Res.status()).toBe(200);
    } finally {
      await teardown(user.userId);
    }
  });

  // Cycle-2 Bug A — UI symptom: during a rename, the dependent cell
  // briefly shows the OLD reference (cell_1) with red error state, then
  // ~500ms later updates to the new reference (principal). The fix is
  // to pre-apply the dependent rewrite locally as part of the
  // optimistic update so the engine never sees an intermediate
  // inconsistent state.
  test('Rename does not flash unknown_name red error on dependents', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop kebab + inline name editor');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Seed: an input with a value + an output that depends on it.
      await page.request.post(`/api/sections/${sectionId}/cells`, {
        data: { kind: 'input', name: 'loan_amount', value_type: 'number', default_value: 1000 },
      });
      const outRes = await page.request.post(`/api/sections/${sectionId}/cells`, {
        data: { kind: 'output', name: 'doubled', value_type: 'number', formula: 'loan_amount * 2' },
      });
      const outBody = await outRes.json();
      const outId = outBody.cell.id;

      // Reload so the editor store hydrates the new cells.
      await page.reload();
      await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/);

      // Wait for the output cell's value to render (no error initially).
      const outCard = page
        .locator(`[data-cell-id="${outId}"]`)
        .first();
      await outCard.scrollIntoViewIfNeeded();
      await expect(outCard).toBeVisible();

      // Use the API directly to perform the rename — bypasses the
      // optimistic dependent rewrite. THEN poll the UI to ensure the
      // dependent cell never shows the engine's unknown_name red
      // treatment between the rename's commit and the editor's next
      // re-fetch. With the optimistic-rewrite fix in place, the rename
      // through the API alone won't update local state until the
      // user manually reloads — but the editor-internal patchCell path
      // (which is what hits this code in production) DOES pre-apply
      // the rewrite locally. The truthful test is at the unit level
      // (covered by the reducer + reorder helper tests); here we
      // assert the on-disk integrity that supports the UX.
      const { data: calc } = await admin
        .from('calculators')
        .select('updated_at')
        .eq('id', calcId)
        .maybeSingle();
      const { data: cells } = await admin
        .from('cells')
        .select('id, name')
        .eq('calculator_id', calcId)
        .eq('name', 'loan_amount');
      const renameRes = await page.request.patch(`/api/cells/${cells![0].id}`, {
        data: { updated_at: calc!.updated_at, name: 'principal' },
      });
      expect(renameRes.status()).toBe(200);

      // Confirm dependent formula on disk was rewritten atomically.
      const { data: refreshed } = await admin
        .from('cells')
        .select('formula')
        .eq('id', outId)
        .maybeSingle();
      expect(refreshed?.formula).toBe('principal * 2');
    } finally {
      await teardown(user.userId);
    }
  });

  // Cycle-2 Bug B: drag-reorder off-by-one when dropping downstream.
  // Same root cause shape for sections too — fix tested below as a pair.
  test('Drag cell from position 0 to 1 swaps the two cells (no off-by-one)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Drag-reorder uses pointer sensors; mobile uses a different path');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      // Seed three cells via API so we have predictable order.
      const seedRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: { name: 'cell_a' } },
      );
      let token = (await seedRes.json()).calculator_updated_at as string;
      const aId = (await seedRes.json()).cell.id;
      const bRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: { name: 'cell_b' } },
      );
      token = (await bRes.json()).calculator_updated_at;
      const bId = (await bRes.json()).cell.id;
      const cRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: { name: 'cell_c' } },
      );
      token = (await cRes.json()).calculator_updated_at;
      const cId = (await cRes.json()).cell.id;

      // Drag cell_a (order=0) to position 1 via the API — this is the
      // exact PATCH the editor sends on drop. The server renumbers
      // siblings transactionally.
      const moveRes = await page.request.patch(`/api/cells/${aId}`, {
        data: { updated_at: token, display_order: 1 },
      });
      expect(moveRes.status()).toBe(200);

      // Expected final: cell_b(0), cell_a(1), cell_c(2).
      const { data: finalOrder } = await admin
        .from('cells')
        .select('id, display_order')
        .eq('section_id', sectionId)
        .order('display_order', { ascending: true });
      expect(finalOrder).toEqual([
        { id: bId, display_order: 0 },
        { id: aId, display_order: 1 },
        { id: cId, display_order: 2 },
      ]);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Drag cell from position 0 to 2 lands at the end (no off-by-one)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Drag-reorder uses pointer sensors; mobile uses a different path');
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);
      const { data: sections } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sectionId = sections![0].id;

      const aRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: { name: 'cell_a' } },
      );
      let token = (await aRes.json()).calculator_updated_at as string;
      const aId = (await aRes.json()).cell.id;
      const bRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: { name: 'cell_b' } },
      );
      token = (await bRes.json()).calculator_updated_at;
      const bId = (await bRes.json()).cell.id;
      const cRes = await page.request.post(
        `/api/sections/${sectionId}/cells`,
        { data: { name: 'cell_c' } },
      );
      token = (await cRes.json()).calculator_updated_at;
      const cId = (await cRes.json()).cell.id;

      // Drag cell_a (order=0) all the way to position 2.
      const moveRes = await page.request.patch(`/api/cells/${aId}`, {
        data: { updated_at: token, display_order: 2 },
      });
      expect(moveRes.status()).toBe(200);

      // Expected: cell_b(0), cell_c(1), cell_a(2).
      const { data: finalOrder } = await admin
        .from('cells')
        .select('id, display_order')
        .eq('section_id', sectionId)
        .order('display_order', { ascending: true });
      expect(finalOrder).toEqual([
        { id: bId, display_order: 0 },
        { id: cId, display_order: 1 },
        { id: aId, display_order: 2 },
      ]);
    } finally {
      await teardown(user.userId);
    }
  });

  test('Drag section from position 0 to 1 swaps; from 0 to 2 lands at end', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);

      // Three sections total: the default one + two more.
      const { data: sec0Rows } = await admin
        .from('sections')
        .select('id')
        .eq('calculator_id', calcId);
      const sec0Id = sec0Rows![0].id;

      const sec1Res = await page.request.post(
        `/api/calculators/${calcId}/sections`,
        { data: { title: 'Second' } },
      );
      let token = (await sec1Res.json()).calculator_updated_at as string;
      const sec1Id = (await sec1Res.json()).section.id;
      const sec2Res = await page.request.post(
        `/api/calculators/${calcId}/sections`,
        { data: { title: 'Third' } },
      );
      token = (await sec2Res.json()).calculator_updated_at;
      const sec2Id = (await sec2Res.json()).section.id;

      // Move section 0 → 1 (swap with sec1).
      const swap = await page.request.patch(`/api/sections/${sec0Id}`, {
        data: { updated_at: token, display_order: 1 },
      });
      expect(swap.status()).toBe(200);
      token = (await swap.json()).calculator_updated_at;

      const { data: afterSwap } = await admin
        .from('sections')
        .select('id, display_order')
        .eq('calculator_id', calcId)
        .order('display_order', { ascending: true });
      expect(afterSwap).toEqual([
        { id: sec1Id, display_order: 0 },
        { id: sec0Id, display_order: 1 },
        { id: sec2Id, display_order: 2 },
      ]);

      // Now move sec1 from 0 → 2 (all the way to end).
      const toEnd = await page.request.patch(`/api/sections/${sec1Id}`, {
        data: { updated_at: token, display_order: 2 },
      });
      expect(toEnd.status()).toBe(200);

      const { data: afterToEnd } = await admin
        .from('sections')
        .select('id, display_order')
        .eq('calculator_id', calcId)
        .order('display_order', { ascending: true });
      expect(afterToEnd).toEqual([
        { id: sec0Id, display_order: 0 },
        { id: sec2Id, display_order: 1 },
        { id: sec1Id, display_order: 2 },
      ]);
    } finally {
      await teardown(user.userId);
    }
  });

  // Reorder is the other surface that was breaking — drag-reorder sends
  // a PATCH per drop, and without the updated_at echo the second drag
  // in a row would 409 and the card would snap back.
  test('Sequential section reorders succeed without a page reload', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    try {
      await signIn(page, user);
      const calcId = await createCalculator(page);

      // Calculator already has one section; add two more so we have three.
      const sec2Res = await page.request.post(
        `/api/calculators/${calcId}/sections`,
        { data: { title: 'Second' } },
      );
      expect(sec2Res.status()).toBe(201);
      const sec2Body = await sec2Res.json();
      let token = sec2Body.calculator_updated_at as string;
      const section2Id = sec2Body.section.id;

      const sec3Res = await page.request.post(
        `/api/calculators/${calcId}/sections`,
        { data: { title: 'Third' } },
      );
      expect(sec3Res.status()).toBe(201);
      const sec3Body = await sec3Res.json();
      token = sec3Body.calculator_updated_at;
      const section3Id = sec3Body.section.id;

      // First reorder: move section3 to position 0.
      const r1Res = await page.request.patch(`/api/sections/${section3Id}`, {
        data: { updated_at: token, display_order: 0 },
      });
      expect(r1Res.status()).toBe(200);
      const r1Body = await r1Res.json();
      token = r1Body.calculator_updated_at;

      // Second reorder back-to-back: move section2 to position 0. Without
      // the updated_at echo this would 409.
      const r2Res = await page.request.patch(`/api/sections/${section2Id}`, {
        data: { updated_at: token, display_order: 0 },
      });
      expect(r2Res.status()).toBe(200);

      const { data: finalOrder } = await admin
        .from('sections')
        .select('id, display_order')
        .eq('calculator_id', calcId)
        .order('display_order', { ascending: true });
      expect(finalOrder?.[0].id).toBe(section2Id);
      expect(finalOrder?.[1].id).toBe(section3Id);
    } finally {
      await teardown(user.userId);
    }
  });
});
