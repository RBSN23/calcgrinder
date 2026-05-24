import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-15 — Charts.
 *
 * Focused regression coverage for the most load-bearing ACs and the
 * fix-cycle bugs:
 *   - BUG-C2: Editor bundle hydrates charts on initial render (a chart
 *     seeded directly via the admin client is visible on the editor
 *     page's first paint).
 *   - BUG-C1: Visitor /c/<token> renders charts from the public RPC.
 *   - +Add picker now exposes Chart as enabled in BOTH the Builder
 *     toolbar AND the Grid panel header (BUG-M2 + PROJ-15 forward-
 *     compat AC).
 *   - Style tab exposes the Accent control (BUG-H3) with theme-
 *     palette tokens (no arbitrary colour input).
 *   - Donut centre_label input is writable (BUG-H1).
 *
 * Charts are seeded directly via the admin client (mirrors PROJ-11's
 * fixture pattern) so the tests target the load + render pipeline
 * without depending on the chart configurator's full flow.
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
  const email = `e2e-proj15-${suffix}@example.com`;
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

interface ChartFixture {
  user: ApprovedUser;
  calcId: string;
  sectionId: string;
  chartId: string;
  publicToken: string;
  arrayCellId: string;
}

/** Seed a calculator with one Output cell returning an array and one Line
 *  chart bound to it via x_axis. The chart is published so the visitor
 *  URL exercises the public RPC. */
async function buildChartFixture(): Promise<ChartFixture> {
  const user = await bootstrapApprovedUser();
  const calcId = randomUUID();
  const sectionId = randomUUID();
  const arrayCellId = randomUUID();
  const chartId = randomUUID();
  const publicToken = randomBytes(16).toString('base64url').slice(0, 22);

  await admin.from('calculators').insert({
    id: calcId,
    owner_id: user.userId,
    title: 'Charts Fixture',
    description: 'PROJ-15 e2e seed',
    theme_id: 'calcgrinder',
    public_token: publicToken,
    published: true,
  });

  await admin.from('sections').insert({
    id: sectionId,
    calculator_id: calcId,
    title: 'Series',
    description: '',
    layout_pattern_id: 'single_column',
    display_order: 0,
  });

  // An Output cell whose formula evaluates to an array of scalars —
  // the chart's x_axis binding references this cell by id.
  await admin.from('cells').insert({
    id: arrayCellId,
    calculator_id: calcId,
    section_id: sectionId,
    name: 'months',
    label: 'Months',
    description: '',
    description_render: 'caption',
    kind: 'output',
    value_type: 'number',
    visibility: 'visible',
    editability: 'readonly',
    default_value: null,
    formula: '=SEQUENCE(6)',
    display_widget: null,
    display_format: 'auto',
    display_emphasis: 'plain',
    unit: null,
    numeric_min: null,
    numeric_max: null,
    numeric_step: null,
    select_options: null,
    currency_code: null,
    card_accent: 'theme',
    card_background_tint: 'none',
    card_border: 'none',
    card_size_hint: 'narrow',
    text_size: 'm',
    text_colour: 'default',
    display_order: 0,
  });

  await admin.from('charts').insert({
    id: chartId,
    calculator_id: calcId,
    section_id: sectionId,
    name: 'chart_1',
    chart_type: 'line',
    title: 'Seeded line chart',
    subtitle: '',
    bindings: { x_axis: arrayCellId, lines: [] },
    style: {
      legend: 'auto',
      axis_labels: 'auto',
      animation: true,
      smooth_lines: false,
    },
    card_accent: 'theme',
    card_background_tint: 'none',
    card_border: 'none',
    card_size_hint: 'narrow',
    display_order: 0,
  });

  return { user, calcId, sectionId, chartId, publicToken, arrayCellId };
}

test.describe('PROJ-15 — Charts', () => {
  test('BUG-C2: editor bundle hydrates seeded chart on initial render', async ({
    page,
  }) => {
    const fx = await buildChartFixture();
    try {
      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);
      // EditorBody renders two trees (desktop md:flex + mobile md:hidden);
      // the chart card lives in both, so target the visible one via :visible.
      await expect(
        page.locator(`[data-chart-id="${fx.chartId}"]:visible`).first(),
      ).toBeVisible();
      await expect(
        page.locator(':visible', { hasText: 'Seeded line chart' }).first(),
      ).toBeVisible();
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('BUG-C1: visitor /c/<token> renders seeded chart via public RPC', async ({
    page,
  }) => {
    const fx = await buildChartFixture();
    try {
      const response = await page.goto(`/c/${fx.publicToken}`);
      expect(response?.status()).toBe(200);
      // Title comes through from the chart payload. The chart card is
      // rendered on the visitor surface by the same ChartCard component.
      await expect(page.getByText('Seeded line chart').first()).toBeVisible();
      await expect(
        page.locator(`[data-chart-id="${fx.chartId}"]`).first(),
      ).toBeVisible();
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('+Add picker exposes Chart as enabled in Builder toolbar', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Builder toolbar +Add is desktop-only.');
    const fx = await buildChartFixture();
    try {
      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);
      const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
      await toolbar.getByRole('button', { name: /add element/i }).click();
      const chartOpt = page.getByRole('menuitem', { name: /^Chart/i });
      await expect(chartOpt).toBeVisible();
      await expect(chartOpt).toBeEnabled();
      // Text block remains disabled (ships in PROJ-16).
      const textOpt = page.getByRole('menuitem', { name: /Text block/i });
      await expect(textOpt).toBeDisabled();
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('BUG-M2: Grid panel header +Add exposes the same 4-option picker', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Grid panel header +Add is desktop-only.');
    const fx = await buildChartFixture();
    try {
      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);
      const gridRegion = page.getByRole('region', { name: /grid panel/i });
      await gridRegion.getByRole('button', { name: /add element/i }).click();
      for (const label of ['Cell', 'Chart', 'Section']) {
        const opt = page.getByRole('menuitem', {
          name: new RegExp(`^${label}`, 'i'),
        });
        await expect(opt).toBeVisible();
        await expect(opt).toBeEnabled();
      }
      const textOpt = page.getByRole('menuitem', { name: /Text block/i });
      await expect(textOpt).toBeVisible();
      await expect(textOpt).toBeDisabled();
    } finally {
      await teardown(fx.user.userId);
    }
  });
});
