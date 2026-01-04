/**
 * BatchExportButtons component - Export batch report in various formats
 * Requirements: 10.5
 */
import { useState } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/shared/components/ui/Button';
import { exportBatchReport } from '../api/batchApi';

/**
 * Props for the BatchExportButtons component
 * Requirements: 10.5
 */
export interface BatchExportButtonsProps {
    /** Batch ID to export report for */
    batchId: string;
    /** Optional batch name for the filename */
    batchName?: string;
    /** Optional class name for the container */
    className?: string;
}

/**
 * Download a blob as a file
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

/**
 * Generate a filename for the export
 */
function generateFilename(batchName: string | undefined, format: 'json' | 'html'): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const baseName = batchName
        ? batchName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : 'batch-report';
    return `${baseName}-${timestamp}.${format}`;
}

/**
 * JSON icon component
 */
function JsonIcon({ className }: { className?: string }) {
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
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
        </svg>
    );
}

/**
 * HTML icon component
 */
function HtmlIcon({ className }: { className?: string }) {
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
 * Download icon component
 */
function DownloadIcon({ className }: { className?: string }) {
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
        </svg>
    );
}

/**
 * BatchExportButtons component
 * Requirements: 10.5
 */
export function BatchExportButtons({
    batchId,
    batchName,
    className,
}: BatchExportButtonsProps) {
    const [isExportingJson, setIsExportingJson] = useState(false);
    const [isExportingHtml, setIsExportingHtml] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Handle JSON export
     */
    const handleExportJson = async () => {
        setIsExportingJson(true);
        setError(null);

        try {
            const blob = await exportBatchReport(batchId, 'json');
            const filename = generateFilename(batchName, 'json');
            downloadBlob(blob, filename);
        } catch (err) {
            console.error('Failed to export JSON:', err);
            setError('Failed to export JSON report');
        } finally {
            setIsExportingJson(false);
        }
    };

    /**
     * Handle HTML export
     */
    const handleExportHtml = async () => {
        setIsExportingHtml(true);
        setError(null);

        try {
            const blob = await exportBatchReport(batchId, 'html');
            const filename = generateFilename(batchName, 'html');
            downloadBlob(blob, filename);
        } catch (err) {
            console.error('Failed to export HTML:', err);
            setError('Failed to export HTML report');
        } finally {
            setIsExportingHtml(false);
        }
    };

    return (
        <div className={clsx('space-y-2', className)} data-testid="batch-export-buttons">
            <div className="flex flex-wrap gap-2">
                {/* JSON Export Button */}
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportJson}
                    isLoading={isExportingJson}
                    disabled={isExportingJson || isExportingHtml}
                    data-testid="export-json-button"
                >
                    {!isExportingJson && <JsonIcon className="w-4 h-4" />}
                    Export JSON
                    {!isExportingJson && <DownloadIcon className="w-4 h-4" />}
                </Button>

                {/* HTML Export Button */}
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportHtml}
                    isLoading={isExportingHtml}
                    disabled={isExportingJson || isExportingHtml}
                    data-testid="export-html-button"
                >
                    {!isExportingHtml && <HtmlIcon className="w-4 h-4" />}
                    Export HTML
                    {!isExportingHtml && <DownloadIcon className="w-4 h-4" />}
                </Button>
            </div>

            {/* Error message */}
            {error && (
                <div
                    role="alert"
                    className="text-sm text-error-600 bg-error-50 px-3 py-2 rounded-lg"
                >
                    {error}
                </div>
            )}
        </div>
    );
}
