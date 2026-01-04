/**
 * Scanner Service
 * 
 * Core scanning logic using axe-core for WCAG 2.1 AA accessibility auditing.
 * 
 * Features:
 * - URL navigation with timeout handling (30s)
 * - axe-core injection and execution
 * - Transform axe-core output to ScanResult format
 * - Violation sorting by impact level
 * - Result pagination
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.3, 5.1, 5.2, 5.3, 5.4
 */

import type { Page, BrowserContext } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import type {
    ScanResult,
    ScanMetadata,
    PaginationInfo,
    Violation,
    ViolationNode,
    ImpactLevel,
    Viewport,
    ViolationCounts,
    AuditorError
} from '../types/index.js';
import { SCHEMA_VERSION, IMPACT_PRIORITY } from '../types/index.js';
import type { BrowserProvider } from '../providers/browser-provider.js';

/**
 * Default page size for pagination
 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Default timeout for page navigation (30 seconds)
 */
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Scan options for the Scanner service
 */
export interface ScanOptions {
    /** URL to scan */
    url: string;
    /** Viewport configuration */
    viewport?: Viewport;
    /** Page number for pagination (1-indexed) */
    page?: number;
}

/**
 * Raw axe-core result node structure
 */
interface AxeNode {
    target: string[];
    html: string;
    failureSummary?: string;
}

/**
 * Raw axe-core violation structure
 */
interface AxeViolation {
    id: string;
    impact?: string;
    description: string;
    help: string;
    helpUrl: string;
    nodes: AxeNode[];
}

/**
 * Raw axe-core result structure
 */
interface AxeResults {
    violations: AxeViolation[];
}


/**
 * Scanner Service
 * 
 * Provides WCAG 2.1 AA accessibility scanning capabilities.
 */
export class ScannerService {
    private browserProvider: BrowserProvider;

    constructor(browserProvider: BrowserProvider) {
        this.browserProvider = browserProvider;
    }

    /**
     * Scans a URL for accessibility violations
     * 
     * Requirements:
     * - 1.1: Navigate to URL and wait for page load
     * - 1.2: Execute axe-core analysis against full DOM
     * - 1.3: Return ScanResult with all detected violations
     * 
     * @param options - Scan configuration options
     * @returns ScanResult with violations and metadata
     * @throws AuditorError on failure
     */
    async scan(options: ScanOptions): Promise<ScanResult> {
        const { url, viewport = 'desktop', page = 1 } = options;
        let context: BrowserContext | null = null;
        let browserPage: Page | null = null;

        try {
            // Create browser context with viewport
            context = await this.browserProvider.createContext(viewport);
            browserPage = await this.browserProvider.createPage(context);

            // Navigate to URL with timeout handling (Requirement 1.1)
            await this.navigateToUrl(browserPage, url);

            // Execute axe-core analysis (Requirement 1.2)
            const axeResults = await this.runAxeAnalysis(browserPage);

            // Transform to ScanResult format (Requirement 1.3)
            return this.transformToScanResult(axeResults, url, viewport, page);
        } finally {
            // Clean up resources
            if (browserPage) {
                await browserPage.close().catch(() => { /* ignore cleanup errors */ });
            }
            if (context) {
                await context.close().catch(() => { /* ignore cleanup errors */ });
            }
        }
    }

    /**
     * Navigates to the specified URL with timeout handling
     * 
     * Requirement 1.5: Timeout after 30 seconds
     */
    private async navigateToUrl(page: Page, url: string): Promise<void> {
        try {
            await page.goto(url, {
                timeout: DEFAULT_TIMEOUT_MS,
                waitUntil: 'domcontentloaded'
            });
        } catch (error) {
            const err = error as Error;

            // Check for timeout
            if (err.message.includes('Timeout') || err.message.includes('timeout')) {
                throw this.createError('TIMEOUT', `Page load exceeded ${DEFAULT_TIMEOUT_MS}ms timeout`, { url });
            }

            // Check for unreachable URL (Requirement 1.4)
            if (err.message.includes('net::ERR_') || err.message.includes('NS_ERROR_')) {
                throw this.createError('URL_UNREACHABLE', `Failed to reach URL: ${url}`, { url, originalError: err.message });
            }

            // Re-throw other errors
            throw this.createError('URL_UNREACHABLE', err.message, { url });
        }
    }

    /**
     * Runs axe-core analysis on the page
     * 
     * Requirement 1.2: Execute axe-core analysis against full DOM
     */
    private async runAxeAnalysis(page: Page): Promise<AxeResults> {
        try {
            // Include best-practice rules alongside WCAG tags to catch important
            // accessibility issues like missing landmarks, region violations, etc.
            // This aligns with what other accessibility checkers report
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
                .analyze();

            return results as AxeResults;
        } catch (error) {
            const err = error as Error;
            throw this.createError('AXE_INJECTION_FAILED', `Failed to run axe-core analysis: ${err.message}`);
        }
    }

    /**
     * Transforms axe-core results to ScanResult format
     */
    private transformToScanResult(
        axeResults: AxeResults,
        url: string,
        viewport: Viewport,
        page: number
    ): ScanResult {
        // Transform violations
        const allViolations = this.transformViolations(axeResults.violations);

        // Sort violations by impact level (Requirement 2.3)
        const sortedViolations = sortViolationsByImpact(allViolations);

        // Calculate violation counts
        const violationCounts = this.calculateViolationCounts(sortedViolations);

        // Apply pagination (Requirements 5.1, 5.2, 5.3, 5.4)
        const { paginatedViolations, pagination } = paginateViolations(
            sortedViolations,
            page,
            DEFAULT_PAGE_SIZE
        );

        // Build metadata (Requirement 2.4)
        const metadata: ScanMetadata = {
            url,
            timestamp: new Date().toISOString(),
            viewport,
            violationCounts
        };

        return {
            schemaVersion: SCHEMA_VERSION,
            metadata,
            violations: paginatedViolations,
            pagination
        };
    }

    /**
     * Transforms axe-core violations to our Violation format
     */
    private transformViolations(axeViolations: AxeViolation[]): Violation[] {
        return axeViolations.map(v => ({
            id: v.id,
            impact: this.normalizeImpact(v.impact),
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: this.transformNodes(v.nodes)
        }));
    }

    /**
     * Transforms axe-core nodes to our ViolationNode format
     */
    private transformNodes(axeNodes: AxeNode[]): ViolationNode[] {
        return axeNodes.map(n => ({
            selector: n.target.join(' > '),
            html: n.html,
            failureSummary: n.failureSummary ?? 'No failure summary available',
            target: n.target
        }));
    }

    /**
     * Normalizes impact level from axe-core output
     */
    private normalizeImpact(impact?: string): ImpactLevel {
        if (impact === 'critical' || impact === 'serious' || impact === 'moderate' || impact === 'minor') {
            return impact;
        }
        return 'minor'; // Default to minor if unknown
    }

    /**
     * Calculates violation counts by impact level
     */
    private calculateViolationCounts(violations: Violation[]): ViolationCounts {
        const counts: ViolationCounts = {
            critical: 0,
            serious: 0,
            moderate: 0,
            minor: 0,
            total: violations.length
        };

        for (const v of violations) {
            counts[v.impact]++;
        }

        return counts;
    }

    /**
     * Creates an AuditorError
     */
    private createError(
        code: AuditorError['code'],
        message: string,
        details?: Record<string, unknown>
    ): AuditorError {
        return {
            code,
            message,
            details,
            stack: new Error().stack
        };
    }
}


// ============================================================================
// Utility Functions (exported for testing)
// ============================================================================

/**
 * Sorts violations by impact level in descending severity order
 * 
 * Requirement 2.3: Sort violations by Impact_Level in order: critical → serious → moderate → minor
 * 
 * Uses stable sort to maintain consistent ordering for pagination (Requirement 5.4)
 * 
 * @param violations - Array of violations to sort
 * @returns New array sorted by impact level (critical first, minor last)
 */
export function sortViolationsByImpact(violations: Violation[]): Violation[] {
    // Create a copy to avoid mutating the original array
    return [...violations].sort((a, b) => {
        // Sort by impact priority (higher priority = more severe = comes first)
        return IMPACT_PRIORITY[b.impact] - IMPACT_PRIORITY[a.impact];
    });
}

/**
 * Paginates violations array
 * 
 * Requirements:
 * - 5.1: Return only top 10 violations by impact level when more than 10 exist
 * - 5.2: Include hasMoreViolations flag and total count
 * - 5.3: Support page parameter for navigation
 * - 5.4: Maintain consistent ordering across paginated requests
 * 
 * @param violations - Sorted array of all violations
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of violations per page
 * @returns Paginated violations and pagination metadata
 */
export function paginateViolations(
    violations: Violation[],
    page: number = 1,
    pageSize: number = DEFAULT_PAGE_SIZE
): { paginatedViolations: Violation[]; pagination: PaginationInfo } {
    const totalViolations = violations.length;
    const totalPages = Math.max(1, Math.ceil(totalViolations / pageSize));

    // Clamp page to valid range
    const validPage = Math.max(1, Math.min(page, totalPages));

    // Calculate slice indices
    const startIndex = (validPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Get the page slice
    const paginatedViolations = violations.slice(startIndex, endIndex);

    // Build pagination info
    const pagination: PaginationInfo = {
        currentPage: validPage,
        totalPages,
        pageSize,
        hasMoreViolations: validPage < totalPages
    };

    return { paginatedViolations, pagination };
}
