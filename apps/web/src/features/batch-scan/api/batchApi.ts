/**
 * Batch Scan API functions
 * Requirements: 6.1, 6.2, 8.1, 8.4, 8.5, 10.1
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '@/shared/lib/api/client';
import { queryKeys } from '@/config/queryClient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSaasMode } from '@/config/env';
import type {
    BatchSession,
    BatchReport,
    Viewport,
    ParsedUrl,
} from '@/types/domain';
import type {
    SitemapParseRequest,
    SitemapParseResponse,
    CreateBatchScanRequest,
} from '../types';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Parse a sitemap URL and return discovered URLs
 * Requirements: 6.1, 6.2
 */
export async function parseSitemap(request: SitemapParseRequest): Promise<SitemapParseResponse> {
    return apiClient.post<SitemapParseResponse>('/sitemaps/parse', request);
}

/**
 * Create a new batch scan session
 * Requirements: 8.1
 */
export async function createBatchScan(request: CreateBatchScanRequest): Promise<BatchSession> {
    return apiClient.post<BatchSession>('/batch-scans', request);
}

/**
 * Get a batch scan session by ID
 * Requirements: 8.1
 */
export async function getBatchScan(batchId: string): Promise<BatchSession> {
    return apiClient.get<BatchSession>(`/batch-scans/${batchId}`);
}

/**
 * Pause a running batch scan
 * Requirements: 8.4
 */
export async function pauseBatchScan(batchId: string): Promise<BatchSession> {
    return apiClient.post<BatchSession>(`/batch-scans/${batchId}/pause`);
}

/**
 * Resume a paused batch scan
 * Requirements: 8.4
 */
export async function resumeBatchScan(batchId: string): Promise<BatchSession> {
    return apiClient.post<BatchSession>(`/batch-scans/${batchId}/resume`);
}

/**
 * Cancel a batch scan
 * Requirements: 8.5
 */
export async function cancelBatchScan(batchId: string): Promise<BatchSession> {
    return apiClient.post<BatchSession>(`/batch-scans/${batchId}/cancel`);
}

/**
 * Get the report for a completed batch scan
 * Requirements: 10.1
 */
export async function getBatchReport(batchId: string): Promise<BatchReport> {
    return apiClient.get<BatchReport>(`/batch-scans/${batchId}/report`);
}

/**
 * Export batch report in specified format
 * Requirements: 10.5
 */
export async function exportBatchReport(
    batchId: string,
    format: 'json' | 'html'
): Promise<Blob> {
    // For export, we need to make a raw fetch request with auth token
    // because the response could be HTML (not JSON)
    let token: string | null = null;

    if (isSaasMode()) {
        // SaaS mode: get token from Cognito
        try {
            const { fetchAuthSession } = await import('aws-amplify/auth');
            const session = await fetchAuthSession();
            // Use ID token for API Gateway Cognito authorizer (same as CognitoAuthAdapter.getToken)
            token = session.tokens?.idToken?.toString() ?? session.tokens?.accessToken?.toString() ?? null;
        } catch {
            // Continue without token
        }
    } else {
        // Local mode: get token from localStorage
        try {
            token = localStorage.getItem('local_access_token');
        } catch {
            // localStorage might not be available
        }
    }

    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    // Backend expects 'json-download' for JSON file download, 'html' for HTML
    const formatParam = format === 'json' ? 'json-download' : 'html';
    const url = `${baseUrl}/batch-scans/${batchId}/report?format=${formatParam}`;

    const headers: Record<string, string> = {
        'Accept': format === 'json' ? 'application/json' : 'text/html',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error(`Failed to export report: ${response.statusText}`);
    }

    return response.blob();
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook for parsing a sitemap URL
 * Requirements: 6.1, 6.2
 */
export function useParseSitemap() {
    return useMutation({
        mutationFn: parseSitemap,
    });
}

/**
 * Hook for creating a batch scan
 * Requirements: 8.1
 */
export function useCreateBatchScan() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();

    return useMutation({
        mutationFn: async (request: CreateBatchScanRequest) => {
            // In SaaS mode, check if user is authenticated
            if (isSaasMode() && !isAuthenticated) {
                sessionStorage.setItem('pendingBatchScan', JSON.stringify(request));
                navigate({
                    to: '/login',
                    search: { redirect: '/batch?startScan=true' },
                    replace: false,
                });
                throw new Error('Authentication required');
            }
            return createBatchScan(request);
        },
        onSuccess: (batch) => {
            sessionStorage.removeItem('pendingBatchScan');
            queryClient.invalidateQueries({ queryKey: queryKeys.batchScans.all });
            navigate({ to: '/batch/$batchId', params: { batchId: batch.id } });
        },
    });
}

/**
 * Polling interval for active batch scans (3 seconds)
 */
const ACTIVE_BATCH_POLL_INTERVAL = 3000;

/**
 * Hook for fetching a batch scan session
 * Requirements: 8.1
 */
export function useBatchScan(batchId: string) {
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const isAuthReady = isSaasMode() ? (!isAuthLoading && isAuthenticated) : true;

    return useQuery({
        queryKey: queryKeys.batchScans.detail(batchId),
        queryFn: () => getBatchScan(batchId),
        enabled: !!batchId && isAuthReady,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            const isActive = status && status !== 'completed' && status !== 'cancelled' && status !== 'error';
            return isActive ? ACTIVE_BATCH_POLL_INTERVAL : false;
        },
    });
}

/**
 * Hook for pausing a batch scan
 * Requirements: 8.4
 */
export function usePauseBatchScan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: pauseBatchScan,
        onSuccess: (batch) => {
            queryClient.setQueryData(queryKeys.batchScans.detail(batch.id), batch);
        },
    });
}

/**
 * Hook for resuming a batch scan
 * Requirements: 8.4
 */
export function useResumeBatchScan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: resumeBatchScan,
        onSuccess: (batch) => {
            queryClient.setQueryData(queryKeys.batchScans.detail(batch.id), batch);
        },
    });
}

/**
 * Hook for cancelling a batch scan
 * Requirements: 8.5
 */
export function useCancelBatchScan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: cancelBatchScan,
        onSuccess: (batch) => {
            queryClient.setQueryData(queryKeys.batchScans.detail(batch.id), batch);
        },
    });
}

/**
 * Hook for fetching a batch report
 * Requirements: 10.1
 */
export function useBatchReport(batchId: string) {
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const isAuthReady = isSaasMode() ? (!isAuthLoading && isAuthenticated) : true;

    return useQuery({
        queryKey: queryKeys.batchScans.report(batchId),
        queryFn: () => getBatchReport(batchId),
        enabled: !!batchId && isAuthReady,
    });
}

/**
 * List all batch scans for the current user
 */
export async function listBatchScans(page: number = 1, limit: number = 10): Promise<{
    data: BatchSession[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}> {
    const offset = (page - 1) * limit;
    return apiClient.get(`/batch-scans?limit=${limit}&offset=${offset}`);
}

/**
 * Hook for fetching batch scan history with pagination
 */
export function useBatchScanHistory({ page = 1, limit = 10 }: { page?: number; limit?: number } = {}) {
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const isAuthReady = isSaasMode() ? (!isAuthLoading && isAuthenticated) : true;

    return useQuery({
        queryKey: queryKeys.batchScans.list(page),
        queryFn: () => listBatchScans(page, limit),
        enabled: isAuthReady,
    });
}

/**
 * Batch API object for direct access
 */
export const batchApi = {
    parseSitemap,
    createBatchScan,
    getBatchScan,
    pauseBatchScan,
    resumeBatchScan,
    cancelBatchScan,
    getBatchReport,
    exportBatchReport,
};
