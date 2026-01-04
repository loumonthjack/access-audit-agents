/**
 * Scan Routes
 * 
 * Endpoints for starting and retrieving accessibility scans.
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../services/database.js';
import { invokeBedrock } from '../services/bedrock.js';
import type { ScanRequest, Session, SessionSummary } from '../types/index.js';

export const scanRoutes = Router();

scanRoutes.use(authMiddleware);

scanRoutes.post('/', async (request, response) => {
    try {
        const user = request.user!;
        const body = request.body as ScanRequest;

        if (!body.url) {
            response.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'URL is required',
            });
            return;
        }

        try {
            new URL(body.url);
        } catch {
            response.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Invalid URL format',
            });
            return;
        }

        const viewport = body.viewport ?? 'desktop';
        const sessionId = uuidv4();
        const defaultOrgId = '00000000-0000-0000-0000-000000000000';

        await query(
            `INSERT INTO scan_sessions (id, org_id, user_id, url, viewport, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'scanning', NOW(), NOW())`,
            [sessionId, defaultOrgId, user.userId, body.url, viewport]
        );

        const result = await query<Session>(
            `SELECT id, user_id as "userId", url, viewport, status,
                    created_at as "createdAt", updated_at as "updatedAt"
             FROM scan_sessions WHERE id = $1`,
            [sessionId]
        );

        const session = result.rows[0];

        invokeBedrock(sessionId, body.url, viewport).catch(console.error);

        response.status(201).json(session);
    } catch (error) {
        console.error('Start scan error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to start scan',
        });
    }
});

scanRoutes.get('/:sessionId', async (request, response) => {
    try {
        const user = request.user!;
        const { sessionId } = request.params;

        const result = await query<Session & { summary: SessionSummary }>(
            `SELECT s.id, s.user_id as "userId", s.url, s.viewport,
                    s.status, s.error_message as "errorMessage", 
                    s.created_at as "createdAt", s.updated_at as "updatedAt", 
                    s.completed_at as "completedAt",
                    json_build_object(
                        'totalViolations', COUNT(v.id)::int,
                        'criticalCount', COUNT(v.id) FILTER (WHERE v.impact = 'critical')::int,
                        'seriousCount', COUNT(v.id) FILTER (WHERE v.impact = 'serious')::int,
                        'moderateCount', COUNT(v.id) FILTER (WHERE v.impact = 'moderate')::int,
                        'minorCount', COUNT(v.id) FILTER (WHERE v.impact = 'minor')::int,
                        'fixedCount', COUNT(v.id) FILTER (WHERE v.status = 'fixed')::int,
                        'skippedCount', COUNT(v.id) FILTER (WHERE v.status = 'skipped')::int,
                        'pendingCount', COUNT(v.id) FILTER (WHERE v.status = 'pending')::int
                    ) as summary
             FROM scan_sessions s
             LEFT JOIN violations v ON v.session_id = s.id
             WHERE s.id = $1 AND s.user_id = $2
             GROUP BY s.id`,
            [sessionId, user.userId]
        );

        if (result.rows.length === 0) {
            response.status(404).json({
                code: 'NOT_FOUND',
                message: 'Session not found',
            });
            return;
        }

        response.json(result.rows[0]);
    } catch (error) {
        console.error('Get scan error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to get scan',
        });
    }
});

scanRoutes.get('/:sessionId/violations', async (request, response) => {
    try {
        const user = request.user!;
        const { sessionId } = request.params;

        // First verify the session belongs to the user
        const sessionResult = await query(
            `SELECT id FROM scan_sessions WHERE id = $1 AND user_id = $2`,
            [sessionId, user.userId]
        );

        if (sessionResult.rows.length === 0) {
            response.status(404).json({
                code: 'NOT_FOUND',
                message: 'Session not found',
            });
            return;
        }

        // Fetch violations for the session
        const violationsResult = await query(
            `SELECT
                id,
                rule_id as "ruleId",
                impact,
                description,
                selector,
                html,
                status,
                skip_reason as "skipReason",
                created_at as "createdAt"
             FROM violations
             WHERE session_id = $1
             ORDER BY
                CASE impact
                    WHEN 'critical' THEN 1
                    WHEN 'serious' THEN 2
                    WHEN 'moderate' THEN 3
                    WHEN 'minor' THEN 4
                END,
                created_at ASC`,
            [sessionId]
        );

        response.json({ violations: violationsResult.rows });
    } catch (error) {
        console.error('Get violations error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to get violations',
        });
    }
});

