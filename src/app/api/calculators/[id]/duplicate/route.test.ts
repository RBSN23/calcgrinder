import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

import { POST } from './route';

const mockCreateClient = vi.mocked(createClient);

const SOURCE_ID = '22222222-2222-2222-2222-222222222222';
const USER_FIXTURE = { id: '11111111-1111-1111-1111-111111111111' };

const NEW_ROW_RPC = {
  id: '44444444-4444-4444-4444-444444444444',
  title: 'Copy of Mortgage',
  description: 'desc',
  theme_id: 'calcgrinder',
  updated_at: '2026-05-23T11:00:00.000Z',
  published: false,
  public_token: 'newtoken22charrxxxxxxx',
  default_section_id: '55555555-5555-5555-5555-555555555555',
};

function ctx(id: string = SOURCE_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function postRequest(): Request {
  return new Request(
    `http://localhost:3000/api/calculators/${SOURCE_ID}/duplicate`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
  );
}

interface RpcMock {
  auth: { getUser: ReturnType<typeof vi.fn> };
  rpc: ReturnType<typeof vi.fn>;
}

function makeRpcMock(opts: {
  user: { id: string } | null;
  rpcResult: { data: unknown; error: unknown };
}): RpcMock {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user }, error: null })),
    },
    rpc: vi.fn(async () => opts.rpcResult),
  };
}

function install(mock: RpcMock): void {
  mockCreateClient.mockResolvedValue(mock as unknown as never);
}

describe('POST /api/calculators/:id/duplicate', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    install(makeRpcMock({ user: null, rpcResult: { data: null, error: null } }));

    const res = await POST(postRequest(), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 201 with the new calculator row + default_section_id on success', async () => {
    const mock = makeRpcMock({
      user: USER_FIXTURE,
      rpcResult: { data: [NEW_ROW_RPC], error: null },
    });
    install(mock);

    const res = await POST(postRequest(), ctx());

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: NEW_ROW_RPC.id,
      title: NEW_ROW_RPC.title,
      description: NEW_ROW_RPC.description,
      theme_id: NEW_ROW_RPC.theme_id,
      updated_at: NEW_ROW_RPC.updated_at,
      published: NEW_ROW_RPC.published,
      public_token: NEW_ROW_RPC.public_token,
      default_section_id: NEW_ROW_RPC.default_section_id,
    });
    expect(mock.rpc).toHaveBeenCalledWith('fn_duplicate_calculator', {
      source_id: SOURCE_ID,
    });
  });

  it('returns 404 when the stored procedure raises P0002 (not_found / cross-owner)', async () => {
    install(
      makeRpcMock({
        user: USER_FIXTURE,
        rpcResult: { data: null, error: { code: 'P0002', message: 'not_found' } },
      }),
    );

    const res = await POST(postRequest(), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 401 when the stored procedure raises 42501 (insufficient_privilege)', async () => {
    install(
      makeRpcMock({
        user: USER_FIXTURE,
        rpcResult: { data: null, error: { code: '42501', message: 'unauthorized' } },
      }),
    );

    const res = await POST(postRequest(), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 500 on an unexpected stored-procedure error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    install(
      makeRpcMock({
        user: USER_FIXTURE,
        rpcResult: {
          data: null,
          error: { code: 'XX000', message: 'boom' },
        },
      }),
    );

    const res = await POST(postRequest(), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'duplicate_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 404 when the rpc returns an empty result set', async () => {
    install(
      makeRpcMock({
        user: USER_FIXTURE,
        rpcResult: { data: [], error: null },
      }),
    );

    const res = await POST(postRequest(), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
