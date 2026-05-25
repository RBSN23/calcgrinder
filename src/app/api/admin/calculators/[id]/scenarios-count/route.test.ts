import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

import { GET } from './route';
import {
  installSupabaseMock,
  makeSupabaseMock,
  USER_FIXTURE,
} from '../../../../calculators/test-helpers';

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const CALC_ID = '22222222-2222-2222-2222-222222222222';

function makeAdminMock(opts: {
  fromResults: Array<{ data?: unknown; error?: unknown; count?: number | null }>;
}) {
  return makeSupabaseMock({ user: null, fromResults: opts.fromResults });
}

function ctx(id: string = CALC_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function getRequest(): Request {
  return new Request(
    `http://localhost:3000/api/admin/calculators/${CALC_ID}/scenarios-count`,
    { method: 'GET' },
  );
}

describe('GET /api/admin/calculators/:id/scenarios-count', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateAdminClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not a sysadmin (role = registered)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          { data: { role: 'registered' }, error: null },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('returns 403 when profile lookup returns an error', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          { data: null, error: { message: 'db error' } },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('returns 403 when profile is not found (null)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          { data: null, error: null },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('returns 404 when calculator does not exist', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          // profiles: sysadmin
          { data: { role: 'sysadmin' }, error: null },
          // calculators: not found
          { data: null, error: null },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 500 when calculator read fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          // profiles: sysadmin
          { data: { role: 'sysadmin' }, error: null },
          // calculators: DB error
          { data: null, error: { message: 'db read error' } },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'read_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 500 when scenarios count fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          // profiles: sysadmin
          { data: { role: 'sysadmin' }, error: null },
          // calculators: found
          { data: { id: CALC_ID }, error: null },
          // scenarios count: error
          { data: null, error: { message: 'count failed' } },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'count_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 200 with { count: N } on success', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const admin = makeAdminMock({
      fromResults: [
        // profiles: sysadmin
        { data: { role: 'sysadmin' }, error: null },
        // calculators: found
        { data: { id: CALC_ID }, error: null },
        // scenarios count: 7 scenarios
        { data: null, error: null, count: 7 },
      ],
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 7 });

    // Verify the select call used count: 'exact' and head: true
    expect(admin.from).toHaveBeenNthCalledWith(3, 'scenarios');
    expect(admin._builders[2]!.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(admin._builders[2]!.eq).toHaveBeenCalledWith('calculator_id', CALC_ID);
  });

  it('returns 200 with { count: 0 } when count is null (fallback)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          // profiles: sysadmin
          { data: { role: 'sysadmin' }, error: null },
          // calculators: found
          { data: { id: CALC_ID }, error: null },
          // scenarios count: null (no count header returned)
          { data: null, error: null, count: null },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0 });
  });
});
