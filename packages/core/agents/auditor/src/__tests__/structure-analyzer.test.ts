/**
 * Unit tests for Structure Analyzer Service
 * 
 * Tests extraction of interactive elements, landmarks, and headings.
 * Requirements: 9.3
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Browser, Page, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import { StructureAnalyzerService } from '../services/structure-analyzer.js';
import { LocalPlaywrightProvider } from '../providers/local-playwright-provider.js';
import type { AuditorError } from '../types/index.js';

describe('StructureAnalyzerService', () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;
    let provider: LocalPlaywrightProvider;
    let analyzer: StructureAnalyzerService;

    beforeAll(async () => {
        browser = await chromium.launch();
        context = await browser.newContext();
        page = await context.newPage();
        provider = new LocalPlaywrightProvider();
        analyzer = new StructureAnalyzerService(provider);
    });

    afterAll(async () => {
        await page.close();
        await context.close();
        await browser.close();
    });

    describe('extractInteractiveElements', () => {
        /**
         * Requirement 9.3: Extract interactive elements (buttons, links, inputs)
         */
        it('should extract buttons from the page', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <button id="btn1">Click me</button>
                        <button id="btn2">Submit</button>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            expect(result.interactiveElements.length).toBeGreaterThanOrEqual(2);

            const buttons = result.interactiveElements.filter(el => el.tagName === 'button');
            expect(buttons.length).toBe(2);

            const btn1 = buttons.find(el => el.selector === '#btn1');
            expect(btn1).toBeDefined();
            expect(btn1?.role).toBe('button');
            expect(btn1?.text).toBe('Click me');
        });

        it('should extract links from the page', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <a href="/home" id="home-link">Home</a>
                        <a href="/about" id="about-link">About Us</a>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const links = result.interactiveElements.filter(el => el.tagName === 'a');
            expect(links.length).toBe(2);

            const homeLink = links.find(el => el.selector === '#home-link');
            expect(homeLink).toBeDefined();
            expect(homeLink?.role).toBe('link');
            expect(homeLink?.text).toBe('Home');
        });

        it('should extract input elements from the page', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <input type="text" id="username" name="username" placeholder="Username">
                        <input type="email" id="email" name="email" placeholder="Email">
                        <select id="country" name="country">
                            <option>USA</option>
                        </select>
                        <textarea id="message" name="message"></textarea>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const inputs = result.interactiveElements.filter(el => el.tagName === 'input');
            expect(inputs.length).toBe(2);

            const selects = result.interactiveElements.filter(el => el.tagName === 'select');
            expect(selects.length).toBe(1);
            expect(selects[0]?.role).toBe('combobox');

            const textareas = result.interactiveElements.filter(el => el.tagName === 'textarea');
            expect(textareas.length).toBe(1);
            expect(textareas[0]?.role).toBe('textbox');
        });

        it('should extract elements with ARIA roles', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <div role="button" id="custom-btn" aria-label="Custom Button">Click</div>
                        <div role="link" id="custom-link" aria-label="Custom Link">Link</div>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const customBtn = result.interactiveElements.find(el => el.selector === '#custom-btn');
            expect(customBtn).toBeDefined();
            expect(customBtn?.role).toBe('button');
            expect(customBtn?.text).toBe('Custom Button');

            const customLink = result.interactiveElements.find(el => el.selector === '#custom-link');
            expect(customLink).toBeDefined();
            expect(customLink?.role).toBe('link');
        });
    });

    describe('extractLandmarks', () => {
        /**
         * Requirement 9.3: Extract landmarks
         */
        it('should extract HTML5 semantic landmarks', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <header id="main-header">Header</header>
                        <nav id="main-nav">Navigation</nav>
                        <main id="main-content">Main Content</main>
                        <aside id="sidebar">Sidebar</aside>
                        <footer id="main-footer">Footer</footer>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            expect(result.landmarks.length).toBeGreaterThanOrEqual(5);

            const header = result.landmarks.find(el => el.selector === '#main-header');
            expect(header).toBeDefined();
            expect(header?.role).toBe('banner');

            const nav = result.landmarks.find(el => el.selector === '#main-nav');
            expect(nav).toBeDefined();
            expect(nav?.role).toBe('navigation');

            const main = result.landmarks.find(el => el.selector === '#main-content');
            expect(main).toBeDefined();
            expect(main?.role).toBe('main');

            const aside = result.landmarks.find(el => el.selector === '#sidebar');
            expect(aside).toBeDefined();
            expect(aside?.role).toBe('complementary');

            const footer = result.landmarks.find(el => el.selector === '#main-footer');
            expect(footer).toBeDefined();
            expect(footer?.role).toBe('contentinfo');
        });

        it('should extract ARIA landmark roles', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <div role="banner" id="aria-header">Header</div>
                        <div role="navigation" id="aria-nav" aria-label="Main Navigation">Nav</div>
                        <div role="main" id="aria-main">Main</div>
                        <div role="search" id="aria-search" aria-label="Site Search">Search</div>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const banner = result.landmarks.find(el => el.selector === '#aria-header');
            expect(banner).toBeDefined();
            expect(banner?.role).toBe('banner');

            const nav = result.landmarks.find(el => el.text === 'Main Navigation');
            expect(nav).toBeDefined();
            expect(nav?.role).toBe('navigation');

            const search = result.landmarks.find(el => el.text === 'Site Search');
            expect(search).toBeDefined();
            expect(search?.role).toBe('search');
        });

        it('should extract sections with aria-label', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <section aria-label="Featured Products" id="featured">
                            <h2>Featured</h2>
                        </section>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const section = result.landmarks.find(el => el.text === 'Featured Products');
            expect(section).toBeDefined();
            expect(section?.role).toBe('region');
        });
    });

    describe('extractHeadings', () => {
        /**
         * Requirement 9.3: Extract headings
         */
        it('should extract all heading levels', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <h1 id="h1">Main Title</h1>
                        <h2 id="h2">Section Title</h2>
                        <h3 id="h3">Subsection</h3>
                        <h4 id="h4">Sub-subsection</h4>
                        <h5 id="h5">Minor heading</h5>
                        <h6 id="h6">Smallest heading</h6>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            expect(result.headings.length).toBe(6);

            const h1 = result.headings.find(el => el.selector === '#h1');
            expect(h1).toBeDefined();
            expect(h1?.tagName).toBe('h1');
            expect(h1?.role).toBe('heading');
            expect(h1?.text).toBe('Main Title');

            const h2 = result.headings.find(el => el.selector === '#h2');
            expect(h2).toBeDefined();
            expect(h2?.tagName).toBe('h2');
            expect(h2?.text).toBe('Section Title');
        });

        it('should extract elements with role="heading"', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <div role="heading" aria-level="1" id="custom-h1">Custom Heading</div>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const customHeading = result.headings.find(el => el.selector === '#custom-h1');
            expect(customHeading).toBeDefined();
            expect(customHeading?.role).toBe('heading');
            expect(customHeading?.text).toBe('Custom Heading');
        });

        it('should truncate long heading text', async () => {
            const longText = 'A'.repeat(150);
            await page.setContent(`
                <html>
                    <body>
                        <h1 id="long-heading">${longText}</h1>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const heading = result.headings.find(el => el.selector === '#long-heading');
            expect(heading).toBeDefined();
            expect(heading?.text?.length).toBeLessThanOrEqual(100);
        });
    });

    describe('analyze - with setPage', () => {
        it('should throw error when page is not set', async () => {
            const freshAnalyzer = new StructureAnalyzerService(provider);

            try {
                await freshAnalyzer.analyze();
                expect.fail('Should have thrown an error');
            } catch (error) {
                const auditorError = error as AuditorError;
                expect(auditorError.code).toBe('BROWSER_PROVIDER_UNAVAILABLE');
                expect(auditorError.message).toContain('No page available');
            }
        });

        it('should work correctly after setPage is called', async () => {
            const freshAnalyzer = new StructureAnalyzerService(provider);

            await page.setContent(`
                <html>
                    <body>
                        <h1>Test Page</h1>
                        <button>Click me</button>
                    </body>
                </html>
            `);

            freshAnalyzer.setPage(page);

            const result = await freshAnalyzer.analyze();

            expect(result.headings.length).toBeGreaterThan(0);
            expect(result.interactiveElements.length).toBeGreaterThan(0);
        });
    });

    describe('browserProvider getter', () => {
        it('should return the browser provider', () => {
            expect(analyzer.browserProvider).toBe(provider);
        });
    });

    describe('PageStructure completeness', () => {
        it('should return all three categories in the result', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <header>
                            <h1>Page Title</h1>
                            <nav>
                                <a href="/home">Home</a>
                            </nav>
                        </header>
                        <main>
                            <h2>Content</h2>
                            <button>Action</button>
                        </main>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            expect(result).toHaveProperty('interactiveElements');
            expect(result).toHaveProperty('landmarks');
            expect(result).toHaveProperty('headings');

            expect(Array.isArray(result.interactiveElements)).toBe(true);
            expect(Array.isArray(result.landmarks)).toBe(true);
            expect(Array.isArray(result.headings)).toBe(true);
        });

        it('should return empty arrays for pages with no matching elements', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <div>Just some text</div>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            expect(result.interactiveElements).toEqual([]);
            expect(result.landmarks).toEqual([]);
            expect(result.headings).toEqual([]);
        });
    });

    describe('selector generation', () => {
        it('should prefer ID selectors when available', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <button id="unique-btn">Button</button>
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const button = result.interactiveElements.find(el => el.tagName === 'button');
            expect(button?.selector).toBe('#unique-btn');
        });

        it('should use name attribute for inputs without ID', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <input type="text" name="username">
                    </body>
                </html>
            `);

            const result = await analyzer.analyzeOnPage(page);

            const input = result.interactiveElements.find(el => el.tagName === 'input');
            expect(input?.selector).toBe('input[name="username"]');
        });
    });
});
