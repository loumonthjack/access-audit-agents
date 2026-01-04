/**
 * Property-based tests for AuditLogger
 * 
 * Feature: agent-orchestration, Property 11: Audit Logging with Snapshots
 * Validates: Requirements 5.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AuditLogger } from '../services/audit-logger.js';
import { fixInstructionArb } from '../__generators__/fix-instruction.generator.js';
import type { AuditLogResult } from '../types/index.js';

describe('Feature: agent-orchestration, Property 11: Audit Logging with Snapshots', () => {
    let logger: AuditLogger;

    beforeEach(() => {
        logger = new AuditLogger();
    });

    /**
     * Property 11: Audit Logging with Snapshots
     * 
     * For any fix that is successfully applied, an AuditLogEntry SHALL be
     * created containing: timestamp, sessionId, violationId, instruction,
     * beforeHtml, afterHtml, and result.
     * 
     * Validates: Requirements 5.4
     */
    it('should create audit log entries with all required fields', () => {
        fc.assert(
            fc.property(
                fixInstructionArb,
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 500 }),
                fc.string({ minLength: 1, maxLength: 500 }),
                fc.constantFrom('applied', 'rejected', 'rolled_back') as fc.Arbitrary<AuditLogResult>,
                (instruction, sessionId, violationId, beforeHtml, afterHtml, result) => {
                    const entry = logger.createEntry(
                        sessionId,
                        violationId,
                        instruction,
                        beforeHtml,
                        afterHtml,
                        result
                    );

                    // Verify all required fields are present
                    expect(entry.timestamp).toBeDefined();
                    expect(typeof entry.timestamp).toBe('string');
                    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);

                    expect(entry.sessionId).toBe(sessionId);
                    expect(entry.violationId).toBe(violationId);
                    expect(entry.instruction).toEqual(instruction);
                    expect(entry.beforeHtml).toBe(beforeHtml);
                    expect(entry.afterHtml).toBe(afterHtml);
                    expect(entry.result).toBe(result);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should store and retrieve logs by sessionId', () => {
        fc.assert(
            fc.property(
                fixInstructionArb,
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                (instruction, sessionId, violationId) => {
                    // Log an entry
                    const entry = logger.log(
                        sessionId,
                        violationId,
                        instruction,
                        '<div>before</div>',
                        '<div>after</div>',
                        'applied'
                    );

                    // Retrieve by sessionId
                    const logs = logger.getBySessionId(sessionId);

                    expect(logs.length).toBeGreaterThan(0);
                    expect(logs).toContainEqual(entry);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should store before/after HTML snapshots correctly', () => {
        fc.assert(
            fc.property(
                fixInstructionArb,
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 1000 }),
                fc.string({ minLength: 1, maxLength: 1000 }),
                (instruction, sessionId, beforeHtml, afterHtml) => {
                    // Create a fresh logger for each property run
                    const freshLogger = new AuditLogger();

                    const entry = freshLogger.log(
                        sessionId,
                        'violation-1',
                        instruction,
                        beforeHtml,
                        afterHtml,
                        'applied'
                    );

                    // Verify snapshots are stored exactly as provided
                    expect(entry.beforeHtml).toBe(beforeHtml);
                    expect(entry.afterHtml).toBe(afterHtml);

                    // Verify they can be retrieved
                    const logs = freshLogger.getBySessionId(sessionId);
                    const retrieved = logs.find(l => l.timestamp === entry.timestamp);
                    expect(retrieved?.beforeHtml).toBe(beforeHtml);
                    expect(retrieved?.afterHtml).toBe(afterHtml);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should track all result types correctly', () => {
        const resultTypes: AuditLogResult[] = ['applied', 'rejected', 'rolled_back'];

        fc.assert(
            fc.property(
                fixInstructionArb,
                fc.string({ minLength: 1, maxLength: 50 }),
                (instruction, sessionId) => {
                    // Log entries with each result type
                    for (const result of resultTypes) {
                        logger.log(
                            sessionId,
                            `violation-${result}`,
                            instruction,
                            '<div>before</div>',
                            '<div>after</div>',
                            result
                        );
                    }

                    // Verify each result type can be filtered
                    for (const result of resultTypes) {
                        const filtered = logger.getByResult(sessionId, result);
                        expect(filtered.length).toBeGreaterThan(0);
                        expect(filtered.every(l => l.result === result)).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should provide accurate summary statistics', () => {
        fc.assert(
            fc.property(
                fc.array(fixInstructionArb, { minLength: 1, maxLength: 10 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                (instructions, sessionId) => {
                    // Create a fresh logger for each property run to ensure isolation
                    const freshLogger = new AuditLogger();

                    let appliedCount = 0;
                    let rejectedCount = 0;
                    let rolledBackCount = 0;

                    // Log entries with random results
                    for (let i = 0; i < instructions.length; i++) {
                        const resultIndex = i % 3;
                        const result: AuditLogResult =
                            resultIndex === 0 ? 'applied' :
                                resultIndex === 1 ? 'rejected' : 'rolled_back';

                        if (result === 'applied') appliedCount++;
                        else if (result === 'rejected') rejectedCount++;
                        else rolledBackCount++;

                        freshLogger.log(
                            sessionId,
                            `violation-${i}`,
                            instructions[i],
                            '<div>before</div>',
                            '<div>after</div>',
                            result
                        );
                    }

                    // Verify summary
                    const summary = freshLogger.getSummary(sessionId);
                    expect(summary.total).toBe(instructions.length);
                    expect(summary.applied).toBe(appliedCount);
                    expect(summary.rejected).toBe(rejectedCount);
                    expect(summary.rolledBack).toBe(rolledBackCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should filter logs by violationId correctly', () => {
        fc.assert(
            fc.property(
                fixInstructionArb,
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                (instruction, sessionId, violationId) => {
                    // Log multiple entries for same violation
                    logger.log(sessionId, violationId, instruction, '<div>1</div>', '<div>2</div>', 'applied');
                    logger.log(sessionId, violationId, instruction, '<div>2</div>', '<div>3</div>', 'rejected');
                    logger.log(sessionId, 'other-violation', instruction, '<div>a</div>', '<div>b</div>', 'applied');

                    // Filter by violationId
                    const filtered = logger.getByViolationId(sessionId, violationId);

                    expect(filtered.length).toBe(2);
                    expect(filtered.every(l => l.violationId === violationId)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should clear session logs correctly', () => {
        fc.assert(
            fc.property(
                fixInstructionArb,
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                (instruction, sessionId1, sessionId2) => {
                    // Ensure different session IDs
                    const session2 = sessionId1 === sessionId2 ? `${sessionId2}-alt` : sessionId2;

                    // Log entries for both sessions
                    logger.log(sessionId1, 'v1', instruction, '<div>1</div>', '<div>2</div>', 'applied');
                    logger.log(session2, 'v2', instruction, '<div>a</div>', '<div>b</div>', 'applied');

                    // Clear first session
                    logger.clearSession(sessionId1);

                    // Verify first session is cleared
                    expect(logger.getBySessionId(sessionId1)).toHaveLength(0);

                    // Verify second session is intact
                    expect(logger.getBySessionId(session2).length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return empty array for non-existent sessionId', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }),
                (sessionId) => {
                    const logs = logger.getBySessionId(sessionId);
                    expect(logs).toEqual([]);
                }
            ),
            { numRuns: 100 }
        );
    });
});
