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

import { GET, POST } from './route';
import {
  CALCULATOR_ID,
  SCENARIO_ROW,
  USER_FIXTURE,
  installSupabaseMock,
  makeSupabaseMock,
} from './test-helpers';

const mockCreateClient = vi.mocked(createClient);
const mockCheckScenarioWrite = vi.mocked(checkScenarioWrite);

function postRequest(body: unknown | string): Request {
  return new Request('http://localhost:3000/api/scenarios', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function getRequest(qs = ''): Request {
  return new Request(`http://localhost:3000/api/scenarios${qs}`, {
    method: 'GET',
  });
}

describe('GET /api/scenarios', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no user is signed in', async () => {
    installSupabaseMock(mockCreateClient, makeSupabaseMock({ user: null }));
    const res = await GET(getRequest('?mine=1'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 400 when neither mine=1 nor calculator_id is provided', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await GET(getRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('returns the dashboard list when mine=1', async () => {
    const rows = [SCENARIO_ROW];
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: rows, error: null }],
      }),
    );
    const res = await GET(getRequest('?mine=1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
  });

  it('returns the per-calculator list when calculator_id is provided', async () => {
    const rows = [SCENARIO_ROW];
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: rows, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await GET(getRequest(`?calculator_id=${CALCULATOR_ID}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
    expect(supabase._builders[0]!.eq).toHaveBeenCalledWith(
      'calculator_id',
      CALCULATOR_ID,
    );
  });

  it('returns 400 when calculator_id is not a UUID', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await GET(getRequest('?calculator_id=not-a-uuid'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('returns 500 when the underlying SELECT errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: { message: 'boom' } }],
      }),
    );
    const res = await GET(getRequest('?mine=1'));
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('POST /api/scenarios', () => {
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
    const res = await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: 'My scenario',
        description: '',
        values: {},
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 429 when the per-user rate-limit fires', async () => {
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
    const res = await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: 'x',
        description: '',
        values: {},
      }),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });

  it('returns 400 invalid_json on a non-JSON body', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await POST(postRequest('not-json'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  it('returns 400 invalid_request on a malformed body', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await POST(
      postRequest({ calculator_id: 'not-uuid', title: 'x' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('returns 400 title_required for an empty / whitespace title', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: '   ',
        description: '',
        values: {},
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'title_required' });
  });

  it('returns 400 title_too_long when title > 200 chars', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: 'a'.repeat(201),
        description: '',
        values: {},
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'title_too_long', max: 200 });
  });

  it('returns 400 description_too_long when description > 2000 chars', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: 'ok',
        description: 'a'.repeat(2001),
        values: {},
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'description_too_long',
      max: 2000,
    });
  });

  it('returns 201 with the new scenario row on success and binds owner_id from auth', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: SCENARIO_ROW, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: '  My scenario  ',
        description: 'A test',
        values: { rate: 0.05 },
      }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(SCENARIO_ROW);

    const insertCall = supabase._builders[0]!.insert.mock.calls[0]?.[0] as {
      owner_id: string;
      calculator_id: string;
      title: string;
      description: string;
      values: unknown;
    };
    expect(insertCall.owner_id).toBe(USER_FIXTURE.id);
    expect(insertCall.calculator_id).toBe(CALCULATOR_ID);
    expect(insertCall.title).toBe('My scenario');
    expect(insertCall.description).toBe('A test');
    expect(insertCall.values).toEqual({ rate: 0.05 });
  });

  it('silently strips unknown keys (owner_id, share_token, id, etc.)', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: SCENARIO_ROW, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: 'My scenario',
        description: '',
        values: {},
        // Fields the route MUST drop:
        owner_id: 'attacker-id',
        share_token: 'forged',
        id: 'replaced',
        created_at: '2000-01-01',
      }),
    );

    const insertCall = supabase._builders[0]!.insert.mock.calls[0]?.[0] as {
      owner_id: string;
    };
    expect(insertCall.owner_id).toBe(USER_FIXTURE.id);
    expect(insertCall).not.toHaveProperty('share_token');
    expect(insertCall).not.toHaveProperty('id');
  });

  it('returns 400 calculator_not_found when the FK rejects an unknown calculator_id', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: null, error: { code: '23503', message: 'fk violation' } },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: 'x',
        description: '',
        values: {},
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'calculator_not_found' });
  });

  it('returns 500 on a generic insert error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: { message: 'boom' } }],
      }),
    );
    const res = await POST(
      postRequest({
        calculator_id: CALCULATOR_ID,
        title: 'x',
        description: '',
        values: {},
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'create_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });
});
