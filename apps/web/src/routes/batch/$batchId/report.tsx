/**
 * Batch scan report page
 * Displays comprehensive report for a completed batch scan
 * Requirements: 10.1, 10.2
 */
import { useParams, useNavigate } from '@tanstack/react-router';
import { Button } from '@/shared/components/ui/Button';
import { BatchReport } from '@/features/batch-scan/components/BatchReport';
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
 * Batch scan report page
 * Requirements: 10.1, 10.2
 */
export function BatchReportPage() {
  const { batchId } = useParams({ from: '/batch/$batchId/report' });
  const navigate = useNavigate();

  const { data: batch, isLoading, error, refetch } = useBatchScan(batchId);

  // Loading state
  if (isLoading && !batch) {
    return <FullPageLoader label="Loading batch report..." />;
  }

  // Error state
  if (error && !batch) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorFallback
          title="Failed to load batch report"
          message={error instanceof Error ? error.message : 'The batch report could not be found.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Check if batch is complete
  const isComplete = batch?.status === 'completed';
  if (batch && !isComplete) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-warning-500/30 bg-warning-500/10 p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-500/20">
              <svg
                className="h-8 w-8 text-warning-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Batch Scan In Progress</h2>
              <p className="text-neutral-400 mt-1">
                The report will be available once the batch scan is complete.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() =>
                navigate({
                  to: '/batch/$batchId',
                  params: { batchId },
                })
              }
            >
              View Progress
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header with navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/batch' })}
          leftIcon={<BackIcon />}
          className="self-start"
        >
          <span className="hidden sm:inline">Back to Batch Scan</span>
          <span className="sm:hidden">Back</span>
        </Button>
      </div>

      {/* Report content */}
      <BatchReport batchId={batchId} />

      {/* Bottom navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-neutral-700 pt-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate({ to: '/history' })}
          className="w-full sm:w-auto"
        >
          View All Scans
        </Button>
        <Button size="sm" onClick={() => navigate({ to: '/batch' })} className="w-full sm:w-auto">
          Start New Batch Scan
        </Button>
      </div>
    </div>
  );
}

export default BatchReportPage;
