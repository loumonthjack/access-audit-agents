/**
 * History page component
 * SessionList with pagination and delete functionality
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/Card';
import { SessionList } from '@/features/history/components/SessionList';
import { Pagination } from '@/features/history/components/Pagination';
import { DeleteConfirmDialog } from '@/features/history/components/DeleteConfirmDialog';
import { useSessionHistory } from '@/features/history/hooks/useSessionHistory';
import { useDeleteSession } from '@/features/history/hooks/useDeleteSession';
import { ErrorFallback } from '@/shared/components/layout/ErrorBoundary';
import type { ScanSession } from '@/types/domain';

const SESSIONS_PER_PAGE = 10;

/**
 * History page with session list and pagination
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function HistoryPage() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ScanSession | null>(null);

  const { data, isLoading, isError, error, refetch } = useSessionHistory({
    page: currentPage,
    limit: SESSIONS_PER_PAGE,
  });

  const deleteMutation = useDeleteSession();

  const handleView = (sessionId: string) => {
    navigate({ to: '/report/$sessionId', params: { sessionId } });
  };

  const handleDeleteClick = (sessionId: string) => {
    const session = data?.data.find((s) => s.id === sessionId);
    if (session) {
      setDeleteTarget(session);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id, {
        onSuccess: () => {
          setDeleteTarget(null);
          // If we deleted the last item on the page, go back a page
          if (data?.data.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
          }
        },
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Error state
  if (isError) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorFallback
          title="Failed to load history"
          message={error?.message ?? 'An error occurred while loading scan history.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const sessions = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const totalItems = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Scan History</h1>
          <p className="mt-1 text-sm sm:text-base text-neutral-600">
            {totalItems > 0
              ? `${totalItems} scan${totalItems === 1 ? '' : 's'} total`
              : 'No scans yet'}
          </p>
        </div>
      </div>

      {/* Session list */}
      <Card padding="none">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="text-base sm:text-lg">Past Scans</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <SessionList
            sessions={sessions}
            onView={handleView}
            onDelete={handleDeleteClick}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        sessionUrl={deleteTarget?.url ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

export default HistoryPage;
