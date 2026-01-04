/**
 * Unit Tests for Lambda Handler
 *
 * Tests the response functions and validation utilities.
 * Improves coverage for handler.ts methods.
 */

import { describe, it, expect } from 'vitest';
import {
    createSuccessResponse,
    createErrorResponse,
    isValidActionGroupResponse,
    type ActionGroupResponse
} from '../handler.js';
import type { ScanResult, VerifyResult, PageStructure } from '../types/index.js';

describe('Handler Functions', () => {

    describe('createSuccessResponse()', () => {
        it('should create valid success response for ScanResult', () => {
            const mockScanResult: ScanResult = {
                schemaVersion: '1.0',
                metadata: {
                    url: 'https://example.com',
                    timestamp: new Date().toISOString(),
                    viewport: 'desktop',
                    violationCounts: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 }
                },
                violations: [],
                pagination: { currentPage: 1, totalPages: 1, pageSize: 10, hasMoreViolations: false }
            };

            const response = createSuccessResponse('TestGroup', 'ScanURL', mockScanResult);

            expect(response.messageVersion).toBe('1.0');
            expect(response.response.actionGroup).toBe('TestGroup');
            expect(response.response.function).toBe('ScanURL');

            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(true);
            expect(body.data).toEqual(mockScanResult);
        });

        it('should create valid success response for VerifyResult', () => {
            const mockVerifyResult: VerifyResult = {
                status: 'pass',
                selector: '#element',
                ruleId: 'color-contrast',
                score: 100,
                details: { message: 'Element passes' }
            };

            const response = createSuccessResponse('TestGroup', 'VerifyElement', mockVerifyResult);

            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(true);
            expect(body.data.status).toBe('pass');
        });

        it('should create valid success response for PageStructure', () => {
            const mockPageStructure: PageStructure = {
                url: 'https://example.com',
                title: 'Test Page',
                headings: [],
                landmarks: [],
                forms: [],
                images: [],
                links: [],
                buttons: []
            };

            const response = createSuccessResponse('TestGroup', 'GetPageStructure', mockPageStructure);

            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(true);
            expect(body.data.url).toBe('https://example.com');
        });
    });

    describe('createErrorResponse()', () => {
        it('should create valid error response', () => {
            const error = {
                code: 'URL_UNREACHABLE' as const,
                message: 'Failed to reach URL'
            };

            const response = createErrorResponse('TestGroup', 'ScanURL', error);

            expect(response.messageVersion).toBe('1.0');
            expect(response.response.actionGroup).toBe('TestGroup');
            expect(response.response.function).toBe('ScanURL');

            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('URL_UNREACHABLE');
            expect(body.error.message).toBe('Failed to reach URL');
        });
    });

    describe('isValidActionGroupResponse()', () => {
        it('should return true for valid response', () => {
            const validResponse: ActionGroupResponse = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'TestGroup',
                    function: 'ScanURL',
                    functionResponse: {
                        responseBody: {
                            TEXT: {
                                body: JSON.stringify({ success: true, data: {} })
                            }
                        }
                    }
                }
            };

            expect(isValidActionGroupResponse(validResponse)).toBe(true);
        });

        it('should return false for null', () => {
            expect(isValidActionGroupResponse(null)).toBe(false);
        });

        it('should return false for non-object', () => {
            expect(isValidActionGroupResponse('string')).toBe(false);
            expect(isValidActionGroupResponse(123)).toBe(false);
        });

        it('should return false for wrong messageVersion', () => {
            const response = {
                messageVersion: '2.0',
                response: {
                    actionGroup: 'TestGroup',
                    function: 'ScanURL',
                    functionResponse: {
                        responseBody: {
                            TEXT: { body: '{}' }
                        }
                    }
                }
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });

        it('should return false for missing response', () => {
            const response = {
                messageVersion: '1.0'
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });

        it('should return false for missing actionGroup', () => {
            const response = {
                messageVersion: '1.0',
                response: {
                    function: 'ScanURL',
                    functionResponse: {
                        responseBody: {
                            TEXT: { body: '{}' }
                        }
                    }
                }
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });

        it('should return false for missing function', () => {
            const response = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'TestGroup',
                    functionResponse: {
                        responseBody: {
                            TEXT: { body: '{}' }
                        }
                    }
                }
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });

        it('should return false for missing functionResponse', () => {
            const response = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'TestGroup',
                    function: 'ScanURL'
                }
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });

        it('should return false for missing responseBody', () => {
            const response = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'TestGroup',
                    function: 'ScanURL',
                    functionResponse: {}
                }
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });

        it('should return false for missing TEXT', () => {
            const response = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'TestGroup',
                    function: 'ScanURL',
                    functionResponse: {
                        responseBody: {}
                    }
                }
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });

        it('should return false for non-string body', () => {
            const response = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'TestGroup',
                    function: 'ScanURL',
                    functionResponse: {
                        responseBody: {
                            TEXT: { body: 123 }
                        }
                    }
                }
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });

        it('should return false for invalid JSON body', () => {
            const response = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'TestGroup',
                    function: 'ScanURL',
                    functionResponse: {
                        responseBody: {
                            TEXT: { body: 'not json' }
                        }
                    }
                }
            };

            expect(isValidActionGroupResponse(response)).toBe(false);
        });
    });

});

