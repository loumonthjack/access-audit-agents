/**
 * ProgressIndicator component - Shows current violation being processed and progress percentage
 * Requirements: 2.4
 */
import { useMemo } from 'react';
import { clsx } from 'clsx';
import type { Violation, ScanSession } from '@/types/domain';

export interface ProgressIndicatorProps {
  /** Current session data */
  session?: ScanSession;
  /** List of violations */
  violations: Violation[];
  /** ID of the violation currently being processed */
  currentViolationId?: string | null;
}

/**
 * Calculate progress percentage based on fix counts
 */
function calculateProgress(session?: ScanSession): number {
  if (!session?.violationCounts || !session?.fixCounts) return 0;

  const { fixCounts, violationCounts } = session;
  const total = violationCounts?.total ?? 0;

  if (total === 0) return 0;

  const processed = (fixCounts?.fixed ?? 0) + (fixCounts?.skipped ?? 0);
  return Math.round((processed / total) * 100);
}

/**
 * Get status message based on session status
 */
function getStatusMessage(session?: ScanSession): string {
  if (!session) return 'Initializing...';

  switch (session.status) {
    case 'pending':
      return 'Preparing scan...';
    case 'scanning':
      return 'Scanning for violations...';
    case 'remediating':
      return 'Fixing violations...';
    case 'complete':
      return 'Scan complete!';
    case 'error':
      return 'An error occurred';
    default:
      return 'Processing...';
  }
}

/**
 * ProgressIndicator component
 * Requirements: 2.4
 */
export function ProgressIndicator({
  session,
  violations,
  currentViolationId,
}: ProgressIndicatorProps) {
  const progress = useMemo(() => calculateProgress(session), [session]);
  const statusMessage = useMemo(() => getStatusMessage(session), [session]);

  const currentViolation = useMemo(
    () => violations.find((v) => v.id === currentViolationId),
    [violations, currentViolationId]
  );

  const isComplete = session?.status === 'complete';
  const isError = session?.status === 'error';

  return (
    <div className="rounded-lg border bg-white p-3 sm:p-4 shadow-sm">
      {/* Status header */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          {!isComplete && !isError && (
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-primary-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {isComplete && (
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-success-700"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {isError && (
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-error-600"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span
            className={clsx(
              'text-sm sm:text-base font-medium',
              isComplete && 'text-success-700',
              isError && 'text-error-700',
              !isComplete && !isError && 'text-neutral-900'
            )}
          >
            {statusMessage}
          </span>
        </div>
        <span className="text-sm font-medium text-neutral-600">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 bg-neutral-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Scan progress"
      >
        <div
          className={clsx(
            'h-full transition-all duration-300 ease-out',
            isComplete && 'bg-success-500',
            isError && 'bg-error-500',
            !isComplete && !isError && 'bg-primary-500'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current violation being processed */}
      {currentViolation && !isComplete && !isError && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-neutral-100">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
            Currently processing
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
              {currentViolation.ruleId}
            </code>
            <span className="text-xs sm:text-sm text-neutral-700 truncate">
              {currentViolation.description}
            </span>
          </div>
        </div>
      )}

      {/* Summary stats - responsive grid */}
      {session && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-neutral-100 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
          <div>
            <span className="text-neutral-500">Total: </span>
            <span className="font-medium">{session.violationCounts?.total}</span>
          </div>
          <div>
            <span className="text-success-700">Fixed: </span>
            <span className="font-medium">{session.fixCounts?.fixed}</span>
          </div>
          <div>
            <span className="text-error-600">Skipped: </span>
            <span className="font-medium">{session.fixCounts?.skipped}</span>
          </div>
          <div>
            <span className="text-neutral-500">Pending: </span>
            <span className="font-medium">{session.fixCounts?.pending}</span>
          </div>
        </div>
      )}
    </div>
  );
}
