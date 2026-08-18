/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for rate limiting.
 * Tokens are consumed on each request and automatically refilled over time.
 */

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  /**
   * @param maxTokens Maximum number of tokens in the bucket
   * @param refillRate Number of tokens to add per second
   */
  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time since last refill
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Check if a request is allowed and consume a token if so
   * @returns true if request is allowed, false if rate limited
   */
  public tryConsume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get time in seconds until next token is available
   */
  public getTimeUntilNextToken(): number {
    this.refill();

    if (this.tokens >= 1) {
      return 0;
    }

    const tokensNeeded = 1 - this.tokens;
    return tokensNeeded / this.refillRate;
  }

  /**
   * Get current token count
   */
  public getTokenCount(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Reset the rate limiter to full capacity
   */
  public reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

// Global rate limiters for different AI operations
export const aiRateLimiters = {
  // AI Detail Generation: 5 requests per minute (1 token per 12 seconds)
  details: new RateLimiter(5, 5 / 60),

  // AI Chat: 10 messages per minute (1 token per 6 seconds)
  chat: new RateLimiter(10, 10 / 60),

  // AI Comparison: 3 requests per minute (1 token per 20 seconds)
  comparison: new RateLimiter(3, 3 / 60),
};

/**
 * Check if an AI request is allowed
 * @param type Type of AI operation
 * @returns Object with allowed status and wait time if rate limited
 */
export function checkRateLimit(type: 'details' | 'chat' | 'comparison'): {
  allowed: boolean;
  waitTime: number;
} {
  const limiter = aiRateLimiters[type];
  const allowed = limiter.tryConsume();

  return {
    allowed,
    waitTime: allowed ? 0 : Math.ceil(limiter.getTimeUntilNextToken()),
  };
}
