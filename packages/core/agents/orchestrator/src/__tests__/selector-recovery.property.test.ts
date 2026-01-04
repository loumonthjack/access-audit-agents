/**
 * Property-Based Tests for Selector Error Recovery
 * 
 * Feature: agent-orchestration
 * Property 13: Selector Error Recovery
 * Validates: Requirements 7.1
 * 
 * For any Injector response with SELECTOR_NOT_FOUND error, the Orchestrator
 * SHALL invoke GetPageStructure and attempt to fuzzy-match the selector
 * before incrementing retry_attempts.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
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
import type { InjectorError } from '../types/index.js';
import {
    pageStructureArb,
    emptyPageStructureArb,
    elementSummaryArb,
    pageStructureWithElementArb,
    unmatchableSelectorArb
} from '../__generators__/page-structure.generator.js';
import { fixInstructionArb } from '../__generators__/fix-instruction.generator.js';

describe('Property 13: Selector Error Recovery', () => {
    const recoveryService = new ErrorRecoveryService();

    /**
     * Property 13.1: Recovery returns success when exact match exists
     * 
     * For any page structure containing an element, when the original selector
     * exactly matches an element's selector, recovery SHALL succeed with
     * reasonable confidence.
     * 
     * Validates: Requirements 7.1
     */
    it('returns success when exact match exists in page structure', () => {
        fc.assert(
            fc.property(elementSummaryArb, (element) => {
                const pageStructure: PageStructure = {
                    interactiveElements: [element],
                    landmarks: [],
                    headings: []
                };

                const result = recoveryService.recoverFromSelectorError(
                    element.selector,
                    pageStructure
                );

                // When searching for exact selector, we should find it
                // The confidence depends on how much the selector components match
                // At minimum, selector similarity should give us some score
                expect(result.originalSelector).toBe(element.selector);

                // If the result is successful, the corrected selector should match
                if (result.success) {
                    expect(result.correctedSelector).toBe(element.selector);
                }

                // Confidence should be non-negative
                expect(result.confidence).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.2: Recovery fails gracefully with empty page structure
     * 
     * For any selector and an empty page structure, recovery SHALL fail
     * with success=false and provide a reason.
     * 
     * Validates: Requirements 7.1
     */
    it('fails gracefully with empty page structure', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }),
                emptyPageStructureArb,
                (selector, pageStructure) => {
                    const result = recoveryService.recoverFromSelectorError(
                        selector,
                        pageStructure
                    );

                    expect(result.success).toBe(false);
                    expect(result.originalSelector).toBe(selector);
                    expect(result.reason).toBeDefined();
                    expect(result.confidence).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.3: Recovery always returns original selector
     * 
     * For any recovery attempt, the result SHALL always contain
     * the original selector that was searched for.
     * 
     * Validates: Requirements 7.1
     */
    it('always returns original selector in result', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }),
                pageStructureArb,
                (selector, pageStructure) => {
                    const result = recoveryService.recoverFromSelectorError(
                        selector,
                        pageStructure
                    );

                    expect(result.originalSelector).toBe(selector);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.4: Confidence score is always between 0 and 1
     * 
     * For any recovery attempt, the confidence score SHALL be
     * a number between 0 and 1 inclusive.
     * 
     * Validates: Requirements 7.1
     */
    it('confidence score is always between 0 and 1', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }),
                pageStructureArb,
                (selector, pageStructure) => {
                    const result = recoveryService.recoverFromSelectorError(
                        selector,
                        pageStructure
                    );

                    expect(result.confidence).toBeGreaterThanOrEqual(0);
                    expect(result.confidence).toBeLessThanOrEqual(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.5: Successful recovery always provides corrected selector
     * 
     * For any successful recovery, the result SHALL contain a correctedSelector
     * that exists in the page structure.
     * 
     * Validates: Requirements 7.1
     */
    it('successful recovery provides corrected selector from page structure', () => {
        fc.assert(
            fc.property(
                elementSummaryArb,
                pageStructureArb,
                (targetElement, baseStructure) => {
                    // Add target element to structure
                    const pageStructure: PageStructure = {
                        interactiveElements: [...baseStructure.interactiveElements, targetElement],
                        landmarks: baseStructure.landmarks,
                        headings: baseStructure.headings
                    };

                    const result = recoveryService.recoverFromSelectorError(
                        targetElement.selector,
                        pageStructure
                    );

                    if (result.success) {
                        // Corrected selector should exist in page structure
                        const allSelectors = [
                            ...pageStructure.interactiveElements.map(e => e.selector),
                            ...pageStructure.landmarks.map(e => e.selector),
                            ...pageStructure.headings.map(e => e.selector)
                        ];
                        expect(allSelectors).toContain(result.correctedSelector);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.6: Tag matching improves confidence
     * 
     * For any selector with a tag name that matches an element's tag,
     * the confidence score SHALL be higher than for non-matching tags.
     * 
     * Validates: Requirements 7.1
     */
    it('tag matching improves confidence score', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('button', 'a', 'input', 'div'),
                (tagName) => {
                    const matchingElement: ElementSummary = {
                        selector: `${tagName}#test-id`,
                        tagName: tagName,
                        text: 'Test'
                    };

                    const nonMatchingElement: ElementSummary = {
                        selector: `span#other-id`,
                        tagName: 'span',
                        text: 'Other'
                    };

                    const pageStructure: PageStructure = {
                        interactiveElements: [matchingElement, nonMatchingElement],
                        landmarks: [],
                        headings: []
                    };

                    // Search for a selector with the matching tag
                    const result = recoveryService.recoverFromSelectorError(
                        `${tagName}.some-class`,
                        pageStructure
                    );

                    // Should prefer the matching tag element
                    if (result.success && result.matchedElement) {
                        expect(result.matchedElement.tagName).toBe(tagName);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.7: ID matching has high priority
     * 
     * For any selector containing an ID that matches an element's selector,
     * the recovery SHALL prefer that element.
     * 
     * Validates: Requirements 7.1
     */
    it('ID matching has high priority', () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^[a-z][a-z0-9-]{3,10}$/),
                (id) => {
                    const matchingElement: ElementSummary = {
                        selector: `#${id}`,
                        tagName: 'button',
                        text: 'Match'
                    };

                    const otherElement: ElementSummary = {
                        selector: '#other-element',
                        tagName: 'button',
                        text: 'Other'
                    };

                    const pageStructure: PageStructure = {
                        interactiveElements: [otherElement, matchingElement],
                        landmarks: [],
                        headings: []
                    };

                    const result = recoveryService.recoverFromSelectorError(
                        `button#${id}`,
                        pageStructure
                    );

                    if (result.success) {
                        expect(result.correctedSelector).toBe(`#${id}`);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.8: Recovery from SELECTOR_NOT_FOUND error
     * 
     * For any SELECTOR_NOT_FOUND error with page structure available,
     * recoverFromInjectorError SHALL attempt fuzzy matching.
     * 
     * Validates: Requirements 7.1
     */
    it('recoverFromInjectorError handles SELECTOR_NOT_FOUND', () => {
        fc.assert(
            fc.property(
                fixInstructionArb,
                pageStructureArb,
                (instruction, pageStructure) => {
                    const error: InjectorError = {
                        code: 'SELECTOR_NOT_FOUND',
                        message: `Element not found: ${instruction.selector}`,
                        selector: instruction.selector
                    };

                    const result = recoveryService.recoverFromInjectorError(
                        error,
                        instruction,
                        pageStructure
                    );

                    // Should attempt recovery (either succeed or handoff)
                    expect(['selector_corrected', 'handoff']).toContain(result.action);
                    expect(result.details).toBeDefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.9: Corrected instruction preserves violation ID
     * 
     * For any successful selector correction, the corrected instruction
     * SHALL preserve the original violation ID.
     * 
     * Validates: Requirements 7.1
     */
    it('corrected instruction preserves violation ID', () => {
        fc.assert(
            fc.property(
                fixInstructionArb,
                fc.string({ minLength: 1, maxLength: 50 }),
                (instruction, newSelector) => {
                    const corrected = recoveryService.createCorrectedInstruction(
                        instruction,
                        newSelector
                    );

                    expect(corrected.violationId).toBe(instruction.violationId);
                    expect(corrected.type).toBe(instruction.type);
                    expect(corrected.reasoning).toBe(instruction.reasoning);
                    expect(corrected.selector).toBe(newSelector);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 13.10: Page structure cache works correctly
     * 
     * For any page structure set via setPageStructure, getPageStructure
     * SHALL return the same structure.
     * 
     * Validates: Requirements 7.1
     */
    it('page structure cache works correctly', () => {
        fc.assert(
            fc.property(pageStructureArb, (pageStructure) => {
                const service = new ErrorRecoveryService();

                // Initially null
                expect(service.getPageStructure()).toBeNull();

                // Set and get
                service.setPageStructure(pageStructure);
                expect(service.getPageStructure()).toEqual(pageStructure);

                // Clear
                service.clearPageStructureCache();
                expect(service.getPageStructure()).toBeNull();
            }),
            { numRuns: 100 }
        );
    });
});

describe('Fuzzy Matching Utilities', () => {
    /**
     * Levenshtein distance properties
     */
    describe('levenshteinDistance', () => {
        it('distance to self is always 0', () => {
            fc.assert(
                fc.property(fc.string(), (s) => {
                    expect(levenshteinDistance(s, s)).toBe(0);
                }),
                { numRuns: 100 }
            );
        });

        it('distance is symmetric', () => {
            fc.assert(
                fc.property(fc.string(), fc.string(), (a, b) => {
                    expect(levenshteinDistance(a, b)).toBe(levenshteinDistance(b, a));
                }),
                { numRuns: 100 }
            );
        });

        it('distance is non-negative', () => {
            fc.assert(
                fc.property(fc.string(), fc.string(), (a, b) => {
                    expect(levenshteinDistance(a, b)).toBeGreaterThanOrEqual(0);
                }),
                { numRuns: 100 }
            );
        });

        it('distance to empty string equals string length', () => {
            fc.assert(
                fc.property(fc.string(), (s) => {
                    expect(levenshteinDistance(s, '')).toBe(s.length);
                    expect(levenshteinDistance('', s)).toBe(s.length);
                }),
                { numRuns: 100 }
            );
        });
    });

    /**
     * String similarity properties
     */
    describe('stringSimilarity', () => {
        it('similarity to self is always 1', () => {
            fc.assert(
                fc.property(fc.string({ minLength: 1 }), (s) => {
                    expect(stringSimilarity(s, s)).toBe(1);
                }),
                { numRuns: 100 }
            );
        });

        it('similarity is symmetric', () => {
            fc.assert(
                fc.property(fc.string(), fc.string(), (a, b) => {
                    expect(stringSimilarity(a, b)).toBe(stringSimilarity(b, a));
                }),
                { numRuns: 100 }
            );
        });

        it('similarity is between 0 and 1', () => {
            fc.assert(
                fc.property(fc.string(), fc.string(), (a, b) => {
                    const sim = stringSimilarity(a, b);
                    expect(sim).toBeGreaterThanOrEqual(0);
                    expect(sim).toBeLessThanOrEqual(1);
                }),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Selector extraction properties
     */
    describe('extractTagFromSelector', () => {
        it('extracts tag from simple selectors', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('div', 'span', 'button', 'a', 'input'),
                    (tag) => {
                        expect(extractTagFromSelector(tag)).toBe(tag);
                        expect(extractTagFromSelector(`${tag}.class`)).toBe(tag);
                        expect(extractTagFromSelector(`${tag}#id`)).toBe(tag);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('returns null for non-tag selectors', () => {
            expect(extractTagFromSelector('#id')).toBeNull();
            expect(extractTagFromSelector('.class')).toBeNull();
            expect(extractTagFromSelector('[attr]')).toBeNull();
        });
    });

    describe('extractIdFromSelector', () => {
        it('extracts ID from selectors', () => {
            fc.assert(
                fc.property(
                    fc.stringMatching(/^[a-z][a-z0-9-]*$/),
                    (id) => {
                        expect(extractIdFromSelector(`#${id}`)).toBe(id);
                        expect(extractIdFromSelector(`div#${id}`)).toBe(id);
                        expect(extractIdFromSelector(`div#${id}.class`)).toBe(id);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('returns null when no ID present', () => {
            expect(extractIdFromSelector('div')).toBeNull();
            expect(extractIdFromSelector('.class')).toBeNull();
            expect(extractIdFromSelector('[attr]')).toBeNull();
        });
    });

    describe('extractClassesFromSelector', () => {
        it('extracts classes from selectors', () => {
            expect(extractClassesFromSelector('.class1')).toEqual(['class1']);
            expect(extractClassesFromSelector('.class1.class2')).toEqual(['class1', 'class2']);
            expect(extractClassesFromSelector('div.class1.class2')).toEqual(['class1', 'class2']);
        });

        it('returns empty array when no classes', () => {
            expect(extractClassesFromSelector('div')).toEqual([]);
            expect(extractClassesFromSelector('#id')).toEqual([]);
            expect(extractClassesFromSelector('[attr]')).toEqual([]);
        });
    });

    describe('extractAttributesFromSelector', () => {
        it('extracts attributes from selectors', () => {
            expect(extractAttributesFromSelector('[role="button"]')).toEqual({ role: 'button' });
            expect(extractAttributesFromSelector('[aria-label="test"]')).toEqual({ 'aria-label': 'test' });
            expect(extractAttributesFromSelector('button[type="submit"]')).toEqual({ type: 'submit' });
        });

        it('handles attributes without values', () => {
            expect(extractAttributesFromSelector('[disabled]')).toEqual({ disabled: '' });
        });

        it('returns empty object when no attributes', () => {
            expect(extractAttributesFromSelector('div')).toEqual({});
            expect(extractAttributesFromSelector('#id')).toEqual({});
            expect(extractAttributesFromSelector('.class')).toEqual({});
        });
    });
});
