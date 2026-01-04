/**
 * Scan page component
 * Real-time violation tracking with completion modal
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { ViolationList } from '@/features/scan/components/ViolationList';
import { ProgressIndicator } from '@/features/scan/components/ProgressIndicator';
import { ScanCompleteModal } from '@/features/scan/components/ScanCompleteModal';
import { useScanSession } from '@/features/scan/hooks/useScanSession';
import { FullPageLoader } from '@/shared/components/feedback/LoadingSpinner';
import { ErrorFallback } from '@/shared/components/layout/ErrorBoundary';
import { Badge } from '@/shared/components/ui/Badge';

/**
 * Scan page with real-time updates
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export function ScanPage() {
  const { sessionId } = useParams({ from: '/scan/$sessionId' });
  const navigate = useNavigate();
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const { session, violations, currentViolationId, status, isConnected, error } = useScanSession({
    sessionId,
    onComplete: () => {
      setShowCompleteModal(true);
    },
  });

  const handleViewReport = () => {
    setShowCompleteModal(false);
    navigate({
      to: '/report/$sessionId',
      params: { sessionId },
    });
  };

  // Loading state
  if (!session && !error) {
    return <FullPageLoader label="Loading scan session..." />;
  }

  // Error state
  if (error && !session) {
    return (
      <ErrorFallback
        title="Failed to load scan"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Scan Results</h1>
            <StatusBadge status={status} />
          </div>
          <div className="flex items-center gap-2">
            <ConnectionIndicator isConnected={isConnected} />
            {status === 'complete' && (
              <Button
                size="sm"
                onClick={() =>
                  navigate({
                    to: '/report/$sessionId',
                    params: { sessionId },
                  })
                }
              >
                View Report
              </Button>
            )}
          </div>
        </div>
        {session && (
          <p className="text-sm sm:text-base text-neutral-600 break-all">
            <a
              href={session.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              {session.url}
            </a>
          </p>
        )}
      </div>

      {/* Progress indicator */}
      <ProgressIndicator
        session={session}
        violations={violations}
        currentViolationId={currentViolationId}
      />

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-error-50 border border-error-200 p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <svg
              className="h-5 w-5 text-error-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-error-800">Error during scan</h3>
              <p className="mt-1 text-xs sm:text-sm text-error-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Violations list */}
      <Card>
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            Detected Violations
            <Badge variant="default">{violations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <ViolationList violations={violations} currentViolationId={currentViolationId} />
        </CardContent>
      </Card>

      {/* Scan complete modal */}
      {session && (
        <ScanCompleteModal
          isOpen={showCompleteModal}
          session={session}
          onViewReport={handleViewReport}
          onClose={() => setShowCompleteModal(false)}
        />
      )}
    </div>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    { variant: 'default' | 'primary' | 'success' | 'warning' | 'error'; label: string }
  > = {
    pending: { variant: 'default', label: 'Pending' },
    scanning: { variant: 'primary', label: 'Scanning' },
    remediating: { variant: 'warning', label: 'Fixing' },
    complete: { variant: 'success', label: 'Complete' },
    error: { variant: 'error', label: 'Error' },
  };

  const config = variants[status] ?? { variant: 'default' as const, label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

/**
 * Connection indicator component
 */
function ConnectionIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
      <span
        className={`relative h-2.5 w-2.5 rounded-full transition-colors ${
          isConnected ? 'bg-success-500' : 'bg-neutral-300'
        }`}
        aria-hidden="true"
      >
        {isConnected && (
          <span className="absolute inset-0 rounded-full bg-success-500 animate-ping opacity-75" />
        )}
      </span>
      <span className="text-neutral-600 font-medium">{isConnected ? 'Live' : 'Connecting...'}</span>
    </div>
  );
}

export default ScanPage;
