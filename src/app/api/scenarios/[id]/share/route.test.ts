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
  CALCULATOR_TOKEN,
  OTHER_USER_FIXTURE,
  SCENARIO_ROW,
  USER_FIXTURE,
  installSupabaseMock,
  makeSupabaseMock,
} from '../../test-helpers';

const mockCreateClient = vi.mocked(createClient);
const mockCheckScenarioWrite = vi.mocked(checkScenarioWrite);

const ID = SCENARIO_ROW.id;

function ctx(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: ID }) };
}

function postRequest(): Request {
  return new Request(`http://localhost:3000/api/scenarios/${ID}/share`, {
    method: 'POST',
  });
}

describe('POST /api/scenarios/:id/share', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCheckScenarioWrite.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 0,
    });
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('returns 401 when no user is signed in', async () => {
    installSupabaseMock(mockCreateClient, makeSupabaseMock({ user: null }));
    const res = await POST(postRequest(), ctx());
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
    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(429);
  });

  it('returns 404 when the scenario does not exist or is not owned', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 403 when the scenario exists but is owned by a different user (defence in depth)', async () => {
    // RLS would normally prevent this from returning. The defence-in-depth
    // check covers the case where a future RLS regression lets the read
    // through.
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: {
              id: ID,
              owner_id: OTHER_USER_FIXTURE.id,
              share_token: null,
              calculator_id: SCENARIO_ROW.calculator_id,
            },
            error: null,
          },
        ],
      }),
    );
    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('returns 404 when the scenario is orphan (calculator_id is null)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: {
              id: ID,
              owner_id: USER_FIXTURE.id,
              share_token: null,
              calculator_id: null,
            },
            error: null,
          },
        ],
      }),
    );
    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(404);
  });

  it('mints a new share_token when share_token is null and returns the URL', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        // Initial read of the scenario.
        {
          data: {
            id: ID,
            owner_id: USER_FIXTURE.id,
            share_token: null,
            calculator_id: SCENARIO_ROW.calculator_id,
          },
          error: null,
        },
        // UPDATE to persist the new token (no result needed beyond no-error).
        { data: null, error: null },
        // Read the calculator's current public_token.
        { data: { public_token: CALCULATOR_TOKEN }, error: null },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { share_token: string; url: string };
    expect(typeof body.share_token).toBe('string');
    expect(body.share_token.length).toBeGreaterThanOrEqual(22);
    expect(body.url).toBe(
      `https://app.example.com/c/${CALCULATOR_TOKEN}?s=${body.share_token}`,
    );

    // The UPDATE must have set share_token only.
    const updateCall = supabase._builders[1]!.update.mock.calls[0]?.[0] as {
      share_token: string;
    };
    expect(updateCall).toEqual({ share_token: body.share_token });
  });

  it('reuses an existing share_token (idempotent)', async () => {
    const EXISTING = 'existing-token-22-aaa';
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        {
          data: {
            id: ID,
            owner_id: USER_FIXTURE.id,
            share_token: EXISTING,
            calculator_id: SCENARIO_ROW.calculator_id,
          },
          error: null,
        },
        // Skip the UPDATE result — only the calculator read fires.
        { data: { public_token: CALCULATOR_TOKEN }, error: null },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      share_token: EXISTING,
      url: `https://app.example.com/c/${CALCULATOR_TOKEN}?s=${EXISTING}`,
    });
    // Only two `.from()` calls when the token is reused — no UPDATE.
    expect(supabase._builders).toHaveLength(2);
  });

  it('returns 404 when the calculator has been hard-deleted between read and resolve', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        {
          data: {
            id: ID,
            owner_id: USER_FIXTURE.id,
            share_token: 'tok',
            calculator_id: SCENARIO_ROW.calculator_id,
          },
          error: null,
        },
        { data: null, error: null }, // calculator gone
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest(), ctx());
    expect(res.status).toBe(404);
  });
});
