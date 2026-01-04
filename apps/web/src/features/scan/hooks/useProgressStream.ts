/**
 * useProgressStream hook - WebSocket event subscription for real-time progress updates
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketClient } from '@/shared/lib/ws/client';
import { useConnectionStore } from '@/shared/store/connectionStore';
import { env } from '@/config/env';
import type { ProgressEvent } from '@/types/events';

export interface UseProgressStreamOptions {
  /** Session ID to subscribe to */
  sessionId: string;
  /** Whether the stream should be enabled */
  enabled?: boolean;
  /** Token provider for authentication */
  getToken?: () => Promise<string | null>;
}

export interface UseProgressStreamReturn {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Last received event */
  lastEvent: ProgressEvent | null;
  /** Connection error if any */
  error: string | null;
  /** Manually disconnect */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
}

/**
 * Hook for subscribing to WebSocket progress events
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */
export function useProgressStream(options: UseProgressStreamOptions): UseProgressStreamReturn {
  const { sessionId, enabled = true, getToken } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsClientRef = useRef<WebSocketClient | null>(null);
  const { setWsStatus, setReconnectAttempt, setLastError } = useConnectionStore();

  // Initialize WebSocket client
  useEffect(() => {
    if (!enabled || !sessionId) {
      return;
    }

    const wsClient = new WebSocketClient({
      url: env.wsUrl,
      getToken: getToken ?? (() => Promise.resolve(null)),
      reconnect: {
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      },
    });

    wsClientRef.current = wsClient;

    // Subscribe to client events
    const unsubConnected = wsClient.onClientEvent('connected', () => {
      setIsConnected(true);
      setError(null);
      setWsStatus('connected');
      setReconnectAttempt(0);
    });

    const unsubDisconnected = wsClient.onClientEvent('disconnected', () => {
      setIsConnected(false);
      setWsStatus('disconnected');
    });

    const unsubReconnecting = wsClient.onClientEvent('reconnecting', (event) => {
      setIsConnected(false);
      setWsStatus('reconnecting');
      setReconnectAttempt(event.attempt);
    });

    const unsubReconnectFailed = wsClient.onClientEvent('reconnect_failed', () => {
      setIsConnected(false);
      setError('Failed to reconnect after multiple attempts');
      setWsStatus('disconnected');
      setLastError('WebSocket reconnection failed');
    });

    const unsubError = wsClient.onClientEvent('error', (event) => {
      setError(event.error.message);
      setLastError(event.error.message);
    });

    // Subscribe to all progress events
    const progressEventTypes: ProgressEvent['type'][] = [
      'session_started',
      'violation_detected',
      'fix_started',
      'fix_applied',
      'fix_skipped',
      'session_complete',
      'error',
    ];

    const unsubProgressHandlers = progressEventTypes.map((eventType) =>
      wsClient.onProgressEvent(eventType, (event) => {
        setLastEvent(event);

        // Handle error events specially
        if (event.type === 'error') {
          setError(event.message);
          setLastError(event.message);
        }
      })
    );

    // Connect to WebSocket
    wsClient.connect(sessionId);
    setWsStatus('connecting');

    // Cleanup
    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubReconnecting();
      unsubReconnectFailed();
      unsubError();
      unsubProgressHandlers.forEach((unsub) => unsub());
      wsClient.disconnect();
      wsClientRef.current = null;
    };
  }, [sessionId, enabled, getToken, setWsStatus, setReconnectAttempt, setLastError]);

  // Manual disconnect
  const disconnect = useCallback(() => {
    wsClientRef.current?.disconnect();
    setIsConnected(false);
    setWsStatus('disconnected');
  }, [setWsStatus]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (wsClientRef.current && sessionId) {
      wsClientRef.current.connect(sessionId);
      setWsStatus('connecting');
    }
  }, [sessionId, setWsStatus]);

  return {
    isConnected,
    lastEvent,
    error,
    disconnect,
    reconnect,
  };
}
