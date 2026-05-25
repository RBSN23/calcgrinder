import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

import { POST } from './route';
import { USER_FIXTURE, ROW_FIXTURE } from './test-helpers';

const mockCreateClient = vi.mocked(createClient);

const RPC_SUCCESS_ROW = {
  id: ROW_FIXTURE.id,
  title: ROW_FIXTURE.title,
  description: ROW_FIXTURE.description,
  theme_id: ROW_FIXTURE.theme_id,
  updated_at: '2026-05-23T10:00:01.500Z',
  published: ROW_FIXTURE.published,
  public_token: ROW_FIXTURE.public_token,
  default_section_id: '33333333-3333-3333-3333-333333333333',
};

function makeMock(opts: {
  user: { id: string } | null;
  rpcResult?: { data: unknown; error: unknown };
}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user }, error: null })),
    },
    rpc: vi.fn(async () => opts.rpcResult ?? { data: [RPC_SUCCESS_ROW], error: null }),
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

describe('POST /api/calculators', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no user is signed in', async () => {
    mockCreateClient.mockResolvedValue(makeMock({ user: null }));

    const res = await POST();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 201 with calculator + default_section_id on success', async () => {
    mockCreateClient.mockResolvedValue(makeMock({ user: USER_FIXTURE }));

    const res = await POST();

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(RPC_SUCCESS_ROW);
  });

  it('calls fn_create_calculator RPC', async () => {
    const mock = makeMock({ user: USER_FIXTURE });
    mockCreateClient.mockResolvedValue(mock);

    await POST();

    expect(mock.rpc).toHaveBeenCalledWith('fn_create_calculator');
  });

  it('returns 500 when the RPC fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(
      makeMock({
        user: USER_FIXTURE,
        rpcResult: { data: null, error: { message: 'simulated failure' } },
      }),
    );

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'create_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 401 when the RPC raises unauthorized', async () => {
    mockCreateClient.mockResolvedValue(
      makeMock({
        user: USER_FIXTURE,
        rpcResult: { data: null, error: { message: 'unauthorized' } },
      }),
    );

    const res = await POST();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 500 when the RPC raises title auto-resolve exhausted', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(
      makeMock({
        user: USER_FIXTURE,
        rpcResult: { data: null, error: { message: 'title auto-resolve exhausted' } },
      }),
    );

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'create_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });
});
