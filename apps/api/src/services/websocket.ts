/**
 * WebSocket Service
 * 
 * Manages WebSocket connections for real-time scan progress updates.
 * Supports both individual session subscriptions and batch scan subscriptions.
 */

import type { WebSocketServer, WebSocket } from 'ws';

interface SessionConnection {
    sessionId: string;
    socket: WebSocket;
}

// Session subscriptions (for individual scans)
const sessionConnections: Map<string, Set<WebSocket>> = new Map();

// Batch subscriptions (for batch scans)
const batchConnections: Map<string, Set<WebSocket>> = new Map();

let webSocketServer: WebSocketServer | null = null;

export function initializeWebSocket(server: WebSocketServer): void {
    webSocketServer = server;

    server.on('connection', (socket, request) => {
        console.log('WebSocket client connected');

        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(socket, message);
            } catch {
                console.error('Invalid WebSocket message');
            }
        });

        socket.on('close', () => {
            removeConnection(socket);
            console.log('WebSocket client disconnected');
        });

        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            removeConnection(socket);
        });
    });
}

function handleMessage(socket: WebSocket, message: unknown): void {
    if (typeof message !== 'object' || message === null) return;

    const payload = message as Record<string, unknown>;

    // Handle session subscription
    if (payload.type === 'subscribe' && typeof payload.sessionId === 'string') {
        addSessionConnection(payload.sessionId, socket);
        socket.send(JSON.stringify({
            type: 'subscribed',
            sessionId: payload.sessionId,
        }));
    }

    if (payload.type === 'unsubscribe' && typeof payload.sessionId === 'string') {
        const connections = sessionConnections.get(payload.sessionId);
        if (connections) {
            connections.delete(socket);
        }
    }

    // Handle batch subscription
    if (payload.type === 'subscribeBatch' && typeof payload.batchId === 'string') {
        addBatchConnection(payload.batchId, socket);
        socket.send(JSON.stringify({
            type: 'subscribedBatch',
            batchId: payload.batchId,
        }));
    }

    if (payload.type === 'unsubscribeBatch' && typeof payload.batchId === 'string') {
        const connections = batchConnections.get(payload.batchId);
        if (connections) {
            connections.delete(socket);
        }
    }
}

function addSessionConnection(sessionId: string, socket: WebSocket): void {
    if (!sessionConnections.has(sessionId)) {
        sessionConnections.set(sessionId, new Set());
    }
    sessionConnections.get(sessionId)!.add(socket);
}

function addBatchConnection(batchId: string, socket: WebSocket): void {
    if (!batchConnections.has(batchId)) {
        batchConnections.set(batchId, new Set());
    }
    batchConnections.get(batchId)!.add(socket);
}

function removeConnection(socket: WebSocket): void {
    // Remove from session connections
    for (const [sessionId, sockets] of sessionConnections.entries()) {
        sockets.delete(socket);
        if (sockets.size === 0) {
            sessionConnections.delete(sessionId);
        }
    }

    // Remove from batch connections
    for (const [batchId, sockets] of batchConnections.entries()) {
        sockets.delete(socket);
        if (sockets.size === 0) {
            batchConnections.delete(batchId);
        }
    }
}

export function notifySession(sessionId: string, event: unknown): void {
    const connections = sessionConnections.get(sessionId);
    if (!connections) return;

    const message = JSON.stringify(event);

    for (const socket of connections) {
        if (socket.readyState === 1) {
            socket.send(message);
        }
    }
}

/**
 * Notify all clients subscribed to a batch scan
 * Sends batch progress events to connected WebSocket clients
 */
export function notifyBatch(batchId: string, event: unknown): void {
    const connections = batchConnections.get(batchId);
    if (!connections) return;

    const message = JSON.stringify({
        ...event as object,
        timestamp: new Date().toISOString(),
    });

    for (const socket of connections) {
        if (socket.readyState === 1) {
            socket.send(message);
        }
    }
}

export function getConnectionCount(sessionId: string): number {
    return sessionConnections.get(sessionId)?.size ?? 0;
}

export function getBatchConnectionCount(batchId: string): number {
    return batchConnections.get(batchId)?.size ?? 0;
}

