/**
 * WebSocket event types for real-time progress streaming
 * Requirements: 2.1, 2.2, 2.3, 2.5, 9.1, 9.4, 9.6
 */
import type {
  ScanSession,
  Violation,
  AppliedFix,
  RemediationReport,
  BatchProgress,
  BatchSummary,
} from './domain';

/**
 * Event emitted when a scan session starts
 */
export interface SessionStartedEvent {
  type: 'session_started';
  session: ScanSession;
}

/**
 * Event emitted when a new violation is detected
 */
export interface ViolationDetectedEvent {
  type: 'violation_detected';
  violation: Violation;
}

/**
 * Event emitted when fix processing begins for a violation
 */
export interface FixStartedEvent {
  type: 'fix_started';
  violationId: string;
}

/**
 * Event emitted when a fix is successfully applied
 */
export interface FixAppliedEvent {
  type: 'fix_applied';
  violationId: string;
  fix: AppliedFix;
}

/**
 * Event emitted when a violation is skipped
 */
export interface FixSkippedEvent {
  type: 'fix_skipped';
  violationId: string;
  reason: string;
}

/**
 * Event emitted when the session completes
 */
export interface SessionCompleteEvent {
  type: 'session_complete';
  report: RemediationReport;
}

/**
 * Event emitted when an error occurs
 */
export interface ErrorEvent {
  type: 'error';
  message: string;
  recoverable: boolean;
}

/**
 * Union type of all possible progress events
 * Requirements: 2.1
 */
export type ProgressEvent =
  | SessionStartedEvent
  | ViolationDetectedEvent
  | FixStartedEvent
  | FixAppliedEvent
  | FixSkippedEvent
  | SessionCompleteEvent
  | ErrorEvent;

/**
 * All possible event types as a union
 */
export type ProgressEventType = ProgressEvent['type'];

/**
 * Helper type to extract event by type
 */
export type ExtractEvent<T extends ProgressEventType> = Extract<ProgressEvent, { type: T }>;

// ============================================================================
// Batch Scanning WebSocket Events
// Requirements: 9.1, 9.4, 9.6
// ============================================================================

/**
 * Event emitted when a batch scan starts
 */
export interface BatchStartedEvent {
  type: 'batch:started';
  batchId: string;
  totalPages: number;
}

/**
 * Event emitted when scanning begins for a page in the batch
 */
export interface BatchPageStartedEvent {
  type: 'batch:page_started';
  batchId: string;
  pageUrl: string;
  pageIndex: number;
}

/**
 * Event emitted when a page scan completes successfully
 */
export interface BatchPageCompleteEvent {
  type: 'batch:page_complete';
  batchId: string;
  pageUrl: string;
  violations: number;
  progress: BatchProgress;
}

/**
 * Event emitted when a page scan fails
 */
export interface BatchPageFailedEvent {
  type: 'batch:page_failed';
  batchId: string;
  pageUrl: string;
  error: string;
}

/**
 * Event emitted when a batch scan is paused
 */
export interface BatchPausedEvent {
  type: 'batch:paused';
  batchId: string;
}

/**
 * Event emitted when a batch scan is resumed
 */
export interface BatchResumedEvent {
  type: 'batch:resumed';
  batchId: string;
}

/**
 * Event emitted when a batch scan completes
 */
export interface BatchCompletedEvent {
  type: 'batch:completed';
  batchId: string;
  summary: BatchSummary;
}

/**
 * Event emitted when a batch scan is cancelled
 */
export interface BatchCancelledEvent {
  type: 'batch:cancelled';
  batchId: string;
}

/**
 * Event emitted when a batch scan encounters an error
 */
export interface BatchErrorEvent {
  type: 'batch:error';
  batchId: string;
  message: string;
}

/**
 * Union type of all batch progress events
 * Requirements: 9.1
 */
export type BatchProgressEvent =
  | BatchStartedEvent
  | BatchPageStartedEvent
  | BatchPageCompleteEvent
  | BatchPageFailedEvent
  | BatchPausedEvent
  | BatchResumedEvent
  | BatchCompletedEvent
  | BatchCancelledEvent
  | BatchErrorEvent;

/**
 * All possible batch event types as a union
 */
export type BatchProgressEventType = BatchProgressEvent['type'];

/**
 * Helper type to extract batch event by type
 */
export type ExtractBatchEvent<T extends BatchProgressEventType> = Extract<
  BatchProgressEvent,
  { type: T }
>;
