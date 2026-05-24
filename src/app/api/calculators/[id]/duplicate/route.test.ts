import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

import { POST } from './route';

const mockCreateClient = vi.mocked(createClient);

const SOURCE_ID = '22222222-2222-2222-2222-222222222222';
const USER_FIXTURE = { id: '11111111-1111-1111-1111-111111111111' };
const SOURCE_TOKEN = 'AaBbCcDdEeFfGgHhIiJjKk';

// PROJ-18 — RPC response shape gains `source_calculator_id`. Same-owner
// duplicate sets it to NULL; cross-user clone sets it to source.id.
const DUPLICATE_RPC_ROW = {
  id: '44444444-4444-4444-4444-444444444444',
  title: 'Mortgage — Copy',
  description: 'desc',
  theme_id: 'calcgrinder',
  updated_at: '2026-05-23T11:00:00.000Z',
  published: false,
  public_token: 'newtoken22charrxxxxxxx',
  default_section_id: '55555555-5555-5555-5555-555555555555',
  source_calculator_id: null,
};

const CLONE_RPC_ROW = {
  ...DUPLICATE_RPC_ROW,
  id: '66666666-6666-6666-6666-666666666666',
  title: 'Mortgage Calculator',
  source_calculator_id: SOURCE_ID,
};

function ctx(id: string = SOURCE_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: object = {}): Request {
  const serialized = JSON.stringify(body);
  return new Request(
    `http://localhost:3000/api/calculators/${SOURCE_ID}/duplicate`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(serialized.length),
      },
      body: serialized,
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

  it('returns 201 + the new calculator row on same-owner duplicate (no source_token)', async () => {
    const mock = makeRpcMock({
      user: USER_FIXTURE,
      rpcResult: { data: [DUPLICATE_RPC_ROW], error: null },
    });
    install(mock);

    const res = await POST(postRequest({}), ctx());

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: DUPLICATE_RPC_ROW.id,
      title: DUPLICATE_RPC_ROW.title,
      description: DUPLICATE_RPC_ROW.description,
      theme_id: DUPLICATE_RPC_ROW.theme_id,
      updated_at: DUPLICATE_RPC_ROW.updated_at,
      published: DUPLICATE_RPC_ROW.published,
      public_token: DUPLICATE_RPC_ROW.public_token,
      default_section_id: DUPLICATE_RPC_ROW.default_section_id,
      source_calculator_id: null,
    });
    // The RPC is called with both args; `source_token` is null on the
    // legacy same-owner path so the function's DEFAULT NULL discriminator
    // selects the same-owner branch.
    expect(mock.rpc).toHaveBeenCalledWith('fn_duplicate_calculator', {
      source_id: SOURCE_ID,
      source_token: null,
    });
  });

  it('returns 201 + the cloned calculator row on cross-user clone (source_token present)', async () => {
    const mock = makeRpcMock({
      user: USER_FIXTURE,
      rpcResult: { data: [CLONE_RPC_ROW], error: null },
    });
    install(mock);

    const res = await POST(postRequest({ source_token: SOURCE_TOKEN }), ctx());

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: CLONE_RPC_ROW.id,
      title: CLONE_RPC_ROW.title,
      description: CLONE_RPC_ROW.description,
      theme_id: CLONE_RPC_ROW.theme_id,
      updated_at: CLONE_RPC_ROW.updated_at,
      published: CLONE_RPC_ROW.published,
      public_token: CLONE_RPC_ROW.public_token,
      default_section_id: CLONE_RPC_ROW.default_section_id,
      // Set to source.id when the cross-user branch ran — lets callers
      // distinguish a duplicate from a clone without inspecting the title.
      source_calculator_id: SOURCE_ID,
    });
    expect(mock.rpc).toHaveBeenCalledWith('fn_duplicate_calculator', {
      source_id: SOURCE_ID,
      source_token: SOURCE_TOKEN,
    });
  });

  it('returns 400 invalid_source_token when source_token is an empty string', async () => {
    install(
      makeRpcMock({
        user: USER_FIXTURE,
        rpcResult: { data: null, error: null },
      }),
    );

    const res = await POST(postRequest({ source_token: '' }), ctx());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_source_token' });
  });

  it('returns 400 invalid_source_token when source_token is not a string', async () => {
    install(
      makeRpcMock({
        user: USER_FIXTURE,
        rpcResult: { data: null, error: null },
      }),
    );

    const res = await POST(postRequest({ source_token: 42 } as object), ctx());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_source_token' });
  });

  it('returns 404 when the stored procedure raises P0002 (not_found / cross-owner / token-mismatch)', async () => {
    install(
      makeRpcMock({
        user: USER_FIXTURE,
        rpcResult: { data: null, error: { code: 'P0002', message: 'not_found' } },
      }),
    );

    const res = await POST(postRequest({ source_token: SOURCE_TOKEN }), ctx());

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
