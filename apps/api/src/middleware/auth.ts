/**
 * Authentication Middleware
 * 
 * JWT-based authentication for self-hosted mode.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserContext, AuthTokenPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret';

declare global {
    namespace Express {
        interface Request {
            user?: UserContext;
        }
    }
}

export function authMiddleware(
    request: Request,
    response: Response,
    next: NextFunction
): void {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        response.status(401).json({ 
            code: 'UNAUTHORIZED', 
            message: 'Missing or invalid authorization header',
        });
        return;
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
        
        request.user = {
            userId: payload.userId,
            email: payload.email,
        };
        
        next();
    } catch (error) {
        response.status(401).json({ 
            code: 'UNAUTHORIZED', 
            message: 'Invalid or expired token',
        });
    }
}

export function generateToken(userId: string, email: string): string {
    const payload: Omit<AuthTokenPayload, 'iat' | 'exp'> = { userId, email };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): AuthTokenPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch {
        return null;
    }
}

