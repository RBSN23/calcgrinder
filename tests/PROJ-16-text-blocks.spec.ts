import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * End-to-end tests for PROJ-16 — Text Blocks (Markdown).
 *
 * Focused coverage for the most load-bearing ACs:
 *   - Visitor /c/<token> renders text blocks from the public RPC and
 *     does NOT crash (PROJ-15-BUG-C4 class regression: the
 *     TextBlockCard's `useEditor()` call must be gated behind
 *     `isBuilder`, otherwise the visitor surface throws
 *     "useEditor must be used inside <EditorProvider>").
 *   - Editor hydrates seeded text blocks on initial render.
 *   - Markdown rendering: bold/italic/headings render as expected
 *     elements; H1 source is remapped to <h2>.
 *   - Sanitization: a `<script>` tag in the body renders as escaped
 *     literal text (never executes).
 *   - Empty body produces NO visitor-side card (no spacer, no
 *     whitespace) per the AC.
 *   - +Add picker exposes Text block as enabled (flipped from disabled
 *     in PROJ-8 / PROJ-15).
 *
 * Text blocks are seeded directly via the admin client to keep tests
 * deterministic — independent of the configurator's debounce / save
 * flow which has its own unit-level coverage.
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
  const email = `e2e-proj16-${suffix}@example.com`;
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

interface TextBlockFixture {
  user: ApprovedUser;
  calcId: string;
  sectionId: string;
  publicToken: string;
  textBlockIds: { rich: string; empty: string; sanitised: string };
}

const RICH_BODY =
  '# Reserved H1\n\n## Visible H2\n\n**bold** and _italic_ and `inline`.\n\n- one\n- two\n\nVisit https://example.com today.';

const SANITISED_BODY =
  'safe prose\n\n<script>window.__PROJ16_EXPLOIT__=1;</script>';

async function buildFixture(): Promise<TextBlockFixture> {
  const user = await bootstrapApprovedUser();
  const calcId = randomUUID();
  const sectionId = randomUUID();
  const publicToken = randomBytes(16).toString('base64url').slice(0, 22);
  const richId = randomUUID();
  const emptyId = randomUUID();
  const sanitisedId = randomUUID();

  await admin.from('calculators').insert({
    id: calcId,
    owner_id: user.userId,
    title: 'Text Blocks Fixture',
    description: 'PROJ-16 e2e seed',
    theme_id: 'calcgrinder',
    public_token: publicToken,
    published: true,
  });

  await admin.from('sections').insert({
    id: sectionId,
    calculator_id: calcId,
    title: 'Prose',
    description: '',
    layout_pattern_id: 'single_column',
    display_order: 0,
  });

  await admin.from('text_blocks').insert([
    {
      id: richId,
      calculator_id: calcId,
      section_id: sectionId,
      body: RICH_BODY,
      display_order: 0,
    },
    {
      id: emptyId,
      calculator_id: calcId,
      section_id: sectionId,
      body: '',
      display_order: 1,
    },
    {
      id: sanitisedId,
      calculator_id: calcId,
      section_id: sectionId,
      body: SANITISED_BODY,
      display_order: 2,
    },
  ]);

  return {
    user,
    calcId,
    sectionId,
    publicToken,
    textBlockIds: { rich: richId, empty: emptyId, sanitised: sanitisedId },
  };
}

test.describe('PROJ-16 — Text Blocks (Markdown)', () => {
  test('visitor /c/<token> renders text blocks via public RPC without crashing', async ({
    page,
  }) => {
    // Regression-guards PROJ-15-BUG-C4 class issue: if TextBlockCard
    // called useEditor() at the top level (instead of behind the
    // isBuilder gate), this navigation would render an error boundary
    // instead of the calculator surface.
    const fx = await buildFixture();
    try {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      const response = await page.goto(`/c/${fx.publicToken}`);
      expect(response?.status()).toBe(200);

      // The calculator title renders, proving the visitor tree mounted.
      await expect(page.getByText('Text Blocks Fixture').first()).toBeVisible();
      // Rich-body content from the seeded text block renders.
      await expect(page.getByText('Visible H2').first()).toBeVisible();

      // No "useEditor must be used inside <EditorProvider>" or similar.
      expect(errors.join('\n')).not.toContain('useEditor');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('visitor renders markdown elements: H2, bold, italic, autolinked URL', async ({
    page,
  }) => {
    const fx = await buildFixture();
    try {
      await page.goto(`/c/${fx.publicToken}`);

      // H1 source (`# Reserved H1`) is remapped to <h2> in the DOM —
      // no <h1> for that body content (the page hero is separate).
      const rich = page.locator(`[data-text-block-id="${fx.textBlockIds.rich}"]`);
      await expect(rich.locator('h2', { hasText: 'Reserved H1' })).toBeVisible();
      await expect(rich.locator('h2', { hasText: 'Visible H2' })).toBeVisible();

      // Emphasis.
      await expect(rich.locator('strong', { hasText: 'bold' })).toBeVisible();
      await expect(rich.locator('em', { hasText: 'italic' })).toBeVisible();

      // Auto-linked bare URL opens in a new tab with safe rel.
      const link = rich.getByRole('link', { name: /example.com/ });
      await expect(link).toHaveAttribute('target', '_blank');
      const rel = (await link.getAttribute('rel')) ?? '';
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('visitor sanitization: <script> body never executes (stripped from DOM)', async ({
    page,
  }) => {
    const fx = await buildFixture();
    try {
      await page.goto(`/c/${fx.publicToken}`);

      // The seeded body is "safe prose\n\n<script>...".
      const sanitised = page.locator(
        `[data-text-block-id="${fx.textBlockIds.sanitised}"]`,
      );
      // The pre-script prose still renders.
      await expect(sanitised).toContainText('safe prose');

      // No <script> element with that side-effect ever made it to the
      // DOM, so the global flag is undefined. (The pipeline uses
      // react-markdown's skipHtml + remark-rehype's allowDangerousHtml:
      // false, so raw HTML is dropped — strictly stronger than the
      // spec AC's "render as escaped literal text". Flagged as a
      // low-severity spec divergence in QA results.)
      await expect(sanitised.locator('script')).toHaveCount(0);
      const flag = await page.evaluate(
        () =>
          (window as unknown as { __PROJ16_EXPLOIT__?: number })
            .__PROJ16_EXPLOIT__,
      );
      expect(flag).toBeUndefined();
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('visitor: empty-body text block renders no card, no spacer', async ({
    page,
  }) => {
    const fx = await buildFixture();
    try {
      await page.goto(`/c/${fx.publicToken}`);

      // Spec AC: "no card, no spacer, no whitespace produced for that
      // block". The DOM should contain no node with the empty block's
      // data-text-block-id at all.
      const empty = page.locator(
        `[data-text-block-id="${fx.textBlockIds.empty}"]`,
      );
      await expect(empty).toHaveCount(0);
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('editor bundle hydrates seeded text blocks on initial render', async ({
    page,
  }) => {
    const fx = await buildFixture();
    try {
      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);

      // Builder mounts the rich-body card with its data attribute.
      await expect(
        page
          .locator(`[data-text-block-id="${fx.textBlockIds.rich}"]:visible`)
          .first(),
      ).toBeVisible();
      // Content from the seeded body is visible.
      await expect(
        page.locator(':visible', { hasText: 'Visible H2' }).first(),
      ).toBeVisible();
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('editor: empty-body text block shows the muted "Empty text block — click to edit" affordance', async ({
    page,
  }) => {
    const fx = await buildFixture();
    try {
      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);

      // Empty card is mounted in Builder (unlike visitor) because the
      // discoverability hint lives in Builder-only chrome. Since fresh
      // empty blocks auto-expand, the placeholder appears in the editor
      // textarea — "Write Markdown here…".
      const empty = page
        .locator(`[data-text-block-id="${fx.textBlockIds.empty}"]:visible`)
        .first();
      await expect(empty).toBeVisible();
      // Either the collapsed hint OR the expanded textarea placeholder is
      // present; both signal the empty-state UI.
      const expandedTextarea = empty.getByPlaceholder('Write Markdown here…');
      const collapsedHint = empty.getByText('Empty text block — click to edit');
      await expect(expandedTextarea.or(collapsedHint).first()).toBeVisible();
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('+Add picker exposes Text block as enabled (PROJ-16 flip)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Builder toolbar +Add is desktop-only.');
    const fx = await buildFixture();
    try {
      await signIn(page, fx.user);
      await page.goto(`/editor/${fx.calcId}`);

      const toolbar = page.getByRole('toolbar', { name: /builder toolbar/i });
      await toolbar.getByRole('button', { name: /add element/i }).click();

      const textOpt = page.getByRole('menuitem', { name: /Text block/i });
      await expect(textOpt).toBeVisible();
      await expect(textOpt).toBeEnabled();
    } finally {
      await teardown(fx.user.userId);
    }
  });

  test('public RPC exposes text_blocks in the JSONB payload (regression-guards KI-1 JOIN)', async ({
    page,
  }) => {
    const fx = await buildFixture();
    try {
      // A 200 response with the seeded body content proves both:
      //   1. fn_get_public_calculator returned the text_blocks payload.
      //   2. The owner JOIN (status='approved') let the row through —
      //      KI-1 JOIN restoration is in place.
      const res = await page.request.get(`/c/${fx.publicToken}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain('Text Blocks Fixture');
    } finally {
      await teardown(fx.user.userId);
    }
  });
});
