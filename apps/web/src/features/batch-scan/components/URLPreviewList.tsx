/**
 * URLPreviewList component for displaying and selecting parsed URLs
 * Requirements: 6.4, 6.5
 */
import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import type { ParsedUrl } from '@/types/domain';

/**
 * Props for the URLPreviewList component
 * Requirements: 6.4, 6.5
 */
export interface URLPreviewListProps {
    /** List of parsed URLs from sitemap */
    urls: ParsedUrl[];
    /** Set of selected URL strings */
    selectedUrls: Set<string>;
    /** Callback when selection changes */
    onSelectionChange: (selected: Set<string>) => void;
    /** Callback when user confirms selection */
    onConfirm: () => void;
    /** Callback when user cancels */
    onCancel: () => void;
    /** Whether a batch scan is being created */
    isLoading?: boolean;
}

/** Number of URLs to display per page */
const PAGE_SIZE = 20;

/**
 * Format a date string for display
 */
function formatDate(dateString?: string): string {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return dateString;
    }
}

/**
 * Format priority value for display
 */
function formatPriority(priority?: number): string {
    if (priority === undefined) return '-';
    return priority.toFixed(1);
}

/**
 * Component for displaying and selecting URLs parsed from a sitemap
 * Requirements: 6.4, 6.5
 */
export function URLPreviewList({
    urls,
    selectedUrls,
    onSelectionChange,
    onConfirm,
    onCancel,
    isLoading = false,
}: URLPreviewListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Filter URLs based on search query
    const filteredUrls = useMemo(() => {
        if (!searchQuery.trim()) return urls;
        const query = searchQuery.toLowerCase();
        return urls.filter((url) => url.loc.toLowerCase().includes(query));
    }, [urls, searchQuery]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredUrls.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedUrls = filteredUrls.slice(startIndex, endIndex);

    // Check if all filtered URLs are selected
    const allFilteredSelected = useMemo(() => {
        return filteredUrls.length > 0 && filteredUrls.every((url) => selectedUrls.has(url.loc));
    }, [filteredUrls, selectedUrls]);

    // Check if some filtered URLs are selected
    const someFilteredSelected = useMemo(() => {
        return filteredUrls.some((url) => selectedUrls.has(url.loc));
    }, [filteredUrls, selectedUrls]);

    // Handle individual URL selection toggle
    const handleToggleUrl = useCallback(
        (url: string) => {
            const newSelected = new Set(selectedUrls);
            if (newSelected.has(url)) {
                newSelected.delete(url);
            } else {
                newSelected.add(url);
            }
            onSelectionChange(newSelected);
        },
        [selectedUrls, onSelectionChange]
    );

    // Handle select/deselect all filtered URLs
    const handleToggleAll = useCallback(() => {
        const newSelected = new Set(selectedUrls);
        if (allFilteredSelected) {
            // Deselect all filtered URLs
            filteredUrls.forEach((url) => newSelected.delete(url.loc));
        } else {
            // Select all filtered URLs
            filteredUrls.forEach((url) => newSelected.add(url.loc));
        }
        onSelectionChange(newSelected);
    }, [allFilteredSelected, filteredUrls, selectedUrls, onSelectionChange]);

    // Handle search input change
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // Reset to first page on search
    }, []);

    // Handle page navigation
    const goToPage = useCallback((page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    }, [totalPages]);

    return (
        <div className="space-y-4">
            {/* Header with stats */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-neutral-100">
                        URLs Discovered
                    </h3>
                    <p className="text-sm text-neutral-400">
                        {selectedUrls.size} of {urls.length} URLs selected
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleAll}
                    disabled={isLoading || filteredUrls.length === 0}
                >
                    {allFilteredSelected ? 'Deselect All' : 'Select All'}
                    {searchQuery && ` (${filteredUrls.length})`}
                </Button>
            </div>

            {/* Search input */}
            <Input
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search URLs..."
                disabled={isLoading}
                leftIcon={
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                }
            />

            {/* URL list */}
            <div className="border border-neutral-700 rounded-lg overflow-hidden">
                {/* Table header */}
                <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
                    <div className="flex items-center gap-4">
                        <div className="w-8">
                            <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                ref={(el) => {
                                    if (el) {
                                        el.indeterminate = someFilteredSelected && !allFilteredSelected;
                                    }
                                }}
                                onChange={handleToggleAll}
                                disabled={isLoading || filteredUrls.length === 0}
                                className="h-4 w-4 rounded border-neutral-600 bg-neutral-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-neutral-900"
                                aria-label="Select all URLs"
                            />
                        </div>
                        <div className="flex-1 text-sm font-medium text-neutral-300">URL</div>
                        <div className="w-28 text-sm font-medium text-neutral-300 text-center">Last Modified</div>
                        <div className="w-20 text-sm font-medium text-neutral-300 text-center">Priority</div>
                    </div>
                </div>

                {/* URL rows */}
                <div className="max-h-96 overflow-y-auto">
                    {paginatedUrls.length === 0 ? (
                        <div className="px-4 py-8 text-center text-neutral-400">
                            {searchQuery ? 'No URLs match your search' : 'No URLs found'}
                        </div>
                    ) : (
                        paginatedUrls.map((url) => (
                            <label
                                key={url.loc}
                                className={clsx(
                                    'flex items-center gap-4 px-4 py-3 border-b border-neutral-800 last:border-b-0',
                                    'hover:bg-neutral-800/50 cursor-pointer transition-colors',
                                    selectedUrls.has(url.loc) && 'bg-primary-500/10'
                                )}
                            >
                                <div className="w-8">
                                    <input
                                        type="checkbox"
                                        checked={selectedUrls.has(url.loc)}
                                        onChange={() => handleToggleUrl(url.loc)}
                                        disabled={isLoading}
                                        className="h-4 w-4 rounded border-neutral-600 bg-neutral-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-neutral-900"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-neutral-200 truncate" title={url.loc}>
                                        {url.loc}
                                    </p>
                                </div>
                                <div className="w-28 text-sm text-neutral-400 text-center">
                                    {formatDate(url.lastmod)}
                                </div>
                                <div className="w-20 text-sm text-neutral-400 text-center">
                                    {formatPriority(url.priority)}
                                </div>
                            </label>
                        ))
                    )}
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-400">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredUrls.length)} of{' '}
                        {filteredUrls.length} URLs
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1 || isLoading}
                            aria-label="Previous page"
                        >
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
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </Button>
                        <span className="text-sm text-neutral-300">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages || isLoading}
                            aria-label="Next page"
                        >
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
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </Button>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-700">
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={onConfirm}
                    disabled={selectedUrls.size === 0 || isLoading}
                    isLoading={isLoading}
                    data-testid="confirm-urls-button"
                >
                    {isLoading ? (
                        'Starting Batch Scan...'
                    ) : (
                        <>
                            Start Batch Scan ({selectedUrls.size} URLs)
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
