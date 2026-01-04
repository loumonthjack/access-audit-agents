/**
 * Property-based tests for WebSocket client
 * Feature: web-dashboard, Property 5: WebSocket Connection on Session Start
 * Validates: Requirements 2.1
 * 
 * Property 5: WebSocket Connection on Session Start
 * For any ScanSession that transitions to 'scanning' status, a WebSocket connection
 * SHALL be established within 1 second, and the connection SHALL target the correct sessionId.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { WebSocketClient } from '../client';
import type { WSClientConfig, WebSocketConstructor } from '../types';

/**
 * Creates an isolated MockWebSocket class for each test to avoid shared state issues
 */
function createMockWebSocketFactory() {
    const instances: MockWebSocket[] = [];

    class MockWebSocket {
        url: string;
        readyState: number = 0; // CONNECTING
        onopen: ((event: Event) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;

        constructor(url: string) {
            this.url = url;
            instances.push(this);
        }

        send(): void {
            // Mock send
        }

        close(): void {
            this.readyState = 3; // CLOSED
        }

        // Helper to simulate connection open
        simulateOpen(): void {
            this.readyState = 1; // OPEN
            this.onopen?.(new Event('open'));
        }

        // Helper to simulate connection close
        simulateClose(code = 1000, reason = ''): void {
            this.readyState = 3; // CLOSED
            this.onclose?.(new CloseEvent('close', { code, reason }));
        }

        // Helper to simulate message
        simulateMessage(data: string): void {
            this.onmessage?.(new MessageEvent('message', { data }));
        }
    }

    return {
        MockWebSocket: MockWebSocket as unknown as WebSocketConstructor,
        getInstances: () => instances,
        getLastInstance: () => instances[instances.length - 1] as MockWebSocket | undefined,
        reset: () => { instances.length = 0; },
    };
}

describe('Property 5: WebSocket Connection on Session Start', () => {
    /**
     * Property: Connection URL contains correct sessionId
     * For any sessionId, the WebSocket URL SHALL contain that sessionId as a query parameter
     */
    it('should include sessionId in connection URL', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(), // Generate random session IDs
                async (sessionId) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);

                    await client.connect(sessionId);

                    const wsInstance = factory.getLastInstance();
                    expect(wsInstance).toBeDefined();

                    const url = new URL(wsInstance!.url);
                    expect(url.searchParams.get('sessionId')).toBe(sessionId);

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Connection URL includes token when provided
     * For any token, the WebSocket URL SHALL include the token as a query parameter
     */
    it('should include token in connection URL when provided', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(), // sessionId
                fc.uuid(), // use uuid as token (safe for URL)
                async (sessionId, token) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        getToken: async () => token,
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);

                    await client.connect(sessionId);

                    const wsInstance = factory.getLastInstance();
                    expect(wsInstance).toBeDefined();

                    const url = new URL(wsInstance!.url);
                    expect(url.searchParams.get('token')).toBe(token);

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Connection state transitions correctly
     * After connect() is called, state should be 'connecting' then 'connected' on open
     */
    it('should transition to connecting state on connect', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (sessionId) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);

                    expect(client.getConnectionState()).toBe('disconnected');

                    await client.connect(sessionId);

                    expect(client.getConnectionState()).toBe('connecting');

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Connection state becomes 'connected' after WebSocket opens
     */
    it('should transition to connected state when WebSocket opens', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (sessionId) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        heartbeatIntervalMs: 0, // Disable heartbeat for test
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);

                    await client.connect(sessionId);

                    const wsInstance = factory.getLastInstance();
                    wsInstance?.simulateOpen();

                    expect(client.getConnectionState()).toBe('connected');
                    expect(client.isConnected()).toBe(true);

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Disconnect resets state to disconnected
     */
    it('should reset to disconnected state on disconnect', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (sessionId) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        heartbeatIntervalMs: 0,
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);

                    await client.connect(sessionId);
                    const wsInstance = factory.getLastInstance();
                    wsInstance?.simulateOpen();

                    expect(client.isConnected()).toBe(true);

                    client.disconnect();

                    expect(client.getConnectionState()).toBe('disconnected');
                    expect(client.isConnected()).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Event handlers receive correct event types
     */
    it('should emit connected event when WebSocket opens', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (sessionId) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        heartbeatIntervalMs: 0,
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);
                    const connectedHandler = vi.fn();

                    client.onClientEvent('connected', connectedHandler);

                    await client.connect(sessionId);
                    const wsInstance = factory.getLastInstance();
                    wsInstance?.simulateOpen();

                    expect(connectedHandler).toHaveBeenCalledTimes(1);
                    expect(connectedHandler).toHaveBeenCalledWith({ type: 'connected' });

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Progress events are parsed and emitted correctly
     */
    it('should parse and emit progress events', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(), // sessionId
                fc.uuid(), // violationId
                async (sessionId, violationId) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        heartbeatIntervalMs: 0,
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);
                    const violationHandler = vi.fn();

                    client.onProgressEvent('violation_detected', violationHandler);

                    await client.connect(sessionId);
                    const wsInstance = factory.getLastInstance();
                    wsInstance?.simulateOpen();

                    const event = {
                        type: 'violation_detected',
                        violation: {
                            id: violationId,
                            ruleId: 'color-contrast',
                            impact: 'serious',
                            description: 'Test violation',
                            help: 'Fix it',
                            helpUrl: 'https://example.com',
                            selector: '#test',
                            html: '<div id="test"></div>',
                            status: 'pending',
                        },
                    };

                    wsInstance?.simulateMessage(JSON.stringify(event));

                    expect(violationHandler).toHaveBeenCalledTimes(1);
                    expect(violationHandler).toHaveBeenCalledWith(event);

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Reconnect attempts reset on successful connection
     */
    it('should reset reconnect attempts on successful connection', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (sessionId) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        heartbeatIntervalMs: 0,
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);

                    await client.connect(sessionId);
                    const wsInstance = factory.getLastInstance();
                    wsInstance?.simulateOpen();

                    expect(client.getReconnectAttempts()).toBe(0);

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Unsubscribe function removes handler
     */
    it('should allow unsubscribing from events', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (sessionId) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: 'ws://localhost:3000/ws',
                        heartbeatIntervalMs: 0,
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);
                    const handler = vi.fn();

                    const unsubscribe = client.onClientEvent('connected', handler);

                    await client.connect(sessionId);
                    const wsInstance = factory.getLastInstance();
                    wsInstance?.simulateOpen();

                    expect(handler).toHaveBeenCalledTimes(1);

                    // Unsubscribe
                    unsubscribe();

                    // Reconnect - handler should not be called again
                    client.disconnect();
                    await client.connect(sessionId);
                    const newWsInstance = factory.getLastInstance();
                    newWsInstance?.simulateOpen();

                    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Base URL is preserved correctly
     */
    it('should preserve base URL structure', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.constantFrom('ws://localhost:3000/ws', 'wss://api.example.com/ws', 'ws://test.local:8080/websocket'),
                async (sessionId, baseUrl) => {
                    const factory = createMockWebSocketFactory();
                    const config: WSClientConfig = {
                        url: baseUrl,
                        WebSocketImpl: factory.MockWebSocket,
                    };
                    const client = new WebSocketClient(config);

                    await client.connect(sessionId);

                    const wsInstance = factory.getLastInstance();
                    expect(wsInstance).toBeDefined();

                    const url = new URL(wsInstance!.url);
                    const expectedUrl = new URL(baseUrl);

                    expect(url.protocol).toBe(expectedUrl.protocol);
                    expect(url.host).toBe(expectedUrl.host);
                    expect(url.pathname).toBe(expectedUrl.pathname);

                    client.disconnect();
                }
            ),
            { numRuns: 100 }
        );
    });
});
