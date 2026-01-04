/**
 * Hook for fetching paginated session history
 * Requirements: 6.1, 6.5
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import { historyApi } from '../api/historyApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSaasMode } from '@/config/env';
import type { SessionHistoryOptions } from '../types';

/**
 * Hook for fetching session history with pagination
 * Uses keepPreviousData for smooth pagination transitions
 * Waits for auth to be ready before fetching (in SaaS mode)
 * Requirements: 6.1, 6.5
 */
export function useSessionHistory({ page, limit = 10 }: SessionHistoryOptions) {
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

    // In SaaS mode, wait for auth to be ready before fetching
    // This prevents 401 errors when the page refreshes and Cognito session is being restored
    const isAuthReady = isSaasMode() ? (!isAuthLoading && isAuthenticated) : true;

    return useQuery({
        queryKey: queryKeys.sessions.list(page),
        queryFn: () => historyApi.listSessions(page, limit),
        placeholderData: keepPreviousData,
        enabled: isAuthReady,
    });
}
