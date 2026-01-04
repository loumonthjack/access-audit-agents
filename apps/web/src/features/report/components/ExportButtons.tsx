/**
 * ExportButtons component
 * Export report as JSON or HTML
 * Requirements: 5.5
 */
import { Button } from '@/shared/components/ui/Button';
import { useExportReport } from '../api/reportApi';
import type { ExportButtonsProps, ExportFormat } from '../types';

/**
 * Download icon
 */
const DownloadIcon = () => (
    <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
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

/**
 * JSON icon
 */
const JsonIcon = () => (
    <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
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

/**
 * HTML icon
 */
const HtmlIcon = () => (
    <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
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

/**
 * ExportButtons provides export functionality for reports
 * Requirements: 5.5
 */
export function ExportButtons({ sessionId, onExport }: ExportButtonsProps) {
    const exportMutation = useExportReport();

    const handleExport = (format: ExportFormat) => {
        exportMutation.mutate(
            { sessionId, format },
            {
                onSuccess: () => {
                    onExport?.(format);
                },
            }
        );
    };

    const isExporting = exportMutation.isPending;

    return (
        <div className="flex items-center gap-2" data-testid="export-buttons">
            <span className="mr-2 text-sm font-medium text-neutral-600">
                <DownloadIcon />
            </span>
            <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExport('json')}
                isLoading={isExporting && exportMutation.variables?.format === 'json'}
                disabled={isExporting}
                leftIcon={<JsonIcon />}
                aria-label="Export report as JSON"
            >
                JSON
            </Button>
            <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExport('html')}
                isLoading={isExporting && exportMutation.variables?.format === 'html'}
                disabled={isExporting}
                leftIcon={<HtmlIcon />}
                aria-label="Export report as HTML"
            >
                HTML
            </Button>
        </div>
    );
}
