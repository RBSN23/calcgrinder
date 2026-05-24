// PROJ-13 — unit tests for POST /api/calculators/:id/restore.
//
// Mocks the user-scoped Supabase client via the shared test-helpers
// queue. The route fires up to four `.from('calculators')` calls:
//   1. SELECT the soft-deleted row (ownership + state gate).
//   2. resolveUniqueTitle lookup(s) (one per attempt; capped at 100).
//   3. UPDATE clearing soft_delete_at (and renaming on collision).
//   4. Disambiguating SELECT only when the UPDATE matches zero rows.

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

const TRASHED_ROW = {
  ...ROW_FIXTURE,
  soft_delete_at: '2026-05-23T09:00:00.000Z',
};
const RESTORED_ROW = { ...ROW_FIXTURE, updated_at: FRESH_AT };

function ctx(id: string = CALC_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown | string): Request {
  return new Request(`http://localhost:3000/api/calculators/${CALC_ID}/restore`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/calculators/:id/restore', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no user is signed in', async () => {
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

  it('returns 404 when the row is not soft-deleted (or not owned, or missing)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          // Initial SELECT — RLS or `NOT NULL` filter rejects.
          { data: null, error: null },
        ],
      }),
    );

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 200 with the restored row, preserving published + public_token', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        // 1) SELECT trashed row
        { data: TRASHED_ROW, error: null },
        // 2) resolveUniqueTitle — title is free
        { data: null, error: null },
        // 3) UPDATE
        { data: RESTORED_ROW, error: null },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: RESTORED_ROW.id,
      title: RESTORED_ROW.title,
      published: RESTORED_ROW.published,
      public_token: RESTORED_ROW.public_token,
      updated_at: FRESH_AT,
      renamed: false,
    });

    // The UPDATE call (builder #3) must NULL soft_delete_at and NOT
    // rewrite the title when there's no collision.
    const updateBuilder = supabase._builders[2]!;
    expect(updateBuilder.update).toHaveBeenCalledWith({ soft_delete_at: null });
  });

  it('returns 200 with renamed=true and the auto-resolved title on collision', async () => {
    const renamed = { ...RESTORED_ROW, title: `${TRASHED_ROW.title} (2)` };
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        // 1) SELECT trashed row
        { data: TRASHED_ROW, error: null },
        // 2) resolveUniqueTitle — attempt with base title HITS an active row
        { data: { id: 'collision' }, error: null },
        // 3) resolveUniqueTitle — attempt with `(2)` is free
        { data: null, error: null },
        // 4) UPDATE
        { data: renamed, error: null },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.renamed).toBe(true);
    expect(body.title).toBe(`${TRASHED_ROW.title} (2)`);

    // The UPDATE must include the new title alongside the NULL flip.
    const updateBuilder = supabase._builders[3]!;
    expect(updateBuilder.update).toHaveBeenCalledWith({
      soft_delete_at: null,
      title: `${TRASHED_ROW.title} (2)`,
    });
  });

  it('returns 409 stale with the server updated_at when the client token is out of date', async () => {
    const trashedFresh = { ...TRASHED_ROW, updated_at: FRESH_AT };
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: trashedFresh, error: null }],
      }),
    );

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'stale',
      server_updated_at: FRESH_AT,
    });
  });

  it('returns 500 title_resolution_exhausted when resolveUniqueTitle errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          // 1) SELECT trashed row
          { data: TRASHED_ROW, error: null },
          // 2) resolveUniqueTitle SELECT errors → helper returns null
          { data: null, error: { message: 'db down' } },
        ],
      }),
    );

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'title_resolution_exhausted' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 500 restore_failed when the UPDATE errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: TRASHED_ROW, error: null },
          { data: null, error: null },
          { data: null, error: { message: 'update kaboom' } },
        ],
      }),
    );

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'restore_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 404 when the UPDATE matches zero rows AND the disambiguating SELECT shows the row is gone/restored', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: TRASHED_ROW, error: null }, // 1) initial SELECT
          { data: null, error: null },         // 2) resolveUniqueTitle
          { data: null, error: null },         // 3) UPDATE matched 0
          // 4) Disambiguate — row is active again (another tab restored it)
          { data: { updated_at: FRESH_AT, soft_delete_at: null }, error: null },
        ],
      }),
    );

    const res = await POST(postRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 409 stale when the UPDATE matches zero rows AND the row is still in trash with a different updated_at', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: TRASHED_ROW, error: null },
          { data: null, error: null },
          { data: null, error: null },
          // Still trashed, but updated_at has moved forward (e.g. a hard-
          // delete attempt by the owner in another tab bumped it).
          {
            data: {
              updated_at: FRESH_AT,
              soft_delete_at: TRASHED_ROW.soft_delete_at,
            },
            error: null,
          },
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
});
