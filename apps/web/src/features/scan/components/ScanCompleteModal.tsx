/**
 * ScanCompleteModal component - Shows scan completion summary with navigation to report
 * Requirements: 2.4
 */
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/Button';
import type { ScanSession } from '@/types/domain';

export interface ScanCompleteModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Session data for summary display */
  session: ScanSession;
  /** Callback when user clicks View Report */
  onViewReport: () => void;
  /** Callback when user closes modal */
  onClose: () => void;
}

/**
 * Success checkmark icon
 */
function CheckCircleIcon() {
  return (
    <svg
      className="h-12 w-12 text-success-500"
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
}

/**
 * ScanCompleteModal displays completion summary and navigation
 * Requirements: 2.4
 */
export function ScanCompleteModal({
  isOpen,
  session,
  onViewReport,
  onClose,
}: ScanCompleteModalProps) {
  const { violationCounts, fixCounts } = session;

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-50">
          <CheckCircleIcon />
        </div>
        <DialogHeader className="mt-4 text-center">Scan Complete!</DialogHeader>
      </div>

      <DialogBody>
        <p className="text-sm text-neutral-600 text-center mb-4">
          Accessibility scan finished for{' '}
          <span className="font-medium text-neutral-900 break-all">{session.url}</span>
        </p>

        {/* Summary stats grid */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <SummaryItem
            label="Total Violations"
            value={violationCounts?.total ?? 0}
            variant="neutral"
          />
          <SummaryItem label="Fixed" value={fixCounts?.fixed ?? 0} variant="success" />
          <SummaryItem label="Skipped" value={fixCounts?.skipped ?? 0} variant="error" />
          <SummaryItem label="Pending" value={fixCounts?.pending ?? 0} variant="warning" />
        </div>
      </DialogBody>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Stay on Scan
        </Button>
        <Button onClick={onViewReport} className="w-full sm:w-auto">
          View Report
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/**
 * Summary item component for displaying a stat
 */
interface SummaryItemProps {
  label: string;
  value: number;
  variant: 'neutral' | 'success' | 'error' | 'warning';
}

function SummaryItem({ label, value, variant }: SummaryItemProps) {
  const colorMap = {
    neutral: 'text-neutral-900',
    success: 'text-success-700',
    error: 'text-error-700',
    warning: 'text-warning-700',
  };

  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[variant]}`}>{value}</p>
    </div>
  );
}
