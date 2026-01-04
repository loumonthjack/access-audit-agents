/**
 * Health indicator component for displaying API connectivity status
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { clsx } from 'clsx';
import { useHealthCheck, type HealthStatus } from '@/shared/hooks/useHealthCheck';
import { Button } from '../ui/Button';

export interface HealthIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the environment name */
  showEnvironment?: boolean;
  /** Whether to show as a compact indicator (icon only) */
  compact?: boolean;
  /** Callback when retry is clicked */
  onRetry?: () => void;
}

/**
 * Status indicator dot colors
 */
const statusColors: Record<HealthStatus, string> = {
  checking: 'bg-warning-400 animate-pulse',
  healthy: 'bg-success-500',
  unhealthy: 'bg-warning-500',
  error: 'bg-error-500',
};

/**
 * Status labels for accessibility
 */
const statusLabels: Record<HealthStatus, string> = {
  checking: 'Checking connection...',
  healthy: 'Connected',
  unhealthy: 'Service degraded',
  error: 'Connection failed',
};

/**
 * Environment badge colors
 */
const environmentColors: Record<string, string> = {
  development: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  staging: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  production: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

/**
 * Health indicator component that displays API connectivity status
 * and current environment
 *
 * @example
 * ```tsx
 * // Full indicator with environment
 * <HealthIndicator showEnvironment />
 *
 * // Compact indicator (icon only)
 * <HealthIndicator compact />
 * ```
 */
export function HealthIndicator({
  className,
  showEnvironment = true,
  compact = false,
  onRetry,
}: HealthIndicatorProps) {
  const { status, apiEnvironment, localEnvironment, error, checkHealth, isChecking } =
    useHealthCheck();

  const displayEnvironment = apiEnvironment || localEnvironment;
  const envColorClass = environmentColors[displayEnvironment] || environmentColors.development;

  const handleRetry = () => {
    checkHealth();
    onRetry?.();
  };

  // Compact mode - just show a status dot
  if (compact) {
    return (
      <div
        className={clsx('flex items-center gap-2', className)}
        role="status"
        aria-label={statusLabels[status]}
      >
        <span className={clsx('h-2 w-2 rounded-full', statusColors[status])} aria-hidden="true" />
        {showEnvironment && (
          <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded border', envColorClass)}>
            {displayEnvironment}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-lg',
        'bg-neutral-800/50 border border-neutral-700/50',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <span
          className={clsx('h-2.5 w-2.5 rounded-full', statusColors[status])}
          aria-hidden="true"
        />
        <span className="text-sm text-neutral-300">{statusLabels[status]}</span>
      </div>

      {/* Environment badge */}
      {showEnvironment && (
        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded border', envColorClass)}>
          {displayEnvironment}
        </span>
      )}

      {/* Error details and retry button */}
      {status === 'error' && (
        <div className="flex items-center gap-2 ml-auto">
          {error && (
            <span className="text-xs text-error-400 max-w-[200px] truncate" title={error}>
              {error}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            disabled={isChecking}
            className="text-xs"
          >
            {isChecking ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact health status dot for use in headers or tight spaces
 */
export function HealthStatusDot({ className }: { className?: string }) {
  const { status } = useHealthCheck({ checkOnMount: false });

  return (
    <span
      className={clsx('h-2 w-2 rounded-full', statusColors[status], className)}
      role="status"
      aria-label={statusLabels[status]}
    />
  );
}
