/**
 * Batch Orchestrator Lambda Handler
 *
 * Orchestrates batch accessibility scans by processing multiple URLs sequentially.
 * Supports pause/resume/cancel operations and integrates with existing scan manager.
 *
 * Requirements: 8.2, 8.3, 8.4, 8.5, 9.5
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, SQSEvent } from 'aws-lambda';
import { query, queryWithOrg, transaction } from '../shared/database';
import type {
    BatchSession,
    BatchPage,
    BatchStatus,
    BatchPageStatus,
    BatchProgress,
    BatchSummary,
    BatchProgressEvent,
    UserContext,
    ImpactLevel,
    ViolationSummary,
} from '../shared/types';
import { notifyBatchProgress } from './websocket';
import { generateBatchReport, exportReportAsJson, exportReportAsHtml } from './report-generator';

// ============================================================================
// Configuration
// ============================================================================

export interface BatchOrchestratorConfig {
    concurrency: number; // Default: 1 (sequential)
    delayBetweenScans: number; // Default: 2000ms
    maxRetries: number; // Default: 2
    timeoutPerPage: number; // Default: 120000ms (2 minutes)
}

// Free tier Browserless.io config:
// - 1 concurrent session
// - Max 1 minute per session
// - 1,000 units/month (1 unit = 30 seconds)
// - Queue fills up → 429 errors
const DEFAULT_CONFIG: BatchOrchestratorConfig = {
    concurrency: 1,
    delayBetweenScans: 10000, // 10 seconds - ensures previous session fully closes
    maxRetries: 3,           // More retries for queue-related failures
    timeoutPerPage: 55000,   // 55 seconds - stay under 1 minute max
};

// Retryable error types
const RETRYABLE_ERRORS = ['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMITED', '429', 'TOO MANY REQUESTS', 'BROWSERLESS', 'BROWSER_SERVICE_ERROR'];
const NON_RETRYABLE_ERRORS = ['PAGE_NOT_FOUND', 'ACCESS_DENIED', 'INVALID_CONTENT'];


// ============================================================================
// Database Operations
// ============================================================================

/**
 * Get a batch session by ID
 */
export async function getBatchSession(batchId: string): Promise<BatchSession | null> {
    const result = await query<BatchSession>(
        `SELECT id, user_id as "userId", org_id as "orgId", name, status, viewport,
                total_pages as "totalPages", completed_pages as "completedPages",
                failed_pages as "failedPages", total_violations as "totalViolations",
                sitemap_url as "sitemapUrl", created_at as "createdAt",
                updated_at as "updatedAt", started_at as "startedAt",
                completed_at as "completedAt", paused_at as "pausedAt"
         FROM batch_sessions WHERE id = $1`,
        [batchId]
    );
    return result.rows[0] ?? null;
}

/**
 * Get pending pages for a batch session
 */
export async function getPendingBatchPages(batchId: string): Promise<BatchPage[]> {
    const result = await query<BatchPage>(
        `SELECT id, batch_id as "batchId", url, status,
                scan_session_id as "scanSessionId", violation_count as "violationCount",
                error_message as "errorMessage", started_at as "startedAt",
                completed_at as "completedAt", created_at as "createdAt",
                updated_at as "updatedAt"
         FROM batch_pages
         WHERE batch_id = $1 AND status = 'pending'
         ORDER BY created_at ASC`,
        [batchId]
    );
    return result.rows;
}

/**
 * Update batch session status
 */
export async function updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    additionalFields?: Record<string, unknown>
): Promise<void> {
    let sql = `UPDATE batch_sessions SET status = $1, updated_at = NOW()`;
    const params: unknown[] = [status];
    let paramIndex = 2;

    // Add timestamp fields based on status
    if (status === 'running' && !additionalFields?.skipStartedAt) {
        sql += `, started_at = COALESCE(started_at, NOW())`;
    }
    if (status === 'paused') {
        sql += `, paused_at = NOW()`;
    }
    if (status === 'completed' || status === 'cancelled' || status === 'error') {
        sql += `, completed_at = NOW()`;
    }

    // Add any additional fields
    if (additionalFields) {
        for (const [key, value] of Object.entries(additionalFields)) {
            if (key === 'skipStartedAt') continue;
            const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
            sql += `, ${snakeKey} = $${paramIndex}`;
            params.push(value);
            paramIndex++;
        }
    }

    sql += ` WHERE id = $${paramIndex}`;
    params.push(batchId);

    await query(sql, params);
}


/**
 * Update batch page status
 */
export async function updateBatchPageStatus(
    pageId: string,
    status: BatchPageStatus,
    additionalFields?: Record<string, unknown>
): Promise<void> {
    let sql = `UPDATE batch_pages SET status = $1, updated_at = NOW()`;
    const params: unknown[] = [status];
    let paramIndex = 2;

    // Add timestamp fields based on status
    if (status === 'running') {
        sql += `, started_at = NOW()`;
    }
    if (status === 'completed' || status === 'failed' || status === 'skipped') {
        sql += `, completed_at = NOW()`;
    }

    // Add any additional fields
    if (additionalFields) {
        for (const [key, value] of Object.entries(additionalFields)) {
            const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
            sql += `, ${snakeKey} = $${paramIndex}`;
            params.push(value);
            paramIndex++;
        }
    }

    sql += ` WHERE id = $${paramIndex}`;
    params.push(pageId);

    await query(sql, params);
}

/**
 * Update batch session counters
 */
export async function updateBatchCounters(
    batchId: string,
    completedDelta: number,
    failedDelta: number,
    violationsDelta: number
): Promise<void> {
    await query(
        `UPDATE batch_sessions SET
            completed_pages = completed_pages + $1,
            failed_pages = failed_pages + $2,
            total_violations = total_violations + $3,
            updated_at = NOW()
         WHERE id = $4`,
        [completedDelta, failedDelta, violationsDelta, batchId]
    );
}

/**
 * Check if batch is paused or cancelled
 */
export async function isBatchPausedOrCancelled(batchId: string): Promise<{ paused: boolean; cancelled: boolean }> {
    const result = await query<{ status: BatchStatus }>(
        `SELECT status FROM batch_sessions WHERE id = $1`,
        [batchId]
    );
    const status = result.rows[0]?.status;
    return {
        paused: status === 'paused',
        cancelled: status === 'cancelled',
    };
}


// ============================================================================
// Scan Integration
// ============================================================================

/**
 * Scan a single page using the existing scan manager infrastructure
 * This creates a scan session and invokes the auditor
 */
export async function scanPage(
    batchId: string,
    page: BatchPage,
    viewport: 'mobile' | 'desktop',
    orgId: string,
    userId: string
): Promise<{ success: boolean; violationCount: number; scanSessionId?: string; error?: string }> {
    const { invokeBedrock } = await import('../scan-manager/bedrock.js');

    try {
        // Create a scan session for this page
        const sessionResult = await query<{ id: string }>(
            `INSERT INTO scan_sessions (org_id, user_id, url, viewport, status)
             VALUES ($1, $2, $3, $4, 'scanning')
             RETURNING id`,
            [orgId, userId, page.url, viewport]
        );
        const scanSessionId = sessionResult.rows[0].id;

        // Invoke the scan (this is synchronous and waits for completion)
        await invokeBedrock(scanSessionId, page.url, viewport);

        // Get the scan result
        const resultQuery = await query<{ status: string; violationCount: number }>(
            `SELECT s.status,
                    COALESCE((SELECT COUNT(*) FROM violations WHERE session_id = s.id), 0)::int as "violationCount"
             FROM scan_sessions s WHERE s.id = $1`,
            [scanSessionId]
        );

        const scanResult = resultQuery.rows[0];

        if (scanResult?.status === 'error') {
            const errorResult = await query<{ errorMessage: string }>(
                `SELECT error_message as "errorMessage" FROM scan_sessions WHERE id = $1`,
                [scanSessionId]
            );
            return {
                success: false,
                violationCount: 0,
                scanSessionId,
                error: errorResult.rows[0]?.errorMessage ?? 'Scan failed',
            };
        }

        return {
            success: true,
            violationCount: scanResult?.violationCount ?? 0,
            scanSessionId,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to scan page ${page.url}:`, errorMessage);
        return {
            success: false,
            violationCount: 0,
            error: errorMessage,
        };
    }
}


// ============================================================================
// Progress Calculation
// ============================================================================

/**
 * Calculate current batch progress
 */
export async function calculateBatchProgress(batchId: string): Promise<BatchProgress> {
    const result = await query<{
        totalPages: number;
        completedPages: number;
        failedPages: number;
        totalViolations: number;
    }>(
        `SELECT total_pages as "totalPages",
                completed_pages as "completedPages",
                failed_pages as "failedPages",
                total_violations as "totalViolations"
         FROM batch_sessions WHERE id = $1`,
        [batchId]
    );

    const batch = result.rows[0];
    if (!batch) {
        return {
            completedPages: 0,
            totalPages: 0,
            failedPages: 0,
            totalViolations: 0,
            estimatedTimeRemaining: 0,
        };
    }

    // Estimate time remaining based on average scan time (assume 30 seconds per page)
    const remainingPages = batch.totalPages - batch.completedPages - batch.failedPages;
    const estimatedTimeRemaining = remainingPages * 30;

    return {
        completedPages: batch.completedPages,
        totalPages: batch.totalPages,
        failedPages: batch.failedPages,
        totalViolations: batch.totalViolations,
        estimatedTimeRemaining,
    };
}

/**
 * Generate batch summary for completion
 */
export async function generateBatchSummary(batchId: string): Promise<BatchSummary> {
    // Get basic counts
    const batchResult = await query<{
        totalPages: number;
        completedPages: number;
        failedPages: number;
        totalViolations: number;
    }>(
        `SELECT total_pages as "totalPages",
                completed_pages as "completedPages",
                failed_pages as "failedPages",
                total_violations as "totalViolations"
         FROM batch_sessions WHERE id = $1`,
        [batchId]
    );

    const batch = batchResult.rows[0];

    // Get violations by impact
    const impactResult = await query<{ impact: ImpactLevel; count: number }>(
        `SELECT v.impact, COUNT(*)::int as count
         FROM violations v
         JOIN scan_sessions s ON s.id = v.session_id
         JOIN batch_pages bp ON bp.scan_session_id = s.id
         WHERE bp.batch_id = $1
         GROUP BY v.impact`,
        [batchId]
    );

    const violationsByImpact: Record<ImpactLevel, number> = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
    };
    for (const row of impactResult.rows) {
        violationsByImpact[row.impact] = row.count;
    }

    // Get violations by rule
    const ruleResult = await query<{ ruleId: string; count: number }>(
        `SELECT v.rule_id as "ruleId", COUNT(*)::int as count
         FROM violations v
         JOIN scan_sessions s ON s.id = v.session_id
         JOIN batch_pages bp ON bp.scan_session_id = s.id
         WHERE bp.batch_id = $1
         GROUP BY v.rule_id
         ORDER BY count DESC`,
        [batchId]
    );

    const violationsByRule: Record<string, number> = {};
    for (const row of ruleResult.rows) {
        violationsByRule[row.ruleId] = row.count;
    }

    // Get most common violations with details
    const commonResult = await query<ViolationSummary>(
        `SELECT v.rule_id as "ruleId", v.description, v.impact,
                COUNT(*)::int as count,
                COUNT(DISTINCT bp.id)::int as "affectedPages"
         FROM violations v
         JOIN scan_sessions s ON s.id = v.session_id
         JOIN batch_pages bp ON bp.scan_session_id = s.id
         WHERE bp.batch_id = $1
         GROUP BY v.rule_id, v.description, v.impact
         ORDER BY count DESC
         LIMIT 10`,
        [batchId]
    );

    return {
        totalPages: batch?.totalPages ?? 0,
        successfulPages: batch?.completedPages ?? 0,
        failedPages: batch?.failedPages ?? 0,
        totalViolations: batch?.totalViolations ?? 0,
        violationsByImpact,
        violationsByRule,
        mostCommonViolations: commonResult.rows,
    };
}


// ============================================================================
// Batch Orchestration
// ============================================================================

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: string): boolean {
    return RETRYABLE_ERRORS.some((e) => error.toUpperCase().includes(e));
}

/**
 * Process a batch scan - main orchestration logic
 * Requirements: 8.2 - Sequential processing, 8.4/8.5 - Pause/resume/cancel
 */
export async function processBatch(
    batchId: string,
    config: BatchOrchestratorConfig = DEFAULT_CONFIG
): Promise<void> {
    console.log(`Starting batch processing for ${batchId}`);

    const batch = await getBatchSession(batchId);
    if (!batch) {
        console.error(`Batch ${batchId} not found`);
        return;
    }

    // Update status to running
    await updateBatchStatus(batchId, 'running');

    // Emit batch started event
    await notifyBatchProgress({
        type: 'batch:started',
        batchId,
        totalPages: batch.totalPages,
    });

    // Get pending pages
    let pendingPages = await getPendingBatchPages(batchId);
    let pageIndex = batch.completedPages + batch.failedPages;

    // Process pages sequentially (Requirements: 8.2)
    for (const page of pendingPages) {
        // Check if batch is paused or cancelled (Requirements: 8.4, 8.5)
        const { paused, cancelled } = await isBatchPausedOrCancelled(batchId);

        if (cancelled) {
            console.log(`Batch ${batchId} was cancelled`);
            await notifyBatchProgress({ type: 'batch:cancelled', batchId });
            return;
        }

        if (paused) {
            console.log(`Batch ${batchId} is paused, stopping processing`);
            await notifyBatchProgress({ type: 'batch:paused', batchId });
            return;
        }

        // Process this page
        await processPage(batchId, page, batch.viewport, batch.orgId, batch.userId, pageIndex, config);
        pageIndex++;

        // Delay between scans to avoid overwhelming target servers
        if (pageIndex < batch.totalPages) {
            await delay(config.delayBetweenScans);
        }
    }

    // Check final status
    const finalBatch = await getBatchSession(batchId);
    if (finalBatch && finalBatch.status === 'running') {
        // All pages processed, mark as completed
        await updateBatchStatus(batchId, 'completed');

        const summary = await generateBatchSummary(batchId);
        await notifyBatchProgress({
            type: 'batch:completed',
            batchId,
            summary,
        });

        console.log(`Batch ${batchId} completed successfully`);
    }
}


/**
 * Process a single page with retry logic
 * Requirements: 9.5 - Page failure resilience
 */
async function processPage(
    batchId: string,
    page: BatchPage,
    viewport: 'mobile' | 'desktop',
    orgId: string,
    userId: string,
    pageIndex: number,
    config: BatchOrchestratorConfig
): Promise<void> {
    console.log(`Processing page ${pageIndex + 1}: ${page.url}`);

    // Update page status to running
    await updateBatchPageStatus(page.id, 'running');

    // Emit page started event
    await notifyBatchProgress({
        type: 'batch:page_started',
        batchId,
        pageUrl: page.url,
        pageIndex,
    });

    let retryCount = 0;
    let lastError: string | undefined;

    // Retry loop
    while (retryCount <= config.maxRetries) {
        const result = await scanPage(batchId, page, viewport, orgId, userId);

        if (result.success) {
            // Page scanned successfully
            await updateBatchPageStatus(page.id, 'completed', {
                scanSessionId: result.scanSessionId,
                violationCount: result.violationCount,
            });

            await updateBatchCounters(batchId, 1, 0, result.violationCount);

            const progress = await calculateBatchProgress(batchId);
            await notifyBatchProgress({
                type: 'batch:page_complete',
                batchId,
                pageUrl: page.url,
                violations: result.violationCount,
                progress,
            });

            console.log(`Page ${page.url} completed with ${result.violationCount} violations`);
            return;
        }

        // Check if error is retryable
        lastError = result.error ?? 'Unknown error';

        if (!isRetryableError(lastError) || retryCount >= config.maxRetries) {
            break;
        }

        retryCount++;
        console.log(`Retrying page ${page.url} (attempt ${retryCount + 1}/${config.maxRetries + 1})`);
        // Wait longer for rate limit errors (10 seconds), shorter for other errors (5 seconds)
        const retryDelay = lastError?.toUpperCase().includes('429') || lastError?.toUpperCase().includes('RATE') ? 10000 : 5000;
        await delay(retryDelay);
    }

    // Page failed after all retries
    await updateBatchPageStatus(page.id, 'failed', {
        errorMessage: lastError,
    });

    await updateBatchCounters(batchId, 0, 1, 0);

    await notifyBatchProgress({
        type: 'batch:page_failed',
        batchId,
        pageUrl: page.url,
        error: lastError ?? 'Unknown error',
    });

    console.log(`Page ${page.url} failed: ${lastError}`);
}


// ============================================================================
// Batch Control Operations
// ============================================================================

/**
 * Pause a running batch
 * Requirements: 8.4 - Pause batch scan
 */
export async function pauseBatch(batchId: string): Promise<{ success: boolean; message: string }> {
    const batch = await getBatchSession(batchId);

    if (!batch) {
        return { success: false, message: 'Batch not found' };
    }

    if (batch.status !== 'running') {
        return { success: false, message: `Cannot pause batch with status: ${batch.status}` };
    }

    await updateBatchStatus(batchId, 'paused');
    await notifyBatchProgress({ type: 'batch:paused', batchId });

    return { success: true, message: 'Batch paused successfully' };
}

/**
 * Resume a paused batch
 * Requirements: 8.4 - Resume batch scan
 */
export async function resumeBatch(batchId: string): Promise<{ success: boolean; message: string }> {
    const batch = await getBatchSession(batchId);

    if (!batch) {
        return { success: false, message: 'Batch not found' };
    }

    if (batch.status !== 'paused') {
        return { success: false, message: `Cannot resume batch with status: ${batch.status}` };
    }

    await updateBatchStatus(batchId, 'running', { skipStartedAt: true });
    await notifyBatchProgress({ type: 'batch:resumed', batchId });

    // Continue processing (this would typically be triggered by SQS in production)
    // For now, we'll process inline
    await processBatch(batchId);

    return { success: true, message: 'Batch resumed successfully' };
}

/**
 * Cancel a batch scan
 * Requirements: 8.5 - Cancel batch scan
 */
export async function cancelBatch(batchId: string): Promise<{ success: boolean; message: string }> {
    const batch = await getBatchSession(batchId);

    if (!batch) {
        return { success: false, message: 'Batch not found' };
    }

    if (batch.status === 'completed' || batch.status === 'cancelled') {
        return { success: false, message: `Cannot cancel batch with status: ${batch.status}` };
    }

    // Mark any running pages as skipped
    await query(
        `UPDATE batch_pages SET status = 'skipped', completed_at = NOW()
         WHERE batch_id = $1 AND status IN ('pending', 'running')`,
        [batchId]
    );

    await updateBatchStatus(batchId, 'cancelled');
    await notifyBatchProgress({ type: 'batch:cancelled', batchId });

    return { success: true, message: 'Batch cancelled successfully' };
}


// ============================================================================
// Batch Creation
// ============================================================================

/**
 * Create a new batch scan session
 * Requirements: 8.1 - Create batch scan session
 */
export async function createBatchSession(
    orgId: string,
    userId: string,
    urls: string[],
    viewport: 'mobile' | 'desktop',
    name?: string,
    sitemapUrl?: string
): Promise<BatchSession> {
    // Create batch session
    const batchResult = await query<BatchSession>(
        `INSERT INTO batch_sessions (org_id, user_id, name, viewport, total_pages, sitemap_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id, user_id as "userId", org_id as "orgId", name, status, viewport,
                   total_pages as "totalPages", completed_pages as "completedPages",
                   failed_pages as "failedPages", total_violations as "totalViolations",
                   sitemap_url as "sitemapUrl", created_at as "createdAt",
                   updated_at as "updatedAt"`,
        [orgId, userId, name ?? null, viewport, urls.length, sitemapUrl ?? null]
    );

    const batch = batchResult.rows[0];

    // Create batch pages
    for (const url of urls) {
        await query(
            `INSERT INTO batch_pages (batch_id, url, status)
             VALUES ($1, $2, 'pending')`,
            [batch.id, url]
        );
    }

    return batch;
}

// ============================================================================
// Lambda Handler Utilities
// ============================================================================

/**
 * Creates a JSON response with CORS headers.
 */
function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        },
        body: JSON.stringify(body),
    };
}

/**
 * Extracts user context from Cognito claims.
 */
function extractUserContext(event: APIGatewayProxyEvent): UserContext {
    const claims = event.requestContext.authorizer?.claims ?? {};
    return {
        userId: claims.sub ?? 'anonymous',
        orgId: claims['custom:orgId'] ?? '00000000-0000-0000-0000-000000000000',
        email: claims.email,
    };
}


// ============================================================================
// API Handlers
// ============================================================================

/**
 * POST /batch-scans - Create a new batch scan
 */
async function handleCreateBatch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);

    let body: { urls: string[]; viewport?: 'mobile' | 'desktop'; name?: string; sitemapUrl?: string };
    try {
        body = JSON.parse(event.body ?? '{}');
    } catch {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' });
    }

    if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'URLs array is required' });
    }

    // Validate URLs
    for (const url of body.urls) {
        try {
            new URL(url);
        } catch {
            return jsonResponse(400, { code: 'VALIDATION_ERROR', message: `Invalid URL: ${url}` });
        }
    }

    const viewport = body.viewport ?? 'desktop';
    const batch = await createBatchSession(
        user.orgId,
        user.userId,
        body.urls,
        viewport,
        body.name,
        body.sitemapUrl
    );

    // Start processing asynchronously (in production, this would be via SQS)
    // For now, we'll return immediately and let the client poll for status
    setImmediate(() => processBatch(batch.id).catch(console.error));

    return jsonResponse(201, batch);
}

/**
 * GET /batch-scans/:id - Get batch scan status
 */
async function handleGetBatch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const batchId = event.pathParameters?.batchId ?? event.pathParameters?.id;

    if (!batchId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Batch ID required' });
    }

    const batch = await getBatchSession(batchId);

    if (!batch) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Batch not found' });
    }

    // Verify org access
    if (batch.orgId !== user.orgId) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Batch not found' });
    }

    const progress = await calculateBatchProgress(batchId);

    return jsonResponse(200, { ...batch, progress });
}

/**
 * POST /batch-scans/:id/pause - Pause a batch scan
 */
async function handlePauseBatch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const batchId = event.pathParameters?.batchId ?? event.pathParameters?.id;

    if (!batchId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Batch ID required' });
    }

    const batch = await getBatchSession(batchId);
    if (!batch || batch.orgId !== user.orgId) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Batch not found' });
    }

    const result = await pauseBatch(batchId);

    if (!result.success) {
        return jsonResponse(400, { code: 'INVALID_OPERATION', message: result.message });
    }

    return jsonResponse(200, { message: result.message });
}

/**
 * POST /batch-scans/:id/resume - Resume a batch scan
 */
async function handleResumeBatch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const batchId = event.pathParameters?.batchId ?? event.pathParameters?.id;

    if (!batchId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Batch ID required' });
    }

    const batch = await getBatchSession(batchId);
    if (!batch || batch.orgId !== user.orgId) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Batch not found' });
    }

    const result = await resumeBatch(batchId);

    if (!result.success) {
        return jsonResponse(400, { code: 'INVALID_OPERATION', message: result.message });
    }

    return jsonResponse(200, { message: result.message });
}

/**
 * POST /batch-scans/:id/cancel - Cancel a batch scan
 */
async function handleCancelBatch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const batchId = event.pathParameters?.batchId ?? event.pathParameters?.id;

    if (!batchId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Batch ID required' });
    }

    const batch = await getBatchSession(batchId);
    if (!batch || batch.orgId !== user.orgId) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Batch not found' });
    }

    const result = await cancelBatch(batchId);

    if (!result.success) {
        return jsonResponse(400, { code: 'INVALID_OPERATION', message: result.message });
    }

    return jsonResponse(200, { message: result.message });
}


/**
 * GET /batch-scans/:id/pages - Get pages for a batch scan
 */
async function handleGetBatchPages(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const batchId = event.pathParameters?.batchId ?? event.pathParameters?.id;

    if (!batchId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Batch ID required' });
    }

    const batch = await getBatchSession(batchId);
    if (!batch || batch.orgId !== user.orgId) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Batch not found' });
    }

    const result = await query<BatchPage>(
        `SELECT id, batch_id as "batchId", url, status,
                scan_session_id as "scanSessionId", violation_count as "violationCount",
                error_message as "errorMessage", started_at as "startedAt",
                completed_at as "completedAt"
         FROM batch_pages
         WHERE batch_id = $1
         ORDER BY created_at ASC`,
        [batchId]
    );

    return jsonResponse(200, { pages: result.rows });
}

/**
 * GET /batch-scans/:id/report - Get batch report
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
async function handleGetBatchReport(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const batchId = event.pathParameters?.batchId ?? event.pathParameters?.id;

    if (!batchId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Batch ID required' });
    }

    const batch = await getBatchSession(batchId);
    if (!batch || batch.orgId !== user.orgId) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Batch not found' });
    }

    // Generate the report
    const report = await generateBatchReport(batchId);
    if (!report) {
        return jsonResponse(500, { code: 'REPORT_ERROR', message: 'Failed to generate report' });
    }

    // Check for export format query parameter
    const format = event.queryStringParameters?.format?.toLowerCase();

    if (format === 'html') {
        const html = exportReportAsHtml(report);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': `attachment; filename="accessibility-report-${batchId}.html"`,
            },
            body: html,
        };
    }

    if (format === 'json-download') {
        const json = exportReportAsJson(report);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': `attachment; filename="accessibility-report-${batchId}.json"`,
            },
            body: json,
        };
    }

    // Default: return JSON response
    return jsonResponse(200, report);
}

// ============================================================================
// SQS Handler (for async processing)
// ============================================================================

/**
 * Handle SQS messages for batch processing
 */
async function handleSQSEvent(event: SQSEvent): Promise<void> {
    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body) as { batchId: string; action: string };

            if (message.action === 'process') {
                await processBatch(message.batchId);
            } else if (message.action === 'resume') {
                await resumeBatch(message.batchId);
            }
        } catch (error) {
            console.error('Failed to process SQS message:', error);
        }
    }
}

// ============================================================================
// Main Lambda Handler
// ============================================================================

/**
 * Main Lambda handler - routes requests to appropriate handlers
 */
export async function handler(
    event: APIGatewayProxyEvent | SQSEvent
): Promise<APIGatewayProxyResult | void> {
    // Check if this is an SQS event
    if ('Records' in event && Array.isArray(event.Records)) {
        await handleSQSEvent(event as SQSEvent);
        return;
    }

    const apiEvent = event as APIGatewayProxyEvent;
    const { httpMethod, path } = apiEvent;
    console.log('Request:', { httpMethod, path });

    try {
        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
                },
                body: '',
            };
        }

        // Route requests
        if (httpMethod === 'POST' && path === '/batch-scans') {
            return await handleCreateBatch(apiEvent);
        }

        // Match /batch-scans/:id
        const batchIdMatch = path.match(/^\/batch-scans\/([^/]+)$/);
        if (batchIdMatch) {
            if (httpMethod === 'GET') {
                return await handleGetBatch(apiEvent);
            }
        }

        // Match /batch-scans/:id/pages
        const pagesMatch = path.match(/^\/batch-scans\/([^/]+)\/pages$/);
        if (pagesMatch && httpMethod === 'GET') {
            return await handleGetBatchPages(apiEvent);
        }

        // Match /batch-scans/:id/report
        const reportMatch = path.match(/^\/batch-scans\/([^/]+)\/report$/);
        if (reportMatch && httpMethod === 'GET') {
            return await handleGetBatchReport(apiEvent);
        }

        // Match /batch-scans/:id/pause
        const pauseMatch = path.match(/^\/batch-scans\/([^/]+)\/pause$/);
        if (pauseMatch && httpMethod === 'POST') {
            return await handlePauseBatch(apiEvent);
        }

        // Match /batch-scans/:id/resume
        const resumeMatch = path.match(/^\/batch-scans\/([^/]+)\/resume$/);
        if (resumeMatch && httpMethod === 'POST') {
            return await handleResumeBatch(apiEvent);
        }

        // Match /batch-scans/:id/cancel
        const cancelMatch = path.match(/^\/batch-scans\/([^/]+)\/cancel$/);
        if (cancelMatch && httpMethod === 'POST') {
            return await handleCancelBatch(apiEvent);
        }

        return jsonResponse(404, {
            code: 'NOT_FOUND',
            message: `Route not found: ${httpMethod} ${path}`,
        });
    } catch (error) {
        console.error('Handler error:', error);
        return jsonResponse(500, {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Internal server error',
        });
    }
}
