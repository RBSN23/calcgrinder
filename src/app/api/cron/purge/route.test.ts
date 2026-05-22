import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const CRON_SECRET = 'a'.repeat(64);

function makeRequest(headers?: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/cron/purge', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/cron/purge', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    vi.stubEnv('RETENTION_PERIOD_DAYS', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns 200 with stub payload when the bearer matches', async () => {
    const response = await GET(makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      purged: 0,
      retention_days: 30,
    });
  });

  it('returns 401 with an empty body when the Authorization header is missing', async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
  });

  it('returns 401 with an empty body for a wrong bearer of matching length', async () => {
    const wrongBearer = 'b'.repeat(64);
    const response = await GET(makeRequest({ Authorization: `Bearer ${wrongBearer}` }));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
  });

  it('returns 401 with an empty body for a bearer of obviously wrong length', async () => {
    // Length-mismatch should short-circuit before timingSafeEqual runs.
    const response = await GET(makeRequest({ Authorization: 'Bearer xx' }));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
  });

  it('returns 500 with an error-level log when CRON_SECRET is unset', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(makeRequest({ Authorization: 'Bearer anything' }));

    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns retention_days=30 as the default when RETENTION_PERIOD_DAYS is unset', async () => {
    const response = await GET(makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }));
    const body = await response.json();
    expect(body.retention_days).toBe(30);
  });

  it('returns the env value when RETENTION_PERIOD_DAYS is set', async () => {
    vi.stubEnv('RETENTION_PERIOD_DAYS', '45');
    const response = await GET(makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }));
    const body = await response.json();
    expect(body.retention_days).toBe(45);
  });
});
