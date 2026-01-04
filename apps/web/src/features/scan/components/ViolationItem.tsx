/**
 * ViolationItem component - Displays a single violation with expand/collapse
 * Requirements: 3.2, 3.3, 2.4
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import { Badge } from '@/shared/components/ui/Badge';
import type { Violation } from '@/types/domain';

export interface ViolationItemProps {
    /** The violation to display */
    violation: Violation;
    /** Whether this violation is currently being processed */
    isProcessing?: boolean;
    /** Whether this violation is selected */
    isSelected?: boolean;
    /** Callback when the violation is selected */
    onSelect?: () => void;
}

/**
 * Status badge configuration
 */
const STATUS_CONFIG: Record<Violation['status'], { label: string; variant: 'default' | 'success' | 'warning' | 'error' }> = {
    pending: { label: 'Pending', variant: 'default' },
    processing: { label: 'Processing', variant: 'warning' },
    fixed: { label: 'Fixed', variant: 'success' },
    skipped: { label: 'Skipped', variant: 'error' },
};

/**
 * ViolationItem component
 * Requirements: 3.2, 3.3, 2.4
 */
export function ViolationItem({
    violation,
    isProcessing = false,
    isSelected = false,
    onSelect,
}: ViolationItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const statusConfig = STATUS_CONFIG[violation.status];

    const handleClick = () => {
        setIsExpanded(!isExpanded);
        onSelect?.();
    };

    return (
        <div
            className={clsx(
                'rounded-md border bg-white transition-all',
                isProcessing && 'ring-2 ring-primary-500 ring-offset-1',
                isSelected && !isProcessing && 'ring-2 ring-neutral-400 ring-offset-1'
            )}
        >
            {/* Header - always visible */}
            <button
                onClick={handleClick}
                className={clsx(
                    'w-full flex items-start gap-3 p-3 text-left',
                    'hover:bg-neutral-50 transition-colors',
                    isProcessing && 'bg-primary-50'
                )}
                aria-expanded={isExpanded}
                aria-controls={`violation-details-${violation.id}`}
            >
                {/* Processing indicator */}
                {isProcessing && (
                    <div className="flex-shrink-0 mt-0.5">
                        <svg
                            className="w-4 h-4 animate-spin text-primary-600"
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
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Rule ID and Status */}
                    <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
                            {violation.ruleId}
                        </code>
                        <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                        </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-neutral-900 line-clamp-2">
                        {violation.description}
                    </p>

                    {/* Selector */}
                    <p className="text-xs text-neutral-500 mt-1 font-mono truncate">
                        {violation.selector}
                    </p>
                </div>

                {/* Expand icon */}
                <svg
                    className={clsx(
                        'w-5 h-5 text-neutral-400 flex-shrink-0 transition-transform',
                        isExpanded && 'rotate-180'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {/* Expanded details */}
            {isExpanded && (
                <div
                    id={`violation-details-${violation.id}`}
                    className="px-3 pb-3 border-t border-neutral-100"
                >
                    <div className="pt-3 space-y-3">
                        {/* Help text */}
                        <div>
                            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                                How to fix
                            </h4>
                            <p className="text-sm text-neutral-700">
                                {violation.help}
                            </p>
                        </div>

                        {/* HTML snippet */}
                        <div>
                            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                                Element HTML
                            </h4>
                            <pre className="text-xs bg-neutral-100 p-2 rounded overflow-x-auto">
                                <code>{violation.html}</code>
                            </pre>
                        </div>

                        {/* Skip reason if skipped */}
                        {violation.status === 'skipped' && violation.skipReason && (
                            <div>
                                <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                                    Skip Reason
                                </h4>
                                <p className="text-sm text-error-600">
                                    {violation.skipReason}
                                </p>
                            </div>
                        )}

                        {/* Help URL */}
                        <a
                            href={violation.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                        >
                            Learn more
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                            </svg>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
