/**
 * API response types
 * Requirements: 6.5, 10.1
 */
import type { ScanSession, RemediationReport, Violation } from './domain';

// ============================================================================
// Pagination Types
// Requirements: 6.5
// ============================================================================

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Generic paginated response wrapper
 * Requirements: 6.5
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ============================================================================
// Error Types
// Requirements: 10.1
// ============================================================================

/**
 * Standard API error structure
 * Requirements: 10.1
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * HTTP error codes with user-friendly messages
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';

/**
 * Extended API error with additional context
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  statusCode: number;
  timestamp: string;
  requestId?: string;
}

// ============================================================================
// Generic Response Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Successful API response
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

// ============================================================================
// Specific Response Types
// ============================================================================

/**
 * Response for starting a new scan
 * Requirements: 1.1
 */
export type StartScanResponse = ApiResponse<ScanSession>;

/**
 * Response for getting a single session
 */
export type GetSessionResponse = ApiResponse<ScanSession>;

/**
 * Response for listing sessions with pagination
 * Requirements: 6.5
 */
export type ListSessionsResponse = PaginatedResponse<ScanSession>;

/**
 * Response for getting a remediation report
 * Requirements: 5.1
 */
export type GetReportResponse = ApiResponse<RemediationReport>;

/**
 * Response for getting violations for a session
 */
export type GetViolationsResponse = ApiResponse<Violation[]>;

/**
 * Response for deleting a session
 * Requirements: 6.4
 */
export type DeleteSessionResponse = ApiResponse<{ deleted: boolean }>;

/**
 * Response for exporting a report
 * Requirements: 5.5
 */
export interface ExportReportResponse {
  blob: Blob;
  filename: string;
  contentType: string;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request body for starting a scan
 * Requirements: 1.1
 */
export interface StartScanRequest {
  url: string;
  viewport: 'mobile' | 'desktop';
}

/**
 * Query parameters for listing sessions
 * Requirements: 6.5
 */
export interface ListSessionsParams {
  page?: number;
  limit?: number;
}

/**
 * Request for exporting a report
 * Requirements: 5.5
 */
export interface ExportReportRequest {
  sessionId: string;
  format: 'json' | 'html';
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return response.success === false && response.error !== undefined;
}
