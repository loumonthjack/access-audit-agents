/**
 * Scan API functions
 * Requirements: 1.1
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '@/shared/lib/api/client';
import { queryKeys } from '@/config/queryClient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSaasMode } from '@/config/env';
import type { ScanSession, Viewport } from '@/types/domain';

/**
 * API response shape from backend for session
 */
interface ApiSessionResponse {
    id: string;
    userId: string;
    url: string;
    viewport: 'mobile' | 'desktop';
    status: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    summary: {
        totalViolations: number;
        criticalCount: number;
        seriousCount: number;
        moderateCount: number;
        minorCount: number;
        fixedCount: number;
        skippedCount: number;
        pendingCount: number;
    };
}

/**
 * Transform API session response to ScanSession format
 */
function transformSessionResponse(response: ApiSessionResponse): ScanSession {
    return {
        id: response.id,
        url: response.url,
        viewport: response.viewport,
        status: response.status as ScanSession['status'],
        createdAt: response.createdAt,
        completedAt: response.completedAt,
        errorMessage: response.errorMessage,
        violationCounts: {
            total: response.summary?.totalViolations ?? 0,
            critical: response.summary?.criticalCount ?? 0,
            serious: response.summary?.seriousCount ?? 0,
            moderate: response.summary?.moderateCount ?? 0,
            minor: response.summary?.minorCount ?? 0,
        },
        fixCounts: {
            fixed: response.summary?.fixedCount ?? 0,
            skipped: response.summary?.skippedCount ?? 0,
            pending: response.summary?.pendingCount ?? 0,
        },
    };
}

/**
 * Start a new scan session
 * Requirements: 1.1
 */
export async function startScan(url: string, viewport: Viewport): Promise<ScanSession> {
    const response = await apiClient.post<ApiSessionResponse>('/scans', { url, viewport });
    return transformSessionResponse(response);
}

/**
 * Get a scan session by ID
 * Requirements: 1.1
 */
export async function getSession(sessionId: string): Promise<ScanSession> {
    const response = await apiClient.get<ApiSessionResponse>(`/scans/${sessionId}`);
    return transformSessionResponse(response);
}

/**
 * Hook for starting a new scan
 * Redirects to login if not authenticated (in SaaS mode)
 * Requirements: 1.1
 */
export function useStartScan() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();

    return useMutation({
        mutationFn: async ({ url, viewport }: { url: string; viewport: Viewport }) => {
            // In SaaS mode, check if user is authenticated before starting scan
            if (isSaasMode() && !isAuthenticated) {
                // Store the scan request in sessionStorage so we can resume after login
                sessionStorage.setItem('pendingScan', JSON.stringify({ url, viewport }));
                // Redirect to login with redirect back to home
                navigate({
                    to: '/login',
                    search: { redirect: '/?startScan=true' },
                    replace: false
                });
                // Throw to prevent mutation from continuing
                throw new Error('Authentication required');
            }
            return startScan(url, viewport);
        },
        onSuccess: (session) => {
            // Clear any pending scan
            sessionStorage.removeItem('pendingScan');
            // Invalidate sessions list to include new session
            queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
            // Navigate to the scan page
            navigate({ to: '/scan/$sessionId', params: { sessionId: session.id } });
        },
    });
}

/**
 * Polling interval for active scans (3 seconds)
 */
const ACTIVE_SCAN_POLL_INTERVAL = 3000;

/**
 * Hook for fetching a scan session
 * Polls when session is active (not complete/error) as fallback for WebSocket
 * Waits for auth to be ready before fetching (in SaaS mode)
 * Requirements: 1.1
 */
export function useSession(sessionId: string) {
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

    // In SaaS mode, wait for auth to be ready before fetching
    // This prevents 401 errors when the page refreshes and Cognito session is being restored
    const isAuthReady = isSaasMode() ? (!isAuthLoading && isAuthenticated) : true;

    return useQuery({
        queryKey: queryKeys.sessions.detail(sessionId),
        queryFn: () => getSession(sessionId),
        enabled: !!sessionId && isAuthReady,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            const isActive = status && status !== 'complete' && status !== 'error';
            return isActive ? ACTIVE_SCAN_POLL_INTERVAL : false;
        },
    });
}

/**
 * Get violations for a scan session
 * Requirements: 2.2
 */
export async function getSessionViolations(sessionId: string) {
    const response = await apiClient.get<{ violations: any[] }>(`/scans/${sessionId}/violations`);
    return response.violations;
}

/**
 * Scan API object for direct access
 */
export const scanApi = {
    startScan,
    getSession,
    getSessionViolations,
};
