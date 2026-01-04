/**
 * SkippedList component
 * Lists skipped violations with reasons and expandable details
 * Requirements: 5.4
 */
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import type { SkippedViolation } from '@/types/domain';

export interface SkippedListProps {
    /** List of skipped violations */
    skipped: SkippedViolation[];
}

/**
 * Chevron icon for expand/collapse
 */
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg
        className={`h-5 w-5 text-neutral-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
    >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

/**
 * Warning icon for skipped items
 */
const WarningIcon = () => (
    <svg
        className="h-5 w-5 text-warning-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
    </svg>
);

/**
 * Get badge variant based on impact level
 */
function getImpactBadgeVariant(impact: string): 'error' | 'warning' | 'primary' | 'default' {
    switch (impact) {
        case 'critical':
            return 'error';
        case 'serious':
            return 'warning';
        case 'moderate':
            return 'primary';
        default:
            return 'default';
    }
}

interface SkippedItemProps {
    violation: SkippedViolation;
}

function SkippedItem({ violation }: SkippedItemProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border-b border-neutral-200 last:border-b-0" data-testid="skipped-item">
            <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
            >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <WarningIcon />
                    <div className="flex-1 min-w-0">
                        {/* Rule ID and impact badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm font-medium text-neutral-700">
                                {violation.ruleId}
                            </code>
                            <Badge variant={getImpactBadgeVariant(violation.impact)} size="sm">
                                {violation.impact}
                            </Badge>
                            <Badge variant="warning" size="sm">
                                {violation.attempts} attempt{violation.attempts !== 1 ? 's' : ''}
                            </Badge>
                        </div>
                        {/* Violation description */}
                        <p className="text-sm font-medium text-neutral-900">{violation.description}</p>
                        {/* Selector */}
                        <p className="mt-1 text-xs font-mono text-neutral-500 truncate">{violation.selector}</p>
                        {/* Skip reason */}
                        <p className="mt-1 text-sm text-error-600">{violation.reason}</p>
                    </div>
                </div>
                <ChevronIcon expanded={expanded} />
            </button>

            {expanded && (
                <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                    <dl className="space-y-3 text-sm">
                        <div>
                            <dt className="font-medium text-neutral-700">Element Selector</dt>
                            <dd className="font-mono text-neutral-600 break-all">{violation.selector}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-neutral-700">Original HTML</dt>
                            <dd className="mt-1">
                                <pre className="text-xs bg-neutral-100 p-2 rounded overflow-x-auto">
                                    <code>{violation.html}</code>
                                </pre>
                            </dd>
                        </div>
                        <div>
                            <dt className="font-medium text-neutral-700">Skip Reason</dt>
                            <dd className="text-error-600">{violation.reason}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-neutral-700">Fix Attempts</dt>
                            <dd className="text-neutral-600">{violation.attempts}</dd>
                        </div>
                    </dl>
                </div>
            )}
        </div>
    );
}

/**
 * SkippedList displays all skipped violations with reasons
 * Requirements: 5.4
 */
export function SkippedList({ skipped }: SkippedListProps) {
    if (skipped?.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <p className="text-neutral-500">No violations were skipped.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card padding="none" data-testid="skipped-list">
            <CardHeader>
                <CardTitle as="h3" className="flex items-center gap-2">
                    <WarningIcon />
                    Skipped Violations
                    <Badge variant="warning" size="md">
                        {skipped?.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-neutral-200">
                    {skipped?.map((violation) => (
                        <SkippedItem key={violation.violationId} violation={violation} />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
