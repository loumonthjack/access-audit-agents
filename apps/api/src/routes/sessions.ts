/**
 * Session Routes
 * 
 * Endpoints for listing and managing scan sessions.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../services/database.js';
import type { Session, SessionSummary, PaginatedResponse } from '../types/index.js';

export const sessionRoutes = Router();

sessionRoutes.use(authMiddleware);

sessionRoutes.get('/', async (request, response) => {
    try {
        const user = request.user!;
        const limit = Math.min(parseInt(request.query.limit as string) || 20, 100);
        const offset = parseInt(request.query.offset as string) || 0;
        const status = request.query.status as string | undefined;

        const whereConditions = ['s.user_id = $1'];
        const params: unknown[] = [user.userId, limit, offset];

        if (status) {
            whereConditions.push(`s.status = $${params.length + 1}`);
            params.push(status);
        }

        const whereClause = whereConditions.join(' AND ');

        const [dataResult, countResult] = await Promise.all([
            query<Session & { summary: SessionSummary }>(
                `SELECT s.id, s.url, s.viewport, s.status, 
                        s.created_at as "createdAt", s.completed_at as "completedAt",
                        json_build_object(
                            'totalViolations', COUNT(v.id)::int,
                            'fixedCount', COUNT(v.id) FILTER (WHERE v.status = 'fixed')::int,
                            'skippedCount', COUNT(v.id) FILTER (WHERE v.status = 'skipped')::int
                        ) as summary
                 FROM scan_sessions s
                 LEFT JOIN violations v ON v.session_id = s.id
                 WHERE ${whereClause}
                 GROUP BY s.id
                 ORDER BY s.created_at DESC
                 LIMIT $2 OFFSET $3`,
                params
            ),
            query<{ count: string }>(
                `SELECT COUNT(*) as count 
                 FROM scan_sessions s 
                 WHERE ${whereClause}`,
                status ? [user.userId, status] : [user.userId]
            ),
        ]);

        const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

        const paginatedResponse: PaginatedResponse<Session & { summary: SessionSummary }> = {
            data: dataResult.rows,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            },
        };

        response.json(paginatedResponse);
    } catch (error) {
        console.error('List sessions error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to list sessions',
        });
    }
});

sessionRoutes.delete('/:sessionId', async (request, response) => {
    try {
        const user = request.user!;
        const { sessionId } = request.params;

        const result = await query(
            'DELETE FROM scan_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
            [sessionId, user.userId]
        );

        if (result.rowCount === 0) {
            response.status(404).json({
                code: 'NOT_FOUND',
                message: 'Session not found',
            });
            return;
        }

        response.status(204).send();
    } catch (error) {
        console.error('Delete session error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Failed to delete session',
        });
    }
});

