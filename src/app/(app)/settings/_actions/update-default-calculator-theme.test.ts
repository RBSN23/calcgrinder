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
          return { eq: async () => ({ error: state.error ?? null }) };
        },
      };
    },
  }),
}));

import { updateDefaultCalculatorThemeAction } from './update-default-calculator-theme';

const APPROVED = {
  user: { id: 'u-1', email: 'a@example.com' },
  profile: { id: 'u-1', status: 'approved' },
};

describe('updateDefaultCalculatorThemeAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    state.lastPatch = undefined;
    state.error = undefined;
  });
  afterEach(() => vi.restoreAllMocks());

  it('writes a valid theme id on the happy path', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await updateDefaultCalculatorThemeAction('terminal');

    expect(result).toEqual({ ok: true, message: 'Saved' });
    expect(state.lastPatch).toEqual({ default_calculator_theme: 'terminal' });
  });

  it('rejects an unknown theme id', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await updateDefaultCalculatorThemeAction('not-a-real-theme');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Unknown theme/);
    }
    expect(state.lastPatch).toBeUndefined();
  });

  it('refuses to write when the user is not approved', async () => {
    getCurrentProfile.mockResolvedValue({
      ...APPROVED,
      profile: { ...APPROVED.profile, status: 'pending_deletion' },
    });

    const result = await updateDefaultCalculatorThemeAction('terminal');

    expect(result.ok).toBe(false);
    expect(state.lastPatch).toBeUndefined();
  });

  it('returns generic error when the DB write fails', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    state.error = { message: 'db down' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await updateDefaultCalculatorThemeAction('terminal');

    expect(result).toEqual({ ok: false, error: "Couldn't save — try again." });
    expect(errorSpy).toHaveBeenCalled();
  });
});
