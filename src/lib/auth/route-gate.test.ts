import { describe, expect, it } from 'vitest';

import { routeGate, type RouteGateAuth } from './route-gate';

const ANON: RouteGateAuth = null;
const PENDING: RouteGateAuth = { status: 'pending' };
const DECLINED: RouteGateAuth = { status: 'declined' };
const APPROVED: RouteGateAuth = { status: 'approved' };

describe('routeGate — the 15-case acceptance matrix', () => {
  // 1. anonymous browser × /dashboard → 302 /auth/login?next=/dashboard
  it('anonymous on /dashboard → /auth/login?next=/dashboard', () => {
    expect(routeGate('/dashboard', ANON)).toEqual({
      kind: 'redirect',
      to: '/auth/login?next=%2Fdashboard',
    });
  });

  // 2. anonymous × /editor/abc → 302 /auth/login?next=/editor/abc
  it('anonymous on /editor/abc → /auth/login?next=/editor/abc', () => {
    expect(routeGate('/editor/abc', ANON)).toEqual({
      kind: 'redirect',
      to: '/auth/login?next=%2Feditor%2Fabc',
    });
  });

  // 3. anonymous × /settings → 302 /auth/login?next=/settings
  it('anonymous on /settings → /auth/login?next=/settings', () => {
    expect(routeGate('/settings', ANON)).toEqual({
      kind: 'redirect',
      to: '/auth/login?next=%2Fsettings',
    });
  });

  // 4. anonymous × /c/<token> → no redirect
  it('anonymous on /c/abc → pass', () => {
    expect(routeGate('/c/abc', ANON)).toEqual({ kind: 'pass' });
  });

  // 5. anonymous × /auth/admin/<token>/approve → no redirect
  it('anonymous on /auth/admin/<token>/approve → pass', () => {
    expect(routeGate('/auth/admin/xyz/approve', ANON)).toEqual({
      kind: 'pass',
    });
  });

  // 6. anonymous × /auth/confirm → no redirect
  it('anonymous on /auth/confirm → pass', () => {
    expect(routeGate('/auth/confirm', ANON)).toEqual({ kind: 'pass' });
  });

  // 7. anonymous × /auth/login → no redirect
  it('anonymous on /auth/login → pass', () => {
    expect(routeGate('/auth/login', ANON)).toEqual({ kind: 'pass' });
  });

  // 8. pending × /dashboard → 302 /auth/waiting-for-approval
  it('pending on /dashboard → /auth/waiting-for-approval', () => {
    expect(routeGate('/dashboard', PENDING)).toEqual({
      kind: 'redirect',
      to: '/auth/waiting-for-approval',
    });
  });

  // 9. declined × /dashboard → 302 /auth/waiting-for-approval
  it('declined on /dashboard → /auth/waiting-for-approval (identical to pending)', () => {
    expect(routeGate('/dashboard', DECLINED)).toEqual({
      kind: 'redirect',
      to: '/auth/waiting-for-approval',
    });
  });

  // 10. pending × /auth/login → 302 /auth/waiting-for-approval
  it('pending on /auth/login → /auth/waiting-for-approval', () => {
    expect(routeGate('/auth/login', PENDING)).toEqual({
      kind: 'redirect',
      to: '/auth/waiting-for-approval',
    });
  });

  // 11. pending × /auth/waiting-for-approval → no redirect
  it('pending on /auth/waiting-for-approval → pass', () => {
    expect(routeGate('/auth/waiting-for-approval', PENDING)).toEqual({
      kind: 'pass',
    });
  });

  // 12. approved × /auth/login → 302 /dashboard
  it('approved on /auth/login → /dashboard', () => {
    expect(routeGate('/auth/login', APPROVED)).toEqual({
      kind: 'redirect',
      to: '/dashboard',
    });
  });

  // 13. approved × /auth/signup → 302 /dashboard
  it('approved on /auth/signup → /dashboard', () => {
    expect(routeGate('/auth/signup', APPROVED)).toEqual({
      kind: 'redirect',
      to: '/dashboard',
    });
  });

  // 14. approved × /auth/waiting-for-approval → 302 /dashboard
  it('approved on /auth/waiting-for-approval → /dashboard', () => {
    expect(routeGate('/auth/waiting-for-approval', APPROVED)).toEqual({
      kind: 'redirect',
      to: '/dashboard',
    });
  });

  // 15. approved × /dashboard → no redirect
  it('approved on /dashboard → pass', () => {
    expect(routeGate('/dashboard', APPROVED)).toEqual({ kind: 'pass' });
  });
});

describe('routeGate — extra public-path bypasses', () => {
  it.each([
    '/_next/static/chunk.js',
    '/favicon.ico',
    '/auth/sign-out',
    '/api/cron/purge',
  ])('any auth state on %s → pass', (path) => {
    expect(routeGate(path, ANON)).toEqual({ kind: 'pass' });
    expect(routeGate(path, PENDING)).toEqual({ kind: 'pass' });
    expect(routeGate(path, APPROVED)).toEqual({ kind: 'pass' });
  });
});

describe('routeGate — private API surface', () => {
  it('anonymous on /api/calculators → /auth/login?next=/api/calculators', () => {
    expect(routeGate('/api/calculators', ANON)).toEqual({
      kind: 'redirect',
      to: '/auth/login?next=%2Fapi%2Fcalculators',
    });
  });
});
