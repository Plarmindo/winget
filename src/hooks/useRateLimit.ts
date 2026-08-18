import { useState, useCallback, useEffect, useRef } from 'react';
import { RateLimiter } from '../utils/rateLimiter';

interface UseRateLimitReturn {
  isRateLimited: boolean;
  secondsRemaining: number;
  checkRateLimit: () => boolean;
  reset: () => void;
}

/**
 * A3: Unified rate limiting - uses token bucket algorithm from utils/rateLimiter.ts
 * This hook provides React state management around the token bucket implementation
 */
export const useRateLimit = (maxTokens: number = 5, refillRate: number = 5 / 60): UseRateLimitReturn => {
  // Use ref to persist rate limiter instance across renders
  const limiterRef = useRef<RateLimiter | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Initialize rate limiter on mount
  useEffect(() => {
    limiterRef.current = new RateLimiter(maxTokens, refillRate);
  }, [maxTokens, refillRate]);

  // Timer to update rate limit status
  useEffect(() => {
    const interval = setInterval(() => {
      if (limiterRef.current) {
        const tokenCount = limiterRef.current.getTokenCount();
        const isLimited = tokenCount < 1;
        setIsRateLimited(isLimited);

        if (isLimited) {
          const waitTime = limiterRef.current.getTimeUntilNextToken();
          setSecondsRemaining(Math.ceil(waitTime));
        } else {
          setSecondsRemaining(0);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const checkRateLimit = useCallback(() => {
    if (!limiterRef.current) return false;

    const allowed = limiterRef.current.tryConsume();
    setIsRateLimited(!allowed);

    if (!allowed) {
      const waitTime = limiterRef.current.getTimeUntilNextToken();
      setSecondsRemaining(Math.ceil(waitTime));
    }

    return allowed;
  }, []);

  const reset = useCallback(() => {
    limiterRef.current?.reset();
    setIsRateLimited(false);
    setSecondsRemaining(0);
  }, []);

  return {
    isRateLimited,
    secondsRemaining,
    checkRateLimit,
    reset,
  };
};
