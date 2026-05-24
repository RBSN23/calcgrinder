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

type BuilderResult = { data: unknown; error: unknown };

/**
 * Mock admin client covering both purge passes the route runs in
 * sequence:
 *   1. `from('calculators').delete().not().lt().select()`
 *   2. `from('profiles').select().eq().not().lt()`
 *   3. `admin.auth.admin.deleteUser(id)` per row from pass 2
 */
function makeAdminClient(opts: {
  calculators?: BuilderResult;
  profiles?: BuilderResult;
  deleteUser?: (id: string) => Promise<{ error: unknown }>;
}) {
  const calculators: BuilderResult = opts.calculators ?? {
    data: [],
    error: null,
  };
  const profiles: BuilderResult = opts.profiles ?? { data: [], error: null };

  const calcBuilder: Record<string, unknown> = {};
  calcBuilder.delete = vi.fn(() => calcBuilder);
  calcBuilder.not = vi.fn(() => calcBuilder);
  calcBuilder.lt = vi.fn(() => calcBuilder);
  calcBuilder.select = vi.fn(async () => calculators);

  const profilesBuilder: Record<string, unknown> = {};
  profilesBuilder.select = vi.fn(() => profilesBuilder);
  profilesBuilder.eq = vi.fn(() => profilesBuilder);
  profilesBuilder.not = vi.fn(() => profilesBuilder);
  // Final `.lt(...)` resolves the chain — that's the awaited point in the
  // route — so it returns the data wrapper directly.
  profilesBuilder.lt = vi.fn(async () => profiles);

  const deleteUser =
    opts.deleteUser ?? (async () => ({ error: null }));

  return {
    from: vi.fn((table: string) => {
      if (table === 'calculators') return calcBuilder;
      if (table === 'profiles') return profilesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    }),
    auth: {
      admin: {
        deleteUser: vi.fn(deleteUser),
      },
    },
    _calcBuilder: calcBuilder,
    _profilesBuilder: profilesBuilder,
  };
}

describe('GET /api/cron/purge', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    vi.stubEnv('RETENTION_PERIOD_DAYS', '');
    mockCreateAdminClient.mockReset();
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient({}) as unknown as ReturnType<typeof createAdminClient>,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns 200 with zero counts when nothing is past the retention cutoff', async () => {
    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      purged: 0,
      purged_calculators: 0,
      purged_accounts: 0,
      retention_days: 30,
    });
  });

  it('returns the real purged_calculators count when calculators are deleted', async () => {
    const admin = makeAdminClient({
      calculators: {
        data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        error: null,
      },
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.purged_calculators).toBe(3);
    expect(body.purged).toBe(3);
    expect(body.purged_accounts).toBe(0);
    expect(admin.from).toHaveBeenCalledWith('calculators');
    expect(admin._calcBuilder.delete).toHaveBeenCalled();
    expect(admin._calcBuilder.not).toHaveBeenCalledWith(
      'soft_delete_at',
      'is',
      null,
    );
    expect(admin._calcBuilder.lt).toHaveBeenCalledWith(
      'soft_delete_at',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
  });

  it('hard-deletes auth users for expired pending_deletion profiles', async () => {
    const deleteUserSpy = vi.fn(async () => ({ error: null }));
    const admin = makeAdminClient({
      profiles: {
        data: [{ id: 'user-1' }, { id: 'user-2' }],
        error: null,
      },
      deleteUser: deleteUserSpy,
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.purged_accounts).toBe(2);
    expect(admin.from).toHaveBeenCalledWith('profiles');
    expect(admin._profilesBuilder.select).toHaveBeenCalledWith('id');
    expect(admin._profilesBuilder.eq).toHaveBeenCalledWith(
      'status',
      'pending_deletion',
    );
    expect(admin._profilesBuilder.not).toHaveBeenCalledWith(
      'pending_deletion_at',
      'is',
      null,
    );
    expect(admin._profilesBuilder.lt).toHaveBeenCalledWith(
      'pending_deletion_at',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
    expect(deleteUserSpy).toHaveBeenCalledTimes(2);
    expect(deleteUserSpy).toHaveBeenCalledWith('user-1');
    expect(deleteUserSpy).toHaveBeenCalledWith('user-2');
  });

  it('continues to next user when one deleteUser call fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deleteUserSpy = vi.fn(async (id: string) =>
      id === 'user-1' ? { error: { message: 'boom' } } : { error: null },
    );
    const admin = makeAdminClient({
      profiles: {
        data: [{ id: 'user-1' }, { id: 'user-2' }],
        error: null,
      },
      deleteUser: deleteUserSpy,
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    // Only user-2 counted; user-1 failed and was skipped.
    expect(body.purged_accounts).toBe(1);
    expect(deleteUserSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('uses the configured RETENTION_PERIOD_DAYS for both cutoffs', async () => {
    vi.stubEnv('RETENTION_PERIOD_DAYS', '7');
    const before = Date.now();
    const admin = makeAdminClient({});
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );
    const after = Date.now();

    expect(response.status).toBe(200);
    expect((await response.json()).retention_days).toBe(7);

    const calcCutoff = Date.parse(
      String(
        (admin._calcBuilder.lt as ReturnType<typeof vi.fn>).mock.calls[0]?.[1],
      ),
    );
    const profileCutoff = Date.parse(
      String(
        (admin._profilesBuilder.lt as ReturnType<typeof vi.fn>).mock
          .calls[0]?.[1],
      ),
    );
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    for (const cutoff of [calcCutoff, profileCutoff]) {
      expect(cutoff).toBeGreaterThanOrEqual(before - sevenDaysMs - 1000);
      expect(cutoff).toBeLessThanOrEqual(after - sevenDaysMs + 1000);
    }
  });

  it('returns 500 with purge_failed when the calculator DELETE errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const admin = makeAdminClient({
      calculators: { data: null, error: { message: 'db down' } },
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'purge_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 500 with purge_failed when the pending_deletion SELECT errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const admin = makeAdminClient({
      profiles: { data: null, error: { message: 'db down' } },
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );

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
    const response = await GET(
      makeRequest({ Authorization: `Bearer ${wrongBearer}` }),
    );
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

    const response = await GET(
      makeRequest({ Authorization: 'Bearer anything' }),
    );

    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns retention_days=30 as the default when RETENTION_PERIOD_DAYS is unset', async () => {
    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );
    const body = await response.json();
    expect(body.retention_days).toBe(30);
  });

  it('returns the env value when RETENTION_PERIOD_DAYS is set', async () => {
    vi.stubEnv('RETENTION_PERIOD_DAYS', '45');
    const response = await GET(
      makeRequest({ Authorization: `Bearer ${CRON_SECRET}` }),
    );
    const body = await response.json();
    expect(body.retention_days).toBe(45);
  });
});
