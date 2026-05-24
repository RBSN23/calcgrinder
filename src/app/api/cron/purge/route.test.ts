import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the admin client BEFORE importing the route so the route picks
// up the mocked module. The mock returns a chainable builder that
// resolves to a configurable `{ data, error }` payload — tests
// override it per case.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/admin';

import { GET } from './route';

const CRON_SECRET = 'a'.repeat(64);

const mockCreateAdminClient = vi.mocked(createAdminClient);

function makeRequest(headers?: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/cron/purge', {
    method: 'GET',
    headers,
  });
}

function makeAdminClient(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.delete = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.lt = vi.fn(() => builder);
  builder.select = vi.fn(async () => result);
  return {
    from: vi.fn(() => builder),
    _builder: builder,
  };
}

describe('GET /api/cron/purge', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    vi.stubEnv('RETENTION_PERIOD_DAYS', '');
    mockCreateAdminClient.mockReset();
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient({ data: [], error: null }) as unknown as ReturnType<
        typeof createAdminClient
      >,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns 200 with purged=0 when nothing is past the retention cutoff', async () => {
    const response = await GET(makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      purged: 0,
      retention_days: 30,
    });
  });

  it('returns 200 with the real purged count when rows are deleted', async () => {
    const purgedRows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const admin = makeAdminClient({ data: purgedRows, error: null });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      purged: 3,
      retention_days: 30,
    });
    expect(admin.from).toHaveBeenCalledWith('calculators');
    expect(admin._builder.delete).toHaveBeenCalled();
    expect(admin._builder.not).toHaveBeenCalledWith('soft_delete_at', 'is', null);
    expect(admin._builder.lt).toHaveBeenCalledWith(
      'soft_delete_at',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
  });

  it('uses the configured RETENTION_PERIOD_DAYS for the cutoff', async () => {
    vi.stubEnv('RETENTION_PERIOD_DAYS', '7');
    const before = Date.now();
    const admin = makeAdminClient({ data: [], error: null });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }));
    const after = Date.now();

    expect(response.status).toBe(200);
    expect((await response.json()).retention_days).toBe(7);

    const ltCall = (admin._builder.lt as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(ltCall?.[0]).toBe('soft_delete_at');
    const cutoff = Date.parse(String(ltCall?.[1]));
    // Cutoff should be ~7 days before "now" (window allows for the
    // time spent inside the handler).
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(cutoff).toBeGreaterThanOrEqual(before - sevenDaysMs - 1000);
    expect(cutoff).toBeLessThanOrEqual(after - sevenDaysMs + 1000);
  });

  it('returns 500 with purge_failed when the DELETE errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const admin = makeAdminClient({
      data: null,
      error: { message: 'db down' },
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'purge_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 401 with an empty body when the Authorization header is missing', async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 401 with an empty body for a wrong bearer of matching length', async () => {
    const wrongBearer = 'b'.repeat(64);
    const response = await GET(makeRequest({ Authorization: `Bearer ${wrongBearer}` }));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 401 with an empty body for a bearer of obviously wrong length', async () => {
    // Length-mismatch should short-circuit before timingSafeEqual runs.
    const response = await GET(makeRequest({ Authorization: 'Bearer xx' }));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 500 with an error-level log when CRON_SECRET is unset', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(makeRequest({ Authorization: 'Bearer anything' }));

    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
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
