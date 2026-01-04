/**
 * Property-based tests for RemediationReport
 * 
 * Feature: agent-orchestration, Property 15: Report Count Accuracy
 * Validates: Requirements 9.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    RemediationReportSchema,
    validateRemediationReport,
    safeParseRemediationReport,
    serializeRemediationReport,
    deserializeRemediationReport,
    safeDeserializeRemediationReport,
    createEmptyRemediationReport,
    type RemediationReport
} from '../types/index.js';
import {
    remediationReportArb,
    remediationReportWithCounts,
    appliedFixArb,
    skippedViolationArb,
    humanHandoffItemArb,
    reportSummaryFromArrays
} from '../__generators__/remediation-report.generator.js';

describe('Feature: agent-orchestration, Property 15: Report Count Accuracy', () => {
    /**
     * Property 15: Report Count Accuracy
     * 
     * For any RemediationReport, the summary counts SHALL satisfy:
     * - total_violations = fixed_count + skipped_count + pending_count
     * - These counts SHALL match the actual lengths of the corresponding arrays
     * 
     * Validates: Requirements 9.3
     */
    it('should have accurate counts matching array lengths', () => {
        fc.assert(
            fc.property(remediationReportArb, (report) => {
                // Validate the report passes schema validation
                const result = safeParseRemediationReport(report);
                expect(result.success).toBe(true);

                // Verify fixedCount matches fixes array length
                expect(report.summary.fixedCount).toBe(report.fixes.length);

                // Verify skippedCount matches skipped array length
                expect(report.summary.skippedCount).toBe(report.skipped.length);

                // Verify totalViolations = fixedCount + skippedCount + pendingCount
                const expectedTotal = report.summary.fixedCount +
                    report.summary.skippedCount +
                    report.summary.pendingCount;
                expect(report.summary.totalViolations).toBe(expectedTotal);
            }),
            { numRuns: 100 }
        );
    });

    it('should maintain count accuracy for reports with specific counts', () => {
        fc.assert(
            fc.property(
                fc.nat({ max: 20 }),
                fc.nat({ max: 10 }),
                fc.nat({ max: 5 }),
                (fixedCount, skippedCount, pendingCount) => {
                    // Generate a report with specific counts
                    fc.assert(
                        fc.property(
                            remediationReportWithCounts(fixedCount, skippedCount, pendingCount),
                            (report) => {
                                expect(report.fixes.length).toBe(fixedCount);
                                expect(report.skipped.length).toBe(skippedCount);
                                expect(report.summary.fixedCount).toBe(fixedCount);
                                expect(report.summary.skippedCount).toBe(skippedCount);
                                expect(report.summary.pendingCount).toBe(pendingCount);
                                expect(report.summary.totalViolations).toBe(
                                    fixedCount + skippedCount + pendingCount
                                );
                            }
                        ),
                        { numRuns: 5 }
                    );
                }
            ),
            { numRuns: 20 }
        );
    });

    it('should serialize and deserialize report correctly (round-trip)', () => {
        fc.assert(
            fc.property(remediationReportArb, (report) => {
                const serialized = serializeRemediationReport(report);
                const deserialized = deserializeRemediationReport(serialized);

                expect(deserialized).toEqual(report);
            }),
            { numRuns: 100 }
        );
    });

    it('should safely handle invalid JSON during deserialization', () => {
        const invalidJsonStrings = [
            'not json',
            '{invalid}',
            '{"sessionId": 123}', // wrong type
            ''
        ];

        for (const invalidJson of invalidJsonStrings) {
            const result = safeDeserializeRemediationReport(invalidJson);
            expect(result.success).toBe(false);
        }
    });

    it('should create valid empty report with factory function', () => {
        fc.assert(
            fc.property(fc.uuid(), fc.webUrl(), (sessionId, url) => {
                const emptyReport = createEmptyRemediationReport(sessionId, url);

                // Should pass validation
                const result = safeParseRemediationReport(emptyReport);
                expect(result.success).toBe(true);

                // Should have correct initial values
                expect(emptyReport.sessionId).toBe(sessionId);
                expect(emptyReport.url).toBe(url);
                expect(emptyReport.fixes).toEqual([]);
                expect(emptyReport.skipped).toEqual([]);
                expect(emptyReport.humanHandoff).toEqual([]);

                // Counts should all be zero
                expect(emptyReport.summary.totalViolations).toBe(0);
                expect(emptyReport.summary.fixedCount).toBe(0);
                expect(emptyReport.summary.skippedCount).toBe(0);
                expect(emptyReport.summary.pendingCount).toBe(0);
            }),
            { numRuns: 100 }
        );
    });

    it('should correctly compute summary from arrays using helper function', () => {
        fc.assert(
            fc.property(
                fc.array(appliedFixArb, { maxLength: 15 }),
                fc.array(skippedViolationArb, { maxLength: 10 }),
                fc.nat({ max: 5 }),
                (fixes, skipped, pending) => {
                    const summary = reportSummaryFromArrays(fixes, skipped, pending);

                    expect(summary.fixedCount).toBe(fixes.length);
                    expect(summary.skippedCount).toBe(skipped.length);
                    expect(summary.pendingCount).toBe(pending);
                    expect(summary.totalViolations).toBe(
                        fixes.length + skipped.length + pending
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
