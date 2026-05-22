import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * End-to-end tests for the PROJ-1 cron stub endpoint.
 *
 * The route handler is already covered by unit tests
 * (src/app/api/cron/purge/route.test.ts) for the seven auth-logic
 * permutations. These E2E tests verify the HTTP plumbing — that
 * Next.js routing, the nodejs runtime, and the dev server wire the
 * endpoint correctly so a real HTTP call returns the expected response.
 *
 * The CRON_SECRET used here is read from .env.local — the same value
 * the dev server (started by playwright.config.ts → webServer) sees.
 */

function loadCronSecret(): string {
  const envPath = resolve(__dirname, '..', '.env.local');
  const contents = readFileSync(envPath, 'utf8');
  const match = contents.match(/^CRON_SECRET=(.*)$/m);
  if (!match || !match[1]) {
    throw new Error('CRON_SECRET not found in .env.local');
  }
  return match[1].trim();
}

const CRON_SECRET = loadCronSecret();

test.describe('GET /api/cron/purge', () => {
  test('returns 200 with the stub payload when the bearer matches', async ({ request }) => {
    const response = await request.get('/api/cron/purge', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      purged: 0,
      retention_days: expect.any(Number),
    });
    // retention_days defaults to 30 in PROJ-1 unless RETENTION_PERIOD_DAYS
    // is set. The dev server uses whatever value is in .env.local.
    expect(body.retention_days).toBeGreaterThan(0);
  });

  test('returns 401 with an empty body when no Authorization header is sent', async ({ request }) => {
    const response = await request.get('/api/cron/purge');
    expect(response.status()).toBe(401);
    expect(await response.text()).toBe('');
  });

  test('returns 401 for a wrong bearer of matching length', async ({ request }) => {
    const wrong = 'x'.repeat(CRON_SECRET.length);
    const response = await request.get('/api/cron/purge', {
      headers: { Authorization: `Bearer ${wrong}` },
    });
    expect(response.status()).toBe(401);
    expect(await response.text()).toBe('');
  });

  test('returns 401 for a bearer of obviously wrong length', async ({ request }) => {
    const response = await request.get('/api/cron/purge', {
      headers: { Authorization: 'Bearer xx' },
    });
    expect(response.status()).toBe(401);
    expect(await response.text()).toBe('');
  });

  test('returns 405 for a POST request even with the correct bearer', async ({ request }) => {
    const response = await request.post('/api/cron/purge', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(response.status()).toBe(405);
  });

  test('rejects an unknown auth scheme (Basic) with 401', async ({ request }) => {
    // The handler requires the "Bearer " prefix; "Basic <secret>" is rejected.
    const response = await request.get('/api/cron/purge', {
      headers: { Authorization: `Basic ${CRON_SECRET}` },
    });
    expect(response.status()).toBe(401);
    expect(await response.text()).toBe('');
  });
});
