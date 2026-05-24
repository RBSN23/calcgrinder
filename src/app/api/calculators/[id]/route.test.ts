import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

import { DELETE, GET, PATCH } from './route';
import {
  installSupabaseMock,
  makeSupabaseMock,
  ROW_FIXTURE,
  USER_FIXTURE,
} from '../test-helpers';

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

// The admin client used by the ?hard=true branch now drives BOTH the
// orphan COUNT and the DELETE FROM calculators (post BUG-H1 fix —
// PROJ-1's RLS reserves DELETE for the admin path). Reuse the generic
// supabase mock; it queues one result per `.from()` call.
function makeAdminMock(opts: {
  fromResults: Array<{ data?: unknown; error?: unknown; count?: number | null }>;
}) {
  return makeSupabaseMock({ user: null, fromResults: opts.fromResults });
}

const CALC_ID = ROW_FIXTURE.id;
const STALE_AT = ROW_FIXTURE.updated_at;
const FRESH_AT = '2026-05-23T10:05:00.000Z';

function ctx(id: string = CALC_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown | string): Request {
  return new Request(`http://localhost:3000/api/calculators/${CALC_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function deleteRequest(body: unknown | string, query = ''): Request {
  return new Request(`http://localhost:3000/api/calculators/${CALC_ID}${query}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function getRequest(): Request {
  return new Request(`http://localhost:3000/api/calculators/${CALC_ID}`, {
    method: 'GET',
  });
}

describe('GET /api/calculators/:id', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 with the unauthorized payload when no user is signed in', async () => {
    installSupabaseMock(mockCreateClient, makeSupabaseMock({ user: null, fromResults: [] }));

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 200 with the public row shape when the row is owned and live', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: ROW_FIXTURE, error: null }],
      }),
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ROW_FIXTURE);
  });

  it('returns 404 when the row does not exist (or is owned by someone else, or is soft-deleted)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 500 when the underlying SELECT errors out', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: { message: 'simulated' } }],
      }),
    );

    const res = await GET(getRequest(), ctx());

    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('PATCH /api/calculators/:id', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no user is signed in', async () => {
    installSupabaseMock(mockCreateClient, makeSupabaseMock({ user: null, fromResults: [] }));

    const res = await PATCH(patchRequest({ updated_at: STALE_AT, title: 'x' }), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 400 when the body is not valid JSON', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );

    const res = await PATCH(patchRequest('not-json'), ctx());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  it('returns 400 when updated_at is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );

    const res = await PATCH(patchRequest({ title: 'x' }), ctx());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('returns 400 with title_required when the title is empty after trim', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );

    const res = await PATCH(patchRequest({ updated_at: STALE_AT, title: '   ' }), ctx());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'title_required' });
  });

  it('returns 400 with title_too_long when the title exceeds 100 chars after trim', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, title: 'a'.repeat(101) }),
      ctx(),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'title_too_long', max: 100 });
  });

  it('returns 200 with the updated row when the stale check matches', async () => {
    const updated = { ...ROW_FIXTURE, title: 'Mortgage', updated_at: FRESH_AT };
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: updated, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, title: 'Mortgage' }),
      ctx(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(updated);

    const builder = supabase._builders[0]!;
    expect(builder.update).toHaveBeenCalledWith({ title: 'Mortgage' });
    expect(builder.eq.mock.calls).toContainEqual(['updated_at', STALE_AT]);
  });

  it('returns 200 when published is toggled and forwards the boolean to the update', async () => {
    const updated = { ...ROW_FIXTURE, published: true, updated_at: FRESH_AT };
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: updated, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, published: true }),
      ctx(),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.published).toBe(true);
    const builder = supabase._builders[0]!;
    expect(builder.update).toHaveBeenCalledWith({ published: true });
  });

  it('returns 409 title_taken when the DB raises a 23505 unique violation on (owner_id, title)', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        {
          data: null,
          error: {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "idx_calculators_owner_title_active"',
            details: 'Key (owner_id, title)=(...) already exists.',
          },
        },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, title: 'Already Used' }),
      ctx(),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'title_taken' });
  });

  it('returns 409 with server_updated_at when the stale check fails', async () => {
    const current = { ...ROW_FIXTURE, updated_at: FRESH_AT };
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          // First call: the stale-checked UPDATE matches 0 rows.
          { data: null, error: null },
          // Second call: the disambiguating SELECT returns the current row.
          { data: current, error: null },
        ],
      }),
    );

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, title: 'Mortgage' }),
      ctx(),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'stale',
      server_updated_at: FRESH_AT,
    });
  });

  it('returns 404 when the row does not exist / is not owned / is soft-deleted', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: null, error: null }, // UPDATE matched 0 rows
          { data: null, error: null }, // SELECT also returns nothing
        ],
      }),
    );

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, title: 'Mortgage' }),
      ctx(),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('silently ignores unknown keys (owner_id, public_token, etc.) via the whitelist', async () => {
    const updated = { ...ROW_FIXTURE, title: 'New', updated_at: FRESH_AT };
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: updated, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({
        updated_at: STALE_AT,
        title: 'New',
        // Fields the route MUST ignore:
        owner_id: 'attacker-id',
        public_token: 'leaked-token',
        soft_delete_at: '2025-01-01T00:00:00Z',
        id: 'replaced-id',
      }),
      ctx(),
    );

    expect(res.status).toBe(200);
    const builder = supabase._builders[0]!;
    expect(builder.update).toHaveBeenCalledWith({ title: 'New' });
  });

  it('accepts any theme_id string (unknown ids are handled at read time per PROJ-6)', async () => {
    const updated = { ...ROW_FIXTURE, theme_id: 'made-up', updated_at: FRESH_AT };
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: updated, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, theme_id: 'made-up' }),
      ctx(),
    );

    expect(res.status).toBe(200);
    const builder = supabase._builders[0]!;
    expect(builder.update).toHaveBeenCalledWith({ theme_id: 'made-up' });
  });

  it('returns current row without writing when only updated_at is sent and it matches', async () => {
    // No update fields, so the route skips the UPDATE round-trip entirely
    // and only fires the disambiguation SELECT.
    const current = { ...ROW_FIXTURE };
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: current, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(patchRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(current);
    // Confirm no .update() was called on the single builder.
    expect(supabase._builders).toHaveLength(1);
    expect(supabase._builders[0]!.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/calculators/:id', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no user is signed in', async () => {
    installSupabaseMock(mockCreateClient, makeSupabaseMock({ user: null, fromResults: [] }));

    const res = await DELETE(deleteRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 400 when the body is not valid JSON', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );

    const res = await DELETE(deleteRequest('not-json'), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  it('returns 400 when updated_at is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );

    const res = await DELETE(deleteRequest({}), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_request' });
  });

  it('returns 200 with the new updated_at when the stale check matches and the soft-delete commits', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: { updated_at: FRESH_AT }, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await DELETE(deleteRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated_at: FRESH_AT });

    const builder = supabase._builders[0]!;
    const updateCall = builder.update.mock.calls[0]?.[0] as {
      soft_delete_at: string;
    };
    expect(typeof updateCall.soft_delete_at).toBe('string');
    expect(builder.eq.mock.calls).toContainEqual(['updated_at', STALE_AT]);
  });

  it('returns 409 with server_updated_at when the stale check fails', async () => {
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

    const res = await DELETE(deleteRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'stale',
      server_updated_at: FRESH_AT,
    });
  });

  it('returns 404 when the row is missing / not owned / already soft-deleted', async () => {
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

    const res = await DELETE(deleteRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

// PROJ-13 — extended DELETE coverage for the `?hard=true` permanent-
// delete branch. The handler reads the row first (state + ownership
// gate), runs an admin-client COUNT to attribute orphans-to-be, and
// only then issues the real DELETE FROM. Active rows are blocked with
// 400 not_in_trash so a hand-crafted API call can't skip Move-to-Trash.
describe('DELETE /api/calculators/:id?hard=true', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateAdminClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const HARD = '?hard=true';

  it('returns 401 when no user is signed in', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );

    const res = await DELETE(
      deleteRequest({ updated_at: STALE_AT }, HARD),
      ctx(),
    );

    expect(res.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 404 when the row does not exist (RLS opacity)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );

    const res = await DELETE(
      deleteRequest({ updated_at: STALE_AT }, HARD),
      ctx(),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 400 not_in_trash when the row is active (soft_delete_at is NULL)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: { updated_at: STALE_AT, soft_delete_at: null },
            error: null,
          },
        ],
      }),
    );

    const res = await DELETE(
      deleteRequest({ updated_at: STALE_AT }, HARD),
      ctx(),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'not_in_trash' });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 409 stale with server_updated_at when the client token is out of date', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: {
              updated_at: FRESH_AT,
              soft_delete_at: '2026-05-23T09:00:00.000Z',
            },
            error: null,
          },
        ],
      }),
    );

    const res = await DELETE(
      deleteRequest({ updated_at: STALE_AT }, HARD),
      ctx(),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'stale',
      server_updated_at: FRESH_AT,
    });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 200 with the purged_orphan_count when the row is trashed and current', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        // Read for state + stale check (the user-scoped client only
        // ever performs this single SELECT; the DELETE itself goes
        // through the admin client per BUG-H1 fix).
        {
          data: {
            updated_at: STALE_AT,
            soft_delete_at: '2026-05-23T09:00:00.000Z',
          },
          error: null,
        },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);
    const admin = makeAdminMock({
      fromResults: [
        // 1) COUNT scenarios attached to the calculator (cross-owner)
        { data: [], error: null, count: 4 },
        // 2) DELETE FROM calculators (admin path)
        { data: null, error: null },
      ],
    });
    mockCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await DELETE(
      deleteRequest({ updated_at: STALE_AT }, HARD),
      ctx(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      purged_orphan_count: 4,
    });
    // Admin client did the cross-owner count on scenarios, then the
    // actual DELETE on calculators.
    expect(admin.from).toHaveBeenNthCalledWith(1, 'scenarios');
    expect(admin.from).toHaveBeenNthCalledWith(2, 'calculators');
    expect(admin._builders[0]!.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(admin._builders[1]!.delete).toHaveBeenCalled();
    expect(admin._builders[1]!.eq).toHaveBeenCalledWith('id', CALC_ID);
    expect(admin._builders[1]!.not).toHaveBeenCalledWith(
      'soft_delete_at',
      'is',
      null,
    );
    // The user-scoped client must NOT have issued a DELETE — RLS would
    // reject it (BUG-H1 regression guard).
    expect(supabase._builders[0]!.delete).not.toHaveBeenCalled();
  });

  it('returns 200 with purged_orphan_count=0 when no scenarios reference the calculator', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: {
              updated_at: STALE_AT,
              soft_delete_at: '2026-05-23T09:00:00.000Z',
            },
            error: null,
          },
        ],
      }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          { data: [], error: null, count: null }, // COUNT → null
          { data: null, error: null },             // DELETE OK
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await DELETE(
      deleteRequest({ updated_at: STALE_AT }, HARD),
      ctx(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      purged_orphan_count: 0,
    });
  });

  it('returns 500 delete_failed when the DELETE statement errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: {
              updated_at: STALE_AT,
              soft_delete_at: '2026-05-23T09:00:00.000Z',
            },
            error: null,
          },
        ],
      }),
    );
    mockCreateAdminClient.mockReturnValue(
      makeAdminMock({
        fromResults: [
          { data: [], error: null, count: 1 },              // COUNT OK
          { data: null, error: { message: 'kaboom' } },      // DELETE errors
        ],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await DELETE(
      deleteRequest({ updated_at: STALE_AT }, HARD),
      ctx(),
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'delete_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('still soft-deletes (PROJ-10 contract) when ?hard=true is absent', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [{ data: { updated_at: FRESH_AT }, error: null }],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await DELETE(deleteRequest({ updated_at: STALE_AT }), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated_at: FRESH_AT });
    // No admin client involvement on the soft-delete path.
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});
