import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

import { DELETE } from './route';
import {
  installSupabaseMock,
  makeSupabaseMock,
  USER_FIXTURE,
} from '../../../calculators/test-helpers';

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const CALC_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_OWNER_ID = '33333333-3333-3333-3333-333333333333';

function makeAdminMock(opts: {
  fromResults: Array<{ data?: unknown; error?: unknown; count?: number | null }>;
}) {
  return makeSupabaseMock({ user: null, fromResults: opts.fromResults });
}

function ctx(id: string = CALC_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function deleteRequest(): Request {
  return new Request(`http://localhost:3000/api/admin/calculators/${CALC_ID}`, {
    method: 'DELETE',
  });
}

describe('DELETE /api/admin/calculators/:id', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateAdminClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when unauthenticated (user is null)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 403 when user profile is not found', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          // profiles SELECT returns null (no profile row)
          { data: null, error: null },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('returns 403 when profile lookup errors', async () => {
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

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
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

    const res = await DELETE(deleteRequest(), ctx());

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

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 403 when sysadmin tries to delete own calculator', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          // profiles: sysadmin
          { data: { role: 'sysadmin' }, error: null },
          // calculators: exists, owned by the sysadmin themselves
          {
            data: { id: CALC_ID, title: 'My Calc', owner_id: USER_FIXTURE.id },
            error: null,
          },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
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

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'read_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 500 when scenarios delete fails', async () => {
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
          // calculators: found, different owner
          {
            data: { id: CALC_ID, title: 'Target Calc', owner_id: OTHER_OWNER_ID },
            error: null,
          },
          // scenarios delete: error
          { data: null, error: { message: 'scenarios delete failed' } },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'delete_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 500 when calculator delete fails', async () => {
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
          // calculators: found, different owner
          {
            data: { id: CALC_ID, title: 'Target Calc', owner_id: OTHER_OWNER_ID },
            error: null,
          },
          // scenarios delete: OK
          { data: null, error: null },
          // calculators delete: error
          { data: null, error: { message: 'calc delete failed' } },
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'delete_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 200 with { ok: true } on successful deletion of another user\'s calculator', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const admin = makeAdminMock({
      fromResults: [
        // profiles: sysadmin
        { data: { role: 'sysadmin' }, error: null },
        // calculators: found, different owner
        {
          data: { id: CALC_ID, title: 'Target Calc', owner_id: OTHER_OWNER_ID },
          error: null,
        },
        // scenarios delete: OK
        { data: null, error: null },
        // calculators delete: OK
        { data: null, error: null },
      ],
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await DELETE(deleteRequest(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('deletes scenarios before the calculator (correct ordering)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const admin = makeAdminMock({
      fromResults: [
        // profiles: sysadmin
        { data: { role: 'sysadmin' }, error: null },
        // calculators SELECT
        {
          data: { id: CALC_ID, title: 'Target Calc', owner_id: OTHER_OWNER_ID },
          error: null,
        },
        // scenarios delete: OK
        { data: null, error: null },
        // calculators delete: OK
        { data: null, error: null },
      ],
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    await DELETE(deleteRequest(), ctx());

    // admin.from() call order:
    // 1. profiles (role check)
    // 2. calculators (existence check)
    // 3. scenarios (delete)
    // 4. calculators (delete)
    expect(admin.from).toHaveBeenCalledTimes(4);
    expect(admin.from).toHaveBeenNthCalledWith(1, 'profiles');
    expect(admin.from).toHaveBeenNthCalledWith(2, 'calculators');
    expect(admin.from).toHaveBeenNthCalledWith(3, 'scenarios');
    expect(admin.from).toHaveBeenNthCalledWith(4, 'calculators');

    // Verify scenarios builder used .delete().eq('calculator_id', id)
    expect(admin._builders[2]!.delete).toHaveBeenCalled();
    expect(admin._builders[2]!.eq).toHaveBeenCalledWith('calculator_id', CALC_ID);

    // Verify calculators builder used .delete().eq('id', id)
    expect(admin._builders[3]!.delete).toHaveBeenCalled();
    expect(admin._builders[3]!.eq).toHaveBeenCalledWith('id', CALC_ID);
  });

  it('uses the admin client for all DB operations, not the user client', async () => {
    const supabase = makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] });
    installSupabaseMock(mockCreateClient, supabase);
    const admin = makeAdminMock({
      fromResults: [
        { data: { role: 'sysadmin' }, error: null },
        {
          data: { id: CALC_ID, title: 'Target Calc', owner_id: OTHER_OWNER_ID },
          error: null,
        },
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    await DELETE(deleteRequest(), ctx());

    // The user client should only be used for auth.getUser(), never for .from()
    expect(supabase.from).not.toHaveBeenCalled();
    // All .from() calls go through the admin client
    expect(admin.from).toHaveBeenCalledTimes(4);
  });
});
