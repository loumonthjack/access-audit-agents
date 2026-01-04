/**
 * Auth Routes
 * 
 * Authentication endpoints for self-hosted mode.
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateToken } from '../middleware/auth.js';
import { query } from '../services/database.js';

export const authRoutes = Router();

interface LoginRequest {
    email: string;
    password: string;
}

authRoutes.post('/login', async (request, response) => {
    try {
        const { email, password } = request.body as LoginRequest;

        if (!email || !password) {
            response.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Email and password are required',
            });
            return;
        }

        const result = await query<{ id: string; email: string; password_hash: string }>(
            'SELECT id, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            const userId = uuidv4();
            const defaultOrgId = '00000000-0000-0000-0000-000000000000';
            await query(
                'INSERT INTO users (id, org_id, email, password_hash) VALUES ($1, $2, $3, $4)',
                [userId, defaultOrgId, email, password]
            );
            
            const token = generateToken(userId, email);
            response.json({
                user: { id: userId, email, authProvider: 'local' },
                token,
            });
            return;
        }

        const user = result.rows[0];
        
        if (user.password_hash !== password) {
            response.status(401).json({
                code: 'UNAUTHORIZED',
                message: 'Invalid credentials',
            });
            return;
        }

        const token = generateToken(user.id, user.email);
        response.json({
            user: { id: user.id, email: user.email, authProvider: 'local' },
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: 'Login failed',
        });
    }
});

authRoutes.get('/me', async (request, response) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        response.status(401).json({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
        });
        return;
    }

    const token = authHeader.slice(7);

    try {
        const { verifyToken } = await import('../middleware/auth.js');
        const payload = verifyToken(token);

        if (!payload) {
            response.status(401).json({
                code: 'UNAUTHORIZED',
                message: 'Invalid token',
            });
            return;
        }

        response.json({
            id: payload.userId,
            email: payload.email,
            authProvider: 'local',
        });
    } catch {
        response.status(401).json({
            code: 'UNAUTHORIZED',
            message: 'Invalid token',
        });
    }
});

authRoutes.post('/logout', (_request, response) => {
    response.status(204).send();
});

