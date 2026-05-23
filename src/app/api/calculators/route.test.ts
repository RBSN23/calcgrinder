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
} from './test-helpers';

const mockCreateClient = vi.mocked(createClient);

const SECTION_FIXTURE = {
  id: '33333333-3333-3333-3333-333333333333',
  updated_at: '2026-05-23T10:00:01.000Z',
};

const REFRESHED_UPDATED_AT = {
  updated_at: '2026-05-23T10:00:01.500Z',
};

describe('POST /api/calculators', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 with the unauthorized payload when no user is signed in', async () => {
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({ user: null, fromResults: [] }),
    );

    const res = await POST();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 201 with calculator + default_section_id on success', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: ROW_FIXTURE, error: null }, // calculator insert
        { data: SECTION_FIXTURE, error: null }, // section insert
        { data: REFRESHED_UPDATED_AT, error: null }, // refresh updated_at
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST();

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      ...ROW_FIXTURE,
      updated_at: REFRESHED_UPDATED_AT.updated_at,
      default_section_id: SECTION_FIXTURE.id,
    });

    // The calculator insert MUST set owner_id from the auth context.
    const calcInsertCall = supabase._builders[0]?.insert.mock.calls[0]?.[0] as {
      owner_id: string;
    };
    expect(calcInsertCall.owner_id).toBe(USER_FIXTURE.id);

    // The section insert MUST bind to the new calculator and use defaults.
    const sectionInsertCall = supabase._builders[1]?.insert.mock
      .calls[0]?.[0] as {
      calculator_id: string;
      title: string;
      layout_pattern_id: string;
      display_order: number;
    };
    expect(sectionInsertCall.calculator_id).toBe(ROW_FIXTURE.id);
    expect(sectionInsertCall.title).toBe('Section 1');
    expect(sectionInsertCall.layout_pattern_id).toBe('single_column');
    expect(sectionInsertCall.display_order).toBe(0);
  });

  it('returns 500 when the calculator insert errors out', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: null, error: { message: 'simulated calculator insert failure' } },
        ],
      }),
    );

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'create_failed' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rolls back the calculator when the section insert fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: ROW_FIXTURE, error: null }, // calculator insert ok
        { data: null, error: { message: 'simulated section insert failure' } },
        { data: null, error: null }, // delete (no result needed)
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'create_failed' });
    expect(errorSpy).toHaveBeenCalled();

    // The third .from('calculators') call should have deleted the row.
    expect(supabase._builders[2]?.delete).toHaveBeenCalled();
  });
});
