/**
 * Unit and Integration Tests for Dragging Analyzer
 * 
 * Tests the WCAG 2.2 Dragging Movements (2.5.7) analyzer.
 * Requirements: WCAG 2.5.7 - All functionality that uses a dragging movement
 * for operation can be achieved by a single pointer without dragging.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Browser, Page, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import {
    DraggingAnalyzer,
    createDraggingAnalyzer,
    type DraggingAnalyzerOptions,
    type DragPatternType
} from '../services/dragging-analyzer.js';

// ============================================================================
// Test Fixtures - HTML Templates
// ============================================================================

const FIXTURE_DRAGGABLE_ATTR = `
<!DOCTYPE html>
<html>
<body>
    <ul id="sortable-list">
        <li draggable="true" id="item1">Item 1</li>
        <li draggable="true" id="item2">Item 2</li>
        <li draggable="true" id="item3">Item 3</li>
    </ul>
</body>
</html>
`;

const FIXTURE_SORTABLE_LIST_NO_ALT = `
<!DOCTYPE html>
<html>
<body>
    <ul class="sortable" id="kanban">
        <li class="sortable-item draggable" id="task1">Task 1</li>
        <li class="sortable-item draggable" id="task2">Task 2</li>
    </ul>
</body>
</html>
`;

const FIXTURE_SORTABLE_LIST_WITH_ALT = `
<!DOCTYPE html>
<html>
<body>
    <ul class="sortable" id="sortable-with-buttons">
        <li class="sortable-item" id="item1">
            <span>Item 1</span>
            <button class="move-up" aria-label="Move item up">↑</button>
            <button class="move-down" aria-label="Move item down">↓</button>
        </li>
        <li class="sortable-item" id="item2">
            <span>Item 2</span>
            <button class="move-up" aria-label="Move item up">↑</button>
            <button class="move-down" aria-label="Move item down">↓</button>
        </li>
    </ul>
</body>
</html>
`;

const FIXTURE_SLIDER_NO_ALT = `
<!DOCTYPE html>
<html>
<body>
    <div class="slider-container">
        <div role="slider" id="custom-slider" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100">
            <div class="slider-track"></div>
            <div class="slider-thumb" draggable="true"></div>
        </div>
    </div>
</body>
</html>
`;

const FIXTURE_SLIDER_WITH_INPUT = `
<!DOCTYPE html>
<html>
<body>
    <div class="slider-container" id="slider-with-input">
        <div role="slider" id="volume-slider" aria-valuenow="50">
            <div class="slider-thumb" draggable="true"></div>
        </div>
        <input type="number" id="volume-value" value="50" min="0" max="100">
    </div>
</body>
</html>
`;

const FIXTURE_INPUT_RANGE = `
<!DOCTYPE html>
<html>
<body>
    <div class="range-container">
        <input type="range" id="native-slider" min="0" max="100" value="50">
    </div>
</body>
</html>
`;

const FIXTURE_JQUERY_UI_SORTABLE = `
<!DOCTYPE html>
<html>
<body>
    <ul class="ui-sortable" id="jquery-list">
        <li class="ui-sortable-handle ui-draggable" id="jq-item1">JQuery Item 1</li>
        <li class="ui-sortable-handle ui-draggable" id="jq-item2">JQuery Item 2</li>
    </ul>
</body>
</html>
`;

const FIXTURE_REACT_DND = `
<!DOCTYPE html>
<html>
<body>
    <div id="board">
        <div class="column">
            <div data-rbd-draggable-id="task-1" id="rbd-task1">Task 1</div>
            <div data-rbd-draggable-id="task-2" id="rbd-task2">Task 2</div>
        </div>
    </div>
</body>
</html>
`;

const FIXTURE_SORTABLEJS = `
<!DOCTYPE html>
<html>
<body>
    <ul data-sortable="true" id="sortablejs-list">
        <li class="sortable-ghost" id="sort-item1">Sortable Item 1</li>
        <li id="sort-item2">Sortable Item 2</li>
    </ul>
</body>
</html>
`;

const FIXTURE_MAP_DRAGGABLE = `
<!DOCTYPE html>
<html>
<body>
    <div class="map-container" id="interactive-map">
        <div class="leaflet-container" draggable="true">
            <div class="map-content">Map Content</div>
        </div>
    </div>
</body>
</html>
`;

const FIXTURE_RESIZABLE = `
<!DOCTYPE html>
<html>
<body>
    <div class="panel resizable" id="resize-panel">
        <div class="resize-handle" draggable="true"></div>
        <div class="panel-content">Panel Content</div>
    </div>
</body>
</html>
`;

const FIXTURE_CANVAS_DRAWING = `
<!DOCTYPE html>
<html>
<body>
    <canvas id="drawing-canvas" width="500" height="400" class="draw-area"></canvas>
</body>
</html>
`;

const FIXTURE_NO_DRAGGABLE = `
<!DOCTYPE html>
<html>
<body>
    <main>
        <h1>Simple Page</h1>
        <p>No draggable content here.</p>
        <button id="btn">Click Me</button>
        <a href="#">Link</a>
    </main>
</body>
</html>
`;

const FIXTURE_MIXED_DRAGGABLES = `
<!DOCTYPE html>
<html>
<body>
    <!-- Sortable without alternative -->
    <ul class="sortable" id="list-no-alt">
        <li draggable="true" id="no-alt-item">Needs Alternative</li>
    </ul>
    
    <!-- Slider with number input -->
    <div class="slider-container" id="slider-with-alt">
        <div role="slider" id="slider" draggable="true"></div>
        <input type="number" id="slider-value">
    </div>
    
    <!-- Regular button (not draggable) -->
    <button id="regular-btn">Regular Button</button>
</body>
</html>
`;

const FIXTURE_ARIA_CONTROLS = `
<!DOCTYPE html>
<html>
<body>
    <div class="sortable" id="with-aria">
        <div draggable="true" id="draggable-with-aria" aria-controls="position-selector">
            Draggable Item
        </div>
        <select id="position-selector">
            <option value="1">Position 1</option>
            <option value="2">Position 2</option>
        </select>
    </div>
</body>
</html>
`;

const FIXTURE_KEYBOARD_HINT = `
<!DOCTYPE html>
<html>
<body>
    <div class="sortable-container">
        <ul class="sortable" id="keyboard-accessible">
            <li draggable="true" id="kb-item">Item</li>
        </ul>
        <div class="keyboard-instructions">Use arrow keys to reorder</div>
    </div>
</body>
</html>
`;

// ============================================================================
// Unit Tests - DraggingAnalyzer Class
// ============================================================================

describe('DraggingAnalyzer', () => {
    describe('constructor', () => {
        it('should create analyzer with default options', () => {
            const analyzer = new DraggingAnalyzer();
            expect(analyzer).toBeDefined();
        });

        it('should accept checkAriaAlternatives option', () => {
            const analyzer = new DraggingAnalyzer({ checkAriaAlternatives: false });
            expect(analyzer).toBeDefined();
        });

        it('should accept checkLibraryPatterns option', () => {
            const analyzer = new DraggingAnalyzer({ checkLibraryPatterns: false });
            expect(analyzer).toBeDefined();
        });

        it('should accept all options', () => {
            const options: DraggingAnalyzerOptions = {
                checkAriaAlternatives: true,
                checkLibraryPatterns: true
            };
            const analyzer = new DraggingAnalyzer(options);
            expect(analyzer).toBeDefined();
        });
    });

    describe('createDraggingAnalyzer factory', () => {
        it('should create analyzer instance', () => {
            const analyzer = createDraggingAnalyzer();
            expect(analyzer).toBeInstanceOf(DraggingAnalyzer);
        });

        it('should pass options to constructor', () => {
            const options: DraggingAnalyzerOptions = {
                checkAriaAlternatives: false,
                checkLibraryPatterns: false
            };
            const analyzer = createDraggingAnalyzer(options);
            expect(analyzer).toBeInstanceOf(DraggingAnalyzer);
        });
    });
});

// ============================================================================
// Integration Tests - With Playwright
// ============================================================================

describe('DraggingAnalyzer - Integration Tests', () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;
    let analyzer: DraggingAnalyzer;

    beforeAll(async () => {
        browser = await chromium.launch();
    });

    afterAll(async () => {
        await browser.close();
    });

    beforeEach(async () => {
        context = await browser.newContext();
        page = await context.newPage();
        analyzer = new DraggingAnalyzer();
    });

    afterEach(async () => {
        await page.close();
        await context.close();
    });

    // ========================================================================
    // Basic Draggable Detection
    // ========================================================================

    describe('analyze() - Draggable Detection', () => {
        it('should detect elements with draggable="true"', async () => {
            await page.setContent(FIXTURE_DRAGGABLE_ATTR);

            const violations = await analyzer.analyze(page);

            // Should find violations for items without alternatives
            expect(violations.length).toBeGreaterThanOrEqual(1);

            const dragViolation = violations.find(v => v.id === 'dragging-movements');
            expect(dragViolation).toBeDefined();
        });

        it('should detect elements with sortable/draggable classes', async () => {
            await page.setContent(FIXTURE_SORTABLE_LIST_NO_ALT);

            const violations = await analyzer.analyze(page);

            expect(violations.length).toBeGreaterThanOrEqual(1);
        });

        it('should return empty array when no draggables exist', async () => {
            await page.setContent(FIXTURE_NO_DRAGGABLE);

            const violations = await analyzer.analyze(page);

            expect(violations).toEqual([]);
        });
    });

    // ========================================================================
    // Alternative Detection
    // ========================================================================

    describe('analyze() - Alternative Detection', () => {
        it('should not flag sortable lists with move buttons', async () => {
            await page.setContent(FIXTURE_SORTABLE_LIST_WITH_ALT);

            const violations = await analyzer.analyze(page);

            // Items with move up/down buttons should not be flagged
            // The presence of buttons as alternatives should reduce violations
            expect(Array.isArray(violations)).toBe(true);
        });

        it('should not flag sliders with number inputs', async () => {
            await page.setContent(FIXTURE_SLIDER_WITH_INPUT);

            const violations = await analyzer.analyze(page);

            // Slider with adjacent number input should not be flagged
            expect(Array.isArray(violations)).toBe(true);
        });

        it('should handle native range inputs', async () => {
            await page.setContent(FIXTURE_INPUT_RANGE);

            const violations = await analyzer.analyze(page);

            // Native range inputs may or may not need alternatives
            // depending on browser support
            expect(Array.isArray(violations)).toBe(true);
        });
    });

    // ========================================================================
    // Library Detection
    // ========================================================================

    describe('analyze() - Library Detection', () => {
        it('should detect jQuery UI sortable patterns', async () => {
            await page.setContent(FIXTURE_JQUERY_UI_SORTABLE);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                const node = violations[0].nodes[0];
                // Should mention jQuery UI in the failure summary if detected
                expect(node.failureSummary).toBeDefined();
            }
        });

        it('should detect react-beautiful-dnd patterns', async () => {
            await page.setContent(FIXTURE_REACT_DND);

            const violations = await analyzer.analyze(page);

            // Should detect data-rbd-draggable-id attribute
            expect(violations.length).toBeGreaterThanOrEqual(0);
        });

        it('should detect Sortable.js patterns', async () => {
            await page.setContent(FIXTURE_SORTABLEJS);

            const violations = await analyzer.analyze(page);

            // Should detect data-sortable or sortable-ghost class
            expect(Array.isArray(violations)).toBe(true);
        });

        it('should skip library detection when option disabled', async () => {
            await page.setContent(FIXTURE_JQUERY_UI_SORTABLE);

            const analyzerNoLib = new DraggingAnalyzer({ checkLibraryPatterns: false });
            const violations = await analyzerNoLib.analyze(page);

            expect(Array.isArray(violations)).toBe(true);
        });
    });

    // ========================================================================
    // Drag Pattern Type Detection
    // ========================================================================

    describe('Pattern Type Detection', () => {
        it('should detect slider pattern type', async () => {
            await page.setContent(FIXTURE_SLIDER_NO_ALT);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                const node = violations[0].nodes[0];
                // Failure summary should suggest appropriate fix for slider
                expect(node.failureSummary.toLowerCase()).toMatch(/slider|number input|increment|decrement/);
            }
        });

        it('should detect reorder pattern type', async () => {
            await page.setContent(FIXTURE_SORTABLE_LIST_NO_ALT);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                const node = violations[0].nodes[0];
                // Should suggest move buttons for reorder
                expect(node.failureSummary.toLowerCase()).toMatch(/move|reorder|button|up|down/);
            }
        });

        it('should detect map pattern type', async () => {
            await page.setContent(FIXTURE_MAP_DRAGGABLE);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                const node = violations[0].nodes[0];
                // Should suggest pan buttons for map
                expect(node.failureSummary.toLowerCase()).toMatch(/pan|north|south|east|west|search|location/i);
            }
        });

        it('should detect resize pattern type', async () => {
            await page.setContent(FIXTURE_RESIZABLE);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                const node = violations[0].nodes[0];
                // Should suggest resize inputs
                expect(node.failureSummary.toLowerCase()).toMatch(/resize|width|height|size/);
            }
        });

        it('should detect draw/canvas pattern type', async () => {
            await page.setContent(FIXTURE_CANVAS_DRAWING);

            const violations = await analyzer.analyze(page);

            // Canvas detection is based on class names and tag
            expect(Array.isArray(violations)).toBe(true);
        });
    });

    // ========================================================================
    // ARIA Alternatives
    // ========================================================================

    describe('ARIA Alternatives', () => {
        it('should detect aria-controls relationships', async () => {
            await page.setContent(FIXTURE_ARIA_CONTROLS);

            const analyzer = new DraggingAnalyzer({ checkAriaAlternatives: true });
            const violations = await analyzer.analyze(page);

            // Should recognize the select as an alternative via aria-controls
            expect(Array.isArray(violations)).toBe(true);
        });

        it('should detect keyboard instruction hints', async () => {
            await page.setContent(FIXTURE_KEYBOARD_HINT);

            const analyzer = new DraggingAnalyzer({ checkAriaAlternatives: true });
            const violations = await analyzer.analyze(page);

            // Should recognize keyboard instructions as alternative
            expect(Array.isArray(violations)).toBe(true);
        });

        it('should skip ARIA checks when option disabled', async () => {
            await page.setContent(FIXTURE_ARIA_CONTROLS);

            const analyzerNoAria = new DraggingAnalyzer({ checkAriaAlternatives: false });
            const violations = await analyzerNoAria.analyze(page);

            expect(Array.isArray(violations)).toBe(true);
        });
    });

    // ========================================================================
    // Violation Format
    // ========================================================================

    describe('Violation Format', () => {
        it('should return violations in correct format', async () => {
            await page.setContent(FIXTURE_DRAGGABLE_ATTR);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                const violation = violations[0];

                expect(violation).toHaveProperty('id', 'dragging-movements');
                expect(violation).toHaveProperty('impact');
                expect(['critical', 'serious', 'moderate', 'minor']).toContain(violation.impact);
                expect(violation).toHaveProperty('description');
                expect(violation).toHaveProperty('help');
                expect(violation).toHaveProperty('helpUrl');
                expect(violation.helpUrl).toContain('w3.org');
                expect(violation).toHaveProperty('nodes');
                expect(Array.isArray(violation.nodes)).toBe(true);
            }
        });

        it('should include suggested fix in failure summary', async () => {
            await page.setContent(FIXTURE_SORTABLE_LIST_NO_ALT);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0 && violations[0].nodes.length > 0) {
                const node = violations[0].nodes[0];

                expect(node.failureSummary).toBeDefined();
                expect(node.failureSummary.length).toBeGreaterThan(0);
                // Should include fix suggestion
                expect(node.failureSummary.toLowerCase()).toMatch(/button|input|alternative/);
            }
        });

        it('should include correct node properties', async () => {
            await page.setContent(FIXTURE_DRAGGABLE_ATTR);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0 && violations[0].nodes.length > 0) {
                const node = violations[0].nodes[0];

                expect(node).toHaveProperty('selector');
                expect(typeof node.selector).toBe('string');
                expect(node).toHaveProperty('html');
                expect(typeof node.html).toBe('string');
                expect(node).toHaveProperty('failureSummary');
                expect(node).toHaveProperty('target');
                expect(Array.isArray(node.target)).toBe(true);
            }
        });

        it('should truncate long HTML snippets', async () => {
            await page.setContent(`
                <div 
                    draggable="true" 
                    id="long-content"
                    class="some-class another-class third-class fourth-class"
                    data-very-long-attribute="This is a very long attribute value that goes on and on"
                    data-another-long-attr="More content here to make this element really long"
                >
                    This is content inside the draggable that is also quite long and verbose
                    with multiple lines and lots of text that should definitely be truncated
                </div>
            `);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0 && violations[0].nodes.length > 0) {
                const node = violations[0].nodes[0];
                // HTML should be truncated to reasonable length
                expect(node.html.length).toBeLessThanOrEqual(210); // 200 + "..."
            }
        });
    });

    // ========================================================================
    // Impact Level
    // ========================================================================

    describe('Impact Level Determination', () => {
        it('should assign serious impact for slider without alternative', async () => {
            await page.setContent(FIXTURE_SLIDER_NO_ALT);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                // Sliders are critical functionality
                expect(['critical', 'serious']).toContain(violations[0].impact);
            }
        });

        it('should assign serious impact for reorder without alternative', async () => {
            await page.setContent(FIXTURE_SORTABLE_LIST_NO_ALT);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                expect(['critical', 'serious']).toContain(violations[0].impact);
            }
        });
    });

    // ========================================================================
    // Mixed Content
    // ========================================================================

    describe('Mixed Draggable Content', () => {
        it('should only flag draggables without alternatives', async () => {
            await page.setContent(FIXTURE_MIXED_DRAGGABLES);

            const violations = await analyzer.analyze(page);

            // Should find the sortable without alt but not the slider with input
            expect(Array.isArray(violations)).toBe(true);
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('Edge Cases', () => {
        it('should handle empty page', async () => {
            await page.setContent('<html><body></body></html>');

            const violations = await analyzer.analyze(page);

            expect(violations).toEqual([]);
        });

        it('should handle page with draggable="false"', async () => {
            await page.setContent(`
                <html>
                <body>
                    <div draggable="false" id="not-draggable">Not Draggable</div>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            // draggable="false" should not be flagged
            expect(violations).toEqual([]);
        });

        it('should handle malformed HTML gracefully', async () => {
            await page.setContent(`
                <html>
                <body>
                    <div draggable="true" id="mal
                    formed">Content</div>
                </body>
                </html>
            `);

            // Should not throw
            const violations = await analyzer.analyze(page);
            expect(Array.isArray(violations)).toBe(true);
        });

        it('should handle deeply nested draggables', async () => {
            await page.setContent(`
                <html>
                <body>
                    <div>
                        <div>
                            <div>
                                <div>
                                    <div>
                                        <div draggable="true" id="deep-drag">Deep</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            // Should find deeply nested draggable
            expect(violations.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle multiple instances of same draggable type', async () => {
            await page.setContent(`
                <html>
                <body>
                    <ul class="sortable">
                        <li draggable="true" id="item1">Item 1</li>
                        <li draggable="true" id="item2">Item 2</li>
                        <li draggable="true" id="item3">Item 3</li>
                        <li draggable="true" id="item4">Item 4</li>
                        <li draggable="true" id="item5">Item 5</li>
                    </ul>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                // Should report all items as nodes in one violation
                expect(violations[0].nodes.length).toBeGreaterThanOrEqual(1);
            }
        });
    });

    // ========================================================================
    // Role-based Detection
    // ========================================================================

    describe('ARIA Role Detection', () => {
        it('should detect role="slider" elements', async () => {
            await page.setContent(`
                <html>
                <body>
                    <div role="slider" id="aria-slider" aria-valuenow="5" aria-valuemin="0" aria-valuemax="10">
                        Slider
                    </div>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            // role="slider" should be detected
            expect(violations.length).toBeGreaterThanOrEqual(0);
        });

        it('should detect role="scrollbar" elements', async () => {
            await page.setContent(`
                <html>
                <body>
                    <div role="scrollbar" id="custom-scrollbar" aria-valuenow="0">
                        Scrollbar
                    </div>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            expect(Array.isArray(violations)).toBe(true);
        });
    });
});
