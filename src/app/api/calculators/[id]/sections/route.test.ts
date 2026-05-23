import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

import { POST } from './route';
import {
  installSupabaseMock,
  makeSupabaseMock,
  USER_FIXTURE,
} from '../../test-helpers';

const mockCreateClient = vi.mocked(createClient);

const CALC_ID = '22222222-2222-2222-2222-222222222222';

const INSERTED_SECTION = {
  id: '33333333-3333-3333-3333-333333333333',
  calculator_id: CALC_ID,
  title: 'New section',
  description: '',
  layout_pattern_id: 'single_column',
  display_order: 1,
  created_at: '2026-05-23T10:00:00.000Z',
  updated_at: '2026-05-23T10:00:00.000Z',
};

function ctx() {
  return { params: Promise.resolve({ id: CALC_ID }) };
}

function postRequest(body: unknown | string): Request {
  return new Request(`http://localhost:3000/api/calculators/${CALC_ID}/sections`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/calculators/:id/sections', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );
    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 404 when the calculator is not owned / not found', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('creates a new section with defaults when the body is empty and echoes calculator_updated_at', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: { id: CALC_ID }, error: null }, // calculator ownership
        {
          data: [{ id: 'sec-0', display_order: 0 }],
          error: null,
        }, // sibling read (await)
        { data: INSERTED_SECTION, error: null }, // section insert
        { data: { updated_at: '2026-05-23T10:05:00.000Z' }, error: null }, // bumped calc read
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      section: INSERTED_SECTION,
      calculator_updated_at: '2026-05-23T10:05:00.000Z',
    });

    const insertCall = supabase._builders[2]?.insert.mock.calls[0]?.[0] as {
      calculator_id: string;
      title: string;
      layout_pattern_id: string;
      display_order: number;
    };
    expect(insertCall.calculator_id).toBe(CALC_ID);
    expect(insertCall.title).toBe('New section');
    expect(insertCall.layout_pattern_id).toBe('single_column');
    expect(insertCall.display_order).toBe(1);
  });

  it('returns 400 when the title trims to empty', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: { id: CALC_ID }, error: null }],
      }),
    );
    const res = await POST(postRequest({ title: '   ' }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'title_required' });
  });

  it('returns 400 when the title exceeds 100 chars', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: { id: CALC_ID }, error: null }],
      }),
    );
    const res = await POST(postRequest({ title: 'a'.repeat(101) }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('title_too_long');
  });

  it('returns 400 on invalid JSON', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const res = await POST(postRequest('{ not json'), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  it('returns 422 when after_section_id is not on the calculator', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: { id: CALC_ID }, error: null },
          {
            data: [{ id: 'sec-0', display_order: 0 }],
            error: null,
          },
        ],
      }),
    );
    const res = await POST(
      postRequest({ after_section_id: '99999999-9999-4999-8999-999999999999' }),
      ctx(),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'after_section_not_found' });
  });
});
