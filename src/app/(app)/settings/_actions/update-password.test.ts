import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentProfile = vi.fn();
vi.mock('@/lib/auth/getCurrentProfile', () => ({
  getCurrentProfile: () => getCurrentProfile(),
}));

const sessionUpdateUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      updateUser: (...args: unknown[]) => sessionUpdateUser(...args),
    },
  }),
}));

const verifierSignIn = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => verifierSignIn(...args),
    },
  })),
}));

import { updatePasswordAction } from './update-password';

const APPROVED = {
  user: { id: 'u-1', email: 'user@example.com' },
  profile: { id: 'u-1', status: 'approved' },
};

describe('updatePasswordAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    sessionUpdateUser.mockReset();
    verifierSignIn.mockReset();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects when the new and confirm fields differ before any Supabase call', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await updatePasswordAction({
      currentPassword: 'old-pw',
      newPassword: 'newp1',
      confirmPassword: 'different',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/don't match/i);
      expect(result.fieldErrors?.confirmPassword).toMatch(/don't match/i);
    }
    expect(verifierSignIn).not.toHaveBeenCalled();
    expect(sessionUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects when the current password is wrong', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    verifierSignIn.mockResolvedValue({ error: { message: 'bad credentials' } });

    const result = await updatePasswordAction({
      currentPassword: 'wrong-pw',
      newPassword: 'newp1',
      confirmPassword: 'newp1',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Current password is incorrect.');
      expect(result.fieldErrors?.currentPassword).toBe(
        'Current password is incorrect.',
      );
    }
    expect(sessionUpdateUser).not.toHaveBeenCalled();
  });

  it('surfaces Supabase policy errors verbatim', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    verifierSignIn.mockResolvedValue({ error: null });
    sessionUpdateUser.mockResolvedValue({
      error: { message: 'Password is too short', status: 422 },
    });

    const result = await updatePasswordAction({
      currentPassword: 'old-pw',
      newPassword: 'short',
      confirmPassword: 'short',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Password is too short');
      expect(result.fieldErrors?.newPassword).toBe('Password is too short');
    }
  });

  it('surfaces the 429 rate-limit error verbatim', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    verifierSignIn.mockResolvedValue({ error: null });
    sessionUpdateUser.mockResolvedValue({
      error: { message: 'rate-limited', status: 429 },
    });

    const result = await updatePasswordAction({
      currentPassword: 'old-pw',
      newPassword: 'newp1',
      confirmPassword: 'newp1',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('rate-limited');
  });

  it('rotates the password on the happy path', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    verifierSignIn.mockResolvedValue({ error: null });
    sessionUpdateUser.mockResolvedValue({ error: null });

    const result = await updatePasswordAction({
      currentPassword: 'old-pw',
      newPassword: 'newp1',
      confirmPassword: 'newp1',
    });

    expect(result).toEqual({ ok: true });
    expect(verifierSignIn).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'old-pw',
    });
    expect(sessionUpdateUser).toHaveBeenCalledWith({ password: 'newp1' });
  });
});
