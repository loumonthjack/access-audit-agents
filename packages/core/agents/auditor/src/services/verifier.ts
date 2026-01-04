/**
 * Verifier Service
 * 
 * Element-level verification for post-fix validation using axe-core.
 * 
 * Features:
 * - Run axe-core checks scoped to specific selector
 * - Return pass/fail status with violations if failed
 * - Handle element not found errors
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import type { Page, BrowserContext } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import type {
    VerifyResult,
    VerifyOptions,
    Violation,
    ViolationNode,
    ImpactLevel,
    AuditorError
} from '../types/index.js';
import type { BrowserProvider } from '../providers/browser-provider.js';

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
    passes: unknown[];
}

/**
 * Verifier Service
 * 
 * Provides element-level accessibility verification capabilities.
 * Used to verify a specific element after applying a fix.
 */
export class VerifierService {
    private _browserProvider: BrowserProvider;
    private page: Page | null = null;
    private context: BrowserContext | null = null;

    constructor(browserProvider: BrowserProvider) {
        this._browserProvider = browserProvider;
    }

    /**
     * Gets the browser provider
     */
    get browserProvider(): BrowserProvider {
        return this._browserProvider;
    }

    /**
     * Verifies a specific element for accessibility compliance
     * 
     * Requirements:
     * - 4.1: Run axe-core checks only on the specified element
     * - 4.2: Return status "pass" with score when verification passes
     * - 4.3: Return status "fail" with violations when verification fails
     * - 4.4: Return error when selector doesn't match any element
     * 
     * @param options - Verification options (selector and ruleId)
     * @returns VerifyResult with pass/fail status
     * @throws AuditorError on failure
     */
    async verify(options: VerifyOptions): Promise<VerifyResult> {
        const { selector, ruleId } = options;

        if (!this.page) {
            throw this.createError(
                'BROWSER_PROVIDER_UNAVAILABLE',
                'No page available. Call setPage() first or use verifyOnPage().'
            );
        }

        // Check if element exists (Requirement 4.4)
        const elementExists = await this.checkElementExists(this.page, selector);
        if (!elementExists) {
            throw this.createError(
                'ELEMENT_NOT_FOUND',
                `Element not found for selector: ${selector}`,
                { selector }
            );
        }

        // Run axe-core scoped to the specific element (Requirement 4.1)
        const axeResults = await this.runScopedAxeAnalysis(this.page, selector, ruleId);

        // Transform results to VerifyResult format
        return this.transformToVerifyResult(axeResults, ruleId);
    }

    /**
     * Verifies a specific element on a provided page
     * 
     * This is a convenience method that doesn't require setting up the page first.
     * 
     * @param page - Playwright page to verify on
     * @param options - Verification options (selector and ruleId)
     * @returns VerifyResult with pass/fail status
     * @throws AuditorError on failure
     */
    async verifyOnPage(page: Page, options: VerifyOptions): Promise<VerifyResult> {
        const { selector, ruleId } = options;

        // Check if element exists (Requirement 4.4)
        const elementExists = await this.checkElementExists(page, selector);
        if (!elementExists) {
            throw this.createError(
                'ELEMENT_NOT_FOUND',
                `Element not found for selector: ${selector}`,
                { selector }
            );
        }

        // Run axe-core scoped to the specific element (Requirement 4.1)
        const axeResults = await this.runScopedAxeAnalysis(page, selector, ruleId);

        // Transform results to VerifyResult format
        return this.transformToVerifyResult(axeResults, ruleId);
    }

    /**
     * Sets the page to use for verification
     */
    setPage(page: Page): void {
        this.page = page;
    }

    /**
     * Sets the browser context
     */
    setContext(context: BrowserContext): void {
        this.context = context;
    }

    /**
     * Cleans up resources
     */
    async cleanup(): Promise<void> {
        if (this.page) {
            await this.page.close().catch(() => { /* ignore cleanup errors */ });
            this.page = null;
        }
        if (this.context) {
            await this.context.close().catch(() => { /* ignore cleanup errors */ });
            this.context = null;
        }
    }

    /**
     * Checks if an element exists on the page
     */
    private async checkElementExists(page: Page, selector: string): Promise<boolean> {
        try {
            const element = await page.$(selector);
            return element !== null;
        } catch {
            return false;
        }
    }

    /**
     * Runs axe-core analysis scoped to a specific element and rule
     * 
     * Requirement 4.1: Run axe-core checks only on the specified element
     */
    private async runScopedAxeAnalysis(
        page: Page,
        selector: string,
        ruleId: string
    ): Promise<AxeResults> {
        try {
            const results = await new AxeBuilder({ page })
                .include(selector)
                .withRules([ruleId])
                .analyze();

            return results as AxeResults;
        } catch (error) {
            const err = error as Error;
            throw this.createError(
                'AXE_INJECTION_FAILED',
                `Failed to run axe-core analysis: ${err.message}`
            );
        }
    }

    /**
     * Transforms axe-core results to VerifyResult format
     * 
     * Requirements:
     * - 4.2: Return status "pass" with score when no violations
     * - 4.3: Return status "fail" with violations when violations exist
     */
    private transformToVerifyResult(axeResults: AxeResults, ruleId: string): VerifyResult {
        const relevantViolations = axeResults.violations.filter(v => v.id === ruleId);

        if (relevantViolations.length === 0) {
            // Requirement 4.2: Pass result with score
            return {
                status: 'pass',
                score: 100
            };
        }

        // Requirement 4.3: Fail result with violations
        const violations = this.transformViolations(relevantViolations);
        return {
            status: 'fail',
            violations,
            score: 0
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
