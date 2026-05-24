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
} from '../../../calculators/test-helpers';

const mockCreateClient = vi.mocked(createClient);

const CALC_ID = '22222222-2222-2222-2222-222222222222';
const SECTION_ID = '33333333-3333-3333-3333-333333333333';
const TEXT_BLOCK_ID = '44444444-4444-4444-4444-444444444444';

function ctx() {
  return { params: Promise.resolve({ id: SECTION_ID }) };
}

function postRequest(body: unknown | string): Request {
  return new Request(
    `http://localhost:3000/api/sections/${SECTION_ID}/text_blocks`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

const SECTION_PARENT = { id: SECTION_ID, calculator_id: CALC_ID };

const INSERTED_TEXT_BLOCK = {
  id: TEXT_BLOCK_ID,
  calculator_id: CALC_ID,
  section_id: SECTION_ID,
  body: '',
  card_accent: 'theme',
  card_background_tint: 'none',
  card_border: 'none',
  card_size_hint: 'wide',
  text_size: 'm',
  text_colour: 'default',
  display_order: 0,
  created_at: '2026-05-24T10:00:00.000Z',
  updated_at: '2026-05-24T10:00:00.000Z',
};

describe('POST /api/sections/:id/text_blocks', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );
    const res = await POST(postRequest({}), ctx());
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
    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(404);
  });

  it('returns 404 when the parent calculator is soft-deleted', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: null, error: null }, // calculator filtered out
        ],
      }),
    );
    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(404);
  });

  it('creates a default empty-body text block when body is empty', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: SECTION_PARENT, error: null }, // section
        { data: { id: CALC_ID }, error: null }, // calculator
        { data: null, error: null, count: 0 }, // cap count
        { data: null, error: null, count: 0 }, // section sibling count
        { data: INSERTED_TEXT_BLOCK, error: null }, // insert RETURNING
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.text_block.body).toBe('');
    expect(body.text_block.card_size_hint).toBe('wide');
    expect(body.text_block.text_size).toBe('m');
    expect(body.text_block.text_colour).toBe('default');
    expect(body.calculator_updated_at).toBe(INSERTED_TEXT_BLOCK.updated_at);

    // Inspect the insert payload — the fifth from() builder.
    const insertCall = supabase._builders[4]?.insert.mock.calls[0]?.[0] as {
      body: string;
      card_accent: string;
      card_background_tint: string;
      card_border: string;
      card_size_hint: string;
      text_size: string;
      text_colour: string;
      display_order: number;
    };
    expect(insertCall.body).toBe('');
    expect(insertCall.card_accent).toBe('theme');
    expect(insertCall.card_background_tint).toBe('none');
    expect(insertCall.card_border).toBe('none');
    expect(insertCall.card_size_hint).toBe('wide');
    expect(insertCall.text_size).toBe('m');
    expect(insertCall.text_colour).toBe('default');
    expect(insertCall.display_order).toBe(0);
  });

  it('returns 422 when the calculator has hit the 30-text-block cap', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 30 },
        ],
      }),
    );
    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('text_block_cap_reached');
    expect(body.max).toBe(30);
  });

  it('returns 422 body_too_large when body exceeds 51200 UTF-8 bytes', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const tooLargeBody = 'a'.repeat(51201);
    const res = await POST(postRequest({ body: tooLargeBody }), ctx());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('body_too_large');
    expect(body.max_bytes).toBe(51200);
  });

  it('accepts a body of exactly 51200 UTF-8 bytes (boundary inclusive)', async () => {
    const exactBody = 'a'.repeat(51200);
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 0 },
          { data: null, error: null, count: 0 },
          {
            data: { ...INSERTED_TEXT_BLOCK, body: exactBody },
            error: null,
          },
        ],
      }),
    );
    const res = await POST(postRequest({ body: exactBody }), ctx());
    expect(res.status).toBe(201);
  });

  it('returns 400 on invalid enum value (card_size_hint = huge)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const res = await POST(postRequest({ card_size_hint: 'huge' }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('returns 400 on invalid enum value (text_size = xxl)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: USER_FIXTURE, fromResults: [] }),
    );
    const res = await POST(postRequest({ text_size: 'xxl' }), ctx());
    expect(res.status).toBe(400);
  });
});
