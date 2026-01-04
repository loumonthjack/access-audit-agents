/**
 * Unit tests for Verifier Service
 * 
 * Tests pass result structure, fail result with violations, and element not found error.
 * Requirements: 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Browser, Page, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import { VerifierService } from '../services/verifier.js';
import { LocalPlaywrightProvider } from '../providers/local-playwright-provider.js';
import type { AuditorError } from '../types/index.js';

describe('VerifierService', () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;
    let provider: LocalPlaywrightProvider;
    let verifier: VerifierService;

    beforeAll(async () => {
        browser = await chromium.launch();
        context = await browser.newContext();
        page = await context.newPage();
        provider = new LocalPlaywrightProvider();
        verifier = new VerifierService(provider);
    });

    afterAll(async () => {
        await page.close();
        await context.close();
        await browser.close();
    });

    describe('verifyOnPage - pass result structure', () => {
        /**
         * Requirement 4.2: Return status "pass" with score when verification passes
         */
        it('should return pass status with score 100 when element has no violations', async () => {
            // Create a page with an accessible button
            await page.setContent(`
                <html>
                    <body>
                        <button id="accessible-btn">Click me</button>
                    </body>
                </html>
            `);

            const result = await verifier.verifyOnPage(page, {
                selector: '#accessible-btn',
                ruleId: 'button-name'
            });

            expect(result.status).toBe('pass');
            expect(result.score).toBe(100);
            expect(result.violations).toBeUndefined();
        });

        it('should return pass status for accessible link', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <a href="/home" id="home-link">Go to Home</a>
                    </body>
                </html>
            `);

            const result = await verifier.verifyOnPage(page, {
                selector: '#home-link',
                ruleId: 'link-name'
            });

            expect(result.status).toBe('pass');
            expect(result.score).toBe(100);
        });
    });

    describe('verifyOnPage - fail result with violations', () => {
        /**
         * Requirement 4.3: Return status "fail" with violations when verification fails
         */
        it('should return fail status with violations when element has accessibility issues', async () => {
            // Create a page with an inaccessible button (no text content)
            await page.setContent(`
                <html>
                    <body>
                        <button id="bad-btn"></button>
                    </body>
                </html>
            `);

            const result = await verifier.verifyOnPage(page, {
                selector: '#bad-btn',
                ruleId: 'button-name'
            });

            expect(result.status).toBe('fail');
            expect(result.score).toBe(0);
            expect(result.violations).toBeDefined();
            expect(result.violations!.length).toBeGreaterThan(0);
            expect(result.violations![0].id).toBe('button-name');
        });

        it('should include violation details with nodes', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <img id="bad-img" src="test.jpg">
                    </body>
                </html>
            `);

            const result = await verifier.verifyOnPage(page, {
                selector: '#bad-img',
                ruleId: 'image-alt'
            });

            expect(result.status).toBe('fail');
            expect(result.violations).toBeDefined();

            const violation = result.violations![0];
            expect(violation.id).toBe('image-alt');
            expect(violation.impact).toBeDefined();
            expect(violation.description).toBeDefined();
            expect(violation.help).toBeDefined();
            expect(violation.helpUrl).toBeDefined();
            expect(violation.nodes).toBeDefined();
            expect(violation.nodes.length).toBeGreaterThan(0);

            const node = violation.nodes[0];
            expect(node.selector).toBeDefined();
            expect(node.html).toBeDefined();
            expect(node.failureSummary).toBeDefined();
            expect(node.target).toBeDefined();
        });
    });

    describe('verifyOnPage - element not found error', () => {
        /**
         * Requirement 4.4: Return error when selector doesn't match any element
         */
        it('should throw ELEMENT_NOT_FOUND error when selector does not match', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <button id="existing-btn">Click me</button>
                    </body>
                </html>
            `);

            try {
                await verifier.verifyOnPage(page, {
                    selector: '#non-existent-element',
                    ruleId: 'button-name'
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                const auditorError = error as AuditorError;
                expect(auditorError.code).toBe('ELEMENT_NOT_FOUND');
                expect(auditorError.message).toContain('Element not found');
                expect(auditorError.message).toContain('#non-existent-element');
                expect(auditorError.details).toBeDefined();
                expect(auditorError.details!.selector).toBe('#non-existent-element');
            }
        });

        it('should throw ELEMENT_NOT_FOUND for invalid CSS selector', async () => {
            await page.setContent(`
                <html>
                    <body>
                        <div>Content</div>
                    </body>
                </html>
            `);

            try {
                await verifier.verifyOnPage(page, {
                    selector: '.missing-class',
                    ruleId: 'region'
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                const auditorError = error as AuditorError;
                expect(auditorError.code).toBe('ELEMENT_NOT_FOUND');
            }
        });
    });

    describe('verify - with setPage', () => {
        it('should throw error when page is not set', async () => {
            const freshVerifier = new VerifierService(provider);

            try {
                await freshVerifier.verify({
                    selector: '#some-element',
                    ruleId: 'button-name'
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                const auditorError = error as AuditorError;
                expect(auditorError.code).toBe('BROWSER_PROVIDER_UNAVAILABLE');
                expect(auditorError.message).toContain('No page available');
            }
        });

        it('should work correctly after setPage is called', async () => {
            const freshVerifier = new VerifierService(provider);

            await page.setContent(`
                <html>
                    <body>
                        <button id="test-btn">Test Button</button>
                    </body>
                </html>
            `);

            freshVerifier.setPage(page);

            const result = await freshVerifier.verify({
                selector: '#test-btn',
                ruleId: 'button-name'
            });

            expect(result.status).toBe('pass');
        });
    });

    describe('browserProvider getter', () => {
        it('should return the browser provider', () => {
            expect(verifier.browserProvider).toBe(provider);
        });
    });
});
