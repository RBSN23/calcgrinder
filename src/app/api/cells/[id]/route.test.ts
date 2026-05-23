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
const CELL_ID = '44444444-4444-4444-4444-444444444444';
const STALE_AT = '2026-05-23T10:00:00.000Z';
const FRESH_AT = '2026-05-23T10:05:00.000Z';

const CELL_ROW = {
  id: CELL_ID,
  calculator_id: CALC_ID,
  section_id: SECTION_ID,
  kind: 'input',
  name: 'loan_amount',
  label: 'Loan amount',
  description: '',
  description_render: 'caption',
  value_type: 'number',
  visibility: 'visible',
  editability: 'editable',
  default_value: null,
  formula: null,
  display_widget: 'number_field',
  display_format: 'auto',
  display_emphasis: 'plain',
  unit: null,
  numeric_min: null,
  numeric_max: null,
  numeric_step: null,
  select_options: null,
  currency_code: null,
  card_accent: 'theme',
  card_background_tint: 'none',
  card_border: 'none',
  card_size_hint: 'narrow',
  text_size: 'm',
  text_colour: 'default',
  display_order: 0,
  created_at: '2026-05-23T09:00:00.000Z',
  updated_at: STALE_AT,
};

function ctx() {
  return { params: Promise.resolve({ id: CELL_ID }) };
}

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost:3000/api/cells/${CELL_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteRequest(): Request {
  return new Request(`http://localhost:3000/api/cells/${CELL_ID}`, {
    method: 'DELETE',
  });
}

describe('PATCH /api/cells/:id', () => {
  beforeEach(() => mockCreateClient.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when unauthenticated', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, label: 'X' }),
      ctx(),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the cell is missing', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [{ data: null, error: null }],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, label: 'X' }),
      ctx(),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 stale when the calculator updated_at differs', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CELL_ROW, error: null },
          { data: { id: CALC_ID, updated_at: FRESH_AT }, error: null },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, label: 'X' }),
      ctx(),
    );
    expect(res.status).toBe(409);
  });

  it('returns 422 for cross-section moves', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [],
      }),
    );
    const res = await PATCH(
      patchRequest({
        updated_at: STALE_AT,
        section_id: '11111111-1111-4111-8111-111111111111',
      }),
      ctx(),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('cross_section_move_unsupported');
  });

  it('updates a label and returns the refreshed cell + bumped calculator_updated_at', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CELL_ROW, error: null },
          { data: { id: CALC_ID, updated_at: STALE_AT }, error: null },
          { data: null, error: null }, // update
          { data: { ...CELL_ROW, label: 'Principal' }, error: null }, // refresh
          { data: { updated_at: FRESH_AT }, error: null }, // bumped calc read
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, label: 'Principal' }),
      ctx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cell.label).toBe('Principal');
    expect(body.rewritten_cell_ids).toEqual([]);
    expect(body.calculator_updated_at).toBe(FRESH_AT);
  });

  it('returns 409 name_collision when renaming clashes', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CELL_ROW, error: null },
          { data: { id: CALC_ID, updated_at: STALE_AT }, error: null },
          { data: { id: 'other-cell-id' }, error: null }, // clash select
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, name: 'rate_pct' }),
      ctx(),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('name_collision');
  });

  it('rewrites dependent formulas on rename', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: CELL_ROW, error: null },
        { data: { id: CALC_ID, updated_at: STALE_AT }, error: null },
        { data: null, error: null }, // no clash
        {
          data: [
            { id: 'out-1', formula: '=loan_amount * 0.05' },
            { id: 'out-2', formula: '=loan_amount + fees' },
          ],
          error: null,
        }, // outputs read (await)
        { data: null, error: null }, // cell update
        { data: null, error: null }, // rewrite out-1
        { data: null, error: null }, // rewrite out-2
        { data: { ...CELL_ROW, name: 'principal' }, error: null }, // refresh
        { data: { updated_at: FRESH_AT }, error: null }, // bumped calc read
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, name: 'principal' }),
      ctx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cell.name).toBe('principal');
    expect(body.rewritten_cell_ids).toEqual(['out-1', 'out-2']);

    // The two rewrites should have been written.
    const rewrite1 = supabase._builders[5]?.update.mock.calls[0]?.[0] as {
      formula: string;
    };
    const rewrite2 = supabase._builders[6]?.update.mock.calls[0]?.[0] as {
      formula: string;
    };
    expect(rewrite1.formula).toBe('=principal * 0.05');
    expect(rewrite2.formula).toBe('=principal + fees');
  });

  it('returns 400 when the new name is reserved', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CELL_ROW, error: null },
          { data: { id: CALC_ID, updated_at: STALE_AT }, error: null },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, name: 'pmt' }),
      ctx(),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('name_reserved');
  });

  it('returns 422 on invalid kind swap (input→output without formula)', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: CELL_ROW, error: null },
          { data: { id: CALC_ID, updated_at: STALE_AT }, error: null },
        ],
      }),
    );
    const res = await PATCH(
      patchRequest({ updated_at: STALE_AT, kind: 'output' }),
      ctx(),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('invalid_kind_swap');
  });
});

describe('DELETE /api/cells/:id', () => {
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

  it('returns 404 when the cell is missing', async () => {
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

  it('deletes the cell and returns the bumped calculator_updated_at', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          {
            data: {
              id: CELL_ID,
              calculator_id: CALC_ID,
              section_id: SECTION_ID,
              display_order: 0,
            },
            error: null,
          },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null }, // delete
          { data: [], error: null }, // surviving siblings (await)
          { data: { updated_at: FRESH_AT }, error: null }, // bumped calc read
        ],
      }),
    );
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).calculator_updated_at).toBe(FRESH_AT);
  });
});
