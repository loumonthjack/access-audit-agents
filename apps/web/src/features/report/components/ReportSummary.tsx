/**
 * ReportSummary component
 * Displays summary counts: total, fixed, skipped, human review
 * Requirements: 5.2
 */
import { Card } from '@/shared/components/ui/Card';
import type { ReportSummaryProps } from '../types';

/**
 * Icon components for summary cards
 */
const TotalIcon = () => (
  <svg
    className="h-5 w-5 sm:h-6 sm:w-6 text-neutral-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

const FixedIcon = () => (
  <svg
    className="h-5 w-5 sm:h-6 sm:w-6 text-success-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const SkippedIcon = () => (
  <svg
    className="h-5 w-5 sm:h-6 sm:w-6 text-warning-500"
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

const HumanReviewIcon = () => (
  <svg
    className="h-5 w-5 sm:h-6 sm:w-6 text-primary-500"
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

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}

function SummaryCard({ icon, label, value, colorClass }: SummaryCardProps) {
  return (
    <Card padding="md" className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
      <div className={`rounded-full p-2 sm:p-3 ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-xs sm:text-sm font-medium text-neutral-500">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-neutral-900">{value}</p>
      </div>
    </Card>
  );
}

/**
 * ReportSummary displays the summary statistics for a remediation report
 * Requirements: 5.2
 */
export function ReportSummary({ summary }: ReportSummaryProps) {
  const { totalViolations, fixedCount, skippedCount, humanReviewCount } = summary;

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4"
      role="region"
      aria-label="Report summary"
    >
      <SummaryCard
        icon={<TotalIcon />}
        label="Total Violations"
        value={totalViolations}
        colorClass="bg-neutral-100"
      />
      <SummaryCard
        icon={<FixedIcon />}
        label="Fixed"
        value={fixedCount}
        colorClass="bg-success-100"
      />
      <SummaryCard
        icon={<SkippedIcon />}
        label="Skipped"
        value={skippedCount}
        colorClass="bg-warning-100"
      />
      <SummaryCard
        icon={<HumanReviewIcon />}
        label="Human Review"
        value={humanReviewCount}
        colorClass="bg-primary-100"
      />
    </div>
  );
}
