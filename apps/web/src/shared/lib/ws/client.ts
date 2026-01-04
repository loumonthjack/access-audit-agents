/**
 * WebSocket client for real-time progress streaming
 * Requirements: 2.1 - WebSocket connection for Progress_Stream
 */

import type { ProgressEvent } from '@/types/events';
import type {
  WSClientConfig,
  WSClientEvent,
  WSEventHandler,
  ProgressEventHandler,
  WSConnectionState,
  ReconnectConfig,
  WebSocketConstructor,
} from './types';
import { DEFAULT_RECONNECT_CONFIG, DEFAULT_HEARTBEAT_INTERVAL_MS } from './types';
import { calculateBackoffDelay } from './reconnect';

/**
 * Internal config with all required fields
 */
interface InternalWSClientConfig {
  url: string;
  getToken: () => Promise<string | null>;
  reconnect: ReconnectConfig;
  heartbeatIntervalMs: number;
  WebSocketImpl: WebSocketConstructor;
}

/**
 * WebSocket client for managing real-time connections
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: InternalWSClientConfig;
  private connectionState: WSConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private currentSessionId: string | null = null;

  // Event handlers
  private clientEventHandlers = new Map<
    WSClientEvent['type'],
    Set<WSEventHandler<WSClientEvent['type']>>
  >();
  private progressEventHandlers = new Map<
    ProgressEvent['type'],
    Set<ProgressEventHandler<ProgressEvent['type']>>
  >();

  constructor(config: WSClientConfig) {
    this.config = {
      url: config.url,
      getToken: config.getToken ?? (() => Promise.resolve(null)),
      reconnect: config.reconnect ?? DEFAULT_RECONNECT_CONFIG,
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
      WebSocketImpl: config.WebSocketImpl ?? WebSocket,
    };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): WSConnectionState {
    return this.connectionState;
  }

  /**
   * Get current reconnect attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Get reconnect configuration
   */
  getReconnectConfig(): ReconnectConfig {
    return this.config.reconnect;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to WebSocket for a specific session
   */
  async connect(sessionId: string): Promise<void> {
    // Don't reconnect if already connected to the same session
    if (this.isConnected() && this.currentSessionId === sessionId) {
      return;
    }

    // Disconnect existing connection
    this.disconnect();

    this.currentSessionId = sessionId;
    this.setConnectionState('connecting');

    try {
      const token = await this.config.getToken();
      const url = this.buildUrl(sessionId, token);

      this.ws = new this.config.WebSocketImpl(url);
      this.setupWebSocketHandlers();
    } catch (error) {
      this.setConnectionState('disconnected');
      this.emitClientEvent({
        type: 'error',
        error: error instanceof Error ? error : new Error('Failed to connect'),
      });
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.clearReconnectTimeout();
    this.stopHeartbeat();

    if (this.ws) {
      // Remove handlers before closing to prevent reconnection
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    this.currentSessionId = null;
    this.reconnectAttempts = 0;
    this.setConnectionState('disconnected');
  }

  /**
   * Subscribe to client events (connected, disconnected, etc.)
   */
  onClientEvent<T extends WSClientEvent['type']>(type: T, handler: WSEventHandler<T>): () => void {
    if (!this.clientEventHandlers.has(type)) {
      this.clientEventHandlers.set(type, new Set());
    }
    this.clientEventHandlers
      .get(type)!
      .add(handler as unknown as WSEventHandler<WSClientEvent['type']>);

    // Return unsubscribe function
    return () => {
      this.clientEventHandlers
        .get(type)
        ?.delete(handler as unknown as WSEventHandler<WSClientEvent['type']>);
    };
  }

  /**
   * Subscribe to progress events (violation_detected, fix_applied, etc.)
   */
  onProgressEvent<T extends ProgressEvent['type']>(
    type: T,
    handler: ProgressEventHandler<T>
  ): () => void {
    if (!this.progressEventHandlers.has(type)) {
      this.progressEventHandlers.set(type, new Set());
    }
    this.progressEventHandlers
      .get(type)!
      .add(handler as unknown as ProgressEventHandler<ProgressEvent['type']>);

    // Return unsubscribe function
    return () => {
      this.progressEventHandlers
        .get(type)
        ?.delete(handler as unknown as ProgressEventHandler<ProgressEvent['type']>);
    };
  }

  /**
   * Remove all event handlers
   */
  removeAllHandlers(): void {
    this.clientEventHandlers.clear();
    this.progressEventHandlers.clear();
  }

  /**
   * Build WebSocket URL with session ID and token
   * URL format: {baseUrl}?sessionId={sessionId}&token={token}
   * The baseUrl should include the stage suffix (e.g., /development)
   * Requirements: 4.1
   */
  buildUrl(sessionId: string, token: string | null): string {
    const url = new URL(this.config.url);
    url.searchParams.set('sessionId', sessionId);
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setConnectionState('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emitClientEvent({ type: 'connected' });
    };

    this.ws.onclose = (event) => {
      this.stopHeartbeat();

      // Don't reconnect if closed cleanly or no session
      if (event.code === 1000 || !this.currentSessionId) {
        this.setConnectionState('disconnected');
        this.emitClientEvent({ type: 'disconnected', reason: event.reason });
        return;
      }

      // Attempt reconnection
      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      // Error event is always followed by close event
      // We handle reconnection in onclose
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const parsed = JSON.parse(data) as ProgressEvent;

      // Validate event has a type
      if (!parsed || typeof parsed.type !== 'string') {
        console.warn('Invalid WebSocket message: missing type', data);
        return;
      }

      // Emit to progress event handlers
      this.emitProgressEvent(parsed);

      // Also emit as generic message to client event handlers
      this.emitClientEvent({ type: 'message', event: parsed });
    } catch (error) {
      console.warn('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    const { maxAttempts, baseDelayMs, maxDelayMs } = this.config.reconnect;

    if (this.reconnectAttempts >= maxAttempts) {
      this.setConnectionState('disconnected');
      this.emitClientEvent({ type: 'reconnect_failed' });
      return;
    }

    this.reconnectAttempts++;
    this.setConnectionState('reconnecting');

    this.emitClientEvent({
      type: 'reconnecting',
      attempt: this.reconnectAttempts,
      maxAttempts,
    });

    const delay = calculateBackoffDelay(this.reconnectAttempts, baseDelayMs, maxDelayMs);

    this.reconnectTimeoutId = setTimeout(() => {
      if (this.currentSessionId) {
        this.connect(this.currentSessionId);
      }
    }, delay);
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatIntervalMs <= 0) return;

    this.heartbeatIntervalId = setInterval(() => {
      if (this.isConnected()) {
        this.ws?.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * Set connection state and emit if changed
   */
  private setConnectionState(state: WSConnectionState): void {
    this.connectionState = state;
  }

  /**
   * Emit client event to handlers
   */
  private emitClientEvent(event: WSClientEvent): void {
    const handlers = this.clientEventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  /**
   * Emit progress event to handlers
   */
  private emitProgressEvent(event: ProgressEvent): void {
    const handlers = this.progressEventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }
}
