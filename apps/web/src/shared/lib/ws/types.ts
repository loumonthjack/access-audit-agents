/**
 * WebSocket client types
 */

import type { ProgressEvent } from '@/types/events';

/**
 * WebSocket connection states
 */
export type WSConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Reconnection configuration
 */
export interface ReconnectConfig {
  /** Maximum number of reconnection attempts */
  maxAttempts: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
}

/**
 * WebSocket constructor type for dependency injection
 */
export type WebSocketConstructor = new (url: string) => WebSocket;

/**
 * WebSocket client configuration
 */
export interface WSClientConfig {
  /** WebSocket URL */
  url: string;
  /** Token provider for authentication */
  getToken?: () => Promise<string | null>;
  /** Reconnection configuration */
  reconnect?: ReconnectConfig;
  /** Heartbeat interval in milliseconds (0 to disable) */
  heartbeatIntervalMs?: number;
  /** WebSocket constructor (for testing) */
  WebSocketImpl?: WebSocketConstructor;
}

/**
 * WebSocket client events
 */
export type WSClientEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'reconnecting'; attempt: number; maxAttempts: number }
  | { type: 'reconnect_failed' }
  | { type: 'error'; error: Error }
  | { type: 'message'; event: ProgressEvent };

/**
 * Event handler type
 */
export type WSEventHandler<T extends WSClientEvent['type']> = (
  event: Extract<WSClientEvent, { type: T }>
) => void;

/**
 * Progress event handler type
 */
export type ProgressEventHandler<T extends ProgressEvent['type']> = (
  event: Extract<ProgressEvent, { type: T }>
) => void;

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Default heartbeat interval (30 seconds)
 */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
