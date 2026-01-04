/**
 * History feature types
 * Requirements: 6.1, 6.2, 6.5
 */
import type { ScanSession } from '@/types/domain';

// Re-export domain types used in history feature
export type { ScanSession };

/**
 * Options for the useSessionHistory hook
 * Requirements: 6.5
 */
export interface SessionHistoryOptions {
  page: number;
  limit?: number;
}

/**
 * Props for the SessionCard component
 * Requirements: 6.2
 */
export interface SessionCardProps {
  session: ScanSession;
  onView: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}

/**
 * Props for the SessionList component
 * Requirements: 6.1
 */
export interface SessionListProps {
  sessions: ScanSession[];
  onView: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  isLoading?: boolean;
}

/**
 * Props for the Pagination component
 * Requirements: 6.5
 */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Props for the DeleteConfirmDialog component
 * Requirements: 6.4
 */
export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  sessionUrl: string;
  onConfirm: () => void;
  onCancel: () => void;
}
