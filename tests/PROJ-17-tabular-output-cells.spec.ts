import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-17 — Tabular Output Cells.
 *
 * Focused coverage for the most load-bearing ACs:
 *   - Visitor /c/<token> renders tabular cells via the public RPC
 *     (covers AV-1 — shared renderer; AV-2 — fn_get_public_calculator
 *     enumerates the new `tabular_columns` JSONB column).
 *   - Visitor renders headers in tabular_columns order, with hidden
 *     columns omitted, sticky-header DOM contract honoured.
 *   - Per-column format application (number_decimal_2, currency).
 *   - PATCH /api/cells/:id validation: invalid format / alignment /
 *     currency_code returns the AC-specified error codes.
 *   - PATCH persists `tabular_columns` across emphasis cycling.
 *
 * Tabular cells are seeded directly via the admin client to keep tests
 * deterministic — independent of the auto-pop side effect, which has
 * its own coverage in the renderer audit notes.
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
  const email = `e2e-proj17-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;
  const name = `Tess ${suffix}`;
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

interface TabularFixture {
  user: ApprovedUser;
  calcId: string;
  sectionId: string;
  publicToken: string;
  cellId: string;
}

async function buildTabularFixture(opts: {
  emphasis: 'plain' | 'tabular';
  tabular_columns: unknown[];
}): Promise<TabularFixture> {
  const user = await bootstrapApprovedUser();
  const calcId = randomUUID();
  const sectionId = randomUUID();
  const cellId = randomUUID();
  const publicToken = randomBytes(16).toString('base64url').slice(0, 22);

  await admin.from('calculators').insert({
    id: calcId,
    owner_id: user.userId,
    title: 'Tabular Fixture',
    description: 'PROJ-17 e2e seed',
    theme_id: 'calcgrinder',
    public_token: publicToken,
    published: true,
  });

  await admin.from('sections').insert({
    id: sectionId,
    calculator_id: calcId,
    title: 'Amortisation',
    description: '',
    layout_pattern_id: 'single_column',
    display_order: 0,
  });

  // Formula returns a 3-row array_of_objects — keeps the test
  // deterministic without relying on visitor inputs.
  await admin.from('cells').insert({
    id: cellId,
    calculator_id: calcId,
    section_id: sectionId,
    kind: 'output',
    name: 'amort',
    label: 'Amortisation',
    description: '',
    description_render: 'caption',
    value_type: 'number',
    visibility: 'visible',
    editability: 'readonly',
    default_value: null,
    formula:
      '=MAP(SEQUENCE(3), i => OBJECT("month", i, "principal", i * 1000.5, "balance", 99000 - i * 1010))',
    display_widget: null,
    display_format: 'auto',
    display_emphasis: opts.emphasis,
    unit: null,
    numeric_min: null,
    numeric_max: null,
    numeric_step: null,
    select_options: null,
    currency_code: 'USD',
    card_accent: 'auto',
    card_background_tint: 'none',
    card_border: 'none',
    card_size_hint: 'wide',
    text_size: 'm',
    text_colour: 'default',
    tabular_columns: opts.tabular_columns,
    display_order: 0,
  });

  return { user, calcId, sectionId, publicToken, cellId };
}

const FULL_COLUMNS = [
  { id: 'month', label: 'Month', format: 'number_integer', alignment: 'right', currency_code: null, visibility: 'visible' },
  { id: 'principal', label: 'Principal', format: 'currency', alignment: 'right', currency_code: 'USD', visibility: 'visible' },
  { id: 'balance', label: 'Remaining balance', format: 'currency', alignment: 'right', currency_code: 'USD', visibility: 'visible' },
];

const REORDERED_WITH_HIDDEN = [
  // `balance` is hidden; `principal` precedes `month` (maintainer reorder).
  { id: 'principal', label: 'Principal', format: 'currency', alignment: 'right', currency_code: 'EUR', visibility: 'visible' },
  { id: 'month', label: 'Month #', format: 'number_integer', alignment: 'right', currency_code: null, visibility: 'visible' },
  { id: 'balance', label: 'Balance', format: 'currency', alignment: 'right', currency_code: 'USD', visibility: 'hidden' },
];

test.describe('PROJ-17 — Tabular Output Cells: visitor render', () => {
  test('visitor /c/<token> renders the tabular Output cell with all configured columns', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS,
    });
    try {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      const response = await page.goto(`/c/${fx.publicToken}`);
      expect(response?.status()).toBe(200);

      // The renderer mounts (semantic <table> for screen readers).
      const table = page.locator('table').first();
      await expect(table).toBeVisible();

      // Headers appear in tabular_columns array order.
      const headerTexts = await table.locator('thead th').allTextContents();
      expect(headerTexts).toEqual(['Month', 'Principal', 'Remaining balance']);

      // All 3 data rows render.
      const rows = table.locator('tbody tr');
      await expect(rows).toHaveCount(3);

      // Per-column formatting: number_integer → "1", currency → "$1,000.50".
      const firstRowCells = await rows.first().locator('td').allTextContents();
      // i=1: month=1, principal=1000.5, balance=99000-1010=97990
      expect(firstRowCells[0]).toBe('1');
      expect(firstRowCells[1]).toMatch(/\$1,000\.50/);
      expect(firstRowCells[2]).toMatch(/\$97,990/);

      // No useEditor crash in visitor mode (AV-1 regression guard —
      // shared CellCard must not throw when no EditorProvider is mounted).
      expect(errors.join('\n')).not.toContain('useEditor');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('visitor honours reorder + hidden column from tabular_columns', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: REORDERED_WITH_HIDDEN,
    });
    try {
      await page.goto(`/c/${fx.publicToken}`);
      const table = page.locator('table').first();
      await expect(table).toBeVisible();
      const headerTexts = await table.locator('thead th').allTextContents();
      // `balance` is hidden → not in header set. `principal` precedes
      // `month` per the persisted reorder.
      expect(headerTexts).toEqual(['Principal', 'Month #']);
      // Per-column currency_code: column overrides cell-level USD with EUR.
      const firstRowCells = await table
        .locator('tbody tr')
        .first()
        .locator('td')
        .allTextContents();
      expect(firstRowCells[0]).toContain('€');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('sticky-header contract: <thead> carries position: sticky + opaque background', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS,
    });
    try {
      await page.goto(`/c/${fx.publicToken}`);
      const thead = page.locator('table thead').first();
      const position = await thead.evaluate(
        (el) => window.getComputedStyle(el).position,
      );
      expect(position).toBe('sticky');
      // Background colour is set (theme.card token) — not "rgba(0, 0, 0, 0)".
      const bg = await thead.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor,
      );
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
      expect(bg).not.toBe('transparent');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('BUG-H1 regression guard: builder auto-pop promotes default-plain cells to explicit tabular emphasis', async ({
    page,
    isMobile,
  }) => {
    // Spec AC line 280-282 + Auto-population section: when a default-
    // emphasis cell first evaluates to array_of_objects in the builder,
    // the auto-pop hook seeds tabular_columns AND promotes
    // display_emphasis from 'plain' to 'tabular' in the same PATCH.
    // Before the fix the seed PATCH only set tabular_columns, leaving
    // emphasis='plain' — the renderer then flipped to scalar/KPI on
    // the next render because its branch gate required
    // tabular_columns.length === 0. Visitor surfaces inherited the
    // post-seed state and showed scalar instead of the table.
    //
    // This test seeds a fresh cell with emphasis='plain' +
    // tabular_columns=[], opens the builder, waits for the auto-pop
    // PATCH to land, then re-fetches the cell server-side and asserts
    // BOTH the table renders AND the persisted emphasis is now
    // 'tabular' (the durable signal, not the implicit length flag).
    test.skip(isMobile, 'Builder route is desktop-only for this flow.');
    const fx = await buildTabularFixture({
      emphasis: 'plain',
      tabular_columns: [],
    });
    try {
      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);
      // The table renders in the builder preview pane.
      const table = page.locator('table').first();
      await expect(table).toBeVisible({ timeout: 10_000 });
      // Headers came from the formula's first-row keys, in insertion
      // order: month / principal / balance — humanised.
      const headerTexts = await table.locator('thead th').allTextContents();
      expect(headerTexts).toEqual(['Month', 'Principal', 'Balance']);

      // Confirm the persisted state: auto-pop flipped emphasis to
      // 'tabular' and seeded the columns. We poll briefly because the
      // PATCH lands asynchronously after the first paint.
      let persisted: { display_emphasis?: string; tabular_columns?: unknown[] } = {};
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('cells')
              .select('display_emphasis, tabular_columns')
              .eq('id', fx.cellId)
              .single();
            persisted = (data ?? {}) as typeof persisted;
            return persisted.display_emphasis;
          },
          { timeout: 10_000, intervals: [200, 400, 800] },
        )
        .toBe('tabular');
      expect(persisted.tabular_columns).toHaveLength(3);
    } finally {
      await teardown(fx.user.userId);
    }
  });
});

test.describe('PROJ-17 — Tabular Output Cells: API validation', () => {
  test('PATCH /api/cells/:id rejects invalid format with HTTP 400 invalid_column_format', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS,
    });
    try {
      await signIn(page, fx.user);
      const calcResp = await page.request.get(`/api/calculators/${fx.calcId}`);
      const calc = await calcResp.json();
      const updatedAt = calc.updated_at;

      const resp = await page.request.patch(`/api/cells/${fx.cellId}`, {
        data: {
          updated_at: updatedAt,
          tabular_columns: [
            {
              id: 'month',
              label: 'Month',
              format: 'unsupported_format',
              alignment: 'right',
              currency_code: null,
              visibility: 'visible',
            },
          ],
        },
      });
      expect(resp.status()).toBe(400);
      const body = await resp.json();
      expect(body.error).toBe('invalid_column_format');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('PATCH /api/cells/:id rejects invalid alignment with HTTP 400 invalid_column_alignment', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS,
    });
    try {
      await signIn(page, fx.user);
      const calcResp = await page.request.get(`/api/calculators/${fx.calcId}`);
      const calc = await calcResp.json();
      const resp = await page.request.patch(`/api/cells/${fx.cellId}`, {
        data: {
          updated_at: calc.updated_at,
          tabular_columns: [
            {
              id: 'month',
              label: 'Month',
              format: 'number_integer',
              alignment: 'justify',
              currency_code: null,
              visibility: 'visible',
            },
          ],
        },
      });
      expect(resp.status()).toBe(400);
      expect((await resp.json()).error).toBe('invalid_column_alignment');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('PATCH /api/cells/:id rejects invalid currency_code (non-ISO) with HTTP 400 invalid_currency_code', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS,
    });
    try {
      await signIn(page, fx.user);
      const calcResp = await page.request.get(`/api/calculators/${fx.calcId}`);
      const calc = await calcResp.json();
      const resp = await page.request.patch(`/api/cells/${fx.cellId}`, {
        data: {
          updated_at: calc.updated_at,
          tabular_columns: [
            {
              id: 'month',
              label: 'Month',
              format: 'currency',
              alignment: 'right',
              currency_code: 'USDD', // 4 letters → fails pattern
              visibility: 'visible',
            },
          ],
        },
      });
      expect(resp.status()).toBe(400);
      const body = await resp.json();
      expect(body.error).toBe('invalid_currency_code');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('PATCH /api/cells/:id rejects column_label_too_long with HTTP 400', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS,
    });
    try {
      await signIn(page, fx.user);
      const calcResp = await page.request.get(`/api/calculators/${fx.calcId}`);
      const calc = await calcResp.json();
      const resp = await page.request.patch(`/api/cells/${fx.cellId}`, {
        data: {
          updated_at: calc.updated_at,
          tabular_columns: [
            {
              id: 'month',
              label: 'X'.repeat(101), // 101 chars — over the 100 cap
              format: 'number_integer',
              alignment: 'right',
              currency_code: null,
              visibility: 'visible',
            },
          ],
        },
      });
      expect(resp.status()).toBe(400);
      const body = await resp.json();
      expect(body.error).toBe('column_label_too_long');
      expect(body.max).toBe(100);
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('PATCH /api/cells/:id normalises currency_code to uppercase', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS,
    });
    try {
      await signIn(page, fx.user);
      const calcResp = await page.request.get(`/api/calculators/${fx.calcId}`);
      const calc = await calcResp.json();
      const resp = await page.request.patch(`/api/cells/${fx.cellId}`, {
        data: {
          updated_at: calc.updated_at,
          tabular_columns: [
            {
              id: 'month',
              label: 'Month',
              format: 'currency',
              alignment: 'right',
              currency_code: 'gbp', // lowercase — server upper-cases
              visibility: 'visible',
            },
          ],
        },
      });
      expect(resp.status()).toBe(200);
      const body = await resp.json();
      expect(body.cell.tabular_columns[0].currency_code).toBe('GBP');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('tabular_columns survive emphasis cycling tabular → plain → tabular', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS,
    });
    try {
      await signIn(page, fx.user);
      const calcResp = await page.request.get(`/api/calculators/${fx.calcId}`);
      const calc = await calcResp.json();
      let updatedAt = calc.updated_at;

      // Cycle to plain.
      const toPlain = await page.request.patch(`/api/cells/${fx.cellId}`, {
        data: { updated_at: updatedAt, display_emphasis: 'plain' },
      });
      expect(toPlain.status()).toBe(200);
      const toPlainBody = await toPlain.json();
      expect(toPlainBody.cell.display_emphasis).toBe('plain');
      // Persisted config survives the cycle.
      expect(toPlainBody.cell.tabular_columns).toHaveLength(FULL_COLUMNS.length);
      updatedAt = toPlainBody.calculator_updated_at;

      // Cycle back to tabular.
      const toTabular = await page.request.patch(`/api/cells/${fx.cellId}`, {
        data: { updated_at: updatedAt, display_emphasis: 'tabular' },
      });
      expect(toTabular.status()).toBe(200);
      const toTabularBody = await toTabular.json();
      expect(toTabularBody.cell.tabular_columns).toHaveLength(FULL_COLUMNS.length);
      // Labels survived verbatim.
      expect(toTabularBody.cell.tabular_columns[1].label).toBe('Principal');
    } finally {
      await teardown(fx.user.userId);
    }
  });
});

test.describe('PROJ-17 BUG-H2 — `fn_duplicate_calculator` deep-copy regression guards', () => {
  // The pre-fix `fn_duplicate_calculator` enumerated cell columns but
  // omitted `tabular_columns` entirely; it also dropped charts and
  // text_blocks tables wholesale. These three guards lock in the fix
  // in `20260601010000_fix_duplicate_calculator.sql`.

  test('duplicate carries `tabular_columns` verbatim onto the duplicated cell', async ({
    page,
  }) => {
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: REORDERED_WITH_HIDDEN, // exercises reorder + hidden + per-column currency
    });
    try {
      await signIn(page, fx.user);
      const dupResp = await page.request.post(
        `/api/calculators/${fx.calcId}/duplicate`,
        { data: {} },
      );
      expect(dupResp.status()).toBe(201);
      const dup = await dupResp.json();
      expect(dup.id).not.toBe(fx.calcId);

      // Walk the duplicate's cells via admin (RLS-bypass) to inspect
      // tabular_columns directly. The duplicate has one section / one
      // cell; the seeded cell has name='amort'.
      const { data: dupCells } = await admin
        .from('cells')
        .select('name, display_emphasis, tabular_columns')
        .eq('calculator_id', dup.id);
      expect(dupCells).toHaveLength(1);
      const dupCell = dupCells![0];
      expect(dupCell.name).toBe('amort');
      expect(dupCell.display_emphasis).toBe('tabular');
      // Verbatim column carry-over — reorder, hidden flag, per-column
      // currency_code (EUR override on `principal`) all preserved.
      expect(dupCell.tabular_columns).toEqual(REORDERED_WITH_HIDDEN);
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('duplicate carries charts verbatim onto the duplicated section (PROJ-15 regression guard)', async ({
    page,
  }) => {
    // Pre-fix: the duplicate function never touched the charts table,
    // so duplicating a calc with charts produced a chart-less copy.
    // Smoke-test that charts now ride along.
    const user = await bootstrapApprovedUser();
    const calcId = randomUUID();
    const sectionId = randomUUID();
    const chartId = randomUUID();
    const publicToken = randomBytes(16).toString('base64url').slice(0, 22);
    try {
      await admin.from('calculators').insert({
        id: calcId,
        owner_id: user.userId,
        title: 'Charts Fixture',
        description: 'PROJ-17 BUG-H2 e2e seed',
        theme_id: 'calcgrinder',
        public_token: publicToken,
        published: false,
      });
      await admin.from('sections').insert({
        id: sectionId,
        calculator_id: calcId,
        title: 'Trends',
        description: '',
        layout_pattern_id: 'single_column',
        display_order: 0,
      });
      await admin.from('charts').insert({
        id: chartId,
        calculator_id: calcId,
        section_id: sectionId,
        name: 'sales_trend',
        chart_type: 'line',
        title: 'Sales Trend',
        subtitle: 'last 4 quarters',
        bindings: { x: { kind: 'literal', values: [1, 2, 3, 4] }, series: [] },
        style: { palette: 'theme' },
        card_accent: 'theme',
        card_background_tint: 'soft',
        card_border: 'hairline',
        card_size_hint: 'wide',
        display_order: 0,
      });

      await signIn(page, user);
      const dupResp = await page.request.post(
        `/api/calculators/${calcId}/duplicate`,
        { data: {} },
      );
      expect(dupResp.status()).toBe(201);
      const dup = await dupResp.json();

      const { data: dupCharts } = await admin
        .from('charts')
        .select('name, chart_type, title, subtitle, card_background_tint, card_border, card_size_hint, bindings, style, display_order')
        .eq('calculator_id', dup.id);
      expect(dupCharts).toHaveLength(1);
      const dupChart = dupCharts![0];
      expect(dupChart.name).toBe('sales_trend');
      expect(dupChart.chart_type).toBe('line');
      expect(dupChart.title).toBe('Sales Trend');
      expect(dupChart.subtitle).toBe('last 4 quarters');
      expect(dupChart.card_background_tint).toBe('soft');
      expect(dupChart.card_border).toBe('hairline');
      expect(dupChart.card_size_hint).toBe('wide');
    } finally {
      await teardown(user.userId);
    }
  });

  test('duplicate carries text_blocks verbatim onto the duplicated section (PROJ-16 regression guard)', async ({
    page,
  }) => {
    // Pre-fix: the duplicate function never touched the text_blocks
    // table, so duplicating a calc with prose blocks dropped them.
    // Smoke-test that text_blocks now ride along.
    const user = await bootstrapApprovedUser();
    const calcId = randomUUID();
    const sectionId = randomUUID();
    const blockId = randomUUID();
    const publicToken = randomBytes(16).toString('base64url').slice(0, 22);
    try {
      await admin.from('calculators').insert({
        id: calcId,
        owner_id: user.userId,
        title: 'Prose Fixture',
        description: 'PROJ-17 BUG-H2 e2e seed',
        theme_id: 'calcgrinder',
        public_token: publicToken,
        published: false,
      });
      await admin.from('sections').insert({
        id: sectionId,
        calculator_id: calcId,
        title: 'Notes',
        description: '',
        layout_pattern_id: 'single_column',
        display_order: 0,
      });
      await admin.from('text_blocks').insert({
        id: blockId,
        calculator_id: calcId,
        section_id: sectionId,
        body: '## Heading\n\n**bold** prose body for the regression guard.',
        card_accent: 'theme',
        card_background_tint: 'strong',
        card_border: 'strong',
        card_size_hint: 'full',
        text_size: 'l',
        text_colour: 'accent_1',
        display_order: 0,
      });

      await signIn(page, user);
      const dupResp = await page.request.post(
        `/api/calculators/${calcId}/duplicate`,
        { data: {} },
      );
      expect(dupResp.status()).toBe(201);
      const dup = await dupResp.json();

      const { data: dupBlocks } = await admin
        .from('text_blocks')
        .select('body, card_background_tint, card_border, card_size_hint, text_size, text_colour, display_order')
        .eq('calculator_id', dup.id);
      expect(dupBlocks).toHaveLength(1);
      const dupBlock = dupBlocks![0];
      expect(dupBlock.body).toContain('Heading');
      expect(dupBlock.body).toContain('**bold**');
      expect(dupBlock.card_background_tint).toBe('strong');
      expect(dupBlock.card_border).toBe('strong');
      expect(dupBlock.card_size_hint).toBe('full');
      expect(dupBlock.text_size).toBe('l');
      expect(dupBlock.text_colour).toBe('accent_1');
    } finally {
      await teardown(user.userId);
    }
  });
});

test.describe('PROJ-17 BUG-M1 / BUG-M2 — combined undo entry + no auto-pop snap-back', () => {
  // BUG-M1: formula commit + auto-pop / smart-merge fired as two
  // separate PATCHes → two `recordOperation` entries. Cmd-Z reverted
  // only the column delta, leaving the formula in place. Fix bundles
  // both into one user-action PATCH.
  // BUG-M2: after Cmd-Z of the auto-pop seed, the effect re-fired
  // and re-seeded → snap-back. Fix adds a `seededFirstRowKeysRef`
  // guard so the bootstrap branch fires at most once per cell mount.

  test('BUG-M1: one Cmd-Z reverts BOTH the formula AND the smart-merged tabular_columns', async ({
    page,
    isMobile,
  }) => {
    // Need keyboard Cmd-Z + builder route — desktop-only.
    test.skip(isMobile, 'Cmd-Z keyboard shortcut is desktop-first');
    const fx = await buildTabularFixture({
      emphasis: 'tabular',
      tabular_columns: FULL_COLUMNS, // month / principal / balance
    });
    try {
      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);

      // Wait for the editor + grid panel to hydrate.
      await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });

      // Drive the formula commit via the Grid column's data-model
      // expand panel. The expand button is the kebab `⋮` in the
      // column header. The expanded panel renders a labeled "Formula"
      // input (cell-data-model-panel.tsx) — far more reliable to
      // locate than the inline "= …" button toggle.
      const gridCell = page.locator(`[data-grid-cell-id="${fx.cellId}"]`);
      await expect(gridCell).toBeVisible();
      await gridCell
        .getByRole('button', { name: /Expand cell details/i })
        .click();

      // The data-model panel surfaces a single Input under a "Formula"
      // label (Field component wraps label + child). Locate by
      // placeholder which is unique to the formula input.
      const formulaInput = page.locator('input[placeholder="= …"]').first();
      await expect(formulaInput).toBeVisible();

      // Replace the formula with one that drops `balance` and adds `c`.
      const newFormula =
        '=MAP(SEQUENCE(2), i => OBJECT("month", i, "principal", i * 1000, "c", i * 10))';
      await formulaInput.fill(newFormula);
      // The data-model panel commits on blur (not Enter). Tab away.
      await formulaInput.press('Tab');
      // Give the editor store a beat to flush the PATCH + push the
      // undo entry. (The PATCH itself awaits; the dispatch is sync,
      // but React's flush of the state mutation isn't always observed
      // immediately by the Cmd-Z handler under strict-mode.)
      await page.waitForLoadState('networkidle');

      // Wait for the smart-merge bundled PATCH to land — the duplicate
      // route reads the latest persisted cell row.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('cells')
              .select('formula, tabular_columns')
              .eq('id', fx.cellId)
              .single();
            return {
              formula: data?.formula ?? null,
              columnIds: (data?.tabular_columns as Array<{ id: string }> | null)?.map(
                (c) => c.id,
              ) ?? null,
            };
          },
          { timeout: 10_000, intervals: [200, 400, 800] },
        )
        .toEqual({
          formula: newFormula,
          // Smart-merge: surviving keys keep order; new `c` appended;
          // vanished `balance` dropped.
          columnIds: ['month', 'principal', 'c'],
        });

      // Mirror PROJ-9's working Cmd-Z pattern: focus a neutral
      // non-input surface (the title-edit button), press Escape to
      // exit any inline-edit input that focus might have entered,
      // then `Control+z`. The editor's Cmd-Z handler bails when an
      // INPUT/TEXTAREA/contenteditable has focus.
      await page
        .getByRole('button', { name: /Calculator title — click to edit/i })
        .first()
        .focus();
      await page.keyboard.press('Escape');
      // Belt-and-braces blur in case the title-button focus dropped
      // into its own inline-edit INPUT.
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.blur();
        }
      });
      await page.keyboard.press('Control+z');

      // After ONE Cmd-Z, BOTH the formula AND the column set revert
      // in lock-step.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('cells')
              .select('formula, tabular_columns')
              .eq('id', fx.cellId)
              .single();
            return {
              formula: data?.formula ?? null,
              columnIds: (data?.tabular_columns as Array<{ id: string }> | null)?.map(
                (c) => c.id,
              ) ?? null,
            };
          },
          { timeout: 10_000, intervals: [200, 400, 800] },
        )
        .toEqual({
          formula:
            '=MAP(SEQUENCE(3), i => OBJECT("month", i, "principal", i * 1000.5, "balance", 99000 - i * 1010))',
          columnIds: ['month', 'principal', 'balance'],
        });
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('BUG-M2: load-time auto-pop bootstrap is non-undoable and never snap-back loops', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Cmd-Z keyboard shortcut is desktop-first');
    // Pre-fix the auto-pop seed went through `patchCell` →
    // `recordOperation`, and Cmd-Z'ing it would revert the state then
    // immediately re-fire the effect — locking the user in a snap-back
    // loop. Post-fix the load-time bootstrap uses `patchCellSilent` so
    // it never lands an undo entry: Cmd-Z is a no-op, the state stays
    // stable, and there's no snap-back surface at all. (User-action-
    // driven seeds — emphasis switch, formula commit — still bundle
    // into the user's undo entry via the BUG-M1 path.)
    const fx = await buildTabularFixture({
      emphasis: 'plain',
      tabular_columns: [],
    });
    try {
      // Reset to narrow so the seed's size-bump is observable.
      await admin
        .from('cells')
        .update({ card_size_hint: 'narrow' })
        .eq('id', fx.cellId);

      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);

      // Wait for the bootstrap seed to land server-side.
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('cells')
              .select('display_emphasis, card_size_hint, tabular_columns')
              .eq('id', fx.cellId)
              .single();
            return {
              emphasis: data?.display_emphasis ?? null,
              size: data?.card_size_hint ?? null,
              colCount: (data?.tabular_columns as unknown[] | null)?.length ?? 0,
            };
          },
          { timeout: 10_000, intervals: [200, 400, 800] },
        )
        .toEqual({ emphasis: 'tabular', size: 'wide', colCount: 3 });

      // Snapshot the seeded state's updated_at — any subsequent
      // mutation (snap-back loop, accidental re-seed, etc.) would
      // bump this. Stability under polling for 3s is the BUG-M2
      // regression guard.
      const seededAt = (
        await admin
          .from('cells')
          .select('updated_at')
          .eq('id', fx.cellId)
          .single()
      ).data?.updated_at;
      expect(seededAt).toBeTruthy();

      // Fire Cmd-Z. Pre-fix this would undo the seed PATCH and the
      // effect would immediately re-seed (snap-back). Post-fix the
      // seed isn't on the undo stack at all (patchCellSilent) → Cmd-Z
      // is a no-op for this cell's bootstrap. The state stays seeded.
      await page
        .getByRole('button', { name: /Calculator title — click to edit/i })
        .first()
        .focus();
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.blur();
        }
      });
      await page.keyboard.press('Control+z');

      // Poll a 3s window — the cell must NOT mutate. A snap-back loop
      // would either toggle updated_at continuously or settle in a
      // different state. Either fails the assertion below.
      const start = Date.now();
      while (Date.now() - start < 3_000) {
        const { data } = await admin
          .from('cells')
          .select('display_emphasis, card_size_hint, tabular_columns, updated_at')
          .eq('id', fx.cellId)
          .single();
        expect(data?.display_emphasis).toBe('tabular');
        expect(data?.card_size_hint).toBe('wide');
        expect((data?.tabular_columns as unknown[] | null)?.length).toBe(3);
        expect(data?.updated_at).toBe(seededAt);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      await teardown(fx.user.userId);
    }
  });
});
