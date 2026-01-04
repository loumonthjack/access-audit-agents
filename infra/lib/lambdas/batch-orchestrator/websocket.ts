/**
 * WebSocket Notification Utility for Batch Orchestrator
 *
 * Sends real-time batch progress updates to connected WebSocket clients.
 */

import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
    GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { query } from '../shared/database';
import type { BatchProgressEvent } from '../shared/types';

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
async function sendToConnection(
    connectionId: string,
    message: BatchProgressEvent & { timestamp: string }
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

/**
 * Notify all clients subscribed to a batch session
 */
export async function notifyBatchSession(
    batchId: string,
    event: BatchProgressEvent
): Promise<void> {
    try {
        // Get all connections subscribed to this batch
        const result = await query<{ connectionId: string }>(
            `SELECT connection_id as "connectionId" 
             FROM websocket_connections 
             WHERE batch_id = $1`,
            [batchId]
        );

        const message = {
            ...event,
            timestamp: new Date().toISOString(),
        };

        const sendPromises = result.rows.map((row) =>
            sendToConnection(row.connectionId, message)
        );

        await Promise.all(sendPromises);
    } catch (error) {
        console.error('Failed to notify batch session:', error);
    }
}

/**
 * Broadcast batch progress event to all relevant clients
 * This is the main function used by the batch orchestrator
 */
export async function notifyBatchProgress(event: BatchProgressEvent): Promise<void> {
    const batchId = event.batchId;

    // Log the event for debugging
    console.log('Batch progress event:', event.type, batchId);

    // Try to notify via WebSocket
    await notifyBatchSession(batchId, event);
}

/**
 * Subscribe a WebSocket connection to batch updates
 */
export async function subscribeToBatch(
    connectionId: string,
    batchId: string
): Promise<void> {
    try {
        await query(
            `UPDATE websocket_connections 
             SET batch_id = $1 
             WHERE connection_id = $2`,
            [batchId, connectionId]
        );
    } catch (error) {
        console.error('Failed to subscribe to batch:', error);
    }
}

/**
 * Unsubscribe a WebSocket connection from batch updates
 */
export async function unsubscribeFromBatch(connectionId: string): Promise<void> {
    try {
        await query(
            `UPDATE websocket_connections 
             SET batch_id = NULL 
             WHERE connection_id = $1`,
            [connectionId]
        );
    } catch (error) {
        console.error('Failed to unsubscribe from batch:', error);
    }
}
