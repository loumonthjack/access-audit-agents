/**
 * SessionList component
 * Displays a list of SessionCards with empty state handling
 * Requirements: 6.1
 */
import { SessionCard } from './SessionCard';
import { NoDataEmptyState } from '@/shared/components/feedback/EmptyState';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import type { SessionListProps } from '../types';

/**
 * Loading skeleton for session cards
 */
function SessionCardSkeleton() {
    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-5 w-64" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-8" />
                </div>
            </div>
        </div>
    );
}

/**
 * SessionList component
 * Requirements: 6.1
 */
export function SessionList({
    sessions,
    onView,
    onDelete,
    isLoading = false,
}: SessionListProps) {
    // Show loading skeletons
    if (isLoading) {
        return (
            <div className="space-y-4" aria-busy="true" aria-label="Loading sessions">
                {Array.from({ length: 3 }).map((_, index) => (
                    <SessionCardSkeleton key={index} />
                ))}
            </div>
        );
    }

    // Show empty state when no sessions
    if (sessions.length === 0) {
        return (
            <NoDataEmptyState
                entityName="scan sessions"
                action={
                    <p className="text-sm text-neutral-500">
                        Start a new scan to see your session history here.
                    </p>
                }
            />
        );
    }

    // Render session list
    return (
        <div className="space-y-4" role="list" aria-label="Scan sessions">
            {sessions.map((session) => (
                <div key={session.id} role="listitem">
                    <SessionCard
                        session={session}
                        onView={onView}
                        onDelete={onDelete}
                    />
                </div>
            ))}
        </div>
    );
}
