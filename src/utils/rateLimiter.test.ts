import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, checkRateLimit, aiRateLimiters } from './rateLimiter';

describe('RateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the bucket capacity', () => {
    const limiter = new RateLimiter(3, 1);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
    expect(limiter.getTokenCount()).toBeLessThan(1);
  });

  it('refills tokens over time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const limiter = new RateLimiter(1, 1);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);

    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
    expect(limiter.getTokenCount()).toBeGreaterThanOrEqual(1);
    expect(limiter.tryConsume()).toBe(true);
  });

  it('reports the time until the next token is available', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const limiter = new RateLimiter(1, 2);
    expect(limiter.getTimeUntilNextToken()).toBe(0);
    limiter.tryConsume();
    expect(limiter.getTimeUntilNextToken()).toBeGreaterThan(0);
  });

  it('resets to full capacity', () => {
    const limiter = new RateLimiter(2, 1);
    limiter.tryConsume();
    limiter.tryConsume();
    expect(limiter.getTokenCount()).toBe(0);
    limiter.reset();
    expect(limiter.getTokenCount()).toBe(2);
    expect(limiter.tryConsume()).toBe(true);
  });

  it('caps refills at the max token count', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const limiter = new RateLimiter(2, 1);
    limiter.tryConsume();
    vi.setSystemTime(new Date('2026-01-01T01:00:00Z'));
    expect(limiter.getTokenCount()).toBe(2);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    aiRateLimiters.details.reset();
    aiRateLimiters.chat.reset();
    aiRateLimiters.comparison.reset();
  });

  it('allows the first request for each operation type', () => {
    expect(checkRateLimit('details')).toEqual({ allowed: true, waitTime: 0 });
    expect(checkRateLimit('chat')).toEqual({ allowed: true, waitTime: 0 });
    expect(checkRateLimit('comparison')).toEqual({ allowed: true, waitTime: 0 });
  });

  it('rate limits once the bucket is exhausted', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('details');
    }
    const result = checkRateLimit('details');
    expect(result.allowed).toBe(false);
    expect(result.waitTime).toBeGreaterThan(0);
  });
});
