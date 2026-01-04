/**
 * History API functions
 * Requirements: 6.1, 6.4
 */
import { apiClient } from '@/shared/lib/api/client';
import type { ScanSession } from '@/types/domain';
import type { PaginatedResponse } from '@/types/api';

/**
 * List scan sessions with pagination
 * Requirements: 6.1, 6.5
 */
export async function listSessions(
    page: number = 1,
    limit: number = 10
): Promise<PaginatedResponse<ScanSession>> {
    return apiClient.get<PaginatedResponse<ScanSession>>('/sessions', {
        params: { page, limit },
    });
}

/**
 * Delete a scan session by ID
 * Requirements: 6.4
 */
export async function deleteSession(sessionId: string): Promise<void> {
    return apiClient.delete(`/sessions/${sessionId}`);
}

/**
 * History API object for direct access
 */
export const historyApi = {
    listSessions,
    deleteSession,
};
