/**
 * Property-based tests for Scanner Service
 * 
 * Feature: core-auditor-agent
 * 
 * Tests correctness properties for violation sorting and pagination.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortViolationsByImpact, paginateViolations, DEFAULT_PAGE_SIZE } from '../services/scanner.js';
import { IMPACT_PRIORITY } from '../types/index.js';
import { violationsArb, impactLevelArb } from '../__generators__/violation.generator.js';
import type { Violation, ImpactLevel } from '../types/index.js';

/**
 * Property 2: Violations Sorted by Impact Level
 * 
 * *For any* ScanResult containing multiple violations, the violations array 
 * SHALL be sorted by impact level in descending severity order: 
 * critical → serious → moderate → minor.
 * 
 * **Validates: Requirements 2.3**
 */
describe('Property 2: Violations Sorted by Impact Level', () => {
    it('should sort violations in descending severity order (critical → serious → moderate → minor)', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 0, maxLength: 100 }),
                (violations: Violation[]) => {
                    const sorted = sortViolationsByImpact(violations);

                    // Verify the sorted array has the same length
                    expect(sorted.length).toBe(violations.length);

                    // Verify each consecutive pair is in correct order
                    for (let i = 0; i < sorted.length - 1; i++) {
                        const currentPriority = IMPACT_PRIORITY[sorted[i].impact];
                        const nextPriority = IMPACT_PRIORITY[sorted[i + 1].impact];

                        // Current should have >= priority than next (descending order)
                        expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should preserve all original violations (no additions or removals)', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 0, maxLength: 50 }),
                (violations: Violation[]) => {
                    const sorted = sortViolationsByImpact(violations);

                    // Same length
                    expect(sorted.length).toBe(violations.length);

                    // All original violations should be present
                    const originalIds = violations.map(v => v.id).sort();
                    const sortedIds = sorted.map(v => v.id).sort();
                    expect(sortedIds).toEqual(originalIds);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not mutate the original array', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 1, maxLength: 20 }),
                (violations: Violation[]) => {
                    const originalOrder = violations.map(v => v.id);
                    sortViolationsByImpact(violations);
                    const afterSortOrder = violations.map(v => v.id);

                    // Original array should be unchanged
                    expect(afterSortOrder).toEqual(originalOrder);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should group all violations of same impact level together', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 0, maxLength: 50 }),
                (violations: Violation[]) => {
                    const sorted = sortViolationsByImpact(violations);

                    // Track when we've seen each impact level
                    const seenImpacts = new Set<ImpactLevel>();
                    let lastImpact: ImpactLevel | null = null;

                    for (const v of sorted) {
                        if (lastImpact !== null && v.impact !== lastImpact) {
                            // We've transitioned to a new impact level
                            // The previous impact should not appear again
                            seenImpacts.add(lastImpact);
                        }

                        // If we've already fully processed this impact level, it shouldn't appear again
                        if (seenImpacts.has(v.impact)) {
                            // This would mean the same impact level appears in non-contiguous positions
                            expect(seenImpacts.has(v.impact)).toBe(false);
                        }

                        lastImpact = v.impact;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * Property 3: Pagination Limits and Flags
 * 
 * *For any* scan producing N violations where N > 10:
 * - The returned violations array SHALL contain at most 10 items
 * - `pagination.hasMoreViolations` SHALL be `true`
 * - `metadata.violationCounts.total` SHALL equal N (the true total)
 * 
 * **Validates: Requirements 5.1, 5.2**
 */
describe('Property 3: Pagination Limits and Flags', () => {
    it('should return at most pageSize violations per page', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 0, maxLength: 100 }),
                fc.integer({ min: 1, max: 20 }), // pageSize
                fc.integer({ min: 1, max: 10 }), // page
                (violations: Violation[], pageSize: number, page: number) => {
                    const { paginatedViolations } = paginateViolations(violations, page, pageSize);

                    // Should never exceed pageSize
                    expect(paginatedViolations.length).toBeLessThanOrEqual(pageSize);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should set hasMoreViolations=true when more pages exist', () => {
        fc.assert(
            fc.property(
                // Generate violations with more than one page worth
                violationsArb({ minLength: 11, maxLength: 100 }),
                (violations: Violation[]) => {
                    const { pagination } = paginateViolations(violations, 1, DEFAULT_PAGE_SIZE);

                    // First page should indicate more violations exist
                    expect(pagination.hasMoreViolations).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should set hasMoreViolations=false on the last page', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 1, maxLength: 100 }),
                (violations: Violation[]) => {
                    const totalPages = Math.ceil(violations.length / DEFAULT_PAGE_SIZE);
                    const { pagination } = paginateViolations(violations, totalPages, DEFAULT_PAGE_SIZE);

                    // Last page should indicate no more violations
                    expect(pagination.hasMoreViolations).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should calculate correct totalPages', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 0, maxLength: 100 }),
                fc.integer({ min: 1, max: 20 }), // pageSize
                (violations: Violation[], pageSize: number) => {
                    const { pagination } = paginateViolations(violations, 1, pageSize);

                    const expectedTotalPages = Math.max(1, Math.ceil(violations.length / pageSize));
                    expect(pagination.totalPages).toBe(expectedTotalPages);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should use default page size of 10', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 15, maxLength: 50 }),
                (violations: Violation[]) => {
                    const { pagination } = paginateViolations(violations, 1);

                    expect(pagination.pageSize).toBe(DEFAULT_PAGE_SIZE);
                    expect(DEFAULT_PAGE_SIZE).toBe(10);
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * Property 4: Pagination Returns Correct Slice
 * 
 * *For any* scan with N violations and page parameter P (where P is valid):
 * - The returned violations SHALL be the slice from index `(P-1)*10` to `P*10`
 * - Violations SHALL maintain the same sort order as Property 2
 * 
 * **Validates: Requirements 5.3, 5.4**
 */
describe('Property 4: Pagination Returns Correct Slice', () => {
    it('should return the correct slice for any valid page', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 1, maxLength: 100 }),
                fc.integer({ min: 1, max: 10 }), // page
                (violations: Violation[], page: number) => {
                    const pageSize = DEFAULT_PAGE_SIZE;
                    const totalPages = Math.ceil(violations.length / pageSize);
                    const validPage = Math.min(page, totalPages);

                    const { paginatedViolations } = paginateViolations(violations, validPage, pageSize);

                    // Calculate expected slice
                    const startIndex = (validPage - 1) * pageSize;
                    const endIndex = Math.min(startIndex + pageSize, violations.length);
                    const expectedSlice = violations.slice(startIndex, endIndex);

                    // Verify correct slice is returned
                    expect(paginatedViolations.length).toBe(expectedSlice.length);
                    for (let i = 0; i < paginatedViolations.length; i++) {
                        expect(paginatedViolations[i].id).toBe(expectedSlice[i].id);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should maintain sort order across all pages', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 25, maxLength: 50 }),
                (violations: Violation[]) => {
                    // Sort violations first
                    const sorted = sortViolationsByImpact(violations);
                    const totalPages = Math.ceil(sorted.length / DEFAULT_PAGE_SIZE);

                    // Collect all violations across all pages
                    const allPaginated: Violation[] = [];
                    for (let page = 1; page <= totalPages; page++) {
                        const { paginatedViolations } = paginateViolations(sorted, page, DEFAULT_PAGE_SIZE);
                        allPaginated.push(...paginatedViolations);
                    }

                    // All paginated violations should match the sorted order
                    expect(allPaginated.length).toBe(sorted.length);
                    for (let i = 0; i < allPaginated.length; i++) {
                        expect(allPaginated[i].id).toBe(sorted[i].id);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should clamp invalid page numbers to valid range', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 5, maxLength: 30 }),
                fc.integer({ min: 100, max: 1000 }), // Very high page number
                (violations: Violation[], highPage: number) => {
                    const { pagination, paginatedViolations } = paginateViolations(violations, highPage, DEFAULT_PAGE_SIZE);

                    // Should clamp to last page
                    const expectedTotalPages = Math.ceil(violations.length / DEFAULT_PAGE_SIZE);
                    expect(pagination.currentPage).toBe(expectedTotalPages);
                    expect(pagination.hasMoreViolations).toBe(false);

                    // Should return last page's violations
                    const startIndex = (expectedTotalPages - 1) * DEFAULT_PAGE_SIZE;
                    const expectedCount = violations.length - startIndex;
                    expect(paginatedViolations.length).toBe(expectedCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should handle page 1 correctly', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 1, maxLength: 50 }),
                (violations: Violation[]) => {
                    const { paginatedViolations, pagination } = paginateViolations(violations, 1, DEFAULT_PAGE_SIZE);

                    // Page 1 should return first pageSize violations
                    const expectedCount = Math.min(violations.length, DEFAULT_PAGE_SIZE);
                    expect(paginatedViolations.length).toBe(expectedCount);
                    expect(pagination.currentPage).toBe(1);

                    // First violation should match
                    if (violations.length > 0) {
                        expect(paginatedViolations[0].id).toBe(violations[0].id);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return consistent results for same page across multiple calls', () => {
        fc.assert(
            fc.property(
                violationsArb({ minLength: 15, maxLength: 50 }),
                fc.integer({ min: 1, max: 5 }),
                (violations: Violation[], page: number) => {
                    // Call pagination twice with same inputs
                    const result1 = paginateViolations(violations, page, DEFAULT_PAGE_SIZE);
                    const result2 = paginateViolations(violations, page, DEFAULT_PAGE_SIZE);

                    // Results should be identical
                    expect(result1.paginatedViolations.length).toBe(result2.paginatedViolations.length);
                    expect(result1.pagination).toEqual(result2.pagination);

                    for (let i = 0; i < result1.paginatedViolations.length; i++) {
                        expect(result1.paginatedViolations[i].id).toBe(result2.paginatedViolations[i].id);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
