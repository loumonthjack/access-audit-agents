/**
 * Scan feature types
 * Requirements: 1.1, 1.2, 1.4, 2.1
 */
import type {
  Viewport,
  ScanSession,
  Violation,
  AppliedFix,
  RemediationReport,
} from '@/types/domain';
import type { ProgressEvent } from '@/types/events';

// Re-export domain types used in scan feature
export type { Viewport, ScanSession, Violation, AppliedFix, RemediationReport, ProgressEvent };

/**
 * State of the scan form
 * Requirements: 1.1, 1.4
 */
export interface ScanFormState {
  url: string;
  viewport: Viewport;
}

/**
 * Props for the ScanForm component
 */
export interface ScanFormProps {
  onSubmit: (url: string, viewport: Viewport) => void;
  isLoading: boolean;
  error?: string;
}

/**
 * Options for the useScanSession hook
 * Requirements: 2.1
 */
export interface UseScanSessionOptions {
  sessionId: string;
  onViolationDetected?: (violation: Violation) => void;
  onFixApplied?: (fix: AppliedFix) => void;
  onComplete?: (report: RemediationReport) => void;
  onError?: (error: string) => void;
}

/**
 * Return type for the useScanSession hook
 */
export interface UseScanSessionReturn {
  session: ScanSession | undefined;
  violations: Violation[];
  currentViolationId: string | null;
  status: ScanSession['status'];
  isConnected: boolean;
  error: string | null;
}
