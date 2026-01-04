/**
 * WebSocket URL construction utilities
 * Requirements: 4.1 - WebSocket URL construction with sessionId and token
 */

/**
 * Parameters for building a WebSocket URL
 */
export interface WebSocketUrlParams {
    /** Base WebSocket URL (should include stage suffix like /development) */
    baseUrl: string;
    /** Session ID to include as query parameter */
    sessionId: string;
    /** JWT token to include as query parameter (optional) */
    token?: string | null;
}

/**
 * Build a WebSocket URL with session ID and token query parameters
 * 
 * URL format: {baseUrl}?sessionId={sessionId}&token={token}
 * 
 * The baseUrl should include the API Gateway stage suffix (e.g., /development)
 * as configured in the environment variables.
 * 
 * @param params - URL construction parameters
 * @returns Fully constructed WebSocket URL with query parameters
 * @throws Error if baseUrl is not a valid WebSocket URL
 * 
 * Requirements: 4.1
 * 
 * @example
 * ```typescript
 * const url = buildWebSocketUrl({
 *     baseUrl: 'wss://api.example.com/development',
 *     sessionId: '123e4567-e89b-12d3-a456-426614174000',
 *     token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 * });
 * // Returns: wss://api.example.com/development?sessionId=123e4567-e89b-12d3-a456-426614174000&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * ```
 */
export function buildWebSocketUrl(params: WebSocketUrlParams): string {
    const { baseUrl, sessionId, token } = params;

    // Validate base URL is a WebSocket URL
    if (!baseUrl.startsWith('ws://') && !baseUrl.startsWith('wss://')) {
        throw new Error(`Invalid WebSocket URL: ${baseUrl} (must start with ws:// or wss://)`);
    }

    const url = new URL(baseUrl);
    url.searchParams.set('sessionId', sessionId);

    if (token) {
        url.searchParams.set('token', token);
    }

    return url.toString();
}

/**
 * Validate that a URL is a valid WebSocket URL
 * 
 * @param url - URL string to validate
 * @returns true if the URL is a valid WebSocket URL (ws:// or wss://)
 */
export function isValidWebSocketUrl(url: string): boolean {
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        return false;
    }

    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Extract query parameters from a WebSocket URL
 * 
 * @param url - WebSocket URL to parse
 * @returns Object containing sessionId and token (if present)
 */
export function parseWebSocketUrl(url: string): { sessionId: string | null; token: string | null } {
    try {
        const parsed = new URL(url);
        return {
            sessionId: parsed.searchParams.get('sessionId'),
            token: parsed.searchParams.get('token'),
        };
    } catch {
        return { sessionId: null, token: null };
    }
}
