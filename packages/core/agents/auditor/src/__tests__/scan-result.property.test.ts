/**
 * Property-based tests for ScanResult structure
 * 
 * Feature: core-auditor-agent
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    ScanResultSchema,
    validateScanResult,
    safeParseScanResult,
    SCHEMA_VERSION
} from '../types/index.js';
import {
    scanResultArb,
    scanResultWithViolationCount
} from '../__generators__/scan-result.generator.js';
import { violationArb } from '../__generators__/violation.generator.js';

describe('ScanResult Structure Completeness', () => {
    /**
     * Feature: core-auditor-agent, Property 1: ScanResult Structure Completeness
     * 
     * For any axe-core scan output, the transformed ScanResult SHALL contain:
     * - All violations with id, impact, description, help, helpUrl, and nodes array
     * - All nodes with selector, html, failureSummary, and target
     * - Metadata with url, timestamp, viewport, and violationCounts
     * - Schema version field
     * 
     * Validates: Requirements 2.1, 2.2, 2.4, 3.4, 6.3
     */
    it('Property 1: ScanResult contains all required fields', () => {
        fc.assert(
            fc.property(scanResultArb, (scanResult) => {
                // Verify schema version
                expect(scanResult.schemaVersion).toBe(SCHEMA_VERSION);

                // Verify metadata structure
                expect(scanResult.metadata).toBeDefined();
                expect(typeof scanResult.metadata.url).toBe('string');
                expect(typeof scanResult.metadata.timestamp).toBe('string');
                expect(['mobile', 'desktop']).toContain(scanResult.metadata.viewport);

                // Verify violation counts structure
                const counts = scanResult.metadata.violationCounts;
                expect(typeof counts.critical).toBe('number');
                expect(typeof counts.serious).toBe('number');
                expect(typeof counts.moderate).toBe('number');
                expect(typeof counts.minor).toBe('number');
                expect(typeof counts.total).toBe('number');

                // Verify violations array
                expect(Array.isArray(scanResult.violations)).toBe(true);

                // Verify each violation has required fields
                for (const violation of scanResult.violations) {
                    expect(typeof violation.id).toBe('string');
                    expect(['critical', 'serious', 'moderate', 'minor']).toContain(violation.impact);
                    expect(typeof violation.description).toBe('string');
                    expect(typeof violation.help).toBe('string');
                    expect(typeof violation.helpUrl).toBe('string');
                    expect(Array.isArray(violation.nodes)).toBe(true);

                    // Verify each node has required fields
                    for (const node of violation.nodes) {
                        expect(typeof node.selector).toBe('string');
                        expect(typeof node.html).toBe('string');
                        expect(typeof node.failureSummary).toBe('string');
                        expect(Array.isArray(node.target)).toBe(true);
                    }
                }

                // Verify pagination structure
                expect(scanResult.pagination).toBeDefined();
                expect(typeof scanResult.pagination.currentPage).toBe('number');
                expect(typeof scanResult.pagination.totalPages).toBe('number');
                expect(typeof scanResult.pagination.pageSize).toBe('number');
                expect(typeof scanResult.pagination.hasMoreViolations).toBe('boolean');

                return true;
            }),
            { numRuns: 100 }
        );
    });


    /**
     * Feature: core-auditor-agent, Property 1 (continued): Generated ScanResults pass Zod validation
     * 
     * Validates: Requirements 2.1, 2.2, 2.4, 3.4, 6.3
     */
    it('Property 1: All generated ScanResults pass Zod schema validation', () => {
        fc.assert(
            fc.property(scanResultArb, (scanResult) => {
                // Should not throw
                const validated = validateScanResult(scanResult);
                expect(validated).toEqual(scanResult);

                // Safe parse should succeed
                const result = safeParseScanResult(scanResult);
                expect(result.success).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: core-auditor-agent, Property 1 (continued): Violation counts are consistent
     * 
     * Validates: Requirements 2.4
     */
    it('Property 1: Violation counts total equals sum of individual counts', () => {
        fc.assert(
            fc.property(scanResultArb, (scanResult) => {
                const counts = scanResult.metadata.violationCounts;
                const sum = counts.critical + counts.serious + counts.moderate + counts.minor;
                expect(counts.total).toBe(sum);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: core-auditor-agent, Property 1 (continued): Each violation has at least one node
     * 
     * Validates: Requirements 2.2
     */
    it('Property 1: Each violation has at least one affected node', () => {
        fc.assert(
            fc.property(violationArb, (violation) => {
                expect(violation.nodes.length).toBeGreaterThanOrEqual(1);

                return true;
            }),
            { numRuns: 100 }
        );
    });
});
