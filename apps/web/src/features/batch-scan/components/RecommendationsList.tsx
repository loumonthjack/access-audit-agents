/**
 * RecommendationsList component - Display prioritized recommendations from batch scan
 * Requirements: 10.6
 */
import { clsx } from 'clsx';
import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import type { BatchRecommendation, ImpactLevel } from '@/types/domain';

/**
 * Props for the RecommendationsList component
 * Requirements: 10.6
 */
export interface RecommendationsListProps {
    /** List of recommendations to display */
    recommendations: BatchRecommendation[];
    /** Optional class name for the container */
    className?: string;
}

/**
 * Get priority badge variant based on priority level
 */
function getPriorityVariant(priority: number): 'critical' | 'serious' | 'moderate' | 'minor' {
    if (priority >= 8) return 'critical';
    if (priority >= 5) return 'serious';
    if (priority >= 3) return 'moderate';
    return 'minor';
}

/**
 * Get priority label based on priority level
 */
function getPriorityLabel(priority: number): string {
    if (priority >= 8) return 'High';
    if (priority >= 5) return 'Medium';
    if (priority >= 3) return 'Low';
    return 'Info';
}

/**
 * Priority indicator icon
 */
function PriorityIcon({ priority, className }: { priority: number; className?: string }) {
    const variant = getPriorityVariant(priority);
    
    const colors: Record<string, string> = {
        critical: 'text-error-500',
        serious: 'text-warning-500',
        moderate: 'text-primary-500',
        minor: 'text-neutral-400',
    };

    return (
        <svg
            className={clsx(colors[variant], className)}
            fill="currentColor"
            viewBox="0 0 20 20"
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
 * Pages affected icon
 */
function PagesIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
        </svg>
    );
}

/**
 * Action icon
 */
function ActionIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
            />
        </svg>
    );
}

/**
 * Individual recommendation item component
 */
function RecommendationItem({
    recommendation,
    index,
}: {
    recommendation: BatchRecommendation;
    index: number;
}) {
    const priorityVariant = getPriorityVariant(recommendation.priority);
    const priorityLabel = getPriorityLabel(recommendation.priority);

    return (
        <div
            className={clsx(
                'p-4 rounded-lg border transition-colors',
                'hover:bg-neutral-50',
                priorityVariant === 'critical' && 'border-error-200 bg-error-50/30',
                priorityVariant === 'serious' && 'border-warning-200 bg-warning-50/30',
                priorityVariant === 'moderate' && 'border-primary-200 bg-primary-50/30',
                priorityVariant === 'minor' && 'border-neutral-200 bg-neutral-50/30'
            )}
            data-testid={`recommendation-item-${index}`}
        >
            {/* Header with priority and rule ID */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <PriorityIcon priority={recommendation.priority} className="w-5 h-5 flex-shrink-0" />
                    <Badge variant={priorityVariant} size="sm">
                        {priorityLabel} Priority
                    </Badge>
                    <code className="text-xs bg-neutral-200 px-1.5 py-0.5 rounded font-mono">
                        {recommendation.ruleId}
                    </code>
                </div>
                <span className="text-sm font-medium text-neutral-500">
                    #{index + 1}
                </span>
            </div>

            {/* Description */}
            <p className="text-sm text-neutral-700 mb-3">
                {recommendation.description}
            </p>

            {/* Affected pages count */}
            <div className="flex items-center gap-2 text-sm text-neutral-600 mb-3">
                <PagesIcon className="w-4 h-4" />
                <span>
                    Affects <strong>{recommendation.affectedPages}</strong>{' '}
                    {recommendation.affectedPages === 1 ? 'page' : 'pages'}
                </span>
            </div>

            {/* Suggested action */}
            <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-neutral-200">
                <ActionIcon className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                        Suggested Action
                    </p>
                    <p className="text-sm text-neutral-700">
                        {recommendation.suggestedAction}
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Empty state component
 */
function EmptyState() {
    return (
        <div className="text-center py-8">
            <svg
                className="w-12 h-12 mx-auto text-success-500 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
            <h4 className="text-lg font-medium text-neutral-900 mb-1">
                No recommendations
            </h4>
            <p className="text-sm text-neutral-500">
                Great job! No accessibility issues were found that require attention.
            </p>
        </div>
    );
}

/**
 * RecommendationsList component
 * Requirements: 10.6
 */
export function RecommendationsList({
    recommendations,
    className,
}: RecommendationsListProps) {
    // Sort recommendations by priority (highest first)
    const sortedRecommendations = [...recommendations].sort(
        (a, b) => b.priority - a.priority
    );

    // Group by priority level for summary
    const highPriority = sortedRecommendations.filter(r => r.priority >= 8).length;
    const mediumPriority = sortedRecommendations.filter(r => r.priority >= 5 && r.priority < 8).length;
    const lowPriority = sortedRecommendations.filter(r => r.priority < 5).length;

    return (
        <Card className={clsx('space-y-4', className)} data-testid="recommendations-list">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">
                    Recommendations
                </h3>
                {sortedRecommendations.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                        {highPriority > 0 && (
                            <span className="flex items-center gap-1 text-error-600">
                                <span className="w-2 h-2 rounded-full bg-error-500" />
                                {highPriority} high
                            </span>
                        )}
                        {mediumPriority > 0 && (
                            <span className="flex items-center gap-1 text-warning-600">
                                <span className="w-2 h-2 rounded-full bg-warning-500" />
                                {mediumPriority} medium
                            </span>
                        )}
                        {lowPriority > 0 && (
                            <span className="flex items-center gap-1 text-neutral-600">
                                <span className="w-2 h-2 rounded-full bg-neutral-400" />
                                {lowPriority} low
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Recommendations list or empty state */}
            {sortedRecommendations.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="space-y-3">
                    {sortedRecommendations.map((recommendation, index) => (
                        <RecommendationItem
                            key={`${recommendation.ruleId}-${index}`}
                            recommendation={recommendation}
                            index={index}
                        />
                    ))}
                </div>
            )}
        </Card>
    );
}
