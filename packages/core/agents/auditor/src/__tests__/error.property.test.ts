/**
 * Property-based tests for Error Response Structure
 * 
 * Feature: core-auditor-agent
 * Property 6: Error Response Structure
 * 
 * *For any* error thrown by the Auditor, the AuditorError SHALL contain:
 * - A valid `code` from the AuditorErrorCode enum
 * - A non-empty `message` string
 * - A `stack` string when in development mode
 * 
 * Validates: Requirements 7.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    auditorErrorCodeArb,
    errorMessageArb,
    errorDetailsArb,
    auditorErrorClassArb,
    ALL_ERROR_CODES
} from '../__generators__/error.generator.js';
import {
    AuditorErrorClass,
    createBrowserLaunchFailedError,
    createBrowserProviderUnavailableError,
    createAxeInjectionFailedError,
    createAutomationBlockedError,
    createUrlUnreachableError,
    createTimeoutError,
    createElementNotFoundError,
    wrapError
} from '../utils/errors.js';
import { AuditorErrorSchema } from '../types/index.js';

describe('Property 6: Error Response Structure', () => {
    /**
     * Property 6.1: All AuditorErrorClass instances have valid code from enum
     * 
     * For any AuditorErrorClass created with any valid code, message, and details,
     * the resulting error SHALL have a code that is a valid AuditorErrorCode.
     */
    it('should always have a valid code from AuditorErrorCode enum', () => {
        fc.assert(
            fc.property(
                auditorErrorCodeArb,
                errorMessageArb,
                errorDetailsArb,
                (code, message, details) => {
                    const error = new AuditorErrorClass(code, message, details);

                    // Code must be one of the valid error codes
                    expect(ALL_ERROR_CODES).toContain(error.code);

                    // Code must match what was passed in
                    expect(error.code).toBe(code);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 6.2: All AuditorErrorClass instances have non-empty message
     * 
     * For any AuditorErrorClass, the message property SHALL be a non-empty string.
     */
    it('should always have a non-empty message string', () => {
        fc.assert(
            fc.property(
                auditorErrorClassArb,
                (error) => {
                    // Message must be a string
                    expect(typeof error.message).toBe('string');

                    // Message must be non-empty
                    expect(error.message.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 6.3: All AuditorErrorClass instances have stack trace
     * 
     * For any AuditorErrorClass created in development mode (Node.js),
     * the stack property SHALL be a non-empty string.
     */
    it('should always have a stack trace in development mode', () => {
        fc.assert(
            fc.property(
                auditorErrorClassArb,
                (error) => {
                    // Stack must exist (we're in Node.js/development mode)
                    expect(error.stack).toBeDefined();
                    expect(typeof error.stack).toBe('string');
                    expect(error.stack!.length).toBeGreaterThan(0);

                    // Stack should contain 'AuditorError' (the error name)
                    expect(error.stack).toContain('AuditorError');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 6.4: AuditorErrorClass.toJSON() produces valid schema-conforming object
     * 
     * For any AuditorErrorClass, calling toJSON() SHALL produce an object
     * that conforms to the AuditorErrorSchema.
     */
    it('should produce schema-conforming JSON representation', () => {
        fc.assert(
            fc.property(
                auditorErrorClassArb,
                (error) => {
                    const json = error.toJSON();

                    // Must have required fields
                    expect(json).toHaveProperty('code');
                    expect(json).toHaveProperty('message');

                    // Must validate against schema
                    const result = AuditorErrorSchema.safeParse(json);
                    expect(result.success).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 6.5: Error factory functions produce valid errors
     * 
     * For any error created by factory functions, the error SHALL conform
     * to the AuditorError structure requirements.
     */
    describe('Error factory functions produce valid errors', () => {
        it('createBrowserLaunchFailedError produces valid error', () => {
            fc.assert(
                fc.property(
                    errorMessageArb,
                    errorDetailsArb,
                    (message, details) => {
                        const error = createBrowserLaunchFailedError(message, details);

                        expect(error.code).toBe('BROWSER_LAUNCH_FAILED');
                        expect(error.message).toBe(message);
                        expect(error.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('createBrowserProviderUnavailableError produces valid error', () => {
            fc.assert(
                fc.property(
                    errorMessageArb,
                    errorDetailsArb,
                    (message, details) => {
                        const error = createBrowserProviderUnavailableError(message, details);

                        expect(error.code).toBe('BROWSER_PROVIDER_UNAVAILABLE');
                        expect(error.message).toBe(message);
                        expect(error.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('createAxeInjectionFailedError produces valid error', () => {
            fc.assert(
                fc.property(
                    errorMessageArb,
                    errorDetailsArb,
                    (message, details) => {
                        const error = createAxeInjectionFailedError(message, details);

                        expect(error.code).toBe('AXE_INJECTION_FAILED');
                        expect(error.message).toBe(message);
                        expect(error.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('createAutomationBlockedError produces valid error', () => {
            fc.assert(
                fc.property(
                    errorMessageArb,
                    errorDetailsArb,
                    (message, details) => {
                        const error = createAutomationBlockedError(message, details);

                        expect(error.code).toBe('AUTOMATION_BLOCKED');
                        expect(error.message).toBe(message);
                        expect(error.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('createUrlUnreachableError produces valid error', () => {
            fc.assert(
                fc.property(
                    fc.webUrl(),
                    fc.option(fc.integer({ min: 400, max: 599 }), { nil: undefined }),
                    fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
                    (url, statusCode, reason) => {
                        const error = createUrlUnreachableError(url, statusCode, reason);

                        expect(error.code).toBe('URL_UNREACHABLE');
                        expect(error.message.length).toBeGreaterThan(0);
                        expect(error.details).toHaveProperty('url', url);
                        expect(error.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('createTimeoutError produces valid error', () => {
            fc.assert(
                fc.property(
                    fc.webUrl(),
                    fc.integer({ min: 1000, max: 60000 }),
                    (url, timeoutMs) => {
                        const error = createTimeoutError(url, timeoutMs);

                        expect(error.code).toBe('TIMEOUT');
                        expect(error.message).toContain(String(timeoutMs));
                        expect(error.details).toHaveProperty('url', url);
                        expect(error.details).toHaveProperty('timeoutMs', timeoutMs);
                        expect(error.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('createElementNotFoundError produces valid error', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 100 }),
                    errorDetailsArb,
                    (selector, details) => {
                        const error = createElementNotFoundError(selector, details);

                        expect(error.code).toBe('ELEMENT_NOT_FOUND');
                        expect(error.message).toContain(selector);
                        expect(error.details).toHaveProperty('selector', selector);
                        expect(error.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Property 6.6: wrapError always produces valid AuditorErrorClass
     * 
     * For any error (native Error, AuditorErrorClass, or unknown),
     * wrapError SHALL produce a valid AuditorErrorClass instance.
     */
    describe('wrapError produces valid errors', () => {
        it('wraps native Error into valid AuditorErrorClass', () => {
            fc.assert(
                fc.property(
                    errorMessageArb,
                    auditorErrorCodeArb,
                    (message, defaultCode) => {
                        const nativeError = new Error(message);
                        const wrapped = wrapError(nativeError, defaultCode);

                        expect(wrapped).toBeInstanceOf(AuditorErrorClass);
                        expect(wrapped.code).toBe(defaultCode);
                        expect(wrapped.message).toBe(message);
                        expect(wrapped.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('returns same instance when wrapping AuditorErrorClass', () => {
            fc.assert(
                fc.property(
                    auditorErrorClassArb,
                    (error) => {
                        const wrapped = wrapError(error);

                        // Should return the same instance
                        expect(wrapped).toBe(error);
                        expect(wrapped.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('wraps unknown values into valid AuditorErrorClass', () => {
            fc.assert(
                fc.property(
                    fc.oneof(
                        fc.string(),
                        fc.integer(),
                        fc.boolean(),
                        fc.constant(null),
                        fc.constant(undefined)
                    ),
                    auditorErrorCodeArb,
                    (value, defaultCode) => {
                        const wrapped = wrapError(value, defaultCode);

                        expect(wrapped).toBeInstanceOf(AuditorErrorClass);
                        expect(wrapped.code).toBe(defaultCode);
                        expect(wrapped.message.length).toBeGreaterThan(0);
                        expect(wrapped.validate()).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Property 6.7: AuditorErrorClass round-trip through JSON
     * 
     * For any AuditorErrorClass, converting to JSON and back via fromJSON
     * SHALL preserve the code, message, and details.
     */
    it('should round-trip through JSON correctly', () => {
        fc.assert(
            fc.property(
                auditorErrorClassArb,
                (error) => {
                    const json = error.toJSON();
                    const restored = AuditorErrorClass.fromJSON(json);

                    expect(restored.code).toBe(error.code);
                    expect(restored.message).toBe(error.message);
                    expect(restored.details).toEqual(error.details);
                    expect(restored.validate()).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
