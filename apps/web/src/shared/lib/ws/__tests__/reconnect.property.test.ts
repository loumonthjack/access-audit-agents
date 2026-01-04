/**
 * Property-based tests for reconnection logic
 * Feature: web-dashboard, Property 19: Reconnection with Exponential Backoff
 * Validates: Requirements 10.2
 *
 * Property 19: Reconnection with Exponential Backoff
 * For any WebSocket disconnection, reconnection attempts SHALL use exponential backoff
 * starting at 1 second, doubling each attempt, up to maximum 30 seconds.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateBackoffDelay,
  canReconnect,
  getBackoffSequence,
  DEFAULT_RECONNECT_CONFIG,
} from '../reconnect';

describe('Property 19: Reconnection with Exponential Backoff', () => {
  /**
   * Property: Backoff delay doubles with each attempt (until max)
   * For any attempt n > 1, delay(n) = min(delay(n-1) * 2, maxDelay)
   */
  it('should double delay with each attempt until max is reached', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // attempt number
        fc.integer({ min: 100, max: 5000 }), // base delay
        fc.integer({ min: 10000, max: 60000 }), // max delay
        (attempt, baseDelay, maxDelay) => {
          const currentDelay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
          const nextDelay = calculateBackoffDelay(attempt + 1, baseDelay, maxDelay);

          // Next delay should be either double or capped at max
          const expectedNext = Math.min(currentDelay * 2, maxDelay);
          expect(nextDelay).toBe(expectedNext);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: First attempt uses base delay
   * For attempt 1, delay = baseDelay
   */
  it('should use base delay for first attempt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000 }), // base delay
        fc.integer({ min: 10000, max: 60000 }), // max delay
        (baseDelay, maxDelay) => {
          const delay = calculateBackoffDelay(1, baseDelay, maxDelay);
          expect(delay).toBe(baseDelay);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Delay never exceeds max delay
   * For any attempt, delay <= maxDelay
   */
  it('should never exceed max delay', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // attempt number
        fc.integer({ min: 100, max: 5000 }), // base delay
        fc.integer({ min: 1000, max: 60000 }), // max delay
        (attempt, baseDelay, maxDelay) => {
          const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
          expect(delay).toBeLessThanOrEqual(maxDelay);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Delay is always positive
   * For any valid input, delay > 0
   */
  it('should always return positive delay', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // attempt number (including 0)
        fc.integer({ min: 1, max: 10000 }), // base delay
        fc.integer({ min: 1, max: 60000 }), // max delay
        (attempt, baseDelay, maxDelay) => {
          const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
          expect(delay).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Delay sequence is monotonically non-decreasing
   * For any sequence of attempts, delay(n) <= delay(n+1)
   */
  it('should produce monotonically non-decreasing delays', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }), // base delay
        fc.integer({ min: 5000, max: 60000 }), // max delay
        fc.integer({ min: 3, max: 10 }), // max attempts
        (baseDelay, maxDelay, maxAttempts) => {
          let previousDelay = 0;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const currentDelay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
            expect(currentDelay).toBeGreaterThanOrEqual(previousDelay);
            previousDelay = currentDelay;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Default config produces expected sequence
   * With default config (1s base, 30s max, 5 attempts):
   * Attempt 1: 1000ms, Attempt 2: 2000ms, Attempt 3: 4000ms, Attempt 4: 8000ms, Attempt 5: 16000ms
   */
  it('should produce correct sequence with default config', () => {
    const sequence = getBackoffSequence(DEFAULT_RECONNECT_CONFIG);

    expect(sequence).toHaveLength(5);
    expect(sequence[0]).toBe(1000); // 1s
    expect(sequence[1]).toBe(2000); // 2s
    expect(sequence[2]).toBe(4000); // 4s
    expect(sequence[3]).toBe(8000); // 8s
    expect(sequence[4]).toBe(16000); // 16s (not 32s because 16 < 30)
  });

  /**
   * Property: canReconnect returns false when attempts exhausted
   */
  it('should correctly determine if reconnection is allowed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }), // current attempt
        fc.integer({ min: 1, max: 10 }), // max attempts
        (currentAttempt, maxAttempts) => {
          const canAttempt = canReconnect(currentAttempt, maxAttempts);
          expect(canAttempt).toBe(currentAttempt < maxAttempts);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Backoff sequence length matches max attempts
   */
  it('should generate sequence with correct length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // max attempts
        fc.integer({ min: 100, max: 5000 }), // base delay
        fc.integer({ min: 5000, max: 60000 }), // max delay
        (maxAttempts, baseDelay, maxDelay) => {
          const config = { maxAttempts, baseDelayMs: baseDelay, maxDelayMs: maxDelay };
          const sequence = getBackoffSequence(config);
          expect(sequence).toHaveLength(maxAttempts);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Eventually reaches max delay
   * For sufficient attempts, delay should reach maxDelay
   */
  it('should eventually reach max delay', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }), // base delay
        fc.integer({ min: 1000, max: 10000 }), // max delay
        (baseDelay, maxDelay) => {
          // Calculate how many attempts needed to reach max
          // baseDelay * 2^(n-1) >= maxDelay
          // n >= log2(maxDelay/baseDelay) + 1
          const attemptsNeeded = Math.ceil(Math.log2(maxDelay / baseDelay)) + 1;

          const delay = calculateBackoffDelay(attemptsNeeded + 5, baseDelay, maxDelay);
          expect(delay).toBe(maxDelay);
        }
      ),
      { numRuns: 100 }
    );
  });
});
