/**
 * Local Scanner Service
 * 
 * Performs accessibility scanning using local Browserless container.
 * Used for local development when AWS Bedrock/Lambda is not needed.
 */

import { chromium, type Browser, type Page } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

interface Violation {
    id: string;
    impact: string;
    description: string;
    selector: string;
    html: string;
    help: string;
    helpUrl: string;
}

interface ScanResult {
    success: boolean;
    url: string;
    viewport: string;
    violations: Violation[];
    violationCounts: {
        critical: number;
        serious: number;
        moderate: number;
        minor: number;
        total: number;
    };
}

function getBrowserlessEndpoint(): string {
    // ghcr.io/browserless/chromium uses plain WebSocket URL without path
    return process.env.BROWSERLESS_ENDPOINT ?? 'ws://localhost:3000';
}

async function connectBrowser(): Promise<Browser> {
    const endpoint = getBrowserlessEndpoint();
    console.log('Connecting to Browserless:', endpoint);

    try {
        // Use connectOverCDP for Browserless CDP mode
        const browser = await chromium.connectOverCDP(endpoint);
        return browser;
    } catch (error) {
        console.log('Failed to connect to Browserless, using local browser');
        return await chromium.launch({ headless: true });
    }
}

function getViewportDimensions(viewport: string): { width: number; height: number } {
    return viewport === 'mobile'
        ? { width: 375, height: 812 }
        : { width: 1920, height: 1080 };
}

/**
 * Scan a URL for accessibility violations using local Browserless
 */
export async function scanWithBrowserless(
    url: string,
    viewport: string = 'desktop'
): Promise<ScanResult> {
    console.log('Local scan starting:', url, 'viewport:', viewport);

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await connectBrowser();
        const context = await browser.newContext({
            viewport: getViewportDimensions(viewport),
        });
        page = await context.newPage();

        // Navigate to URL with networkidle to ensure dynamic content is loaded
        // This catches more issues on JavaScript-heavy sites
        console.log('Navigating to:', url);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Run axe-core analysis with WCAG 2.2 AA tags + best practices
        // Including best-practice catches important issues like missing landmarks,
        // region violations, and other accessibility improvements
        console.log('Running axe-core analysis...');
        const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
            .analyze();

        // Transform violations to our format
        const violations: Violation[] = axeResults.violations.flatMap(violation =>
            violation.nodes.map(node => ({
                id: violation.id,
                impact: violation.impact ?? 'moderate',
                description: violation.description,
                selector: node.target.join(' '),
                html: node.html,
                help: violation.help,
                helpUrl: violation.helpUrl,
            }))
        );

        // Count violations by impact
        const violationCounts = {
            critical: violations.filter(v => v.impact === 'critical').length,
            serious: violations.filter(v => v.impact === 'serious').length,
            moderate: violations.filter(v => v.impact === 'moderate').length,
            minor: violations.filter(v => v.impact === 'minor').length,
            total: violations.length,
        };

        console.log('Scan completed. Found', violationCounts.total, 'violations');

        return {
            success: true,
            url,
            viewport,
            violations,
            violationCounts,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Local scan failed:', errorMessage);

        return {
            success: false,
            url,
            viewport,
            violations: [],
            violationCounts: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 },
        };
    } finally {
        if (page) await page.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

