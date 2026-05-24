// PROJ-13 — unit tests for GET /api/calculators/:id/scenarios-count.
//
// Two-stage data path:
//   1. User-scoped client SELECTs the calculator row by id (RLS proves
//      ownership; the count handler accepts both active AND soft-
//      deleted rows because the sheet opens from the Trash card).
//   2. Admin (service-role) client runs the cross-owner count on
//      scenarios.calculator_id = :id with `head: true`.
// Both clients are mocked independently.

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
  ROW_FIXTURE,
  USER_FIXTURE,
} from '../../test-helpers';

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const CALC_ID = ROW_FIXTURE.id;

function ctx(id: string = CALC_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function getRequest(): Request {
  return new Request(
    `http://localhost:3000/api/calculators/${CALC_ID}/scenarios-count`,
    { method: 'GET' },
  );
}

function makeAdminCountClient(result: {
  count: number | null;
  error: unknown;
}) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => ({
    then(
      onFulfilled?: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  }));
  return {
    from: vi.fn(() => builder),
    _builder: builder,
  };
}

describe('GET /api/calculators/:id/scenarios-count', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateAdminClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no user is signed in', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 404 when RLS hides the calculator (or the row is missing)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    // The admin client must NOT be reached when the user-scoped ownership
    // check fails — otherwise we'd leak counts cross-owner.
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 500 when the ownership SELECT errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: { message: 'db down' } }],
      }),
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'read_failed' });
    expect(errorSpy).toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 200 with the cross-owner scenarios count for the owner', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: { id: CALC_ID }, error: null }],
      }),
    );
    const admin = makeAdminCountClient({ count: 7, error: null });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 7 });
    expect(admin.from).toHaveBeenCalledWith('scenarios');
    expect((admin._builder as { select: ReturnType<typeof vi.fn> }).select)
      .toHaveBeenCalledWith('id', { count: 'exact', head: true });
  });

  it('returns 200 with count=0 when no scenarios reference the calculator', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: { id: CALC_ID }, error: null }],
      }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminCountClient({
        count: null,
        error: null,
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0 });
  });

  it('returns 500 count_failed when the admin count errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: { id: CALC_ID }, error: null }],
      }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminCountClient({
        count: null,
        error: { message: 'count blew up' },
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'count_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });
});
