/**
 * Hook for deleting a session with cache invalidation
 * Requirements: 6.4
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import { historyApi } from '../api/historyApi';

/**
 * Hook for deleting a session
 * Invalidates the sessions cache on success
 * Requirements: 6.4
 */
export function useDeleteSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (sessionId: string) => historyApi.deleteSession(sessionId),
        onSuccess: () => {
            // Invalidate all session queries to ensure fresh data
            queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
        },
    });
}
