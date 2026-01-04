/**
 * fast-check arbitraries for AuditorError and related types
 * 
 * Feature: core-auditor-agent
 * Property 6: Error Response Structure
 */

import * as fc from 'fast-check';
import type { AuditorErrorCode, AuditorError as AuditorErrorData } from '../types/index.js';
import { AuditorErrorClass } from '../utils/errors.js';

/**
 * All valid AuditorErrorCode values
 */
export const ALL_ERROR_CODES: AuditorErrorCode[] = [
    'BROWSER_LAUNCH_FAILED',
    'BROWSER_PROVIDER_UNAVAILABLE',
    'AXE_INJECTION_FAILED',
    'AUTOMATION_BLOCKED',
    'URL_UNREACHABLE',
    'TIMEOUT',
    'ELEMENT_NOT_FOUND'
];

/**
 * Generates a valid AuditorErrorCode
 */
export const auditorErrorCodeArb: fc.Arbitrary<AuditorErrorCode> = fc.constantFrom(...ALL_ERROR_CODES);

/**
 * Generates a non-empty error message
 */
export const errorMessageArb: fc.Arbitrary<string> = fc.stringOf(
    fc.char().filter(c => c !== '\0'), // Exclude null characters
    { minLength: 1, maxLength: 500 }
).filter(s => s.trim().length > 0); // Ensure non-empty after trim

/**
 * Generates optional error details
 */
export const errorDetailsArb: fc.Arbitrary<Record<string, unknown> | undefined> = fc.oneof(
    fc.constant(undefined),
    fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null)
        ),
        { minKeys: 0, maxKeys: 5 }
    )
);

/**
 * Generates an AuditorErrorClass instance
 */
export const auditorErrorClassArb: fc.Arbitrary<AuditorErrorClass> = fc.record({
    code: auditorErrorCodeArb,
    message: errorMessageArb,
    details: errorDetailsArb
}).map(({ code, message, details }) => new AuditorErrorClass(code, message, details));

/**
 * Generates an AuditorError data object (plain object, not class instance)
 */
export const auditorErrorDataArb: fc.Arbitrary<AuditorErrorData> = fc.record({
    code: auditorErrorCodeArb,
    message: errorMessageArb,
    details: errorDetailsArb,
    stack: fc.option(fc.string({ minLength: 1, maxLength: 1000 }), { nil: undefined })
});

/**
 * Generates error scenarios for testing error factory functions
 */
export interface ErrorScenario {
    code: AuditorErrorCode;
    createError: () => AuditorErrorClass;
    description: string;
}

/**
 * Generates URL-related error scenarios
 */
export const urlErrorScenarioArb: fc.Arbitrary<ErrorScenario> = fc.record({
    url: fc.webUrl(),
    statusCode: fc.option(fc.integer({ min: 400, max: 599 }), { nil: undefined }),
    reason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })
}).map(({ url, statusCode, reason }) => ({
    code: 'URL_UNREACHABLE' as AuditorErrorCode,
    createError: () => {
        const { createUrlUnreachableError } = require('../utils/errors.js');
        return createUrlUnreachableError(url, statusCode, reason);
    },
    description: `URL unreachable: ${url}`
}));

/**
 * Generates timeout error scenarios
 */
export const timeoutErrorScenarioArb: fc.Arbitrary<ErrorScenario> = fc.record({
    url: fc.webUrl(),
    timeoutMs: fc.integer({ min: 1000, max: 60000 })
}).map(({ url, timeoutMs }) => ({
    code: 'TIMEOUT' as AuditorErrorCode,
    createError: () => {
        const { createTimeoutError } = require('../utils/errors.js');
        return createTimeoutError(url, timeoutMs);
    },
    description: `Timeout for URL: ${url}`
}));

/**
 * Generates element not found error scenarios
 */
export const elementNotFoundErrorScenarioArb: fc.Arbitrary<ErrorScenario> = fc.record({
    selector: fc.string({ minLength: 1, maxLength: 100 })
}).map(({ selector }) => ({
    code: 'ELEMENT_NOT_FOUND' as AuditorErrorCode,
    createError: () => {
        const { createElementNotFoundError } = require('../utils/errors.js');
        return createElementNotFoundError(selector);
    },
    description: `Element not found: ${selector}`
}));
