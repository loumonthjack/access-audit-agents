/**
 * Batch Scan feature types
 * Requirements: 6.1, 8.1, 9.1, 10.1
 */
import type {
    Viewport,
    BatchSession,
    BatchPage,
    BatchProgress,
    BatchSummary,
    BatchReport,
    BatchRecommendation,
    BatchStatus,
    BatchPageStatus,
    ParsedUrl,
    ImpactLevel,
} from '@/types/domain';

// Re-export domain types used in batch scan feature
export type {
    Viewport,
    BatchSession,
    BatchPage,
    BatchProgress,
    BatchSummary,
    BatchReport,
    BatchRecommendation,
    BatchStatus,
    BatchPageStatus,
    ParsedUrl,
    ImpactLevel,
};

/**
 * State of the sitemap form
 * Requirements: 6.1
 */
export interface SitemapFormState {
    sitemapUrl: string;
    maxUrls: number;
}

/**
 * Props for the SitemapForm component
 * Requirements: 6.1, 6.3
 */
export interface SitemapFormProps {
    onUrlsParsed: (urls: ParsedUrl[]) => void;
    isLoading: boolean;
    error?: string;
}

/**
 * Props for the URLPreviewList component
 * Requirements: 6.4, 6.5
 */
export interface URLPreviewListProps {
    urls: ParsedUrl[];
    selectedUrls: Set<string>;
    onSelectionChange: (selected: Set<string>) => void;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

/**
 * Props for the BatchProgress component
 * Requirements: 8.3, 9.1
 */
export interface BatchProgressProps {
    batchId: string;
    onPause?: () => void;
    onResume?: () => void;
    onCancel?: () => void;
}

/**
 * Props for the BatchReport component
 * Requirements: 10.1, 10.2
 */
export interface BatchReportProps {
    batchId: string;
}

/**
 * Response from sitemap parsing endpoint
 * Requirements: 6.2, 6.4
 */
export interface SitemapParseResponse {
    urls: ParsedUrl[];
    totalCount: number;
    truncated: boolean;
    sitemapType: 'standard' | 'index';
    parseTime: number;
}

/**
 * Request to parse a sitemap
 * Requirements: 6.1
 */
export interface SitemapParseRequest {
    sitemapUrl: string;
    maxUrls?: number;
}

/**
 * Request to create a batch scan
 * Requirements: 8.1
 */
export interface CreateBatchScanRequest {
    urls: string[];
    viewport: Viewport;
    name?: string;
}

/**
 * Options for the useBatchProgress hook
 * Requirements: 9.1
 */
export interface UseBatchProgressOptions {
    batchId: string;
    onPageComplete?: (pageUrl: string, violations: number) => void;
    onPageFailed?: (pageUrl: string, error: string) => void;
    onComplete?: (summary: BatchSummary) => void;
    onError?: (error: string) => void;
}

/**
 * Return type for the useBatchProgress hook
 * Requirements: 9.1
 */
export interface UseBatchProgressReturn {
    batch: BatchSession | undefined;
    progress: BatchProgress | null;
    currentPage: string | null;
    isConnected: boolean;
    error: string | null;
}

/**
 * Pagination state for URL preview list
 * Requirements: 6.5
 */
export interface URLPreviewPagination {
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Filter state for URL preview list
 * Requirements: 6.4
 */
export interface URLPreviewFilter {
    searchQuery: string;
}
