import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NEXT_REDIRECT = Symbol('next-redirect');
class RedirectError extends Error {
  destination: string;
  constructor(destination: string) {
    super('NEXT_REDIRECT');
    this.destination = destination;
    (this as unknown as { [k: symbol]: unknown })[NEXT_REDIRECT] = true;
  }
}
vi.mock('next/navigation', () => ({
  redirect: (dest: string) => {
    throw new RedirectError(dest);
  },
}));

const getCurrentProfile = vi.fn();
vi.mock('@/lib/auth/getCurrentProfile', () => ({
  getCurrentProfile: () => getCurrentProfile(),
}));

const state: {
  profileUpdateError: unknown;
  requestUpdateCalls: number;
} = {
  profileUpdateError: null,
  requestUpdateCalls: 0,
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === 'profiles') {
        return {
          update() {
            return {
              eq: async () => ({ error: state.profileUpdateError }),
            };
          },
        };
      }
      if (table === 'account_deletion_requests') {
        return {
          update() {
            state.requestUpdateCalls += 1;
            return {
              eq: () => ({
                is: async () => ({ error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { cancelDeletionAction } from './actions';

async function caught(fn: () => Promise<unknown>): Promise<RedirectError | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof RedirectError) return e;
    throw e;
  }
}

describe('cancelDeletionAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    state.profileUpdateError = null;
    state.requestUpdateCalls = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it('redirects unauthenticated callers to /auth/login', async () => {
    getCurrentProfile.mockResolvedValue(null);

    const r = await caught(() => cancelDeletionAction());

    expect(r?.destination).toBe('/auth/login');
    expect(state.requestUpdateCalls).toBe(0);
  });

  it('redirects approved users back to /dashboard without mutating', async () => {
    getCurrentProfile.mockResolvedValue({
      user: { id: 'u-1', email: 'a@b.com' },
      profile: { id: 'u-1', status: 'approved' },
    });

    const r = await caught(() => cancelDeletionAction());

    expect(r?.destination).toBe('/dashboard');
    expect(state.requestUpdateCalls).toBe(0);
  });

  it('reverts status + clears pending_deletion_at + stamps cancelled_at + redirects', async () => {
    getCurrentProfile.mockResolvedValue({
      user: { id: 'u-1', email: 'a@b.com' },
      profile: { id: 'u-1', status: 'pending_deletion' },
    });

    const r = await caught(() => cancelDeletionAction());

    expect(r?.destination).toContain('/dashboard');
    expect(r?.destination).toContain('cancelled_deletion=1');
    expect(state.requestUpdateCalls).toBe(1);
  });

  it('logs and returns silently when the profile revert fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getCurrentProfile.mockResolvedValue({
      user: { id: 'u-1', email: 'a@b.com' },
      profile: { id: 'u-1', status: 'pending_deletion' },
    });
    state.profileUpdateError = { message: 'db down' };

    const r = await caught(() => cancelDeletionAction());

    expect(r).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    expect(state.requestUpdateCalls).toBe(0);
  });
});
