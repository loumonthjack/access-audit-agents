/**
 * Property-based tests for Bedrock Response Schema Conformance
 * 
 * Feature: core-auditor-agent
 * Property 7: Bedrock Response Schema Conformance
 * 
 * *For any* response returned from an Action Group invocation, the response SHALL
 * conform to the ActionGroupResponse interface with a valid JSON string in
 * `responseBody.TEXT.body`.
 * 
 * Validates: Requirements 9.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    actionGroupResponseArb,
    scanURLSuccessResponseArb,
    verifyElementSuccessResponseArb,
    getPageStructureSuccessResponseArb,
    errorActionGroupResponseArb,
    actionGroupNameArb,
    functionNameArb,
    scanURLResponseBodyArb,
    verifyElementResponseBodyArb,
    getPageStructureResponseBodyArb,
    errorResponseBodyArb
} from '../__generators__/action-group.generator.js';
import {
    createSuccessResponse,
    createErrorResponse,
    isValidActionGroupResponse,
    type ActionGroupResponse
} from '../handler.js';
import { scanResultArb } from '../__generators__/scan-result.generator.js';
import { auditorErrorDataArb } from '../__generators__/error.generator.js';

describe('Property 7: Bedrock Response Schema Conformance', () => {
    /**
     * Property 7.1: All generated ActionGroupResponses have correct messageVersion
     * 
     * For any ActionGroupResponse, the messageVersion SHALL be '1.0'.
     */
    it('should always have messageVersion "1.0"', () => {
        fc.assert(
            fc.property(
                actionGroupResponseArb,
                (response) => {
                    expect(response.messageVersion).toBe('1.0');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.2: All generated ActionGroupResponses have valid response structure
     * 
     * For any ActionGroupResponse, the response object SHALL contain:
     * - actionGroup (string)
     * - function (string)
     * - functionResponse.responseBody.TEXT.body (string)
     */
    it('should always have valid response structure', () => {
        fc.assert(
            fc.property(
                actionGroupResponseArb,
                (response) => {
                    // Check response object exists
                    expect(response.response).toBeDefined();
                    expect(typeof response.response).toBe('object');

                    // Check actionGroup
                    expect(typeof response.response.actionGroup).toBe('string');
                    expect(response.response.actionGroup.length).toBeGreaterThan(0);

                    // Check function
                    expect(typeof response.response.function).toBe('string');
                    expect(response.response.function.length).toBeGreaterThan(0);

                    // Check functionResponse structure
                    expect(response.response.functionResponse).toBeDefined();
                    expect(response.response.functionResponse.responseBody).toBeDefined();
                    expect(response.response.functionResponse.responseBody.TEXT).toBeDefined();
                    expect(typeof response.response.functionResponse.responseBody.TEXT.body).toBe('string');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.3: Response body is always valid JSON
     * 
     * For any ActionGroupResponse, the body in responseBody.TEXT.body SHALL be
     * a valid JSON string that can be parsed without error.
     */
    it('should always have valid JSON in response body', () => {
        fc.assert(
            fc.property(
                actionGroupResponseArb,
                (response) => {
                    const body = response.response.functionResponse.responseBody.TEXT.body;

                    // Should not throw when parsing
                    expect(() => JSON.parse(body)).not.toThrow();

                    // Parsed result should be an object
                    const parsed = JSON.parse(body);
                    expect(typeof parsed).toBe('object');
                    expect(parsed).not.toBeNull();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.4: Response body contains success field
     * 
     * For any ActionGroupResponse, the parsed body SHALL contain a 'success' field
     * that is a boolean.
     */
    it('should always have success field in parsed body', () => {
        fc.assert(
            fc.property(
                actionGroupResponseArb,
                (response) => {
                    const body = response.response.functionResponse.responseBody.TEXT.body;
                    const parsed = JSON.parse(body);

                    expect(parsed).toHaveProperty('success');
                    expect(typeof parsed.success).toBe('boolean');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.5: Success responses have data field
     * 
     * For any success ActionGroupResponse, the parsed body SHALL contain a 'data' field.
     */
    it('should have data field in success responses', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    scanURLSuccessResponseArb,
                    verifyElementSuccessResponseArb,
                    getPageStructureSuccessResponseArb
                ),
                (response) => {
                    const body = response.response.functionResponse.responseBody.TEXT.body;
                    const parsed = JSON.parse(body);

                    expect(parsed.success).toBe(true);
                    expect(parsed).toHaveProperty('data');
                    expect(parsed.data).toBeDefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.6: Error responses have error field
     * 
     * For any error ActionGroupResponse, the parsed body SHALL contain an 'error' field
     * with code and message.
     */
    it('should have error field in error responses', () => {
        fc.assert(
            fc.property(
                errorActionGroupResponseArb,
                (response) => {
                    const body = response.response.functionResponse.responseBody.TEXT.body;
                    const parsed = JSON.parse(body);

                    expect(parsed.success).toBe(false);
                    expect(parsed).toHaveProperty('error');
                    expect(parsed.error).toHaveProperty('code');
                    expect(parsed.error).toHaveProperty('message');
                    expect(typeof parsed.error.code).toBe('string');
                    expect(typeof parsed.error.message).toBe('string');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.7: isValidActionGroupResponse correctly validates responses
     * 
     * For any generated ActionGroupResponse, isValidActionGroupResponse SHALL return true.
     */
    it('should validate all generated responses as valid', () => {
        fc.assert(
            fc.property(
                actionGroupResponseArb,
                (response) => {
                    expect(isValidActionGroupResponse(response)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.8: createSuccessResponse produces valid responses
     * 
     * For any valid ScanResult, createSuccessResponse SHALL produce a response
     * that passes isValidActionGroupResponse.
     */
    it('should produce valid responses from createSuccessResponse with ScanResult', () => {
        fc.assert(
            fc.property(
                actionGroupNameArb,
                scanResultArb,
                (actionGroup, scanResult) => {
                    const response = createSuccessResponse(actionGroup, 'ScanURL', scanResult);

                    expect(isValidActionGroupResponse(response)).toBe(true);
                    expect(response.messageVersion).toBe('1.0');
                    expect(response.response.actionGroup).toBe(actionGroup);
                    expect(response.response.function).toBe('ScanURL');

                    const parsed = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
                    expect(parsed.success).toBe(true);
                    expect(parsed.data).toEqual(scanResult);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.9: createErrorResponse produces valid responses
     * 
     * For any valid AuditorError, createErrorResponse SHALL produce a response
     * that passes isValidActionGroupResponse.
     */
    it('should produce valid responses from createErrorResponse', () => {
        fc.assert(
            fc.property(
                actionGroupNameArb,
                functionNameArb,
                auditorErrorDataArb,
                (actionGroup, functionName, error) => {
                    const response = createErrorResponse(actionGroup, functionName, error);

                    expect(isValidActionGroupResponse(response)).toBe(true);
                    expect(response.messageVersion).toBe('1.0');
                    expect(response.response.actionGroup).toBe(actionGroup);
                    expect(response.response.function).toBe(functionName);

                    const parsed = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
                    expect(parsed.success).toBe(false);
                    expect(parsed.error.code).toBe(error.code);
                    expect(parsed.error.message).toBe(error.message);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.10: Invalid responses are correctly rejected
     * 
     * For any malformed response, isValidActionGroupResponse SHALL return false.
     */
    describe('Invalid responses are correctly rejected', () => {
        it('should reject null', () => {
            expect(isValidActionGroupResponse(null)).toBe(false);
        });

        it('should reject undefined', () => {
            expect(isValidActionGroupResponse(undefined)).toBe(false);
        });

        it('should reject non-objects', () => {
            fc.assert(
                fc.property(
                    fc.oneof(fc.string(), fc.integer(), fc.boolean()),
                    (value) => {
                        expect(isValidActionGroupResponse(value)).toBe(false);
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should reject responses with wrong messageVersion', () => {
            fc.assert(
                fc.property(
                    actionGroupResponseArb,
                    fc.string().filter(s => s !== '1.0'),
                    (response, wrongVersion) => {
                        const invalid = { ...response, messageVersion: wrongVersion };
                        expect(isValidActionGroupResponse(invalid)).toBe(false);
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should reject responses with missing response object', () => {
            fc.assert(
                fc.property(
                    actionGroupResponseArb,
                    (response) => {
                        const invalid = { messageVersion: response.messageVersion };
                        expect(isValidActionGroupResponse(invalid)).toBe(false);
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should reject responses with invalid JSON body', () => {
            fc.assert(
                fc.property(
                    actionGroupResponseArb,
                    (response) => {
                        const invalid: ActionGroupResponse = {
                            ...response,
                            response: {
                                ...response.response,
                                functionResponse: {
                                    responseBody: {
                                        TEXT: {
                                            body: 'not valid json {'
                                        }
                                    }
                                }
                            }
                        };
                        expect(isValidActionGroupResponse(invalid)).toBe(false);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});
