/**
 * Property-based tests for API Client
 *
 * Feature: local-frontend-lambda-connection
 *
 * Property 3: Authorization Header Injection
 * Validates: Requirements 2.5
 *
 * For any authenticated API request, the request headers SHALL include an
 * `Authorization` header with the value `Bearer {token}` where token is the
 * current valid JWT.
 *
 * Property 1: URL Construction Consistency
 * Validates: Requirements 1.2, 1.3, 3.1-3.4
 *
 * For any valid API base URL and resource path, the constructed request URL
 * SHALL be the concatenation of the base URL and resource path without
 * duplicate slashes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ApiClient } from '../client';

describe('Feature: local-frontend-lambda-connection, Property 3: Authorization Header Injection', () => {
  let capturedHeaders: HeadersInit | undefined;

  beforeEach(() => {
    capturedHeaders = undefined;

    // Mock fetch to capture the request
    vi.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property: For any valid JWT token string, the Authorization header
   * SHALL be formatted as "Bearer {token}"
   */
  it('should inject Authorization header with Bearer prefix for any valid token', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate JWT-like tokens (base64-encoded segments separated by dots)
        fc
          .tuple(
            fc.base64String({ minLength: 10, maxLength: 100 }),
            fc.base64String({ minLength: 10, maxLength: 100 }),
            fc.base64String({ minLength: 10, maxLength: 100 })
          )
          .map(([header, payload, signature]) => `${header}.${payload}.${signature}`),
        async (token) => {
          const client = new ApiClient({
            baseUrl: 'https://api.example.com',
            getToken: async () => token,
          });

          await client.get('/test');

          // Verify Authorization header is present and correctly formatted
          expect(capturedHeaders).toBeDefined();
          const headers = capturedHeaders as Record<string, string>;
          expect(headers['Authorization']).toBe(`Bearer ${token}`);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any request when token provider returns null,
   * the Authorization header SHALL NOT be present
   */
  it('should not include Authorization header when token is null', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 50 }), async (path) => {
        const client = new ApiClient({
          baseUrl: 'https://api.example.com',
          getToken: async () => null,
        });

        await client.get(`/${path}`);

        // Verify Authorization header is NOT present
        expect(capturedHeaders).toBeDefined();
        const headers = capturedHeaders as Record<string, string>;
        expect(headers['Authorization']).toBeUndefined();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any request with skipAuth=true, the Authorization header
   * SHALL NOT be present even when a token is available
   */
  it('should not include Authorization header when skipAuth is true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(
            fc.base64String({ minLength: 10, maxLength: 50 }),
            fc.base64String({ minLength: 10, maxLength: 50 }),
            fc.base64String({ minLength: 10, maxLength: 50 })
          )
          .map(([h, p, s]) => `${h}.${p}.${s}`),
        async (token) => {
          const client = new ApiClient({
            baseUrl: 'https://api.example.com',
            getToken: async () => token,
          });

          await client.get('/test', { skipAuth: true });

          // Verify Authorization header is NOT present
          expect(capturedHeaders).toBeDefined();
          const headers = capturedHeaders as Record<string, string>;
          expect(headers['Authorization']).toBeUndefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any request without a token provider configured,
   * the Authorization header SHALL NOT be present
   */
  it('should not include Authorization header when no token provider is set', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 50 }), async (path) => {
        const client = new ApiClient({
          baseUrl: 'https://api.example.com',
          // No getToken provided
        });

        await client.get(`/${path}`);

        // Verify Authorization header is NOT present
        expect(capturedHeaders).toBeDefined();
        const headers = capturedHeaders as Record<string, string>;
        expect(headers['Authorization']).toBeUndefined();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Token provider can be set after client creation and
   * subsequent requests SHALL include the Authorization header
   */
  it('should use token from setTokenProvider for subsequent requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(
            fc.base64String({ minLength: 10, maxLength: 50 }),
            fc.base64String({ minLength: 10, maxLength: 50 }),
            fc.base64String({ minLength: 10, maxLength: 50 })
          )
          .map(([h, p, s]) => `${h}.${p}.${s}`),
        async (token) => {
          const client = new ApiClient({
            baseUrl: 'https://api.example.com',
          });

          // First request without token
          await client.get('/test');
          let headers = capturedHeaders as Record<string, string>;
          expect(headers['Authorization']).toBeUndefined();

          // Set token provider
          client.setTokenProvider(async () => token);

          // Second request should have token
          await client.get('/test');
          headers = capturedHeaders as Record<string, string>;
          expect(headers['Authorization']).toBe(`Bearer ${token}`);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: local-frontend-lambda-connection, Property 1: URL Construction Consistency', () => {
  let capturedUrl: string | undefined;

  beforeEach(() => {
    capturedUrl = undefined;

    // Mock fetch to capture the request URL
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      capturedUrl = url as string;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property: For any valid base URL and path, the constructed URL SHALL be
   * the concatenation without duplicate slashes
   */
  it('should construct URLs without duplicate slashes for any base URL and path', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid base URLs (with or without trailing slash)
        fc.constantFrom(
          'https://api.example.com',
          'https://api.example.com/',
          'https://api.example.com/v1',
          'https://api.example.com/v1/',
          'http://localhost:3000',
          'http://localhost:3000/'
        ),
        // Generate valid path segments
        fc
          .array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 1, maxLength: 5 })
          .map((segments) => '/' + segments.join('/')),
        async (baseUrl, path) => {
          const client = new ApiClient({ baseUrl });

          await client.get(path);

          // URL should not have double slashes (except in protocol)
          const urlWithoutProtocol = capturedUrl!.replace(/^https?:\/\//, '');
          expect(urlWithoutProtocol).not.toContain('//');

          // URL should contain the path
          expect(capturedUrl).toContain(path);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any base URL with trailing slash, the trailing slash
   * SHALL be removed before concatenation
   */
  it('should remove trailing slash from base URL before concatenation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate base URLs with trailing slash
        fc.constantFrom(
          'https://api.example.com/',
          'https://api.example.com/v1/',
          'http://localhost:3000/'
        ),
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/).map((s) => `/${s}`),
        async (baseUrl, path) => {
          const client = new ApiClient({ baseUrl });

          await client.get(path);

          // The base URL without trailing slash + path
          const expectedBase = baseUrl.replace(/\/$/, '');
          expect(capturedUrl).toBe(`${expectedBase}${path}`);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any query parameters, the URL SHALL include properly
   * formatted query string
   */
  it('should construct URLs with query parameters correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key1: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
          key2: fc.integer({ min: 0, max: 1000 }),
          key3: fc.boolean(),
        }),
        async (params) => {
          const client = new ApiClient({
            baseUrl: 'https://api.example.com',
          });

          await client.get('/test', { params });

          // URL should contain query string
          expect(capturedUrl).toContain('?');

          // URL should contain all param keys
          expect(capturedUrl).toContain(`key1=${params.key1}`);
          expect(capturedUrl).toContain(`key2=${params.key2}`);
          expect(capturedUrl).toContain(`key3=${params.key3}`);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For undefined query parameter values, the parameter
   * SHALL NOT be included in the URL
   */
  it('should exclude undefined query parameters from URL', async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/), async (definedValue) => {
        const client = new ApiClient({
          baseUrl: 'https://api.example.com',
        });

        await client.get('/test', {
          params: {
            defined: definedValue,
            undefinedParam: undefined,
          },
        });

        // URL should contain defined param
        expect(capturedUrl).toContain(`defined=${definedValue}`);

        // URL should NOT contain undefined param
        expect(capturedUrl).not.toContain('undefinedParam');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any HTTP method, the URL construction SHALL be consistent
   */
  it('should construct consistent URLs across all HTTP methods', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/).map((s) => `/${s}`),
        async (method, path) => {
          const client = new ApiClient({
            baseUrl: 'https://api.example.com',
          });

          const expectedUrl = `https://api.example.com${path}`;

          switch (method) {
            case 'GET':
              await client.get(path);
              break;
            case 'POST':
              await client.post(path, {});
              break;
            case 'PUT':
              await client.put(path, {});
              break;
            case 'PATCH':
              await client.patch(path, {});
              break;
            case 'DELETE':
              await client.delete(path);
              break;
          }

          expect(capturedUrl).toBe(expectedUrl);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For scan API endpoints, URLs SHALL follow the expected patterns
   * Validates: Requirements 3.1-3.4
   */
  it('should construct correct URLs for scan API endpoints', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (sessionId) => {
        const client = new ApiClient({
          baseUrl: 'https://api.example.com',
        });

        // Test /scans endpoint (POST)
        await client.post('/scans', { url: 'https://test.com', viewport: 'desktop' });
        expect(capturedUrl).toBe('https://api.example.com/scans');

        // Test /scans/{sessionId} endpoint (GET)
        await client.get(`/scans/${sessionId}`);
        expect(capturedUrl).toBe(`https://api.example.com/scans/${sessionId}`);

        // Test /sessions endpoint (GET)
        await client.get('/sessions');
        expect(capturedUrl).toBe('https://api.example.com/sessions');

        // Test /reports/{sessionId} endpoint (GET)
        await client.get(`/reports/${sessionId}`);
        expect(capturedUrl).toBe(`https://api.example.com/reports/${sessionId}`);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
