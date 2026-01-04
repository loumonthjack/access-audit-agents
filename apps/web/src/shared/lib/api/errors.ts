/**
 * API Error classes for handling different error scenarios
 * Transforms HTTP errors into user-friendly messages
 */

/**
 * Base API error class with user-friendly message support
 */
export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly userMessage: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ApiError';
    }

    /**
     * Check if error is a network/connection error
     */
    isNetworkError(): boolean {
        return this.status === 0;
    }

    /**
     * Check if error is an authentication error
     */
    isAuthError(): boolean {
        return this.status === 401;
    }

    /**
     * Check if error is a forbidden error
     */
    isForbiddenError(): boolean {
        return this.status === 403;
    }

    /**
     * Check if error is a not found error
     */
    isNotFoundError(): boolean {
        return this.status === 404;
    }

    /**
     * Check if error is a server error
     */
    isServerError(): boolean {
        return this.status >= 500;
    }
}

/**
 * Network error when API is unreachable
 */
export class NetworkError extends ApiError {
    constructor(message = 'Network error') {
        super(
            0,
            'NETWORK_ERROR',
            message,
            'Unable to connect to the server. Please check your internet connection and try again.'
        );
        this.name = 'NetworkError';
    }
}

/**
 * Authentication error (401)
 */
export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(401, 'UNAUTHORIZED', message, 'Your session has expired. Please log in again.');
        this.name = 'UnauthorizedError';
    }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(
            403,
            'FORBIDDEN',
            message,
            'You do not have permission to access this resource. Please contact your administrator.'
        );
        this.name = 'ForbiddenError';
    }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends ApiError {
    constructor(resource = 'Resource', message = 'Not found') {
        super(404, 'NOT_FOUND', message, `${resource} not found. It may have been deleted or moved.`);
        this.name = 'NotFoundError';
    }
}

/**
 * Validation error (400)
 */
export class ValidationError extends ApiError {
    constructor(
        message = 'Validation failed',
        details?: Record<string, unknown>
    ) {
        super(
            400,
            'VALIDATION_ERROR',
            message,
            'The request contains invalid data. Please check your input and try again.',
            details
        );
        this.name = 'ValidationError';
    }
}

/**
 * Server error (5xx)
 */
export class ServerError extends ApiError {
    constructor(status = 500, message = 'Server error') {
        super(
            status,
            'SERVER_ERROR',
            message,
            'Something went wrong on our end. Please try again later or contact support if the problem persists.'
        );
        this.name = 'ServerError';
    }
}

/**
 * Transform an HTTP response error into an appropriate ApiError
 */
export function createApiError(
    status: number,
    body?: { code?: string; message?: string; details?: Record<string, unknown> }
): ApiError {
    const message = body?.message || 'An error occurred';
    const code = body?.code || 'UNKNOWN_ERROR';
    const details = body?.details;

    switch (status) {
        case 400:
            return new ValidationError(message, details);
        case 401:
            return new UnauthorizedError(message);
        case 403:
            return new ForbiddenError(message);
        case 404:
            return new NotFoundError('Resource', message);
        case 500:
        case 502:
        case 503:
        case 504:
            return new ServerError(status, message);
        default:
            return new ApiError(
                status,
                code,
                message,
                'An unexpected error occurred. Please try again.',
                details
            );
    }
}
