/**
 * Structure Analyzer Service
 * 
 * Lightweight DOM analysis for selector fuzzy-matching when the AI hallucinates selectors.
 * 
 * Features:
 * - Extract interactive elements (buttons, links, inputs)
 * - Extract landmarks and headings
 * - Return lightweight DOM outline for fuzzy matching
 * 
 * Requirements: 9.3
 */

import type { Page, BrowserContext, Locator } from 'playwright';
import type { PageStructure, ElementSummary, AuditorError } from '../types/index.js';
import type { BrowserProvider } from '../providers/browser-provider.js';

/**
 * Structure Analyzer Service
 * 
 * Provides lightweight DOM analysis capabilities for selector fuzzy-matching.
 * Used when the AI needs to find elements on a page without exact selectors.
 */
export class StructureAnalyzerService {
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
     * Analyzes the page structure and returns a lightweight DOM outline
     * 
     * Requirement 9.3: GetPageStructure action returns a lightweight DOM outline
     * 
     * @returns PageStructure with interactive elements, landmarks, and headings
     * @throws AuditorError on failure
     */
    async analyze(): Promise<PageStructure> {
        if (!this.page) {
            throw this.createError(
                'BROWSER_PROVIDER_UNAVAILABLE',
                'No page available. Call setPage() first or use analyzeOnPage().'
            );
        }

        return this.analyzeOnPage(this.page);
    }

    /**
     * Analyzes the page structure on a provided page
     * 
     * This is a convenience method that doesn't require setting up the page first.
     * 
     * @param page - Playwright page to analyze
     * @returns PageStructure with interactive elements, landmarks, and headings
     * @throws AuditorError on failure
     */
    async analyzeOnPage(page: Page): Promise<PageStructure> {
        try {
            const [interactiveElements, landmarks, headings] = await Promise.all([
                this.extractInteractiveElements(page),
                this.extractLandmarks(page),
                this.extractHeadings(page)
            ]);

            return {
                interactiveElements,
                landmarks,
                headings
            };
        } catch (error) {
            const err = error as Error;
            // Re-throw if it's already an AuditorError
            if (this.isAuditorError(err)) {
                throw err;
            }
            throw this.createError(
                'AXE_INJECTION_FAILED',
                `Failed to analyze page structure: ${err.message}`
            );
        }
    }

    /**
     * Sets the page to use for analysis
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
     * Extracts interactive elements (buttons, links, inputs) from the page
     */
    private async extractInteractiveElements(page: Page): Promise<ElementSummary[]> {
        const selector = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menuitem"], [role="tab"], [tabindex]:not([tabindex="-1"])';

        const locator = page.locator(selector);
        const count = await locator.count();
        const elements: ElementSummary[] = [];

        for (let i = 0; i < count; i++) {
            const element = locator.nth(i);
            const summary = await this.extractElementSummary(element, i, 'interactive');
            if (summary) {
                elements.push(summary);
            }
        }

        return elements;
    }

    /**
     * Extracts landmark elements from the page
     */
    private async extractLandmarks(page: Page): Promise<ElementSummary[]> {
        const selector = 'header, nav, main, aside, footer, section[aria-label], section[aria-labelledby], [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="region"][aria-label], [role="region"][aria-labelledby], [role="search"], [role="form"]';

        const locator = page.locator(selector);
        const count = await locator.count();
        const elements: ElementSummary[] = [];

        for (let i = 0; i < count; i++) {
            const element = locator.nth(i);
            const summary = await this.extractElementSummary(element, i, 'landmark');
            if (summary) {
                elements.push(summary);
            }
        }

        return elements;
    }

    /**
     * Extracts heading elements from the page
     */
    private async extractHeadings(page: Page): Promise<ElementSummary[]> {
        const selector = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

        const locator = page.locator(selector);
        const count = await locator.count();
        const elements: ElementSummary[] = [];

        for (let i = 0; i < count; i++) {
            const element = locator.nth(i);
            const summary = await this.extractElementSummary(element, i, 'heading');
            if (summary) {
                elements.push(summary);
            }
        }

        return elements;
    }

    /**
     * Extracts summary information from a single element
     */
    private async extractElementSummary(
        locator: Locator,
        index: number,
        type: 'interactive' | 'landmark' | 'heading'
    ): Promise<ElementSummary | null> {
        try {
            const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
            const id = await locator.getAttribute('id');
            const role = await locator.getAttribute('role');
            const ariaLabel = await locator.getAttribute('aria-label');
            const name = await locator.getAttribute('name');

            // Generate selector
            let selector: string;
            if (id) {
                selector = `#${id}`;
            } else if (name) {
                selector = `${tagName}[name="${name}"]`;
            } else if (role && ariaLabel) {
                selector = `[role="${role}"][aria-label="${ariaLabel}"]`;
            } else {
                selector = `${tagName}:nth-of-type(${index + 1})`;
            }

            // Get role (explicit or implicit)
            const effectiveRole = role ?? this.getImplicitRole(tagName, type);

            // Get accessible text
            let text: string | undefined;
            if (ariaLabel) {
                text = ariaLabel.trim();
            } else {
                const textContent = await locator.textContent();
                if (textContent) {
                    text = textContent.trim().substring(0, 100);
                }
            }

            const result: ElementSummary = {
                selector,
                tagName
            };

            if (effectiveRole) {
                result.role = effectiveRole;
            }

            if (text) {
                result.text = text;
            }

            return result;
        } catch {
            // Element may have been removed from DOM
            return null;
        }
    }

    /**
     * Gets the implicit ARIA role for an element based on its tag name
     */
    private getImplicitRole(tagName: string, type: 'interactive' | 'landmark' | 'heading'): string | undefined {
        if (type === 'interactive') {
            const roleMap: Record<string, string> = {
                'button': 'button',
                'a': 'link',
                'input': 'textbox',
                'select': 'combobox',
                'textarea': 'textbox'
            };
            return roleMap[tagName];
        }

        if (type === 'landmark') {
            const roleMap: Record<string, string> = {
                'header': 'banner',
                'nav': 'navigation',
                'main': 'main',
                'aside': 'complementary',
                'footer': 'contentinfo',
                'section': 'region',
                'form': 'form',
                'article': 'article'
            };
            return roleMap[tagName];
        }

        if (type === 'heading') {
            return 'heading';
        }

        return undefined;
    }

    /**
     * Checks if an error is an AuditorError
     */
    private isAuditorError(error: unknown): error is AuditorError {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            'message' in error
        );
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
