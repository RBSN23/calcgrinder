import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkScenarioWrite: vi.fn(async () => ({
    success: true,
    limit: 30,
    remaining: 29,
    reset: 0,
  })),
}));

import { createClient } from '@/lib/supabase/server';
import { checkScenarioWrite } from '@/lib/rate-limit';

import { DELETE, PUT } from './route';
import {
  SCENARIO_ROW,
  USER_FIXTURE,
  installSupabaseMock,
  makeSupabaseMock,
} from '../test-helpers';

const mockCreateClient = vi.mocked(createClient);
const mockCheckScenarioWrite = vi.mocked(checkScenarioWrite);

const ID = SCENARIO_ROW.id;

function ctx(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: ID }) };
}

function putRequest(body: unknown | string): Request {
  return new Request(`http://localhost:3000/api/scenarios/${ID}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function deleteRequest(): Request {
  return new Request(`http://localhost:3000/api/scenarios/${ID}`, {
    method: 'DELETE',
  });
}

describe('PUT /api/scenarios/:id', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCheckScenarioWrite.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 0,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no user is signed in', async () => {
    installSupabaseMock(mockCreateClient, makeSupabaseMock({ user: null }));
    const res = await PUT(putRequest({ title: 'x' }), ctx());
    expect(res.status).toBe(401);
  });

  it('returns 429 when the rate-limit fires', async () => {
    mockCheckScenarioWrite.mockResolvedValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      reset: 0,
    });
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await PUT(putRequest({ title: 'x' }), ctx());
    expect(res.status).toBe(429);
  });

  it('returns 400 invalid_json on a non-JSON body', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await PUT(putRequest('not-json'), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  it('returns 400 title_required when title is empty after trim', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await PUT(putRequest({ title: '   ' }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'title_required' });
  });

  it('returns 200 with the updated row and forwards the trimmed title', async () => {
    const updated = { ...SCENARIO_ROW, title: 'Renamed', updated_at: '2026-05-24T11:00:00.000Z' };
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: updated, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PUT(putRequest({ title: '  Renamed  ', values: { x: 1 } }), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(updated);

    expect(supabase._builders[0]!.update).toHaveBeenCalledWith({
      title: 'Renamed',
      values: { x: 1 },
    });
  });

  it('does NOT permit setting share_token via PUT (silently stripped)', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: SCENARIO_ROW, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    await PUT(
      putRequest({
        title: 'ok',
        share_token: 'attempted',
        owner_id: 'evil',
      }),
      ctx(),
    );

    const updateCall = supabase._builders[0]!.update.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(updateCall).not.toHaveProperty('share_token');
    expect(updateCall).not.toHaveProperty('owner_id');
  });

  it('returns 404 when the row is missing OR owned by another user (RLS opacity)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await PUT(putRequest({ title: 'x' }), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns the current row when no updatable fields are sent', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: SCENARIO_ROW, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PUT(putRequest({}), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SCENARIO_ROW);
    expect(supabase._builders[0]!.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/scenarios/:id', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCheckScenarioWrite.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 0,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no user is signed in', async () => {
    installSupabaseMock(mockCreateClient, makeSupabaseMock({ user: null }));
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(401);
  });

  it('returns 204 when the row is deleted', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: { id: ID }, error: null }],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(204);
  });

  it('returns 404 when the row is missing OR owned by another user', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 500 on a generic delete error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: { message: 'boom' } }],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
  });
});
