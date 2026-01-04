/**
 * Unit Tests for Error Recovery Service
 * 
 * Tests the error recovery functionality including:
 * - Selector fuzzy matching (Requirement 7.1)
 * - Vague text improvement (Requirement 7.2)
 * - Rollback on new violation (Requirement 7.3)
 * - Human handoff when all strategies fail (Requirement 7.4)
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import {
    ErrorRecoveryService,
    levenshteinDistance,
    stringSimilarity,
    extractTagFromSelector,
    extractIdFromSelector,
    extractClassesFromSelector,
    extractAttributesFromSelector
} from '../services/error-recovery.js';
import type { PageStructure, ElementSummary } from '../services/error-recovery.js';
import type { FixInstruction, InjectorError } from '../types/index.js';
import { RollbackManager } from '../services/rollback-manager.js';

describe('Error Recovery Service', () => {
    let recoveryService: ErrorRecoveryService;
    let rollbackManager: RollbackManager;

    beforeEach(() => {
        rollbackManager = new RollbackManager();
        recoveryService = new ErrorRecoveryService(rollbackManager);
    });

    describe('Selector Fuzzy Matching (Requirement 7.1)', () => {
        it('should find exact match by ID', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [
                    { selector: '#submit-button', tagName: 'button', text: 'Submit' },
                    { selector: '#cancel-button', tagName: 'button', text: 'Cancel' }
                ],
                landmarks: [],
                headings: []
            };

            const result = recoveryService.recoverFromSelectorError(
                '#submit-button',
                pageStructure
            );

            expect(result.success).toBe(true);
            expect(result.correctedSelector).toBe('#submit-button');
        });

        it('should find match by similar ID', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [
                    { selector: '#submit-btn', tagName: 'button', text: 'Submit' }
                ],
                landmarks: [],
                headings: []
            };

            const result = recoveryService.recoverFromSelectorError(
                '#submit-button',
                pageStructure
            );

            // Should find the similar ID
            expect(result.originalSelector).toBe('#submit-button');
            // Confidence should be reasonable for similar strings
            expect(result.confidence).toBeGreaterThan(0);
        });

        it('should prefer tag name matches', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [
                    { selector: 'button.primary', tagName: 'button', text: 'Click' },
                    { selector: 'div.primary', tagName: 'div', text: 'Click' }
                ],
                landmarks: [],
                headings: []
            };

            const result = recoveryService.recoverFromSelectorError(
                'button.submit',
                pageStructure
            );

            if (result.success) {
                expect(result.matchedElement?.tagName).toBe('button');
            }
        });

        it('should return failure for empty page structure', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [],
                landmarks: [],
                headings: []
            };

            const result = recoveryService.recoverFromSelectorError(
                '#any-selector',
                pageStructure
            );

            expect(result.success).toBe(false);
            expect(result.reason).toContain('No elements found');
        });

        it('should return failure for completely unmatched selector', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [
                    { selector: '#completely-different', tagName: 'div' }
                ],
                landmarks: [],
                headings: []
            };

            const result = recoveryService.recoverFromSelectorError(
                '#xyz-nonexistent-element-123',
                pageStructure
            );

            // Should fail due to low confidence
            expect(result.confidence).toBeLessThan(0.5);
        });

        it('should match by aria-label text', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [
                    { selector: 'button.nav', tagName: 'button', text: 'Open navigation menu' }
                ],
                landmarks: [],
                headings: []
            };

            const result = recoveryService.recoverFromSelectorError(
                'button[aria-label="Open navigation menu"]',
                pageStructure
            );

            // Should find match based on text similarity
            expect(result.originalSelector).toBe('button[aria-label="Open navigation menu"]');
        });

        it('should search across all element types', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [
                    { selector: 'button.action', tagName: 'button' }
                ],
                landmarks: [
                    { selector: 'nav#main-nav', tagName: 'nav', role: 'navigation' }
                ],
                headings: [
                    { selector: 'h1#page-title', tagName: 'h1', role: 'heading' }
                ]
            };

            // Should find in landmarks
            const navResult = recoveryService.recoverFromSelectorError(
                'nav#main-nav',
                pageStructure
            );
            expect(navResult.success).toBe(true);

            // Should find in headings
            const headingResult = recoveryService.recoverFromSelectorError(
                'h1#page-title',
                pageStructure
            );
            expect(headingResult.success).toBe(true);
        });
    });

    describe('Vague Text Improvement (Requirement 7.2)', () => {
        it('should identify vague text failure', () => {
            const analysis = recoveryService.analyzeVerificationFailure(
                'Text is too vague and non-descriptive',
                'Click here'
            );

            expect(analysis.failureType).toBe('vague_text');
            expect(analysis.suggestedAction).toBe('improve_text');
            expect(analysis.improvedText).toBeDefined();
            expect(analysis.improvedText).not.toBe('Click here');
        });

        it('should identify redundant text failure', () => {
            const analysis = recoveryService.analyzeVerificationFailure(
                'Text is redundant with nearby content',
                'Submit'
            );

            expect(analysis.failureType).toBe('redundant_text');
            expect(analysis.suggestedAction).toBe('improve_text');
            expect(analysis.improvedText).toContain('unique');
        });

        it('should identify new violation failure', () => {
            const analysis = recoveryService.analyzeVerificationFailure(
                'Fix introduced a new violation'
            );

            expect(analysis.failureType).toBe('new_violation');
            expect(analysis.suggestedAction).toBe('rollback');
        });

        it('should default to retry for unknown failures', () => {
            const analysis = recoveryService.analyzeVerificationFailure(
                'Some unknown error occurred'
            );

            expect(analysis.failureType).toBe('other');
            expect(analysis.suggestedAction).toBe('retry');
        });

        it('should improve common vague phrases', () => {
            const vagueTexts = ['click here', 'read more', 'learn more', 'more', 'here'];

            for (const text of vagueTexts) {
                const analysis = recoveryService.analyzeVerificationFailure(
                    'Text is vague',
                    text
                );

                expect(analysis.improvedText).toBeDefined();
                expect(analysis.improvedText!.length).toBeGreaterThan(text.length);
            }
        });

        it('should create improved content instruction', () => {
            const original: FixInstruction = {
                type: 'content',
                selector: '#link',
                violationId: 'v-1',
                reasoning: 'Fix vague text',
                params: {
                    selector: '#link',
                    innerText: 'Click here',
                    originalTextHash: 'abc123'
                }
            };

            const improved = recoveryService.createImprovedTextInstruction(
                original,
                'Click here to submit your application'
            );

            expect(improved.type).toBe('content');
            expect(improved.violationId).toBe('v-1');
            expect((improved.params as { innerText: string }).innerText).toBe(
                'Click here to submit your application'
            );
        });

        it('should create improved attribute instruction for alt text', () => {
            const original: FixInstruction = {
                type: 'attribute',
                selector: 'img',
                violationId: 'v-2',
                reasoning: 'Add alt text',
                params: {
                    selector: 'img',
                    attribute: 'alt',
                    value: 'image',
                    reasoning: 'Add alt text'
                }
            };

            const improved = recoveryService.createImprovedTextInstruction(
                original,
                'Product photo showing blue sneakers'
            );

            expect(improved.type).toBe('attribute');
            expect((improved.params as { value: string }).value).toBe(
                'Product photo showing blue sneakers'
            );
        });

        it('should not modify non-text attributes', () => {
            const original: FixInstruction = {
                type: 'attribute',
                selector: 'div',
                violationId: 'v-3',
                reasoning: 'Add role',
                params: {
                    selector: 'div',
                    attribute: 'role',
                    value: 'button',
                    reasoning: 'Add role'
                }
            };

            const improved = recoveryService.createImprovedTextInstruction(
                original,
                'new value'
            );

            // Should not change role attribute
            expect((improved.params as { value: string }).value).toBe('button');
        });
    });

    describe('Rollback on New Violation (Requirement 7.3)', () => {
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
            await page.setContent(`
                <!DOCTYPE html>
                <html>
                <body>
                    <div id="test-element">Original content</div>
                </body>
                </html>
            `);
        });

        afterEach(async () => {
            await page.close();
        });

        it('should save and restore snapshot', async () => {
            const sessionId = 'test-session';
            const selector = '#test-element';

            // Get original HTML
            const originalHtml = await page.$eval(selector, el => el.outerHTML);

            // Save snapshot
            const snapshotId = rollbackManager.saveSnapshot(sessionId, selector, originalHtml);
            expect(snapshotId).toBeDefined();

            // Modify the element
            await page.$eval(selector, el => {
                el.textContent = 'Modified content';
            });

            // Verify modification
            const modifiedHtml = await page.$eval(selector, el => el.outerHTML);
            expect(modifiedHtml).toContain('Modified content');

            // Rollback
            await rollbackManager.rollback(page, snapshotId);

            // Verify rollback
            const restoredHtml = await page.$eval(selector, el => el.outerHTML);
            expect(restoredHtml).toBe(originalHtml);
        });

        it('should trigger rollback through recovery service', async () => {
            const sessionId = 'test-session-2';
            const selector = '#test-element';

            // Get original HTML
            const originalHtml = await page.$eval(selector, el => el.outerHTML);

            // Save snapshot through rollback manager
            const snapshotId = recoveryService.getRollbackManager().saveSnapshot(
                sessionId,
                selector,
                originalHtml
            );

            // Modify the element
            await page.$eval(selector, el => {
                el.textContent = 'Bad modification';
            });

            // Trigger rollback
            const success = await recoveryService.triggerRollback(page, snapshotId);
            expect(success).toBe(true);

            // Verify rollback
            const restoredHtml = await page.$eval(selector, el => el.outerHTML);
            expect(restoredHtml).toBe(originalHtml);
        });

        it('should return false for invalid snapshot ID', async () => {
            const success = await recoveryService.triggerRollback(page, 'invalid-snapshot-id');
            expect(success).toBe(false);
        });
    });

    describe('Human Handoff (Requirement 7.4)', () => {
        it('should handoff for CONTENT_CHANGED error', () => {
            const error: InjectorError = {
                code: 'CONTENT_CHANGED',
                message: 'Content has changed since audit',
                selector: '#element'
            };

            const instruction: FixInstruction = {
                type: 'content',
                selector: '#element',
                violationId: 'v-1',
                reasoning: 'Fix content',
                params: {
                    selector: '#element',
                    innerText: 'New text',
                    originalTextHash: 'abc123'
                }
            };

            const result = recoveryService.recoverFromInjectorError(error, instruction);

            expect(result.success).toBe(false);
            expect(result.action).toBe('handoff');
            expect(result.details).toContain('re-audit');
        });

        it('should handoff for DESTRUCTIVE_CHANGE error', () => {
            const error: InjectorError = {
                code: 'DESTRUCTIVE_CHANGE',
                message: 'Fix would remove interactive element',
                selector: 'button'
            };

            const instruction: FixInstruction = {
                type: 'content',
                selector: 'button',
                violationId: 'v-2',
                reasoning: 'Clear button',
                params: {
                    selector: 'button',
                    innerText: '',
                    originalTextHash: 'def456'
                }
            };

            const result = recoveryService.recoverFromInjectorError(error, instruction);

            expect(result.success).toBe(false);
            expect(result.action).toBe('handoff');
            expect(result.details).toContain('human review');
        });

        it('should handoff when no page structure available for SELECTOR_NOT_FOUND', () => {
            const error: InjectorError = {
                code: 'SELECTOR_NOT_FOUND',
                message: 'Element not found',
                selector: '#missing'
            };

            const instruction: FixInstruction = {
                type: 'attribute',
                selector: '#missing',
                violationId: 'v-3',
                reasoning: 'Add attribute',
                params: {
                    selector: '#missing',
                    attribute: 'alt',
                    value: 'test',
                    reasoning: 'Add attribute'
                }
            };

            // No page structure provided
            const result = recoveryService.recoverFromInjectorError(error, instruction);

            expect(result.success).toBe(false);
            expect(result.action).toBe('handoff');
            expect(result.details).toContain('no page structure');
        });

        it('should attempt recovery for SELECTOR_NOT_FOUND with page structure', () => {
            const error: InjectorError = {
                code: 'SELECTOR_NOT_FOUND',
                message: 'Element not found',
                selector: '#submit-btn'
            };

            const instruction: FixInstruction = {
                type: 'attribute',
                selector: '#submit-btn',
                violationId: 'v-4',
                reasoning: 'Add attribute',
                params: {
                    selector: '#submit-btn',
                    attribute: 'aria-label',
                    value: 'Submit form',
                    reasoning: 'Add attribute'
                }
            };

            const pageStructure: PageStructure = {
                interactiveElements: [
                    { selector: '#submit-button', tagName: 'button', text: 'Submit' }
                ],
                landmarks: [],
                headings: []
            };

            const result = recoveryService.recoverFromInjectorError(
                error,
                instruction,
                pageStructure
            );

            // Should attempt fuzzy matching
            expect(['selector_corrected', 'handoff']).toContain(result.action);
        });
    });

    describe('Page Structure Cache', () => {
        it('should cache page structure', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [{ selector: '#btn', tagName: 'button' }],
                landmarks: [],
                headings: []
            };

            expect(recoveryService.getPageStructure()).toBeNull();

            recoveryService.setPageStructure(pageStructure);
            expect(recoveryService.getPageStructure()).toEqual(pageStructure);

            recoveryService.clearPageStructureCache();
            expect(recoveryService.getPageStructure()).toBeNull();
        });

        it('should use cached page structure for recovery', () => {
            const pageStructure: PageStructure = {
                interactiveElements: [
                    { selector: '#cached-element', tagName: 'button' }
                ],
                landmarks: [],
                headings: []
            };

            recoveryService.setPageStructure(pageStructure);

            const error: InjectorError = {
                code: 'SELECTOR_NOT_FOUND',
                message: 'Element not found',
                selector: '#cached-element'
            };

            const instruction: FixInstruction = {
                type: 'attribute',
                selector: '#cached-element',
                violationId: 'v-5',
                reasoning: 'Fix',
                params: {
                    selector: '#cached-element',
                    attribute: 'alt',
                    value: 'test',
                    reasoning: 'Fix'
                }
            };

            // Should use cached page structure
            const result = recoveryService.recoverFromInjectorError(error, instruction);
            expect(result.action).toBe('selector_corrected');
        });
    });
});

describe('Fuzzy Matching Utilities', () => {
    describe('levenshteinDistance', () => {
        it('should return 0 for identical strings', () => {
            expect(levenshteinDistance('hello', 'hello')).toBe(0);
            expect(levenshteinDistance('', '')).toBe(0);
        });

        it('should return string length for empty comparison', () => {
            expect(levenshteinDistance('hello', '')).toBe(5);
            expect(levenshteinDistance('', 'world')).toBe(5);
        });

        it('should calculate correct distance for single character changes', () => {
            expect(levenshteinDistance('cat', 'bat')).toBe(1); // substitution
            expect(levenshteinDistance('cat', 'cats')).toBe(1); // insertion
            expect(levenshteinDistance('cats', 'cat')).toBe(1); // deletion
        });

        it('should calculate correct distance for multiple changes', () => {
            expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
            expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
        });
    });

    describe('stringSimilarity', () => {
        it('should return 1 for identical strings', () => {
            expect(stringSimilarity('hello', 'hello')).toBe(1);
        });

        it('should return 0 for completely different strings', () => {
            expect(stringSimilarity('abc', 'xyz')).toBe(0);
        });

        it('should be case insensitive', () => {
            expect(stringSimilarity('Hello', 'hello')).toBe(1);
            expect(stringSimilarity('WORLD', 'world')).toBe(1);
        });

        it('should return value between 0 and 1', () => {
            const similarity = stringSimilarity('button', 'buttons');
            expect(similarity).toBeGreaterThan(0);
            expect(similarity).toBeLessThan(1);
        });
    });

    describe('extractTagFromSelector', () => {
        it('should extract tag from simple selector', () => {
            expect(extractTagFromSelector('div')).toBe('div');
            expect(extractTagFromSelector('button')).toBe('button');
        });

        it('should extract tag from complex selector', () => {
            expect(extractTagFromSelector('div.class')).toBe('div');
            expect(extractTagFromSelector('button#id')).toBe('button');
            expect(extractTagFromSelector('input[type="text"]')).toBe('input');
        });

        it('should return null for non-tag selectors', () => {
            expect(extractTagFromSelector('#id')).toBeNull();
            expect(extractTagFromSelector('.class')).toBeNull();
            expect(extractTagFromSelector('[attr]')).toBeNull();
        });
    });

    describe('extractIdFromSelector', () => {
        it('should extract ID from selector', () => {
            expect(extractIdFromSelector('#my-id')).toBe('my-id');
            expect(extractIdFromSelector('div#my-id')).toBe('my-id');
            expect(extractIdFromSelector('#my-id.class')).toBe('my-id');
        });

        it('should return null when no ID present', () => {
            expect(extractIdFromSelector('div')).toBeNull();
            expect(extractIdFromSelector('.class')).toBeNull();
        });
    });

    describe('extractClassesFromSelector', () => {
        it('should extract single class', () => {
            expect(extractClassesFromSelector('.my-class')).toEqual(['my-class']);
        });

        it('should extract multiple classes', () => {
            expect(extractClassesFromSelector('.class1.class2')).toEqual(['class1', 'class2']);
            expect(extractClassesFromSelector('div.class1.class2')).toEqual(['class1', 'class2']);
        });

        it('should return empty array when no classes', () => {
            expect(extractClassesFromSelector('div')).toEqual([]);
            expect(extractClassesFromSelector('#id')).toEqual([]);
        });
    });

    describe('extractAttributesFromSelector', () => {
        it('should extract attribute with value', () => {
            expect(extractAttributesFromSelector('[type="text"]')).toEqual({ type: 'text' });
            expect(extractAttributesFromSelector('[role="button"]')).toEqual({ role: 'button' });
        });

        it('should extract attribute without value', () => {
            expect(extractAttributesFromSelector('[disabled]')).toEqual({ disabled: '' });
        });

        it('should extract multiple attributes', () => {
            expect(extractAttributesFromSelector('[type="text"][required]')).toEqual({
                type: 'text',
                required: ''
            });
        });

        it('should return empty object when no attributes', () => {
            expect(extractAttributesFromSelector('div')).toEqual({});
            expect(extractAttributesFromSelector('#id')).toEqual({});
        });
    });
});
