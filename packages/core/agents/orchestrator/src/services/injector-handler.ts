/**
 * Injector Lambda Handler for Bedrock Action Group
 * 
 * Entry point for Amazon Bedrock Action Group invocations.
 * Routes requests to ApplyAttributeFix, ApplyContentFix, InjectStyle actions.
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import type { Page, ElementHandle } from 'playwright';
import type {
    AttributeFixParams,
    ContentFixParams,
    StyleFixParams,
    FixResult,
    InjectorError,
    InjectorErrorCode
} from '../types/index.js';
import {
    AttributeFixParamsSchema,
    ContentFixParamsSchema,
    StyleFixParamsSchema
} from '../types/index.js';

// ============================================================================
// Bedrock Action Group Types
// ============================================================================

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
    function: 'ApplyAttributeFix' | 'ApplyContentFix' | 'InjectStyle';
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
 * Success response body
 */
export interface SuccessResponseBody {
    success: true;
    data: FixResult;
}

/**
 * Error response body
 */
export interface ErrorResponseBody {
    success: false;
    error: InjectorError;
}

// ============================================================================
// Injector Error Class
// ============================================================================

export class InjectorErrorClass extends Error {
    public readonly code: InjectorErrorCode;
    public readonly selector: string;
    public readonly details: Record<string, unknown> | undefined;

    constructor(
        code: InjectorErrorCode,
        message: string,
        selector: string,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'InjectorError';
        this.code = code;
        this.selector = selector;
        this.details = details;
    }

    toJSON(): InjectorError {
        const result: InjectorError = {
            code: this.code,
            message: this.message,
            selector: this.selector
        };
        if (this.details !== undefined) {
            result.details = this.details;
        }
        return result;
    }
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
 * Extracts and validates ApplyAttributeFix parameters
 */
export function extractAttributeFixParams(parameters: ActionGroupParameter[]): AttributeFixParams {
    const selector = getParameter(parameters, 'selector');
    const attribute = getParameter(parameters, 'attribute');
    const value = getParameter(parameters, 'value') ?? '';
    const reasoning = getParameter(parameters, 'reasoning');

    const result = AttributeFixParamsSchema.safeParse({
        selector,
        attribute,
        value,
        reasoning
    });

    if (!result.success) {
        throw new InjectorErrorClass(
            'VALIDATION_FAILED',
            `Invalid parameters: ${result.error.message}`,
            selector ?? '',
            { validationErrors: result.error.errors }
        );
    }

    return result.data;
}

/**
 * Extracts and validates ApplyContentFix parameters
 */
export function extractContentFixParams(parameters: ActionGroupParameter[]): ContentFixParams {
    const selector = getParameter(parameters, 'selector');
    const innerText = getParameter(parameters, 'innerText') ?? '';
    const originalTextHash = getParameter(parameters, 'originalTextHash');

    const result = ContentFixParamsSchema.safeParse({
        selector,
        innerText,
        originalTextHash
    });

    if (!result.success) {
        throw new InjectorErrorClass(
            'VALIDATION_FAILED',
            `Invalid parameters: ${result.error.message}`,
            selector ?? '',
            { validationErrors: result.error.errors }
        );
    }

    return result.data;
}

/**
 * Extracts and validates InjectStyle parameters
 */
export function extractStyleFixParams(parameters: ActionGroupParameter[]): StyleFixParams {
    const selector = getParameter(parameters, 'selector');
    const cssClass = getParameter(parameters, 'cssClass') ?? '';
    const stylesParam = getParameter(parameters, 'styles');

    let styles: Record<string, string> = {};
    if (stylesParam) {
        try {
            styles = JSON.parse(stylesParam) as Record<string, string>;
        } catch {
            throw new InjectorErrorClass(
                'VALIDATION_FAILED',
                'Invalid styles parameter: must be valid JSON',
                selector ?? '',
                { stylesParam }
            );
        }
    }

    const result = StyleFixParamsSchema.safeParse({
        selector,
        cssClass,
        styles
    });

    if (!result.success) {
        throw new InjectorErrorClass(
            'VALIDATION_FAILED',
            `Invalid parameters: ${result.error.message}`,
            selector ?? '',
            { validationErrors: result.error.errors }
        );
    }

    return result.data;
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
    data: FixResult
): ActionGroupResponse {
    const responseBody: SuccessResponseBody = {
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
    error: InjectorError
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
// Hash Utilities
// ============================================================================

/**
 * Computes SHA-256 hash of a string
 */
export async function computeSHA256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// DOM Manipulation Actions
// ============================================================================

/**
 * Gets the outer HTML of an element
 */
async function getOuterHtml(element: ElementHandle<Element>): Promise<string> {
    return element.evaluate((el: Element) => el.outerHTML);
}

/**
 * Applies an attribute fix to an element
 * Requirements: 2.1
 */
export async function applyAttributeFix(
    page: Page,
    params: AttributeFixParams
): Promise<FixResult> {
    const { selector, attribute, value } = params;

    // Check if element exists
    const element = await page.$(selector);
    if (!element) {
        throw new InjectorErrorClass(
            'SELECTOR_NOT_FOUND',
            `Element not found: ${selector}`,
            selector
        );
    }

    // Get before HTML
    const beforeHtml = await getOuterHtml(element);

    // Apply attribute modification
    await element.evaluate(
        (el: Element, args: { attr: string; val: string }) => {
            el.setAttribute(args.attr, args.val);
        },
        { attr: attribute, val: value }
    );

    // Get after HTML
    const afterHtml = await getOuterHtml(element);

    return {
        success: true,
        selector,
        beforeHtml,
        afterHtml
    };
}

/**
 * Applies a content fix to an element with hash validation
 * Requirements: 2.2, 2.4
 */
export async function applyContentFix(
    page: Page,
    params: ContentFixParams
): Promise<FixResult> {
    const { selector, innerText, originalTextHash } = params;

    // Check if element exists
    const element = await page.$(selector);
    if (!element) {
        throw new InjectorErrorClass(
            'SELECTOR_NOT_FOUND',
            `Element not found: ${selector}`,
            selector
        );
    }

    // Get current innerText and compute hash
    const currentText = await element.evaluate((el: Element) => (el as HTMLElement).innerText);
    const currentHash = await computeSHA256(currentText);

    // Validate hash matches
    if (currentHash !== originalTextHash) {
        throw new InjectorErrorClass(
            'CONTENT_CHANGED',
            `Content has changed since audit. Expected hash: ${originalTextHash}, got: ${currentHash}`,
            selector,
            { expectedHash: originalTextHash, actualHash: currentHash }
        );
    }

    // Get before HTML
    const beforeHtml = await getOuterHtml(element);

    // Apply content modification
    await element.evaluate(
        (el: Element, text: string) => {
            (el as HTMLElement).innerText = text;
        },
        innerText
    );

    // Get after HTML
    const afterHtml = await getOuterHtml(element);

    return {
        success: true,
        selector,
        beforeHtml,
        afterHtml
    };
}

/**
 * Injects styles to an element
 * Requirements: 2.3
 */
export async function injectStyle(
    page: Page,
    params: StyleFixParams
): Promise<FixResult> {
    const { selector, cssClass, styles } = params;

    // Check if element exists
    const element = await page.$(selector);
    if (!element) {
        throw new InjectorErrorClass(
            'SELECTOR_NOT_FOUND',
            `Element not found: ${selector}`,
            selector
        );
    }

    // Get before HTML
    const beforeHtml = await getOuterHtml(element);

    // Add CSS class if provided
    if (cssClass) {
        await element.evaluate(
            (el: Element, cls: string) => {
                el.classList.add(cls);
            },
            cssClass
        );
    }

    // Apply inline styles if provided
    if (Object.keys(styles).length > 0) {
        await element.evaluate(
            (el: Element, styleObj: Record<string, string>) => {
                for (const [prop, val] of Object.entries(styleObj)) {
                    (el as HTMLElement).style.setProperty(prop, val);
                }
            },
            styles
        );
    }

    // Get after HTML
    const afterHtml = await getOuterHtml(element);

    return {
        success: true,
        selector,
        beforeHtml,
        afterHtml
    };
}

// ============================================================================
// Injector Handler
// ============================================================================

/**
 * Handler configuration
 */
export interface InjectorHandlerConfig {
    page: Page;
}

/**
 * Creates an injector handler with the given page
 * 
 * Routes requests to the appropriate action based on the function name:
 * - ApplyAttributeFix: Applies attribute modifications (Requirement 2.1)
 * - ApplyContentFix: Applies content modifications with hash validation (Requirement 2.2, 2.4)
 * - InjectStyle: Applies style modifications (Requirement 2.3)
 */
export function createInjectorHandler(config: InjectorHandlerConfig) {
    const { page } = config;

    return async function handler(
        event: LambdaEvent,
        _context?: LambdaContext
    ): Promise<ActionGroupResponse> {
        const actionGroup = event.actionGroup ?? 'InjectorActionGroup';
        const functionName = event.function;
        const parameters = event.parameters ?? [];

        try {
            switch (functionName) {
                case 'ApplyAttributeFix': {
                    const params = extractAttributeFixParams(parameters);
                    const result = await applyAttributeFix(page, params);
                    return createSuccessResponse(actionGroup, functionName, result);
                }

                case 'ApplyContentFix': {
                    const params = extractContentFixParams(parameters);
                    const result = await applyContentFix(page, params);
                    return createSuccessResponse(actionGroup, functionName, result);
                }

                case 'InjectStyle': {
                    const params = extractStyleFixParams(parameters);
                    const result = await injectStyle(page, params);
                    return createSuccessResponse(actionGroup, functionName, result);
                }

                default: {
                    const error: InjectorError = {
                        code: 'VALIDATION_FAILED',
                        message: `Unknown function: ${functionName}`,
                        selector: ''
                    };
                    return createErrorResponse(actionGroup, functionName, error);
                }
            }
        } catch (error) {
            if (error instanceof InjectorErrorClass) {
                return createErrorResponse(actionGroup, functionName, error.toJSON());
            }

            // Wrap unknown errors
            const injectorError: InjectorError = {
                code: 'VALIDATION_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
                selector: ''
            };
            return createErrorResponse(actionGroup, functionName, injectorError);
        }
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

    if (r.messageVersion !== '1.0') {
        return false;
    }

    if (typeof r.response !== 'object' || r.response === null) {
        return false;
    }

    const resp = r.response as Record<string, unknown>;

    if (typeof resp.actionGroup !== 'string') {
        return false;
    }

    if (typeof resp.function !== 'string') {
        return false;
    }

    if (typeof resp.functionResponse !== 'object' || resp.functionResponse === null) {
        return false;
    }

    const funcResp = resp.functionResponse as Record<string, unknown>;

    if (typeof funcResp.responseBody !== 'object' || funcResp.responseBody === null) {
        return false;
    }

    const respBody = funcResp.responseBody as Record<string, unknown>;

    if (typeof respBody.TEXT !== 'object' || respBody.TEXT === null) {
        return false;
    }

    const text = respBody.TEXT as Record<string, unknown>;

    if (typeof text.body !== 'string') {
        return false;
    }

    try {
        JSON.parse(text.body);
        return true;
    } catch {
        return false;
    }
}
