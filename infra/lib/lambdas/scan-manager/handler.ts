/**
 * ScanManager Lambda Handler
 * 
 * Orchestrates accessibility scans by invoking Bedrock Agent
 * and managing session state in Aurora PostgreSQL.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryWithOrg, query, transaction } from '../shared/database';
import type {
    Session,
    ScanRequest,
    UserContext,
    PaginatedResponse,
    SessionSummary,
} from '../shared/types';
import { invokeBedrock } from './bedrock';
import { notifyWebSocket } from './websocket';

/**
 * Extract user context from Cognito claims
 */
function extractUserContext(event: APIGatewayProxyEvent): UserContext {
    const claims = event.requestContext.authorizer?.claims ?? {};
    return {
        userId: claims.sub ?? 'anonymous',
        orgId: claims['custom:orgId'] ?? '00000000-0000-0000-0000-000000000000',
        email: claims.email,
    };
}

/**
 * Ensure user exists in database (auto-create if not)
 */
async function ensureUserExists(user: UserContext): Promise<void> {
    // Use upsert to create user if not exists
    await query(
        `INSERT INTO users (id, org_id, email, name, role)
         VALUES ($1, $2, $3, $4, 'member')
         ON CONFLICT (id) DO UPDATE SET
            last_login_at = NOW()`,
        [user.userId, user.orgId, user.email ?? 'unknown@example.com', user.email?.split('@')[0] ?? 'User']
    );
}

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        body: JSON.stringify(body),
    };
}

/**
 * Parse pagination parameters from query string
 */
function parsePagination(event: APIGatewayProxyEvent): { limit: number; offset: number } {
    const limit = Math.min(parseInt(event.queryStringParameters?.limit ?? '20', 10), 100);
    const offset = parseInt(event.queryStringParameters?.offset ?? '0', 10);
    return { limit, offset };
}

/**
 * POST /scans - Start a new accessibility scan
 */
async function handleStartScan(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const body = JSON.parse(event.body ?? '{}') as ScanRequest;

    if (!body.url) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'URL is required' });
    }

    try {
        new URL(body.url);
    } catch {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Invalid URL format' });
    }

    const viewport = body.viewport ?? 'desktop';

    // Ensure user exists in database before creating session
    await ensureUserExists(user);

    const result = await queryWithOrg<Session>(
        user.orgId,
        `INSERT INTO scan_sessions (org_id, user_id, url, viewport, status)
         VALUES ($1, $2, $3, $4, 'scanning')
         RETURNING id, org_id as "orgId", user_id as "userId", url, viewport, status,
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [user.orgId, user.userId, body.url, viewport]
    );

    const session = result.rows[0];

    // Invoke Bedrock Agent synchronously and wait for completion
    // Note: Lambda timeout is 150 seconds, API Gateway timeout is 29 seconds
    // If API Gateway times out, the Lambda will continue running and update session status
    // Frontend polls for status updates so it will see the result
    console.log('Starting Bedrock invocation for session:', session.id);

    try {
        await invokeBedrock(session.id, body.url, viewport);
        console.log('Bedrock invocation completed for session:', session.id);
    } catch (error) {
        console.error('Bedrock invocation failed:', error);
        // Session status is already updated to 'error' by invokeBedrock
    }

    // Re-fetch the session to get the updated status
    const updatedResult = await queryWithOrg<Session>(
        user.orgId,
        `SELECT id, org_id as "orgId", user_id as "userId", url, viewport, status,
                error_message as "errorMessage", created_at as "createdAt", 
                updated_at as "updatedAt", completed_at as "completedAt"
         FROM scan_sessions WHERE id = $1`,
        [session.id]
    );

    return jsonResponse(201, updatedResult.rows[0] ?? session);
}

/**
 * GET /scans/{sessionId} - Get scan session status
 */
async function handleGetScan(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Session ID required' });
    }

    const result = await queryWithOrg<Session & { summary: SessionSummary }>(
        user.orgId,
        `SELECT s.id, s.org_id as "orgId", s.user_id as "userId", s.url, s.viewport,
                s.status, s.error_message as "errorMessage", s.created_at as "createdAt",
                s.updated_at as "updatedAt", s.completed_at as "completedAt",
                json_build_object(
                    'totalViolations', COALESCE(ss.total_violations, 0),
                    'criticalCount', COALESCE(ss.critical_count, 0),
                    'seriousCount', COALESCE(ss.serious_count, 0),
                    'moderateCount', COALESCE(ss.moderate_count, 0),
                    'minorCount', COALESCE(ss.minor_count, 0),
                    'fixedCount', COALESCE(ss.fixed_count, 0),
                    'skippedCount', COALESCE(ss.skipped_count, 0),
                    'pendingCount', COALESCE(ss.pending_count, 0)
                ) as summary
         FROM scan_sessions s
         LEFT JOIN session_summary ss ON ss.id = s.id
         WHERE s.id = $1`,
        [sessionId]
    );

    if (result.rows.length === 0) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Session not found' });
    }

    return jsonResponse(200, result.rows[0]);
}

/**
 * GET /sessions - List scan sessions with pagination
 */
async function handleListSessions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const { limit, offset } = parsePagination(event);
    const status = event.queryStringParameters?.status;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [limit, offset];

    if (status) {
        whereClause += ` AND s.status = $${params.length + 1}`;
        params.push(status);
    }

    const [dataResult, countResult] = await Promise.all([
        queryWithOrg<Session & { summary: SessionSummary }>(
            user.orgId,
            `SELECT s.id, s.url, s.viewport, s.status, s.created_at as "createdAt",
                    s.completed_at as "completedAt",
                    json_build_object(
                        'totalViolations', COALESCE(ss.total_violations, 0),
                        'fixedCount', COALESCE(ss.fixed_count, 0),
                        'skippedCount', COALESCE(ss.skipped_count, 0)
                    ) as summary
             FROM scan_sessions s
             LEFT JOIN session_summary ss ON ss.id = s.id
             ${whereClause}
             ORDER BY s.created_at DESC
             LIMIT $1 OFFSET $2`,
            params
        ),
        queryWithOrg<{ count: string }>(
            user.orgId,
            `SELECT COUNT(*) as count FROM scan_sessions s ${whereClause}`,
            status ? [status] : []
        ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const response: PaginatedResponse<Session & { summary: SessionSummary }> = {
        data: dataResult.rows,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
    };

    return jsonResponse(200, response);
}

/**
 * DELETE /sessions/{sessionId} - Delete a scan session
 */
async function handleDeleteSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Session ID required' });
    }

    const result = await queryWithOrg(
        user.orgId,
        'DELETE FROM scan_sessions WHERE id = $1 RETURNING id',
        [sessionId]
    );

    if (result.rowCount === 0) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Session not found' });
    }

    return jsonResponse(204, null);
}

/**
 * GET /reports/{sessionId} - Get detailed report for a session
 */
async function handleGetReport(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Session ID required' });
    }

    const [sessionResult, violationsResult] = await Promise.all([
        queryWithOrg<Session>(
            user.orgId,
            `SELECT id, url, viewport, status, page_screenshot as "pageScreenshot",
                    created_at as "createdAt", completed_at as "completedAt"
             FROM scan_sessions WHERE id = $1`,
            [sessionId]
        ),
        queryWithOrg(
            user.orgId,
            `SELECT v.id, v.rule_id as "ruleId", v.impact, v.description, 
                    v.help, v.help_url as "helpUrl", v.selector, v.html,
                    v.failure_summary as "failureSummary", v.screenshot,
                    v.status, v.skip_reason as "skipReason",
                    json_build_object(
                        'type', f.fix_type,
                        'beforeHtml', f.before_html,
                        'afterHtml', f.after_html,
                        'reasoning', f.reasoning
                    ) as fix
             FROM violations v
             LEFT JOIN applied_fixes f ON f.violation_id = v.id
             WHERE v.session_id = $1
             ORDER BY 
                CASE v.impact 
                    WHEN 'critical' THEN 1 
                    WHEN 'serious' THEN 2 
                    WHEN 'moderate' THEN 3 
                    ELSE 4 
                END`,
            [sessionId]
        ),
    ]);

    if (sessionResult.rows.length === 0) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const violations = violationsResult.rows;

    const violationList = violations as Array<{ status: string }>;

    return jsonResponse(200, {
        ...session,
        violations,
        summary: {
            totalViolations: violationList.length,
            fixedCount: violationList.filter((v) => v.status === 'fixed').length,
            skippedCount: violationList.filter((v) => v.status === 'skipped').length,
        },
    });
}

/**
 * GET /reports/{sessionId}/export - Export report in JSON or HTML format
 * Requirements: 5.5
 */
async function handleExportReport(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const user = extractUserContext(event);
    const sessionId = event.pathParameters?.sessionId;
    const format = event.queryStringParameters?.format ?? 'json';

    if (!sessionId) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Session ID required' });
    }

    if (format !== 'json' && format !== 'html') {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Format must be json or html' });
    }

    const [sessionResult, violationsResult] = await Promise.all([
        queryWithOrg<Session>(
            user.orgId,
            `SELECT id, url, viewport, status, page_screenshot as "pageScreenshot",
                    created_at as "createdAt", completed_at as "completedAt"
             FROM scan_sessions WHERE id = $1`,
            [sessionId]
        ),
        queryWithOrg(
            user.orgId,
            `SELECT v.id, v.rule_id as "ruleId", v.impact, v.description, 
                    v.help, v.help_url as "helpUrl", v.selector, v.html,
                    v.failure_summary as "failureSummary", v.screenshot,
                    v.status, v.skip_reason as "skipReason",
                    json_build_object(
                        'type', f.fix_type,
                        'beforeHtml', f.before_html,
                        'afterHtml', f.after_html,
                        'reasoning', f.reasoning
                    ) as fix
             FROM violations v
             LEFT JOIN applied_fixes f ON f.violation_id = v.id
             WHERE v.session_id = $1
             ORDER BY 
                CASE v.impact 
                    WHEN 'critical' THEN 1 
                    WHEN 'serious' THEN 2 
                    WHEN 'moderate' THEN 3 
                    ELSE 4 
                END`,
            [sessionId]
        ),
    ]);

    if (sessionResult.rows.length === 0) {
        return jsonResponse(404, { code: 'NOT_FOUND', message: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const violations = violationsResult.rows;
    const violationList = violations as Array<{ status: string; skipReason?: string }>;

    const report = {
        sessionId: session.id,
        url: session.url,
        viewport: session.viewport,
        timestamp: session.completedAt ?? session.createdAt,
        summary: {
            totalViolations: violationList.length,
            fixedCount: violationList.filter((v) => v.status === 'fixed').length,
            skippedCount: violationList.filter((v) => v.status === 'skipped').length,
        },
        violations,
    };

    if (format === 'json') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="accessibility-report-${sessionId}.json"`,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            },
            body: JSON.stringify(report, null, 2),
        };
    }

    // HTML format
    const htmlContent = generateHtmlReport(report);
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html',
            'Content-Disposition': `attachment; filename="accessibility-report-${sessionId}.html"`,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        body: htmlContent,
    };
}

/**
 * Generate HTML report from report data
 */
function generateHtmlReport(report: {
    sessionId: string;
    url: string;
    viewport: string;
    timestamp: string;
    summary: { totalViolations: number; fixedCount: number; skippedCount: number };
    violations: Array<{
        id: string;
        ruleId: string;
        impact: string;
        description: string;
        selector: string;
        html: string;
        status: string;
        skipReason?: string;
        fix?: { type: string; beforeHtml: string; afterHtml: string; reasoning: string };
    }>;
}): string {
    const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const violationRows = report.violations
        .map(
            (v) => `
        <tr class="violation-row ${v.status}">
            <td><span class="impact impact-${v.impact}">${v.impact}</span></td>
            <td>${escapeHtml(v.ruleId)}</td>
            <td>${escapeHtml(v.description)}</td>
            <td><code>${escapeHtml(v.selector)}</code></td>
            <td><span class="status status-${v.status}">${v.status}</span></td>
            <td>${v.skipReason ? escapeHtml(v.skipReason) : v.fix?.reasoning ? escapeHtml(v.fix.reasoning) : '-'}</td>
        </tr>`
        )
        .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - ${escapeHtml(report.url)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 24px; }
        h1 { color: #1a1a1a; margin-bottom: 8px; }
        .meta { color: #666; margin-bottom: 24px; }
        .summary { display: flex; gap: 16px; margin-bottom: 24px; }
        .summary-card { background: #f8f9fa; padding: 16px; border-radius: 8px; flex: 1; text-align: center; }
        .summary-card .value { font-size: 32px; font-weight: bold; color: #1a1a1a; }
        .summary-card .label { color: #666; font-size: 14px; }
        .summary-card.fixed .value { color: #22c55e; }
        .summary-card.skipped .value { color: #f59e0b; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f8f9fa; font-weight: 600; }
        code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        .impact { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; text-transform: uppercase; }
        .impact-critical { background: #fee2e2; color: #dc2626; }
        .impact-serious { background: #ffedd5; color: #ea580c; }
        .impact-moderate { background: #fef3c7; color: #d97706; }
        .impact-minor { background: #dbeafe; color: #2563eb; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .status-fixed { background: #dcfce7; color: #16a34a; }
        .status-skipped { background: #fef3c7; color: #d97706; }
        .status-pending { background: #f3f4f6; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Accessibility Report</h1>
        <div class="meta">
            <p><strong>URL:</strong> ${escapeHtml(report.url)}</p>
            <p><strong>Viewport:</strong> ${escapeHtml(report.viewport)}</p>
            <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        </div>
        <div class="summary">
            <div class="summary-card">
                <div class="value">${report.summary.totalViolations}</div>
                <div class="label">Total Violations</div>
            </div>
            <div class="summary-card fixed">
                <div class="value">${report.summary.fixedCount}</div>
                <div class="label">Fixed</div>
            </div>
            <div class="summary-card skipped">
                <div class="value">${report.summary.skippedCount}</div>
                <div class="label">Skipped</div>
            </div>
        </div>
        <h2>Violations</h2>
        <table>
            <thead>
                <tr>
                    <th>Impact</th>
                    <th>Rule</th>
                    <th>Description</th>
                    <th>Selector</th>
                    <th>Status</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                ${violationRows}
            </tbody>
        </table>
    </div>
</body>
</html>`;
}

/**
 * Main Lambda handler - routes requests to appropriate handlers
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const { httpMethod, path } = event;
    console.log('Request:', { httpMethod, path });

    try {
        if (httpMethod === 'POST' && path === '/scans') {
            return await handleStartScan(event);
        }
        if (httpMethod === 'GET' && path.startsWith('/scans/')) {
            return await handleGetScan(event);
        }
        if (httpMethod === 'GET' && path === '/sessions') {
            return await handleListSessions(event);
        }
        if (httpMethod === 'DELETE' && path.startsWith('/sessions/')) {
            return await handleDeleteSession(event);
        }
        // Check for export route before general report route (more specific first)
        if (httpMethod === 'GET' && path.match(/^\/reports\/[^/]+\/export$/)) {
            return await handleExportReport(event);
        }
        if (httpMethod === 'GET' && path.startsWith('/reports/')) {
            return await handleGetReport(event);
        }
        return jsonResponse(404, { code: 'NOT_FOUND', message: `Route not found: ${httpMethod} ${path}` });
    } catch (error) {
        console.error('Handler error:', error);
        return jsonResponse(500, {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Internal server error',
        });
    }
}
