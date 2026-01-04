/**
 * Health check hook for verifying API connectivity
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/shared/lib/api/client';
import { env } from '@/config/env';

/**
 * Health check response from the API
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  environment?: string;
  timestamp?: string;
}

/**
 * Health check status
 */
export type HealthStatus = 'checking' | 'healthy' | 'unhealthy' | 'error';

/**
 * Health check state
 */
export interface HealthCheckState {
  /** Current health status */
  status: HealthStatus;
  /** Environment name from the API response */
  apiEnvironment: string | null;
  /** Local environment name from config */
  localEnvironment: string;
  /** Error message if health check failed */
  error: string | null;
  /** Timestamp of last successful check */
  lastChecked: Date | null;
  /** Whether a check is in progress */
  isChecking: boolean;
}

/**
 * Health check hook return type
 */
export interface UseHealthCheckReturn extends HealthCheckState {
  /** Manually trigger a health check */
  checkHealth: () => Promise<void>;
  /** Reset the health check state */
  reset: () => void;
}

const initialState: HealthCheckState = {
  status: 'checking',
  apiEnvironment: null,
  localEnvironment: env.environment,
  error: null,
  lastChecked: null,
  isChecking: false,
};

/**
 * Hook for checking API health on startup and on demand
 *
 * @param options - Configuration options
 * @param options.checkOnMount - Whether to check health on mount (default: true)
 * @param options.retryOnError - Whether to retry on error (default: false)
 * @param options.retryDelay - Delay between retries in ms (default: 5000)
 * @returns Health check state and actions
 *
 * @example
 * ```tsx
 * const { status, apiEnvironment, error, checkHealth } = useHealthCheck();
 *
 * if (status === 'checking') return <LoadingSpinner />;
 * if (status === 'error') return <ErrorMessage error={error} onRetry={checkHealth} />;
 * ```
 */
export function useHealthCheck(
  options: {
    checkOnMount?: boolean;
    retryOnError?: boolean;
    retryDelay?: number;
  } = {}
): UseHealthCheckReturn {
  const { checkOnMount = true, retryOnError = false, retryDelay = 5000 } = options;

  const [state, setState] = useState<HealthCheckState>(initialState);

  const checkHealth = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isChecking: true,
      status: prev.status === 'error' ? 'checking' : prev.status,
    }));

    try {
      const response = await apiClient.get<HealthCheckResponse>('/health', {
        skipAuth: true, // Health endpoint doesn't require auth
      });

      setState({
        status: response.status === 'healthy' ? 'healthy' : 'unhealthy',
        apiEnvironment: response.environment || null,
        localEnvironment: env.environment,
        error: null,
        lastChecked: new Date(),
        isChecking: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to server';

      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        isChecking: false,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Check health on mount
  useEffect(() => {
    if (checkOnMount) {
      // Use a microtask to avoid setState during render
      queueMicrotask(() => {
        checkHealth();
      });
    }
  }, [checkOnMount, checkHealth]);

  // Retry on error if enabled
  useEffect(() => {
    if (retryOnError && state.status === 'error' && !state.isChecking) {
      const timeoutId = setTimeout(() => {
        checkHealth();
      }, retryDelay);

      return () => clearTimeout(timeoutId);
    }
  }, [retryOnError, retryDelay, state.status, state.isChecking, checkHealth]);

  return {
    ...state,
    checkHealth,
    reset,
  };
}
