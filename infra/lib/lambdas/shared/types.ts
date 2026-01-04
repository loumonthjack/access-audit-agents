/**
 * Shared Types for Lambda Functions
 */

export interface Session {
    id: string;
    orgId: string;
    userId: string;
    url: string;
    viewport: 'mobile' | 'desktop';
    status: SessionStatus;
    errorMessage?: string;
    bedrockSessionId?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export type SessionStatus =
    | 'pending'
    | 'scanning'
    | 'remediating'
    | 'complete'
    | 'error';

export interface Violation {
    id: string;
    sessionId: string;
    ruleId: string;
    impact: ImpactLevel;
    description: string;
    help?: string;
    helpUrl?: string;
    selector: string;
    html?: string;
    failureSummary?: string;
    status: ViolationStatus;
    skipReason?: string;
    retryCount: number;
    createdAt: string;
    updatedAt: string;
    fixedAt?: string;
}

export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

export type ViolationStatus = 'pending' | 'processing' | 'fixed' | 'skipped';

export interface AppliedFix {
    id: string;
    violationId: string;
    fixType: FixType;
    beforeHtml?: string;
    afterHtml?: string;
    reasoning?: string;
    appliedAt: string;
}

export type FixType = 'attribute' | 'content' | 'style';

export interface WebSocketConnection {
    connectionId: string;
    userId?: string;
    sessionId?: string;
    batchId?: string;
    connectedAt: string;
    lastPingAt: string;
}

export interface ScanRequest {
    url: string;
    viewport?: 'mobile' | 'desktop';
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

export interface PaginationParams {
    limit: number;
    offset: number;
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

export interface WebSocketMessage {
    type: string;
    sessionId?: string;
    timestamp: string;
    [key: string]: unknown;
}

export interface UserContext {
    userId: string;
    orgId: string;
    email?: string;
}

// ============================================================================
// Batch Scanning Types
// ============================================================================

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

export type BatchStatus =
    | 'pending'
    | 'running'
    | 'paused'
    | 'completed'
    | 'cancelled'
    | 'error';

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
    createdAt: string;
    updatedAt: string;
}

export type BatchPageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface CreateBatchRequest {
    urls: string[];
    viewport: 'mobile' | 'desktop';
    name?: string;
    sitemapUrl?: string;
}

export interface BatchProgress {
    completedPages: number;
    totalPages: number;
    failedPages: number;
    totalViolations: number;
    estimatedTimeRemaining: number; // seconds
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
    count: number;
    impact: ImpactLevel;
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
        count: number;
        suggestedAction: string;
    }>;
}

export type BatchProgressEvent =
    | { type: 'batch:started'; batchId: string; totalPages: number }
    | { type: 'batch:page_started'; batchId: string; pageUrl: string; pageIndex: number }
    | { type: 'batch:page_complete'; batchId: string; pageUrl: string; violations: number; progress: BatchProgress }
    | { type: 'batch:page_failed'; batchId: string; pageUrl: string; error: string }
    | { type: 'batch:paused'; batchId: string }
    | { type: 'batch:resumed'; batchId: string }
    | { type: 'batch:completed'; batchId: string; summary: BatchSummary }
    | { type: 'batch:cancelled'; batchId: string }
    | { type: 'batch:error'; batchId: string; message: string };

