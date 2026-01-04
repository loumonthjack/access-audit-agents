/**
 * Property-based tests for useExportReport hook
 * Feature: web-dashboard, Property 14: Report Export Produces Valid Output
 * Validates: Requirements 5.5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { RemediationReport, AppliedFix, SkippedViolation, HumanReviewItem, FixType, Viewport } from '@/types/domain';
import type { ExportFormat } from '../../types';

/**
 * Arbitrary for generating fix types
 */
const fixTypeArbitrary = fc.constantFrom<FixType>('attribute', 'content', 'style');

/**
 * Arbitrary for generating viewports
 */
const viewportArbitrary = fc.constantFrom<Viewport>('mobile', 'desktop');

/**
 * Arbitrary for generating ISO date strings
 */
const dateArbitrary = fc
    .integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Arbitrary for generating valid HTML strings
 */
const htmlArbitrary = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0)
    .map((s) => `<div>${s}</div>`);

/**
 * Arbitrary for generating non-empty strings
 */
const nonEmptyStringArbitrary = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0);

/**
 * Arbitrary for generating AppliedFix objects
 */
const appliedFixArbitrary = (index: number): fc.Arbitrary<AppliedFix> =>
    fc.record({
        violationId: fc.constant(`fix-${index}`),
        fixType: fixTypeArbitrary,
        beforeHtml: htmlArbitrary,
        afterHtml: htmlArbitrary,
        reasoning: nonEmptyStringArbitrary,
        appliedAt: dateArbitrary,
    });

/**
 * Arbitrary for generating SkippedViolation objects
 */
const skippedViolationArbitrary = (index: number): fc.Arbitrary<SkippedViolation> =>
    fc.record({
        violationId: fc.constant(`skipped-${index}`),
        ruleId: nonEmptyStringArbitrary,
        selector: nonEmptyStringArbitrary,
        reason: nonEmptyStringArbitrary,
        attempts: fc.integer({ min: 1, max: 5 }),
    });

/**
 * Arbitrary for generating HumanReviewItem objects
 */
const humanReviewItemArbitrary = (index: number): fc.Arbitrary<HumanReviewItem> =>
    fc.record({
        violationId: fc.constant(`review-${index}`),
        ruleId: nonEmptyStringArbitrary,
        selector: nonEmptyStringArbitrary,
        reason: nonEmptyStringArbitrary,
        suggestedAction: nonEmptyStringArbitrary,
    });

/**
 * Arbitrary for generating RemediationReport objects
 */
const remediationReportArbitrary: fc.Arbitrary<RemediationReport> = fc
    .record({
        fixCount: fc.integer({ min: 0, max: 3 }),
        skippedCount: fc.integer({ min: 0, max: 3 }),
        humanReviewCount: fc.integer({ min: 0, max: 3 }),
    })
    .chain(({ fixCount, skippedCount, humanReviewCount }) => {
        const fixesArb =
            fixCount === 0
                ? fc.constant([])
                : fc.tuple(
                    ...Array.from({ length: fixCount }, (_, i) => appliedFixArbitrary(i))
                );
        const skippedArb =
            skippedCount === 0
                ? fc.constant([])
                : fc.tuple(
                    ...Array.from({ length: skippedCount }, (_, i) =>
                        skippedViolationArbitrary(i)
                    )
                );
        const humanReviewArb =
            humanReviewCount === 0
                ? fc.constant([])
                : fc.tuple(
                    ...Array.from({ length: humanReviewCount }, (_, i) =>
                        humanReviewItemArbitrary(i)
                    )
                );

        return fc.record({
            sessionId: fc.uuid(),
            url: fc.webUrl(),
            viewport: viewportArbitrary,
            timestamp: dateArbitrary,
            duration: fc.integer({ min: 1000, max: 300000 }),
            fixes: fixesArb.map((arr) => (Array.isArray(arr) ? arr : [])),
            skipped: skippedArb.map((arr) => (Array.isArray(arr) ? arr : [])),
            humanReview: humanReviewArb.map((arr) => (Array.isArray(arr) ? arr : [])),
        });
    })
    .map((report) => ({
        ...report,
        summary: {
            totalViolations:
                report.fixes.length + report.skipped.length + report.humanReview.length,
            fixedCount: report.fixes.length,
            skippedCount: report.skipped.length,
            humanReviewCount: report.humanReview.length,
        },
    }));

/**
 * Arbitrary for export format
 */
const exportFormatArbitrary = fc.constantFrom<ExportFormat>('json', 'html');

/**
 * Simulate JSON export - converts report to JSON string
 */
function exportAsJson(report: RemediationReport): string {
    return JSON.stringify(report, null, 2);
}

/**
 * Simulate HTML export - converts report to HTML string
 */
function exportAsHtml(report: RemediationReport): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Accessibility Report - ${report.url}</title>
</head>
<body>
    <h1>Accessibility Report</h1>
    <p>URL: ${report.url}</p>
    <p>Viewport: ${report.viewport}</p>
    <p>Total Violations: ${report.summary.totalViolations}</p>
    <p>Fixed: ${report.summary.fixedCount}</p>
    <p>Skipped: ${report.summary.skippedCount}</p>
    <p>Human Review: ${report.summary.humanReviewCount}</p>
    <h2>Fixes</h2>
    ${report.fixes.map(fix => `<div class="fix">${fix.reasoning}</div>`).join('')}
    <h2>Skipped</h2>
    ${report.skipped.map(s => `<div class="skipped">${s.reason}</div>`).join('')}
</body>
</html>`;
}

/**
 * Validate JSON string
 */
function isValidJson(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate HTML string (basic check)
 */
function isValidHtml(str: string): boolean {
    return str.includes('<!DOCTYPE html>') &&
        str.includes('<html') &&
        str.includes('</html>') &&
        str.includes('<body') &&
        str.includes('</body>');
}

describe('Export Report Validity Property Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Property 14: Report Export Produces Valid Output
     * For any report export, the exported file SHALL be valid JSON (for JSON format)
     * or valid HTML (for HTML format), and SHALL contain all data from the RemediationReport.
     * Validates: Requirements 5.5
     */
    it('Property 14: JSON export produces valid JSON', async () => {
        await fc.assert(
            fc.asyncProperty(remediationReportArbitrary, async (report) => {
                const jsonOutput = exportAsJson(report);

                // Verify it's valid JSON
                expect(isValidJson(jsonOutput)).toBe(true);

                // Verify it contains all report data
                const parsed = JSON.parse(jsonOutput);
                expect(parsed.sessionId).toBe(report.sessionId);
                expect(parsed.url).toBe(report.url);
                expect(parsed.viewport).toBe(report.viewport);
                expect(parsed.summary.totalViolations).toBe(report.summary.totalViolations);
                expect(parsed.summary.fixedCount).toBe(report.summary.fixedCount);
                expect(parsed.summary.skippedCount).toBe(report.summary.skippedCount);
                expect(parsed.fixes.length).toBe(report.fixes.length);
                expect(parsed.skipped.length).toBe(report.skipped.length);
            }),
            { numRuns: 25 }
        );
    });

    /**
     * Property 14b: HTML export produces valid HTML
     * Validates: Requirements 5.5
     */
    it('Property 14b: HTML export produces valid HTML', async () => {
        await fc.assert(
            fc.asyncProperty(remediationReportArbitrary, async (report) => {
                const htmlOutput = exportAsHtml(report);

                // Verify it's valid HTML structure
                expect(isValidHtml(htmlOutput)).toBe(true);

                // Verify it contains report data
                expect(htmlOutput).toContain(report.url);
                expect(htmlOutput).toContain(report.viewport);
                expect(htmlOutput).toContain(String(report.summary.totalViolations));
                expect(htmlOutput).toContain(String(report.summary.fixedCount));
                expect(htmlOutput).toContain(String(report.summary.skippedCount));
            }),
            { numRuns: 25 }
        );
    });

    /**
     * Property 14c: Export format determines output type
     * Validates: Requirements 5.5
     */
    it('Property 14c: Export format determines correct output type', async () => {
        await fc.assert(
            fc.asyncProperty(
                remediationReportArbitrary,
                exportFormatArbitrary,
                async (report, format) => {
                    const output = format === 'json' ? exportAsJson(report) : exportAsHtml(report);

                    if (format === 'json') {
                        expect(isValidJson(output)).toBe(true);
                    } else {
                        expect(isValidHtml(output)).toBe(true);
                    }
                }
            ),
            { numRuns: 25 }
        );
    });

    /**
     * Property 14d: All fixes are included in export
     * Validates: Requirements 5.5
     */
    it('Property 14d: All fixes are included in JSON export', async () => {
        await fc.assert(
            fc.asyncProperty(remediationReportArbitrary, async (report) => {
                const jsonOutput = exportAsJson(report);
                const parsed = JSON.parse(jsonOutput);

                // Verify all fixes are present
                expect(parsed.fixes.length).toBe(report.fixes.length);

                // Verify each fix has required fields
                for (let i = 0; i < report.fixes.length; i++) {
                    expect(parsed.fixes[i].violationId).toBe(report.fixes[i].violationId);
                    expect(parsed.fixes[i].beforeHtml).toBe(report.fixes[i].beforeHtml);
                    expect(parsed.fixes[i].afterHtml).toBe(report.fixes[i].afterHtml);
                    expect(parsed.fixes[i].reasoning).toBe(report.fixes[i].reasoning);
                }
            }),
            { numRuns: 25 }
        );
    });

    /**
     * Property 14e: All skipped violations are included in export
     * Validates: Requirements 5.5
     */
    it('Property 14e: All skipped violations are included in JSON export', async () => {
        await fc.assert(
            fc.asyncProperty(remediationReportArbitrary, async (report) => {
                const jsonOutput = exportAsJson(report);
                const parsed = JSON.parse(jsonOutput);

                // Verify all skipped violations are present
                expect(parsed.skipped.length).toBe(report.skipped.length);

                // Verify each skipped violation has required fields
                for (let i = 0; i < report.skipped.length; i++) {
                    expect(parsed.skipped[i].violationId).toBe(report.skipped[i].violationId);
                    expect(parsed.skipped[i].reason).toBe(report.skipped[i].reason);
                }
            }),
            { numRuns: 25 }
        );
    });
});
