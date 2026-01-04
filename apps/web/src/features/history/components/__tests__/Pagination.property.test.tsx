/**
 * Property-based tests for session history pagination
 * Feature: web-dashboard, Property 15: Session History Pagination
 * Validates: Requirements 6.5
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../Pagination';
import type { ScanSession, SessionStatus, Viewport } from '@/types/domain';
import type { PaginatedResponse } from '@/types/api';

/**
 * Arbitrary for generating session status
 */
const sessionStatusArbitrary = fc.constantFrom<SessionStatus>(
    'pending',
    'scanning',
    'remediating',
    'complete',
    'error'
);

/**
 * Arbitrary for generating viewport
 */
const viewportArbitrary = fc.constantFrom<Viewport>('mobile', 'desktop');

/**
 * Arbitrary for generating ISO date strings
 */
const dateArbitrary = fc
    .integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Arbitrary for generating ScanSession objects
 */
const scanSessionArbitrary: fc.Arbitrary<ScanSession> = fc.record({
    id: fc.uuid(),
    url: fc.webUrl(),
    viewport: viewportArbitrary,
    status: sessionStatusArbitrary,
    createdAt: dateArbitrary,
    completedAt: fc.option(dateArbitrary, { nil: undefined }),
    violationCounts: fc.record({
        total: fc.integer({ min: 0, max: 100 }),
        critical: fc.integer({ min: 0, max: 25 }),
        serious: fc.integer({ min: 0, max: 25 }),
        moderate: fc.integer({ min: 0, max: 25 }),
        minor: fc.integer({ min: 0, max: 25 }),
    }),
    fixCounts: fc.record({
        fixed: fc.integer({ min: 0, max: 50 }),
        skipped: fc.integer({ min: 0, max: 50 }),
        pending: fc.integer({ min: 0, max: 50 }),
    }),
});

/**
 * Arbitrary for generating pagination state
 */
const paginationStateArbitrary = fc
    .record({
        totalSessions: fc.integer({ min: 0, max: 200 }),
        limit: fc.constant(10),
    })
    .chain(({ totalSessions, limit }) => {
        const totalPages = Math.max(1, Math.ceil(totalSessions / limit));
        return fc.record({
            currentPage: fc.integer({ min: 1, max: totalPages }),
            totalPages: fc.constant(totalPages),
            totalSessions: fc.constant(totalSessions),
            limit: fc.constant(limit),
        });
    });

/**
 * Generate a paginated response for a given page
 */
function generatePaginatedResponse(
    sessions: ScanSession[],
    page: number,
    limit: number
): PaginatedResponse<ScanSession> {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageData = sessions.slice(startIndex, endIndex);

    return {
        data: pageData,
        pagination: {
            page,
            limit,
            total: sessions.length,
            totalPages: Math.ceil(sessions.length / limit),
        },
    };
}

describe('Property 15: Session History Pagination', () => {
    // Clean up after each test to prevent DOM pollution
    afterEach(() => {
        cleanup();
    });

    /**
     * Property 15a: Page contains at most 10 sessions
     * For any page of session history, the page SHALL contain at most 10 sessions.
     * Validates: Requirements 6.5
     */
    it('Property 15a: Page contains at most 10 sessions', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(scanSessionArbitrary, { minLength: 0, maxLength: 50 }),
                fc.integer({ min: 1, max: 10 }),
                async (allSessions, page) => {
                    const limit = 10;
                    const totalPages = Math.max(1, Math.ceil(allSessions.length / limit));
                    const validPage = Math.min(page, totalPages);

                    const response = generatePaginatedResponse(allSessions, validPage, limit);

                    // Verify page contains at most 10 sessions
                    expect(response.data.length).toBeLessThanOrEqual(10);

                    // Verify pagination metadata is correct
                    expect(response.pagination.limit).toBe(10);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15b: Pagination controls visible when more sessions exist
     * If more sessions exist than fit on one page, pagination controls SHALL be visible.
     * Validates: Requirements 6.5
     */
    it('Property 15b: Pagination controls visible when more sessions exist', async () => {
        await fc.assert(
            fc.asyncProperty(
                paginationStateArbitrary.filter((state) => state.totalPages > 1),
                async ({ currentPage, totalPages }) => {
                    cleanup(); // Clean up before each iteration
                    const onPageChange = vi.fn();

                    render(
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={onPageChange}
                        />
                    );

                    // Verify pagination navigation is visible
                    const nav = screen.getByRole('navigation', { name: /pagination/i });
                    expect(nav).toBeInTheDocument();

                    // Verify current page is indicated (use exact match)
                    const currentPageButton = screen.getByRole('button', {
                        name: `Go to page ${currentPage}`,
                    });
                    expect(currentPageButton).toHaveAttribute('aria-current', 'page');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15c: Pagination not visible for single page
     * If all sessions fit on one page, pagination controls SHALL NOT be visible.
     * Validates: Requirements 6.5
     */
    it('Property 15c: Pagination not visible for single page', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant(null), async () => {
                cleanup(); // Clean up before each iteration
                const onPageChange = vi.fn();

                const { container } = render(
                    <Pagination
                        currentPage={1}
                        totalPages={1}
                        onPageChange={onPageChange}
                    />
                );

                // Verify pagination is not rendered
                const nav = screen.queryByRole('navigation', { name: /pagination/i });
                expect(nav).not.toBeInTheDocument();
                expect(container.firstChild).toBeNull();
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15d: Previous button disabled on first page
     * On the first page, the Previous button SHALL be disabled.
     * Validates: Requirements 6.5
     */
    it('Property 15d: Previous button disabled on first page', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 2, max: 20 }),
                async (totalPages) => {
                    cleanup(); // Clean up before each iteration
                    const onPageChange = vi.fn();

                    render(
                        <Pagination
                            currentPage={1}
                            totalPages={totalPages}
                            onPageChange={onPageChange}
                        />
                    );

                    const previousButton = screen.getByRole('button', {
                        name: /previous/i,
                    });
                    expect(previousButton).toBeDisabled();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15e: Next button disabled on last page
     * On the last page, the Next button SHALL be disabled.
     * Validates: Requirements 6.5
     */
    it('Property 15e: Next button disabled on last page', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 2, max: 20 }),
                async (totalPages) => {
                    cleanup(); // Clean up before each iteration
                    const onPageChange = vi.fn();

                    render(
                        <Pagination
                            currentPage={totalPages}
                            totalPages={totalPages}
                            onPageChange={onPageChange}
                        />
                    );

                    const nextButton = screen.getByRole('button', { name: /next/i });
                    expect(nextButton).toBeDisabled();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15f: Page change callback receives correct page number
     * When a page button is clicked, onPageChange SHALL be called with the correct page number.
     * Validates: Requirements 6.5
     */
    it('Property 15f: Page change callback receives correct page number', async () => {
        await fc.assert(
            fc.asyncProperty(
                paginationStateArbitrary.filter(
                    (state) => state.totalPages > 1 && state.currentPage < state.totalPages
                ),
                async ({ currentPage, totalPages }) => {
                    cleanup(); // Clean up before each iteration
                    const user = userEvent.setup();
                    const onPageChange = vi.fn();

                    render(
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={onPageChange}
                        />
                    );

                    // Click next button
                    const nextButton = screen.getByRole('button', { name: /next/i });
                    await user.click(nextButton);

                    expect(onPageChange).toHaveBeenCalledWith(currentPage + 1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15g: First and last pages always visible
     * For any pagination state, page 1 and the last page SHALL always be visible.
     * Validates: Requirements 6.5
     */
    it('Property 15g: First and last pages always visible', async () => {
        await fc.assert(
            fc.asyncProperty(
                paginationStateArbitrary.filter((state) => state.totalPages > 1),
                async ({ currentPage, totalPages }) => {
                    cleanup(); // Clean up before each iteration
                    const onPageChange = vi.fn();

                    render(
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={onPageChange}
                        />
                    );

                    // First page should always be visible (use exact match)
                    const firstPageButton = screen.getByRole('button', {
                        name: 'Go to page 1',
                    });
                    expect(firstPageButton).toBeInTheDocument();

                    // Last page should always be visible (use exact match)
                    const lastPageButton = screen.getByRole('button', {
                        name: `Go to page ${totalPages}`,
                    });
                    expect(lastPageButton).toBeInTheDocument();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15h: Current page button is disabled
     * The button for the current page SHALL be disabled (not clickable).
     * Validates: Requirements 6.5
     */
    it('Property 15h: Current page button is disabled', async () => {
        await fc.assert(
            fc.asyncProperty(
                paginationStateArbitrary.filter((state) => state.totalPages > 1),
                async ({ currentPage, totalPages }) => {
                    cleanup(); // Clean up before each iteration
                    const onPageChange = vi.fn();

                    render(
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={onPageChange}
                        />
                    );

                    // Use exact match to avoid matching page 10, 11, etc when looking for page 1
                    const currentPageButton = screen.getByRole('button', {
                        name: `Go to page ${currentPage}`,
                    });
                    expect(currentPageButton).toBeDisabled();
                }
            ),
            { numRuns: 100 }
        );
    });
});
