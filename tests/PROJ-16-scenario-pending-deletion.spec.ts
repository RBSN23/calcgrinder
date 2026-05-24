import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * PROJ-16 — KI-1 mirror on the scenario surface.
 *
 * PROJ-14 introduced the visitor read filter for owners in
 * `pending_deletion` via a `JOIN public.profiles ... AND status =
 * 'approved'` clause on both public RPCs. PROJ-15's chart wire-through
 * silently dropped that clause from both RPCs. PROJ-16's
 * `20260531000001_public_calculator_text_blocks.sql` migration restores
 * the JOIN on both — `fn_get_public_calculator` AND
 * `fn_get_scenario_by_share_token`.
 *
 * `tests/PROJ-14-settings.spec.ts:593` is the regression gate for the
 * /c/<token> surface. This file is its scenario-surface mirror:
 * /c/<calc_token>?s=<share_token>. A scenario published while the
 * owner was approved must be hidden once the owner moves to
 * `pending_deletion`, matching the calculator-page semantics.
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
  const email = `e2e-proj16-scn-${suffix}@example.com`;
  const password = `Password-${randomBytes(6).toString('hex')}`;
  const name = `Scn ${suffix}`;

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

test.describe('PROJ-16 — KI-1 mirror: scenario surface respects owner.status', () => {
  test('scenario URL of a calc whose owner is in pending_deletion is hidden', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    const calcId = randomUUID();
    const scenarioId = randomUUID();
    const publicToken = randomBytes(16).toString('base64url').slice(0, 22);
    const shareToken = randomBytes(16).toString('base64url').slice(0, 22);

    try {
      await admin.from('calculators').insert({
        id: calcId,
        owner_id: user.userId,
        title: 'Scenario KI-1 Mirror',
        description: '',
        theme_id: 'calcgrinder',
        public_token: publicToken,
        published: true,
      });

      await admin.from('scenarios').insert({
        id: scenarioId,
        owner_id: user.userId,
        calculator_id: calcId,
        title: 'Saved while approved',
        description: '',
        values: {},
        share_token: shareToken,
      });

      const scenarioUrl = `/c/${publicToken}?s=${shareToken}`;

      // Sanity: while the owner is approved, the scenario URL serves.
      const ok = await page.request.get(scenarioUrl, {
        headers: { cookie: '' },
      });
      expect(ok.status()).toBe(200);

      // Flip the owner to pending_deletion. The owner's calculator is
      // still published; only the profile.status changed.
      await admin
        .from('profiles')
        .update({
          status: 'pending_deletion',
          pending_deletion_at: new Date().toISOString(),
        })
        .eq('id', user.userId);

      // With the JOIN clause `owner_profile.status = 'approved'`
      // restored on fn_get_scenario_by_share_token, the RPC now returns
      // 0 rows and the scenario surface treats the URL as not-found.
      // Whether the handler maps to 404 or 410 is a separate question
      // (BUG-M1 PROJ-14); the regression gate just asserts the visitor
      // can no longer see scenario content.
      const after = await page.request.get(scenarioUrl, {
        headers: { cookie: '' },
      });
      expect([404, 410]).toContain(after.status());
    } finally {
      await teardown(user.userId);
    }
  });

  test('scenario URL with text-block payload still renders when owner is approved (positive control)', async ({
    page,
  }) => {
    const user = await bootstrapApprovedUser();
    const calcId = randomUUID();
    const sectionId = randomUUID();
    const textBlockId = randomUUID();
    const scenarioId = randomUUID();
    const publicToken = randomBytes(16).toString('base64url').slice(0, 22);
    const shareToken = randomBytes(16).toString('base64url').slice(0, 22);

    try {
      await admin.from('calculators').insert({
        id: calcId,
        owner_id: user.userId,
        title: 'Scenario w/ text block',
        description: '',
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

      await admin.from('text_blocks').insert({
        id: textBlockId,
        calculator_id: calcId,
        section_id: sectionId,
        body: 'Scenario rider — **bold prose**.',
        display_order: 0,
      });

      await admin.from('scenarios').insert({
        id: scenarioId,
        owner_id: user.userId,
        calculator_id: calcId,
        title: 'A scenario',
        description: '',
        values: {},
        share_token: shareToken,
      });

      // The scenario URL should serve the calculator page and surface
      // the text_block from the extended `fn_get_scenario_by_share_token`
      // RPC payload.
      await page.goto(`/c/${publicToken}?s=${shareToken}`);
      await expect(
        page.locator(`[data-text-block-id="${textBlockId}"]`).first(),
      ).toBeVisible();
      await expect(page.locator('strong', { hasText: 'bold prose' })).toBeVisible();
    } finally {
      await teardown(user.userId);
    }
  });
});
