import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/auth/app-url', () => ({
  APP_URL: 'http://localhost:3000',
}));
vi.mock('@/lib/auth/token', () => ({
  randomToken: () => 'fixed-token-43-chars-aaaaaaaaaaaaaaaaaaaaaa',
}));

type SendMailArg = { to: string; subject: string; text: string };
const sendMail = vi.fn<(arg: SendMailArg) => Promise<void>>();
vi.mock('@/lib/email/send', () => ({
  sendMail: (arg: SendMailArg) => sendMail(arg),
}));
vi.mock('@/lib/email/templates', () => ({
  accountDeletionConfirmation: (input: unknown) => ({
    subject: 'Confirm deletion',
    text: JSON.stringify(input),
  }),
}));

const getCurrentProfile = vi.fn();
vi.mock('@/lib/auth/getCurrentProfile', () => ({
  getCurrentProfile: () => getCurrentProfile(),
}));

const state: {
  upsertResult: { data: unknown; error: unknown };
  selectResult: { data: unknown; error: unknown };
  updateResult: { error: unknown };
  deleteCalls: number;
  upsertCalls: unknown[];
} = {
  upsertResult: { data: { id: 'row-1' }, error: null },
  selectResult: { data: null, error: null },
  updateResult: { error: null },
  deleteCalls: 0,
  upsertCalls: [],
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table !== 'account_deletion_requests') {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        upsert(payload: unknown) {
          state.upsertCalls.push(payload);
          return {
            select: () => ({
              single: async () => state.upsertResult,
            }),
          };
        },
        select() {
          return {
            eq: () => ({
              maybeSingle: async () => state.selectResult,
            }),
          };
        },
        update() {
          return {
            eq: () => ({
              is: () => ({
                is: async () => state.updateResult,
              }),
            }),
          };
        },
        delete() {
          state.deleteCalls += 1;
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
    },
  }),
}));

import {
  requestDeletionAction,
  resendDeletionAction,
  cancelPendingDeletionAction,
} from './request-deletion';

const APPROVED = {
  user: { id: 'u-1', email: 'user@example.com' },
  profile: { id: 'u-1', status: 'approved', role: 'registered', name: 'Jane' },
};
const SYSADMIN = {
  user: { id: 'u-2', email: 'admin@example.com' },
  profile: { id: 'u-2', status: 'approved', role: 'sysadmin', name: 'Admin' },
};

describe('requestDeletionAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    sendMail.mockReset();
    state.upsertResult = { data: { id: 'row-1' }, error: null };
    state.selectResult = { data: null, error: null };
    state.updateResult = { error: null };
    state.deleteCalls = 0;
    state.upsertCalls = [];
  });
  afterEach(() => vi.restoreAllMocks());

  it('upserts a token and sends the confirmation email on the happy path', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    sendMail.mockResolvedValue(undefined);

    const result = await requestDeletionAction();

    expect(result).toEqual({ ok: true });
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0]).toMatchObject({
      user_id: 'u-1',
      consumed_at: null,
      cancelled_at: null,
    });
    expect(sendMail).toHaveBeenCalled();
    const mailArg = sendMail.mock.calls.at(0)?.[0] as SendMailArg;
    expect(mailArg.to).toBe('user@example.com');
    expect(mailArg.text).toContain('fixed-token-43-chars');
  });

  it('returns 403-equivalent with the spec discriminator and writes nothing for sysadmin callers', async () => {
    getCurrentProfile.mockResolvedValue(SYSADMIN);

    const result = await requestDeletionAction();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('sysadmin_self_delete_forbidden');
      expect(result.message).toMatch(/Sysadmin/);
    }
    expect(state.upsertCalls).toHaveLength(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rolls back the row when sendMail throws', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    sendMail.mockRejectedValue(new Error('cyon down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await requestDeletionAction();

    expect(result.ok).toBe(false);
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.deleteCalls).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns a generic error when the upsert itself fails', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    state.upsertResult = { data: null, error: { message: 'db down' } };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await requestDeletionAction();

    expect(result.ok).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('resendDeletionAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    sendMail.mockReset();
    state.selectResult = { data: null, error: null };
  });

  it('resends the same token when an un-consumed row exists', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    state.selectResult = {
      data: { token: 'prev-token-43', consumed_at: null, cancelled_at: null },
      error: null,
    };
    sendMail.mockResolvedValue(undefined);

    const result = await resendDeletionAction();

    expect(result).toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalled();
    const mailArg = sendMail.mock.calls.at(0)?.[0] as SendMailArg;
    expect(mailArg.text).toContain('prev-token-43');
  });

  it('refuses when no pending row exists', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);
    state.selectResult = { data: null, error: null };

    const result = await resendDeletionAction();

    expect(result.ok).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('cancelPendingDeletionAction', () => {
  beforeEach(() => {
    getCurrentProfile.mockReset();
    state.updateResult = { error: null };
  });

  it('stamps cancelled_at on the user\'s pending row', async () => {
    getCurrentProfile.mockResolvedValue(APPROVED);

    const result = await cancelPendingDeletionAction();

    expect(result).toEqual({ ok: true });
  });

  it('refuses to write when the user is not approved', async () => {
    getCurrentProfile.mockResolvedValue({
      ...APPROVED,
      profile: { ...APPROVED.profile, status: 'pending_deletion' },
    });

    const result = await cancelPendingDeletionAction();

    expect(result.ok).toBe(false);
  });
});
