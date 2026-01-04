/**
 * Auditor Lambda Handler
 * 
 * Bedrock Action Group handler for accessibility scanning.
 * Uses axe-core via Playwright/Browserless to detect WCAG violations.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { chromium, type Browser, type Page } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

// Bedrock Action Group event types
interface BedrockApiEvent {
    messageVersion: string;
    agent: {
        name: string;
        id: string;
        alias: string;
        version: string;
    };
    sessionId: string;
    actionGroup: string;
    apiPath: string;
    httpMethod: string;
    requestBody?: {
        content: {
            'application/json': {
                properties: Array<{ name: string; type: string; value: string }>;
            };
        };
    };
    parameters?: Array<{ name: string; type: string; value: string }>;
}

interface ApiActionResponse {
    messageVersion: string;
    response: {
        actionGroup: string;
        apiPath: string;
        httpMethod: string;
        httpStatusCode: number;
        responseBody: {
            'application/json': {
                body: string;
            };
        };
    };
}

interface ViolationNode {
    selector: string;
    html: string;
    failureSummary: string;
    screenshot?: string; // Base64 encoded screenshot of the element
}

interface Violation {
    id: string;
    impact: string;
    description: string;
    help: string;
    helpUrl: string;
    nodes: ViolationNode[];
    recommendation?: string; // AI-generated fix recommendation
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
    pageScreenshot?: string; // Full page screenshot (base64)
    message: string;
    errorCode?: string; // User-friendly error code
    errorDetails?: string; // Additional error details
}

/**
 * Parse parameters from Bedrock Action Group event
 */
function parseParameters(params: Array<{ name: string; value: string }>): Record<string, string> {
    return params.reduce((acc, param) => {
        acc[param.name] = param.value;
        return acc;
    }, {} as Record<string, string>);
}

/**
 * Create OpenAPI-based action group response
 */
function createApiResponse(
    actionGroup: string,
    apiPath: string,
    httpMethod: string,
    body: unknown,
    statusCode: number = 200
): ApiActionResponse {
    return {
        messageVersion: '1.0',
        response: {
            actionGroup,
            apiPath,
            httpMethod,
            httpStatusCode: statusCode,
            responseBody: {
                'application/json': {
                    body: JSON.stringify(body),
                },
            },
        },
    };
}

/**
 * Connect to Browserless or local browser
 */
async function connectBrowser(): Promise<Browser> {
    const browserlessEndpoint = process.env.BROWSERLESS_ENDPOINT;
    const browserlessApiKey = process.env.BROWSERLESS_API_KEY;

    if (browserlessEndpoint && browserlessApiKey) {
        const wsEndpoint = `${browserlessEndpoint}?token=${browserlessApiKey}`;
        console.log('Connecting to Browserless via CDP:', browserlessEndpoint);
        try {
            // Use connectOverCDP for Browserless (Chrome DevTools Protocol)
            return await chromium.connectOverCDP(wsEndpoint);
        } catch (error) {
            console.error('Failed to connect to Browserless:', error);
            throw new Error(`Cannot connect to Browserless: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Fallback to local browser (for testing)
    console.log('Using local Chromium browser');
    return chromium.launch({ headless: true });
}

/**
 * Check if we can reach external services (for debugging)
 */
function canReachExternalServices(): boolean {
    // In Lambda with no NAT, we can't reach external services
    // This is a simple check - if BROWSERLESS_ENDPOINT is set but we're in a VPC without NAT,
    // we'll fail to connect
    return true; // We'll let the actual connection attempt determine this
}

/**
 * Get viewport dimensions
 */
function getViewportDimensions(viewport: string): { width: number; height: number } {
    return viewport === 'mobile'
        ? { width: 375, height: 812 }
        : { width: 1920, height: 1080 };
}

/**
 * Generate fix recommendation based on violation type
 */
function generateRecommendation(violation: { id: string; impact: string; help: string; nodes: Array<{ html: string; selector: string }> }): string {
    const ruleRecommendations: Record<string, string> = {
        'image-alt': 'Add descriptive alt text to the image. Example: alt="Description of what the image shows"',
        'button-name': 'Add accessible name using aria-label, aria-labelledby, or visible text content',
        'link-name': 'Add descriptive text to the link or use aria-label to describe the destination',
        'label': 'Associate a <label> element with the input using for/id attributes, or use aria-label',
        'color-contrast': 'Increase the contrast ratio between text and background colors to at least 4.5:1',
        'heading-order': 'Ensure headings follow a logical order (h1 → h2 → h3) without skipping levels',
        'landmark-one-main': 'Add a <main> element or role="main" to identify the primary content area',
        'landmark-unique': 'Give each landmark a unique accessible name using aria-label or aria-labelledby to distinguish them',
        'region': 'Wrap content in landmark regions (header, nav, main, aside, footer) for better screen reader navigation',
        'focus-visible': 'Ensure interactive elements have visible focus indicators (outline, border, etc.)',
        'aria-required-attr': 'Add the required ARIA attributes for the specified role',
        'aria-valid-attr-value': 'Correct the ARIA attribute value to match the expected format',
        'duplicate-id': 'Ensure all id attributes are unique within the page',
        'html-has-lang': 'Add lang attribute to the <html> element (e.g., lang="en")',
        'meta-viewport': 'Ensure the viewport meta tag allows user scaling (user-scalable=yes)',
        'select-name': 'Add an accessible name to the select element using label or aria-label',
    };

    const baseRecommendation = ruleRecommendations[violation.id] || violation.help;

    // Add specific HTML context if available
    if (violation.nodes.length > 0) {
        const node = violation.nodes[0];
        return `${baseRecommendation}\n\nAffected element: ${node.selector}\nCurrent HTML: ${node.html.substring(0, 200)}${node.html.length > 200 ? '...' : ''}`;
    }

    return baseRecommendation;
}

/**
 * Convert technical error messages to user-friendly messages
 */
function getUserFriendlyError(errorMessage: string, url: string): { code: string; message: string; details?: string } {
    const lowerError = errorMessage.toLowerCase();

    // DNS/Domain errors
    if (lowerError.includes('getaddrinfo') || lowerError.includes('enotfound') || lowerError.includes('dns')) {
        return {
            code: 'DNS_ERROR',
            message: `The domain "${new URL(url).hostname}" could not be found. Please check if the URL is correct.`,
            details: 'The website address may be misspelled or the domain may not exist.',
        };
    }

    // Connection refused
    if (lowerError.includes('econnrefused') || lowerError.includes('connection refused')) {
        return {
            code: 'CONNECTION_REFUSED',
            message: `Unable to connect to ${new URL(url).hostname}. The server may be down or blocking connections.`,
            details: 'The website exists but is not accepting connections on the expected port.',
        };
    }

    // Timeout errors
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
        return {
            code: 'TIMEOUT',
            message: `The page took too long to load. Please try again or check if the website is responding.`,
            details: 'The website may be slow or experiencing high traffic.',
        };
    }

    // SSL/Certificate errors
    if (lowerError.includes('ssl') || lowerError.includes('certificate') || lowerError.includes('cert_')) {
        return {
            code: 'SSL_ERROR',
            message: `There's a security certificate issue with this website.`,
            details: 'The website may have an expired or invalid SSL certificate.',
        };
    }

    // 404 Not Found
    if (lowerError.includes('404') || lowerError.includes('not found')) {
        return {
            code: 'NOT_FOUND',
            message: `The page at "${url}" was not found (404 error).`,
            details: 'The specific page may have been moved or deleted.',
        };
    }

    // 403 Forbidden
    if (lowerError.includes('403') || lowerError.includes('forbidden')) {
        return {
            code: 'FORBIDDEN',
            message: `Access to this page is forbidden. The website may be blocking automated scans.`,
            details: 'Some websites block automated tools for security reasons.',
        };
    }

    // 429 Rate limiting (Browserless)
    if (lowerError.includes('429') || lowerError.includes('too many requests')) {
        return {
            code: 'RATE_LIMITED',
            message: `Too many scan requests. Please wait a moment and try again.`,
            details: 'The scanning service is temporarily rate-limited. Try again in a few seconds.',
        };
    }

    // Browserless connection errors
    if (lowerError.includes('browserless') || lowerError.includes('connectovercdp')) {
        return {
            code: 'BROWSER_SERVICE_ERROR',
            message: `Unable to connect to the browser service. Please try again in a moment.`,
            details: 'The browser automation service may be temporarily unavailable.',
        };
    }

    // Navigation errors
    if (lowerError.includes('net::err_') || lowerError.includes('navigation')) {
        return {
            code: 'NAVIGATION_ERROR',
            message: `Unable to navigate to the page. Please check if the URL is accessible.`,
            details: 'The browser could not load the page.',
        };
    }

    // Generic network error
    if (lowerError.includes('network') || lowerError.includes('socket')) {
        return {
            code: 'NETWORK_ERROR',
            message: `A network error occurred while trying to reach the website.`,
            details: 'There may be connectivity issues between our service and the website.',
        };
    }

    // Default fallback
    return {
        code: 'SCAN_ERROR',
        message: `Unable to scan this website. Please verify the URL and try again.`,
        details: errorMessage.substring(0, 200),
    };
}

/**
 * Handle ScanUrl action - Run axe-core scan on URL with screenshots
 */
async function handleScanUrl(params: Record<string, string>): Promise<ScanResult> {
    const { url, viewport = 'desktop' } = params;

    if (!url) {
        return {
            success: false,
            url: '',
            viewport,
            violations: [],
            violationCounts: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 },
            message: 'URL is required',
        };
    }

    console.log('Scanning URL:', url, 'with viewport:', viewport);

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await connectBrowser();
        const context = await browser.newContext({
            viewport: getViewportDimensions(viewport),
        });
        page = await context.newPage();

        // Navigate to URL with networkidle to ensure dynamic content is loaded
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Take full page screenshot
        let pageScreenshot: string | undefined;
        try {
            const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
            pageScreenshot = screenshotBuffer.toString('base64');
            console.log('Captured full page screenshot');
        } catch (screenshotError) {
            console.warn('Failed to capture page screenshot:', screenshotError);
        }

        // Run axe-core analysis with WCAG 2.2 AA tags + best practices
        // Including best-practice catches important issues like missing landmarks,
        // region violations, and other accessibility improvements that tools like
        // accessibilitychecker.org also report
        const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
            .analyze();

        // Transform violations to our format with screenshots and recommendations
        const violations: Violation[] = [];

        for (const violation of axeResults.violations) {
            const nodes: ViolationNode[] = [];

            for (const node of violation.nodes) {
                const selector = node.target.join(' ');
                let elementScreenshot: string | undefined;

                // Try to capture screenshot of the specific element
                try {
                    const element = await page.locator(selector).first();
                    if (await element.isVisible()) {
                        const elementBuffer = await element.screenshot({ type: 'png' });
                        elementScreenshot = elementBuffer.toString('base64');
                    }
                } catch {
                    // Element screenshot failed, continue without it
                }

                nodes.push({
                    selector,
                    html: node.html,
                    failureSummary: node.failureSummary ?? '',
                    screenshot: elementScreenshot,
                });
            }

            const violationData: Violation = {
                id: violation.id,
                impact: violation.impact ?? 'moderate',
                description: violation.description,
                help: violation.help,
                helpUrl: violation.helpUrl,
                nodes,
            };

            // Generate recommendation
            violationData.recommendation = generateRecommendation({
                id: violation.id,
                impact: violationData.impact,
                help: violation.help,
                nodes: nodes.map(n => ({ html: n.html, selector: n.selector })),
            });

            violations.push(violationData);
        }

        // Sort by impact severity
        const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        violations.sort((a, b) => (impactOrder[a.impact as keyof typeof impactOrder] ?? 4) - (impactOrder[b.impact as keyof typeof impactOrder] ?? 4));

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
            pageScreenshot,
            message: `Scan completed. Found ${violationCounts.total} violations.`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Scan failed:', errorMessage);

        // Convert to user-friendly error
        const friendlyError = getUserFriendlyError(errorMessage, url);

        return {
            success: false,
            url,
            viewport,
            violations: [],
            violationCounts: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 },
            message: friendlyError.message,
            errorCode: friendlyError.code,
            errorDetails: friendlyError.details,
        };
    } finally {
        if (page) await page.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

/**
 * Handle VerifyFix action - Verify a fix was applied correctly
 */
async function handleVerifyFix(params: Record<string, string>): Promise<unknown> {
    const { url, selector, ruleId } = params;

    if (!url || !selector || !ruleId) {
        return { success: false, error: 'URL, selector, and ruleId are required' };
    }

    console.log('Verifying fix:', { url, selector, ruleId });

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await connectBrowser();
        const context = await browser.newContext();
        page = await context.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Run axe-core analysis scoped to the specific element and rule
        const axeResults = await new AxeBuilder({ page })
            .include(selector)
            .withRules([ruleId])
            .analyze();

        const isFixed = axeResults.violations.length === 0;

        return {
            success: true,
            verified: isFixed,
            selector,
            ruleId,
            violations: axeResults.violations,
            message: isFixed ? 'Fix verified successfully' : 'Violation still present',
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Verification failed:', errorMessage);

        return {
            success: false,
            verified: false,
            selector,
            ruleId,
            message: `Verification failed: ${errorMessage}`,
        };
    } finally {
        if (page) await page.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

/**
 * Handle GetPageStructure action - Get DOM structure for element location
 */
async function handleGetPageStructure(params: Record<string, string>): Promise<unknown> {
    const { url } = params;

    if (!url) {
        return { success: false, error: 'URL is required' };
    }

    console.log('Getting page structure:', { url });

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await connectBrowser();
        const context = await browser.newContext();
        page = await context.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Extract page structure
        const structure = await page.evaluate(() => {
            const getSelector = (el: Element): string => {
                if (el.id) return `#${el.id}`;
                if (el.className && typeof el.className === 'string') {
                    return `${el.tagName.toLowerCase()}.${el.className.split(' ').join('.')}`;
                }
                return el.tagName.toLowerCase();
            };

            return {
                title: document.title,
                headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                    selector: getSelector(h),
                    tagName: h.tagName.toLowerCase(),
                    text: h.textContent?.trim().substring(0, 100) ?? '',
                })),
                landmarks: Array.from(document.querySelectorAll('[role], main, nav, header, footer, aside')).map(l => ({
                    selector: getSelector(l),
                    tagName: l.tagName.toLowerCase(),
                    role: l.getAttribute('role') ?? l.tagName.toLowerCase(),
                })),
                interactiveElements: Array.from(document.querySelectorAll('a, button, input, select, textarea')).slice(0, 50).map(el => ({
                    selector: getSelector(el),
                    tagName: el.tagName.toLowerCase(),
                    text: el.textContent?.trim().substring(0, 50) ?? '',
                })),
                images: Array.from(document.querySelectorAll('img')).map(img => ({
                    selector: getSelector(img),
                    alt: img.getAttribute('alt') ?? '',
                    src: img.getAttribute('src')?.substring(0, 100) ?? '',
                })),
            };
        });

        return {
            success: true,
            url,
            structure,
            message: 'Structure retrieved successfully',
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Structure retrieval failed:', errorMessage);

        return {
            success: false,
            url,
            structure: null,
            message: `Structure retrieval failed: ${errorMessage}`,
        };
    } finally {
        if (page) await page.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

/**
 * Main Lambda handler - Routes Bedrock Action Group requests
 */
export async function handler(
    event: BedrockApiEvent | APIGatewayProxyEvent
): Promise<ApiActionResponse | APIGatewayProxyResult> {
    console.log('Auditor handler invoked:', JSON.stringify(event, null, 2));

    // Handle Bedrock Action Group invocation
    if ('actionGroup' in event && event.actionGroup) {
        const { actionGroup, apiPath, httpMethod } = event;

        // Extract parameters from requestBody or parameters
        let params: Record<string, string> = {};
        if (event.requestBody?.content?.['application/json']?.properties) {
            params = parseParameters(event.requestBody.content['application/json'].properties);
        } else if (event.parameters) {
            params = parseParameters(event.parameters);
        }

        let result: unknown;

        // Route based on apiPath
        switch (apiPath) {
            case '/scan':
                result = await handleScanUrl(params);
                break;
            case '/verify':
                result = await handleVerifyFix(params);
                break;
            case '/structure':
                result = await handleGetPageStructure(params);
                break;
            default:
                result = { success: false, error: `Unknown API path: ${apiPath}` };
        }

        return createApiResponse(actionGroup, apiPath, httpMethod, result);
    }

    // Handle direct API invocation (for testing)
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Auditor Lambda ready' }),
    };
}
