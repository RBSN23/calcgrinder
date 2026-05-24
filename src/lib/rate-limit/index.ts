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
const customCache = new Map<string, Ratelimit>();

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

export interface CustomLimiterConfig {
  prefix: string;
  /** Requests allowed per window. */
  limit: number;
  /** Window duration as an Upstash duration string, e.g. '60 s'. */
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;
}

/**
 * Build (or reuse) a separately-prefixed Ratelimit client. PROJ-12 uses
 * this for the per-user write budget (`cg:scenario-write`, 30/60s);
 * future features (PROJ-19 sysadmin endpoints, etc.) can reuse the same
 * factory by passing a different prefix/limit/window tuple.
 */
export function getCustomRatelimit(config: CustomLimiterConfig): Ratelimit | null {
  const cacheKey = `${config.prefix}|${config.limit}|${config.window}`;
  const existing = customCache.get(cacheKey);
  if (existing) return existing;
  if (!isConfigured()) return null;
  try {
    const client = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(config.limit, config.window),
      prefix: config.prefix,
      analytics: false,
    });
    customCache.set(cacheKey, client);
    return client;
  } catch (err) {
    console.warn(
      '[rate-limit] Upstash custom client init failed; failing open',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PROJ-12 — per-user write-limit check shared by every scenario write
 * endpoint. Keyed by `auth.uid()` (so a shared NAT can't accidentally
 * throttle multiple legitimate users). Fail-open on any limiter error.
 */
export const SCENARIO_WRITE_LIMITER: CustomLimiterConfig = {
  prefix: 'cg:scenario-write',
  limit: 30,
  window: '60 s',
};

export async function checkScenarioWrite(
  userId: string | null,
): Promise<RateLimitResult> {
  if (!userId) return FAIL_OPEN;
  const limiter = getCustomRatelimit(SCENARIO_WRITE_LIMITER);
  if (!limiter) return FAIL_OPEN;
  try {
    const result = await limiter.limit(userId);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.warn(
      '[rate-limit] scenario-write limit() threw; failing open',
      err instanceof Error ? err.message : err,
    );
    return FAIL_OPEN;
  }
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
  customCache.clear();
}
