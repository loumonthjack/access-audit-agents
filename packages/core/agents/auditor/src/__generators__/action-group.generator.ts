/**
 * fast-check arbitraries for Action Group types
 * 
 * Feature: core-auditor-agent
 * Property 7: Bedrock Response Schema Conformance
 */

import * as fc from 'fast-check';
import type {
    ActionGroupRequest,
    ActionGroupResponse,
    ActionGroupParameter,
    LambdaEvent,
    ScanURLResponseBody,
    VerifyElementResponseBody,
    GetPageStructureResponseBody,
    ErrorResponseBody
} from '../handler.js';
import { scanResultArb, viewportArb, urlArb } from './scan-result.generator.js';
import { auditorErrorDataArb } from './error.generator.js';
import type { VerifyResult, PageStructure, ElementSummary } from '../types/index.js';

/**
 * All valid function names for the Action Group
 */
export const VALID_FUNCTIONS = ['ScanURL', 'VerifyElement', 'GetPageStructure'] as const;
export type ValidFunction = typeof VALID_FUNCTIONS[number];

/**
 * Generates a valid function name
 */
export const functionNameArb: fc.Arbitrary<ValidFunction> = fc.constantFrom(...VALID_FUNCTIONS);

/**
 * Generates an action group name
 */
export const actionGroupNameArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('AuditorActionGroup'),
    fc.constant('AccessibilityAuditor'),
    fc.string({ minLength: 1, maxLength: 50 })
);

/**
 * Generates an ActionGroupParameter
 */
export const actionGroupParameterArb: fc.Arbitrary<ActionGroupParameter> = fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    type: fc.constantFrom('string', 'number', 'boolean'),
    value: fc.string({ minLength: 0, maxLength: 200 })
});

/**
 * Generates parameters for ScanURL action
 */
export const scanURLParametersArb: fc.Arbitrary<ActionGroupParameter[]> = fc.tuple(
    urlArb,
    viewportArb,
    fc.integer({ min: 1, max: 10 })
).map(([url, viewport, page]) => [
    { name: 'url', type: 'string', value: url },
    { name: 'viewport', type: 'string', value: viewport },
    { name: 'page', type: 'string', value: String(page) }
]);

/**
 * Generates parameters for VerifyElement action
 */
export const verifyElementParametersArb: fc.Arbitrary<ActionGroupParameter[]> = fc.tuple(
    urlArb,
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.constantFrom('button-name', 'color-contrast', 'image-alt', 'label', 'link-name')
).map(([url, selector, ruleId]) => [
    { name: 'url', type: 'string', value: url },
    { name: 'selector', type: 'string', value: selector },
    { name: 'ruleId', type: 'string', value: ruleId }
]);

/**
 * Generates parameters for GetPageStructure action
 */
export const getPageStructureParametersArb: fc.Arbitrary<ActionGroupParameter[]> = fc.tuple(
    urlArb,
    viewportArb
).map(([url, viewport]) => [
    { name: 'url', type: 'string', value: url },
    { name: 'viewport', type: 'string', value: viewport }
]);

/**
 * Generates an ActionGroupRequest
 */
export const actionGroupRequestArb: fc.Arbitrary<ActionGroupRequest> = fc.oneof(
    fc.record({
        actionGroup: actionGroupNameArb,
        function: fc.constant('ScanURL' as const),
        parameters: scanURLParametersArb
    }),
    fc.record({
        actionGroup: actionGroupNameArb,
        function: fc.constant('VerifyElement' as const),
        parameters: verifyElementParametersArb
    }),
    fc.record({
        actionGroup: actionGroupNameArb,
        function: fc.constant('GetPageStructure' as const),
        parameters: getPageStructureParametersArb
    })
);

/**
 * Generates a LambdaEvent
 */
export const lambdaEventArb: fc.Arbitrary<LambdaEvent> = fc.oneof(
    fc.record({
        actionGroup: actionGroupNameArb,
        function: fc.constant('ScanURL'),
        parameters: scanURLParametersArb,
        messageVersion: fc.constant('1.0')
    }),
    fc.record({
        actionGroup: actionGroupNameArb,
        function: fc.constant('VerifyElement'),
        parameters: verifyElementParametersArb,
        messageVersion: fc.constant('1.0')
    }),
    fc.record({
        actionGroup: actionGroupNameArb,
        function: fc.constant('GetPageStructure'),
        parameters: getPageStructureParametersArb,
        messageVersion: fc.constant('1.0')
    })
);

/**
 * Generates a VerifyResult
 */
export const verifyResultArb: fc.Arbitrary<VerifyResult> = fc.oneof(
    fc.record({
        status: fc.constant('pass' as const),
        score: fc.constant(100)
    }),
    fc.record({
        status: fc.constant('fail' as const),
        violations: fc.array(fc.record({
            id: fc.constantFrom('button-name', 'color-contrast', 'image-alt'),
            impact: fc.constantFrom('critical', 'serious', 'moderate', 'minor'),
            description: fc.string({ minLength: 10, maxLength: 100 }),
            help: fc.string({ minLength: 5, maxLength: 50 }),
            helpUrl: fc.constant('https://dequeuniversity.com/rules/axe/4.10/button-name'),
            nodes: fc.array(fc.record({
                selector: fc.string({ minLength: 1, maxLength: 50 }),
                html: fc.constant('<button>Test</button>'),
                failureSummary: fc.string({ minLength: 10, maxLength: 100 }),
                target: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 })
            }), { minLength: 1, maxLength: 3 })
        }), { minLength: 1, maxLength: 3 }),
        score: fc.constant(0)
    })
);

/**
 * Generates an ElementSummary
 */
export const elementSummaryArb: fc.Arbitrary<ElementSummary> = fc.record({
    selector: fc.string({ minLength: 1, maxLength: 50 }),
    tagName: fc.constantFrom('button', 'a', 'input', 'select', 'textarea', 'div', 'header', 'nav', 'main', 'h1', 'h2', 'h3'),
    role: fc.option(fc.constantFrom('button', 'link', 'textbox', 'navigation', 'main', 'heading'), { nil: undefined }),
    text: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
});

/**
 * Generates a PageStructure
 */
export const pageStructureArb: fc.Arbitrary<PageStructure> = fc.record({
    interactiveElements: fc.array(elementSummaryArb, { minLength: 0, maxLength: 10 }),
    landmarks: fc.array(elementSummaryArb, { minLength: 0, maxLength: 5 }),
    headings: fc.array(elementSummaryArb, { minLength: 0, maxLength: 6 })
});

/**
 * Generates a success response body for ScanURL
 */
export const scanURLResponseBodyArb: fc.Arbitrary<ScanURLResponseBody> = scanResultArb.map(data => ({
    success: true as const,
    data
}));

/**
 * Generates a success response body for VerifyElement
 */
export const verifyElementResponseBodyArb: fc.Arbitrary<VerifyElementResponseBody> = verifyResultArb.map(data => ({
    success: true as const,
    data
}));

/**
 * Generates a success response body for GetPageStructure
 */
export const getPageStructureResponseBodyArb: fc.Arbitrary<GetPageStructureResponseBody> = pageStructureArb.map(data => ({
    success: true as const,
    data
}));

/**
 * Generates an error response body
 */
export const errorResponseBodyArb: fc.Arbitrary<ErrorResponseBody> = auditorErrorDataArb.map(error => ({
    success: false as const,
    error
}));

/**
 * Generates a valid ActionGroupResponse
 */
export const actionGroupResponseArb: fc.Arbitrary<ActionGroupResponse> = fc.tuple(
    actionGroupNameArb,
    functionNameArb,
    fc.oneof(
        scanURLResponseBodyArb.map(body => JSON.stringify(body)),
        verifyElementResponseBodyArb.map(body => JSON.stringify(body)),
        getPageStructureResponseBodyArb.map(body => JSON.stringify(body)),
        errorResponseBodyArb.map(body => JSON.stringify(body))
    )
).map(([actionGroup, functionName, body]) => ({
    messageVersion: '1.0' as const,
    response: {
        actionGroup,
        function: functionName,
        functionResponse: {
            responseBody: {
                TEXT: {
                    body
                }
            }
        }
    }
}));

/**
 * Generates a success ActionGroupResponse for ScanURL
 */
export const scanURLSuccessResponseArb: fc.Arbitrary<ActionGroupResponse> = fc.tuple(
    actionGroupNameArb,
    scanURLResponseBodyArb
).map(([actionGroup, responseBody]) => ({
    messageVersion: '1.0' as const,
    response: {
        actionGroup,
        function: 'ScanURL',
        functionResponse: {
            responseBody: {
                TEXT: {
                    body: JSON.stringify(responseBody)
                }
            }
        }
    }
}));

/**
 * Generates a success ActionGroupResponse for VerifyElement
 */
export const verifyElementSuccessResponseArb: fc.Arbitrary<ActionGroupResponse> = fc.tuple(
    actionGroupNameArb,
    verifyElementResponseBodyArb
).map(([actionGroup, responseBody]) => ({
    messageVersion: '1.0' as const,
    response: {
        actionGroup,
        function: 'VerifyElement',
        functionResponse: {
            responseBody: {
                TEXT: {
                    body: JSON.stringify(responseBody)
                }
            }
        }
    }
}));

/**
 * Generates a success ActionGroupResponse for GetPageStructure
 */
export const getPageStructureSuccessResponseArb: fc.Arbitrary<ActionGroupResponse> = fc.tuple(
    actionGroupNameArb,
    getPageStructureResponseBodyArb
).map(([actionGroup, responseBody]) => ({
    messageVersion: '1.0' as const,
    response: {
        actionGroup,
        function: 'GetPageStructure',
        functionResponse: {
            responseBody: {
                TEXT: {
                    body: JSON.stringify(responseBody)
                }
            }
        }
    }
}));

/**
 * Generates an error ActionGroupResponse
 */
export const errorActionGroupResponseArb: fc.Arbitrary<ActionGroupResponse> = fc.tuple(
    actionGroupNameArb,
    functionNameArb,
    errorResponseBodyArb
).map(([actionGroup, functionName, responseBody]) => ({
    messageVersion: '1.0' as const,
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
}));
