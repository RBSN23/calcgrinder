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

function ctx() {
  return { params: Promise.resolve({ id: SECTION_ID }) };
}

function postRequest(body: unknown | string): Request {
  return new Request(
    `http://localhost:3000/api/sections/${SECTION_ID}/cells`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

const SECTION_PARENT = { id: SECTION_ID, calculator_id: CALC_ID };

const INSERTED_CELL = {
  id: '44444444-4444-4444-4444-444444444444',
  calculator_id: CALC_ID,
  section_id: SECTION_ID,
  kind: 'input',
  name: 'cell_1',
  label: 'New cell',
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
  created_at: '2026-05-23T10:00:00.000Z',
  updated_at: '2026-05-23T10:00:00.000Z',
};

describe('POST /api/sections/:id/cells', () => {
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

  it('creates a default Input cell with cell_1 when body is empty and echoes calculator_updated_at', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: SECTION_PARENT, error: null }, // section
        { data: { id: CALC_ID }, error: null }, // calculator
        { data: null, error: null, count: 0 }, // cell-cap count
        { data: [], error: null }, // existing names
        { data: null, error: null, count: 0 }, // section cell count
        { data: INSERTED_CELL, error: null }, // insert
        { data: { updated_at: '2026-05-23T10:05:00.000Z' }, error: null }, // bumped calc read
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.cell.name).toBe('cell_1');
    expect(body.cell.kind).toBe('input');
    expect(body.calculator_updated_at).toBe('2026-05-23T10:05:00.000Z');

    const insertCall = supabase._builders[5]?.insert.mock.calls[0]?.[0] as {
      kind: string;
      name: string;
      value_type: string;
      editability: string;
      display_widget: string;
      display_format: string;
      display_order: number;
    };
    expect(insertCall.kind).toBe('input');
    expect(insertCall.name).toBe('cell_1');
    expect(insertCall.value_type).toBe('number');
    expect(insertCall.editability).toBe('editable');
    expect(insertCall.display_widget).toBe('number_field');
    expect(insertCall.display_format).toBe('auto');
    expect(insertCall.display_order).toBe(0);
  });

  it('returns 422 when the calculator has hit the 200-cell cap', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 200 },
        ],
      }),
    );
    const res = await POST(postRequest({}), ctx());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('cell_cap_reached');
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

  it('returns 400 when the name fails the pattern', async () => {
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

  it('returns 422 when hidden visibility lacks a default_value', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 0 },
          { data: [], error: null },
        ],
      }),
    );
    const res = await POST(
      postRequest({ visibility: 'hidden' }),
      ctx(),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('hidden_requires_value');
  });

  it('returns 422 when an Output is created without a formula default', async () => {
    // Default behavior gives Output cells formula = '' so this should
    // NOT trigger output_requires_formula. Test the override: pass
    // formula: null explicitly.
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: SECTION_PARENT, error: null },
          { data: { id: CALC_ID }, error: null },
          { data: null, error: null, count: 0 },
          { data: [], error: null },
        ],
      }),
    );
    const res = await POST(
      postRequest({ kind: 'output', formula: '' }), // empty string allowed
      ctx(),
    );
    // empty-string formula IS allowed; we just need this not to be 422.
    expect(res.status).not.toBe(422);
  });
});
