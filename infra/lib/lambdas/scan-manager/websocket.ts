/**
 * WebSocket Notification Utility
 * 
 * Sends real-time updates to connected WebSocket clients.
 */

import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
    GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { query } from '../shared/database';
import type { WebSocketMessage } from '../shared/types';

const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT ?? '';

/**
 * Get API Gateway Management client
 */
function getWebSocketClient(): ApiGatewayManagementApiClient | null {
    if (!WEBSOCKET_ENDPOINT) {
        return null;
    }
    return new ApiGatewayManagementApiClient({ endpoint: WEBSOCKET_ENDPOINT });
}

/**
 * Send message to a specific WebSocket connection
 */
export async function sendToConnection(
    connectionId: string,
    message: WebSocketMessage
): Promise<boolean> {
    const client = getWebSocketClient();
    if (!client) {
        console.warn('WebSocket endpoint not configured');
        return false;
    }

    try {
        await client.send(
            new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: Buffer.from(JSON.stringify(message)),
            })
        );
        return true;
    } catch (error) {
        if (error instanceof GoneException) {
            // Connection is stale, remove from database
            await removeStaleConnection(connectionId);
            return false;
        }
        console.error('Failed to send WebSocket message:', error);
        return false;
    }
}

/**
 * Notify all clients subscribed to a session
 */
export async function notifySession(
    sessionId: string,
    message: WebSocketMessage
): Promise<void> {
    try {
        const result = await query<{ connectionId: string }>(
            'SELECT connection_id as "connectionId" FROM websocket_connections WHERE session_id = $1',
            [sessionId]
        );

        const sendPromises = result.rows.map((row) =>
            sendToConnection(row.connectionId, message)
        );

        await Promise.all(sendPromises);
    } catch (error) {
        console.error('Failed to notify session:', error);
    }
}

/**
 * Remove a stale WebSocket connection from database
 */
async function removeStaleConnection(connectionId: string): Promise<void> {
    try {
        await query(
            'DELETE FROM websocket_connections WHERE connection_id = $1',
            [connectionId]
        );
    } catch (error) {
        console.error('Failed to remove stale connection:', error);
    }
}

// Re-export for use in handler.ts
export { notifySession as notifyWebSocket };

