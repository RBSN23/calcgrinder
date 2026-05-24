import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock `next/navigation` so `redirect()` doesn't actually navigate;
// surface the destination via a custom error type for assertions.
class RedirectError extends Error {
  destination: string;
  constructor(destination: string) {
    super('NEXT_REDIRECT');
    this.destination = destination;
  }
}
vi.mock('next/navigation', () => ({
  redirect: (dest: string) => {
    throw new RedirectError(dest);
  },
}));

// Admin client probe (the H1 fix moved this from the SSR client to the
// admin client because RLS denies anon SELECT on profiles).
const adminProfileProbe = {
  result: { data: null as unknown, error: null as unknown },
};

// SSR client tracks the signInWithPassword response + the post-success
// profiles SELECT (for the approved-vs-pending status branch).
const ssrAuth = {
  signInResponse: {
    data: {
      session: null as null | { access_token: string },
      user: { id: 'u-1' } as { id: string },
    },
    error: null as unknown,
  },
  // Post-sign-in status read (the action calls this on success).
  profileStatusResult: { data: { status: 'approved' } as { status: string } | null },
};

function makeAdminClient() {
  return {
    from(table: string) {
      if (table !== 'profiles') throw new Error(`unexpected admin table ${table}`);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => adminProfileProbe.result,
      };
    },
  };
}

function makeSsrClient() {
  return {
    auth: {
      signInWithPassword: vi.fn(async () => ssrAuth.signInResponse),
    },
    from(table: string) {
      if (table !== 'profiles') throw new Error(`unexpected ssr table ${table}`);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ssrAuth.profileStatusResult,
      };
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

// Module under test loads AFTER the mocks above.
import { loginAction } from './actions';

function makeFormData(values: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

beforeEach(() => {
  adminProfileProbe.result = { data: null, error: null };
  ssrAuth.signInResponse = {
    data: {
      session: { access_token: 'tok' },
      user: { id: 'u-1' },
    },
    error: null,
  };
  ssrAuth.profileStatusResult = { data: { status: 'approved' } };
  adminClient.mockClear();
  ssrClient.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loginAction — happy paths', () => {
  it('approved user → redirect to next (defaults to /dashboard)', async () => {
    let dest: string | null = null;
    try {
      await loginAction(
        { ok: false },
        makeFormData({ email: 'alice@example.com', password: 'pw' }),
      );
    } catch (err) {
      if (err instanceof RedirectError) dest = err.destination;
      else throw err;
    }
    expect(dest).toBe('/dashboard');
  });

  it('approved user with a safe `next` param → redirect honours next', async () => {
    let dest: string | null = null;
    try {
      await loginAction(
        { ok: false },
        makeFormData({
          email: 'alice@example.com',
          password: 'pw',
          next: '/editor/abc',
        }),
      );
    } catch (err) {
      if (err instanceof RedirectError) dest = err.destination;
      else throw err;
    }
    expect(dest).toBe('/editor/abc');
  });

  it('approved user with an open-redirect `next` (//evil.com) → falls back to /dashboard', async () => {
    let dest: string | null = null;
    try {
      await loginAction(
        { ok: false },
        makeFormData({
          email: 'alice@example.com',
          password: 'pw',
          next: '//evil.com',
        }),
      );
    } catch (err) {
      if (err instanceof RedirectError) dest = err.destination;
      else throw err;
    }
    expect(dest).toBe('/dashboard');
  });

  it('pending user → redirect to /auth/waiting-for-approval', async () => {
    ssrAuth.profileStatusResult = { data: { status: 'pending' } };
    let dest: string | null = null;
    try {
      await loginAction(
        { ok: false },
        makeFormData({ email: 'alice@example.com', password: 'pw' }),
      );
    } catch (err) {
      if (err instanceof RedirectError) dest = err.destination;
      else throw err;
    }
    expect(dest).toBe('/auth/waiting-for-approval');
  });

  it('declined user → redirect to /auth/waiting-for-approval (silent)', async () => {
    ssrAuth.profileStatusResult = { data: { status: 'declined' } };
    let dest: string | null = null;
    try {
      await loginAction(
        { ok: false },
        makeFormData({ email: 'alice@example.com', password: 'pw' }),
      );
    } catch (err) {
      if (err instanceof RedirectError) dest = err.destination;
      else throw err;
    }
    expect(dest).toBe('/auth/waiting-for-approval');
  });

  // PROJ-14 QA BUG-M2 regression — pending_deletion users must land on
  // /auth/cancel-deletion directly, not on /auth/waiting-for-approval
  // (which previously relied on the (auth) layout's route-gate to
  // re-bounce).
  it('pending_deletion user → redirect to /auth/cancel-deletion', async () => {
    ssrAuth.profileStatusResult = { data: { status: 'pending_deletion' } };
    let dest: string | null = null;
    try {
      await loginAction(
        { ok: false },
        makeFormData({ email: 'alice@example.com', password: 'pw' }),
      );
    } catch (err) {
      if (err instanceof RedirectError) dest = err.destination;
      else throw err;
    }
    expect(dest).toBe('/auth/cancel-deletion');
  });
});

describe('loginAction — invalid_credentials branching (H1 regression)', () => {
  it('unknown email (admin probe returns null) → "No account exists." + Sign up link', async () => {
    ssrAuth.signInResponse = {
      data: { session: null, user: { id: '' } },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    };
    adminProfileProbe.result = { data: null, error: null };

    const result = await loginAction(
      { ok: false },
      makeFormData({ email: 'ghost@example.com', password: 'whatever' }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no account exists/i);
    expect(result.errorLink).toEqual({ href: '/auth/signup', label: 'Sign up' });
  });

  it('known email + wrong password (admin probe returns a row) → "Wrong password." + Forgot password link', async () => {
    ssrAuth.signInResponse = {
      data: { session: null, user: { id: '' } },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    };
    adminProfileProbe.result = { data: { id: 'u-existing' }, error: null };

    const result = await loginAction(
      { ok: false },
      makeFormData({ email: 'alice@example.com', password: 'wrong' }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/wrong password/i);
    expect(result.errorLink).toEqual({
      href: '/auth/forgot-password',
      label: 'Forgot password?',
    });
  });
});

describe('loginAction — other error states', () => {
  it('email_not_confirmed → "Please confirm your email first." (no errorLink)', async () => {
    ssrAuth.signInResponse = {
      data: { session: null, user: { id: '' } },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    };

    const result = await loginAction(
      { ok: false },
      makeFormData({ email: 'a@b.com', password: 'pw' }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/confirm your email/i);
  });

  it('Zod validation (empty fields) → fieldErrors, no Supabase call', async () => {
    const result = await loginAction(
      { ok: false },
      makeFormData({ email: '', password: '' }),
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors).toBeTruthy();
    expect(Object.keys(result.fieldErrors ?? {}).length).toBeGreaterThan(0);
    expect(ssrClient).not.toHaveBeenCalled();
  });

  it('unexpected Supabase error → surfaces the message verbatim', async () => {
    ssrAuth.signInResponse = {
      data: { session: null, user: { id: '' } },
      error: { code: 'over_request_rate_limit', message: 'too many attempts' },
    };

    const result = await loginAction(
      { ok: false },
      makeFormData({ email: 'a@b.com', password: 'pw' }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('too many attempts');
  });
});
