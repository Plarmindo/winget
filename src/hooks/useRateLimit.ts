
import { useState, useCallback, useEffect } from 'react';

interface UseRateLimitReturn {
    isRateLimited: boolean;
    secondsRemaining: number;
    checkRateLimit: () => boolean;
}

export const useRateLimit = (limit: number = 5, windowSeconds: number = 60, cooldownSeconds: number = 30): UseRateLimitReturn => {
    const [timestamps, setTimestamps] = useState<number[]>([]);
    const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
    const [secondsRemaining, setSecondsRemaining] = useState(0);

    // Load state from localStorage on mount to persist across reloads
    useEffect(() => {
        const savedCooldown = localStorage.getItem('rate_limit_cooldown');
        const savedTimestamps = localStorage.getItem('rate_limit_timestamps');

        if (savedCooldown) {
            const end = parseInt(savedCooldown, 10);
            if (end > Date.now()) {
                setCooldownEnd(end);
            } else {
                localStorage.removeItem('rate_limit_cooldown');
            }
        }

        if (savedTimestamps) {
            try {
                const parsed = JSON.parse(savedTimestamps);
                // Filter out old timestamps immediately
                const now = Date.now();
                const valid = parsed.filter((t: number) => now - t < windowSeconds * 1000);
                setTimestamps(valid);
            } catch (e) {
                console.error('Failed to parse rate limit timestamps', e);
            }
        }
    }, [windowSeconds]);

    // Timer to update countdown
    useEffect(() => {
        if (!cooldownEnd) {
            setSecondsRemaining(0);
            return;
        }

        const interval = setInterval(() => {
            const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
            if (remaining <= 0) {
                setCooldownEnd(null);
                setSecondsRemaining(0);
                localStorage.removeItem('rate_limit_cooldown');
            } else {
                setSecondsRemaining(remaining);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [cooldownEnd]);

    const checkRateLimit = useCallback(() => {
        const now = Date.now();

        // If already in cooldown, deny
        if (cooldownEnd && now < cooldownEnd) {
            return false;
        }

        // Clean up old timestamps
        const validTimestamps = timestamps.filter(t => now - t < windowSeconds * 1000);

        // Check if limit reached
        if (validTimestamps.length >= limit) {
            // Trigger cooldown
            const end = now + (cooldownSeconds * 1000);
            setCooldownEnd(end);
            setTimestamps([]); // specific design choice: clear history on cooldown or keep? Let's keep for now but reset effectively. 
            // Actually, standard token bucket would just wait. Cooldown block is harsher.
            // Let's go with strict cooldown block.
            localStorage.setItem('rate_limit_cooldown', end.toString());
            return false; // Rate limited
        }

        // Allow and record
        const newTimestamps = [...validTimestamps, now];
        setTimestamps(newTimestamps);
        localStorage.setItem('rate_limit_timestamps', JSON.stringify(newTimestamps));
        return true;
    }, [cooldownEnd, timestamps, limit, windowSeconds, cooldownSeconds]);

    return {
        isRateLimited: !!cooldownEnd,
        secondsRemaining,
        checkRateLimit
    };
};
