/**
 * BatchReport component - Displays comprehensive batch scan report
 * Requirements: 9.2, 9.3, 9.6, 10.2, 10.3, 10.4, 10.5, 10.6
 */
import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { useBatchReport } from '../api/batchApi';
import { BatchExportButtons } from './BatchExportButtons';
import { RecommendationsList } from './RecommendationsList';
import type { BatchReport as BatchReportType, ImpactLevel, BatchPageStatus } from '@/types/domain';

/**
 * Props for the BatchReport component
 * Requirements: 10.1, 10.2
 */
export interface BatchReportProps {
    /** Batch ID to display report for */
    batchId: string;
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

/**
 * Get impact badge variant
 */
function getImpactVariant(impact: ImpactLevel): 'critical' | 'serious' | 'moderate' | 'minor' {
    return impact;
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: BatchPageStatus): 'success' | 'error' | 'warning' | 'default' {
    switch (status) {
        case 'completed':
            return 'success';
        case 'failed':
            return 'error';
        case 'skipped':
            return 'warning';
        default:
            return 'default';
    }
}

/**
 * Impact level colors for the chart
 */
const impactColors: Record<ImpactLevel, string> = {
    critical: 'bg-error-500',
    serious: 'bg-warning-500',
    moderate: 'bg-primary-500',
    minor: 'bg-neutral-400',
};

/**
 * Summary statistics card component
 */
function SummaryStats({ report }: { report: BatchReportType }) {
    const { summary, violationsByImpact } = report;
    const successRate = summary.totalPages > 0
        ? Math.round((summary.successfulPages / summary.totalPages) * 100)
        : 0;

    return (
        <Card className="space-y-4" data-testid="summary-stats">
            <h3 className="text-lg font-semibold text-neutral-900">Summary</h3>
            
            {/* Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-neutral-50 rounded-lg">
                    <p className="text-2xl font-bold text-neutral-900">{summary.totalPages}</p>
                    <p className="text-sm text-neutral-500">Total Pages</p>
                </div>
                <div className="text-center p-3 bg-success-50 rounded-lg">
                    <p className="text-2xl font-bold text-success-600">{summary.successfulPages}</p>
                    <p className="text-sm text-neutral-500">Successful</p>
                </div>
                <div className="text-center p-3 bg-error-50 rounded-lg">
                    <p className="text-2xl font-bold text-error-600">{summary.failedPages}</p>
                    <p className="text-sm text-neutral-500">Failed</p>
                </div>
                <div className="text-center p-3 bg-warning-50 rounded-lg">
                    <p className="text-2xl font-bold text-warning-600">{summary.totalViolations}</p>
                    <p className="text-sm text-neutral-500">Violations</p>
                </div>
            </div>

            {/* Success rate bar */}
            <div>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-600">Success Rate</span>
                    <span className="font-medium">{successRate}%</span>
                </div>
                <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-success-500 transition-all duration-500"
                        style={{ width: `${successRate}%` }}
                    />
                </div>
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-neutral-100">
                <span className="text-neutral-500">Scan Duration</span>
                <span className="font-medium">{formatDuration(report.duration)}</span>
            </div>
        </Card>
    );
}

/**
 * Violations by impact chart component
 */
function ViolationsByImpactChart({ violationsByImpact }: { violationsByImpact: Record<ImpactLevel, number> }) {
    const total = Object.values(violationsByImpact).reduce((sum, count) => sum + count, 0);
    const impactLevels: ImpactLevel[] = ['critical', 'serious', 'moderate', 'minor'];

    return (
        <Card className="space-y-4" data-testid="violations-by-impact">
            <h3 className="text-lg font-semibold text-neutral-900">Violations by Impact</h3>
            
            {total === 0 ? (
                <div className="text-center py-8">
                    <svg
                        className="w-12 h-12 mx-auto text-success-500 mb-2"
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
                    <p className="text-success-600 font-medium">No violations found!</p>
                </div>
            ) : (
                <>
                    {/* Horizontal bar chart */}
                    <div className="h-8 flex rounded-lg overflow-hidden" role="img" aria-label="Violations by impact level">
                        {impactLevels.map((impact) => {
                            const count = violationsByImpact[impact] || 0;
                            const percentage = total > 0 ? (count / total) * 100 : 0;
                            if (percentage === 0) return null;
                            return (
                                <div
                                    key={impact}
                                    className={clsx(impactColors[impact], 'transition-all duration-500')}
                                    style={{ width: `${percentage}%` }}
                                    title={`${impact}: ${count} (${Math.round(percentage)}%)`}
                                />
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {impactLevels.map((impact) => {
                            const count = violationsByImpact[impact] || 0;
                            return (
                                <div key={impact} className="flex items-center gap-2">
                                    <div className={clsx('w-3 h-3 rounded-full', impactColors[impact])} />
                                    <div>
                                        <p className="text-sm font-medium capitalize">{impact}</p>
                                        <p className="text-xs text-neutral-500">{count} issues</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </Card>
    );
}


/**
 * Most common violations list component
 */
function MostCommonViolations({ violations }: { violations: BatchReportType['violationsByRule'] }) {
    // Sort by count descending and take top 10
    const topViolations = useMemo(() => {
        return [...violations]
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [violations]);

    if (topViolations.length === 0) {
        return null;
    }

    return (
        <Card className="space-y-4" data-testid="most-common-violations">
            <h3 className="text-lg font-semibold text-neutral-900">Most Common Violations</h3>
            
            <div className="space-y-3">
                {topViolations.map((violation, index) => (
                    <div
                        key={violation.ruleId}
                        className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg"
                    >
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-neutral-200 rounded-full text-xs font-medium text-neutral-600">
                            {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <code className="text-xs bg-neutral-200 px-1.5 py-0.5 rounded font-mono">
                                    {violation.ruleId}
                                </code>
                                <Badge variant={getImpactVariant(violation.impact)} size="sm">
                                    {violation.impact}
                                </Badge>
                            </div>
                            <p className="text-sm text-neutral-700 line-clamp-2">
                                {violation.description}
                            </p>
                        </div>
                        <span className="flex-shrink-0 text-lg font-bold text-neutral-900">
                            {violation.count}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

/**
 * Expandable page item component
 */
function PageItem({ page, isExpanded, onToggle }: {
    page: BatchReportType['pages'][0];
    isExpanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors text-left"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <svg
                        className={clsx(
                            'w-4 h-4 text-neutral-400 transition-transform flex-shrink-0',
                            isExpanded && 'rotate-90'
                        )}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <span className="text-sm font-mono text-neutral-700 truncate">
                        {page.url}
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <Badge variant={getStatusVariant(page.status)} size="sm">
                        {page.status}
                    </Badge>
                    {page.status === 'completed' && (
                        <span className={clsx(
                            'text-sm font-medium',
                            page.violationCount > 0 ? 'text-warning-600' : 'text-success-600'
                        )}>
                            {page.violationCount} {page.violationCount === 1 ? 'issue' : 'issues'}
                        </span>
                    )}
                </div>
            </button>
            
            {isExpanded && (
                <div className="px-3 pb-3 pt-0 border-t border-neutral-100 bg-neutral-50">
                    <dl className="grid grid-cols-2 gap-2 text-sm mt-3">
                        <div>
                            <dt className="text-neutral-500">Status</dt>
                            <dd className="font-medium capitalize">{page.status}</dd>
                        </div>
                        <div>
                            <dt className="text-neutral-500">Violations</dt>
                            <dd className="font-medium">{page.violationCount}</dd>
                        </div>
                        {page.scanSessionId && (
                            <div className="col-span-2">
                                <dt className="text-neutral-500">Session ID</dt>
                                <dd className="font-mono text-xs">{page.scanSessionId}</dd>
                            </div>
                        )}
                        {page.errorMessage && (
                            <div className="col-span-2">
                                <dt className="text-neutral-500">Error</dt>
                                <dd className="text-error-600">{page.errorMessage}</dd>
                            </div>
                        )}
                    </dl>
                </div>
            )}
        </div>
    );
}

/**
 * Per-page breakdown component with expandable items
 */
function PageBreakdown({ pages }: { pages: BatchReportType['pages'] }) {
    const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all');

    const filteredPages = useMemo(() => {
        if (filter === 'all') return pages;
        if (filter === 'completed') return pages.filter(p => p.status === 'completed');
        if (filter === 'failed') return pages.filter(p => p.status === 'failed');
        return pages;
    }, [pages, filter]);

    const togglePage = (url: string) => {
        setExpandedPages(prev => {
            const next = new Set(prev);
            if (next.has(url)) {
                next.delete(url);
            } else {
                next.add(url);
            }
            return next;
        });
    };

    const completedCount = pages.filter(p => p.status === 'completed').length;
    const failedCount = pages.filter(p => p.status === 'failed').length;

    return (
        <Card className="space-y-4" data-testid="page-breakdown">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">Page Breakdown</h3>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setFilter('all')}
                        className={clsx(
                            'px-3 py-1 text-sm rounded-lg transition-colors',
                            filter === 'all'
                                ? 'bg-neutral-900 text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        )}
                    >
                        All ({pages.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('completed')}
                        className={clsx(
                            'px-3 py-1 text-sm rounded-lg transition-colors',
                            filter === 'completed'
                                ? 'bg-success-600 text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        )}
                    >
                        Completed ({completedCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('failed')}
                        className={clsx(
                            'px-3 py-1 text-sm rounded-lg transition-colors',
                            filter === 'failed'
                                ? 'bg-error-600 text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        )}
                    >
                        Failed ({failedCount})
                    </button>
                </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredPages.length === 0 ? (
                    <p className="text-center text-neutral-500 py-4">No pages match the filter</p>
                ) : (
                    filteredPages.map((page) => (
                        <PageItem
                            key={page.url}
                            page={page}
                            isExpanded={expandedPages.has(page.url)}
                            onToggle={() => togglePage(page.url)}
                        />
                    ))
                )}
            </div>
        </Card>
    );
}

/**
 * Loading skeleton for the report
 */
function ReportSkeleton() {
    return (
        <div className="space-y-6 animate-pulse" data-testid="report-skeleton">
            <Card>
                <div className="h-6 bg-neutral-200 rounded w-1/4 mb-4" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-neutral-100 rounded-lg" />
                    ))}
                </div>
            </Card>
            <Card>
                <div className="h-6 bg-neutral-200 rounded w-1/3 mb-4" />
                <div className="h-8 bg-neutral-100 rounded-lg mb-4" />
                <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-12 bg-neutral-100 rounded" />
                    ))}
                </div>
            </Card>
            <Card>
                <div className="h-6 bg-neutral-200 rounded w-1/3 mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-neutral-100 rounded-lg" />
                    ))}
                </div>
            </Card>
        </div>
    );
}

/**
 * Error display component
 */
function ReportError({ error, onRetry }: { error: string; onRetry?: () => void }) {
    return (
        <Card className="text-center py-8" data-testid="report-error">
            <svg
                className="w-12 h-12 mx-auto text-error-500 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
            </svg>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Failed to load report</h3>
            <p className="text-neutral-600 mb-4">{error}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    Try Again
                </button>
            )}
        </Card>
    );
}

/**
 * BatchReport component
 * Requirements: 9.2, 9.3, 9.6, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export function BatchReport({ batchId }: BatchReportProps) {
    const { data: report, isLoading, error, refetch } = useBatchReport(batchId);

    if (isLoading) {
        return <ReportSkeleton />;
    }

    if (error || !report) {
        return (
            <ReportError
                error={error instanceof Error ? error.message : 'Failed to load report'}
                onRetry={() => refetch()}
            />
        );
    }

    return (
        <div className="space-y-6" data-testid="batch-report">
            {/* Report header with export buttons */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-neutral-900">
                        {report.name || 'Batch Scan Report'}
                    </h2>
                    {report.sitemapUrl && (
                        <p className="text-sm text-neutral-500 mt-1 font-mono">
                            {report.sitemapUrl}
                        </p>
                    )}
                    <p className="text-sm text-neutral-500 mt-1">
                        Completed {new Date(report.completedAt).toLocaleString()} • {report.viewport} viewport
                    </p>
                </div>
                <BatchExportButtons batchId={batchId} batchName={report.name} />
            </div>

            {/* Summary statistics */}
            <SummaryStats report={report} />

            {/* Violations by impact chart */}
            <ViolationsByImpactChart violationsByImpact={report.violationsByImpact} />

            {/* Most common violations */}
            <MostCommonViolations violations={report.violationsByRule} />

            {/* Recommendations */}
            <RecommendationsList recommendations={report.recommendations} />

            {/* Per-page breakdown */}
            <PageBreakdown pages={report.pages} />
        </div>
    );
}
