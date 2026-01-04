/**
 * useBatchProgress hook - WebSocket event subscription for batch scan progress
 * Requirements: 9.1, 9.4
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketClient } from '@/shared/lib/ws/client';
import { useConnectionStore } from '@/shared/store/connectionStore';
import { env } from '@/config/env';
import type { BatchProgressEvent } from '@/types/events';
import type { BatchSession, BatchProgress, BatchSummary } from '@/types/domain';
import { useBatchScan } from '../api/batchApi';

/**
 * Options for the useBatchProgress hook
 * Requirements: 9.1
 */
export interface UseBatchProgressOptions {
  /** Batch ID to subscribe to */
  batchId: string;
  /** Whether the stream should be enabled */
  enabled?: boolean;
  /** Token provider for authentication */
  getToken?: () => Promise<string | null>;
  /** Callback when a page completes */
  onPageComplete?: (pageUrl: string, violations: number) => void;
  /** Callback when a page fails */
  onPageFailed?: (pageUrl: string, error: string) => void;
  /** Callback when batch completes */
  onComplete?: (summary: BatchSummary) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

/**
 * Return type for the useBatchProgress hook
 * Requirements: 9.1
 */
export interface UseBatchProgressReturn {
  /** Current batch session data */
  batch: BatchSession | undefined;
  /** Current progress information */
  progress: BatchProgress | null;
  /** URL of the page currently being scanned */
  currentPage: string | null;
  /** Index of the current page (1-based) */
  currentPageIndex: number;
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Connection error if any */
  error: string | null;
  /** Whether the batch is loading */
  isLoading: boolean;
  /** Manually disconnect */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
}

/**
 * Hook for subscribing to batch scan WebSocket progress events
 * Requirements: 9.1, 9.4
 */
export function useBatchProgress(options: UseBatchProgressOptions): UseBatchProgressReturn {
  const {
    batchId,
    enabled = true,
    getToken,
    onPageComplete,
    onPageFailed,
    onComplete,
    onError,
  } = options;

  // Use the batch scan query for initial data and polling
  const { data: batch, isLoading } = useBatchScan(batchId);

  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [currentPage, setCurrentPage] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsClientRef = useRef<WebSocketClient | null>(null);
  const { setWsStatus, setReconnectAttempt, setLastError } = useConnectionStore();

  // Initialize WebSocket client
  useEffect(() => {
    if (!enabled || !batchId) {
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

    // Subscribe to batch progress events via message handler
    const unsubMessage = wsClient.onClientEvent('message', (event) => {
      const batchEvent = event.event as unknown as BatchProgressEvent;
      handleBatchEvent(batchEvent);
    });

    // Connect to WebSocket with batch ID
    wsClient.connect(batchId);
    setWsStatus('connecting');

    // Cleanup
    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubReconnecting();
      unsubReconnectFailed();
      unsubError();
      unsubMessage();
      wsClient.disconnect();
      wsClientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, enabled, getToken]);

  // Handle batch events
  const handleBatchEvent = useCallback(
    (event: BatchProgressEvent) => {
      // Only process events for our batch
      if ('batchId' in event && event.batchId !== batchId) {
        return;
      }

      switch (event.type) {
        case 'batch:started':
          setProgress({
            completedPages: 0,
            totalPages: event.totalPages,
            failedPages: 0,
            totalViolations: 0,
            estimatedTimeRemaining: event.totalPages * 30, // Rough estimate: 30s per page
          });
          break;

        case 'batch:page_started':
          setCurrentPage(event.pageUrl);
          setCurrentPageIndex(event.pageIndex);
          break;

        case 'batch:page_complete':
          setProgress(event.progress);
          setCurrentPage(null);
          onPageComplete?.(event.pageUrl, event.violations);
          break;

        case 'batch:page_failed':
          setCurrentPage(null);
          onPageFailed?.(event.pageUrl, event.error);
          break;

        case 'batch:paused':
          // Progress state is maintained, just status changes
          break;

        case 'batch:resumed':
          // Progress state is maintained, just status changes
          break;

        case 'batch:completed':
          setCurrentPage(null);
          setProgress({
            completedPages: event.summary.successfulPages,
            totalPages: event.summary.totalPages,
            failedPages: event.summary.failedPages,
            totalViolations: event.summary.totalViolations,
            estimatedTimeRemaining: 0,
          });
          onComplete?.(event.summary);
          break;

        case 'batch:cancelled':
          setCurrentPage(null);
          break;

        case 'batch:error':
          setError(event.message);
          onError?.(event.message);
          break;
      }
    },
    [batchId, onPageComplete, onPageFailed, onComplete, onError]
  );

  // Manual disconnect
  const disconnect = useCallback(() => {
    wsClientRef.current?.disconnect();
    setIsConnected(false);
    setWsStatus('disconnected');
  }, [setWsStatus]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (wsClientRef.current && batchId) {
      wsClientRef.current.connect(batchId);
      setWsStatus('connecting');
    }
  }, [batchId, setWsStatus]);

  // Initialize progress from batch data if available
  useEffect(() => {
    if (batch && !progress) {
      setProgress({
        completedPages: batch.completedPages,
        totalPages: batch.totalPages,
        failedPages: batch.failedPages,
        totalViolations: batch.totalViolations,
        estimatedTimeRemaining: (batch.totalPages - batch.completedPages - batch.failedPages) * 30,
      });
    }
  }, [batch, progress]);

  return {
    batch,
    progress,
    currentPage,
    currentPageIndex,
    isConnected,
    error,
    isLoading,
    disconnect,
    reconnect,
  };
}
