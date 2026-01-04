/**
 * BatchSessionCard component
 * Displays a single batch scan session with status, progress, and summary
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import type { BatchSession, BatchStatus } from '@/types/domain';

interface BatchSessionCardProps {
    session: BatchSession;
    onView: (batchId: string) => void;
}

/**
 * Format a date string to a human-readable format
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format a date string to a short format for mobile
 */
function formatDateShort(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Get badge variant based on batch status
 */
function getStatusVariant(
    status: BatchStatus
): 'default' | 'primary' | 'success' | 'warning' | 'error' {
    switch (status) {
        case 'completed':
            return 'success';
        case 'running':
            return 'primary';
        case 'paused':
            return 'warning';
        case 'error':
            return 'error';
        case 'cancelled':
        case 'pending':
        default:
            return 'default';
    }
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: BatchStatus): string {
    switch (status) {
        case 'completed':
            return 'Completed';
        case 'running':
            return 'Running';
        case 'paused':
            return 'Paused';
        case 'error':
            return 'Error';
        case 'cancelled':
            return 'Cancelled';
        case 'pending':
            return 'Pending';
        default:
            return status;
    }
}

/**
 * Get display title from batch session
 */
function getDisplayTitle(session: BatchSession): string {
    if (session.name) {
        return session.name;
    }
    if (session.sitemapUrl) {
        try {
            const url = new URL(session.sitemapUrl);
            return `${url.hostname}${url.pathname}`;
        } catch {
            return session.sitemapUrl;
        }
    }
    return `Batch Scan ${session.id.slice(0, 8)}`;
}

/**
 * BatchSessionCard component
 */
export function BatchSessionCard({ session, onView }: BatchSessionCardProps) {
    const { id, status, totalPages, completedPages, failedPages, totalViolations, createdAt } = session;
    const title = getDisplayTitle(session);

    return (
        <Card className="group relative border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-lg transition-all duration-300 rounded-2xl overflow-hidden">
            {/* Subtle shadow overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-50/0 to-neutral-50/0 group-hover:from-neutral-50/50 group-hover:to-neutral-50/50 transition-all duration-300" />

            <div className="relative flex flex-col gap-4">
                {/* Top row: Status, Date, Actions */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={getStatusVariant(status)} size="sm" className="font-medium">
                            {getStatusLabel(status)}
                        </Badge>
                        <span className="text-sm text-neutral-600 hidden sm:inline font-mono">
                            {formatDate(createdAt)}
                        </span>
                        <span className="text-xs text-neutral-500 sm:hidden font-mono">
                            {formatDateShort(createdAt)}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onView(id)}
                            aria-label={`View batch scan for ${title}`}
                            className="px-4 py-2 bg-neutral-800 hover:bg-primary-600 text-white border-neutral-700 hover:border-primary-500 transition-all duration-200 rounded-xl"
                        >
                            <ViewIcon className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">View</span>
                        </Button>
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-medium text-neutral-900 truncate group-hover:text-black transition-colors">
                    {title}
                </h3>

                {/* Progress and Stats */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
                    {/* Pages progress */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200">
                        <PagesIcon className="h-4 w-4 text-neutral-500" />
                        <span className="text-neutral-600">
                            {completedPages} of {totalPages} pages
                        </span>
                    </div>

                    {/* Failed pages */}
                    {failedPages > 0 && (
                        <Badge variant="error" size="sm" className="shadow-lg shadow-error-500/20">
                            {failedPages} failed
                        </Badge>
                    )}

                    {/* Violations count */}
                    {totalViolations > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning-50 border border-warning-200">
                            <WarningIcon className="h-4 w-4 text-warning-600" />
                            <span className="font-semibold text-warning-700">
                                {totalViolations} violations
                            </span>
                        </div>
                    )}

                    {/* Success indicator for completed with no violations */}
                    {status === 'completed' && totalViolations === 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-50 border border-success-200">
                            <CheckIcon className="h-4 w-4 text-success-600" />
                            <span className="font-semibold text-success-600">
                                No violations
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}

/**
 * View icon component
 */
function ViewIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            <path
                fillRule="evenodd"
                d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/**
 * Pages icon component
 */
function PagesIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
        </svg>
    );
}

/**
 * Warning icon component
 */
function WarningIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/**
 * Check icon component
 */
function CheckIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
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
    );
}
