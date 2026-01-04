/**
 * WebSocket Lambda Handler
 * 
 * Manages WebSocket connections for real-time progress updates.
 * Stores connections in PostgreSQL for cross-Lambda access.
 */

import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../shared/database';
import type { WebSocketConnection } from '../shared/types';

/**
 * Create WebSocket response
 */
function response(statusCode: number, body?: string): APIGatewayProxyResult {
    return { statusCode, body: body ?? '' };
}

/**
 * Get API Gateway Management client from event context
 */
function getClient(event: APIGatewayProxyEvent): ApiGatewayManagementApiClient {
    const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    return new ApiGatewayManagementApiClient({ endpoint });
}

/**
 * Handle $connect - Store new WebSocket connection
 */
async function handleConnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
        return response(400, 'Missing connection ID');
    }

    const sessionId = event.queryStringParameters?.sessionId;
    const userId = event.queryStringParameters?.userId;

    await query(
        `INSERT INTO websocket_connections (connection_id, user_id, session_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (connection_id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             session_id = EXCLUDED.session_id,
             last_ping_at = NOW()`,
        [connectionId, userId ?? null, sessionId ?? null]
    );

    console.log('WebSocket connected:', { connectionId, sessionId, userId });
    return response(200, 'Connected');
}

/**
 * Handle $disconnect - Remove WebSocket connection
 */
async function handleDisconnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
        return response(200, 'Disconnected');
    }

    await query(
        'DELETE FROM websocket_connections WHERE connection_id = $1',
        [connectionId]
    );

    console.log('WebSocket disconnected:', connectionId);
    return response(200, 'Disconnected');
}

/**
 * Handle subscribe action - Subscribe to session updates
 */
async function handleSubscribe(
    connectionId: string,
    sessionId: string
): Promise<void> {
    await query(
        `UPDATE websocket_connections 
         SET session_id = $1, last_ping_at = NOW() 
         WHERE connection_id = $2`,
        [sessionId, connectionId]
    );
    console.log('Subscribed to session:', { connectionId, sessionId });
}

/**
 * Handle subscribeBatch action - Subscribe to batch progress updates
 */
async function handleSubscribeBatch(
    connectionId: string,
    batchId: string
): Promise<void> {
    await query(
        `UPDATE websocket_connections 
         SET batch_id = $1, last_ping_at = NOW() 
         WHERE connection_id = $2`,
        [batchId, connectionId]
    );
    console.log('Subscribed to batch:', { connectionId, batchId });
}

/**
 * Handle unsubscribeBatch action - Unsubscribe from batch progress updates
 */
async function handleUnsubscribeBatch(
    connectionId: string
): Promise<void> {
    await query(
        `UPDATE websocket_connections 
         SET batch_id = NULL, last_ping_at = NOW() 
         WHERE connection_id = $1`,
        [connectionId]
    );
    console.log('Unsubscribed from batch:', { connectionId });
}

/**
 * Handle ping action - Update last ping time and respond with pong
 */
async function handlePing(
    event: APIGatewayProxyEvent,
    connectionId: string
): Promise<void> {
    await query(
        'UPDATE websocket_connections SET last_ping_at = NOW() WHERE connection_id = $1',
        [connectionId]
    );

    const client = getClient(event);
    await client.send(
        new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(JSON.stringify({ action: 'pong', timestamp: new Date().toISOString() })),
        })
    );
}

/**
 * Handle default route - Process incoming messages
 */
async function handleMessage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId;
    const body = event.body;

    if (!connectionId || !body) {
        return response(400, 'Missing connection ID or body');
    }

    let message: { action: string; sessionId?: string; batchId?: string; token?: string };
    try {
        message = JSON.parse(body) as { action: string; sessionId?: string; batchId?: string; token?: string };
    } catch {
        return response(400, 'Invalid JSON');
    }

    console.log('WebSocket message:', { connectionId, action: message.action });

    switch (message.action) {
        case 'subscribe':
            if (message.sessionId) {
                await handleSubscribe(connectionId, message.sessionId);
            }
            return response(200, 'Subscribed');

        case 'unsubscribe':
            await query(
                'UPDATE websocket_connections SET session_id = NULL WHERE connection_id = $1',
                [connectionId]
            );
            return response(200, 'Unsubscribed');

        case 'subscribeBatch':
            if (message.batchId) {
                await handleSubscribeBatch(connectionId, message.batchId);
            }
            return response(200, 'Subscribed to batch');

        case 'unsubscribeBatch':
            await handleUnsubscribeBatch(connectionId);
            return response(200, 'Unsubscribed from batch');

        case 'ping':
            await handlePing(event, connectionId);
            return response(200, 'Pong');

        default:
            return response(200, 'OK');
    }
}

/**
 * Cleanup stale connections (older than 2 hours)
 */
async function cleanupStaleConnections(): Promise<void> {
    try {
        const result = await query(
            `DELETE FROM websocket_connections 
             WHERE last_ping_at < NOW() - INTERVAL '2 hours'
             RETURNING connection_id`
        );
        if (result.rowCount && result.rowCount > 0) {
            console.log('Cleaned up stale connections:', result.rowCount);
        }
    } catch (error) {
        console.error('Failed to cleanup stale connections:', error);
    }
}

/**
 * Main Lambda handler - Routes WebSocket events
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const routeKey = event.requestContext.routeKey;

    console.log('WebSocket event:', {
        routeKey,
        connectionId: event.requestContext.connectionId,
    });

    try {
        // Periodically cleanup stale connections (1% chance per request)
        if (Math.random() < 0.01) {
            cleanupStaleConnections().catch(console.error);
        }

        switch (routeKey) {
            case '$connect':
                return await handleConnect(event);

            case '$disconnect':
                return await handleDisconnect(event);

            case '$default':
            default:
                return await handleMessage(event);
        }
    } catch (error) {
        console.error('WebSocket handler error:', error);
        return response(500, 'Internal server error');
    }
}
