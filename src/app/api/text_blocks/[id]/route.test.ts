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
const TEXT_BLOCK_ID = '44444444-4444-4444-4444-444444444444';
const SERVER_UPDATED_AT = '2026-05-24T10:00:00.000Z';
const BUMPED_UPDATED_AT = '2026-05-24T10:01:00.000Z';

function ctx() {
  return { params: Promise.resolve({ id: TEXT_BLOCK_ID }) };
}

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost:3000/api/text_blocks/${TEXT_BLOCK_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteRequest(): Request {
  return new Request(`http://localhost:3000/api/text_blocks/${TEXT_BLOCK_ID}`, {
    method: 'DELETE',
  });
}

const CURRENT_TEXT_BLOCK = {
  id: TEXT_BLOCK_ID,
  calculator_id: CALC_ID,
  section_id: SECTION_ID,
  body: '# Hello',
  card_accent: 'theme',
  card_background_tint: 'none',
  card_border: 'none',
  card_size_hint: 'wide',
  text_size: 'm',
  text_colour: 'default',
  display_order: 0,
  created_at: SERVER_UPDATED_AT,
  updated_at: SERVER_UPDATED_AT,
};

describe('PATCH /api/text_blocks/:id', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, body: 'hi' }),
      ctx(),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the text block is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, body: 'hi' }),
      ctx(),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when updated_at is stale', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CURRENT_TEXT_BLOCK, error: null },
          {
            data: { id: CALC_ID, updated_at: BUMPED_UPDATED_AT },
            error: null,
          },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, body: 'hi' }),
      ctx(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('stale');
    expect(body.server_updated_at).toBe(BUMPED_UPDATED_AT);
  });

  // Cross-section moves are now supported (PROJ-24 Item 9).

  it('returns 422 body_too_large when body exceeds 51200 bytes', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const res = await PATCH(
      patchRequest({
        updated_at: SERVER_UPDATED_AT,
        body: 'a'.repeat(51201),
      }),
      ctx(),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('body_too_large');
    expect(body.max_bytes).toBe(51200);
  });

  it('accepts a body of exactly 51200 bytes (boundary inclusive)', async () => {
    const exactBody = 'a'.repeat(51200);
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CURRENT_TEXT_BLOCK, error: null },
          { data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT }, error: null },
          { data: { updated_at: BUMPED_UPDATED_AT }, error: null },
          {
            data: { ...CURRENT_TEXT_BLOCK, body: exactBody },
            error: null,
          },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, body: exactBody }),
      ctx(),
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid enum value (text_size = xxl)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const res = await PATCH(
      patchRequest({
        updated_at: SERVER_UPDATED_AT,
        text_size: 'xxl',
      }),
      ctx(),
    );
    expect(res.status).toBe(400);
  });

  it('updates the body and echoes the bumped calculator_updated_at', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: CURRENT_TEXT_BLOCK, error: null }, // load text block
        {
          data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT },
          error: null,
        }, // calculator + optimistic concurrency
        { data: { updated_at: BUMPED_UPDATED_AT }, error: null }, // update RETURNING
        {
          data: { ...CURRENT_TEXT_BLOCK, body: 'Updated body' },
          error: null,
        }, // refresh
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({
        updated_at: SERVER_UPDATED_AT,
        body: 'Updated body',
      }),
      ctx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text_block.body).toBe('Updated body');
    expect(body.calculator_updated_at).toBe(BUMPED_UPDATED_AT);

    // The third from() builder is the update — inspect its payload.
    const updateCall = supabase._builders[2]?.update.mock.calls[0]?.[0] as {
      body: string;
    };
    expect(updateCall.body).toBe('Updated body');
  });

  it('updates visual fields only when supplied (partial PATCH)', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: CURRENT_TEXT_BLOCK, error: null },
        { data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT }, error: null },
        { data: { updated_at: BUMPED_UPDATED_AT }, error: null },
        {
          data: { ...CURRENT_TEXT_BLOCK, text_size: 'l' },
          error: null,
        },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({
        updated_at: SERVER_UPDATED_AT,
        text_size: 'l',
      }),
      ctx(),
    );
    expect(res.status).toBe(200);
    const updateCall = supabase._builders[2]?.update.mock.calls[0]?.[0] as {
      text_size: string;
      body?: string;
    };
    expect(updateCall.text_size).toBe('l');
    expect('body' in updateCall).toBe(false);
  });
});

describe('DELETE /api/text_blocks/:id', () => {
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

  it('returns 404 when the text block is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(404);
  });

  it('returns 404 when the parent calculator is soft-deleted', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: {
              id: TEXT_BLOCK_ID,
              calculator_id: CALC_ID,
              section_id: SECTION_ID,
              display_order: 0,
            },
            error: null,
          },
          { data: null, error: null }, // calculator filtered by soft_delete_at IS NULL
        ],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(404);
  });

  it('hard-deletes the block and echoes the calculator_updated_at', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        {
          data: {
            id: TEXT_BLOCK_ID,
            calculator_id: CALC_ID,
            section_id: SECTION_ID,
            display_order: 0,
          },
          error: null,
        }, // load
        { data: { id: CALC_ID }, error: null }, // calc (active)
        { data: null, error: null }, // delete (no RETURNING)
        { data: [], error: null }, // surviving siblings list
        { data: { updated_at: BUMPED_UPDATED_AT }, error: null }, // bumped calc
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.calculator_updated_at).toBe(BUMPED_UPDATED_AT);
  });
});
