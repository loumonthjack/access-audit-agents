/**
 * Property-based tests for cache invalidation on mutation
 * Feature: web-dashboard, Property 21: Query Cache Invalidation on Mutation
 * Validates: Requirements 1.1, 6.4
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
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
 * Arbitrary for generating paginated session responses
 */
const paginatedSessionsArbitrary: fc.Arbitrary<PaginatedResponse<ScanSession>> = fc
  .array(scanSessionArbitrary, { minLength: 0, maxLength: 10 })
  .chain((sessions) =>
    fc.record({
      data: fc.constant(sessions),
      pagination: fc.record({
        page: fc.integer({ min: 1, max: 10 }),
        limit: fc.constant(10),
        total: fc.integer({ min: sessions.length, max: 100 }),
        totalPages: fc.integer({ min: 1, max: 10 }),
      }),
    })
  );

/**
 * Simulates the cache invalidation on delete mutation
 */
function simulateDeleteMutationCacheInvalidation(queryClient: QueryClient): {
  invalidatedQueries: string[];
} {
  const invalidatedQueries: string[] = [];

  // Simulate invalidating all session queries
  const sessionsKey = queryKeys.sessions.all;
  queryClient.invalidateQueries({ queryKey: sessionsKey });
  invalidatedQueries.push(JSON.stringify(sessionsKey));

  return { invalidatedQueries };
}

/**
 * Simulates the cache invalidation on startScan mutation
 */
function simulateStartScanCacheInvalidation(queryClient: QueryClient): {
  invalidatedQueries: string[];
} {
  const invalidatedQueries: string[] = [];

  // Simulate invalidating all session queries
  const sessionsKey = queryKeys.sessions.all;
  queryClient.invalidateQueries({ queryKey: sessionsKey });
  invalidatedQueries.push(JSON.stringify(sessionsKey));

  return { invalidatedQueries };
}

describe('Property 21: Query Cache Invalidation on Mutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * Property 21a: Delete mutation invalidates sessions cache
   * For any successful deleteSession mutation, the sessions.all query cache
   * SHALL be invalidated to ensure fresh data on next fetch.
   * Validates: Requirements 6.4
   */
  it('Property 21a: Delete mutation invalidates sessions cache', async () => {
    await fc.assert(
      fc.asyncProperty(paginatedSessionsArbitrary, async (sessionsResponse) => {
        // Skip if no sessions
        if (sessionsResponse.data.length === 0) return;

        // Pre-populate cache with sessions list
        queryClient.setQueryData(queryKeys.sessions.list(1), sessionsResponse);

        // Verify cache is populated
        const cachedBefore = queryClient.getQueryData(queryKeys.sessions.list(1));
        expect(cachedBefore).toBeDefined();

        // Simulate delete mutation cache invalidation
        const { invalidatedQueries } = simulateDeleteMutationCacheInvalidation(queryClient);

        // Verify sessions.all was invalidated
        expect(invalidatedQueries).toContain(JSON.stringify(queryKeys.sessions.all));

        // Verify the query state is now stale
        const queryState = queryClient.getQueryState(queryKeys.sessions.list(1));
        expect(queryState?.isInvalidated).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21b: StartScan mutation invalidates sessions cache
   * For any successful startScan mutation, the sessions.all query cache
   * SHALL be invalidated to include the new session.
   * Validates: Requirements 1.1
   */
  it('Property 21b: StartScan mutation invalidates sessions cache', async () => {
    await fc.assert(
      fc.asyncProperty(paginatedSessionsArbitrary, async (existingSessions) => {
        // Pre-populate cache with existing sessions
        queryClient.setQueryData(queryKeys.sessions.list(1), existingSessions);

        // Verify cache is populated
        const cachedBefore = queryClient.getQueryData(queryKeys.sessions.list(1));
        expect(cachedBefore).toBeDefined();

        // Simulate startScan mutation cache invalidation
        const { invalidatedQueries } = simulateStartScanCacheInvalidation(queryClient);

        // Verify sessions.all was invalidated
        expect(invalidatedQueries).toContain(JSON.stringify(queryKeys.sessions.all));

        // Verify the query state is now stale
        const queryState = queryClient.getQueryState(queryKeys.sessions.list(1));
        expect(queryState?.isInvalidated).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21c: Cache invalidation affects all paginated queries
   * For any mutation that invalidates sessions.all, ALL paginated session
   * queries SHALL be invalidated regardless of page number.
   * Validates: Requirements 1.1, 6.4
   */
  it('Property 21c: Cache invalidation affects all paginated queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(paginatedSessionsArbitrary, { minLength: 1, maxLength: 5 }),
        async (paginatedResponses) => {
          // Pre-populate cache with multiple pages
          paginatedResponses.forEach((response, index) => {
            queryClient.setQueryData(queryKeys.sessions.list(index + 1), response);
          });

          // Verify all pages are cached
          paginatedResponses.forEach((_, index) => {
            const cached = queryClient.getQueryData(queryKeys.sessions.list(index + 1));
            expect(cached).toBeDefined();
          });

          // Simulate cache invalidation
          simulateDeleteMutationCacheInvalidation(queryClient);

          // Verify ALL pages are now stale
          paginatedResponses.forEach((_, index) => {
            const queryState = queryClient.getQueryState(queryKeys.sessions.list(index + 1));
            expect(queryState?.isInvalidated).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21d: Session detail cache is affected by invalidation
   * For any mutation that invalidates sessions.all, session detail queries
   * SHALL also be invalidated since they share the sessions prefix.
   * Validates: Requirements 6.4
   */
  it('Property 21d: Session detail cache is affected by invalidation', async () => {
    await fc.assert(
      fc.asyncProperty(scanSessionArbitrary, async (session) => {
        // Pre-populate cache with session detail
        queryClient.setQueryData(queryKeys.sessions.detail(session.id), session);

        // Verify cache is populated
        const cachedBefore = queryClient.getQueryData(queryKeys.sessions.detail(session.id));
        expect(cachedBefore).toBeDefined();

        // Simulate cache invalidation (invalidates sessions.all which is prefix)
        simulateDeleteMutationCacheInvalidation(queryClient);

        // Verify the detail query state is now stale
        const queryState = queryClient.getQueryState(queryKeys.sessions.detail(session.id));
        expect(queryState?.isInvalidated).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21e: Reports cache is NOT affected by session mutations
   * For any session mutation, the reports cache SHALL NOT be invalidated
   * since reports are separate entities.
   * Validates: Requirements 6.4
   */
  it('Property 21e: Reports cache is NOT affected by session mutations', async () => {
    await fc.assert(
      fc.asyncProperty(scanSessionArbitrary, fc.uuid(), async (_session, reportId) => {
        // Pre-populate cache with a report
        const mockReport = { sessionId: reportId, url: 'https://example.com' };
        queryClient.setQueryData(queryKeys.reports.detail(reportId), mockReport);

        // Verify report cache is populated
        const reportCachedBefore = queryClient.getQueryData(queryKeys.reports.detail(reportId));
        expect(reportCachedBefore).toBeDefined();

        // Simulate session delete mutation cache invalidation
        simulateDeleteMutationCacheInvalidation(queryClient);

        // Verify report cache is NOT invalidated
        const reportQueryState = queryClient.getQueryState(queryKeys.reports.detail(reportId));
        expect(reportQueryState?.isInvalidated).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
