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
const CHART_ID = '44444444-4444-4444-4444-444444444444';
const OTHER_CHART_ID = '55555555-5555-5555-5555-555555555555';
const SERVER_UPDATED_AT = '2026-05-24T10:00:00.000Z';
const BUMPED_UPDATED_AT = '2026-05-24T10:01:00.000Z';

function ctx() {
  return { params: Promise.resolve({ id: CHART_ID }) };
}

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost:3000/api/charts/${CHART_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteRequest(): Request {
  return new Request(`http://localhost:3000/api/charts/${CHART_ID}`, {
    method: 'DELETE',
  });
}

const CURRENT_CHART = {
  id: CHART_ID,
  calculator_id: CALC_ID,
  section_id: SECTION_ID,
  name: 'chart_1',
  chart_type: 'line',
  title: '',
  subtitle: '',
  bindings: {
    x_axis: '00000000-0000-0000-0000-0000000000aa',
    lines: [
      {
        id: 'row1',
        label: 'Revenue',
        cell_id: '00000000-0000-0000-0000-0000000000bb',
        color_token_id: null,
      },
    ],
  },
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
  created_at: SERVER_UPDATED_AT,
  updated_at: SERVER_UPDATED_AT,
};

describe('PATCH /api/charts/:id', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, title: 'X' }),
      ctx(),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the chart is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, title: 'X' }),
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
          { data: CURRENT_CHART, error: null },
          {
            data: { id: CALC_ID, updated_at: BUMPED_UPDATED_AT },
            error: null,
          },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, title: 'X' }),
      ctx(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('stale');
    expect(body.server_updated_at).toBe(BUMPED_UPDATED_AT);
  });

  // Cross-section moves are now supported (PROJ-24 Item 9).

  it('returns 409 with conflicting_chart_id when renaming to an existing chart name', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CURRENT_CHART, error: null },
          {
            data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT },
            error: null,
          },
          // pre-check collision read
          { data: { id: OTHER_CHART_ID }, error: null },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, name: 'sibling' }),
      ctx(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('name_collision');
    expect(body.conflicting_chart_id).toBe(OTHER_CHART_ID);
  });

  it('returns 400 with name_reserved when renaming to a reserved word', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CURRENT_CHART, error: null },
          {
            data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT },
            error: null,
          },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, name: 'pmt' }),
      ctx(),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('name_reserved');
  });

  it('preserves bindings on a within-family chart_type switch (line → bar renames lines → bars)', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: CURRENT_CHART, error: null },
        { data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT }, error: null },
        { data: { updated_at: BUMPED_UPDATED_AT }, error: null }, // update RETURNING
        {
          data: { ...CURRENT_CHART, chart_type: 'bar' },
          error: null,
        }, // refresh
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, chart_type: 'bar' }),
      ctx(),
    );
    expect(res.status).toBe(200);

    // Inspect the .update() call (the third from() builder).
    const updateCall = supabase._builders[2]?.update.mock.calls[0]?.[0] as {
      chart_type: string;
      bindings: { x_axis: string; bars: Array<{ cell_id: string }> };
    };
    expect(updateCall.chart_type).toBe('bar');
    expect(updateCall.bindings.bars).toHaveLength(1);
    expect(updateCall.bindings.bars[0].cell_id).toBe(
      '00000000-0000-0000-0000-0000000000bb',
    );
    expect(updateCall.bindings.x_axis).toBe(
      '00000000-0000-0000-0000-0000000000aa',
    );
    // The carry-forward drops the `lines` key.
    expect('lines' in updateCall.bindings).toBe(false);
  });

  it('resets bindings on a cross-family chart_type switch (line → pie with >1 series)', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: CURRENT_CHART, error: null },
        { data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT }, error: null },
        { data: { updated_at: BUMPED_UPDATED_AT }, error: null },
        {
          data: { ...CURRENT_CHART, chart_type: 'pie' },
          error: null,
        },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, chart_type: 'pie' }),
      ctx(),
    );
    expect(res.status).toBe(200);

    const updateCall = supabase._builders[2]?.update.mock.calls[0]?.[0] as {
      chart_type: string;
      bindings: { slice_labels: string | null; slice_sizes: string | null };
    };
    expect(updateCall.chart_type).toBe('pie');
    // Pie keeps the first series cell as slice_sizes; slice_labels resets to null.
    expect(updateCall.bindings.slice_labels).toBeNull();
    expect(updateCall.bindings.slice_sizes).toBe(
      '00000000-0000-0000-0000-0000000000bb',
    );
  });

  it('resets bindings to the singleton default on a switch into a singleton (line → sparkline)', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: CURRENT_CHART, error: null },
        { data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT }, error: null },
        { data: { updated_at: BUMPED_UPDATED_AT }, error: null },
        {
          data: { ...CURRENT_CHART, chart_type: 'sparkline' },
          error: null,
        },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: SERVER_UPDATED_AT, chart_type: 'sparkline' }),
      ctx(),
    );
    expect(res.status).toBe(200);

    const updateCall = supabase._builders[2]?.update.mock.calls[0]?.[0] as {
      chart_type: string;
      bindings: { values: null };
    };
    expect(updateCall.chart_type).toBe('sparkline');
    expect(updateCall.bindings).toEqual({ values: null });
  });

  it('returns 400 when a PATCH body sends an unknown color_token_id', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CURRENT_CHART, error: null },
          {
            data: { id: CALC_ID, updated_at: SERVER_UPDATED_AT },
            error: null,
          },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({
        updated_at: SERVER_UPDATED_AT,
        bindings: {
          x_axis: null,
          lines: [
            {
              id: 'row1',
              label: 'L',
              cell_id: '00000000-0000-0000-0000-0000000000bb',
              color_token_id: 'series.99',
            },
          ],
        },
      }),
      ctx(),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('color_token_invalid');
  });
});

describe('DELETE /api/charts/:id', () => {
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

  it('returns 404 when the chart is missing', async () => {
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
              id: CHART_ID,
              calculator_id: CALC_ID,
              section_id: SECTION_ID,
              display_order: 0,
            },
            error: null,
          },
          { data: null, error: null },
        ],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(404);
  });

  it('hard-deletes and echoes the bumped calculator.updated_at', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: {
              id: CHART_ID,
              calculator_id: CALC_ID,
              section_id: SECTION_ID,
              display_order: 0,
            },
            error: null,
          }, // chart lookup
          { data: { id: CALC_ID }, error: null }, // calc check
          { data: null, error: null }, // delete (no return)
          { data: [], error: null }, // surviving siblings
          { data: { updated_at: BUMPED_UPDATED_AT }, error: null }, // calc.updated_at echo
        ],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).calculator_updated_at).toBe(BUMPED_UPDATED_AT);
  });
});
