// TanStack Query client configuration
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

/**
 * Custom API error class for typed error handling
 */
export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly userMessage: string = message
    ) {
        super(message);
        this.name = 'ApiError';
    }

    /**
     * Check if error is a client error (4xx)
     */
    isClientError(): boolean {
        return this.status >= 400 && this.status < 500;
    }

    /**
     * Check if error is a server error (5xx)
     */
    isServerError(): boolean {
        return this.status >= 500;
    }

    /**
     * Check if error is unauthorized (401)
     */
    isUnauthorized(): boolean {
        return this.status === 401;
    }

    /**
     * Check if error is not found (404)
     */
    isNotFound(): boolean {
        return this.status === 404;
    }
}

/**
 * Determine if a query should retry based on the error
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
    // Don't retry on auth errors - user needs to re-authenticate
    if (error instanceof ApiError && error.isUnauthorized()) {
        return false;
    }

    // Don't retry on not found - resource doesn't exist
    if (error instanceof ApiError && error.isNotFound()) {
        return false;
    }

    // Don't retry on client errors (except rate limiting)
    if (error instanceof ApiError && error.isClientError() && error.status !== 429) {
        return false;
    }

    // Retry up to 3 times for server errors and network issues
    return failureCount < 3;
}

/**
 * Calculate retry delay with exponential backoff
 * Starts at 1s, doubles each attempt, max 30s
 */
function getRetryDelay(attemptIndex: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    return Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);
}

/**
 * Global error handler for queries
 */
function handleQueryError(error: unknown): void {
    // Log errors in development
    if (import.meta.env.DEV) {
        console.error('[Query Error]', error);
    }

    // Handle unauthorized errors globally (redirect to login)
    if (error instanceof ApiError && error.isUnauthorized()) {
        // This will be handled by the auth provider
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
}

/**
 * Global error handler for mutations
 */
function handleMutationError(error: unknown): void {
    // Log errors in development
    if (import.meta.env.DEV) {
        console.error('[Mutation Error]', error);
    }

    // Handle unauthorized errors globally
    if (error instanceof ApiError && error.isUnauthorized()) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
}

/**
 * Create and configure the TanStack Query client
 */
export function createQueryClient(): QueryClient {
    return new QueryClient({
        queryCache: new QueryCache({
            onError: handleQueryError,
        }),
        mutationCache: new MutationCache({
            onError: handleMutationError,
        }),
        defaultOptions: {
            queries: {
                // Data is considered fresh for 1 minute
                staleTime: 1000 * 60,
                // Keep unused data in cache for 5 minutes
                gcTime: 1000 * 60 * 5,
                // Custom retry logic
                retry: shouldRetry,
                retryDelay: getRetryDelay,
                // Don't refetch on window focus (can be noisy)
                refetchOnWindowFocus: false,
                // Don't refetch on reconnect automatically
                refetchOnReconnect: 'always',
                // Don't throw errors - handle in components
                throwOnError: false,
            },
            mutations: {
                // Retry mutations once on failure
                retry: 1,
                retryDelay: 1000,
            },
        },
    });
}

/**
 * Default query client instance
 */
export const queryClient = createQueryClient();

/**
 * Query keys factory for type-safe query keys
 * Provides consistent key structure across the application
 */
export const queryKeys = {
    /**
     * Session-related query keys
     */
    sessions: {
        /** Base key for all session queries */
        all: ['sessions'] as const,
        /** Key for paginated session list */
        list: (page: number) => [...queryKeys.sessions.all, 'list', page] as const,
        /** Key for single session detail */
        detail: (id: string) => [...queryKeys.sessions.all, 'detail', id] as const,
    },

    /**
     * Report-related query keys
     */
    reports: {
        /** Base key for all report queries */
        all: ['reports'] as const,
        /** Key for single report detail */
        detail: (id: string) => [...queryKeys.reports.all, 'detail', id] as const,
    },

    /**
     * Violation-related query keys
     */
    violations: {
        /** Key for violations by session */
        bySession: (sessionId: string) => ['violations', sessionId] as const,
    },

    /**
     * User-related query keys
     */
    user: {
        /** Key for current user */
        current: ['user', 'current'] as const,
    },

    /**
     * Batch scan-related query keys
     * Requirements: 8.1, 10.1
     */
    batchScans: {
        /** Base key for all batch scan queries */
        all: ['batchScans'] as const,
        /** Key for paginated batch scan list */
        list: (page: number) => [...queryKeys.batchScans.all, 'list', page] as const,
        /** Key for single batch scan detail */
        detail: (id: string) => [...queryKeys.batchScans.all, 'detail', id] as const,
        /** Key for batch scan report */
        report: (id: string) => [...queryKeys.batchScans.all, 'report', id] as const,
    },
} as const;

/**
 * Type helper to extract query key types
 */
export type QueryKeys = typeof queryKeys;
