/**
 * Report Routes
 * 
 * Endpoints for retrieving detailed scan reports.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../services/database.js';
import type { Session, Violation, AppliedFix } from '../types/index.js';

export const reportRoutes = Router();

reportRoutes.use(authMiddleware);

interface ReportViolation extends Violation {
    fix?: {
        type: string;
        beforeHtml: string;
        afterHtml: string;
        reasoning: string;
    };
}

interface Report extends Session {
    violations: ReportViolation[];
    summary: {
        totalViolations: number;
        fixedCount: number;
        skippedCount: number;
    };
}

reportRoutes.get('/:sessionId', async (request, response) => {
    try {
        const user = request.user!;
        const { sessionId } = request.params;

        const [sessionResult, violationsResult] = await Promise.all([
            query<Session>(
                `SELECT id, url, viewport, status, 
                        created_at as "createdAt", completed_at as "completedAt"
                 FROM scan_sessions 
                 WHERE id = $1 AND user_id = $2`,
                [sessionId, user.userId]
            ),
            query<ReportViolation>(
                `SELECT v.id, v.rule_id as "ruleId", v.impact, v.description, 
                        v.selector, v.html, v.status, v.skip_reason as "skipReason",
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
            response.status(404).json({
                code: 'NOT_FOUND',
                message: 'Session not found',
            });
            return;
        }

        const session = sessionResult.rows[0];
        const violations = violationsResult.rows;

        const report: Report = {
            ...session,
            violations,
            summary: {
                totalViolations: violations.length,
                fixedCount: violations.filter(v => v.status === 'fixed').length,
                skippedCount: violations.filter(v => v.status === 'skipped').length,
            },
        };

        response.json(report);
    } catch (error) {
        console.error('Get report error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to get report',
        });
    }
});

reportRoutes.get('/:sessionId/export', async (request, response) => {
    try {
        const user = request.user!;
        const { sessionId } = request.params;
        const format = (request.query.format as string) ?? 'json';

        const [sessionResult, violationsResult] = await Promise.all([
            query<Session>(
                `SELECT id, url, viewport, status, 
                        created_at as "createdAt", completed_at as "completedAt"
                 FROM scan_sessions 
                 WHERE id = $1 AND user_id = $2`,
                [sessionId, user.userId]
            ),
            query<ReportViolation>(
                `SELECT v.id, v.rule_id as "ruleId", v.impact, v.description, 
                        v.selector, v.html, v.status, v.skip_reason as "skipReason",
                        json_build_object(
                            'type', f.fix_type,
                            'beforeHtml', f.before_html,
                            'afterHtml', f.after_html,
                            'reasoning', f.reasoning
                        ) as fix
                 FROM violations v
                 LEFT JOIN applied_fixes f ON f.violation_id = v.id
                 WHERE v.session_id = $1`,
                [sessionId]
            ),
        ]);

        if (sessionResult.rows.length === 0) {
            response.status(404).json({
                code: 'NOT_FOUND',
                message: 'Report not found',
            });
            return;
        }

        const session = sessionResult.rows[0];
        const violations = violationsResult.rows;

        const report = {
            ...session,
            violations,
            summary: {
                totalViolations: violations.length,
                fixedCount: violations.filter(v => v.status === 'fixed').length,
                skippedCount: violations.filter(v => v.status === 'skipped').length,
            },
        };

        if (format === 'json') {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader(
                'Content-Disposition', 
                `attachment; filename="report-${sessionId}.json"`
            );
            response.json(report);
            return;
        }

        const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Accessibility Report - ${report.url}</title></head>
<body>
<h1>Accessibility Report</h1>
<p>URL: ${report.url}</p>
<p>Total Violations: ${report.summary.totalViolations}</p>
<p>Fixed: ${report.summary.fixedCount}</p>
<p>Skipped: ${report.summary.skippedCount}</p>
</body>
</html>`;

        response.setHeader('Content-Type', 'text/html');
        response.setHeader(
            'Content-Disposition', 
            `attachment; filename="report-${sessionId}.html"`
        );
        response.send(htmlContent);
    } catch (error) {
        console.error('Export report error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to export report',
        });
    }
});

