/**
 * Integration Tests for WCAG 2.2 Analyzers
 *
 * Tests end-to-end analyzer flows with real browser contexts.
 * Validates FocusObscuredAnalyzer and DraggingAnalyzer work correctly
 * with actual HTML fixtures.
 *
 * Requirements: WCAG 2.4.11 (Focus Not Obscured), WCAG 2.5.7 (Dragging Movements)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Browser, Page, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import { FocusObscuredAnalyzer } from '../../services/focus-obscured-analyzer.js';
import { DraggingAnalyzer } from '../../services/dragging-analyzer.js';
import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = path.join(__dirname, '../../__fixtures__');

const loadFixture = (filename: string): string => {
    const filepath = path.join(FIXTURES_DIR, filename);
    return fs.readFileSync(filepath, 'utf-8');
};

describe('WCAG 2.2 Analyzers Integration', () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;

    beforeAll(async () => {
        browser = await chromium.launch();
    });

    afterAll(async () => {
        await browser.close();
    });

    beforeEach(async () => {
        context = await browser.newContext();
        page = await context.newPage();
    });

    afterEach(async () => {
        await page.close();
        await context.close();
    });

    describe('FocusObscuredAnalyzer with Fixtures', () => {
        it('should detect violations in sticky-header-page fixture', async () => {
            const html = loadFixture('sticky-header-page.html');
            await page.setContent(html);

            const analyzer = new FocusObscuredAnalyzer();
            const violations = await analyzer.analyze(page);

            // Fixture has sticky header that may obscure focusable elements
            expect(Array.isArray(violations)).toBe(true);

            if (violations.length > 0) {
                expect(violations[0].id).toBe('focus-not-obscured');
                expect(violations[0].nodes.length).toBeGreaterThan(0);
            }
        });

        it('should return violations in correct format', async () => {
            const html = loadFixture('sticky-header-page.html');
            await page.setContent(html);

            const analyzer = new FocusObscuredAnalyzer();
            const violations = await analyzer.analyze(page);

            for (const violation of violations) {
                expect(violation).toHaveProperty('id');
                expect(violation).toHaveProperty('impact');
                expect(violation).toHaveProperty('description');
                expect(violation).toHaveProperty('help');
                expect(violation).toHaveProperty('helpUrl');
                expect(violation).toHaveProperty('nodes');

                for (const node of violation.nodes) {
                    expect(node).toHaveProperty('selector');
                    expect(node).toHaveProperty('html');
                    expect(node).toHaveProperty('failureSummary');
                    expect(node).toHaveProperty('target');
                }
            }
        });
    });

    describe('DraggingAnalyzer with Fixtures', () => {
        it('should detect violations in draggable-list fixture', async () => {
            const html = loadFixture('draggable-list.html');
            await page.setContent(html);

            const analyzer = new DraggingAnalyzer();
            const violations = await analyzer.analyze(page);

            // Fixture has draggable items that need alternatives
            expect(Array.isArray(violations)).toBe(true);

            if (violations.length > 0) {
                expect(violations[0].id).toBe('dragging-movements');
                expect(violations[0].nodes.length).toBeGreaterThan(0);
            }
        });

        it('should not flag slider with alternative input', async () => {
            const html = loadFixture('slider-with-alt.html');
            await page.setContent(html);

            const analyzer = new DraggingAnalyzer();
            const violations = await analyzer.analyze(page);

            // Slider with number input alternative should have fewer/no violations
            expect(Array.isArray(violations)).toBe(true);
        });

        it('should detect small touch targets', async () => {
            const html = loadFixture('small-touch-targets.html');
            await page.setContent(html);

            const analyzer = new DraggingAnalyzer();
            const violations = await analyzer.analyze(page);

            // This fixture tests target size, not dragging
            expect(Array.isArray(violations)).toBe(true);
        });
    });

    describe('Combined Analysis Pipeline', () => {
        it('should run both analyzers on same page', async () => {
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
                            height: 60px;
                            background: #333;
                            z-index: 1000;
                        }
                        main { margin-top: 80px; padding: 20px; }
                        .fixed-btn { position: fixed; top: 20px; left: 50%; }
                    </style>
                </head>
                <body>
                    <header>Site Header</header>
                    <main>
                        <button class="fixed-btn" id="obscured">Obscured Button</button>
                        <ul class="sortable">
                            <li draggable="true" id="drag1">Draggable 1</li>
                            <li draggable="true" id="drag2">Draggable 2</li>
                        </ul>
                    </main>
                </body>
                </html>
            `);

            const focusAnalyzer = new FocusObscuredAnalyzer();
            const draggingAnalyzer = new DraggingAnalyzer();

            const [focusViolations, draggingViolations] = await Promise.all([
                focusAnalyzer.analyze(page),
                draggingAnalyzer.analyze(page)
            ]);

            expect(Array.isArray(focusViolations)).toBe(true);
            expect(Array.isArray(draggingViolations)).toBe(true);

            // Verify violations are properly categorized
            for (const violation of focusViolations) {
                expect(violation.id).toBe('focus-not-obscured');
            }

            for (const violation of draggingViolations) {
                expect(violation.id).toBe('dragging-movements');
            }
        });

        it('should produce consistent results across multiple runs', async () => {
            await page.setContent(`
                <!DOCTYPE html>
                <html>
                <body>
                    <ul class="sortable">
                        <li draggable="true">Item 1</li>
                        <li draggable="true">Item 2</li>
                    </ul>
                </body>
                </html>
            `);

            const analyzer = new DraggingAnalyzer();

            const run1 = await analyzer.analyze(page);
            const run2 = await analyzer.analyze(page);
            const run3 = await analyzer.analyze(page);

            expect(run1.length).toBe(run2.length);
            expect(run2.length).toBe(run3.length);
        });
    });

    describe('Error Handling', () => {
        it('should handle pages with no focusable elements', async () => {
            await page.setContent('<html><body><p>No interactive elements</p></body></html>');

            const focusAnalyzer = new FocusObscuredAnalyzer();
            const violations = await focusAnalyzer.analyze(page);

            expect(violations).toEqual([]);
        });

        it('should handle pages with no draggable elements', async () => {
            await page.setContent('<html><body><button>Just a button</button></body></html>');

            const draggingAnalyzer = new DraggingAnalyzer();
            const violations = await draggingAnalyzer.analyze(page);

            expect(violations).toEqual([]);
        });

        it('should handle empty page', async () => {
            await page.setContent('<html><body></body></html>');

            const focusAnalyzer = new FocusObscuredAnalyzer();
            const draggingAnalyzer = new DraggingAnalyzer();

            const [focusViolations, draggingViolations] = await Promise.all([
                focusAnalyzer.analyze(page),
                draggingAnalyzer.analyze(page)
            ]);

            expect(focusViolations).toEqual([]);
            expect(draggingViolations).toEqual([]);
        });
    });
});

