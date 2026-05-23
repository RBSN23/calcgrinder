import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `@upstash/ratelimit` and `@upstash/redis` are mocked so the tests don't
// reach the network. The rate-limit module lazily constructs the Ratelimit
// client when the env vars are present.

const limitMock = vi.fn();

vi.mock('@upstash/ratelimit', () => {
  class FakeRatelimit {
    static slidingWindow() {
      return { kind: 'sliding-window' };
    }
    limit(ip: string) {
      return limitMock(ip);
    }
  }
  return { Ratelimit: FakeRatelimit };
});

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv() {
      if (
        !process.env.UPSTASH_REDIS_REST_URL ||
        !process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        throw new Error('UPSTASH_REDIS_REST_URL/TOKEN missing');
      }
      return { kind: 'redis-client' };
    },
  },
}));

import { checkPageLoad, __resetForTests } from './index';

describe('checkPageLoad', () => {
  const ORIG_URL = process.env.UPSTASH_REDIS_REST_URL;
  const ORIG_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    limitMock.mockReset();
    __resetForTests();
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = ORIG_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = ORIG_TOKEN;
    __resetForTests();
  });

  it('fails open when ip is null (no x-forwarded-for in local dev)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    const result = await checkPageLoad(null);
    expect(result.success).toBe(true);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('fails open when Upstash env vars are missing', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const result = await checkPageLoad('1.2.3.4');
    expect(result.success).toBe(true);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('returns success=true when the limiter allows the request', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    limitMock.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60_000,
    });
    const result = await checkPageLoad('1.2.3.4');
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(59);
    expect(limitMock).toHaveBeenCalledWith('1.2.3.4');
  });

  it('returns success=false when the limiter denies the request', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    limitMock.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 30_000,
    });
    const result = await checkPageLoad('1.2.3.4');
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fails open when the limiter throws (e.g. Upstash transient outage)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    const consoleSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    limitMock.mockRejectedValue(new Error('network down'));
    const result = await checkPageLoad('1.2.3.4');
    expect(result.success).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
