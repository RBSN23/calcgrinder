import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyOtp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { verifyOtp },
  })),
}));

import { GET } from './route';

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe('/auth/confirm GET handler', () => {
  beforeEach(() => {
    verifyOtp.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('type=signup + valid token_hash → verifyOtp called with right params + redirect to /auth/waiting-for-approval', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null });

    const res = await GET(
      makeRequest('http://localhost:3000/auth/confirm?token_hash=abc&type=signup'),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'signup', token_hash: 'abc' });
    expect(res.status).toBe(307); // Next default for NextResponse.redirect
    expect(res.headers.get('location')).toMatch(/\/auth\/waiting-for-approval$/);
  });

  it('type=recovery + valid token_hash → verifyOtp called + redirect to next (default /auth/reset-password)', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null });

    const res = await GET(
      makeRequest(
        'http://localhost:3000/auth/confirm?token_hash=xyz&type=recovery',
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'xyz' });
    expect(res.headers.get('location')).toMatch(/\/auth\/reset-password$/);
  });

  it('type=recovery with explicit next param → respects next', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null });

    const res = await GET(
      makeRequest(
        'http://localhost:3000/auth/confirm?token_hash=xyz&type=recovery&next=/auth/reset-password',
      ),
    );

    expect(res.headers.get('location')).toMatch(/\/auth\/reset-password$/);
  });

  it('verifyOtp throws (expired / consumed token) → redirect to /auth/login?error=link_invalid', async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: 'expired' } });

    const res = await GET(
      makeRequest(
        'http://localhost:3000/auth/confirm?token_hash=expired&type=signup',
      ),
    );

    const loc = res.headers.get('location') ?? '';
    expect(loc).toMatch(/\/auth\/login/);
    expect(loc).toMatch(/error=link_invalid/);
  });

  it('missing token_hash → /auth/login?error=link_invalid + no verifyOtp call', async () => {
    const res = await GET(
      makeRequest('http://localhost:3000/auth/confirm?type=signup'),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    const loc = res.headers.get('location') ?? '';
    expect(loc).toMatch(/\/auth\/login/);
    expect(loc).toMatch(/error=link_invalid/);
  });

  it('unknown type → /auth/login?error=link_invalid + no verifyOtp call', async () => {
    const res = await GET(
      makeRequest(
        'http://localhost:3000/auth/confirm?token_hash=abc&type=bogus',
      ),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    const loc = res.headers.get('location') ?? '';
    expect(loc).toMatch(/error=link_invalid/);
  });

  it('type=email_change + valid token_hash → verifyOtp called + redirect to /auth/email-confirmed', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null });

    const res = await GET(
      makeRequest(
        'http://localhost:3000/auth/confirm?token_hash=ec&type=email_change',
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'email_change',
      token_hash: 'ec',
    });
    expect(res.headers.get('location')).toMatch(/\/auth\/email-confirmed$/);
  });

  it('type=email_change + verifyOtp error → redirect to /auth/login?error=link_invalid', async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: 'expired' } });

    const res = await GET(
      makeRequest(
        'http://localhost:3000/auth/confirm?token_hash=bad&type=email_change',
      ),
    );

    const loc = res.headers.get('location') ?? '';
    expect(loc).toMatch(/\/auth\/login/);
    expect(loc).toMatch(/error=link_invalid/);
  });

  it('next= containing a scheme is rejected (open-redirect guard)', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null });

    const res = await GET(
      makeRequest(
        'http://localhost:3000/auth/confirm?token_hash=abc&type=signup&next=//evil.example',
      ),
    );

    // Falls back to the default for signup.
    expect(res.headers.get('location')).toMatch(/\/auth\/waiting-for-approval$/);
  });
});
