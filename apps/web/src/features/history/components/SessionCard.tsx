/**
 * SessionCard component
 * Displays a single scan session with URL, date, violation counts, and status
 * Requirements: 6.2
 */
import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import type { SessionCardProps } from '../types';

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
 * Get badge variant based on session status
 */
function getStatusVariant(status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'complete':
      return 'success';
    case 'scanning':
    case 'remediating':
      return 'primary';
    case 'error':
      return 'error';
    case 'pending':
    default:
      return 'default';
  }
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'scanning':
      return 'Scanning';
    case 'remediating':
      return 'Remediating';
    case 'error':
      return 'Error';
    case 'pending':
      return 'Pending';
    default:
      return status;
  }
}

/**
 * SessionCard component
 * Requirements: 6.2
 */
export function SessionCard({ session, onView, onDelete }: SessionCardProps) {
  const { id, url, status, createdAt, violationCounts, fixCounts } = session;

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
              aria-label={`View session for ${url}`}
              className="px-4 py-2 bg-neutral-800 hover:bg-primary-600 text-white border-neutral-700 hover:border-primary-500 transition-all duration-200 rounded-xl"
            >
              <ViewIcon className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">View</span>
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(id)}
                aria-label={`Delete session for ${url}`}
                className="px-2 hover:bg-error-50 rounded-xl transition-colors"
              >
                <TrashIcon className="h-4 w-4 text-neutral-500 hover:text-error-600 transition-colors" />
              </Button>
            )}
          </div>
        </div>

        {/* URL */}
        <h3 className="text-base sm:text-lg font-medium text-neutral-900 truncate group-hover:text-black transition-colors">
          {url}
        </h3>

        {/* Violation Counts - responsive layout */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
          {violationCounts?.total !== undefined && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200">
              <span className="text-neutral-600">Violations:</span>
              <span className="font-semibold text-neutral-900">{violationCounts.total}</span>
            </div>
          )}
          {violationCounts?.critical > 0 && (
            <Badge variant="critical" size="sm" className="shadow-lg shadow-error-500/20">
              {violationCounts.critical} critical
            </Badge>
          )}
          {violationCounts?.serious > 0 && (
            <Badge variant="serious" size="sm" className="shadow-lg shadow-warning-500/20">
              {violationCounts.serious} serious
            </Badge>
          )}
          {status === 'complete' && fixCounts?.fixed !== undefined && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-50 border border-success-200">
              <svg className="h-4 w-4 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-semibold text-success-600">{fixCounts.fixed} fixed</span>
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
 * Trash icon component
 */
function TrashIcon({ className }: { className?: string }) {
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
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}
