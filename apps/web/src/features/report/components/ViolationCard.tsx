/**
 * ViolationCard component - Displays a single violation in the report
 * Requirements: 5.1
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import type { ReportViolation } from '@/types/domain';

export interface ViolationCardProps {
  violation: ReportViolation;
}

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

/**
 * Get badge variant based on status
 */
function getStatusBadgeVariant(status: string): 'success' | 'error' | 'warning' | 'default' {
  switch (status) {
    case 'fixed':
      return 'success';
    case 'skipped':
      return 'error';
    case 'processing':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * Chevron icon
 */
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={clsx('h-5 w-5 text-neutral-400 transition-transform', expanded && 'rotate-180')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * ViolationCard displays a single violation with expandable details
 * Requirements: 5.1
 */
export function ViolationCard({ violation }: ViolationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  return (
    <Card className="overflow-hidden" data-testid="violation-card">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
        aria-expanded={isExpanded}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-3 p-3 sm:p-4">
          <div className="flex-1 min-w-0">
            {/* Header with rule ID and badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <code className="rounded bg-neutral-100 px-2 py-1 text-sm font-mono font-medium text-neutral-800">
                {violation.ruleId}
              </code>
              <Badge variant={getImpactBadgeVariant(violation.impact)} size="sm">
                {violation.impact}
              </Badge>
              <Badge variant={getStatusBadgeVariant(violation.status)} size="sm">
                {violation.status}
              </Badge>
            </div>
            {/* Description */}
            <CardTitle as="h4" className="text-sm sm:text-base text-neutral-900">
              {violation.description}
            </CardTitle>
            {/* Selector */}
            <p className="mt-1 text-xs font-mono text-neutral-500 truncate">{violation.selector}</p>
          </div>
          <ChevronIcon expanded={isExpanded} />
        </CardHeader>
      </button>

      {isExpanded && (
        <CardContent className="border-t border-neutral-100 bg-neutral-50 p-3 sm:p-4">
          <dl className="space-y-3 text-sm">
            {/* Screenshot section */}
            {violation.screenshot && (
              <div>
                <dt className="font-medium text-neutral-700 mb-2">Element Screenshot</dt>
                <dd>
                  <button
                    type="button"
                    onClick={() => setIsImageExpanded(!isImageExpanded)}
                    className="block w-full text-left"
                  >
                    <img
                      src={`data:image/png;base64,${violation.screenshot}`}
                      alt={`Screenshot of ${violation.selector}`}
                      className={clsx(
                        'rounded border border-neutral-200 shadow-sm transition-all cursor-pointer hover:shadow-md',
                        isImageExpanded ? 'max-w-full' : 'max-w-xs max-h-32 object-contain'
                      )}
                    />
                  </button>
                  <p className="text-xs text-neutral-500 mt-1">
                    {isImageExpanded ? 'Click to collapse' : 'Click to expand'}
                  </p>
                </dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-neutral-700">Element Selector</dt>
              <dd className="font-mono text-neutral-600 break-all mt-1">{violation.selector}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-700">HTML Element</dt>
              <dd className="mt-1">
                <pre className="text-xs bg-neutral-100 p-2 rounded overflow-x-auto">
                  <code>{violation.html}</code>
                </pre>
              </dd>
            </div>
            {violation.status === 'skipped' && violation.skipReason && (
              <div>
                <dt className="font-medium text-neutral-700">Skip Reason</dt>
                <dd className="text-error-600 mt-1">{violation.skipReason}</dd>
              </div>
            )}
            {violation.status === 'fixed' && violation.fix && (
              <>
                <div>
                  <dt className="font-medium text-neutral-700">Fix Type</dt>
                  <dd className="text-neutral-600 mt-1">{violation.fix.type}</dd>
                </div>
                <div>
                  <dt className="font-medium text-neutral-700">AI Reasoning</dt>
                  <dd className="text-neutral-600 mt-1">{violation.fix.reasoning}</dd>
                </div>
                <div>
                  <dt className="font-medium text-neutral-700">Fixed HTML</dt>
                  <dd className="mt-1">
                    <pre className="text-xs bg-success-50 p-2 rounded overflow-x-auto">
                      <code>{violation.fix.afterHtml}</code>
                    </pre>
                  </dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      )}
    </Card>
  );
}
