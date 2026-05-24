import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/auth/app-url', () => ({
  appUrl: (p: string) => `http://localhost:3000${p}`,
}));

const getCurrentProfile = vi.fn();
vi.mock('@/lib/auth/getCurrentProfile', () => ({
  getCurrentProfile: () => getCurrentProfile(),
}));

const clearPendingEmailChange = vi.fn<(userId: string) => Promise<void>>();
vi.mock('@/lib/auth/email-change', () => ({
  clearPendingEmailChange: (userId: string) => clearPendingEmailChange(userId),
}));

const updateUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { updateUser: (...args: unknown[]) => updateUser(...args) },
  }),
}));

import { updateEmailAction, cancelEmailChangeAction } from './update-email';

const APPROVED = {
  user: { id: 'u-1', email: 'old@example.com' },
  profile: { id: 'u-1', status: 'approved', name: 'Jane' },
};

describe('updateEmailAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    updateUser.mockReset();
    clearPendingEmailChange.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('calls supabase.auth.updateUser with the new email on the happy path', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    updateUser.mockResolvedValue({ data: null, error: null });

    const result = await updateEmailAction('new@example.com');

    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith(
      { email: 'new@example.com' },
      expect.objectContaining({
        emailRedirectTo: expect.stringContaining('type=email_change'),
      }),
    );
  });

  it('is a silent no-op when the new email equals the current email', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await updateEmailAction('OLD@example.com');

    expect(result).toEqual({ ok: true });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('rejects a syntactically invalid email without calling Supabase', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await updateEmailAction('not-an-email');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid email/);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('surfaces the "already exists" error verbatim on duplicate email', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    updateUser.mockResolvedValue({
      data: null,
      error: { code: 'email_exists', message: 'Email already in use' },
    });

    const result = await updateEmailAction('taken@example.com');

    expect(result).toEqual({
      ok: false,
      error: 'An account with this email already exists.',
    });
  });

  it('returns the generic error when updateUser throws an unknown error', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    updateUser.mockResolvedValue({
      data: null,
      error: { message: 'server exploded' },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await updateEmailAction('new@example.com');

    expect(result).toEqual({ ok: false, error: "Couldn't update — try again." });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('cancelEmailChangeAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    clearPendingEmailChange.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('calls clearPendingEmailChange on the happy path', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    clearPendingEmailChange.mockResolvedValue(undefined);

    const result = await cancelEmailChangeAction();

    expect(result).toEqual({ ok: true });
    expect(clearPendingEmailChange).toHaveBeenCalledWith('u-1');
  });

  it('surfaces the generic error when the helper throws', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    clearPendingEmailChange.mockRejectedValue(new Error('rpc failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await cancelEmailChangeAction();

    expect(result).toEqual({ ok: false, error: "Couldn't update — try again." });
    expect(errorSpy).toHaveBeenCalled();
  });
});
