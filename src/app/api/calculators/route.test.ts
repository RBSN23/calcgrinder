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
        // Title auto-resolve lookup: "Untitled calculator" is free.
        { data: null, error: null },
        // PROJ-14: default_calculator_theme lookup — user has no override.
        { data: { default_calculator_theme: null }, error: null },
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

    // The calculator insert MUST set owner_id from the auth context and
    // MUST NOT carry theme_id (let the column DEFAULT apply).
    const calcInsertCall = supabase._builders[2]?.insert.mock.calls[0]?.[0] as {
      owner_id: string;
      title: string;
      theme_id?: string;
    };
    expect(calcInsertCall.owner_id).toBe(USER_FIXTURE.id);
    expect(calcInsertCall.title).toBe('Untitled calculator');
    expect(calcInsertCall.theme_id).toBeUndefined();

    // The section insert MUST bind to the new calculator and use defaults.
    const sectionInsertCall = supabase._builders[3]?.insert.mock
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

  it('uses profiles.default_calculator_theme when the user has set one', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        { data: null, error: null }, // title lookup
        { data: { default_calculator_theme: 'terminal' }, error: null },
        { data: { ...ROW_FIXTURE, theme_id: 'terminal' }, error: null },
        { data: SECTION_FIXTURE, error: null },
        { data: REFRESHED_UPDATED_AT, error: null },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST();

    expect(res.status).toBe(201);
    const calcInsertCall = supabase._builders[2]?.insert.mock.calls[0]?.[0] as {
      theme_id?: string;
    };
    expect(calcInsertCall.theme_id).toBe('terminal');
  });

  it('auto-resolves the default title when "Untitled calculator" is already taken', async () => {
    const supabase = makeSupabaseMock({
      user: USER_FIXTURE,
      fromResults: [
        // First lookup: "Untitled calculator" exists.
        { data: { id: 'existing-1' }, error: null },
        // Second lookup: "Untitled calculator (2)" is free.
        { data: null, error: null },
        // default_calculator_theme: not set
        { data: { default_calculator_theme: null }, error: null },
        { data: { ...ROW_FIXTURE, title: 'Untitled calculator (2)' }, error: null },
        { data: SECTION_FIXTURE, error: null },
        { data: REFRESHED_UPDATED_AT, error: null },
      ],
    });
    installSupabaseMock(mockCreateClient, supabase);

    const res = await POST();

    expect(res.status).toBe(201);
    const calcInsertCall = supabase._builders[3]?.insert.mock.calls[0]?.[0] as {
      title: string;
    };
    expect(calcInsertCall.title).toBe('Untitled calculator (2)');
  });

  it('returns 500 when the calculator insert errors out', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    installSupabaseMock(
      mockCreateClient,
      makeSupabaseMock({
        user: USER_FIXTURE,
        fromResults: [
          { data: null, error: null }, // title lookup: free
          { data: { default_calculator_theme: null }, error: null },
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
        { data: null, error: null }, // title lookup: free
        { data: { default_calculator_theme: null }, error: null },
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

    // The fifth .from() call (index 4) should have deleted the calculator row.
    expect(supabase._builders[4]?.delete).toHaveBeenCalled();
  });
});
