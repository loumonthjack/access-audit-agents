/**
 * fast-check arbitraries for ScanResult and related types
 * 
 * Feature: core-auditor-agent
 */

import * as fc from 'fast-check';
import type {
    ScanResult,
    ScanMetadata,
    PaginationInfo,
    Viewport,
    ViolationCounts,
    ImpactLevel
} from '../types/index.js';
import { SCHEMA_VERSION } from '../types/index.js';
import { violationsArb } from './violation.generator.js';

/**
 * Generates a valid URL string
 */
export const urlArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('https://example.com'),
    fc.constant('https://test.example.org/page'),
    fc.constant('https://www.example.net/path/to/page'),
    fc.webUrl()
);

/**
 * Generates an ISO 8601 timestamp
 */
export const timestampArb: fc.Arbitrary<string> = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31')
}).map(d => d.toISOString());

/**
 * Generates a Viewport value
 */
export const viewportArb: fc.Arbitrary<Viewport> = fc.constantFrom('mobile', 'desktop');

/**
 * Generates ViolationCounts that are consistent with a given violations array
 */
export function violationCountsFromViolations(violations: { impact: ImpactLevel }[]): ViolationCounts {
    const counts: ViolationCounts = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        total: violations.length
    };

    for (const v of violations) {
        counts[v.impact]++;
    }

    return counts;
}


/**
 * Generates arbitrary ViolationCounts
 */
export const violationCountsArb: fc.Arbitrary<ViolationCounts> = fc.record({
    critical: fc.nat({ max: 20 }),
    serious: fc.nat({ max: 20 }),
    moderate: fc.nat({ max: 20 }),
    minor: fc.nat({ max: 20 })
}).map(counts => ({
    ...counts,
    total: counts.critical + counts.serious + counts.moderate + counts.minor
}));

/**
 * Generates PaginationInfo
 */
export const paginationInfoArb: fc.Arbitrary<PaginationInfo> = fc.record({
    currentPage: fc.integer({ min: 1, max: 100 }),
    totalPages: fc.integer({ min: 0, max: 100 }),
    pageSize: fc.constant(10),
    hasMoreViolations: fc.boolean()
});

/**
 * Generates consistent PaginationInfo based on total violations and current page
 */
export function paginationInfoFromViolations(
    totalViolations: number,
    currentPage: number,
    pageSize: number = 10
): PaginationInfo {
    const totalPages = Math.ceil(totalViolations / pageSize);
    return {
        currentPage,
        totalPages,
        pageSize,
        hasMoreViolations: currentPage < totalPages
    };
}

/**
 * Generates ScanMetadata
 */
export const scanMetadataArb: fc.Arbitrary<ScanMetadata> = fc.record({
    url: urlArb,
    timestamp: timestampArb,
    viewport: viewportArb,
    violationCounts: violationCountsArb
});

/**
 * Generates a complete, valid ScanResult
 */
export const scanResultArb: fc.Arbitrary<ScanResult> = violationsArb({ maxLength: 30 })
    .chain(violations => {
        const violationCounts = violationCountsFromViolations(violations);
        const totalPages = Math.ceil(violations.length / 10) || 1;

        return fc.record({
            schemaVersion: fc.constant(SCHEMA_VERSION),
            metadata: fc.record({
                url: urlArb,
                timestamp: timestampArb,
                viewport: viewportArb,
                violationCounts: fc.constant(violationCounts)
            }),
            violations: fc.constant(violations.slice(0, 10)), // First page only
            pagination: fc.record({
                currentPage: fc.constant(1),
                totalPages: fc.constant(totalPages),
                pageSize: fc.constant(10),
                hasMoreViolations: fc.constant(violations.length > 10)
            })
        });
    });

/**
 * Generates a ScanResult with a specific number of violations
 */
export function scanResultWithViolationCount(count: number): fc.Arbitrary<ScanResult> {
    return violationsArb({ minLength: count, maxLength: count })
        .chain(violations => {
            const violationCounts = violationCountsFromViolations(violations);
            const pageSize = 10;
            const totalPages = Math.ceil(count / pageSize) || 1;
            const pageViolations = violations.slice(0, pageSize);

            return fc.record({
                schemaVersion: fc.constant(SCHEMA_VERSION),
                metadata: fc.record({
                    url: urlArb,
                    timestamp: timestampArb,
                    viewport: viewportArb,
                    violationCounts: fc.constant(violationCounts)
                }),
                violations: fc.constant(pageViolations),
                pagination: fc.record({
                    currentPage: fc.constant(1),
                    totalPages: fc.constant(totalPages),
                    pageSize: fc.constant(pageSize),
                    hasMoreViolations: fc.constant(count > pageSize)
                })
            });
        });
}
