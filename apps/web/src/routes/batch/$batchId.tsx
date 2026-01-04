/**
 * Batch scan progress page
 * Displays real-time progress of a batch scan
 * Requirements: 8.3, 9.1
 */
import { useParams, useNavigate } from '@tanstack/react-router';
import { Button } from '@/shared/components/ui/Button';
import { BatchProgress } from '@/features/batch-scan/components/BatchProgress';
import { useBatchScan } from '@/features/batch-scan/api/batchApi';
import { FullPageLoader } from '@/shared/components/feedback/LoadingSpinner';
import { ErrorFallback } from '@/shared/components/layout/ErrorBoundary';

/**
 * Back arrow icon
 */
function BackIcon() {
  return (
    <svg
      className="h-4 w-4 sm:h-5 sm:w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );
}

/**
 * Batch scan progress page
 * Requirements: 8.3, 9.1
 */
export function BatchProgressPage() {
  const { batchId } = useParams({ from: '/batch/$batchId' });
  const navigate = useNavigate();

  const { data: batch, isLoading, error, refetch } = useBatchScan(batchId);

  // Handle navigation to report when complete
  const handleComplete = () => {
    navigate({
      to: '/batch/$batchId/report',
      params: { batchId },
    });
  };

  // Loading state
  if (isLoading && !batch) {
    return <FullPageLoader label="Loading batch scan..." />;
  }

  // Error state
  if (error && !batch) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorFallback
          title="Failed to load batch scan"
          message={error instanceof Error ? error.message : 'The batch scan could not be found.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const isComplete = batch?.status === 'completed';
  const isCancelled = batch?.status === 'cancelled';
  const isError = batch?.status === 'error';
  const isFinished = isComplete || isCancelled || isError;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/batch' })}
            leftIcon={<BackIcon />}
          >
            <span className="hidden sm:inline">Back to Batch Scan</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
        {isFinished && (
          <div className="flex gap-2">
            {isComplete && (
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  navigate({
                    to: '/batch/$batchId/report',
                    params: { batchId },
                  })
                }
              >
                View Report
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate({ to: '/batch' })}>
              Start New Batch
            </Button>
          </div>
        )}
      </div>

      {/* Page title */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Batch Scan Progress</h1>
        {batch?.name && <p className="text-neutral-400">{batch.name}</p>}
      </div>

      {/* Progress component */}
      <BatchProgress batchId={batchId} onComplete={handleComplete} />

      {/* Completion message */}
      {isComplete && (
        <div className="rounded-2xl border border-success-500/30 bg-success-500/10 p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-500/20">
              <svg
                className="h-8 w-8 text-success-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Batch Scan Complete!</h2>
              <p className="text-neutral-400 mt-1">
                All pages have been scanned. View the report for detailed results.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() =>
                navigate({
                  to: '/batch/$batchId/report',
                  params: { batchId },
                })
              }
            >
              View Full Report
            </Button>
          </div>
        </div>
      )}

      {/* Cancelled message */}
      {isCancelled && (
        <div className="rounded-2xl border border-neutral-500/30 bg-neutral-500/10 p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-500/20">
              <svg
                className="h-8 w-8 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Batch Scan Cancelled</h2>
              <p className="text-neutral-400 mt-1">
                The batch scan was cancelled before completion.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate({ to: '/batch' })}>
              Start New Batch Scan
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {isError && (
        <div className="rounded-2xl border border-error-500/30 bg-error-500/10 p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-500/20">
              <svg
                className="h-8 w-8 text-error-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Batch Scan Error</h2>
              <p className="text-neutral-400 mt-1">An error occurred during the batch scan.</p>
            </div>
            <Button variant="secondary" onClick={() => navigate({ to: '/batch' })}>
              Start New Batch Scan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchProgressPage;
