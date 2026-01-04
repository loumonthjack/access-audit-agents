/**
 * Injector Lambda Handler
 * 
 * Bedrock Action Group handler for applying accessibility fixes.
 * Modifies DOM elements via Playwright/Browserless to fix WCAG violations.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { chromium, type Browser, type Page } from 'playwright-core';

// Function-based invocation event
interface BedrockFunctionEvent {
    messageVersion: string;
    agent: {
        name: string;
        id: string;
        alias: string;
        version: string;
    };
    sessionId: string;
    actionGroup: string;
    function: string;
    parameters: Array<{ name: string; type: string; value: string }>;
}

// OpenAPI-based invocation event
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

type BedrockActionEvent = BedrockFunctionEvent | BedrockApiEvent;

// Response for function-based schema
interface FunctionActionResponse {
    messageVersion: string;
    response: {
        actionGroup: string;
        function: string;
        functionResponse: {
            responseBody: {
                TEXT: {
                    body: string;
                };
            };
        };
    };
}

// Response for OpenAPI-based schema
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

type ActionResponse = FunctionActionResponse | ApiActionResponse;

interface FixResult {
    success: boolean;
    selector: string;
    beforeHtml: string;
    afterHtml: string;
    message: string;
    error?: string;
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
 * Connect to Browserless or local browser
 */
async function connectBrowser(): Promise<Browser> {
    const browserlessEndpoint = process.env.BROWSERLESS_ENDPOINT;
    const browserlessApiKey = process.env.BROWSERLESS_API_KEY;

    if (browserlessEndpoint && browserlessApiKey) {
        const wsEndpoint = `${browserlessEndpoint}?token=${browserlessApiKey}`;
        console.log('Connecting to Browserless via CDP:', browserlessEndpoint);
        // Use connectOverCDP for Browserless (Chrome DevTools Protocol)
        return chromium.connectOverCDP(wsEndpoint);
    }

    console.log('Using local Chromium browser');
    return chromium.launch({ headless: true });
}

/**
 * Navigate to URL and get page reference
 */
async function navigateToUrl(url: string): Promise<{ browser: Browser; page: Page }> {
    const browser = await connectBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return { browser, page };
}

/**
 * Create function-based action group response
 */
function createFunctionResponse(
    actionGroup: string,
    functionName: string,
    body: unknown
): FunctionActionResponse {
    return {
        messageVersion: '1.0',
        response: {
            actionGroup,
            function: functionName,
            functionResponse: {
                responseBody: {
                    TEXT: {
                        body: JSON.stringify(body),
                    },
                },
            },
        },
    };
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
 * Handle ApplyAttributeFix action - Add/modify HTML attributes
 */
async function handleApplyAttributeFix(params: Record<string, string>): Promise<FixResult> {
    const { selector, attribute, value, url } = params;

    if (!selector || !attribute) {
        return {
            success: false,
            selector: selector ?? '',
            beforeHtml: '',
            afterHtml: '',
            message: 'Selector and attribute are required',
            error: 'VALIDATION_FAILED',
        };
    }

    if (!url) {
        return {
            success: false,
            selector,
            beforeHtml: '',
            afterHtml: '',
            message: 'URL is required for DOM modification',
            error: 'URL_REQUIRED',
        };
    }

    console.log('Applying attribute fix:', { selector, attribute, value, url });

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        const result = await navigateToUrl(url);
        browser = result.browser;
        page = result.page;

        // Get element and capture before state
        const element = await page.locator(selector).first();
        const beforeHtml = await element.evaluate((el) => el.outerHTML);

        // Apply the attribute fix
        await element.evaluate(
            (el, { attr, val }) => {
                el.setAttribute(attr, val);
            },
            { attr: attribute, val: value ?? '' }
        );

        // Capture after state
        const afterHtml = await element.evaluate((el) => el.outerHTML);

        console.log('Attribute fix applied successfully');

        return {
            success: true,
            selector,
            beforeHtml,
            afterHtml,
            message: `Applied ${attribute}="${value}" to ${selector}`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Attribute fix failed:', errorMessage);

        return {
            success: false,
            selector,
            beforeHtml: '',
            afterHtml: '',
            message: `Failed to apply attribute fix: ${errorMessage}`,
            error: 'SELECTOR_NOT_FOUND',
        };
    } finally {
        if (page) await page.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

/**
 * Handle ApplyContentFix action - Modify text content
 */
async function handleApplyContentFix(params: Record<string, string>): Promise<FixResult> {
    const { selector, innerText, originalTextHash, url } = params;

    if (!selector || !innerText) {
        return {
            success: false,
            selector: selector ?? '',
            beforeHtml: '',
            afterHtml: '',
            message: 'Selector and innerText are required',
            error: 'VALIDATION_FAILED',
        };
    }

    if (!url) {
        return {
            success: false,
            selector,
            beforeHtml: '',
            afterHtml: '',
            message: 'URL is required for DOM modification',
            error: 'URL_REQUIRED',
        };
    }

    console.log('Applying content fix:', { selector, innerText, url });

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        const result = await navigateToUrl(url);
        browser = result.browser;
        page = result.page;

        const element = await page.locator(selector).first();
        const beforeHtml = await element.evaluate((el) => el.outerHTML);

        // Optional: Validate content hash to prevent stale fixes
        if (originalTextHash) {
            const currentText = await element.evaluate((el) => el.textContent ?? '');
            // Simple hash check (in production, use proper hashing)
            const currentHash = Buffer.from(currentText).toString('base64');
            if (currentHash !== originalTextHash) {
                return {
                    success: false,
                    selector,
                    beforeHtml,
                    afterHtml: '',
                    message: 'Content has changed since fix was planned',
                    error: 'CONTENT_CHANGED',
                };
            }
        }

        // Apply the content fix
        await element.evaluate((el, newText) => {
            el.textContent = newText;
        }, innerText);

        const afterHtml = await element.evaluate((el) => el.outerHTML);

        console.log('Content fix applied successfully');

        return {
            success: true,
            selector,
            beforeHtml,
            afterHtml,
            message: `Updated content of ${selector}`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Content fix failed:', errorMessage);

        return {
            success: false,
            selector,
            beforeHtml: '',
            afterHtml: '',
            message: `Failed to apply content fix: ${errorMessage}`,
            error: 'SELECTOR_NOT_FOUND',
        };
    } finally {
        if (page) await page.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

/**
 * Handle InjectStyle action - Add CSS styles
 */
async function handleInjectStyle(params: Record<string, string>): Promise<FixResult> {
    const { selector, cssClass, styles, url } = params;

    if (!selector) {
        return {
            success: false,
            selector: '',
            beforeHtml: '',
            afterHtml: '',
            message: 'Selector is required',
            error: 'VALIDATION_FAILED',
        };
    }

    if (!cssClass && !styles) {
        return {
            success: false,
            selector,
            beforeHtml: '',
            afterHtml: '',
            message: 'Either cssClass or styles is required',
            error: 'VALIDATION_FAILED',
        };
    }

    if (!url) {
        return {
            success: false,
            selector,
            beforeHtml: '',
            afterHtml: '',
            message: 'URL is required for DOM modification',
            error: 'URL_REQUIRED',
        };
    }

    console.log('Injecting styles:', { selector, cssClass, styles, url });

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        const result = await navigateToUrl(url);
        browser = result.browser;
        page = result.page;

        const element = await page.locator(selector).first();
        const beforeHtml = await element.evaluate((el) => el.outerHTML);

        // Parse styles if provided as JSON string
        let styleObject: Record<string, string> = {};
        if (styles) {
            try {
                styleObject = typeof styles === 'string' ? JSON.parse(styles) : styles;
            } catch {
                styleObject = {};
            }
        }

        // Apply CSS class if provided
        if (cssClass) {
            await element.evaluate((el, cls) => {
                el.classList.add(cls);
            }, cssClass);
        }

        // Apply inline styles if provided
        if (Object.keys(styleObject).length > 0) {
            await element.evaluate((el, stylesMap) => {
                for (const [property, value] of Object.entries(stylesMap)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (el as any).style.setProperty(property, value);
                }
            }, styleObject);
        }

        const afterHtml = await element.evaluate((el) => el.outerHTML);

        console.log('Style injection applied successfully');

        return {
            success: true,
            selector,
            beforeHtml,
            afterHtml,
            message: `Applied styles to ${selector}`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Style injection failed:', errorMessage);

        return {
            success: false,
            selector,
            beforeHtml: '',
            afterHtml: '',
            message: `Failed to inject styles: ${errorMessage}`,
            error: 'SELECTOR_NOT_FOUND',
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
    event: BedrockActionEvent | APIGatewayProxyEvent
): Promise<ActionResponse | APIGatewayProxyResult> {
    console.log('Injector handler invoked:', JSON.stringify(event, null, 2));

    // Handle Bedrock Action Group invocation
    if ('actionGroup' in event && event.actionGroup) {
        const { actionGroup } = event;

        // Check if this is an OpenAPI-based invocation (has apiPath)
        if ('apiPath' in event && event.apiPath) {
            const { apiPath, httpMethod } = event;

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
                case '/apply-attribute':
                    result = await handleApplyAttributeFix(params);
                    break;
                case '/apply-content':
                    result = await handleApplyContentFix(params);
                    break;
                case '/inject-style':
                    result = await handleInjectStyle(params);
                    break;
                default:
                    result = { success: false, error: `Unknown API path: ${apiPath}` };
            }

            return createApiResponse(actionGroup, apiPath, httpMethod, result);
        }

        // Handle function-based invocation (has function field)
        if ('function' in event && event.function) {
            const { function: functionName, parameters } = event;
            const params = parseParameters(parameters);

            let result: unknown;

            switch (functionName) {
                case 'ApplyAttributeFix':
                    result = await handleApplyAttributeFix(params);
                    break;
                case 'ApplyContentFix':
                    result = await handleApplyContentFix(params);
                    break;
                case 'InjectStyle':
                    result = await handleInjectStyle(params);
                    break;
                default:
                    result = { success: false, error: `Unknown function: ${functionName}` };
            }

            return createFunctionResponse(actionGroup, functionName, result);
        }
    }

    // Handle direct API invocation (for testing)
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Injector Lambda ready' }),
    };
}
