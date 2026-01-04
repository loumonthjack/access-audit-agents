/**
 * Base API client with fetch wrapper, error handling, and auth token injection
 * Requirements: 10.1, 10.5
 */

import { env } from '@/config/env';
import { ApiError, NetworkError, createApiError } from './errors';

/**
 * Token provider function type for auth injection
 */
export type TokenProvider = () => Promise<string | null>;

/**
 * Request options extending standard RequestInit
 */
export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Skip auth token injection */
  skipAuth?: boolean;
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  /** Base URL for API requests */
  baseUrl: string;
  /** Token provider for auth injection */
  getToken?: TokenProvider;
  /** Default headers for all requests */
  defaultHeaders?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Create query string from params object
 */
function buildQueryString(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * API Client class for making HTTP requests
 */
export class ApiClient {
  private baseUrl: string;
  private getToken?: TokenProvider;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.getToken = config.getToken;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.defaultHeaders,
    };
    this.timeout = config.timeout ?? 30000; // 30 seconds default
  }

  /**
   * Set the token provider for auth injection
   */
  setTokenProvider(getToken: TokenProvider): void {
    this.getToken = getToken;
  }

  /**
   * Make an HTTP request
   */
  private async request<T>(
    method: string,
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { body, params, skipAuth, headers: customHeaders, ...fetchOptions } = options;

    // Build URL with query params
    const url = `${this.baseUrl}${path}${buildQueryString(params)}`;

    // Build headers
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(customHeaders as Record<string, string> | undefined),
    };

    // Inject auth token if available and not skipped
    if (!skipAuth && this.getToken) {
      try {
        const token = await this.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // Continue without token if provider fails
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        ...fetchOptions,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        let errorBody:
          | { code?: string; message?: string; details?: Record<string, unknown> }
          | undefined;
        try {
          errorBody = await response.json();
        } catch {
          // Response body is not JSON
        }
        throw createApiError(response.status, errorBody);
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return undefined as T;
      }

      // Parse JSON response
      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw ApiError instances
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new NetworkError('Request timed out');
      }

      // Handle network errors
      if (error instanceof TypeError) {
        throw new NetworkError('Failed to connect to server');
      }

      // Unknown error
      throw new NetworkError(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }
}

/**
 * Default API client instance configured with environment settings
 */
export const apiClient = new ApiClient({
  baseUrl: env.apiUrl,
});
