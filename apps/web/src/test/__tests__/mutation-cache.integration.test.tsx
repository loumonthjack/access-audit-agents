/**
 * Mutation + Cache Integration Tests
 * Tests cache invalidation on mutations and optimistic updates
 * Requirements: (testing)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import React from 'react';
import { queryKeys } from '@/config/queryClient';
import { startScan, getSession } from '@/features/scan/api/scanApi';
import { listSessions, deleteSession } from '@/features/history/api/historyApi';
import { createTestQueryClient } from '../utils';
import { createMockSession, resetMockData } from '../mocks/handlers';
import type { ScanSession } from '@/types/domain';
import type { PaginatedResponse } from '@/types/api';

describe('Mutation + Cache Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetMockData();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Cache Invalidation on Mutations', () => {
    it('should call invalidateQueries after starting a new scan', async () => {
      let invalidationCalled = false;

      const { result } = renderHook(
        () => {
          const qc = useQueryClient();
          return useMutation({
            mutationFn: ({ url, viewport }: { url: string; viewport: 'mobile' | 'desktop' }) =>
              startScan(url, viewport),
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
              invalidationCalled = true;
            },
          });
        },
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      act(() => {
        result.current.mutate({ url: 'https://new-site.com', viewport: 'desktop' });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidationCalled).toBe(true);
    });

    it('should call invalidateQueries after deleting a session', async () => {
      let invalidationCalled = false;

      const { result } = renderHook(
        () => {
          const qc = useQueryClient();
          return useMutation({
            mutationFn: (sessionId: string) => deleteSession(sessionId),
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
              invalidationCalled = true;
            },
          });
        },
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      act(() => {
        result.current.mutate('session-1');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidationCalled).toBe(true);
    });

    it('should refetch data after cache invalidation', async () => {
      const { result: queryResult } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.list(1),
            queryFn: () => listSessions(1, 10),
          }),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(queryResult.current.isSuccess).toBe(true);
      });

      const initialDataUpdatedAt = queryResult.current.dataUpdatedAt;

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      });

      await waitFor(() => {
        expect(queryResult.current.dataUpdatedAt).toBeGreaterThan(initialDataUpdatedAt);
      });
    });

    it('should NOT invalidate reports when sessions are invalidated', async () => {
      const sessionId = 'session-1';
      const mockReport = { sessionId, url: 'https://example.com', summary: {} };
      queryClient.setQueryData(queryKeys.reports.detail(sessionId), mockReport);

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      });

      const reportData = queryClient.getQueryData(queryKeys.reports.detail(sessionId));
      expect(reportData).toBeDefined();
      expect(reportData).toEqual(mockReport);
    });
  });

  describe('Optimistic Updates', () => {
    it('should apply optimistic update on delete mutation', async () => {
      const sessionToDelete = 'session-1';

      const initialSessions: PaginatedResponse<ScanSession> = {
        data: [
          createMockSession({ id: 'session-1', url: 'https://example.com' }),
          createMockSession({ id: 'session-2', url: 'https://test.com' }),
        ],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      queryClient.setQueryData(queryKeys.sessions.list(1), initialSessions);

      let optimisticDataLength: number | undefined;

      const { result } = renderHook(
        () => {
          const qc = useQueryClient();
          return useMutation({
            mutationFn: (sessionId: string) => deleteSession(sessionId),
            onMutate: async (sessionId) => {
              await qc.cancelQueries({ queryKey: queryKeys.sessions.list(1) });
              const previousSessions = qc.getQueryData<PaginatedResponse<ScanSession>>(
                queryKeys.sessions.list(1)
              );

              if (previousSessions) {
                const newData = {
                  ...previousSessions,
                  data: previousSessions.data.filter((s) => s.id !== sessionId),
                  pagination: {
                    ...previousSessions.pagination,
                    total: previousSessions.pagination.total - 1,
                  },
                };
                qc.setQueryData(queryKeys.sessions.list(1), newData);
                optimisticDataLength = newData.data.length;
              }

              return { previousSessions };
            },
            onError: (_err, _sessionId, context) => {
              if (context?.previousSessions) {
                qc.setQueryData(queryKeys.sessions.list(1), context.previousSessions);
              }
            },
          });
        },
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      act(() => {
        result.current.mutate(sessionToDelete);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(optimisticDataLength).toBe(1);
    });

    it('should rollback optimistic update on mutation error', async () => {
      const sessionToDelete = 'non-existent-session';

      const initialSessions: PaginatedResponse<ScanSession> = {
        data: [createMockSession({ id: 'session-1' }), createMockSession({ id: 'session-2' })],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      queryClient.setQueryData(queryKeys.sessions.list(1), initialSessions);

      let rollbackCalled = false;

      const { result } = renderHook(
        () => {
          const qc = useQueryClient();
          return useMutation({
            mutationFn: (sessionId: string) => deleteSession(sessionId),
            onMutate: async (sessionId) => {
              await qc.cancelQueries({ queryKey: queryKeys.sessions.list(1) });
              const previousSessions = qc.getQueryData<PaginatedResponse<ScanSession>>(
                queryKeys.sessions.list(1)
              );

              if (previousSessions) {
                qc.setQueryData(queryKeys.sessions.list(1), {
                  ...previousSessions,
                  data: previousSessions.data.filter((s) => s.id !== sessionId),
                });
              }

              return { previousSessions };
            },
            onError: (_err, _sessionId, context) => {
              if (context?.previousSessions) {
                qc.setQueryData(queryKeys.sessions.list(1), context.previousSessions);
                rollbackCalled = true;
              }
            },
          });
        },
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      act(() => {
        result.current.mutate(sessionToDelete);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Verify rollback was called
      expect(rollbackCalled).toBe(true);
    });

    it('should apply optimistic update on scan start mutation', async () => {
      const initialSessions: PaginatedResponse<ScanSession> = {
        data: [createMockSession({ id: 'session-1' })],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      queryClient.setQueryData(queryKeys.sessions.list(1), initialSessions);

      const newUrl = 'https://new-site.com';
      let optimisticDataLength: number | undefined;
      let optimisticUrl: string | undefined;

      const { result } = renderHook(
        () => {
          const qc = useQueryClient();
          return useMutation({
            mutationFn: ({ url, viewport }: { url: string; viewport: 'mobile' | 'desktop' }) =>
              startScan(url, viewport),
            onMutate: async ({ url, viewport }) => {
              await qc.cancelQueries({ queryKey: queryKeys.sessions.list(1) });
              const previousSessions = qc.getQueryData<PaginatedResponse<ScanSession>>(
                queryKeys.sessions.list(1)
              );

              const optimisticSession: ScanSession = {
                id: `temp-${Date.now()}`,
                url,
                viewport,
                status: 'scanning',
                createdAt: new Date().toISOString(),
                violationCounts: { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 },
                fixCounts: { fixed: 0, skipped: 0, pending: 0 },
              };

              if (previousSessions) {
                const newData = {
                  ...previousSessions,
                  data: [optimisticSession, ...previousSessions.data],
                  pagination: {
                    ...previousSessions.pagination,
                    total: previousSessions.pagination.total + 1,
                  },
                };
                qc.setQueryData(queryKeys.sessions.list(1), newData);
                optimisticDataLength = newData.data.length;
                optimisticUrl = newData.data[0].url;
              }

              return { previousSessions };
            },
          });
        },
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      act(() => {
        result.current.mutate({ url: newUrl, viewport: 'desktop' });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(optimisticDataLength).toBe(2);
      expect(optimisticUrl).toBe(newUrl);
    });
  });

  describe('Cache Consistency', () => {
    it('should maintain cache consistency across related queries', async () => {
      const sessionId = 'session-1';

      const { result: listResult } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.list(1),
            queryFn: () => listSessions(1, 10),
          }),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(listResult.current.isSuccess).toBe(true);
      });

      const { result: detailResult } = renderHook(
        () =>
          useQuery({
            queryKey: queryKeys.sessions.detail(sessionId),
            queryFn: () => getSession(sessionId),
          }),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(detailResult.current.isSuccess).toBe(true);
      });

      const listSession = listResult.current.data?.data.find((s) => s.id === sessionId);
      const detailSession = detailResult.current.data;

      expect(listSession?.id).toBe(detailSession?.id);
      expect(listSession?.url).toBe(detailSession?.url);
    });

    it('should update cache when mutation returns new data', async () => {
      let cachedSessionId: string | undefined;

      const { result } = renderHook(
        () => {
          const qc = useQueryClient();
          return useMutation({
            mutationFn: ({ url, viewport }: { url: string; viewport: 'mobile' | 'desktop' }) =>
              startScan(url, viewport),
            onSuccess: (newSession) => {
              qc.setQueryData(queryKeys.sessions.detail(newSession.id), newSession);
              cachedSessionId = newSession.id;
            },
          });
        },
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      act(() => {
        result.current.mutate({ url: 'https://new-site.com', viewport: 'desktop' });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the mutation returned data and cache was updated
      const newSession = result.current.data;
      expect(newSession).toBeDefined();
      expect(cachedSessionId).toBe(newSession!.id);
    });
  });
});
