/**
 * Unit Tests for Injector Handler
 * 
 * Tests the Injector Action Group handler including:
 * - ApplyAttributeFix action
 * - ApplyContentFix action
 * - InjectStyle action
 * - Error handling (SELECTOR_NOT_FOUND, CONTENT_CHANGED)
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import {
    createInjectorHandler,
    applyAttributeFix,
    applyContentFix,
    injectStyle,
    computeSHA256,
    InjectorErrorClass,
    extractAttributeFixParams,
    extractContentFixParams,
    extractStyleFixParams,
    isValidActionGroupResponse,
    type ActionGroupParameter,
    type LambdaEvent
} from '../services/injector-handler.js';

describe('Injector Handler', () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        browser = await chromium.launch({ headless: true });
    });

    afterAll(async () => {
        await browser.close();
    });

    beforeEach(async () => {
        page = await browser.newPage();
        // Set up a simple HTML page for testing
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head><title>Test Page</title></head>
            <body>
                <img id="test-image" src="test.jpg" />
                <button id="test-button">Click me</button>
                <p id="test-paragraph">Original text content</p>
                <div id="test-div" class="existing-class">Test div</div>
                <a id="test-link" href="#">Test link</a>
            </body>
            </html>
        `);
    });

    afterEach(async () => {
        await page.close();
    });

    describe('ApplyAttributeFix', () => {
        it('should apply attribute fix to existing element', async () => {
            const result = await applyAttributeFix(page, {
                selector: '#test-image',
                attribute: 'alt',
                value: 'A descriptive alt text',
                reasoning: 'Adding alt text for accessibility'
            });

            expect(result.success).toBe(true);
            expect(result.selector).toBe('#test-image');
            expect(result.beforeHtml).not.toContain('alt="A descriptive alt text"');
            expect(result.afterHtml).toContain('alt="A descriptive alt text"');
        });

        it('should update existing attribute', async () => {
            // First add an attribute
            await applyAttributeFix(page, {
                selector: '#test-button',
                attribute: 'aria-label',
                value: 'Initial label',
                reasoning: 'Initial'
            });

            // Then update it
            const result = await applyAttributeFix(page, {
                selector: '#test-button',
                attribute: 'aria-label',
                value: 'Updated label',
                reasoning: 'Updating label'
            });

            expect(result.success).toBe(true);
            expect(result.afterHtml).toContain('aria-label="Updated label"');
        });

        it('should throw SELECTOR_NOT_FOUND for non-existent element', async () => {
            await expect(
                applyAttributeFix(page, {
                    selector: '#non-existent',
                    attribute: 'alt',
                    value: 'test',
                    reasoning: 'test'
                })
            ).rejects.toThrow(InjectorErrorClass);

            try {
                await applyAttributeFix(page, {
                    selector: '#non-existent',
                    attribute: 'alt',
                    value: 'test',
                    reasoning: 'test'
                });
            } catch (error) {
                expect(error).toBeInstanceOf(InjectorErrorClass);
                expect((error as InjectorErrorClass).code).toBe('SELECTOR_NOT_FOUND');
            }
        });
    });

    describe('ApplyContentFix', () => {
        it('should apply content fix when hash matches', async () => {
            const originalText = 'Original text content';
            const originalHash = await computeSHA256(originalText);

            const result = await applyContentFix(page, {
                selector: '#test-paragraph',
                innerText: 'Updated text content',
                originalTextHash: originalHash
            });

            expect(result.success).toBe(true);
            expect(result.selector).toBe('#test-paragraph');
            expect(result.beforeHtml).toContain('Original text content');
            expect(result.afterHtml).toContain('Updated text content');
        });

        it('should throw CONTENT_CHANGED when hash does not match', async () => {
            const wrongHash = await computeSHA256('Different text');

            await expect(
                applyContentFix(page, {
                    selector: '#test-paragraph',
                    innerText: 'New content',
                    originalTextHash: wrongHash
                })
            ).rejects.toThrow(InjectorErrorClass);

            try {
                await applyContentFix(page, {
                    selector: '#test-paragraph',
                    innerText: 'New content',
                    originalTextHash: wrongHash
                });
            } catch (error) {
                expect(error).toBeInstanceOf(InjectorErrorClass);
                expect((error as InjectorErrorClass).code).toBe('CONTENT_CHANGED');
            }
        });

        it('should throw SELECTOR_NOT_FOUND for non-existent element', async () => {
            const hash = await computeSHA256('test');

            try {
                await applyContentFix(page, {
                    selector: '#non-existent',
                    innerText: 'test',
                    originalTextHash: hash
                });
            } catch (error) {
                expect(error).toBeInstanceOf(InjectorErrorClass);
                expect((error as InjectorErrorClass).code).toBe('SELECTOR_NOT_FOUND');
            }
        });
    });

    describe('InjectStyle', () => {
        it('should add CSS class to element', async () => {
            const result = await injectStyle(page, {
                selector: '#test-div',
                cssClass: 'new-class',
                styles: {}
            });

            expect(result.success).toBe(true);
            expect(result.beforeHtml).toContain('class="existing-class"');
            expect(result.afterHtml).toContain('existing-class');
            expect(result.afterHtml).toContain('new-class');
        });

        it('should apply inline styles', async () => {
            const result = await injectStyle(page, {
                selector: '#test-div',
                cssClass: '',
                styles: {
                    'color': 'red',
                    'background-color': 'blue'
                }
            });

            expect(result.success).toBe(true);
            expect(result.afterHtml).toContain('style=');
            expect(result.afterHtml).toContain('color');
        });

        it('should apply both class and styles', async () => {
            const result = await injectStyle(page, {
                selector: '#test-div',
                cssClass: 'high-contrast',
                styles: {
                    'outline': '2px solid blue'
                }
            });

            expect(result.success).toBe(true);
            expect(result.afterHtml).toContain('high-contrast');
            expect(result.afterHtml).toContain('style=');
        });

        it('should throw SELECTOR_NOT_FOUND for non-existent element', async () => {
            try {
                await injectStyle(page, {
                    selector: '#non-existent',
                    cssClass: 'test',
                    styles: {}
                });
            } catch (error) {
                expect(error).toBeInstanceOf(InjectorErrorClass);
                expect((error as InjectorErrorClass).code).toBe('SELECTOR_NOT_FOUND');
            }
        });
    });

    describe('Parameter Extraction', () => {
        it('should extract attribute fix params correctly', () => {
            const params: ActionGroupParameter[] = [
                { name: 'selector', type: 'string', value: '#test' },
                { name: 'attribute', type: 'string', value: 'alt' },
                { name: 'value', type: 'string', value: 'test value' },
                { name: 'reasoning', type: 'string', value: 'test reason' }
            ];

            const result = extractAttributeFixParams(params);
            expect(result.selector).toBe('#test');
            expect(result.attribute).toBe('alt');
            expect(result.value).toBe('test value');
            expect(result.reasoning).toBe('test reason');
        });

        it('should throw VALIDATION_FAILED for missing required params', () => {
            const params: ActionGroupParameter[] = [
                { name: 'selector', type: 'string', value: '#test' }
            ];

            expect(() => extractAttributeFixParams(params)).toThrow(InjectorErrorClass);
        });

        it('should extract content fix params correctly', () => {
            const params: ActionGroupParameter[] = [
                { name: 'selector', type: 'string', value: '#test' },
                { name: 'innerText', type: 'string', value: 'new text' },
                { name: 'originalTextHash', type: 'string', value: 'abc123' }
            ];

            const result = extractContentFixParams(params);
            expect(result.selector).toBe('#test');
            expect(result.innerText).toBe('new text');
            expect(result.originalTextHash).toBe('abc123');
        });

        it('should extract style fix params correctly', () => {
            const params: ActionGroupParameter[] = [
                { name: 'selector', type: 'string', value: '#test' },
                { name: 'cssClass', type: 'string', value: 'my-class' },
                { name: 'styles', type: 'string', value: '{"color":"red"}' }
            ];

            const result = extractStyleFixParams(params);
            expect(result.selector).toBe('#test');
            expect(result.cssClass).toBe('my-class');
            expect(result.styles).toEqual({ color: 'red' });
        });

        it('should throw VALIDATION_FAILED for invalid JSON in styles', () => {
            const params: ActionGroupParameter[] = [
                { name: 'selector', type: 'string', value: '#test' },
                { name: 'cssClass', type: 'string', value: '' },
                { name: 'styles', type: 'string', value: 'invalid json' }
            ];

            expect(() => extractStyleFixParams(params)).toThrow(InjectorErrorClass);
        });
    });

    describe('Handler Integration', () => {
        it('should handle ApplyAttributeFix request', async () => {
            const handler = createInjectorHandler({ page });

            const event: LambdaEvent = {
                actionGroup: 'InjectorActionGroup',
                function: 'ApplyAttributeFix',
                parameters: [
                    { name: 'selector', type: 'string', value: '#test-image' },
                    { name: 'attribute', type: 'string', value: 'alt' },
                    { name: 'value', type: 'string', value: 'Test alt text' },
                    { name: 'reasoning', type: 'string', value: 'Adding alt text' }
                ]
            };

            const response = await handler(event);

            expect(isValidActionGroupResponse(response)).toBe(true);
            expect(response.messageVersion).toBe('1.0');
            expect(response.response.function).toBe('ApplyAttributeFix');

            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(true);
            expect(body.data.afterHtml).toContain('alt="Test alt text"');
        });

        it('should handle ApplyContentFix request', async () => {
            const handler = createInjectorHandler({ page });
            const originalHash = await computeSHA256('Original text content');

            const event: LambdaEvent = {
                actionGroup: 'InjectorActionGroup',
                function: 'ApplyContentFix',
                parameters: [
                    { name: 'selector', type: 'string', value: '#test-paragraph' },
                    { name: 'innerText', type: 'string', value: 'New content' },
                    { name: 'originalTextHash', type: 'string', value: originalHash }
                ]
            };

            const response = await handler(event);

            expect(isValidActionGroupResponse(response)).toBe(true);
            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(true);
        });

        it('should handle InjectStyle request', async () => {
            const handler = createInjectorHandler({ page });

            const event: LambdaEvent = {
                actionGroup: 'InjectorActionGroup',
                function: 'InjectStyle',
                parameters: [
                    { name: 'selector', type: 'string', value: '#test-div' },
                    { name: 'cssClass', type: 'string', value: 'highlight' },
                    { name: 'styles', type: 'string', value: '{"color":"blue"}' }
                ]
            };

            const response = await handler(event);

            expect(isValidActionGroupResponse(response)).toBe(true);
            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(true);
        });

        it('should return error response for SELECTOR_NOT_FOUND', async () => {
            const handler = createInjectorHandler({ page });

            const event: LambdaEvent = {
                actionGroup: 'InjectorActionGroup',
                function: 'ApplyAttributeFix',
                parameters: [
                    { name: 'selector', type: 'string', value: '#non-existent' },
                    { name: 'attribute', type: 'string', value: 'alt' },
                    { name: 'value', type: 'string', value: 'test' },
                    { name: 'reasoning', type: 'string', value: 'test' }
                ]
            };

            const response = await handler(event);

            expect(isValidActionGroupResponse(response)).toBe(true);
            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('SELECTOR_NOT_FOUND');
        });

        it('should return error response for CONTENT_CHANGED', async () => {
            const handler = createInjectorHandler({ page });
            const wrongHash = await computeSHA256('wrong content');

            const event: LambdaEvent = {
                actionGroup: 'InjectorActionGroup',
                function: 'ApplyContentFix',
                parameters: [
                    { name: 'selector', type: 'string', value: '#test-paragraph' },
                    { name: 'innerText', type: 'string', value: 'New content' },
                    { name: 'originalTextHash', type: 'string', value: wrongHash }
                ]
            };

            const response = await handler(event);

            expect(isValidActionGroupResponse(response)).toBe(true);
            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('CONTENT_CHANGED');
        });

        it('should handle unknown function', async () => {
            const handler = createInjectorHandler({ page });

            const event = {
                actionGroup: 'InjectorActionGroup',
                function: 'UnknownFunction',
                parameters: []
            } as unknown as LambdaEvent;

            const response = await handler(event);

            expect(isValidActionGroupResponse(response)).toBe(true);
            const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_FAILED');
        });
    });

    describe('InjectorErrorClass', () => {
        it('should create error with all properties', () => {
            const error = new InjectorErrorClass(
                'SELECTOR_NOT_FOUND',
                'Element not found',
                '#test',
                { attempted: true }
            );

            expect(error.code).toBe('SELECTOR_NOT_FOUND');
            expect(error.message).toBe('Element not found');
            expect(error.selector).toBe('#test');
            expect(error.details).toEqual({ attempted: true });
        });

        it('should serialize to JSON correctly', () => {
            const error = new InjectorErrorClass(
                'CONTENT_CHANGED',
                'Content has changed',
                '#paragraph'
            );

            const json = error.toJSON();
            expect(json.code).toBe('CONTENT_CHANGED');
            expect(json.message).toBe('Content has changed');
            expect(json.selector).toBe('#paragraph');
            expect(json.details).toBeUndefined();
        });

        it('should include details in JSON when provided', () => {
            const error = new InjectorErrorClass(
                'CONTENT_CHANGED',
                'Content has changed',
                '#paragraph',
                { expectedHash: 'abc', actualHash: 'def' }
            );

            const json = error.toJSON();
            expect(json.details).toEqual({ expectedHash: 'abc', actualHash: 'def' });
        });
    });

    describe('Response Validation', () => {
        it('should validate correct response structure', () => {
            const validResponse = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'InjectorActionGroup',
                    function: 'ApplyAttributeFix',
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

        it('should reject invalid message version', () => {
            const invalidResponse = {
                messageVersion: '2.0',
                response: {
                    actionGroup: 'InjectorActionGroup',
                    function: 'ApplyAttributeFix',
                    functionResponse: {
                        responseBody: {
                            TEXT: {
                                body: '{}'
                            }
                        }
                    }
                }
            };

            expect(isValidActionGroupResponse(invalidResponse)).toBe(false);
        });

        it('should reject missing response body', () => {
            const invalidResponse = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'InjectorActionGroup',
                    function: 'ApplyAttributeFix'
                }
            };

            expect(isValidActionGroupResponse(invalidResponse)).toBe(false);
        });

        it('should reject invalid JSON in body', () => {
            const invalidResponse = {
                messageVersion: '1.0',
                response: {
                    actionGroup: 'InjectorActionGroup',
                    function: 'ApplyAttributeFix',
                    functionResponse: {
                        responseBody: {
                            TEXT: {
                                body: 'not valid json'
                            }
                        }
                    }
                }
            };

            expect(isValidActionGroupResponse(invalidResponse)).toBe(false);
        });
    });
});
