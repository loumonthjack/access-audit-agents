/**
 * Property-based tests for Report Completeness
 * 
 * Feature: agent-orchestration, Property 14: Report Completeness
 * Validates: Requirements 9.1, 9.2, 9.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
    ReportGenerator,
    createReportFromSession,
    isRemediationComplete,
    type ViolationMetadata
} from '../services/report-generator.js';
import { SessionStateManager } from '../services/session-state-manager.js';
import { AuditLogger } from '../services/audit-logger.js';
import type {
    AppliedFix,
    SkippedViolation,
    HumanHandoffItem,
    FixInstruction,
    RemediationReport
} from '../types/index.js';
import {
    appliedFixArb,
    skippedViolationArb,
    humanHandoffItemArb,
    sessionIdArb,
    urlArb
} from '../__generators__/remediation-report.generator.js';
import { fixInstructionArb } from '../__generators__/fix-instruction.generator.js';

describe('Feature: agent-orchestration, Property 14: Report Completeness', () => {
    /**
     * Property 14: Report Completeness
     * 
     * For any RemediationReport, it SHALL contain:
     * - All items from fixed_violations with full fix details (violation_id, selector, fix_type, before_html, after_html)
     * - All items from skipped_violations with reasons
     * - All human_handoff items with reasons
     * 
     * Validates: Requirements 9.1, 9.2, 9.4
     */

    describe('Fixed violations completeness', () => {
        it('should include all added fixes with complete details', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    fc.array(appliedFixArb, { minLength: 1, maxLength: 10 }),
                    (sessionId, url, fixes) => {
                        const generator = new ReportGenerator(sessionId, url);

                        // Add all fixes
                        for (const fix of fixes) {
                            generator.addFix(fix);
                        }

                        const report = generator.generate();

                        // Verify all fixes are included
                        expect(report.fixes.length).toBe(fixes.length);

                        // Verify each fix has complete details (Requirements 9.2)
                        for (let i = 0; i < fixes.length; i++) {
                            const reportedFix = report.fixes[i];
                            const originalFix = fixes[i];

                            // violation_id
                            expect(reportedFix.violationId).toBe(originalFix.violationId);
                            // selector
                            expect(reportedFix.selector).toBe(originalFix.selector);
                            // fix_type
                            expect(reportedFix.fixType).toBe(originalFix.fixType);
                            // before_html
                            expect(reportedFix.beforeHtml).toBe(originalFix.beforeHtml);
                            // after_html
                            expect(reportedFix.afterHtml).toBe(originalFix.afterHtml);
                            // reasoning
                            expect(reportedFix.reasoning).toBe(originalFix.reasoning);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve fix details through report generation', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    appliedFixArb,
                    (sessionId, url, fix) => {
                        const generator = new ReportGenerator(sessionId, url);
                        generator.addFix(fix);

                        const report = generator.generate();

                        // The fix should be exactly preserved
                        expect(report.fixes[0]).toEqual(fix);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Skipped violations completeness', () => {
        it('should include all skipped violations with reasons', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    fc.array(skippedViolationArb, { minLength: 1, maxLength: 10 }),
                    (sessionId, url, skippedViolations) => {
                        const generator = new ReportGenerator(sessionId, url);

                        // Add all skipped violations
                        for (const skipped of skippedViolations) {
                            generator.addSkipped(skipped);
                        }

                        const report = generator.generate();

                        // Verify all skipped violations are included
                        expect(report.skipped.length).toBe(skippedViolations.length);

                        // Verify each skipped violation has reason (Requirements 9.1)
                        for (let i = 0; i < skippedViolations.length; i++) {
                            const reportedSkipped = report.skipped[i];
                            const originalSkipped = skippedViolations[i];

                            expect(reportedSkipped.violationId).toBe(originalSkipped.violationId);
                            expect(reportedSkipped.reason).toBe(originalSkipped.reason);
                            expect(reportedSkipped.reason.length).toBeGreaterThan(0);
                            expect(reportedSkipped.attempts).toBe(originalSkipped.attempts);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Human handoff completeness', () => {
        it('should include all human handoff items with reasons', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    fc.array(humanHandoffItemArb, { minLength: 1, maxLength: 5 }),
                    (sessionId, url, handoffItems) => {
                        const generator = new ReportGenerator(sessionId, url);

                        // Add all handoff items
                        for (const handoff of handoffItems) {
                            generator.addHumanHandoff(handoff);
                        }

                        const report = generator.generate();

                        // Verify all handoff items are included
                        expect(report.humanHandoff.length).toBe(handoffItems.length);

                        // Verify each handoff item has reason (Requirements 9.4)
                        for (let i = 0; i < handoffItems.length; i++) {
                            const reportedHandoff = report.humanHandoff[i];
                            const originalHandoff = handoffItems[i];

                            expect(reportedHandoff.violationId).toBe(originalHandoff.violationId);
                            expect(reportedHandoff.reason).toBe(originalHandoff.reason);
                            expect(reportedHandoff.reason.length).toBeGreaterThan(0);
                            expect(reportedHandoff.suggestedAction).toBe(originalHandoff.suggestedAction);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Combined report completeness', () => {
        it('should include all items from all categories', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    fc.array(appliedFixArb, { maxLength: 10 }),
                    fc.array(skippedViolationArb, { maxLength: 5 }),
                    fc.array(humanHandoffItemArb, { maxLength: 3 }),
                    fc.nat({ max: 5 }),
                    (sessionId, url, fixes, skipped, handoff, pendingCount) => {
                        const generator = new ReportGenerator(sessionId, url);

                        // Add all items
                        for (const fix of fixes) {
                            generator.addFix(fix);
                        }
                        for (const skip of skipped) {
                            generator.addSkipped(skip);
                        }
                        for (const hand of handoff) {
                            generator.addHumanHandoff(hand);
                        }
                        generator.setPendingCount(pendingCount);

                        const report = generator.generate();

                        // Verify completeness
                        expect(report.fixes.length).toBe(fixes.length);
                        expect(report.skipped.length).toBe(skipped.length);
                        expect(report.humanHandoff.length).toBe(handoff.length);
                        expect(report.summary.pendingCount).toBe(pendingCount);

                        // Verify summary accuracy
                        expect(report.summary.fixedCount).toBe(fixes.length);
                        expect(report.summary.skippedCount).toBe(skipped.length);
                        expect(report.summary.totalViolations).toBe(
                            fixes.length + skipped.length + pendingCount
                        );
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate valid report that passes schema validation', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    fc.array(appliedFixArb, { maxLength: 5 }),
                    fc.array(skippedViolationArb, { maxLength: 3 }),
                    fc.array(humanHandoffItemArb, { maxLength: 2 }),
                    (sessionId, url, fixes, skipped, handoff) => {
                        const generator = new ReportGenerator(sessionId, url);

                        for (const fix of fixes) {
                            generator.addFix(fix);
                        }
                        for (const skip of skipped) {
                            generator.addSkipped(skip);
                        }
                        for (const hand of handoff) {
                            generator.addHumanHandoff(hand);
                        }

                        // generate() validates against schema internally
                        // If it doesn't throw, the report is valid
                        expect(() => generator.generate()).not.toThrow();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Report metadata completeness', () => {
        it('should include session ID and URL in report', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    (sessionId, url) => {
                        const generator = new ReportGenerator(sessionId, url);
                        const report = generator.generate();

                        expect(report.sessionId).toBe(sessionId);
                        expect(report.url).toBe(url);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should include valid timestamp in report', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    (sessionId, url) => {
                        const beforeTime = new Date();
                        const generator = new ReportGenerator(sessionId, url);
                        const report = generator.generate();
                        const afterTime = new Date();

                        // Timestamp should be a valid ISO string
                        const timestamp = new Date(report.timestamp);
                        expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
                        expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Completion detection', () => {
        it('should detect completion when pending count is zero', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    fc.array(appliedFixArb, { maxLength: 5 }),
                    fc.array(skippedViolationArb, { maxLength: 3 }),
                    (sessionId, url, fixes, skipped) => {
                        const generator = new ReportGenerator(sessionId, url);

                        for (const fix of fixes) {
                            generator.addFix(fix);
                        }
                        for (const skip of skipped) {
                            generator.addSkipped(skip);
                        }

                        // With pending count = 0, should be complete
                        generator.setPendingCount(0);
                        expect(generator.isComplete()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should not be complete when pending count is greater than zero', () => {
            fc.assert(
                fc.property(
                    sessionIdArb,
                    urlArb,
                    fc.integer({ min: 1, max: 10 }),
                    (sessionId, url, pendingCount) => {
                        const generator = new ReportGenerator(sessionId, url);
                        generator.setPendingCount(pendingCount);

                        expect(generator.isComplete()).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
