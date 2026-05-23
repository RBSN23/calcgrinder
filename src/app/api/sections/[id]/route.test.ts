import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

import { DELETE, PATCH } from './route';
import {
  installSupabaseMock,
  makeSupabaseMock,
  USER_FIXTURE,
} from '../../calculators/test-helpers';

const mockCreateClient = vi.mocked(createClient);

const CALC_ID = '22222222-2222-2222-2222-222222222222';
const SECTION_ID = '33333333-3333-3333-3333-333333333333';
const STALE_AT = '2026-05-23T10:00:00.000Z';
const FRESH_AT = '2026-05-23T10:05:00.000Z';

const SECTION_ROW = {
  id: SECTION_ID,
  calculator_id: CALC_ID,
  title: 'Inputs',
  description: '',
  layout_pattern_id: 'single_column',
  display_order: 0,
  created_at: '2026-05-23T09:00:00.000Z',
  updated_at: STALE_AT,
};

function ctx() {
  return { params: Promise.resolve({ id: SECTION_ID }) };
}

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost:3000/api/sections/${SECTION_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteRequest(qs = ''): Request {
  return new Request(`http://localhost:3000/api/sections/${SECTION_ID}${qs}`, {
    method: 'DELETE',
  });
}

describe('PATCH /api/sections/:id', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );
    const res = await PATCH(patchRequest({ updated_at: STALE_AT, title: 'X' }), ctx());
    expect(res.status).toBe(401);
  });

  it('returns 404 when the section is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await PATCH(patchRequest({ updated_at: STALE_AT, title: 'X' }), ctx());
    expect(res.status).toBe(404);
  });

  it('returns 409 when the calculator updated_at is stale', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_ROW, error: null },
          { data: { id: CALC_ID, updated_at: FRESH_AT }, error: null },
        ],
      }),
    );
    const res = await PATCH(patchRequest({ updated_at: STALE_AT, title: 'X' }), ctx());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('stale');
    expect(body.server_updated_at).toBe(FRESH_AT);
  });

  it('updates the title and returns the refreshed row plus bumped calculator_updated_at', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: SECTION_ROW, error: null }, // section read
        { data: { id: CALC_ID, updated_at: STALE_AT }, error: null }, // calc read
        // section UPDATE...RETURNING — its updated_at == calc.updated_at
        // after the parent-bump trigger fires in the same transaction.
        { data: { updated_at: FRESH_AT }, error: null },
        { data: { ...SECTION_ROW, title: 'Renamed', updated_at: FRESH_AT }, error: null }, // refresh read
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, title: 'Renamed' }),
      ctx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section.title).toBe('Renamed');
    expect(body.calculator_updated_at).toBe(FRESH_AT);

    const updateCall = supabase._builders[2]?.update.mock.calls[0]?.[0] as {
      title: string;
    };
    expect(updateCall.title).toBe('Renamed');
  });

  it('returns 400 on an invalid title', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_ROW, error: null },
          { data: { id: CALC_ID, updated_at: STALE_AT }, error: null },
        ],
      }),
    );

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, title: '   ' }),
      ctx(),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('title_required');
  });
});

describe('DELETE /api/sections/:id', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(401);
  });

  it('returns 422 when deleting the last section', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: { id: SECTION_ID, calculator_id: CALC_ID, display_order: 0 }, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 1 }, // sibling count
        ],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('cannot_delete_last_section');
  });

  it('returns 409 with child_count when section has cells and confirm is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: { id: SECTION_ID, calculator_id: CALC_ID, display_order: 0 }, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 2 }, // sibling count
          { data: null, error: null, count: 3 }, // child count
        ],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('section_not_empty');
    expect(body.child_count).toBe(3);
  });

  it('deletes when confirm=true and the section has children, returning bumped calculator_updated_at', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: { id: SECTION_ID, calculator_id: CALC_ID, display_order: 0 }, error: null },
        { data: { id: CALC_ID }, error: null },
        { data: null, error: null, count: 2 },
        { data: null, error: null, count: 3 },
        { data: null, error: null }, // delete result
        { data: [], error: null }, // surviving repack list
        { data: { updated_at: FRESH_AT }, error: null }, // bumped calc read
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);
    const res = await DELETE(
      deleteRequest('?confirm_delete_with_children=true'),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).calculator_updated_at).toBe(FRESH_AT);
  });

  it('deletes immediately when the section has no children, returning bumped calculator_updated_at', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: { id: SECTION_ID, calculator_id: CALC_ID, display_order: 0 }, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 2 },
          { data: null, error: null, count: 0 },
          { data: null, error: null },
          { data: [], error: null },
          { data: { updated_at: FRESH_AT }, error: null },
        ],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).calculator_updated_at).toBe(FRESH_AT);
  });
});
