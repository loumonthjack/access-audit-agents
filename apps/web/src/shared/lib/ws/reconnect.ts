/**
 * Reconnection logic with exponential backoff
 * Requirements: 10.2, 10.3
 * 
 * Implements exponential backoff with:
 * - Base delay: 1 second
 * - Max delay: 30 seconds
 * - Max attempts: 5
 */

import type { ReconnectConfig } from './types';
import { DEFAULT_RECONNECT_CONFIG } from './types';

/**
 * Calculate the backoff delay for a given attempt number
 * Uses exponential backoff: delay = min(baseDelay * 2^(attempt-1), maxDelay)
 * 
 * @param attempt - Current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
    attempt: number,
    baseDelayMs: number = DEFAULT_RECONNECT_CONFIG.baseDelayMs,
    maxDelayMs: number = DEFAULT_RECONNECT_CONFIG.maxDelayMs
): number {
    // Ensure attempt is at least 1
    const normalizedAttempt = Math.max(1, attempt);

    // Calculate exponential delay: baseDelay * 2^(attempt-1)
    const exponentialDelay = baseDelayMs * Math.pow(2, normalizedAttempt - 1);

    // Cap at max delay
    return Math.min(exponentialDelay, maxDelayMs);
}

/**
 * Check if more reconnection attempts are allowed
 * 
 * @param currentAttempt - Current attempt number
 * @param maxAttempts - Maximum allowed attempts
 * @returns True if more attempts are allowed
 */
export function canReconnect(
    currentAttempt: number,
    maxAttempts: number = DEFAULT_RECONNECT_CONFIG.maxAttempts
): boolean {
    return currentAttempt < maxAttempts;
}

/**
 * Get the sequence of backoff delays for all attempts
 * Useful for testing and debugging
 * 
 * @param config - Reconnection configuration
 * @returns Array of delays in milliseconds for each attempt
 */
export function getBackoffSequence(config: ReconnectConfig = DEFAULT_RECONNECT_CONFIG): number[] {
    const delays: number[] = [];
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        delays.push(calculateBackoffDelay(attempt, config.baseDelayMs, config.maxDelayMs));
    }
    return delays;
}

/**
 * Reconnection state tracker
 * Manages reconnection attempts and timing
 */
export class ReconnectionManager {
    private attempts = 0;
    private config: ReconnectConfig;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private onReconnect: (() => void) | null = null;
    private onMaxAttemptsReached: (() => void) | null = null;

    constructor(config: ReconnectConfig = DEFAULT_RECONNECT_CONFIG) {
        this.config = config;
    }

    /**
     * Get current attempt count
     */
    getAttempts(): number {
        return this.attempts;
    }

    /**
     * Get configuration
     */
    getConfig(): ReconnectConfig {
        return this.config;
    }

    /**
     * Check if reconnection is in progress
     */
    isReconnecting(): boolean {
        return this.timeoutId !== null;
    }

    /**
     * Check if more attempts are available
     */
    canAttempt(): boolean {
        return canReconnect(this.attempts, this.config.maxAttempts);
    }

    /**
     * Get the delay for the next attempt
     */
    getNextDelay(): number {
        return calculateBackoffDelay(
            this.attempts + 1,
            this.config.baseDelayMs,
            this.config.maxDelayMs
        );
    }

    /**
     * Set callback for reconnection attempt
     */
    setOnReconnect(callback: () => void): void {
        this.onReconnect = callback;
    }

    /**
     * Set callback for when max attempts are reached
     */
    setOnMaxAttemptsReached(callback: () => void): void {
        this.onMaxAttemptsReached = callback;
    }

    /**
     * Schedule a reconnection attempt
     * @returns True if attempt was scheduled, false if max attempts reached
     */
    scheduleReconnect(): boolean {
        if (!this.canAttempt()) {
            this.onMaxAttemptsReached?.();
            return false;
        }

        this.attempts++;
        const delay = calculateBackoffDelay(
            this.attempts,
            this.config.baseDelayMs,
            this.config.maxDelayMs
        );

        this.timeoutId = setTimeout(() => {
            this.timeoutId = null;
            this.onReconnect?.();
        }, delay);

        return true;
    }

    /**
     * Cancel pending reconnection
     */
    cancel(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    /**
     * Reset the manager state
     */
    reset(): void {
        this.cancel();
        this.attempts = 0;
    }
}
