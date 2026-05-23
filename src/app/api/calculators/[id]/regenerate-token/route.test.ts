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
} from '../../test-helpers';

const mockCreateClient = vi.mocked(createClient);

const CALC_ID = ROW_FIXTURE.id;
const STALE_AT = ROW_FIXTURE.updated_at;
const FRESH_AT = '2026-05-23T10:05:00.000Z';

function ctx(id: string = CALC_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown | string): Request {
  return new Request(
    `http://localhost:3000/api/calculators/${CALC_ID}/regenerate-token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

describe('POST /api/calculators/:id/regenerate-token', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 400 when the body is not valid JSON', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );

    const res = await POST(postRequest('not-json'), ctx());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  it('returns 400 when updated_at is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );

    const res = await POST(postRequest({}), ctx());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('returns 200 with the updated row and a fresh 22-char base64url token', async () => {
    const updated = {
      ...ROW_FIXTURE,
      public_token: 'NEW-22-char-base64url-x',
      updated_at: FRESH_AT,
    };
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: updated, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(updated);

    const builder = supabase._builders[0]!;
    const updateCall = builder.update.mock.calls[0]?.[0] as {
      public_token: string;
    };
    // The minted token is exactly 22 chars (base64url(16 bytes) drops
    // trailing '=' padding) and only contains [A-Za-z0-9_-].
    expect(updateCall.public_token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(builder.eq.mock.calls).toContainEqual(['updated_at', STALE_AT]);
  });

  it('mints a fresh token on every call (two consecutive calls produce different tokens)', async () => {
    const first = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: { ...ROW_FIXTURE, updated_at: FRESH_AT }, error: null }],
    });
    installSupabaseMock(mockCreateClient, first);
    await POST(postRequest({ updated_at: STALE_AT }), ctx());
    const tokenA = (first._builders[0]!.update.mock.calls[0]?.[0] as {
      public_token: string;
    }).public_token;

    const second = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: { ...ROW_FIXTURE, updated_at: FRESH_AT }, error: null }],
    });
    installSupabaseMock(mockCreateClient, second);
    await POST(postRequest({ updated_at: STALE_AT }), ctx());
    const tokenB = (second._builders[0]!.update.mock.calls[0]?.[0] as {
      public_token: string;
    }).public_token;

    expect(tokenA).not.toBe(tokenB);
  });

  it('returns 409 stale when the optimistic-concurrency check fails', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: null, error: null }, // UPDATE matched 0 rows
          { data: { updated_at: FRESH_AT }, error: null }, // disambiguating SELECT
        ],
      }),
    );

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'stale',
      server_updated_at: FRESH_AT,
    });
  });

  it('returns 404 when the row is missing / not owned / soft-deleted', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: null, error: null }, // UPDATE matched 0 rows
          { data: null, error: null }, // SELECT also empty
        ],
      }),
    );

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
