/**
 * Property-based tests for SessionState
 * 
 * Feature: agent-orchestration, Property 6: Session State Structure Completeness
 * Validates: Requirements 3.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    SessionStateSchema,
    validateSessionState,
    safeParseSessionState,
    serializeSessionState,
    deserializeSessionState,
    safeDeserializeSessionState,
    createEmptySessionState
} from '../types/index.js';
import { sessionStateArb, sessionStateAttributesArb } from '../__generators__/session-state.generator.js';

describe('Feature: agent-orchestration, Property 6: Session State Structure Completeness', () => {
    /**
     * Property 6: Session State Structure Completeness
     * 
     * For any session state object, it SHALL contain all required fields:
     * - current_url (string)
     * - pending_violations (JSON array)
     * - current_violation_id (string|null)
     * - retry_attempts (number)
     * - human_handoff_reason (string|null)
     * - fixed_violations (JSON array)
     * - skipped_violations (JSON array)
     * 
     * Validates: Requirements 3.1
     */
    it('should contain all required fields for any valid session state', () => {
        fc.assert(
            fc.property(sessionStateArb, (sessionState) => {
                // Validate the session state passes schema validation
                const result = safeParseSessionState(sessionState);
                expect(result.success).toBe(true);

                // Verify all required fields exist
                const attrs = sessionState.sessionAttributes;

                // current_url must be a string
                expect(typeof attrs.current_url).toBe('string');

                // pending_violations must be a valid JSON array string
                expect(typeof attrs.pending_violations).toBe('string');
                const pendingParsed = JSON.parse(attrs.pending_violations);
                expect(Array.isArray(pendingParsed)).toBe(true);

                // current_violation_id must be string or null
                expect(attrs.current_violation_id === null || typeof attrs.current_violation_id === 'string').toBe(true);

                // retry_attempts must be a non-negative number
                expect(typeof attrs.retry_attempts).toBe('number');
                expect(attrs.retry_attempts).toBeGreaterThanOrEqual(0);
                expect(Number.isInteger(attrs.retry_attempts)).toBe(true);

                // human_handoff_reason must be string or null
                expect(attrs.human_handoff_reason === null || typeof attrs.human_handoff_reason === 'string').toBe(true);

                // fixed_violations must be a valid JSON array string
                expect(typeof attrs.fixed_violations).toBe('string');
                const fixedParsed = JSON.parse(attrs.fixed_violations);
                expect(Array.isArray(fixedParsed)).toBe(true);

                // skipped_violations must be a valid JSON array string
                expect(typeof attrs.skipped_violations).toBe('string');
                const skippedParsed = JSON.parse(attrs.skipped_violations);
                expect(Array.isArray(skippedParsed)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('should reject session state missing required fields', () => {
        const requiredFields = [
            'current_url',
            'pending_violations',
            'current_violation_id',
            'retry_attempts',
            'human_handoff_reason',
            'fixed_violations',
            'skipped_violations'
        ];

        for (const fieldToRemove of requiredFields) {
            fc.assert(
                fc.property(sessionStateAttributesArb, (attrs) => {
                    // Create a copy and remove one required field
                    const incomplete = { ...attrs };
                    delete (incomplete as Record<string, unknown>)[fieldToRemove];

                    const result = safeParseSessionState({ sessionAttributes: incomplete });
                    expect(result.success).toBe(false);
                }),
                { numRuns: 10 }
            );
        }
    });

    it('should serialize and deserialize session state correctly (round-trip)', () => {
        fc.assert(
            fc.property(sessionStateArb, (sessionState) => {
                const serialized = serializeSessionState(sessionState);
                const deserialized = deserializeSessionState(serialized);

                expect(deserialized).toEqual(sessionState);
            }),
            { numRuns: 100 }
        );
    });

    it('should safely handle invalid JSON during deserialization', () => {
        const invalidJsonStrings = [
            'not json',
            '{invalid}',
            '{"sessionAttributes": "not an object"}',
            ''
        ];

        for (const invalidJson of invalidJsonStrings) {
            const result = safeDeserializeSessionState(invalidJson);
            expect(result.success).toBe(false);
        }
    });

    it('should create valid empty session state with factory function', () => {
        fc.assert(
            fc.property(fc.webUrl(), (url) => {
                const emptyState = createEmptySessionState(url);

                // Should pass validation
                const result = safeParseSessionState(emptyState);
                expect(result.success).toBe(true);

                // Should have correct initial values
                expect(emptyState.sessionAttributes.current_url).toBe(url);
                expect(JSON.parse(emptyState.sessionAttributes.pending_violations)).toEqual([]);
                expect(emptyState.sessionAttributes.current_violation_id).toBeNull();
                expect(emptyState.sessionAttributes.retry_attempts).toBe(0);
                expect(emptyState.sessionAttributes.human_handoff_reason).toBeNull();
                expect(JSON.parse(emptyState.sessionAttributes.fixed_violations)).toEqual([]);
                expect(JSON.parse(emptyState.sessionAttributes.skipped_violations)).toEqual([]);
            }),
            { numRuns: 100 }
        );
    });
});
