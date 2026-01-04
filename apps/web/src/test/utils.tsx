/**
 * Test utilities for integration tests
 * Provides wrappers for rendering components with all necessary providers
 */
import React, { type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '@/features/auth/providers/AuthProvider';
import type { AuthContextValue } from '@/features/auth/types';
import type { User } from '@/types/domain';

/**
 * Create a test QueryClient with disabled retries
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Default mock user for authenticated tests
 */
export const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  authProvider: 'local',
};

/**
 * Create a mock auth context value
 */
export function createMockAuthContext(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: async () => {},
    loginWithSSO: async () => {},
    logout: async () => {},
    ...overrides,
  };
}

/**
 * Create an authenticated mock auth context
 */
export function createAuthenticatedContext(user: User = mockUser): AuthContextValue {
  return createMockAuthContext({
    user,
    isAuthenticated: true,
  });
}

/**
 * Options for rendering with providers
 */
export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  authContext?: AuthContextValue;
  initialEntries?: string[];
}

/**
 * Wrapper component that provides all necessary context
 */
function createWrapper(options: RenderWithProvidersOptions = {}) {
  const { queryClient = createTestQueryClient(), authContext = createMockAuthContext() } = options;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
  };
}

/**
 * Render a component with all providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const { queryClient = createTestQueryClient(), authContext, ...renderOptions } = options;

  return {
    queryClient,
    ...render(ui, {
      wrapper: createWrapper({ queryClient, authContext }),
      ...renderOptions,
    }),
  };
}

/**
 * Create a wrapper for testing hooks with providers
 */
export function createHookWrapper(options: RenderWithProvidersOptions = {}) {
  const { queryClient = createTestQueryClient(), authContext = createMockAuthContext() } = options;

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    ),
  };
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
