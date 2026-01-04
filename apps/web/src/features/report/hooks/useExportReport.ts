/**
 * useExportReport hook for exporting reports
 * Requirements: 5.5
 */
import { useMutation } from '@tanstack/react-query';
import { exportReport } from '../api/reportApi';
import type { ExportFormat } from '../types';

/**
 * Trigger file download from a Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface UseExportReportOptions {
  /** Callback when export succeeds */
  onSuccess?: (format: ExportFormat) => void;
  /** Callback when export fails */
  onError?: (error: Error) => void;
}

export interface UseExportReportReturn {
  /** Export the report */
  exportReport: (sessionId: string, format: ExportFormat) => void;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Current export format being processed */
  currentFormat: ExportFormat | null;
  /** Error if export failed */
  error: Error | null;
}

/**
 * Hook for exporting a remediation report
 * Handles the mutation and triggers file download
 * Requirements: 5.5
 */
export function useExportReport(options?: UseExportReportOptions): UseExportReportReturn {
  const mutation = useMutation({
    mutationFn: ({ sessionId, format }: { sessionId: string; format: ExportFormat }) =>
      exportReport(sessionId, format),
    onSuccess: (blob, { sessionId, format }) => {
      downloadBlob(blob, `accessibility-report-${sessionId}.${format}`);
      options?.onSuccess?.(format);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });

  return {
    exportReport: (sessionId: string, format: ExportFormat) =>
      mutation.mutate({ sessionId, format }),
    isExporting: mutation.isPending,
    currentFormat: mutation.isPending ? (mutation.variables?.format ?? null) : null,
    error: mutation.error,
  };
}
