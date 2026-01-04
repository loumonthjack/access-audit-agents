/**
 * useApiAuth Hook
 * Configures the API client with authentication token
 * Requirements: 10.1, 10.5
 */
import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { apiClient } from '@/shared/lib/api/client';

/**
 * Hook to configure the API client with the current auth token
 * Should be called once at the app root level
 *
 * @example
 * ```tsx
 * function App() {
 *   useApiAuth(); // Configures API client with auth token
 *   return <Routes />;
 * }
 * ```
 */
export function useApiAuth(): void {
  const { getToken, isAuthenticated, isLoading } = useAuth();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    // Always set the token provider - it will return the token if available
    apiClient.setTokenProvider(getToken);
  }, [getToken, isAuthenticated, isLoading]);

  // Track authentication state to detect logout (not initial loading)
  useEffect(() => {
    // Only clear token provider on actual logout (was authenticated, now not)
    if (wasAuthenticated.current && !isAuthenticated && !isLoading) {
      apiClient.setTokenProvider(async () => null);
    }
    // Update ref after checking
    if (!isLoading) {
      wasAuthenticated.current = isAuthenticated;
    }
  }, [isAuthenticated, isLoading]);
}
