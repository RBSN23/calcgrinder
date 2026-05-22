import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock `next/navigation` so `redirect()` doesn't actually navigate;
// it normally throws a NEXT_REDIRECT signal that we surface explicitly.
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

// Mock APP_URL so the module-load Zod check passes regardless of test env.
vi.mock('@/lib/auth/app-url', () => ({
  APP_URL: 'http://localhost:3000',
  appUrl: (p: string) => `http://localhost:3000${p}`,
}));

// Mock the email layer. Tests assert the call shape.
const sendMail = vi.fn(async () => undefined);
vi.mock('@/lib/email/send', () => ({
  sendMail: (...args: unknown[]) => sendMail(...args),
}));
vi.mock('@/lib/email/templates', () => ({
  signupNotification: vi.fn((input) => ({
    subject: `New Calcgrinder signup — ${input.newUserEmail}`,
    text: `name=${input.newUserName} email=${input.newUserEmail}\n${input.approveUrl}\n${input.declineUrl}`,
  })),
}));

// Mock the Supabase clients.
const adminProfiles = {
  maybeSingleResult: { data: null, error: null } as { data: unknown; error: unknown },
  updateError: null as unknown,
  insertError: null as unknown,
};
const ssrAuthResult = {
  data: { user: { id: 'u-fresh' } as { id: string } | null },
  error: null as unknown,
};

function makeAdminClient() {
  return {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => adminProfiles.maybeSingleResult,
          update() {
            return {
              eq: async () => ({ error: adminProfiles.updateError }),
            };
          },
        };
      }
      if (table === 'signup_approvals') {
        return {
          insert: async () => ({ error: adminProfiles.insertError }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function makeSsrClient() {
  return {
    auth: {
      signUp: vi.fn(async () => ({ data: ssrAuthResult.data, error: null })),
    },
  };
}

const adminClient = vi.fn(() => makeAdminClient());
const ssrClient = vi.fn(async () => makeSsrClient());

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => adminClient(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ssrClient(),
}));

// Module under test is loaded AFTER mocks above.
import { signupAction } from './actions';

function makeFormData(values: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

beforeEach(() => {
  process.env.SYSADMIN_NOTIFICATION_EMAIL = 'notifications@example.com';
  adminProfiles.maybeSingleResult = { data: null, error: null };
  adminProfiles.updateError = null;
  adminProfiles.insertError = null;
  ssrAuthResult.data = { user: { id: 'u-fresh' } };
  sendMail.mockClear();
  adminClient.mockClear();
  ssrClient.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signupAction', () => {
  it('happy path → auth user + profile update + approval row + notification mail + redirect', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let redirectDest: string | null = null;
    try {
      await signupAction(
        { ok: false },
        makeFormData({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'correct horse battery staple',
        }),
      );
    } catch (err) {
      if (err instanceof RedirectError) redirectDest = err.destination;
      else throw err;
    }

    expect(redirectDest).toMatch(
      /^\/auth\/sent-confirmation\?type=signup&email=alice%40example\.com$/,
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'notifications@example.com',
        subject: expect.stringContaining('alice@example.com'),
        text: expect.stringContaining('/auth/admin/'),
      }),
    );
    consoleSpy.mockRestore();
  });

  it('existing-email conflict → returns 422-equivalent banner without redirect, no Supabase signUp call', async () => {
    adminProfiles.maybeSingleResult = { data: { id: 'u-exists' }, error: null };

    const result = await signupAction(
      { ok: false },
      makeFormData({
        name: 'Bob',
        email: 'bob@example.com',
        password: 'correct horse battery staple',
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already exists/i);
    expect(result.errorLink).toEqual({ href: '/auth/login', label: 'Sign in' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('Zod validation fail (empty fields) → fieldErrors without Supabase call', async () => {
    const result = await signupAction(
      { ok: false },
      makeFormData({ name: '', email: '', password: '' }),
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors).toBeTruthy();
    expect(Object.keys(result.fieldErrors ?? {}).length).toBeGreaterThan(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('Zod validation fail (invalid email format) → fieldErrors.email', async () => {
    const result = await signupAction(
      { ok: false },
      makeFormData({ name: 'Cara', email: 'not-an-email', password: 'x' }),
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.email).toMatch(/valid email/i);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('notification sendMail() throw → signup is preserved, console.error fires, redirect still happens', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMail.mockRejectedValueOnce(new Error('Cyon 421'));

    let redirectDest: string | null = null;
    try {
      await signupAction(
        { ok: false },
        makeFormData({
          name: 'Dan',
          email: 'dan@example.com',
          password: 'correct horse battery staple',
        }),
      );
    } catch (err) {
      if (err instanceof RedirectError) redirectDest = err.destination;
      else throw err;
    }

    expect(redirectDest).toMatch(/^\/auth\/sent-confirmation\?type=signup/);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('signup-form name with control characters is stripped before reaching sendMail (PROJ-2 L1)', async () => {
    let redirectDest: string | null = null;
    try {
      await signupAction(
        { ok: false },
        makeFormData({
          name: 'Eve\r\nBcc: attacker@example.com',
          email: 'eve@example.com',
          password: 'correct horse battery staple',
        }),
      );
    } catch (err) {
      if (err instanceof RedirectError) redirectDest = err.destination;
    }

    expect(redirectDest).toMatch(/^\/auth\/sent-confirmation/);
    expect(sendMail).toHaveBeenCalled();
    const callArgs = sendMail.mock.calls[0]?.[0] as { text: string };
    // The stripped name appears inside the `name=` segment of the text;
    // pull it out and confirm no \r or \n remain — that is the actual
    // injection vector. (The literal substring "Bcc:" is not itself
    // dangerous; only embedded newlines can rewrite headers.)
    const nameSegment = /name=([^\n]*) email=/.exec(callArgs.text)?.[1] ?? '';
    expect(nameSegment).not.toMatch(/[\r\n\x00-\x1F\x7F]/);
  });
});
