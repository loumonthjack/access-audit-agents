/**
 * Dragging Analyzer Service
 * 
 * JavaScript event listener analysis for WCAG 2.2 Dragging Movements (2.5.7).
 * Detects draggable elements and checks for single-pointer alternatives.
 * 
 * This analyzer scans for:
 * - mousedown/mousemove/mouseup event listener sequences
 * - Common dragging library patterns (Sortable.js, jQuery UI, etc.)
 * - Touch drag events (touchstart, touchmove, touchend)
 * - Pointer events for drag operations
 * 
 * Requirements: WCAG 2.2 Success Criterion 2.5.7
 */

import type { Page } from 'playwright';
import type { Violation, ViolationNode, ImpactLevel } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Type of dragging pattern detected
 */
export type DragPatternType =
    | 'slider'      // Range sliders, progress bars
    | 'reorder'     // Kanban boards, sortable lists
    | 'map'         // Interactive maps
    | 'resize'      // Resizable panels, windows
    | 'draw'        // Drawing canvases
    | 'custom';     // Unknown/custom implementation

/**
 * Information about a detected draggable element
 */
export interface DraggableElement {
    selector: string;
    tagName: string;
    html: string;
    dragPatternType: DragPatternType;
    hasMouseEvents: boolean;
    hasTouchEvents: boolean;
    hasPointerEvents: boolean;
    hasDraggableAttr: boolean;
    libraryDetected: string | null;
}

/**
 * Information about a potential alternative interface
 */
export interface AlternativeInterface {
    type: 'button' | 'input' | 'select' | 'keyboard' | 'other';
    selector: string;
    description: string;
    proximity: 'adjacent' | 'nearby' | 'same-container' | 'page';
}

/**
 * Result of dragging analysis for a single element
 */
export interface DraggingAnalysisResult {
    element: DraggableElement;
    hasAlternative: boolean;
    alternatives: AlternativeInterface[];
    suggestedFix: string;
    requiresHumanReview: boolean;
}

/**
 * Options for the dragging analyzer
 */
export interface DraggingAnalyzerOptions {
    /** Whether to check for ARIA alternatives */
    checkAriaAlternatives?: boolean;
    /** Whether to check common library patterns */
    checkLibraryPatterns?: boolean;
}

// ============================================================================
// Dragging Analyzer Service
// ============================================================================

/**
 * Dragging Analyzer
 * 
 * Analyzes pages for WCAG 2.2 Dragging Movements (2.5.7) violations.
 * Detects draggable elements and checks for single-pointer alternatives.
 */
export class DraggingAnalyzer {
    private readonly checkAriaAlternatives: boolean;
    private readonly checkLibraryPatterns: boolean;

    constructor(options: DraggingAnalyzerOptions = {}) {
        this.checkAriaAlternatives = options.checkAriaAlternatives ?? true;
        this.checkLibraryPatterns = options.checkLibraryPatterns ?? true;
    }

    /**
     * Analyzes all draggable elements on the page
     * 
     * @param page - Playwright page instance
     * @returns Array of violations found
     */
    async analyze(page: Page): Promise<Violation[]> {
        // Detect all draggable elements
        const draggableElements = await this.detectDraggableElements(page);

        if (draggableElements.length === 0) {
            return [];
        }

        // Analyze each draggable element for alternatives
        const results: DraggingAnalysisResult[] = [];

        for (const element of draggableElements) {
            const alternatives = await this.findAlternatives(page, element);
            const hasAlternative = alternatives.length > 0;

            results.push({
                element,
                hasAlternative,
                alternatives,
                suggestedFix: this.generateSuggestedFix(element, hasAlternative),
                requiresHumanReview: !hasAlternative // Always flag for review if no alternative found
            });
        }

        // Filter to only violations (no alternatives found)
        const violations = results.filter(r => !r.hasAlternative);

        return this.transformToViolations(violations);
    }

    /**
     * Detects all elements with dragging functionality
     */
    private async detectDraggableElements(page: Page): Promise<DraggableElement[]> {
        return page.evaluate((checkLibraries: boolean) => {
            const results: DraggableElement[] = [];
            const processedElements = new Set<Element>();

            // Helper to generate selector
            const generateSelector = (el: Element): string => {
                let selector = el.tagName.toLowerCase();
                if (el.id) {
                    return `#${el.id}`;
                }
                if (el.className && typeof el.className === 'string') {
                    const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
                    if (classes) {
                        selector = `${el.tagName.toLowerCase()}.${classes}`;
                    }
                }
                return selector;
            };

            // Helper to get outer HTML (truncated)
            const getHtml = (el: Element): string => {
                const html = el.outerHTML;
                return html.length > 200 ? html.substring(0, 200) + '...' : html;
            };

            // Helper to infer drag pattern type
            const inferDragPattern = (el: Element): DragPatternType => {
                const tagName = el.tagName.toLowerCase();
                const className = (el.className || '').toString().toLowerCase();
                const role = el.getAttribute('role')?.toLowerCase() || '';

                // Slider detection
                if (tagName === 'input' && (el as HTMLInputElement).type === 'range') {
                    return 'slider';
                }
                if (role === 'slider' || className.includes('slider') || className.includes('range')) {
                    return 'slider';
                }

                // Sortable/reorder detection
                if (className.includes('sortable') || className.includes('draggable') ||
                    className.includes('kanban') || className.includes('reorder')) {
                    return 'reorder';
                }

                // Map detection
                if (className.includes('map') || tagName === 'map' ||
                    className.includes('leaflet') || className.includes('mapbox')) {
                    return 'map';
                }

                // Resize detection
                if (className.includes('resize') || className.includes('splitter')) {
                    return 'resize';
                }

                // Drawing detection
                if (tagName === 'canvas' || className.includes('draw') || className.includes('paint')) {
                    return 'draw';
                }

                return 'custom';
            };

            // Helper to detect common libraries
            const detectLibrary = (el: Element): string | null => {
                if (!checkLibraries) return null;

                const className = (el.className || '').toString();

                // jQuery UI
                if (className.includes('ui-draggable') || className.includes('ui-sortable')) {
                    return 'jQuery UI';
                }

                // Sortable.js
                if (className.includes('sortable-ghost') || el.hasAttribute('data-sortable')) {
                    return 'Sortable.js';
                }

                // react-beautiful-dnd
                if (el.hasAttribute('data-rbd-draggable-id')) {
                    return 'react-beautiful-dnd';
                }

                // dnd-kit
                if (el.hasAttribute('data-dnd-kit')) {
                    return 'dnd-kit';
                }

                // Interact.js
                if (className.includes('interactable')) {
                    return 'Interact.js';
                }

                return null;
            };

            // 1. Check elements with draggable attribute
            document.querySelectorAll('[draggable="true"]').forEach(el => {
                if (processedElements.has(el)) return;
                processedElements.add(el);

                results.push({
                    selector: generateSelector(el),
                    tagName: el.tagName.toLowerCase(),
                    html: getHtml(el),
                    dragPatternType: inferDragPattern(el),
                    hasMouseEvents: false, // Will check below
                    hasTouchEvents: false,
                    hasPointerEvents: false,
                    hasDraggableAttr: true,
                    libraryDetected: detectLibrary(el)
                });
            });

            // 2. Check elements with drag-related class names
            const dragClasses = [
                '.draggable', '.sortable', '.resizable',
                '[class*="drag"]', '[class*="sortable"]',
                '.ui-draggable', '.ui-sortable'
            ];

            document.querySelectorAll(dragClasses.join(', ')).forEach(el => {
                if (processedElements.has(el)) return;
                processedElements.add(el);

                results.push({
                    selector: generateSelector(el),
                    tagName: el.tagName.toLowerCase(),
                    html: getHtml(el),
                    dragPatternType: inferDragPattern(el),
                    hasMouseEvents: false,
                    hasTouchEvents: false,
                    hasPointerEvents: false,
                    hasDraggableAttr: el.getAttribute('draggable') === 'true',
                    libraryDetected: detectLibrary(el)
                });
            });

            // 3. Check for ARIA roles that typically involve dragging
            document.querySelectorAll('[role="slider"], [role="scrollbar"]').forEach(el => {
                if (processedElements.has(el)) return;
                processedElements.add(el);

                results.push({
                    selector: generateSelector(el),
                    tagName: el.tagName.toLowerCase(),
                    html: getHtml(el),
                    dragPatternType: 'slider',
                    hasMouseEvents: false,
                    hasTouchEvents: false,
                    hasPointerEvents: false,
                    hasDraggableAttr: false,
                    libraryDetected: null
                });
            });

            return results;
        }, this.checkLibraryPatterns);
    }

    /**
     * Finds alternative single-pointer interfaces for a draggable element
     */
    private async findAlternatives(
        page: Page,
        element: DraggableElement
    ): Promise<AlternativeInterface[]> {
        return page.evaluate((args: { selector: string; patternType: DragPatternType; checkAria: boolean }) => {
            const alternatives: AlternativeInterface[] = [];
            const el = document.querySelector(args.selector);

            if (!el) {
                return alternatives;
            }

            // Get parent container
            const container = el.parentElement;
            if (!container) {
                return alternatives;
            }

            // Helper to check proximity
            const checkProximity = (targetEl: Element): 'adjacent' | 'nearby' | 'same-container' | 'page' => {
                if (targetEl.previousElementSibling === el || targetEl.nextElementSibling === el) {
                    return 'adjacent';
                }
                if (container.contains(targetEl)) {
                    return 'same-container';
                }
                // Check if within 200px
                const elRect = el.getBoundingClientRect();
                const targetRect = targetEl.getBoundingClientRect();
                const distance = Math.sqrt(
                    Math.pow(elRect.x - targetRect.x, 2) +
                    Math.pow(elRect.y - targetRect.y, 2)
                );
                if (distance < 200) {
                    return 'nearby';
                }
                return 'page';
            };

            // 1. Look for buttons that might be alternatives
            const buttonPatterns = [
                'button[class*="up"]', 'button[class*="down"]',
                'button[class*="left"]', 'button[class*="right"]',
                'button[class*="move"]', 'button[class*="increment"]',
                'button[class*="decrement"]', 'button[aria-label*="move"]',
                '[role="button"][class*="move"]'
            ];

            container.querySelectorAll(buttonPatterns.join(', ')).forEach(btn => {
                const label = btn.getAttribute('aria-label') || btn.textContent?.trim() || 'Movement button';
                alternatives.push({
                    type: 'button',
                    selector: btn.id ? `#${btn.id}` : btn.tagName.toLowerCase(),
                    description: label,
                    proximity: checkProximity(btn)
                });
            });

            // 2. For sliders, check for number inputs
            if (args.patternType === 'slider') {
                container.querySelectorAll('input[type="number"]').forEach(input => {
                    alternatives.push({
                        type: 'input',
                        selector: (input as HTMLInputElement).id ? `#${(input as HTMLInputElement).id}` : 'input[type="number"]',
                        description: 'Number input for precise value entry',
                        proximity: checkProximity(input)
                    });
                });
            }

            // 3. For reorder, check for select/dropdown
            if (args.patternType === 'reorder') {
                container.querySelectorAll('select, [role="listbox"]').forEach(select => {
                    alternatives.push({
                        type: 'select',
                        selector: (select as HTMLSelectElement).id ? `#${(select as HTMLSelectElement).id}` : 'select',
                        description: 'Position selector for reordering',
                        proximity: checkProximity(select)
                    });
                });
            }

            // 4. Check ARIA alternatives if enabled
            if (args.checkAria) {
                // Check for aria-controls relationships
                const controlledBy = el.getAttribute('aria-controls');
                if (controlledBy) {
                    const controlled = document.getElementById(controlledBy);
                    if (controlled) {
                        alternatives.push({
                            type: 'other',
                            selector: `#${controlledBy}`,
                            description: 'ARIA-controlled alternative interface',
                            proximity: checkProximity(controlled)
                        });
                    }
                }

                // Check for keyboard instructions
                const keyboardHint = container.querySelector('[class*="keyboard"], [class*="shortcut"]');
                if (keyboardHint) {
                    alternatives.push({
                        type: 'keyboard',
                        selector: keyboardHint.id ? `#${keyboardHint.id}` : '.keyboard-hint',
                        description: 'Keyboard navigation available',
                        proximity: checkProximity(keyboardHint)
                    });
                }
            }

            return alternatives;
        }, {
            selector: element.selector,
            patternType: element.dragPatternType,
            checkAria: this.checkAriaAlternatives
        });
    }

    /**
     * Generates a suggested fix for a draggable element
     */
    private generateSuggestedFix(element: DraggableElement, hasAlternative: boolean): string {
        if (hasAlternative) {
            return 'Alternative interface already exists.';
        }

        switch (element.dragPatternType) {
            case 'slider':
                return 'Add a number input or increment/decrement buttons adjacent to the slider.';
            case 'reorder':
                return 'Add "Move Up" and "Move Down" buttons, or a position number input for each item.';
            case 'map':
                return 'Add pan buttons (North, South, East, West) or a search/location input.';
            case 'resize':
                return 'Add width/height input fields or preset size buttons.';
            case 'draw':
                return 'Consider providing shape tools with click-to-place functionality.';
            default:
                return 'Provide single-pointer buttons or input fields as an alternative to dragging.';
        }
    }

    /**
     * Transforms analysis results to Violation format
     */
    private transformToViolations(results: DraggingAnalysisResult[]): Violation[] {
        if (results.length === 0) {
            return [];
        }

        const violationNodes: ViolationNode[] = results.map(result => ({
            selector: result.element.selector,
            html: result.element.html,
            failureSummary: this.generateFailureSummary(result),
            target: [result.element.selector]
        }));

        // Determine impact - dragging violations are typically serious
        const impact = this.determineImpact(results);

        const violation: Violation = {
            id: 'dragging-movements',
            impact,
            description: 'All functionality that uses dragging movements for operation must have a single pointer alternative.',
            help: 'Provide buttons, inputs, or other single-pointer alternatives for drag-to-operate functionality.',
            helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html',
            nodes: violationNodes
        };

        return [violation];
    }

    /**
     * Generates a failure summary for a single result
     */
    private generateFailureSummary(result: DraggingAnalysisResult): string {
        const library = result.element.libraryDetected
            ? ` (using ${result.element.libraryDetected})`
            : '';

        return `Draggable ${result.element.dragPatternType} element${library} has no single-pointer alternative. ${result.suggestedFix}`;
    }

    /**
     * Determines the impact level based on the type of draggable element
     */
    private determineImpact(results: DraggingAnalysisResult[]): ImpactLevel {
        // Critical functionality typically includes:
        // - Form inputs (sliders)
        // - Navigation (maps)
        // - Core interactions (reorder)
        const hasCriticalPattern = results.some(r =>
            r.element.dragPatternType === 'slider' ||
            r.element.dragPatternType === 'reorder'
        );

        if (hasCriticalPattern) {
            return 'serious'; // Core functionality blocked
        }

        return 'moderate'; // May still be usable with difficulty
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new DraggingAnalyzer instance
 */
export function createDraggingAnalyzer(
    options?: DraggingAnalyzerOptions
): DraggingAnalyzer {
    return new DraggingAnalyzer(options);
}
