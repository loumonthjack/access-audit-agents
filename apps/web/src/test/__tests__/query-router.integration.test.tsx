/**
 * Query + Router Integration Tests
 * Tests route loaders fetching data and navigation with params
 * Requirements: (testing)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryKeys } from '@/config/queryClient';
import { getSession } from '@/features/scan/api/scanApi';
import { getReport } from '@/features/report/api/reportApi';
import { listSessions } from '@/features/history/api/historyApi';
import { createTestQueryClient } from '../utils';
import { createMockSession, resetMockData } from '../mocks/handlers';
import type { ScanSession } from '@/types/domain';

describe('Query + Router Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetMockData();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Route Loaders Fetch Data', () => {
    it('should fetch session data for scan route loader', async () => {
      // Simulate what the scan route loader does
      const sessionId = 'session-1';

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.detail(sessionId),
            queryFn: () => getSession(sessionId),
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify session data
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(sessionId);
      expect(result.current.data?.url).toBe('https://example.com');
    });

    it('should fetch report data for report route loader', async () => {
      const sessionId = 'session-1';

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.reports.detail(sessionId),
            queryFn: () => getReport(sessionId),
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify report data
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.sessionId).toBe(sessionId);
      expect(result.current.data?.summary).toBeDefined();
      expect(result.current.data?.fixes).toBeDefined();
    });

    it('should handle 404 for non-existent session', async () => {
      const sessionId = 'non-existent-session';

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.detail(sessionId),
            queryFn: () => getSession(sessionId),
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should fetch paginated session history', async () => {
      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.list(1),
            queryFn: () => listSessions(1, 10),
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify paginated response
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.data).toBeInstanceOf(Array);
      expect(result.current.data?.pagination).toBeDefined();
      expect(result.current.data?.pagination.page).toBe(1);
    });
  });

  describe('Navigation with Params', () => {
    it('should cache session data after initial fetch', async () => {
      const sessionId = 'session-1';

      // First fetch
      const { result: result1 } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.detail(sessionId),
            queryFn: () => getSession(sessionId),
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Verify data is cached
      const cachedData = queryClient.getQueryData(queryKeys.sessions.detail(sessionId));
      expect(cachedData).toBeDefined();
      expect((cachedData as ScanSession).id).toBe(sessionId);
    });

    it('should use cached data on subsequent navigations', async () => {
      const sessionId = 'session-1';

      // Pre-populate cache (simulating previous navigation)
      const mockSession = createMockSession({ id: sessionId });
      queryClient.setQueryData(queryKeys.sessions.detail(sessionId), mockSession);

      // Second navigation should use cached data
      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.detail(sessionId),
            queryFn: () => getSession(sessionId),
            staleTime: 60000, // 1 minute
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      // Should immediately have data from cache
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe(sessionId);
      // Should not be fetching since data is fresh
      expect(result.current.isFetching).toBe(false);
    });

    it('should handle different session IDs correctly', async () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-3';

      // Fetch first session
      const { result: result1 } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.detail(sessionId1),
            queryFn: () => getSession(sessionId1),
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Fetch second session
      const { result: result2 } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.detail(sessionId2),
            queryFn: () => getSession(sessionId2),
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Both should be cached separately
      const cached1 = queryClient.getQueryData(
        queryKeys.sessions.detail(sessionId1)
      ) as ScanSession;
      const cached2 = queryClient.getQueryData(
        queryKeys.sessions.detail(sessionId2)
      ) as ScanSession;

      expect(cached1.id).toBe(sessionId1);
      expect(cached2.id).toBe(sessionId2);
      expect(cached1.url).not.toBe(cached2.url);
    });

    it('should refetch stale data on navigation', async () => {
      const sessionId = 'session-1';

      // Pre-populate cache with stale data
      const staleSession = createMockSession({
        id: sessionId,
        status: 'scanning',
      });
      queryClient.setQueryData(queryKeys.sessions.detail(sessionId), staleSession);

      // Mark as stale
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.detail(sessionId) });

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.detail(sessionId),
            queryFn: () => getSession(sessionId),
          }),
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      // Should have stale data immediately
      expect(result.current.data?.status).toBe('scanning');

      // Should be refetching
      expect(result.current.isFetching).toBe(true);

      // Wait for fresh data
      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });

      // Should have updated data from server
      expect(result.current.data?.status).toBe('complete');
    });
  });

  describe('Query Key Structure', () => {
    it('should use correct query keys for sessions', () => {
      expect(queryKeys.sessions.all).toEqual(['sessions']);
      expect(queryKeys.sessions.list(1)).toEqual(['sessions', 'list', 1]);
      expect(queryKeys.sessions.detail('abc')).toEqual(['sessions', 'detail', 'abc']);
    });

    it('should use correct query keys for reports', () => {
      expect(queryKeys.reports.all).toEqual(['reports']);
      expect(queryKeys.reports.detail('abc')).toEqual(['reports', 'detail', 'abc']);
    });

    it('should use correct query keys for violations', () => {
      expect(queryKeys.violations.bySession('abc')).toEqual(['violations', 'abc']);
    });
  });
});
