/**
 * useScanSession hook - Combines TanStack Query + WebSocket for real-time scan session tracking
 * Requirements: 2.1, 2.2, 2.3
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession, scanApi } from '../api/scanApi';
import { useProgressStream } from './useProgressStream';
import { queryKeys } from '@/config/queryClient';
import type { Violation, ScanSession } from '@/types/domain';
import type { UseScanSessionOptions, UseScanSessionReturn } from '../types';
import type { ProgressEvent } from '@/types/events';

/**
 * Hook for managing a scan session with real-time updates
 * Combines TanStack Query for initial data + WebSocket for real-time updates
 * Requirements: 2.1, 2.2, 2.3
 */
export function useScanSession(options: UseScanSessionOptions): UseScanSessionReturn {
  const { sessionId, onViolationDetected, onFixApplied, onComplete, onError } = options;
  const queryClient = useQueryClient();

  // Local state for violations and current processing
  const [violations, setViolations] = useState<Violation[]>([]);
  const [currentViolationId, setCurrentViolationId] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [violationsLoaded, setViolationsLoaded] = useState(false);

  // Use ref to track processed events to avoid duplicate processing
  const processedEventsRef = useRef<Set<string>>(new Set());

  // Fetch session data with TanStack Query
  const { data: session } = useSession(sessionId);

  // Combine WebSocket error with session error message
  // Session errorMessage takes precedence as it's the user-friendly message from the backend
  const error = session?.errorMessage ?? wsError;

  // Load existing violations when session is loaded
  useEffect(() => {
    if (session && !violationsLoaded) {
      scanApi
        .getSessionViolations(sessionId)
        .then((existingViolations) => {
          if (existingViolations && existingViolations.length > 0) {
            setViolations(existingViolations);
          }
          setViolationsLoaded(true);
        })
        .catch((err) => {
          console.error('Failed to load existing violations:', err);
          setViolationsLoaded(true);
        });
    }
  }, [session, sessionId, violationsLoaded]);

  // Subscribe to WebSocket progress stream
  const { isConnected, lastEvent } = useProgressStream({
    sessionId,
    enabled: !!sessionId && session?.status !== 'complete' && session?.status !== 'error',
  });

  // Event handler callback - processes WebSocket events
  const handleEvent = useCallback(
    (event: ProgressEvent) => {
      // Generate a unique key for this event to avoid duplicate processing
      const eventKey = `${event.type}-${JSON.stringify(event)}`;
      if (processedEventsRef.current.has(eventKey)) {
        return;
      }
      processedEventsRef.current.add(eventKey);

      switch (event.type) {
        case 'violation_detected': {
          const violation = event.violation;
          setViolations((prev) => {
            // Avoid duplicates
            if (prev.some((v) => v.id === violation.id)) {
              return prev;
            }
            return [...prev, violation];
          });
          onViolationDetected?.(violation);
          break;
        }

        case 'fix_started': {
          setCurrentViolationId(event.violationId);
          // Update violation status to processing
          setViolations((prev) =>
            prev.map((v) =>
              v.id === event.violationId ? { ...v, status: 'processing' as const } : v
            )
          );
          break;
        }

        case 'fix_applied': {
          const { violationId, fix } = event;
          setCurrentViolationId(null);
          // Update violation status to fixed
          setViolations((prev) =>
            prev.map((v) => (v.id === violationId ? { ...v, status: 'fixed' as const, fix } : v))
          );
          // Update query cache
          queryClient.setQueryData(
            queryKeys.sessions.detail(sessionId),
            (old: ScanSession | undefined) => {
              if (!old) return old;
              return {
                ...old,
                fixCounts: {
                  ...old.fixCounts,
                  fixed: old.fixCounts.fixed + 1,
                  pending: Math.max(0, old.fixCounts.pending - 1),
                },
              };
            }
          );
          onFixApplied?.(fix);
          break;
        }

        case 'fix_skipped': {
          const { violationId, reason } = event;
          setCurrentViolationId(null);
          // Update violation status to skipped
          setViolations((prev) =>
            prev.map((v) =>
              v.id === violationId ? { ...v, status: 'skipped' as const, skipReason: reason } : v
            )
          );
          // Update query cache
          queryClient.setQueryData(
            queryKeys.sessions.detail(sessionId),
            (old: ScanSession | undefined) => {
              if (!old) return old;
              return {
                ...old,
                fixCounts: {
                  ...old.fixCounts,
                  skipped: old.fixCounts.skipped + 1,
                  pending: Math.max(0, old.fixCounts.pending - 1),
                },
              };
            }
          );
          break;
        }

        case 'session_complete': {
          const report = event.report;
          setCurrentViolationId(null);
          // Update session status in cache
          queryClient.setQueryData(
            queryKeys.sessions.detail(sessionId),
            (old: ScanSession | undefined) => {
              if (!old) return old;
              return {
                ...old,
                status: 'complete' as const,
                completedAt: new Date().toISOString(),
              };
            }
          );
          // Invalidate to get fresh data
          queryClient.invalidateQueries({ queryKey: queryKeys.sessions.detail(sessionId) });
          onComplete?.(report);
          break;
        }

        case 'error': {
          setWsError(event.message);
          if (!event.recoverable) {
            setCurrentViolationId(null);
          }
          onError?.(event.message);
          break;
        }

        case 'session_started': {
          // Update session in cache
          queryClient.setQueryData(queryKeys.sessions.detail(sessionId), event.session);
          break;
        }
      }
    },
    [sessionId, queryClient, onViolationDetected, onFixApplied, onComplete, onError]
  );

  // Handle WebSocket events - call the handler when lastEvent changes
  useEffect(() => {
    if (lastEvent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: responding to external WebSocket events
      handleEvent(lastEvent);
    }
  }, [lastEvent, handleEvent]);

  // Compute status from session data
  const status = useMemo(() => {
    return session?.status ?? 'pending';
  }, [session?.status]);

  return {
    session,
    violations,
    currentViolationId,
    status,
    isConnected,
    error,
  };
}
