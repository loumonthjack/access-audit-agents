/**
 * Report API functions
 * Requirements: 5.1, 5.5
 */
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { queryKeys } from '@/config/queryClient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSaasMode } from '@/config/env';
import type { RemediationReport, AppliedFix, SkippedViolation, HumanReviewItem, ReportViolation } from '@/types/domain';
import type { ExportFormat } from '../types';

/**
 * API response shape from backend
 */
interface ApiReportViolation {
    id: string;
    ruleId: string;
    impact: string;
    description: string;
    selector: string;
    html: string;
    status: 'pending' | 'processing' | 'fixed' | 'skipped';
    skipReason?: string;
    screenshot?: string;
    fix?: {
        type: string;
        beforeHtml: string;
        afterHtml: string;
        reasoning: string;
    };
}

interface ApiReportResponse {
    id: string;
    url: string;
    viewport: 'mobile' | 'desktop';
    status: string;
    pageScreenshot?: string;
    createdAt: string;
    completedAt?: string;
    violations: ApiReportViolation[];
    summary: {
        totalViolations: number;
        fixedCount: number;
        skippedCount: number;
    };
}

/**
 * Transform API response to RemediationReport format
 */
function transformApiResponse(response: ApiReportResponse): RemediationReport {
    const fixes: AppliedFix[] = [];
    const skipped: SkippedViolation[] = [];
    const humanReview: HumanReviewItem[] = [];

    // Transform all violations
    const violations: ReportViolation[] = response.violations.map((v) => ({
        id: v.id,
        ruleId: v.ruleId,
        impact: v.impact as ReportViolation['impact'],
        description: v.description,
        selector: v.selector,
        html: v.html,
        status: v.status,
        skipReason: v.skipReason,
        screenshot: v.screenshot,
        fix: v.fix ? {
            type: v.fix.type as ReportViolation['fix']['type'],
            beforeHtml: v.fix.beforeHtml,
            afterHtml: v.fix.afterHtml,
            reasoning: v.fix.reasoning,
        } : undefined,
    }));

    for (const violation of response.violations) {
        if (violation.status === 'fixed' && violation.fix) {
            fixes.push({
                violationId: violation.id,
                ruleId: violation.ruleId,
                impact: violation.impact as AppliedFix['impact'],
                description: violation.description,
                selector: violation.selector,
                fixType: violation.fix.type as AppliedFix['fixType'],
                beforeHtml: violation.fix.beforeHtml,
                afterHtml: violation.fix.afterHtml,
                reasoning: violation.fix.reasoning,
                appliedAt: response.completedAt ?? response.createdAt,
            });
        } else if (violation.status === 'skipped') {
            skipped.push({
                violationId: violation.id,
                ruleId: violation.ruleId,
                impact: violation.impact as SkippedViolation['impact'],
                description: violation.description,
                selector: violation.selector,
                html: violation.html,
                reason: violation.skipReason ?? 'Unknown reason',
                attempts: 1,
            });
        }
    }

    const createdAt = new Date(response.createdAt).getTime();
    const completedAt = response.completedAt
        ? new Date(response.completedAt).getTime()
        : Date.now();
    const duration = completedAt - createdAt;

    return {
        sessionId: response.id,
        url: response.url,
        viewport: response.viewport,
        timestamp: response.completedAt ?? response.createdAt,
        duration,
        pageScreenshot: response.pageScreenshot,
        summary: {
            totalViolations: response.summary.totalViolations,
            fixedCount: response.summary.fixedCount,
            skippedCount: response.summary.skippedCount,
            humanReviewCount: humanReview.length,
        },
        violations,
        fixes,
        skipped,
        humanReview,
    };
}

/**
 * Get a remediation report by session ID
 * Requirements: 5.1
 */
export async function getReport(sessionId: string): Promise<RemediationReport> {
    const response = await apiClient.get<ApiReportResponse>(`/reports/${sessionId}`);
    return transformApiResponse(response);
}

/**
 * Export a report in the specified format
 * Requirements: 5.5
 */
export async function exportReport(
    sessionId: string,
    format: ExportFormat
): Promise<Blob> {
    // For export, we need to make a raw fetch request with auth token
    // because the response could be HTML (not JSON)
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const { isSaasMode } = await import('@/config/env');

    let token: string | null = null;
    if (isSaasMode()) {
        try {
            const session = await fetchAuthSession();
            // Use ID token for API Gateway Cognito authorizer (same as CognitoAuthAdapter.getToken)
            token = session.tokens?.idToken?.toString() ?? session.tokens?.accessToken?.toString() ?? null;
        } catch {
            // Continue without token
        }
    }

    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    const url = `${baseUrl}/reports/${sessionId}/export?format=${format}`;

    const headers: Record<string, string> = {
        Accept: format === 'json' ? 'application/json' : 'text/html',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
}

/**
 * Hook for fetching a report
 * Waits for auth to be ready before fetching (in SaaS mode)
 * Requirements: 5.1
 */
export function useReport(sessionId: string) {
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

    // In SaaS mode, wait for auth to be ready before fetching
    // This prevents 401 errors when the page refreshes and Cognito session is being restored
    const isAuthReady = isSaasMode() ? (!isAuthLoading && isAuthenticated) : true;

    return useQuery({
        queryKey: queryKeys.reports.detail(sessionId),
        queryFn: () => getReport(sessionId),
        enabled: !!sessionId && isAuthReady,
    });
}

/**
 * Hook for exporting a report
 * Requirements: 5.5
 */
export function useExportReport() {
    return useMutation({
        mutationFn: ({ sessionId, format }: { sessionId: string; format: ExportFormat }) =>
            exportReport(sessionId, format),
        onSuccess: (blob, { sessionId, format }) => {
            downloadBlob(blob, `accessibility-report-${sessionId}.${format}`);
        },
    });
}

/**
 * Trigger file download from a Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Report API object for direct access
 */
export const reportApi = {
    getReport,
    exportReport,
};
