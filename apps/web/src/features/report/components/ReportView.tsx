/**
 * ReportView component
 * Combines summary, fixes, and skipped sections in a tabbed layout
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { ReportSummary } from './ReportSummary';
import { FixCard } from './FixCard';
import { SkippedList } from './SkippedList';
import { ViolationCard } from './ViolationCard';
import type { ReportViewProps } from '../types';

type TabId = 'violations' | 'fixes' | 'skipped' | 'human-review' | 'page-screenshot';

interface Tab {
  id: TabId;
  label: string;
  shortLabel: string;
  count: number;
}

/**
 * Eye icon for human review items
 */
const EyeIcon = () => (
  <svg
    className="h-5 w-5 text-primary-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

/**
 * ReportView displays the complete remediation report
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export function ReportView({ report }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('violations');

  const tabs: Tab[] = [
    {
      id: 'violations',
      label: 'All Violations',
      shortLabel: 'Violations',
      count: report.violations?.length ?? 0,
    },
    { id: 'fixes', label: 'Applied Fixes', shortLabel: 'Fixes', count: report.fixes?.length ?? 0 },
    { id: 'skipped', label: 'Skipped', shortLabel: 'Skipped', count: report.skipped?.length ?? 0 },
    {
      id: 'human-review',
      label: 'Human Review',
      shortLabel: 'Review',
      count: report.humanReview?.length ?? 0,
    },
    ...(report.pageScreenshot
      ? [
          {
            id: 'page-screenshot' as TabId,
            label: 'Page Screenshot',
            shortLabel: 'Screenshot',
            count: 1,
          },
        ]
      : []),
  ];

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="report-view">
      {/* Report header */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-3 sm:gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-neutral-900">
                Accessibility Report
              </h2>
              <p className="mt-1 text-sm text-neutral-600 break-all">
                <a
                  href={report.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  {report.url}
                </a>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-neutral-500">
              <span className="flex items-center gap-1">
                Viewport:{' '}
                <Badge variant="default" size="sm">
                  {report.viewport}
                </Badge>
              </span>
              <span>Duration: {formatDuration(report.duration)}</span>
              <span className="hidden sm:inline">
                {new Date(report.timestamp).toLocaleString()}
              </span>
              <span className="sm:hidden">{new Date(report.timestamp).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary section */}
      <ReportSummary summary={report.summary} />

      {/* Tabbed content */}
      <Card padding="none">
        {/* Tab navigation - scrollable on mobile */}
        <div className="border-b border-neutral-200 overflow-x-auto scrollbar-hide">
          <nav className="flex -mb-px min-w-max" aria-label="Report sections" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-250 whitespace-nowrap',
                  'min-h-[44px]',
                  activeTab === tab.id
                    ? 'text-primary-600'
                    : 'text-neutral-500 hover:text-neutral-700'
                )}
                aria-selected={activeTab === tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`tabpanel-${tab.id}`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                <Badge variant={activeTab === tab.id ? 'primary' : 'default'} size="sm">
                  {tab.count}
                </Badge>

                {/* Animated underline */}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full transition-all duration-250" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <CardContent className="p-3 sm:p-4">
          {activeTab === 'violations' && (
            <div
              className="space-y-3 sm:space-y-4"
              role="tabpanel"
              id="tabpanel-violations"
              aria-labelledby="tab-violations"
            >
              {(report.violations?.length ?? 0) === 0 ? (
                <p className="py-6 sm:py-8 text-center text-neutral-500 text-sm sm:text-base">
                  No violations detected.
                </p>
              ) : (
                report.violations?.map((violation) => (
                  <ViolationCard key={violation.id} violation={violation} />
                ))
              )}
            </div>
          )}

          {activeTab === 'fixes' && (
            <div
              className="space-y-3 sm:space-y-4"
              role="tabpanel"
              id="tabpanel-fixes"
              aria-labelledby="tab-fixes"
            >
              {(report.fixes?.length ?? 0) === 0 ? (
                <p className="py-6 sm:py-8 text-center text-neutral-500 text-sm sm:text-base">
                  No fixes were applied.
                </p>
              ) : (
                report.fixes?.map((fix) => <FixCard key={fix.violationId} fix={fix} />)
              )}
            </div>
          )}

          {activeTab === 'skipped' && (
            <div role="tabpanel" id="tabpanel-skipped" aria-labelledby="tab-skipped">
              <SkippedList skipped={report.skipped} />
            </div>
          )}

          {activeTab === 'human-review' && (
            <div
              className="space-y-3 sm:space-y-4"
              role="tabpanel"
              id="tabpanel-human-review"
              aria-labelledby="tab-human-review"
            >
              {report.humanReview?.length === 0 ? (
                <p className="py-6 sm:py-8 text-center text-neutral-500 text-sm sm:text-base">
                  No items require human review.
                </p>
              ) : (
                report.humanReview?.map((item) => (
                  <Card key={item.violationId} data-testid="human-review-item">
                    <CardHeader className="flex flex-row items-center gap-3 p-3 sm:p-4">
                      <EyeIcon />
                      <CardTitle as="h4" className="text-sm sm:text-base">
                        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs sm:text-sm font-medium text-neutral-700">
                          {item.ruleId}
                        </code>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0">
                      <dl className="space-y-2 text-xs sm:text-sm">
                        <div>
                          <dt className="font-medium text-neutral-700">Selector</dt>
                          <dd className="font-mono text-neutral-600 break-all">{item.selector}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-neutral-700">Reason for Review</dt>
                          <dd className="text-neutral-600">{item.reason}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-neutral-700">Suggested Action</dt>
                          <dd className="text-neutral-600">{item.suggestedAction}</dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'page-screenshot' && report.pageScreenshot && (
            <div
              className="space-y-3 sm:space-y-4"
              role="tabpanel"
              id="tabpanel-page-screenshot"
              aria-labelledby="tab-page-screenshot"
            >
              <div className="text-center">
                <p className="text-sm text-neutral-600 mb-4">
                  Full page screenshot captured during the accessibility scan
                </p>
                <img
                  src={`data:image/png;base64,${report.pageScreenshot}`}
                  alt={`Full page screenshot of ${report.url}`}
                  className="max-w-full rounded-lg border border-neutral-200 shadow-sm mx-auto"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
