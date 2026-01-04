/**
 * Report page component
 * Displays remediation report with export functionality
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
import { useParams, useNavigate } from '@tanstack/react-router';
import { Button } from '@/shared/components/ui/Button';
import { ReportView } from '@/features/report/components/ReportView';
import { ExportButtons } from '@/features/report/components/ExportButtons';
import { useReport } from '@/features/report/hooks/useReport';
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
 * Report page with full report view and export options
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export function ReportPage() {
  const { sessionId } = useParams({ from: '/report/$sessionId' });
  const navigate = useNavigate();

  const { report, isLoading, isError, error, refetch } = useReport({
    sessionId,
  });

  // Loading state
  if (isLoading) {
    return <FullPageLoader label="Loading report..." />;
  }

  // Error state
  if (isError || !report) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorFallback
          title="Failed to load report"
          message={error?.message ?? 'The report could not be found.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
      {/* Header with navigation and export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/history' })}
          leftIcon={<BackIcon />}
          className="self-start"
        >
          <span className="hidden sm:inline">Back to History</span>
          <span className="sm:hidden">Back</span>
        </Button>
        <ExportButtons sessionId={sessionId} />
      </div>

      {/* Report content */}
      <ReportView report={report} />

      {/* Bottom navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-neutral-200 pt-4 sm:pt-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate({ to: '/history' })}
          className="w-full sm:w-auto"
        >
          View All Scans
        </Button>
        <Button size="sm" onClick={() => navigate({ to: '/' })} className="w-full sm:w-auto">
          Start New Scan
        </Button>
      </div>
    </div>
  );
}

export default ReportPage;
