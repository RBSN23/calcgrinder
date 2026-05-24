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
const CHART_ID = '44444444-4444-4444-4444-444444444444';

function ctx() {
  return { params: Promise.resolve({ id: SECTION_ID }) };
}

function postRequest(body: unknown | string): Request {
  return new Request(
    `http://localhost:3000/api/sections/${SECTION_ID}/charts`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

const SECTION_PARENT = { id: SECTION_ID, calculator_id: CALC_ID };

const INSERTED_CHART = {
  id: CHART_ID,
  calculator_id: CALC_ID,
  section_id: SECTION_ID,
  name: 'chart_1',
  chart_type: 'line',
  title: '',
  subtitle: '',
  bindings: { x_axis: null, lines: [] },
  style: {
    legend: 'auto',
    axis_labels: 'auto',
    animation: true,
    smooth_lines: false,
  },
  card_accent: 'theme',
  card_background_tint: 'none',
  card_border: 'none',
  card_size_hint: 'narrow',
  display_order: 0,
  created_at: '2026-05-24T10:00:00.000Z',
  updated_at: '2026-05-24T10:00:00.000Z',
};

describe('POST /api/sections/:id/charts', () => {
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
          { data: SECTION_PARENT, error: null }, // section
          { data: null, error: null }, // calculator filtered out by soft_delete_at IS NULL
        ],
      }),
    );
    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(404);
  });

  it('creates a default Line chart with chart_1 when body is empty', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: SECTION_PARENT, error: null }, // section
        { data: { id: CALC_ID }, error: null }, // calculator
        { data: null, error: null, count: 0 }, // chart-cap count
        { data: [], error: null }, // existing chart names
        { data: null, error: null, count: 0 }, // section chart sibling count
        { data: INSERTED_CHART, error: null }, // insert (RETURNING)
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.chart.name).toBe('chart_1');
    expect(body.chart.chart_type).toBe('line');
    expect(body.calculator_updated_at).toBe(INSERTED_CHART.updated_at);

    const insertCall = supabase._builders[5]?.insert.mock.calls[0]?.[0] as {
      name: string;
      chart_type: string;
      title: string;
      subtitle: string;
      bindings: { x_axis: null; lines: never[] };
      style: { legend: string; axis_labels: string; animation: boolean; smooth_lines: boolean };
      card_accent: string;
      card_size_hint: string;
      display_order: number;
    };
    expect(insertCall.name).toBe('chart_1');
    expect(insertCall.chart_type).toBe('line');
    expect(insertCall.title).toBe('');
    expect(insertCall.subtitle).toBe('');
    expect(insertCall.bindings).toEqual({ x_axis: null, lines: [] });
    expect(insertCall.style).toEqual({
      legend: 'auto',
      axis_labels: 'auto',
      animation: true,
      smooth_lines: false,
    });
    expect(insertCall.card_accent).toBe('theme');
    expect(insertCall.card_size_hint).toBe('narrow');
    expect(insertCall.display_order).toBe(0);
  });

  it('returns 422 when the calculator has hit the 30-chart cap', async () => {
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
    expect(body.error).toBe('chart_cap_reached');
    expect(body.max).toBe(30);
  });

  it('returns 400 when the name is reserved', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 0 },
        ],
      }),
    );
    const res = await POST(postRequest({ name: 'pmt' }), ctx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('name_reserved');
    expect(body.reserved_word).toBe('pmt');
  });

  it('returns 400 when the name fails the snake_case pattern', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 0 },
        ],
      }),
    );
    const res = await POST(postRequest({ name: 'BAD-Name' }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('name_invalid');
  });

  it('returns 400 when bindings carry an unknown color_token_id', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 0 },
        ],
      }),
    );
    const res = await POST(
      postRequest({
        name: 'sales_chart',
        chart_type: 'line',
        bindings: {
          x_axis: null,
          lines: [
            {
              id: 'row1',
              label: 'L',
              cell_id: '00000000-0000-0000-0000-000000000001',
              color_token_id: 'series.42', // not in ALLOWED_COLOR_TOKENS
            },
          ],
        },
      }),
      ctx(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('color_token_invalid');
    expect(Array.isArray(body.allowed_tokens)).toBe(true);
  });

  it('returns 409 when the unique (calculator_id, name) constraint fires', async () => {
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
            data: null,
            error: { message: 'duplicate key value violates unique constraint' },
          },
        ],
      }),
    );
    const res = await POST(
      postRequest({ name: 'revenue' }),
      ctx(),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('name_collision');
  });
});
