/**
 * Lambda Handler for Bedrock Action Group
 * 
 * Entry point for Amazon Bedrock Action Group invocations.
 * Routes requests to Scanner, Verifier, or StructureAnalyzer services.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import type { ScanResult, VerifyResult, PageStructure, Viewport, AuditorError } from './types/index.js';
import { ViewportSchema, VerifyOptionsSchema } from './types/index.js';
import { ScannerService } from './services/scanner.js';
import { VerifierService } from './services/verifier.js';
import { StructureAnalyzerService } from './services/structure-analyzer.js';
import { createBrowserProvider, type BrowserProviderConfig } from './providers/browser-provider.js';
import { AuditorErrorClass, wrapError } from './utils/errors.js';

// ============================================================================
// Bedrock Action Group Types
// ============================================================================

/**
 * Bedrock Action Group request structure
 */
export interface ActionGroupRequest {
    actionGroup: string;
    function: 'ScanURL' | 'VerifyElement' | 'GetPageStructure';
    parameters: ActionGroupParameter[];
}

/**
 * Parameter structure in Action Group request
 */
export interface ActionGroupParameter {
    name: string;
    type: string;
    value: string;
}

/**
 * Bedrock Action Group response structure
 * 
 * Requirement 9.4: Responses must conform to Bedrock Agent response schema
 */
export interface ActionGroupResponse {
    messageVersion: '1.0';
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

/**
 * Lambda event structure for Bedrock Action Group
 */
export interface LambdaEvent {
    actionGroup: string;
    function: string;
    parameters?: ActionGroupParameter[];
    messageVersion?: string;
}

/**
 * Lambda context (simplified)
 */
export interface LambdaContext {
    functionName: string;
    functionVersion: string;
    invokedFunctionArn: string;
    memoryLimitInMB: string;
    awsRequestId: string;
    logGroupName: string;
    logStreamName: string;
    getRemainingTimeInMillis: () => number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Success response body for ScanURL action
 */
export interface ScanURLResponseBody {
    success: true;
    data: ScanResult;
}

/**
 * Success response body for VerifyElement action
 */
export interface VerifyElementResponseBody {
    success: true;
    data: VerifyResult;
}

/**
 * Success response body for GetPageStructure action
 */
export interface GetPageStructureResponseBody {
    success: true;
    data: PageStructure;
}

/**
 * Error response body
 */
export interface ErrorResponseBody {
    success: false;
    error: AuditorError;
}

// ============================================================================
// Parameter Extraction
// ============================================================================

/**
 * Extracts a parameter value from the parameters array
 */
function getParameter(parameters: ActionGroupParameter[], name: string): string | undefined {
    const param = parameters.find(p => p.name === name);
    return param?.value;
}

/**
 * Extracts and validates ScanURL parameters
 */
function extractScanURLParams(parameters: ActionGroupParameter[]): { url: string; viewport: Viewport; page: number } {
    const url = getParameter(parameters, 'url');
    if (!url) {
        throw new AuditorErrorClass('URL_UNREACHABLE', 'Missing required parameter: url');
    }

    const viewportParam = getParameter(parameters, 'viewport') ?? 'desktop';
    const viewportResult = ViewportSchema.safeParse(viewportParam);
    const viewport: Viewport = viewportResult.success ? viewportResult.data : 'desktop';

    const pageParam = getParameter(parameters, 'page');
    const page = pageParam ? parseInt(pageParam, 10) : 1;

    return { url, viewport, page: isNaN(page) ? 1 : page };
}

/**
 * Extracts and validates VerifyElement parameters
 */
function extractVerifyElementParams(parameters: ActionGroupParameter[]): { url: string; selector: string; ruleId: string } {
    const url = getParameter(parameters, 'url');
    if (!url) {
        throw new AuditorErrorClass('URL_UNREACHABLE', 'Missing required parameter: url');
    }

    const selector = getParameter(parameters, 'selector');
    const ruleId = getParameter(parameters, 'ruleId');

    const verifyResult = VerifyOptionsSchema.safeParse({ selector, ruleId });
    if (!verifyResult.success) {
        throw new AuditorErrorClass(
            'ELEMENT_NOT_FOUND',
            `Invalid parameters: ${verifyResult.error.message}`,
            { selector, ruleId }
        );
    }

    return { url, selector: verifyResult.data.selector, ruleId: verifyResult.data.ruleId };
}

/**
 * Extracts and validates GetPageStructure parameters
 */
function extractGetPageStructureParams(parameters: ActionGroupParameter[]): { url: string; viewport: Viewport } {
    const url = getParameter(parameters, 'url');
    if (!url) {
        throw new AuditorErrorClass('URL_UNREACHABLE', 'Missing required parameter: url');
    }

    const viewportParam = getParameter(parameters, 'viewport') ?? 'desktop';
    const viewportResult = ViewportSchema.safeParse(viewportParam);
    const viewport: Viewport = viewportResult.success ? viewportResult.data : 'desktop';

    return { url, viewport };
}

// ============================================================================
// Response Builders
// ============================================================================

/**
 * Creates a successful Action Group response
 */
export function createSuccessResponse(
    actionGroup: string,
    functionName: string,
    data: ScanResult | VerifyResult | PageStructure
): ActionGroupResponse {
    const responseBody: ScanURLResponseBody | VerifyElementResponseBody | GetPageStructureResponseBody = {
        success: true,
        data
    };

    return {
        messageVersion: '1.0',
        response: {
            actionGroup,
            function: functionName,
            functionResponse: {
                responseBody: {
                    TEXT: {
                        body: JSON.stringify(responseBody)
                    }
                }
            }
        }
    };
}

/**
 * Creates an error Action Group response
 */
export function createErrorResponse(
    actionGroup: string,
    functionName: string,
    error: AuditorError
): ActionGroupResponse {
    const responseBody: ErrorResponseBody = {
        success: false,
        error
    };

    return {
        messageVersion: '1.0',
        response: {
            actionGroup,
            function: functionName,
            functionResponse: {
                responseBody: {
                    TEXT: {
                        body: JSON.stringify(responseBody)
                    }
                }
            }
        }
    };
}

// ============================================================================
// Handler Configuration
// ============================================================================

/**
 * Handler configuration options
 */
export interface HandlerConfig {
    browserProvider?: BrowserProviderConfig;
}

/**
 * Gets browser provider configuration from environment or defaults
 */
function getBrowserProviderConfig(): BrowserProviderConfig {
    const mode = process.env.BROWSER_MODE === 'browserless' ? 'browserless' : 'local';

    if (mode === 'browserless') {
        return {
            mode: 'browserless',
            browserlessEndpoint: process.env.BROWSERLESS_ENDPOINT,
            browserlessApiKey: process.env.BROWSERLESS_API_KEY
        };
    }

    return { mode: 'local' };
}

// ============================================================================
// Lambda Handler
// ============================================================================

/**
 * Lambda handler for Bedrock Action Group invocations
 * 
 * Routes requests to the appropriate service based on the function name:
 * - ScanURL: Scans a URL for accessibility violations (Requirement 9.1)
 * - VerifyElement: Verifies a specific element (Requirement 9.2)
 * - GetPageStructure: Returns page structure for selector matching (Requirement 9.3)
 * 
 * @param event - Lambda event from Bedrock Action Group
 * @param _context - Lambda context (unused)
 * @returns ActionGroupResponse conforming to Bedrock schema (Requirement 9.4)
 */
export async function handler(
    event: LambdaEvent,
    _context?: LambdaContext
): Promise<ActionGroupResponse> {
    const actionGroup = event.actionGroup ?? 'AuditorActionGroup';
    const functionName = event.function;
    const parameters = event.parameters ?? [];

    try {
        // Get browser provider configuration
        const browserConfig = getBrowserProviderConfig();
        const browserProvider = createBrowserProvider(browserConfig);

        // Connect to browser
        await browserProvider.connect();

        try {
            // Route to appropriate service
            switch (functionName) {
                case 'ScanURL': {
                    const { url, viewport, page } = extractScanURLParams(parameters);
                    const scanner = new ScannerService(browserProvider);
                    const result = await scanner.scan({ url, viewport, page });
                    return createSuccessResponse(actionGroup, functionName, result);
                }

                case 'VerifyElement': {
                    const { url, selector, ruleId } = extractVerifyElementParams(parameters);
                    const verifier = new VerifierService(browserProvider);

                    // Create context and page for verification
                    const context = await browserProvider.createContext('desktop');
                    const page = await browserProvider.createPage(context);

                    try {
                        // Navigate to URL first
                        await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });

                        // Verify the element
                        const result = await verifier.verifyOnPage(page, { selector, ruleId });
                        return createSuccessResponse(actionGroup, functionName, result);
                    } finally {
                        await page.close().catch(() => { /* ignore */ });
                        await context.close().catch(() => { /* ignore */ });
                    }
                }

                case 'GetPageStructure': {
                    const { url, viewport } = extractGetPageStructureParams(parameters);
                    const analyzer = new StructureAnalyzerService(browserProvider);

                    // Create context and page for analysis
                    const context = await browserProvider.createContext(viewport);
                    const page = await browserProvider.createPage(context);

                    try {
                        // Navigate to URL first
                        await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });

                        // Analyze page structure
                        const result = await analyzer.analyzeOnPage(page);
                        return createSuccessResponse(actionGroup, functionName, result);
                    } finally {
                        await page.close().catch(() => { /* ignore */ });
                        await context.close().catch(() => { /* ignore */ });
                    }
                }

                default: {
                    const error = new AuditorErrorClass(
                        'BROWSER_LAUNCH_FAILED',
                        `Unknown function: ${functionName}`,
                        { function: functionName }
                    );
                    return createErrorResponse(actionGroup, functionName, error.toJSON());
                }
            }
        } finally {
            // Always disconnect browser
            await browserProvider.disconnect().catch(() => { /* ignore */ });
        }
    } catch (error) {
        // Wrap error and return structured response
        const auditorError = wrapError(error);
        return createErrorResponse(actionGroup, functionName, auditorError.toJSON());
    }
}

/**
 * Creates a handler with custom configuration
 * 
 * Useful for testing or custom deployments
 */
export function createHandler(config: HandlerConfig) {
    return async (event: LambdaEvent, context?: LambdaContext): Promise<ActionGroupResponse> => {
        // Override environment-based config with provided config
        if (config.browserProvider) {
            process.env.BROWSER_MODE = config.browserProvider.mode;
            if (config.browserProvider.browserlessEndpoint) {
                process.env.BROWSERLESS_ENDPOINT = config.browserProvider.browserlessEndpoint;
            }
            if (config.browserProvider.browserlessApiKey) {
                process.env.BROWSERLESS_API_KEY = config.browserProvider.browserlessApiKey;
            }
        }

        return handler(event, context);
    };
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates that a response conforms to the ActionGroupResponse schema
 */
export function isValidActionGroupResponse(response: unknown): response is ActionGroupResponse {
    if (typeof response !== 'object' || response === null) {
        return false;
    }

    const r = response as Record<string, unknown>;

    // Check messageVersion
    if (r.messageVersion !== '1.0') {
        return false;
    }

    // Check response structure
    if (typeof r.response !== 'object' || r.response === null) {
        return false;
    }

    const resp = r.response as Record<string, unknown>;

    // Check required fields
    if (typeof resp.actionGroup !== 'string') {
        return false;
    }

    if (typeof resp.function !== 'string') {
        return false;
    }

    // Check functionResponse structure
    if (typeof resp.functionResponse !== 'object' || resp.functionResponse === null) {
        return false;
    }

    const funcResp = resp.functionResponse as Record<string, unknown>;

    // Check responseBody structure
    if (typeof funcResp.responseBody !== 'object' || funcResp.responseBody === null) {
        return false;
    }

    const respBody = funcResp.responseBody as Record<string, unknown>;

    // Check TEXT structure
    if (typeof respBody.TEXT !== 'object' || respBody.TEXT === null) {
        return false;
    }

    const text = respBody.TEXT as Record<string, unknown>;

    // Check body is a string
    if (typeof text.body !== 'string') {
        return false;
    }

    // Verify body is valid JSON
    try {
        JSON.parse(text.body);
        return true;
    } catch {
        return false;
    }
}
