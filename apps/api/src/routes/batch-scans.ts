/**
 * Batch Scan Routes
 *
 * Endpoints for creating and managing batch accessibility scans.
 * Requirements: 8.1, 8.4, 8.5, 10.1
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { query, transaction } from '../services/database.js';
import { invokeBedrock } from '../services/bedrock.js';
import { notifyBatch } from '../services/websocket.js';
import type {
    BatchSession,
    BatchPage,
    BatchStatus,
    BatchPageStatus,
    BatchProgress,
    BatchSummary,
    BatchReport,
    ImpactLevel,
} from '../types/index.js';

export const batchScanRoutes = Router();

batchScanRoutes.use(authMiddleware);

// ============================================================================
// Types
// ============================================================================

interface CreateBatchRequest {
    urls: string[];
    viewport?: 'mobile' | 'desktop';
    name?: string;
    sitemapUrl?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const DELAY_BETWEEN_SCANS_MS = 2000;
const MAX_RETRIES = 2;

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Get a batch session by ID
 */
async function getBatchSession(batchId: string, userId: string): Promise<BatchSession | null> {
    const result = await query<BatchSession>(
        `SELECT id, user_id as "userId", org_id as "orgId", name, status, viewport,
                total_pages as "totalPages", completed_pages as "completedPages",
                failed_pages as "failedPages", total_violations as "totalViolations",
                sitemap_url as "sitemapUrl", created_at as "createdAt",
                updated_at as "updatedAt", started_at as "startedAt",
                completed_at as "completedAt", paused_at as "pausedAt"
         FROM batch_sessions WHERE id = $1 AND user_id = $2`,
        [batchId, userId]
    );
    return result.rows[0] ?? null;
}

/**
 * Get pending pages for a batch session
 */
async function getPendingBatchPages(batchId: string): Promise<BatchPage[]> {
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
async function updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    additionalFields?: Record<string, unknown>
): Promise<void> {
    let sql = `UPDATE batch_sessions SET status = $1, updated_at = NOW()`;
    const params: unknown[] = [status];
    let paramIndex = 2;

    if (status === 'running') {
        sql += `, started_at = COALESCE(started_at, NOW())`;
    }
    if (status === 'paused') {
        sql += `, paused_at = NOW()`;
    }
    if (status === 'completed' || status === 'cancelled' || status === 'error') {
        sql += `, completed_at = NOW()`;
    }

    sql += ` WHERE id = $${paramIndex}`;
    params.push(batchId);

    await query(sql, params);
}

/**
 * Update batch page status
 */
async function updateBatchPageStatus(
    pageId: string,
    status: BatchPageStatus,
    additionalFields?: Record<string, unknown>
): Promise<void> {
    let sql = `UPDATE batch_pages SET status = $1, updated_at = NOW()`;
    const params: unknown[] = [status];
    let paramIndex = 2;

    if (status === 'running') {
        sql += `, started_at = NOW()`;
    }
    if (status === 'completed' || status === 'failed' || status === 'skipped') {
        sql += `, completed_at = NOW()`;
    }

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
async function updateBatchCounters(
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
async function isBatchPausedOrCancelled(batchId: string): Promise<{ paused: boolean; cancelled: boolean }> {
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
// Progress Calculation
// ============================================================================

/**
 * Calculate current batch progress
 */
async function calculateBatchProgress(batchId: string): Promise<BatchProgress> {
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
async function generateBatchSummary(batchId: string): Promise<BatchSummary> {
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

    const commonResult = await query<{
        ruleId: string;
        description: string;
        impact: ImpactLevel;
        count: number;
        affectedPages: number;
    }>(
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
// Batch Processing
// ============================================================================

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scan a single page
 */
async function scanPage(
    page: BatchPage,
    viewport: 'mobile' | 'desktop',
    userId: string
): Promise<{ success: boolean; violationCount: number; scanSessionId?: string; error?: string }> {
    const defaultOrgId = '00000000-0000-0000-0000-000000000000';

    try {
        const sessionResult = await query<{ id: string }>(
            `INSERT INTO scan_sessions (org_id, user_id, url, viewport, status)
             VALUES ($1, $2, $3, $4, 'scanning')
             RETURNING id`,
            [defaultOrgId, userId, page.url, viewport]
        );
        const scanSessionId = sessionResult.rows[0].id;

        await invokeBedrock(scanSessionId, page.url, viewport);

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

/**
 * Process a batch scan - main orchestration logic
 */
async function processBatch(batchId: string, userId: string): Promise<void> {
    console.log(`Starting batch processing for ${batchId}`);

    const batch = await getBatchSession(batchId, userId);
    if (!batch) {
        console.error(`Batch ${batchId} not found`);
        return;
    }

    await updateBatchStatus(batchId, 'running');

    // Notify batch started
    notifyBatch(batchId, {
        type: 'batch:started',
        batchId,
        totalPages: batch.totalPages,
    });

    const pendingPages = await getPendingBatchPages(batchId);
    let pageIndex = batch.completedPages + batch.failedPages;

    for (const page of pendingPages) {
        const { paused, cancelled } = await isBatchPausedOrCancelled(batchId);

        if (cancelled) {
            console.log(`Batch ${batchId} was cancelled`);
            notifyBatch(batchId, { type: 'batch:cancelled', batchId });
            return;
        }

        if (paused) {
            console.log(`Batch ${batchId} is paused, stopping processing`);
            notifyBatch(batchId, { type: 'batch:paused', batchId });
            return;
        }

        await processPage(batchId, page, batch.viewport, userId, pageIndex);
        pageIndex++;

        if (pageIndex < batch.totalPages) {
            await delay(DELAY_BETWEEN_SCANS_MS);
        }
    }

    const finalBatch = await getBatchSession(batchId, userId);
    if (finalBatch && finalBatch.status === 'running') {
        await updateBatchStatus(batchId, 'completed');

        // Notify batch completed with summary
        const summary = await generateBatchSummary(batchId);
        notifyBatch(batchId, {
            type: 'batch:completed',
            batchId,
            summary,
        });

        console.log(`Batch ${batchId} completed successfully`);
    }
}

/**
 * Process a single page with retry logic
 */
async function processPage(
    batchId: string,
    page: BatchPage,
    viewport: 'mobile' | 'desktop',
    userId: string,
    pageIndex: number
): Promise<void> {
    console.log(`Processing page ${pageIndex + 1}: ${page.url}`);

    await updateBatchPageStatus(page.id, 'running');

    // Notify page started
    notifyBatch(batchId, {
        type: 'batch:page_started',
        batchId,
        pageUrl: page.url,
        pageIndex,
    });

    let retryCount = 0;
    let lastError: string | undefined;

    while (retryCount <= MAX_RETRIES) {
        const result = await scanPage(page, viewport, userId);

        if (result.success) {
            await updateBatchPageStatus(page.id, 'completed', {
                scanSessionId: result.scanSessionId,
                violationCount: result.violationCount,
            });

            await updateBatchCounters(batchId, 1, 0, result.violationCount);

            // Notify page completed with progress
            const progress = await calculateBatchProgress(batchId);
            notifyBatch(batchId, {
                type: 'batch:page_complete',
                batchId,
                pageUrl: page.url,
                violations: result.violationCount,
                progress,
            });

            console.log(`Page ${page.url} completed with ${result.violationCount} violations`);
            return;
        }

        lastError = result.error ?? 'Unknown error';
        retryCount++;

        if (retryCount <= MAX_RETRIES) {
            console.log(`Retrying page ${page.url} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            await delay(5000);
        }
    }

    await updateBatchPageStatus(page.id, 'failed', { errorMessage: lastError });
    await updateBatchCounters(batchId, 0, 1, 0);

    // Notify page failed
    notifyBatch(batchId, {
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
 */
async function pauseBatch(batchId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const batch = await getBatchSession(batchId, userId);

    if (!batch) {
        return { success: false, message: 'Batch not found' };
    }

    if (batch.status !== 'running') {
        return { success: false, message: `Cannot pause batch with status: ${batch.status}` };
    }

    await updateBatchStatus(batchId, 'paused');
    notifyBatch(batchId, { type: 'batch:paused', batchId });
    return { success: true, message: 'Batch paused successfully' };
}

/**
 * Resume a paused batch
 */
async function resumeBatch(batchId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const batch = await getBatchSession(batchId, userId);

    if (!batch) {
        return { success: false, message: 'Batch not found' };
    }

    if (batch.status !== 'paused') {
        return { success: false, message: `Cannot resume batch with status: ${batch.status}` };
    }

    await updateBatchStatus(batchId, 'running');
    notifyBatch(batchId, { type: 'batch:resumed', batchId });

    // Continue processing asynchronously
    setImmediate(() => processBatch(batchId, userId).catch(console.error));

    return { success: true, message: 'Batch resumed successfully' };
}

/**
 * Cancel a batch scan
 */
async function cancelBatch(batchId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const batch = await getBatchSession(batchId, userId);

    if (!batch) {
        return { success: false, message: 'Batch not found' };
    }

    if (batch.status === 'completed' || batch.status === 'cancelled') {
        return { success: false, message: `Cannot cancel batch with status: ${batch.status}` };
    }

    await query(
        `UPDATE batch_pages SET status = 'skipped', completed_at = NOW()
         WHERE batch_id = $1 AND status IN ('pending', 'running')`,
        [batchId]
    );

    await updateBatchStatus(batchId, 'cancelled');
    notifyBatch(batchId, { type: 'batch:cancelled', batchId });
    return { success: true, message: 'Batch cancelled successfully' };
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a full batch report
 */
async function generateBatchReport(batchId: string, userId: string): Promise<BatchReport | null> {
    const batch = await getBatchSession(batchId, userId);
    if (!batch) {
        return null;
    }

    const summary = await generateBatchSummary(batchId);

    // Get all pages
    const pagesResult = await query<{
        url: string;
        status: BatchPageStatus;
        violationCount: number;
        scanSessionId?: string;
        errorMessage?: string;
    }>(
        `SELECT url, status, violation_count as "violationCount",
                scan_session_id as "scanSessionId", error_message as "errorMessage"
         FROM batch_pages WHERE batch_id = $1
         ORDER BY created_at ASC`,
        [batchId]
    );

    // Generate recommendations
    const recommendationsResult = await query<{
        ruleId: string;
        description: string;
        impact: ImpactLevel;
        count: number;
        affectedPages: number;
    }>(
        `SELECT v.rule_id as "ruleId", v.description, v.impact,
                COUNT(*)::int as count,
                COUNT(DISTINCT bp.id)::int as "affectedPages"
         FROM violations v
         JOIN scan_sessions s ON s.id = v.session_id
         JOIN batch_pages bp ON bp.scan_session_id = s.id
         WHERE bp.batch_id = $1
         GROUP BY v.rule_id, v.description, v.impact
         ORDER BY
            CASE v.impact
                WHEN 'critical' THEN 1
                WHEN 'serious' THEN 2
                WHEN 'moderate' THEN 3
                WHEN 'minor' THEN 4
            END,
            count DESC
         LIMIT 20`,
        [batchId]
    );

    const recommendations = recommendationsResult.rows.map((row, index) => ({
        priority: index + 1,
        ruleId: row.ruleId,
        description: row.description,
        affectedPages: row.affectedPages,
        suggestedAction: getSuggestedAction(row.ruleId, row.impact),
    }));

    const duration = batch.completedAt && batch.startedAt
        ? new Date(batch.completedAt).getTime() - new Date(batch.startedAt).getTime()
        : 0;

    return {
        batchId: batch.id,
        name: batch.name,
        sitemapUrl: batch.sitemapUrl,
        viewport: batch.viewport,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt ?? new Date().toISOString(),
        duration,
        summary: {
            totalPages: summary.totalPages,
            successfulPages: summary.successfulPages,
            failedPages: summary.failedPages,
            totalViolations: summary.totalViolations,
            fixedViolations: 0,
            skippedViolations: 0,
        },
        violationsByImpact: summary.violationsByImpact,
        violationsByRule: Object.entries(summary.violationsByRule).map(([ruleId, count]) => ({
            ruleId,
            description: '',
            count,
            impact: 'moderate' as ImpactLevel,
        })),
        pages: pagesResult.rows,
        recommendations,
    };
}

/**
 * Get suggested action for a violation rule
 */
function getSuggestedAction(ruleId: string, impact: ImpactLevel): string {
    const actions: Record<string, string> = {
        'image-alt': 'Add descriptive alt text to all images',
        'color-contrast': 'Ensure text has sufficient color contrast ratio',
        'label': 'Add labels to all form inputs',
        'link-name': 'Provide descriptive text for all links',
        'button-name': 'Add accessible names to all buttons',
        'html-has-lang': 'Add lang attribute to the html element',
        'document-title': 'Add a descriptive title to the page',
    };

    return actions[ruleId] ?? `Review and fix ${impact} ${ruleId} violations`;
}

/**
 * Export report as HTML
 */
function exportReportAsHtml(report: BatchReport): string {
    const impactColors: Record<ImpactLevel, string> = {
        critical: '#dc2626',
        serious: '#ea580c',
        moderate: '#ca8a04',
        minor: '#2563eb',
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - ${report.name ?? report.batchId}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f9fafb; }
        h1 { color: #111827; }
        h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 20px 0; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .card h3 { margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; }
        .card .value { font-size: 32px; font-weight: bold; color: #111827; }
        .impact-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px; font-weight: 500; }
        .impact-critical { background: ${impactColors.critical}; }
        .impact-serious { background: ${impactColors.serious}; }
        .impact-moderate { background: ${impactColors.moderate}; }
        .impact-minor { background: ${impactColors.minor}; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f3f4f6; font-weight: 600; color: #374151; }
        .status-completed { color: #059669; }
        .status-failed { color: #dc2626; }
        .recommendations { margin-top: 20px; }
        .recommendation { background: white; padding: 16px; margin: 8px 0; border-radius: 8px; border-left: 4px solid #3b82f6; }
    </style>
</head>
<body>
    <h1>Accessibility Report</h1>
    <p><strong>Batch:</strong> ${report.name ?? report.batchId}</p>
    ${report.sitemapUrl ? `<p><strong>Sitemap:</strong> ${report.sitemapUrl}</p>` : ''}
    <p><strong>Viewport:</strong> ${report.viewport}</p>
    <p><strong>Generated:</strong> ${new Date(report.completedAt).toLocaleString()}</p>
    
    <h2>Summary</h2>
    <div class="summary">
        <div class="card">
            <h3>Total Pages</h3>
            <div class="value">${report.summary.totalPages}</div>
        </div>
        <div class="card">
            <h3>Successful</h3>
            <div class="value" style="color: #059669">${report.summary.successfulPages}</div>
        </div>
        <div class="card">
            <h3>Failed</h3>
            <div class="value" style="color: #dc2626">${report.summary.failedPages}</div>
        </div>
        <div class="card">
            <h3>Total Violations</h3>
            <div class="value">${report.summary.totalViolations}</div>
        </div>
    </div>

    <h2>Violations by Impact</h2>
    <div class="summary">
        <div class="card">
            <h3><span class="impact-badge impact-critical">Critical</span></h3>
            <div class="value">${report.violationsByImpact.critical}</div>
        </div>
        <div class="card">
            <h3><span class="impact-badge impact-serious">Serious</span></h3>
            <div class="value">${report.violationsByImpact.serious}</div>
        </div>
        <div class="card">
            <h3><span class="impact-badge impact-moderate">Moderate</span></h3>
            <div class="value">${report.violationsByImpact.moderate}</div>
        </div>
        <div class="card">
            <h3><span class="impact-badge impact-minor">Minor</span></h3>
            <div class="value">${report.violationsByImpact.minor}</div>
        </div>
    </div>

    <h2>Pages Scanned</h2>
    <table>
        <thead>
            <tr>
                <th>URL</th>
                <th>Status</th>
                <th>Violations</th>
            </tr>
        </thead>
        <tbody>
            ${report.pages.map(page => `
            <tr>
                <td>${page.url}</td>
                <td class="status-${page.status}">${page.status}</td>
                <td>${page.violationCount ?? '-'}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>

    ${report.recommendations.length > 0 ? `
    <h2>Recommendations</h2>
    <div class="recommendations">
        ${report.recommendations.map(rec => `
        <div class="recommendation">
            <strong>#${rec.priority}: ${rec.ruleId}</strong>
            <p>${rec.description}</p>
            <p><em>Affected pages: ${rec.affectedPages}</em></p>
            <p><strong>Suggested action:</strong> ${rec.suggestedAction}</p>
        </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>`;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/batch-scans
 * Create a new batch scan
 * Requirements: 8.1
 */
batchScanRoutes.post('/', async (request, response) => {
    try {
        const user = request.user!;
        const body = request.body as CreateBatchRequest;

        if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
            response.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'URLs array is required',
            });
            return;
        }

        // Validate URLs
        for (const url of body.urls) {
            try {
                new URL(url);
            } catch {
                response.status(400).json({
                    code: 'VALIDATION_ERROR',
                    message: `Invalid URL: ${url}`,
                });
                return;
            }
        }

        const viewport = body.viewport ?? 'desktop';
        const defaultOrgId = '00000000-0000-0000-0000-000000000000';

        // Create batch session
        const batchResult = await query<BatchSession>(
            `INSERT INTO batch_sessions (org_id, user_id, name, viewport, total_pages, sitemap_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')
             RETURNING id, user_id as "userId", org_id as "orgId", name, status, viewport,
                       total_pages as "totalPages", completed_pages as "completedPages",
                       failed_pages as "failedPages", total_violations as "totalViolations",
                       sitemap_url as "sitemapUrl", created_at as "createdAt",
                       updated_at as "updatedAt"`,
            [defaultOrgId, user.userId, body.name ?? null, viewport, body.urls.length, body.sitemapUrl ?? null]
        );

        const batch = batchResult.rows[0];

        // Create batch pages
        for (const url of body.urls) {
            await query(
                `INSERT INTO batch_pages (batch_id, url, status)
                 VALUES ($1, $2, 'pending')`,
                [batch.id, url]
            );
        }

        // Start processing asynchronously
        setImmediate(() => processBatch(batch.id, user.userId).catch(console.error));

        response.status(201).json(batch);
    } catch (error) {
        console.error('Create batch scan error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to create batch scan',
        });
    }
});

/**
 * GET /api/batch-scans
 * List all batch scans for the current user
 */
batchScanRoutes.get('/', async (request, response) => {
    try {
        const user = request.user!;
        const limit = Math.min(parseInt(request.query.limit as string) || 20, 100);
        const offset = parseInt(request.query.offset as string) || 0;

        const result = await query<BatchSession>(
            `SELECT id, user_id as "userId", org_id as "orgId", name, status, viewport,
                    total_pages as "totalPages", completed_pages as "completedPages",
                    failed_pages as "failedPages", total_violations as "totalViolations",
                    sitemap_url as "sitemapUrl", created_at as "createdAt",
                    updated_at as "updatedAt", started_at as "startedAt",
                    completed_at as "completedAt", paused_at as "pausedAt"
             FROM batch_sessions
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [user.userId, limit, offset]
        );

        const countResult = await query<{ count: number }>(
            `SELECT COUNT(*)::int as count FROM batch_sessions WHERE user_id = $1`,
            [user.userId]
        );

        response.json({
            data: result.rows,
            pagination: {
                total: countResult.rows[0]?.count ?? 0,
                limit,
                offset,
                hasMore: offset + result.rows.length < (countResult.rows[0]?.count ?? 0),
            },
        });
    } catch (error) {
        console.error('List batch scans error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to list batch scans',
        });
    }
});

/**
 * GET /api/batch-scans/:id
 * Get batch scan status
 * Requirements: 8.1
 */
batchScanRoutes.get('/:id', async (request, response) => {
    try {
        const user = request.user!;
        const { id } = request.params;

        const batch = await getBatchSession(id, user.userId);

        if (!batch) {
            response.status(404).json({
                code: 'NOT_FOUND',
                message: 'Batch not found',
            });
            return;
        }

        const progress = await calculateBatchProgress(id);

        response.json({ ...batch, progress });
    } catch (error) {
        console.error('Get batch scan error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to get batch scan',
        });
    }
});

/**
 * POST /api/batch-scans/:id/pause
 * Pause a batch scan
 * Requirements: 8.4
 */
batchScanRoutes.post('/:id/pause', async (request, response) => {
    try {
        const user = request.user!;
        const { id } = request.params;

        const result = await pauseBatch(id, user.userId);

        if (!result.success) {
            response.status(400).json({
                code: 'INVALID_OPERATION',
                message: result.message,
            });
            return;
        }

        response.json({ message: result.message });
    } catch (error) {
        console.error('Pause batch scan error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to pause batch scan',
        });
    }
});

/**
 * POST /api/batch-scans/:id/resume
 * Resume a batch scan
 * Requirements: 8.4
 */
batchScanRoutes.post('/:id/resume', async (request, response) => {
    try {
        const user = request.user!;
        const { id } = request.params;

        const result = await resumeBatch(id, user.userId);

        if (!result.success) {
            response.status(400).json({
                code: 'INVALID_OPERATION',
                message: result.message,
            });
            return;
        }

        response.json({ message: result.message });
    } catch (error) {
        console.error('Resume batch scan error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to resume batch scan',
        });
    }
});

/**
 * POST /api/batch-scans/:id/cancel
 * Cancel a batch scan
 * Requirements: 8.5
 */
batchScanRoutes.post('/:id/cancel', async (request, response) => {
    try {
        const user = request.user!;
        const { id } = request.params;

        const result = await cancelBatch(id, user.userId);

        if (!result.success) {
            response.status(400).json({
                code: 'INVALID_OPERATION',
                message: result.message,
            });
            return;
        }

        response.json({ message: result.message });
    } catch (error) {
        console.error('Cancel batch scan error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to cancel batch scan',
        });
    }
});

/**
 * GET /api/batch-scans/:id/report
 * Get batch scan report
 * Requirements: 10.1
 */
batchScanRoutes.get('/:id/report', async (request, response) => {
    try {
        const user = request.user!;
        const { id } = request.params;
        const format = (request.query.format as string)?.toLowerCase();

        const report = await generateBatchReport(id, user.userId);

        if (!report) {
            response.status(404).json({
                code: 'NOT_FOUND',
                message: 'Batch not found',
            });
            return;
        }

        // Export as HTML
        if (format === 'html') {
            const html = exportReportAsHtml(report);
            response.setHeader('Content-Type', 'text/html');
            response.setHeader('Content-Disposition', `attachment; filename="accessibility-report-${id}.html"`);
            response.send(html);
            return;
        }

        // Export as JSON download
        if (format === 'json-download') {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Content-Disposition', `attachment; filename="accessibility-report-${id}.json"`);
            response.send(JSON.stringify(report, null, 2));
            return;
        }

        // Default: return JSON response
        response.json(report);
    } catch (error) {
        console.error('Get batch report error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to get batch report',
        });
    }
});

/**
 * GET /api/batch-scans/:id/pages
 * Get pages for a batch scan
 */
batchScanRoutes.get('/:id/pages', async (request, response) => {
    try {
        const user = request.user!;
        const { id } = request.params;

        const batch = await getBatchSession(id, user.userId);
        if (!batch) {
            response.status(404).json({
                code: 'NOT_FOUND',
                message: 'Batch not found',
            });
            return;
        }

        const result = await query<BatchPage>(
            `SELECT id, batch_id as "batchId", url, status,
                    scan_session_id as "scanSessionId", violation_count as "violationCount",
                    error_message as "errorMessage", started_at as "startedAt",
                    completed_at as "completedAt"
             FROM batch_pages
             WHERE batch_id = $1
             ORDER BY created_at ASC`,
            [id]
        );

        response.json({ pages: result.rows });
    } catch (error) {
        console.error('Get batch pages error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to get batch pages',
        });
    }
});
