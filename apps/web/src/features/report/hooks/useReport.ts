/**
 * useReport hook for fetching report data
 * Requirements: 5.1
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import { getReport } from '../api/reportApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSaasMode } from '@/config/env';
import type { RemediationReport } from '@/types/domain';

export interface UseReportOptions {
  /** Session ID to fetch report for */
  sessionId: string;
  /** Whether to enable the query */
  enabled?: boolean;
}

export interface UseReportReturn {
  /** The report data */
  report: RemediationReport | undefined;
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether the query is fetching (including background refetch) */
  isFetching: boolean;
  /** Error if the query failed */
  error: Error | null;
  /** Whether the query has errored */
  isError: boolean;
  /** Whether the query was successful */
  isSuccess: boolean;
  /** Refetch the report */
  refetch: () => void;
}

/**
 * Hook for fetching a remediation report
 * Handles loading and error states
 * Waits for auth to be ready before fetching (in SaaS mode)
 * Requirements: 5.1
 */
export function useReport({ sessionId, enabled = true }: UseReportOptions): UseReportReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // In SaaS mode, wait for auth to be ready before fetching
  // This prevents 401 errors when the page refreshes and Cognito session is being restored
  const isAuthReady = isSaasMode() ? !isAuthLoading && isAuthenticated : true;

  const query = useQuery({
    queryKey: queryKeys.reports.detail(sessionId),
    queryFn: () => getReport(sessionId),
    enabled: enabled && !!sessionId && isAuthReady,
  });

  return {
    report: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isError: query.isError,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  };
}
