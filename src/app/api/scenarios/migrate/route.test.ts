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

import { POST } from './route';
import {
  CALCULATOR_ID,
  CALCULATOR_TOKEN,
  USER_FIXTURE,
  installSupabaseMock,
  makeSupabaseMock,
} from '../test-helpers';

const mockCreateClient = vi.mocked(createClient);
const mockCheckScenarioWrite = vi.mocked(checkScenarioWrite);

function postRequest(body: unknown | string): Request {
  return new Request('http://localhost:3000/api/scenarios/migrate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function localScenario(overrides: Partial<{ id: string; title: string; description: string; values: unknown; saved_at: string }> = {}) {
  return {
    id: 'local-1',
    title: 'Local 1',
    description: '',
    values: { rate: 0.05 },
    saved_at: '2026-05-24T09:00:00.000Z',
    ...overrides,
  };
}

describe('POST /api/scenarios/migrate', () => {
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
    const res = await POST(postRequest({ bundles: [] }));
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
    const res = await POST(postRequest({ bundles: [] }));
    expect(res.status).toBe(429);
  });

  it('returns 400 invalid_json on a non-JSON body', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await POST(postRequest('not-json'));
    expect(res.status).toBe(400);
  });

  it('returns 400 invalid_request on a malformed body', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await POST(postRequest({ bundles: 'not-an-array' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 with all counts zero when bundles is empty', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE }),
    );
    const res = await POST(postRequest({ bundles: [] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ migrated: 0, skipped: 0, errors: [] });
  });

  it('skips entire bundles when the calculator no longer exists', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        rpcResults: [{ data: [], error: null }],
      }),
    );
    const res = await POST(
      postRequest({
        bundles: [
          {
            calculator_public_token: 'gone-token-aaa',
            scenarios: [localScenario(), localScenario({ id: 'local-2' })],
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ migrated: 0, skipped: 2, errors: [] });
  });

  it('skips bundles whose calculator is soft-deleted', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        rpcResults: [
          {
            data: [
              { id: CALCULATOR_ID, soft_delete_at: '2026-05-23T10:00:00Z' },
            ],
            error: null,
          },
        ],
      }),
    );
    const res = await POST(
      postRequest({
        bundles: [
          {
            calculator_public_token: CALCULATOR_TOKEN,
            scenarios: [localScenario()],
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ migrated: 0, skipped: 1, errors: [] });
  });

  it('inserts scenarios and binds owner_id from auth', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      rpcResults: [
        { data: [{ id: CALCULATOR_ID, soft_delete_at: null }], error: null },
      ],
      fromResults: [
        // Existing-titles lookup: empty.
        { data: [], error: null },
        // Insert: success (no result needed).
        { data: null, error: null },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(
      postRequest({
        bundles: [
          {
            calculator_public_token: CALCULATOR_TOKEN,
            scenarios: [localScenario({ title: 'My scenario' })],
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      migrated: 1,
      skipped: 0,
      errors: [],
    });

    // The insert MUST set owner_id from auth.
    const insertCall = supabase._builders[1]!.insert.mock.calls[0]?.[0] as {
      owner_id: string;
      calculator_id: string;
      title: string;
    };
    expect(insertCall.owner_id).toBe(USER_FIXTURE.id);
    expect(insertCall.calculator_id).toBe(CALCULATOR_ID);
    expect(insertCall.title).toBe('My scenario');
  });

  it('resolves title collisions by suffixing " (2)"', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      rpcResults: [
        { data: [{ id: CALCULATOR_ID, soft_delete_at: null }], error: null },
      ],
      fromResults: [
        // Existing-titles lookup returns the same title.
        { data: [{ title: 'My scenario' }], error: null },
        { data: null, error: null }, // insert
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(
      postRequest({
        bundles: [
          {
            calculator_public_token: CALCULATOR_TOKEN,
            scenarios: [localScenario({ title: 'My scenario' })],
          },
        ],
      }),
    );
    expect(res.status).toBe(200);

    const insertCall = supabase._builders[1]!.insert.mock.calls[0]?.[0] as {
      title: string;
    };
    expect(insertCall.title).toBe('My scenario (2)');
  });

  it('reports per-scenario errors when a row has an invalid title', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      rpcResults: [
        { data: [{ id: CALCULATOR_ID, soft_delete_at: null }], error: null },
      ],
      fromResults: [
        { data: [], error: null }, // existing titles
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(
      postRequest({
        bundles: [
          {
            calculator_public_token: CALCULATOR_TOKEN,
            scenarios: [localScenario({ id: 'bad-1', title: '   ' })],
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      migrated: 0,
      skipped: 0,
      errors: [{ scenario_id: 'bad-1', reason: 'title_invalid' }],
    });
  });
});
