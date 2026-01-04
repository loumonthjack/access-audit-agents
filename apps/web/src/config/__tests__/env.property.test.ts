/**
 * Property-based tests for environment URL validation
 * 
 * Feature: local-frontend-lambda-connection, Property 5: URL Format Validation
 * Validates: Requirements 1.4, 1.5
 * 
 * For any string provided as VITE_API_URL, the validation function SHALL accept it
 * if and only if it is a valid HTTP/HTTPS URL. Similarly, for any string provided
 * as VITE_WS_URL, validation SHALL accept it if and only if it starts with ws:// or wss://.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isValidHttpUrl, isValidWsUrl } from '../env.js';

describe('Feature: local-frontend-lambda-connection, Property 5: URL Format Validation', () => {
    /**
     * Property: For any valid HTTP URL, isValidHttpUrl SHALL return true
     */
    it('should accept valid HTTP URLs', () => {
        fc.assert(
            fc.property(
                fc.webUrl({ validSchemes: ['http', 'https'] }),
                (url) => {
                    expect(isValidHttpUrl(url)).toBe(true);
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: For any URL with non-HTTP scheme, isValidHttpUrl SHALL return false
     */
    it('should reject non-HTTP URLs', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.webUrl({ validSchemes: ['ftp'] }),
                    fc.constant('ws://example.com'),
                    fc.constant('wss://example.com'),
                    fc.constant('file:///path/to/file'),
                    fc.constant('mailto:test@example.com')
                ),
                (url) => {
                    expect(isValidHttpUrl(url)).toBe(false);
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: For any invalid URL string, isValidHttpUrl SHALL return false
     */
    it('should reject invalid URL strings for HTTP validation', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.string().filter(s => !s.includes('://')),
                    fc.constant(''),
                    fc.constant('not-a-url'),
                    fc.constant('http//missing-colon.com'),
                    fc.constant('://no-scheme.com')
                ),
                (invalidUrl) => {
                    expect(isValidHttpUrl(invalidUrl)).toBe(false);
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: For any valid WebSocket URL, isValidWsUrl SHALL return true
     */
    it('should accept valid WebSocket URLs', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.tuple(
                        fc.constant('ws://'),
                        fc.domain(),
                        fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined })
                    ).map(([scheme, domain, port]) =>
                        port ? `${scheme}${domain}:${port}` : `${scheme}${domain}`
                    ),
                    fc.tuple(
                        fc.constant('wss://'),
                        fc.domain(),
                        fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined })
                    ).map(([scheme, domain, port]) =>
                        port ? `${scheme}${domain}:${port}` : `${scheme}${domain}`
                    )
                ),
                (url) => {
                    expect(isValidWsUrl(url)).toBe(true);
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: For any URL with non-WebSocket scheme, isValidWsUrl SHALL return false
     */
    it('should reject non-WebSocket URLs', () => {
        fc.assert(
            fc.property(
                fc.webUrl({ validSchemes: ['http', 'https'] }),
                (url) => {
                    expect(isValidWsUrl(url)).toBe(false);
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: For any invalid URL string, isValidWsUrl SHALL return false
     */
    it('should reject invalid URL strings for WebSocket validation', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.string().filter(s => !s.includes('://')),
                    fc.constant(''),
                    fc.constant('not-a-url'),
                    fc.constant('ws//missing-colon.com'),
                    fc.constant('://no-scheme.com')
                ),
                (invalidUrl) => {
                    expect(isValidWsUrl(invalidUrl)).toBe(false);
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: isValidHttpUrl and isValidWsUrl SHALL be mutually exclusive for valid URLs
     * (a valid HTTP URL is not a valid WS URL and vice versa)
     */
    it('should have mutually exclusive HTTP and WebSocket URL validation', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.webUrl({ validSchemes: ['http', 'https'] }),
                    fc.tuple(
                        fc.constantFrom('ws://', 'wss://'),
                        fc.domain()
                    ).map(([scheme, domain]) => `${scheme}${domain}`)
                ),
                (url) => {
                    const isHttp = isValidHttpUrl(url);
                    const isWs = isValidWsUrl(url);

                    // A URL cannot be both valid HTTP and valid WebSocket
                    expect(isHttp && isWs).toBe(false);

                    // A valid URL should be one or the other
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        expect(isHttp).toBe(true);
                        expect(isWs).toBe(false);
                    } else if (url.startsWith('ws://') || url.startsWith('wss://')) {
                        expect(isHttp).toBe(false);
                        expect(isWs).toBe(true);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Null and undefined inputs SHALL return false for both validators
     */
    it('should handle null and undefined inputs gracefully', () => {
        // @ts-expect-error - Testing runtime behavior with invalid types
        expect(isValidHttpUrl(null)).toBe(false);
        // @ts-expect-error - Testing runtime behavior with invalid types
        expect(isValidHttpUrl(undefined)).toBe(false);
        // @ts-expect-error - Testing runtime behavior with invalid types
        expect(isValidWsUrl(null)).toBe(false);
        // @ts-expect-error - Testing runtime behavior with invalid types
        expect(isValidWsUrl(undefined)).toBe(false);
    });
});
