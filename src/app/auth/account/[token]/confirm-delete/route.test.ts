import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state: {
  deletionRow: { id: string; user_id: string; consumed_at: string | null; cancelled_at: string | null } | null;
  deletionFetchError: unknown;
  profileRow: { pending_deletion_at: string | null } | null;
  profileUpdateError: unknown;
  requestUpdateCalls: number;
} = {
  deletionRow: null,
  deletionFetchError: null,
  profileRow: null,
  profileUpdateError: null,
  requestUpdateCalls: 0,
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === 'account_deletion_requests') {
        return {
          select() {
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: state.deletionRow,
                  error: state.deletionFetchError,
                }),
              }),
            };
          },
          update() {
            state.requestUpdateCalls += 1;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq: () => ({
                single: async () => ({
                  data: state.profileRow,
                  error: null,
                }),
              }),
            };
          },
          update() {
            return {
              eq: async () => ({ error: state.profileUpdateError }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { GET } from './route';

function callGet(token: string) {
  const url = `http://localhost:3000/auth/account/${token}/confirm-delete`;
  return GET(new NextRequest(url), {
    params: Promise.resolve({ token }),
  });
}

const VALID_TOKEN = 'A'.repeat(43);

describe('GET /auth/account/[token]/confirm-delete', () => {
  beforeEach(() => {
    state.deletionRow = null;
    state.deletionFetchError = null;
    state.profileRow = null;
    state.profileUpdateError = null;
    state.requestUpdateCalls = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the 404 landing for a malformed token', async () => {
    const res = await callGet('not-a-valid-token');
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toMatch(/This link is not valid/);
  });

  it('renders the 404 landing when the token does not exist', async () => {
    state.deletionRow = null;
    const res = await callGet(VALID_TOKEN);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toMatch(/This link is not valid/);
  });

  it('renders the cancelled landing when cancelled_at is set', async () => {
    state.deletionRow = {
      id: 'row-1',
      user_id: 'u-1',
      consumed_at: null,
      cancelled_at: '2026-05-24T12:00:00.000Z',
    };
    const res = await callGet(VALID_TOKEN);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/cancelled/i);
  });

  it('renders the already-scheduled landing when consumed_at is set', async () => {
    state.deletionRow = {
      id: 'row-1',
      user_id: 'u-1',
      consumed_at: '2026-05-24T12:00:00.000Z',
      cancelled_at: null,
    };
    state.profileRow = { pending_deletion_at: '2026-05-24T12:00:00.000Z' };

    const res = await callGet(VALID_TOKEN);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/Already scheduled/i);
    // No mutation on re-click.
    expect(state.requestUpdateCalls).toBe(0);
  });

  it('mutates state and renders the scheduled landing on a fresh token', async () => {
    state.deletionRow = {
      id: 'row-1',
      user_id: 'u-1',
      consumed_at: null,
      cancelled_at: null,
    };

    const res = await callGet(VALID_TOKEN);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/Deletion scheduled/);
    // The request row was updated (consumed_at = NOW()).
    expect(state.requestUpdateCalls).toBe(1);
  });
});
