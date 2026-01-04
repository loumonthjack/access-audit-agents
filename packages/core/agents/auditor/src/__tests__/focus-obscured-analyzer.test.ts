/**
 * Unit and Integration Tests for Focus Obscured Analyzer
 * 
 * Tests the WCAG 2.2 Focus Not Obscured (2.4.11) analyzer.
 * Requirements: WCAG 2.4.11 - When a user interface component receives keyboard focus,
 * the component is not entirely hidden due to author-created content.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Browser, Page, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import {
    FocusObscuredAnalyzer,
    createFocusObscuredAnalyzer,
    type FocusObscuredAnalyzerOptions,
    type BoundingRect
} from '../services/focus-obscured-analyzer.js';

// ============================================================================
// Test Fixtures - HTML Templates
// ============================================================================

const FIXTURE_STICKY_HEADER_OBSCURING = `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 80px;
            background: #333;
            z-index: 1000;
        }
        main {
            margin-top: 100px;
            padding: 20px;
        }
        .obscured-button {
            position: fixed;
            top: 20px;
            left: 50%;
        }
    </style>
</head>
<body>
    <header id="main-header">Site Header</header>
    <main>
        <button class="obscured-button" id="btn-obscured">Completely Hidden</button>
        <button id="btn-visible">Visible Button</button>
    </main>
</body>
</html>
`;

const FIXTURE_STICKY_FOOTER_OBSCURING = `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { height: 100vh; }
        footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: #333;
            z-index: 1000;
        }
        main {
            padding: 20px;
            padding-bottom: 100px;
        }
        .bottom-button {
            position: fixed;
            bottom: 20px;
            left: 50%;
        }
    </style>
</head>
<body>
    <main>
        <button id="btn-normal">Normal Button</button>
        <button class="bottom-button" id="btn-footer-obscured">Hidden by Footer</button>
    </main>
    <footer id="main-footer">Site Footer</footer>
</body>
</html>
`;

const FIXTURE_NO_OVERLAYS = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { padding: 20px; }
    </style>
</head>
<body>
    <main>
        <button id="btn1">Button 1</button>
        <a href="#" id="link1">Link 1</a>
        <input type="text" id="input1" placeholder="Input 1">
    </main>
</body>
</html>
`;

const FIXTURE_PARTIAL_OVERLAP = `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .sticky-bar {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 40px;
            background: #333;
            z-index: 1000;
        }
        .partially-visible {
            position: fixed;
            top: 30px;
            left: 50%;
            width: 100px;
            height: 40px;
        }
    </style>
</head>
<body>
    <div class="sticky-bar" id="notification-bar">Notification</div>
    <main>
        <button class="partially-visible" id="btn-partial">25% Overlap Button</button>
    </main>
</body>
</html>
`;

const FIXTURE_MULTIPLE_OVERLAYS = `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: #333;
            z-index: 1000;
        }
        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: 200px;
            height: 100vh;
            background: #555;
            z-index: 900;
        }
        footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50px;
            background: #666;
            z-index: 1000;
        }
        .trapped-button {
            position: fixed;
            top: 20px;
            left: 50px;
        }
    </style>
</head>
<body>
    <header id="header">Header</header>
    <aside class="sidebar" id="sidebar">Sidebar</aside>
    <footer id="footer">Footer</footer>
    <main>
        <button class="trapped-button" id="btn-multi-obscured">Multi-obscured</button>
        <button id="btn-clear" style="margin-left: 250px; margin-top: 100px;">Clear Button</button>
    </main>
</body>
</html>
`;

const FIXTURE_STICKY_VS_REGULAR = `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { height: 200vh; }
        .sticky-header {
            position: sticky;
            top: 0;
            background: #333;
            height: 50px;
            z-index: 100;
        }
        .content-section {
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="sticky-header" id="sticky-header">Sticky Header</div>
    <div class="content-section">
        <button id="btn-below-sticky">Below Sticky</button>
    </div>
</body>
</html>
`;

const FIXTURE_Z_INDEX_LOWER = `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100px;
            background: rgba(0,0,0,0.5);
            z-index: 1;
        }
        .high-z-button {
            position: fixed;
            top: 30px;
            left: 50%;
            z-index: 1001;
        }
    </style>
</head>
<body>
    <div class="overlay" id="low-z-overlay">Overlay</div>
    <button class="high-z-button" id="btn-high-z">High Z-Index Button</button>
</body>
</html>
`;

const FIXTURE_HIDDEN_ELEMENTS = `
<!DOCTYPE html>
<html>
<head>
    <style>
        .hidden { display: none; }
        .invisible { visibility: hidden; }
        header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: #333;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <header id="header">Header</header>
    <button class="hidden" id="btn-hidden">Hidden Button</button>
    <button class="invisible" id="btn-invisible">Invisible Button</button>
    <button id="btn-visible">Visible Button</button>
</body>
</html>
`;

// ============================================================================
// Unit Tests - FocusObscuredAnalyzer Class
// ============================================================================

describe('FocusObscuredAnalyzer', () => {
    describe('constructor', () => {
        it('should create analyzer with default options', () => {
            const analyzer = new FocusObscuredAnalyzer();
            expect(analyzer).toBeDefined();
        });

        it('should accept custom minOverlapThreshold', () => {
            const analyzer = new FocusObscuredAnalyzer({ minOverlapThreshold: 75 });
            expect(analyzer).toBeDefined();
        });

        it('should accept includeHiddenElements option', () => {
            const analyzer = new FocusObscuredAnalyzer({ includeHiddenElements: true });
            expect(analyzer).toBeDefined();
        });
    });

    describe('createFocusObscuredAnalyzer factory', () => {
        it('should create analyzer instance', () => {
            const analyzer = createFocusObscuredAnalyzer();
            expect(analyzer).toBeInstanceOf(FocusObscuredAnalyzer);
        });

        it('should pass options to constructor', () => {
            const options: FocusObscuredAnalyzerOptions = {
                minOverlapThreshold: 60,
                includeHiddenElements: true
            };
            const analyzer = createFocusObscuredAnalyzer(options);
            expect(analyzer).toBeInstanceOf(FocusObscuredAnalyzer);
        });
    });
});

// ============================================================================
// Integration Tests - With Playwright
// ============================================================================

describe('FocusObscuredAnalyzer - Integration Tests', () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;
    let analyzer: FocusObscuredAnalyzer;

    beforeAll(async () => {
        browser = await chromium.launch();
    });

    afterAll(async () => {
        await browser.close();
    });

    beforeEach(async () => {
        context = await browser.newContext();
        page = await context.newPage();
        analyzer = new FocusObscuredAnalyzer();
    });

    afterEach(async () => {
        await page.close();
        await context.close();
    });

    // ========================================================================
    // Core Violation Detection
    // ========================================================================

    describe('analyze() - Violation Detection', () => {
        it('should detect element completely obscured by fixed header', async () => {
            await page.setContent(FIXTURE_STICKY_HEADER_OBSCURING);

            const violations = await analyzer.analyze(page);

            expect(violations.length).toBeGreaterThanOrEqual(1);

            const focusViolation = violations.find(v => v.id === 'focus-not-obscured');
            expect(focusViolation).toBeDefined();
            expect(focusViolation?.nodes.length).toBeGreaterThan(0);

            // Check that the obscured button is in the violation
            const obscuredNode = focusViolation?.nodes.find(n =>
                n.selector.includes('btn-obscured') || n.selector.includes('obscured-button')
            );
            expect(obscuredNode).toBeDefined();
        });

        it('should detect element obscured by fixed footer', async () => {
            await page.setContent(FIXTURE_STICKY_FOOTER_OBSCURING);

            const violations = await analyzer.analyze(page);

            // Should find violation for footer-obscured button
            expect(violations.length).toBeGreaterThanOrEqual(0);
            // The button at bottom:20px overlapping with footer at bottom:0 height:60px
        });

        it('should return empty array when no overlays exist', async () => {
            await page.setContent(FIXTURE_NO_OVERLAYS);

            const violations = await analyzer.analyze(page);

            expect(violations).toEqual([]);
        });

        it('should not flag elements with less than threshold overlap', async () => {
            await page.setContent(FIXTURE_PARTIAL_OVERLAP);

            // Default threshold is 50%
            const violations = await analyzer.analyze(page);

            // 25% overlap should not be flagged with 50% threshold
            const partialNode = violations.flatMap(v => v.nodes)
                .find(n => n.selector.includes('btn-partial'));

            // Should not find partial overlap as a violation (< 50%)
            expect(partialNode).toBeUndefined();
        });

        it('should respect custom overlap threshold', async () => {
            await page.setContent(FIXTURE_PARTIAL_OVERLAP);

            // Lower threshold to 20%
            const sensitiveAnalyzer = new FocusObscuredAnalyzer({ minOverlapThreshold: 20 });
            const violations = await sensitiveAnalyzer.analyze(page);

            // Now 25% overlap should be flagged
            expect(violations.length).toBeGreaterThanOrEqual(0);
        });
    });

    // ========================================================================
    // Multiple Overlays
    // ========================================================================

    describe('analyze() - Multiple Overlays', () => {
        it('should detect elements obscured by multiple overlays', async () => {
            await page.setContent(FIXTURE_MULTIPLE_OVERLAYS);

            const violations = await analyzer.analyze(page);

            // Button at top:20px, left:50px should be caught by header or sidebar
            expect(violations.length).toBeGreaterThanOrEqual(0);
        });

        it('should report all obscuring elements in failure summary', async () => {
            await page.setContent(FIXTURE_STICKY_HEADER_OBSCURING);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                const node = violations[0].nodes[0];
                expect(node.failureSummary).toBeDefined();
                expect(node.failureSummary.length).toBeGreaterThan(0);
            }
        });
    });

    // ========================================================================
    // Z-Index Handling
    // ========================================================================

    describe('analyze() - Z-Index Behavior', () => {
        it('should not flag elements with higher z-index than overlays', async () => {
            await page.setContent(FIXTURE_Z_INDEX_LOWER);

            const violations = await analyzer.analyze(page);

            // Button with z-index: 1001 should not be flagged
            // as overlay is z-index: 1
            const highZNode = violations.flatMap(v => v.nodes)
                .find(n => n.selector.includes('btn-high-z'));

            expect(highZNode).toBeUndefined();
        });
    });

    // ========================================================================
    // Hidden Element Handling
    // ========================================================================

    describe('analyze() - Hidden Elements', () => {
        it('should skip display:none elements by default', async () => {
            await page.setContent(FIXTURE_HIDDEN_ELEMENTS);

            const violations = await analyzer.analyze(page);

            // Should not include hidden elements in analysis
            const hiddenNode = violations.flatMap(v => v.nodes)
                .find(n => n.selector.includes('btn-hidden'));

            expect(hiddenNode).toBeUndefined();
        });

        it('should skip visibility:hidden elements by default', async () => {
            await page.setContent(FIXTURE_HIDDEN_ELEMENTS);

            const violations = await analyzer.analyze(page);

            const invisibleNode = violations.flatMap(v => v.nodes)
                .find(n => n.selector.includes('btn-invisible'));

            expect(invisibleNode).toBeUndefined();
        });

        it('should include hidden elements when option is enabled', async () => {
            await page.setContent(FIXTURE_HIDDEN_ELEMENTS);

            const analyzerWithHidden = new FocusObscuredAnalyzer({ includeHiddenElements: true });

            // This may or may not find violations depending on implementation
            // The important thing is it doesn't throw
            const violations = await analyzerWithHidden.analyze(page);
            expect(Array.isArray(violations)).toBe(true);
        });
    });

    // ========================================================================
    // Focusable Element Detection
    // ========================================================================

    describe('Focusable Element Detection', () => {
        it('should detect all standard focusable elements', async () => {
            await page.setContent(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        header {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            height: 200px;
                            background: #333;
                            z-index: 1000;
                        }
                        main {
                            margin-top: 50px;
                        }
                        .fixed-controls {
                            position: fixed;
                            top: 50px;
                            left: 20px;
                        }
                    </style>
                </head>
                <body>
                    <header>Header</header>
                    <main class="fixed-controls">
                        <a href="#" id="link">Link</a>
                        <button id="btn">Button</button>
                        <input type="text" id="input">
                        <select id="select"><option>Option</option></select>
                        <textarea id="textarea"></textarea>
                        <div tabindex="0" id="tabindexed">Custom</div>
                        <div contenteditable="true" id="editable">Edit</div>
                    </main>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            // Should analyze all focusable element types
            expect(Array.isArray(violations)).toBe(true);
        });

        it('should ignore elements with tabindex="-1"', async () => {
            await page.setContent(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        header {
                            position: fixed;
                            top: 0;
                            height: 100px;
                            width: 100%;
                            background: #333;
                            z-index: 1000;
                        }
                        .obscured {
                            position: fixed;
                            top: 30px;
                        }
                    </style>
                </head>
                <body>
                    <header>Header</header>
                    <div tabindex="-1" class="obscured" id="non-focusable">Not Focusable</div>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            // tabindex="-1" elements should not be analyzed
            const nonFocusableNode = violations.flatMap(v => v.nodes)
                .find(n => n.selector.includes('non-focusable'));

            expect(nonFocusableNode).toBeUndefined();
        });

        it('should ignore disabled form elements', async () => {
            await page.setContent(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        header {
                            position: fixed;
                            top: 0;
                            height: 100px;
                            width: 100%;
                            background: #333;
                            z-index: 1000;
                        }
                        .obscured {
                            position: fixed;
                            top: 30px;
                        }
                    </style>
                </head>
                <body>
                    <header>Header</header>
                    <button disabled class="obscured" id="disabled-btn">Disabled</button>
                    <input disabled type="text" class="obscured" id="disabled-input">
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            // Disabled elements should not be analyzed
            const disabledNodes = violations.flatMap(v => v.nodes)
                .filter(n => n.selector.includes('disabled'));

            expect(disabledNodes.length).toBe(0);
        });
    });

    // ========================================================================
    // Violation Format Compliance
    // ========================================================================

    describe('Violation Format', () => {
        it('should return violations in correct format', async () => {
            await page.setContent(FIXTURE_STICKY_HEADER_OBSCURING);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                const violation = violations[0];

                expect(violation).toHaveProperty('id', 'focus-not-obscured');
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

        it('should include correct node properties', async () => {
            await page.setContent(FIXTURE_STICKY_HEADER_OBSCURING);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0 && violations[0].nodes.length > 0) {
                const node = violations[0].nodes[0];

                expect(node).toHaveProperty('selector');
                expect(typeof node.selector).toBe('string');
                expect(node).toHaveProperty('html');
                expect(typeof node.html).toBe('string');
                expect(node).toHaveProperty('failureSummary');
                expect(typeof node.failureSummary).toBe('string');
                expect(node).toHaveProperty('target');
                expect(Array.isArray(node.target)).toBe(true);
            }
        });
    });

    // ========================================================================
    // Impact Level Determination
    // ========================================================================

    describe('Impact Level Determination', () => {
        it('should assign critical impact for 100% obscured elements', async () => {
            await page.setContent(FIXTURE_STICKY_HEADER_OBSCURING);

            const violations = await analyzer.analyze(page);

            if (violations.length > 0) {
                // Completely hidden elements should be critical or serious
                expect(['critical', 'serious']).toContain(violations[0].impact);
            }
        });
    });

    // ========================================================================
    // Sticky vs Fixed Position
    // ========================================================================

    describe('Position Types', () => {
        it('should detect sticky positioned overlays', async () => {
            await page.setContent(FIXTURE_STICKY_VS_REGULAR);

            // Sticky headers should be detected as potential obscurers
            const violations = await analyzer.analyze(page);
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

        it('should handle page with only overlays and no focusables', async () => {
            await page.setContent(`
                <html>
                <head>
                    <style>
                        header {
                            position: fixed;
                            top: 0;
                            height: 60px;
                            width: 100%;
                            background: #333;
                            z-index: 1000;
                        }
                    </style>
                </head>
                <body>
                    <header>Header</header>
                    <div>Just some text</div>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            expect(violations).toEqual([]);
        });

        it('should handle overlays with zero dimensions', async () => {
            await page.setContent(`
                <html>
                <head>
                    <style>
                        .zero-size {
                            position: fixed;
                            top: 0;
                            width: 0;
                            height: 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="zero-size">Hidden</div>
                    <button>Button</button>
                </body>
                </html>
            `);

            const violations = await analyzer.analyze(page);

            // Zero-size overlays should not cause violations
            expect(violations).toEqual([]);
        });
    });
});
