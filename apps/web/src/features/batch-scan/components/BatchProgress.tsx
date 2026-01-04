/**
 * BatchProgress component - Displays batch scan progress with controls
 * Requirements: 8.3, 8.4, 8.5, 8.6, 9.1
 */
import { useMemo } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/shared/components/ui/Button';
import { Card } from '@/shared/components/ui/Card';
import { useBatchProgress } from '../hooks/useBatchProgress';
import { usePauseBatchScan, useResumeBatchScan, useCancelBatchScan } from '../api/batchApi';
import type { BatchStatus } from '@/types/domain';

/**
 * Props for the BatchProgress component
 * Requirements: 8.3, 9.1
 */
export interface BatchProgressProps {
    /** Batch ID to display progress for */
    batchId: string;
    /** Callback when pause is clicked */
    onPause?: () => void;
    /** Callback when resume is clicked */
    onResume?: () => void;
    /** Callback when cancel is clicked */
    onCancel?: () => void;
    /** Callback when batch completes */
    onComplete?: () => void;
}

/**
 * Format seconds into human-readable time string
 */
function formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Calculating...';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s remaining`;
    }
    return `${secs}s remaining`;
}

/**
 * Get status display information
 */
function getStatusInfo(status: BatchStatus | undefined): {
    label: string;
    color: string;
    icon: 'spinner' | 'pause' | 'check' | 'x' | 'error';
} {
    switch (status) {
        case 'pending':
            return { label: 'Preparing...', color: 'text-neutral-600', icon: 'spinner' };
        case 'running':
            return { label: 'Scanning', color: 'text-primary-600', icon: 'spinner' };
        case 'paused':
            return { label: 'Paused', color: 'text-warning-600', icon: 'pause' };
        case 'completed':
            return { label: 'Completed', color: 'text-success-600', icon: 'check' };
        case 'cancelled':
            return { label: 'Cancelled', color: 'text-neutral-500', icon: 'x' };
        case 'error':
            return { label: 'Error', color: 'text-error-600', icon: 'error' };
        default:
            return { label: 'Unknown', color: 'text-neutral-500', icon: 'spinner' };
    }
}

/**
 * Status icon component
 */
function StatusIcon({ icon, className }: { icon: string; className?: string }) {
    switch (icon) {
        case 'spinner':
            return (
                <svg
                    className={clsx('animate-spin', className)}
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
            );
        case 'pause':
            return (
                <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                    />
                </svg>
            );
        case 'check':
            return (
                <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                        clipRule="evenodd"
                    />
                </svg>
            );
        case 'x':
            return (
                <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                        clipRule="evenodd"
                    />
                </svg>
            );
        case 'error':
            return (
                <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                    />
                </svg>
            );
        default:
            return null;
    }
}

/**
 * BatchProgress component
 * Requirements: 8.3, 8.4, 8.5, 8.6, 9.1
 */
export function BatchProgress({
    batchId,
    onPause,
    onResume,
    onCancel,
    onComplete,
}: BatchProgressProps) {
    const {
        batch,
        progress,
        currentPage,
        currentPageIndex,
        isConnected,
        error,
        isLoading,
    } = useBatchProgress({
        batchId,
        enabled: true,
        onComplete: () => onComplete?.(),
    });

    const pauseMutation = usePauseBatchScan();
    const resumeMutation = useResumeBatchScan();
    const cancelMutation = useCancelBatchScan();

    // Calculate progress percentage
    const progressPercent = useMemo(() => {
        if (!progress || progress.totalPages === 0) return 0;
        return Math.round(
            ((progress.completedPages + progress.failedPages) / progress.totalPages) * 100
        );
    }, [progress]);

    // Get status info
    const statusInfo = useMemo(() => getStatusInfo(batch?.status), [batch?.status]);

    // Determine if controls should be shown
    const showControls = batch?.status === 'running' || batch?.status === 'paused';
    const isRunning = batch?.status === 'running';
    const isPaused = batch?.status === 'paused';
    const isComplete = batch?.status === 'completed';
    const isCancelled = batch?.status === 'cancelled';
    const isError = batch?.status === 'error';
    const isFinished = isComplete || isCancelled || isError;

    // Handle pause
    const handlePause = async () => {
        try {
            await pauseMutation.mutateAsync(batchId);
            onPause?.();
        } catch (err) {
            console.error('Failed to pause batch:', err);
        }
    };

    // Handle resume
    const handleResume = async () => {
        try {
            await resumeMutation.mutateAsync(batchId);
            onResume?.();
        } catch (err) {
            console.error('Failed to resume batch:', err);
        }
    };

    // Handle cancel
    const handleCancel = async () => {
        try {
            await cancelMutation.mutateAsync(batchId);
            onCancel?.();
        } catch (err) {
            console.error('Failed to cancel batch:', err);
        }
    };

    if (isLoading && !batch) {
        return (
            <Card className="animate-pulse">
                <div className="h-4 bg-neutral-200 rounded w-1/4 mb-4" />
                <div className="h-2 bg-neutral-200 rounded w-full mb-4" />
                <div className="h-4 bg-neutral-200 rounded w-1/2" />
            </Card>
        );
    }

    return (
        <Card className="space-y-4" data-testid="batch-progress">
            {/* Header with status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <StatusIcon icon={statusInfo.icon} className={clsx('w-5 h-5', statusInfo.color)} />
                    <span className={clsx('font-medium', statusInfo.color)}>
                        {statusInfo.label}
                    </span>
                    {!isConnected && !isFinished && (
                        <span className="text-xs text-warning-600 bg-warning-50 px-2 py-0.5 rounded">
                            Reconnecting...
                        </span>
                    )}
                </div>
                <span className="text-sm font-medium text-neutral-600">
                    {progressPercent}%
                </span>
            </div>

            {/* Progress bar */}
            <div
                className="h-3 bg-neutral-200 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Batch scan progress"
            >
                <div
                    className={clsx(
                        'h-full transition-all duration-500 ease-out',
                        isComplete && 'bg-success-500',
                        isError && 'bg-error-500',
                        isCancelled && 'bg-neutral-400',
                        isPaused && 'bg-warning-500',
                        isRunning && 'bg-primary-500'
                    )}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Progress details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                    <span className="text-neutral-500 block">Pages</span>
                    <span className="font-medium">
                        {progress?.completedPages ?? 0} / {progress?.totalPages ?? 0}
                    </span>
                </div>
                <div>
                    <span className="text-neutral-500 block">Failed</span>
                    <span className={clsx(
                        'font-medium',
                        (progress?.failedPages ?? 0) > 0 ? 'text-error-600' : 'text-neutral-900'
                    )}>
                        {progress?.failedPages ?? 0}
                    </span>
                </div>
                <div>
                    <span className="text-neutral-500 block">Violations</span>
                    <span className={clsx(
                        'font-medium',
                        (progress?.totalViolations ?? 0) > 0 ? 'text-warning-600' : 'text-success-600'
                    )}>
                        {progress?.totalViolations ?? 0}
                    </span>
                </div>
                <div>
                    <span className="text-neutral-500 block">Time</span>
                    <span className="font-medium">
                        {isFinished
                            ? 'Done'
                            : formatTimeRemaining(progress?.estimatedTimeRemaining ?? 0)}
                    </span>
                </div>
            </div>

            {/* Current page indicator */}
            {currentPage && isRunning && (
                <div className="pt-3 border-t border-neutral-100">
                    <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
                        Currently scanning (page {currentPageIndex + 1})
                    </p>
                    <p className="text-sm text-neutral-700 truncate font-mono bg-neutral-50 px-2 py-1 rounded">
                        {currentPage}
                    </p>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div
                    role="alert"
                    className="rounded-lg bg-error-50 border border-error-200 p-3"
                >
                    <div className="flex items-start gap-2">
                        <svg
                            className="h-5 w-5 text-error-500 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <p className="text-sm text-error-700">{error}</p>
                    </div>
                </div>
            )}

            {/* Control buttons */}
            {showControls && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-100">
                    {isRunning && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handlePause}
                            isLoading={pauseMutation.isPending}
                            disabled={pauseMutation.isPending}
                            data-testid="pause-batch-button"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                aria-hidden="true"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            Pause
                        </Button>
                    )}
                    {isPaused && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleResume}
                            isLoading={resumeMutation.isPending}
                            disabled={resumeMutation.isPending}
                            data-testid="resume-batch-button"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                aria-hidden="true"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            Resume
                        </Button>
                    )}
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={handleCancel}
                        isLoading={cancelMutation.isPending}
                        disabled={cancelMutation.isPending}
                        data-testid="cancel-batch-button"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                clipRule="evenodd"
                            />
                        </svg>
                        Cancel
                    </Button>
                </div>
            )}

            {/* Batch name if available */}
            {batch?.name && (
                <div className="pt-2 border-t border-neutral-100">
                    <p className="text-xs text-neutral-500">
                        Batch: <span className="font-medium text-neutral-700">{batch.name}</span>
                    </p>
                </div>
            )}
        </Card>
    );
}
