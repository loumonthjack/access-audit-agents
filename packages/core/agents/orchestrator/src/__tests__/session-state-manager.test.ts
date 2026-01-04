/**
 * Unit tests for SessionStateManager
 * 
 * Tests state transition methods and core functionality
 * Requirements: 3.1, 3.2, 3.3, 3.4, 4.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStateManager } from '../services/session-state-manager.js';

describe('SessionStateManager', () => {
    let manager: SessionStateManager;
    const testUrl = 'https://example.com/test';

    beforeEach(() => {
        manager = new SessionStateManager(testUrl);
    });

    describe('initialization', () => {
        it('should initialize with correct default values', () => {
            expect(manager.getCurrentUrl()).toBe(testUrl);
            expect(manager.getPendingViolations()).toEqual([]);
            expect(manager.getFixedViolations()).toEqual([]);
            expect(manager.getSkippedViolations()).toEqual([]);
            expect(manager.getCurrentViolationId()).toBeNull();
            expect(manager.getRetryAttempts()).toBe(0);
        });

        it('should create valid state', () => {
            expect(manager.isValid()).toBe(true);
        });
    });

    describe('markViolationFixed', () => {
        it('should move violation from pending to fixed', () => {
            manager.setPendingViolations(['v-1', 'v-2', 'v-3']);

            const result = manager.markViolationFixed('v-2');

            expect(result).toBe(true);
            expect(manager.getPendingViolations()).toEqual(['v-1', 'v-3']);
            expect(manager.getFixedViolations()).toContain('v-2');
        });

        it('should return false for non-existent violation', () => {
            manager.setPendingViolations(['v-1']);

            const result = manager.markViolationFixed('v-nonexistent');

            expect(result).toBe(false);
            expect(manager.getPendingViolations()).toEqual(['v-1']);
        });

        it('should clear current violation if it was the one fixed', () => {
            manager.setPendingViolations(['v-1', 'v-2']);
            manager.setCurrentViolation('v-1');

            manager.markViolationFixed('v-1');

            expect(manager.getCurrentViolationId()).toBeNull();
            expect(manager.getRetryAttempts()).toBe(0);
        });

        it('should not add duplicate to fixed violations', () => {
            manager.setPendingViolations(['v-1', 'v-1']);

            manager.markViolationFixed('v-1');
            manager.setPendingViolations(['v-1']);
            manager.markViolationFixed('v-1');

            const fixed = manager.getFixedViolations();
            expect(fixed.filter(v => v === 'v-1').length).toBe(1);
        });
    });

    describe('incrementRetry', () => {
        it('should increment retry counter for violation', () => {
            manager.setPendingViolations(['v-1']);
            manager.setCurrentViolation('v-1');

            const count1 = manager.incrementRetry('v-1');
            expect(count1).toBe(1);
            expect(manager.getRetryAttempts()).toBe(1);

            const count2 = manager.incrementRetry('v-1');
            expect(count2).toBe(2);
            expect(manager.getRetryAttempts()).toBe(2);
        });

        it('should track retry count per violation', () => {
            manager.setPendingViolations(['v-1', 'v-2']);

            manager.incrementRetry('v-1');
            manager.incrementRetry('v-1');
            manager.incrementRetry('v-2');

            expect(manager.getRetryAttemptsForViolation('v-1')).toBe(2);
            expect(manager.getRetryAttemptsForViolation('v-2')).toBe(1);
        });

        it('should store failure reason', () => {
            manager.setPendingViolations(['v-1']);

            manager.incrementRetry('v-1', 'Selector not found');

            expect(manager.getLastFailureReason('v-1')).toBe('Selector not found');
        });
    });

    describe('skipViolation', () => {
        it('should move violation from pending to skipped', () => {
            manager.setPendingViolations(['v-1', 'v-2', 'v-3']);

            const result = manager.skipViolation('v-2', 'Max retries exceeded');

            expect(result).toBe(true);
            expect(manager.getPendingViolations()).toEqual(['v-1', 'v-3']);
            expect(manager.getSkippedViolations()).toContain('v-2');
        });

        it('should set human handoff reason', () => {
            manager.setPendingViolations(['v-1']);

            manager.skipViolation('v-1', 'Complex fix required');

            const state = manager.getState();
            expect(state.sessionAttributes.human_handoff_reason).toBe('Complex fix required');
        });

        it('should return false for non-existent violation', () => {
            manager.setPendingViolations(['v-1']);

            const result = manager.skipViolation('v-nonexistent', 'reason');

            expect(result).toBe(false);
        });

        it('should clear current violation if it was the one skipped', () => {
            manager.setPendingViolations(['v-1', 'v-2']);
            manager.setCurrentViolation('v-1');

            manager.skipViolation('v-1', 'reason');

            expect(manager.getCurrentViolationId()).toBeNull();
        });
    });

    describe('three-strike rule', () => {
        it('should detect when violation reaches three-strike limit', () => {
            manager.setPendingViolations(['v-1']);

            expect(manager.hasReachedThreeStrikeLimit('v-1')).toBe(false);

            manager.incrementRetry('v-1');
            expect(manager.hasReachedThreeStrikeLimit('v-1')).toBe(false);

            manager.incrementRetry('v-1');
            expect(manager.hasReachedThreeStrikeLimit('v-1')).toBe(false);

            manager.incrementRetry('v-1');
            expect(manager.hasReachedThreeStrikeLimit('v-1')).toBe(true);
        });
    });

    describe('serialization', () => {
        it('should serialize and deserialize correctly', () => {
            manager.setPendingViolations(['v-1', 'v-2']);
            manager.setCurrentViolation('v-1');
            manager.incrementRetry('v-1');
            manager.markViolationFixed('v-1');

            const serialized = manager.serialize();
            const restored = SessionStateManager.deserialize(serialized);

            expect(restored.getCurrentUrl()).toBe(testUrl);
            expect(restored.getPendingViolations()).toEqual(['v-2']);
            expect(restored.getFixedViolations()).toContain('v-1');
        });

        it('should restore from Bedrock sessionAttributes', () => {
            const attrs = {
                current_url: testUrl,
                pending_violations: '["v-1", "v-2"]',
                current_violation_id: 'v-1',
                retry_attempts: '2',
                human_handoff_reason: '',
                fixed_violations: '["v-0"]',
                skipped_violations: '[]'
            };

            const restored = SessionStateManager.fromSessionAttributes(attrs);

            expect(restored.getCurrentUrl()).toBe(testUrl);
            expect(restored.getPendingViolations()).toEqual(['v-1', 'v-2']);
            expect(restored.getCurrentViolationId()).toBe('v-1');
            expect(restored.getRetryAttempts()).toBe(2);
            expect(restored.getFixedViolations()).toEqual(['v-0']);
        });
    });

    describe('helper methods', () => {
        it('should get next pending violation', () => {
            manager.setPendingViolations(['v-1', 'v-2']);

            expect(manager.getNextPendingViolation()).toBe('v-1');
        });

        it('should return null when no pending violations', () => {
            expect(manager.getNextPendingViolation()).toBeNull();
        });

        it('should detect completion', () => {
            expect(manager.isComplete()).toBe(true);

            manager.setPendingViolations(['v-1']);
            expect(manager.isComplete()).toBe(false);

            manager.markViolationFixed('v-1');
            expect(manager.isComplete()).toBe(true);
        });

        it('should provide accurate summary', () => {
            manager.setPendingViolations(['v-1', 'v-2', 'v-3']);
            manager.markViolationFixed('v-1');
            manager.skipViolation('v-2', 'reason');

            const summary = manager.getSummary();

            expect(summary.fixedCount).toBe(1);
            expect(summary.skippedCount).toBe(1);
            expect(summary.pendingCount).toBe(1);
            expect(summary.totalProcessed).toBe(2);
        });
    });
});
