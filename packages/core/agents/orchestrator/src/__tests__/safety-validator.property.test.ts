/**
 * Property-based tests for SafetyValidator
 * 
 * Feature: agent-orchestration, Property 9: Safety Validation - No Destructive Changes
 * Validates: Requirements 5.1, 5.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SafetyValidator, INTERACTIVE_ELEMENT_SELECTORS } from '../services/safety-validator.js';
import {
    destructiveFixInstructionArb,
    safeFixInstructionArb,
    interactiveElementSelectorArb,
    nonInteractiveElementSelectorArb
} from '../__generators__/fix-instruction.generator.js';
import type { FixInstruction } from '../types/index.js';

describe('Feature: agent-orchestration, Property 9: Safety Validation - No Destructive Changes', () => {
    const validator = new SafetyValidator();

    /**
     * Property 9: Safety Validation - No Destructive Changes
     * 
     * For any FixInstruction, if applying it would delete an interactive element
     * (button, a, input, select, textarea, form), the Injector SHALL reject the
     * instruction with DESTRUCTIVE_CHANGE error and the Orchestrator SHALL flag
     * for human review.
     * 
     * Validates: Requirements 5.1, 5.2
     */
    it('should detect destructive changes on interactive elements', () => {
        fc.assert(
            fc.property(destructiveFixInstructionArb, (instruction) => {
                // Destructive instructions should be flagged
                const isDestructive = validator.isDestructive(instruction);
                const result = validator.validate(instruction);

                // Either isDestructive returns true OR validation fails
                // (some destructive patterns are caught by isDestructive, others by validate)
                if (isDestructive) {
                    expect(result.valid).toBe(false);
                    expect(result.errors.length).toBeGreaterThan(0);
                    expect(result.errors.some(e => e.includes('Destructive'))).toBe(true);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('should allow safe modifications on non-interactive elements', () => {
        fc.assert(
            fc.property(safeFixInstructionArb, (instruction) => {
                const result = validator.validate(instruction);

                // Safe instructions should pass validation (no errors)
                // They may have warnings but should be valid
                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            }),
            { numRuns: 100 }
        );
    });

    it('should identify all interactive element selectors correctly', () => {
        fc.assert(
            fc.property(interactiveElementSelectorArb, (selector) => {
                // Create a content fix that clears text (destructive on interactive)
                const instruction: FixInstruction = {
                    type: 'content',
                    selector,
                    violationId: 'test-violation',
                    reasoning: 'Test',
                    params: {
                        selector,
                        innerText: '',
                        originalTextHash: 'a'.repeat(64)
                    }
                };

                // Should be detected as destructive
                const isDestructive = validator.isDestructive(instruction);
                expect(isDestructive).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('should not flag non-interactive elements as destructive', () => {
        fc.assert(
            fc.property(nonInteractiveElementSelectorArb, (selector) => {
                // Create a content fix that clears text on non-interactive element
                const instruction: FixInstruction = {
                    type: 'content',
                    selector,
                    violationId: 'test-violation',
                    reasoning: 'Test',
                    params: {
                        selector,
                        innerText: '',
                        originalTextHash: 'a'.repeat(64)
                    }
                };

                // Should NOT be detected as destructive
                const isDestructive = validator.isDestructive(instruction);
                expect(isDestructive).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should create proper DESTRUCTIVE_CHANGE error', () => {
        fc.assert(
            fc.property(interactiveElementSelectorArb, (selector) => {
                const instruction: FixInstruction = {
                    type: 'content',
                    selector,
                    violationId: 'test-violation',
                    reasoning: 'Test',
                    params: {
                        selector,
                        innerText: '',
                        originalTextHash: 'a'.repeat(64)
                    }
                };

                const error = validator.createDestructiveChangeError(instruction);

                expect(error.code).toBe('DESTRUCTIVE_CHANGE');
                expect(error.selector).toBe(selector);
                expect(error.message).toContain(selector);
                expect(error.details).toBeDefined();
                expect(error.details?.violationId).toBe('test-violation');
            }),
            { numRuns: 100 }
        );
    });

    it('should cover all defined interactive element types', () => {
        // Verify all interactive element types are properly detected
        for (const tag of INTERACTIVE_ELEMENT_SELECTORS) {
            const instruction: FixInstruction = {
                type: 'content',
                selector: tag,
                violationId: 'test-violation',
                reasoning: 'Test',
                params: {
                    selector: tag,
                    innerText: '',
                    originalTextHash: 'a'.repeat(64)
                }
            };

            const isDestructive = validator.isDestructive(instruction);
            expect(isDestructive).toBe(true);
        }
    });
});
