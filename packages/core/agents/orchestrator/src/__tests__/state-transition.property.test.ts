/**
 * Property-based tests for State Transitions
 * 
 * Feature: agent-orchestration
 * Tests Properties 4, 7, and 8 related to state transitions
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SessionStateManager } from '../services/session-state-manager.js';
import { violationIdArb, urlArb } from '../__generators__/session-state.generator.js';

/**
 * Generates a non-empty array of unique violation IDs
 */
const uniqueViolationIdsArb = fc.array(violationIdArb, { minLength: 1, maxLength: 10 })
    .map(ids => [...new Set(ids)])
    .filter(ids => ids.length > 0);

describe('Feature: agent-orchestration, Property 4: State Transition on Verification Success', () => {
    /**
     * Property 4: State Transition on Verification Success
     * 
     * For any violation where VerifyElement returns status "pass", the violation
     * SHALL be removed from pending_violations and added to fixed_violations
     * in the session state.
     * 
     * Validates: Requirements 1.4, 3.2
     */
    it('should remove violation from pending and add to fixed when marked as fixed', () => {
        fc.assert(
            fc.property(
                urlArb,
                uniqueViolationIdsArb,
                (url, violationIds) => {
                    // Setup: Create manager with pending violations
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([...violationIds]);

                    // Pick a random violation to mark as fixed
                    const violationToFix = violationIds[0];
                    const initialPendingCount = manager.getPendingViolations().length;
                    const initialFixedCount = manager.getFixedViolations().length;

                    // Action: Mark the violation as fixed (simulating verification success)
                    const result = manager.markViolationFixed(violationToFix);

                    // Assertions:
                    // 1. The operation should succeed
                    expect(result).toBe(true);

                    // 2. Violation should be removed from pending_violations
                    expect(manager.getPendingViolations()).not.toContain(violationToFix);
                    expect(manager.getPendingViolations().length).toBe(initialPendingCount - 1);

                    // 3. Violation should be added to fixed_violations
                    expect(manager.getFixedViolations()).toContain(violationToFix);
                    expect(manager.getFixedViolations().length).toBe(initialFixedCount + 1);

                    // 4. State should remain valid
                    expect(manager.isValid()).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should clear current_violation_id when the current violation is fixed', () => {
        fc.assert(
            fc.property(
                urlArb,
                uniqueViolationIdsArb,
                (url, violationIds) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([...violationIds]);

                    // Set the first violation as current
                    const currentViolation = violationIds[0];
                    manager.setCurrentViolation(currentViolation);

                    // Mark it as fixed
                    manager.markViolationFixed(currentViolation);

                    // Current violation should be cleared
                    expect(manager.getCurrentViolationId()).toBeNull();
                    expect(manager.getRetryAttempts()).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should preserve other pending violations when one is fixed', () => {
        fc.assert(
            fc.property(
                urlArb,
                fc.array(violationIdArb, { minLength: 2, maxLength: 10 })
                    .map(ids => [...new Set(ids)])
                    .filter(ids => ids.length >= 2),
                (url, violationIds) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([...violationIds]);

                    // Fix the first violation
                    const violationToFix = violationIds[0];
                    const remainingViolations = violationIds.slice(1);

                    manager.markViolationFixed(violationToFix);

                    // All other violations should still be pending
                    const pending = manager.getPendingViolations();
                    for (const v of remainingViolations) {
                        expect(pending).toContain(v);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe('Feature: agent-orchestration, Property 7: Retry Counter Increment on Failure', () => {
    /**
     * Property 7: Retry Counter Increment on Failure
     * 
     * For any violation where VerifyElement returns status "fail", the retry_attempts
     * counter for that violation SHALL increment by exactly 1.
     * 
     * Validates: Requirements 3.3
     */
    it('should increment retry counter by exactly 1 on each failure', () => {
        fc.assert(
            fc.property(
                urlArb,
                violationIdArb,
                fc.nat({ max: 5 }), // Number of failures to simulate
                (url, violationId, failureCount) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([violationId]);
                    manager.setCurrentViolation(violationId);

                    // Simulate multiple verification failures
                    for (let i = 0; i < failureCount; i++) {
                        const beforeCount = manager.getRetryAttemptsForViolation(violationId);
                        const newCount = manager.incrementRetry(violationId);

                        // Counter should increment by exactly 1
                        expect(newCount).toBe(beforeCount + 1);
                    }

                    // Final count should equal number of failures
                    expect(manager.getRetryAttemptsForViolation(violationId)).toBe(failureCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should update session state retry_attempts when current violation fails', () => {
        fc.assert(
            fc.property(
                urlArb,
                violationIdArb,
                (url, violationId) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([violationId]);
                    manager.setCurrentViolation(violationId);

                    // Initial state
                    expect(manager.getRetryAttempts()).toBe(0);

                    // Increment retry
                    manager.incrementRetry(violationId);

                    // Session state retry_attempts should be updated
                    expect(manager.getRetryAttempts()).toBe(1);

                    // Increment again
                    manager.incrementRetry(violationId);
                    expect(manager.getRetryAttempts()).toBe(2);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should track retry counts independently per violation', () => {
        fc.assert(
            fc.property(
                urlArb,
                fc.array(violationIdArb, { minLength: 2, maxLength: 5 })
                    .map(ids => [...new Set(ids)])
                    .filter(ids => ids.length >= 2),
                fc.array(fc.nat({ max: 3 }), { minLength: 2, maxLength: 5 }),
                (url, violationIds, retryCounts) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([...violationIds]);

                    // Apply different retry counts to each violation
                    const expectedCounts: Record<string, number> = {};
                    for (let i = 0; i < Math.min(violationIds.length, retryCounts.length); i++) {
                        const vid = violationIds[i];
                        const count = retryCounts[i];
                        expectedCounts[vid] = count;

                        for (let j = 0; j < count; j++) {
                            manager.incrementRetry(vid);
                        }
                    }

                    // Verify each violation has its own independent count
                    for (const [vid, expectedCount] of Object.entries(expectedCounts)) {
                        expect(manager.getRetryAttemptsForViolation(vid)).toBe(expectedCount);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should store failure reason with retry increment', () => {
        fc.assert(
            fc.property(
                urlArb,
                violationIdArb,
                fc.string({ minLength: 1, maxLength: 100 }),
                (url, violationId, failureReason) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([violationId]);

                    // Increment with failure reason
                    manager.incrementRetry(violationId, failureReason);

                    // Failure reason should be stored
                    expect(manager.getLastFailureReason(violationId)).toBe(failureReason);
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe('Feature: agent-orchestration, Property 8: Three-Strike Rule', () => {
    /**
     * Property 8: Three-Strike Rule
     * 
     * For any violation where retry_attempts reaches 3:
     * - The violation SHALL be moved to skipped_violations
     * - human_handoff_reason SHALL be set with failure details
     * - Processing SHALL continue to the next pending violation
     * 
     * Validates: Requirements 4.1, 4.2, 4.3
     */
    it('should detect three-strike limit after exactly 3 retries', () => {
        fc.assert(
            fc.property(
                urlArb,
                violationIdArb,
                (url, violationId) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([violationId]);

                    // Before any retries - not at limit
                    expect(manager.hasReachedThreeStrikeLimit(violationId)).toBe(false);

                    // After 1 retry - not at limit
                    manager.incrementRetry(violationId);
                    expect(manager.hasReachedThreeStrikeLimit(violationId)).toBe(false);

                    // After 2 retries - not at limit
                    manager.incrementRetry(violationId);
                    expect(manager.hasReachedThreeStrikeLimit(violationId)).toBe(false);

                    // After 3 retries - at limit
                    manager.incrementRetry(violationId);
                    expect(manager.hasReachedThreeStrikeLimit(violationId)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should move violation to skipped when three-strike limit is reached and skipViolation is called', () => {
        fc.assert(
            fc.property(
                urlArb,
                uniqueViolationIdsArb,
                fc.string({ minLength: 1, maxLength: 200 }),
                (url, violationIds, handoffReason) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([...violationIds]);

                    const violationToSkip = violationIds[0];

                    // Simulate 3 failed attempts
                    manager.incrementRetry(violationToSkip);
                    manager.incrementRetry(violationToSkip);
                    manager.incrementRetry(violationToSkip);

                    // Verify at three-strike limit
                    expect(manager.hasReachedThreeStrikeLimit(violationToSkip)).toBe(true);

                    // Skip the violation
                    const result = manager.skipViolation(violationToSkip, handoffReason);

                    // Assertions:
                    // 1. Skip operation should succeed
                    expect(result).toBe(true);

                    // 2. Violation should be removed from pending
                    expect(manager.getPendingViolations()).not.toContain(violationToSkip);

                    // 3. Violation should be added to skipped
                    expect(manager.getSkippedViolations()).toContain(violationToSkip);

                    // 4. Human handoff reason should be set
                    const state = manager.getState();
                    expect(state.sessionAttributes.human_handoff_reason).toBe(handoffReason);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should allow processing to continue to next violation after skip', () => {
        fc.assert(
            fc.property(
                urlArb,
                fc.array(violationIdArb, { minLength: 2, maxLength: 5 })
                    .map(ids => [...new Set(ids)])
                    .filter(ids => ids.length >= 2),
                (url, violationIds) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([...violationIds]);

                    const firstViolation = violationIds[0];
                    const remainingViolations = violationIds.slice(1);

                    // Simulate 3 failed attempts on first violation
                    manager.incrementRetry(firstViolation);
                    manager.incrementRetry(firstViolation);
                    manager.incrementRetry(firstViolation);

                    // Skip the first violation
                    manager.skipViolation(firstViolation, 'Max retries exceeded');

                    // Processing should be able to continue
                    // 1. There should still be pending violations
                    expect(manager.getPendingViolations().length).toBe(remainingViolations.length);

                    // 2. Next pending violation should be available
                    const nextViolation = manager.getNextPendingViolation();
                    expect(nextViolation).not.toBeNull();
                    expect(remainingViolations).toContain(nextViolation);

                    // 3. Should not be complete yet
                    expect(manager.isComplete()).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should include skipped violations in summary counts', () => {
        fc.assert(
            fc.property(
                urlArb,
                fc.array(violationIdArb, { minLength: 3, maxLength: 10 })
                    .map(ids => [...new Set(ids)])
                    .filter(ids => ids.length >= 3),
                (url, violationIds) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([...violationIds]);

                    const initialCount = violationIds.length;

                    // Fix one violation
                    manager.markViolationFixed(violationIds[0]);

                    // Skip one violation (after 3 retries)
                    manager.incrementRetry(violationIds[1]);
                    manager.incrementRetry(violationIds[1]);
                    manager.incrementRetry(violationIds[1]);
                    manager.skipViolation(violationIds[1], 'Max retries exceeded');

                    // Get summary
                    const summary = manager.getSummary();

                    // Verify counts
                    expect(summary.fixedCount).toBe(1);
                    expect(summary.skippedCount).toBe(1);
                    expect(summary.pendingCount).toBe(initialCount - 2);
                    expect(summary.totalProcessed).toBe(2);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should use MAX_RETRY_ATTEMPTS constant for three-strike threshold', () => {
        // Verify the constant is set to 3
        expect(SessionStateManager.MAX_RETRY_ATTEMPTS).toBe(3);

        fc.assert(
            fc.property(
                urlArb,
                violationIdArb,
                (url, violationId) => {
                    const manager = new SessionStateManager(url);
                    manager.setPendingViolations([violationId]);

                    // Increment exactly MAX_RETRY_ATTEMPTS times
                    for (let i = 0; i < SessionStateManager.MAX_RETRY_ATTEMPTS; i++) {
                        manager.incrementRetry(violationId);
                    }

                    // Should be at the limit
                    expect(manager.hasReachedThreeStrikeLimit(violationId)).toBe(true);
                    expect(manager.getRetryAttemptsForViolation(violationId)).toBe(SessionStateManager.MAX_RETRY_ATTEMPTS);
                }
            ),
            { numRuns: 100 }
        );
    });
});
