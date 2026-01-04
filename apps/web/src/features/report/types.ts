/**
 * Report feature types
 * Requirements: 5.1, 5.5
 */
import type {
  RemediationReport,
  AppliedFix,
  SkippedViolation,
  HumanReviewItem,
} from '@/types/domain';

// Re-export domain types used in report feature
export type { RemediationReport, AppliedFix, SkippedViolation, HumanReviewItem };

/**
 * Export format options
 * Requirements: 5.5
 */
export type ExportFormat = 'json' | 'html';

/**
 * Props for the FixCard component
 * Requirements: 4.1, 4.4
 */
export interface FixCardProps {
  fix: AppliedFix;
  onCopy?: (html: string) => void;
}

/**
 * Props for the ReportSummary component
 * Requirements: 5.2
 */
export interface ReportSummaryProps {
  summary: RemediationReport['summary'];
}

/**
 * Props for the ReportView component
 * Requirements: 5.1
 */
export interface ReportViewProps {
  report: RemediationReport;
}

/**
 * Props for the ExportButtons component
 * Requirements: 5.5
 */
export interface ExportButtonsProps {
  sessionId: string;
  onExport?: (format: ExportFormat) => void;
}
