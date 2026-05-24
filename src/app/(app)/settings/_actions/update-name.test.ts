import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const getCurrentProfile = vi.fn();
vi.mock('@/lib/auth/getCurrentProfile', () => ({
  getCurrentProfile: () => getCurrentProfile(),
}));

const state: { lastPatch?: unknown; error?: unknown } = {};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table !== 'profiles') throw new Error(`unexpected ${table}`);
      return {
        update(patch: unknown) {
          state.lastPatch = patch;
          return {
            eq: async () => ({ error: state.error ?? null }),
          };
        },
      };
    },
  }),
}));

import { updateNameAction } from './update-name';

const APPROVED = {
  user: { id: 'u-1', email: 'a@example.com' },
  profile: { id: 'u-1', status: 'approved', name: '' },
};

describe('updateNameAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    state.lastPatch = undefined;
    state.error = undefined;
  });
  afterEach(() => vi.restoreAllMocks());

  it('writes a trimmed name and returns Saved on the happy path', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await updateNameAction('  Jane Doe  ');

    expect(result).toEqual({ ok: true, message: 'Saved' });
    expect(state.lastPatch).toEqual({ name: 'Jane Doe' });
  });

  it('rejects names containing line breaks', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await updateNameAction('Jane\nDoe');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/line breaks or control characters/);
    }
    expect(state.lastPatch).toBeUndefined();
  });

  it('rejects names over 80 characters', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await updateNameAction('x'.repeat(81));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/80 characters or fewer/);
    }
  });

  it('surfaces a generic error when the DB write fails', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    state.error = { message: 'db down' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await updateNameAction('Jane');

    expect(result).toEqual({ ok: false, error: "Couldn't save — try again." });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('refuses to write when the user is not approved', async () => {
    getCurrentProfile.mockResolvedValue({
      ...APPROVED,
      profile: { ...APPROVED.profile, status: 'pending_deletion' },
    });

    const result = await updateNameAction('Jane');

    expect(result.ok).toBe(false);
    expect(state.lastPatch).toBeUndefined();
  });
});
