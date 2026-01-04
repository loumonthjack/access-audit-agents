/**
 * Type definitions for the local API server
 */

export interface UserContext {
    userId: string;
    email: string;
}

export interface Session {
    id: string;
    userId: string;
    url: string;
    viewport: 'desktop' | 'mobile';
    status: 'scanning' | 'complete' | 'error';
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export interface SessionSummary {
    totalViolations: number;
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
    fixedCount: number;
    skippedCount: number;
    pendingCount: number;
}

export interface Violation {
    id: string;
    sessionId: string;
    ruleId: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    selector: string;
    html: string;
    status: 'pending' | 'fixed' | 'skipped';
    skipReason?: string;
}

export interface AppliedFix {
    violationId: string;
    fixType: 'attribute' | 'content' | 'style';
    beforeHtml: string;
    afterHtml: string;
    reasoning: string;
    appliedAt: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
}

export interface ScanRequest {
    url: string;
    viewport?: 'desktop' | 'mobile';
}

export interface AuthTokenPayload {
    userId: string;
    email: string;
    iat: number;
    exp: number;
}



// ============================================================================
// Batch Scan Types
// ============================================================================

export type BatchStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
export type BatchPageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

export interface BatchSession {
    id: string;
    userId: string;
    orgId: string;
    name?: string;
    status: BatchStatus;
    viewport: 'mobile' | 'desktop';
    totalPages: number;
    completedPages: number;
    failedPages: number;
    totalViolations: number;
    sitemapUrl?: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    completedAt?: string;
    pausedAt?: string;
}

export interface BatchPage {
    id: string;
    batchId: string;
    url: string;
    status: BatchPageStatus;
    scanSessionId?: string;
    violationCount: number;
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface BatchProgress {
    completedPages: number;
    totalPages: number;
    failedPages: number;
    totalViolations: number;
    estimatedTimeRemaining: number;
}

export interface BatchSummary {
    totalPages: number;
    successfulPages: number;
    failedPages: number;
    totalViolations: number;
    violationsByImpact: Record<ImpactLevel, number>;
    violationsByRule: Record<string, number>;
    mostCommonViolations: ViolationSummary[];
}

export interface ViolationSummary {
    ruleId: string;
    description: string;
    impact: ImpactLevel;
    count: number;
    affectedPages: number;
}

export interface BatchReport {
    batchId: string;
    name?: string;
    sitemapUrl?: string;
    viewport: 'mobile' | 'desktop';
    createdAt: string;
    completedAt: string;
    duration: number;
    summary: {
        totalPages: number;
        successfulPages: number;
        failedPages: number;
        totalViolations: number;
        fixedViolations: number;
        skippedViolations: number;
    };
    violationsByImpact: Record<ImpactLevel, number>;
    violationsByRule: Array<{
        ruleId: string;
        description: string;
        count: number;
        impact: ImpactLevel;
    }>;
    pages: Array<{
        url: string;
        status: BatchPageStatus;
        violationCount: number;
        scanSessionId?: string;
        errorMessage?: string;
    }>;
    recommendations: Array<{
        priority: number;
        ruleId: string;
        description: string;
        affectedPages: number;
        suggestedAction: string;
    }>;
}
