/**
 * Focus Obscured Analyzer Service
 * 
 * Geometric analysis service for WCAG 2.2 Focus Not Obscured (2.4.11).
 * Detects when focused elements are hidden behind sticky/fixed elements.
 * 
 * This analyzer goes beyond axe-core by performing runtime geometric analysis:
 * - Calculates bounding rectangles of focused elements
 * - Identifies sticky/fixed overlays (headers, footers, modals)
 * - Compares z-index stacking to detect occlusion
 * 
 * Requirements: WCAG 2.2 Success Criterion 2.4.11
 */

import type { Page } from 'playwright';
import type { Violation, ViolationNode, ImpactLevel } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Bounding rectangle for an element
 */
export interface BoundingRect {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
}

/**
 * Information about an element that may obscure focus
 */
export interface ObscuringElement {
    selector: string;
    tagName: string;
    position: 'fixed' | 'sticky';
    zIndex: number;
    boundingRect: BoundingRect;
    overlapPercentage: number;
}

/**
 * Result of focus visibility analysis for a single element
 */
export interface FocusObscuredResult {
    element: {
        selector: string;
        tagName: string;
        boundingRect: BoundingRect;
    };
    isObscured: boolean;
    overlapPercentage: number;
    obscuringElements: ObscuringElement[];
}

/**
 * Options for the focus obscured analyzer
 */
export interface FocusObscuredAnalyzerOptions {
    /** Minimum overlap percentage to consider obscured (default: 50%) */
    minOverlapThreshold?: number;
    /** Whether to check all focusable elements or just visible ones */
    includeHiddenElements?: boolean;
}

// ============================================================================
// Focus Obscured Analyzer Service
// ============================================================================

/**
 * Focus Obscured Analyzer
 * 
 * Analyzes pages for WCAG 2.2 Focus Not Obscured (2.4.11) violations.
 * Detects when tabbable elements become hidden behind sticky/fixed overlays.
 */
export class FocusObscuredAnalyzer {
    private readonly minOverlapThreshold: number;
    private readonly includeHiddenElements: boolean;

    constructor(options: FocusObscuredAnalyzerOptions = {}) {
        this.minOverlapThreshold = options.minOverlapThreshold ?? 50;
        this.includeHiddenElements = options.includeHiddenElements ?? false;
    }

    /**
     * Analyzes all focusable elements on the page for focus obscured violations
     * 
     * @param page - Playwright page instance
     * @returns Array of violations found
     */
    async analyze(page: Page): Promise<Violation[]> {
        // Get all focusable elements
        const focusableElements = await this.getFocusableElements(page);
        
        // Get all sticky/fixed overlay elements
        const overlayElements = await this.getOverlayElements(page);

        if (overlayElements.length === 0) {
            // No overlays, no possible violations
            return [];
        }

        // Analyze each focusable element
        const results: FocusObscuredResult[] = [];
        
        for (const focusable of focusableElements) {
            const result = await this.analyzeElementVisibility(
                page,
                focusable,
                overlayElements
            );
            
            if (result.isObscured) {
                results.push(result);
            }
        }

        // Transform results to Violation format
        return this.transformToViolations(results);
    }

    /**
     * Gets all focusable elements on the page
     */
    private async getFocusableElements(page: Page): Promise<Array<{ selector: string; tagName: string }>> {
        return page.evaluate((includeHidden: boolean) => {
            const focusableSelectors = [
                'a[href]',
                'button:not([disabled])',
                'input:not([disabled]):not([type="hidden"])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                '[tabindex]:not([tabindex="-1"])',
                '[contenteditable="true"]'
            ].join(', ');

            const elements = document.querySelectorAll(focusableSelectors);
            const results: Array<{ selector: string; tagName: string }> = [];

            elements.forEach((el, index) => {
                const htmlEl = el as HTMLElement;
                
                // Skip hidden elements unless explicitly included
                if (!includeHidden) {
                    const style = window.getComputedStyle(htmlEl);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return;
                    }
                }

                // Generate a unique selector
                let selector = el.tagName.toLowerCase();
                if (el.id) {
                    selector = `#${el.id}`;
                } else if (el.className && typeof el.className === 'string') {
                    const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
                    if (classes) {
                        selector = `${el.tagName.toLowerCase()}.${classes}`;
                    }
                }
                // Add index to ensure uniqueness
                selector = `${selector}:nth-of-type(${index + 1})`;

                results.push({
                    selector,
                    tagName: el.tagName.toLowerCase()
                });
            });

            return results;
        }, this.includeHiddenElements);
    }

    /**
     * Gets all sticky/fixed overlay elements that could obscure focus
     */
    private async getOverlayElements(page: Page): Promise<Array<{
        selector: string;
        tagName: string;
        position: 'fixed' | 'sticky';
        zIndex: number;
        boundingRect: BoundingRect;
    }>> {
        return page.evaluate(() => {
            const results: Array<{
                selector: string;
                tagName: string;
                position: 'fixed' | 'sticky';
                zIndex: number;
                boundingRect: BoundingRect;
            }> = [];

            // Get all elements
            const allElements = document.querySelectorAll('*');

            allElements.forEach((el) => {
                const htmlEl = el as HTMLElement;
                const style = window.getComputedStyle(htmlEl);
                const position = style.position;

                // Only interested in fixed or sticky elements
                if (position !== 'fixed' && position !== 'sticky') {
                    return;
                }

                // Skip invisible elements
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return;
                }

                // Get bounding rectangle
                const rect = htmlEl.getBoundingClientRect();
                
                // Skip elements with no size
                if (rect.width === 0 || rect.height === 0) {
                    return;
                }

                // Parse z-index (default to 0 if auto)
                let zIndex = parseInt(style.zIndex, 10);
                if (isNaN(zIndex)) {
                    zIndex = 0;
                }

                // Generate selector
                let selector = el.tagName.toLowerCase();
                if (el.id) {
                    selector = `#${el.id}`;
                } else if (el.className && typeof el.className === 'string') {
                    const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
                    if (classes) {
                        selector = `${el.tagName.toLowerCase()}.${classes}`;
                    }
                }

                results.push({
                    selector,
                    tagName: el.tagName.toLowerCase(),
                    position: position as 'fixed' | 'sticky',
                    zIndex,
                    boundingRect: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        left: rect.left
                    }
                });
            });

            return results;
        });
    }

    /**
     * Analyzes whether a focusable element is obscured by overlays
     */
    private async analyzeElementVisibility(
        page: Page,
        focusable: { selector: string; tagName: string },
        overlays: Array<{
            selector: string;
            tagName: string;
            position: 'fixed' | 'sticky';
            zIndex: number;
            boundingRect: BoundingRect;
        }>
    ): Promise<FocusObscuredResult> {
        // Get the focusable element's bounding rect and z-index
        const elementInfo = await page.evaluate((selector: string) => {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (!el) {
                return null;
            }

            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            let zIndex = parseInt(style.zIndex, 10);
            if (isNaN(zIndex)) {
                zIndex = 0;
            }

            return {
                boundingRect: {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    left: rect.left
                },
                zIndex
            };
        }, focusable.selector);

        if (!elementInfo) {
            return {
                element: {
                    selector: focusable.selector,
                    tagName: focusable.tagName,
                    boundingRect: { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }
                },
                isObscured: false,
                overlapPercentage: 0,
                obscuringElements: []
            };
        }

        // Check for overlaps with each overlay
        const obscuringElements: ObscuringElement[] = [];
        let maxOverlap = 0;

        for (const overlay of overlays) {
            // Only overlays with higher z-index can obscure
            if (overlay.zIndex <= elementInfo.zIndex) {
                continue;
            }

            const overlap = this.calculateOverlapPercentage(
                elementInfo.boundingRect,
                overlay.boundingRect
            );

            if (overlap >= this.minOverlapThreshold) {
                obscuringElements.push({
                    selector: overlay.selector,
                    tagName: overlay.tagName,
                    position: overlay.position,
                    zIndex: overlay.zIndex,
                    boundingRect: overlay.boundingRect,
                    overlapPercentage: overlap
                });
                maxOverlap = Math.max(maxOverlap, overlap);
            }
        }

        return {
            element: {
                selector: focusable.selector,
                tagName: focusable.tagName,
                boundingRect: elementInfo.boundingRect
            },
            isObscured: obscuringElements.length > 0,
            overlapPercentage: maxOverlap,
            obscuringElements
        };
    }

    /**
     * Calculates the percentage of element A that is overlapped by element B
     */
    private calculateOverlapPercentage(a: BoundingRect, b: BoundingRect): number {
        // Calculate intersection
        const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        
        const intersectionArea = xOverlap * yOverlap;
        const elementArea = a.width * a.height;

        if (elementArea === 0) {
            return 0;
        }

        return (intersectionArea / elementArea) * 100;
    }

    /**
     * Transforms analysis results to Violation format
     */
    private transformToViolations(results: FocusObscuredResult[]): Violation[] {
        if (results.length === 0) {
            return [];
        }

        // Group by obscuring element to create fewer, more meaningful violations
        const violationNodes: ViolationNode[] = results.map(result => ({
            selector: result.element.selector,
            html: `<${result.element.tagName}>`, // Simplified, actual implementation would get real HTML
            failureSummary: this.generateFailureSummary(result),
            target: [result.element.selector]
        }));

        // Determine impact based on overlap severity
        const impact = this.determineImpact(results);

        const violation: Violation = {
            id: 'focus-not-obscured',
            impact,
            description: 'Ensure focused elements are not entirely hidden by sticky or fixed positioned content.',
            help: 'When a keyboard user tabs to an element, at least part of it must be visible and not covered by other content like sticky headers or footers.',
            helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html',
            nodes: violationNodes
        };

        return [violation];
    }

    /**
     * Generates a failure summary for a single result
     */
    private generateFailureSummary(result: FocusObscuredResult): string {
        const obscurers = result.obscuringElements
            .map(o => `${o.tagName} (${o.position}, z-index: ${o.zIndex})`)
            .join(', ');
        
        return `Element "${result.element.selector}" is ${result.overlapPercentage.toFixed(0)}% obscured by: ${obscurers}`;
    }

    /**
     * Determines the impact level based on overlap severity
     */
    private determineImpact(results: FocusObscuredResult[]): ImpactLevel {
        const maxOverlap = Math.max(...results.map(r => r.overlapPercentage));

        if (maxOverlap >= 100) {
            return 'critical'; // Completely hidden
        } else if (maxOverlap >= 75) {
            return 'serious'; // Mostly hidden
        } else if (maxOverlap >= 50) {
            return 'moderate'; // Partially hidden
        }
        return 'minor'; // Slightly overlapped
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new FocusObscuredAnalyzer instance
 */
export function createFocusObscuredAnalyzer(
    options?: FocusObscuredAnalyzerOptions
): FocusObscuredAnalyzer {
    return new FocusObscuredAnalyzer(options);
}
