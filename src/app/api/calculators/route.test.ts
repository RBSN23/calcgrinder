import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

import { POST } from './route';
import {
  installSupabaseMock,
  makeSupabaseMock,
  ROW_FIXTURE,
  USER_FIXTURE,
} from './test-helpers';

const mockCreateClient = vi.mocked(createClient);

describe('POST /api/calculators', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 with the unauthorized payload when no user is signed in', async () => {
    installSupabaseMock(mockCreateClient, makeSupabaseMock({ user: null, fromResults: [] }));

    const res = await POST();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 201 and the public row shape on a successful insert', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: ROW_FIXTURE, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST();

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(ROW_FIXTURE);

    // The route MUST set owner_id from the auth context, never from a body
    // value (POST takes no body in PROJ-8). The fixture asserts both
    // that .insert was called once and the owner_id was bound.
    const insertCall = supabase._lastBuilder?.insert.mock.calls[0]?.[0] as {
      owner_id: string;
    };
    expect(insertCall.owner_id).toBe(USER_FIXTURE.id);
  });

  it('returns 500 when the insert errors out', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: { message: 'simulated failure' } }],
      }),
    );

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'create_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });
});
