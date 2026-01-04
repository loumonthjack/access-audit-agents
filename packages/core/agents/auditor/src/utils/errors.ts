/**
 * Error Handling Utilities
 * 
 * Provides structured error handling for the Auditor Agent.
 * 
 * Features:
 * - AuditorErrorClass with code, message, stack
 * - Error factory functions for each error code
 * - Retry logic with exponential backoff
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 8.5
 */

import type { AuditorErrorCode, AuditorError as AuditorErrorData } from '../types/index.js';
import { AuditorErrorSchema } from '../types/index.js';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    retryableCodes: ['BROWSER_PROVIDER_UNAVAILABLE', 'TIMEOUT'] as AuditorErrorCode[]
};

/**
 * Retry configuration options
 */
export interface RetryConfig {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Base delay in milliseconds for exponential backoff */
    baseDelayMs: number;
    /** Maximum delay in milliseconds */
    maxDelayMs: number;
    /** Error codes that are eligible for retry */
    retryableCodes: AuditorErrorCode[];
}

/**
 * AuditorErrorClass
 * 
 * Custom error class for the Auditor Agent that provides structured error information.
 * Extends the native Error class to maintain stack trace compatibility.
 * 
 * Requirements: 7.4
 */
export class AuditorErrorClass extends Error {
    /** Error code from the AuditorErrorCode enum */
    readonly code: AuditorErrorCode;
    /** Additional error details */
    readonly details: Record<string, unknown> | undefined;

    constructor(
        code: AuditorErrorCode,
        message: string,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AuditorError';
        this.code = code;
        this.details = details;

        // Maintains proper stack trace for where error was thrown (V8 engines)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AuditorErrorClass);
        }
    }

    /**
     * Converts the error to a plain object conforming to AuditorErrorData
     */
    toJSON(): AuditorErrorData {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            stack: this.stack
        };
    }

    /**
     * Validates that the error conforms to the AuditorError schema
     */
    validate(): boolean {
        const result = AuditorErrorSchema.safeParse(this.toJSON());
        return result.success;
    }

    /**
     * Creates an AuditorErrorClass from a plain object
     */
    static fromJSON(data: AuditorErrorData): AuditorErrorClass {
        const error = new AuditorErrorClass(data.code, data.message, data.details);
        if (data.stack) {
            error.stack = data.stack;
        }
        return error;
    }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Creates a BROWSER_LAUNCH_FAILED error
 * 
 * Requirement 7.1: IF the Headless_Browser fails to launch, THEN THE Auditor 
 * SHALL return an error with code "BROWSER_LAUNCH_FAILED"
 */
export function createBrowserLaunchFailedError(
    message: string = 'Failed to launch headless browser',
    details?: Record<string, unknown>
): AuditorErrorClass {
    return new AuditorErrorClass('BROWSER_LAUNCH_FAILED', message, details);
}

/**
 * Creates a BROWSER_PROVIDER_UNAVAILABLE error
 * 
 * Requirement 8.5: IF the Browser_Provider connection fails, THEN THE Auditor 
 * SHALL return an error with code "BROWSER_PROVIDER_UNAVAILABLE"
 */
export function createBrowserProviderUnavailableError(
    message: string = 'Browser provider is unavailable',
    details?: Record<string, unknown>
): AuditorErrorClass {
    return new AuditorErrorClass('BROWSER_PROVIDER_UNAVAILABLE', message, details);
}

/**
 * Creates an AXE_INJECTION_FAILED error
 * 
 * Requirement 7.2: IF axe-core injection fails, THEN THE Auditor 
 * SHALL return an error with code "AXE_INJECTION_FAILED"
 */
export function createAxeInjectionFailedError(
    message: string = 'Failed to inject axe-core into the page',
    details?: Record<string, unknown>
): AuditorErrorClass {
    return new AuditorErrorClass('AXE_INJECTION_FAILED', message, details);
}

/**
 * Creates an AUTOMATION_BLOCKED error
 * 
 * Requirement 7.3: IF the target page blocks automation, THEN THE Auditor 
 * SHALL return an error with code "AUTOMATION_BLOCKED"
 */
export function createAutomationBlockedError(
    message: string = 'Target page blocked automation',
    details?: Record<string, unknown>
): AuditorErrorClass {
    return new AuditorErrorClass('AUTOMATION_BLOCKED', message, details);
}

/**
 * Creates a URL_UNREACHABLE error
 * 
 * Requirement 1.4: IF the URL is unreachable or returns an error status, 
 * THEN THE Auditor SHALL return an error response with the HTTP status code and reason
 */
export function createUrlUnreachableError(
    url: string,
    statusCode?: number,
    reason?: string
): AuditorErrorClass {
    const message = statusCode
        ? `URL unreachable: ${url} (HTTP ${statusCode}: ${reason ?? 'Unknown error'})`
        : `URL unreachable: ${url}`;

    return new AuditorErrorClass('URL_UNREACHABLE', message, {
        url,
        statusCode,
        reason
    });
}

/**
 * Creates a TIMEOUT error
 * 
 * Requirement 1.5: IF the page load exceeds 30 seconds, THEN THE Auditor 
 * SHALL timeout and return a timeout error
 */
export function createTimeoutError(
    url: string,
    timeoutMs: number = 30000
): AuditorErrorClass {
    return new AuditorErrorClass(
        'TIMEOUT',
        `Page load exceeded ${timeoutMs}ms timeout for URL: ${url}`,
        { url, timeoutMs }
    );
}

/**
 * Creates an ELEMENT_NOT_FOUND error
 * 
 * Requirement 4.4: IF the selector does not match any element, THEN THE Auditor 
 * SHALL return an error indicating the element was not found
 */
export function createElementNotFoundError(
    selector: string,
    details?: Record<string, unknown>
): AuditorErrorClass {
    return new AuditorErrorClass(
        'ELEMENT_NOT_FOUND',
        `Element not found for selector: ${selector}`,
        { selector, ...details }
    );
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Calculates the delay for exponential backoff
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

    // Add jitter (±10% randomization) to prevent thundering herd
    const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);

    // Clamp to maxDelay
    return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Checks if an error is retryable based on its code
 * 
 * @param error - The error to check
 * @param config - Retry configuration
 * @returns true if the error is retryable
 */
export function isRetryableError(error: unknown, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
    if (error instanceof AuditorErrorClass) {
        return config.retryableCodes.includes(error.code);
    }
    return false;
}

/**
 * Sleeps for the specified duration
 * 
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a function with retry logic using exponential backoff
 * 
 * @param fn - The async function to execute
 * @param config - Retry configuration (optional, uses defaults)
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: unknown;

    for (let attempt = 0; attempt < fullConfig.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if we should retry
            const isLastAttempt = attempt === fullConfig.maxAttempts - 1;
            const shouldRetry = !isLastAttempt && isRetryableError(error, fullConfig);

            if (!shouldRetry) {
                throw error;
            }

            // Wait before retrying
            const delay = calculateBackoffDelay(attempt, fullConfig);
            await sleep(delay);
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
}

/**
 * Wraps an unknown error into an AuditorErrorClass
 * 
 * @param error - The error to wrap
 * @param defaultCode - Default error code if the error is not an AuditorErrorClass
 * @returns An AuditorErrorClass instance
 */
export function wrapError(
    error: unknown,
    defaultCode: AuditorErrorCode = 'BROWSER_LAUNCH_FAILED'
): AuditorErrorClass {
    if (error instanceof AuditorErrorClass) {
        return error;
    }

    if (error instanceof Error) {
        const message = error.message || 'An unknown error occurred';
        return new AuditorErrorClass(defaultCode, message, {
            originalError: error.name,
            stack: error.stack
        });
    }

    // Convert to string and ensure non-empty message
    const stringValue = String(error);
    const message = stringValue.trim() || 'An unknown error occurred';
    return new AuditorErrorClass(defaultCode, message);
}
