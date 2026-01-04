/**
 * ViolationList component - Displays violations grouped by impact level
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Badge } from '@/shared/components/ui/Badge';
import { ViolationItem } from './ViolationItem';
import type { Violation, ImpactLevel, ViolationFilter } from '@/types/domain';

export interface ViolationListProps {
  /** List of violations to display */
  violations: Violation[];
  /** Currently processing violation ID */
  currentViolationId?: string | null;
  /** Callback when a violation is selected */
  onViolationSelect?: (violationId: string) => void;
  /** Currently selected violation ID */
  selectedViolationId?: string | null;
}

/**
 * Impact level order for grouping (Critical first)
 */
const IMPACT_ORDER: ImpactLevel[] = ['critical', 'serious', 'moderate', 'minor'];

/**
 * Impact level display configuration
 */
const IMPACT_CONFIG: Record<ImpactLevel, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'Critical', color: 'text-error-700', bgColor: 'bg-error-50' },
  serious: { label: 'Serious', color: 'text-warning-700', bgColor: 'bg-warning-50' },
  moderate: { label: 'Moderate', color: 'text-info-700', bgColor: 'bg-info-50' },
  minor: { label: 'Minor', color: 'text-neutral-700', bgColor: 'bg-neutral-50' },
};

/**
 * Filter options for violation status
 */
const FILTER_OPTIONS: { value: ViolationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'skipped', label: 'Skipped' },
];

/**
 * Group violations by impact level
 */
function groupByImpact(violations: Violation[]): Map<ImpactLevel, Violation[]> {
  const groups = new Map<ImpactLevel, Violation[]>();

  // Initialize all groups
  for (const impact of IMPACT_ORDER) {
    groups.set(impact, []);
  }

  // Group violations
  for (const violation of violations) {
    const group = groups.get(violation.impact);
    if (group) {
      group.push(violation);
    }
  }

  return groups;
}

/**
 * Filter violations by status
 */
function filterViolations(violations: Violation[], filter: ViolationFilter): Violation[] {
  if (filter === 'all') {
    return violations;
  }
  return violations.filter((v) => v.status === filter);
}

/**
 * ViolationList component
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */
export function ViolationList({
  violations,
  currentViolationId,
  onViolationSelect,
  selectedViolationId,
}: ViolationListProps) {
  const [filter, setFilter] = useState<ViolationFilter>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<ImpactLevel>>(new Set(IMPACT_ORDER));

  // Filter and group violations
  const filteredViolations = useMemo(
    () => filterViolations(violations, filter),
    [violations, filter]
  );

  const groupedViolations = useMemo(() => groupByImpact(filteredViolations), [filteredViolations]);

  // Count violations by status for filter badges
  const statusCounts = useMemo(() => {
    return {
      all: violations.length,
      pending: violations.filter((v) => v.status === 'pending' || v.status === 'processing').length,
      fixed: violations.filter((v) => v.status === 'fixed').length,
      skipped: violations.filter((v) => v.status === 'skipped').length,
    };
  }, [violations]);

  // Toggle group expansion
  const toggleGroup = (impact: ImpactLevel) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(impact)) {
        next.delete(impact);
      } else {
        next.add(impact);
      }
      return next;
    });
  };

  if (violations.length === 0) {
    return (
      <div className="text-center py-6 sm:py-8 text-neutral-600 bg-white rounded-lg">
        No violations detected yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Filter controls - horizontal scroll on mobile */}
      <div
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
        role="group"
        aria-label="Filter violations"
      >
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
              'min-h-[36px] sm:min-h-0', // Touch-friendly on mobile
              filter === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            )}
            aria-pressed={filter === option.value}
          >
            {option.label}
            <span className="ml-1.5 text-xs opacity-75">({statusCounts[option.value]})</span>
          </button>
        ))}
      </div>

      {/* Grouped violations */}
      <div className="space-y-2 sm:space-y-3">
        {IMPACT_ORDER.map((impact) => {
          const group = groupedViolations.get(impact) ?? [];
          const isExpanded = expandedGroups.has(impact);
          const config = IMPACT_CONFIG[impact];

          if (group.length === 0) {
            return null;
          }

          return (
            <div key={impact} className={clsx('rounded-lg border', config.bgColor)}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(impact)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3',
                  'text-left font-medium min-h-[44px]',
                  config.color
                )}
                aria-expanded={isExpanded}
                aria-controls={`violation-group-${impact}`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm sm:text-base">{config.label}</span>
                  <Badge
                    variant={
                      impact === 'critical' ? 'error' : impact === 'serious' ? 'warning' : 'default'
                    }
                  >
                    {group.length}
                  </Badge>
                </span>
                <svg
                  className={clsx(
                    'w-5 h-5 transition-transform flex-shrink-0',
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

              {/* Group content */}
              {isExpanded && (
                <div
                  id={`violation-group-${impact}`}
                  className="px-2 sm:px-4 pb-2 sm:pb-3 space-y-2"
                >
                  {group.map((violation) => (
                    <ViolationItem
                      key={violation.id}
                      violation={violation}
                      isProcessing={violation.id === currentViolationId}
                      isSelected={violation.id === selectedViolationId}
                      onSelect={() => onViolationSelect?.(violation.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state for filtered results */}
      {filteredViolations.length === 0 && violations.length > 0 && (
        <div className="text-center py-4 text-neutral-700 bg-white rounded-lg text-sm sm:text-base">
          No violations match the selected filter.
        </div>
      )}
    </div>
  );
}
