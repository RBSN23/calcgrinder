import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * PROJ-11 — Per-IP page-load rate limit for the anonymous /c/<token>
 * visitor surface.
 *
 * Policy:
 *   - Sliding window, 60 requests per 60 seconds per IP.
 *   - Backed by Upstash Redis (REST API; edge-runtime compatible).
 *   - Fail OPEN on any limiter error or missing env: the visitor sees
 *     the calculator, not a 429. Per spec — visibility trumps strict
 *     gating at v1's scale.
 *
 * Used by `src/middleware.ts` on the `/c/:token*` matcher only. PROJ-3's
 * login rate-limit infrastructure is untouched.
 *
 * Forward-compat: PROJ-12 (scenario-token enumeration) and PROJ-19
 * (sysadmin endpoint protection) can reuse `getRatelimit()` with a
 * different `prefix` argument.
 */

export interface RateLimitResult {
  /**
   * `true` when the request is within the budget OR the limiter could
   * not run (fail-open). `false` only when the limiter ran successfully
   * AND the IP is over budget.
   */
  success: boolean;
  /** The configured per-window request budget (60 in PROJ-11). */
  limit: number;
  /** How many requests remain in the current window. 0 when over budget. */
  remaining: number;
  /** Epoch ms when the current window resets. */
  reset: number;
}

/**
 * Result shape for the fail-open path. Mirrors the success path so
 * downstream callers can branch on `success` without null-guards.
 */
const FAIL_OPEN: RateLimitResult = {
  success: true,
  limit: 60,
  remaining: 60,
  reset: 0,
};

let cached: Ratelimit | null = null;
let resolvedAtBootMissing: boolean | null = null;

function isConfigured(): boolean {
  if (resolvedAtBootMissing !== null) return !resolvedAtBootMissing;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  resolvedAtBootMissing = !url || !token;
  return !resolvedAtBootMissing;
}

/**
 * Lazily build the limiter so unit tests can run without Upstash env vars.
 * In local dev without env vars this returns `null` and the caller falls
 * open. Returned client is safe to share across requests.
 */
export function getRatelimit(): Ratelimit | null {
  if (cached) return cached;
  if (!isConfigured()) return null;
  try {
    cached = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'cg:public-page',
      analytics: false,
    });
  } catch (err) {
    console.warn(
      '[rate-limit] Upstash client init failed; failing open',
      err instanceof Error ? err.message : err,
    );
    cached = null;
    return null;
  }
  return cached;
}

/**
 * Run the page-load rate-limit check for an anonymous /c/<token> request.
 *
 *   - `ip` is the visitor's client IP (already extracted by middleware).
 *   - Empty / unknown IP → fail open (we never block).
 *   - Any limiter error → fail open with a console warn for ops triage.
 */
export async function checkPageLoad(ip: string | null): Promise<RateLimitResult> {
  if (!ip) return FAIL_OPEN;

  const limiter = getRatelimit();
  if (!limiter) return FAIL_OPEN;

  try {
    const result = await limiter.limit(ip);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.warn(
      '[rate-limit] limit() threw; failing open',
      err instanceof Error ? err.message : err,
    );
    return FAIL_OPEN;
  }
}

/** Test-only: reset the cached limiter / config detection. */
export function __resetForTests() {
  cached = null;
  resolvedAtBootMissing = null;
}
