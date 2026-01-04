/**
 * Property-based tests for Fix Instruction Schema Validation
 * 
 * Feature: agent-orchestration, Property 10: Fix Instruction Schema Validation
 * Validates: Requirements 5.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SafetyValidator } from '../services/safety-validator.js';
import {
    fixInstructionArb,
    invalidFixInstructionArb
} from '../__generators__/fix-instruction.generator.js';
import { FixInstructionSchema } from '../types/index.js';

describe('Feature: agent-orchestration, Property 10: Fix Instruction Schema Validation', () => {
    const validator = new SafetyValidator();

    /**
     * Property 10: Fix Instruction Schema Validation
     * 
     * For any FixInstruction passed to the Injector, it SHALL be validated
     * against the Zod schema before execution. Invalid instructions SHALL
     * be rejected with VALIDATION_FAILED error.
     * 
     * Validates: Requirements 5.3
     */
    it('should validate all valid fix instructions against schema', () => {
        fc.assert(
            fc.property(fixInstructionArb, (instruction) => {
                // Valid instructions should pass schema validation
                const result = validator.validateSchema(instruction);

                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            }),
            { numRuns: 100 }
        );
    });

    it('should reject invalid fix instructions with VALIDATION_FAILED', () => {
        fc.assert(
            fc.property(invalidFixInstructionArb, (invalidInstruction) => {
                // Invalid instructions should fail schema validation
                const result = validator.validateSchema(invalidInstruction);

                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            }),
            { numRuns: 100 }
        );
    });

    it('should create proper VALIDATION_FAILED error', () => {
        fc.assert(
            fc.property(invalidFixInstructionArb, (invalidInstruction) => {
                const result = validator.validateSchema(invalidInstruction);

                if (!result.valid) {
                    const error = validator.createValidationFailedError(
                        'test-selector',
                        result.errors
                    );

                    expect(error.code).toBe('VALIDATION_FAILED');
                    expect(error.selector).toBe('test-selector');
                    expect(error.message).toContain('validation failed');
                    expect(error.details).toBeDefined();
                    expect(error.details?.validationErrors).toEqual(result.errors);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('should validate that Zod schema and SafetyValidator agree on valid instructions', () => {
        fc.assert(
            fc.property(fixInstructionArb, (instruction) => {
                // Both Zod schema and SafetyValidator should agree
                const zodResult = FixInstructionSchema.safeParse(instruction);
                const validatorResult = validator.validateSchema(instruction);

                expect(zodResult.success).toBe(validatorResult.valid);
            }),
            { numRuns: 100 }
        );
    });

    it('should validate that Zod schema and SafetyValidator agree on invalid instructions', () => {
        fc.assert(
            fc.property(invalidFixInstructionArb, (invalidInstruction) => {
                // Both Zod schema and SafetyValidator should agree
                const zodResult = FixInstructionSchema.safeParse(invalidInstruction);
                const validatorResult = validator.validateSchema(invalidInstruction);

                expect(zodResult.success).toBe(validatorResult.valid);
            }),
            { numRuns: 100 }
        );
    });

    it('should validate all required fields are present', () => {
        const requiredFields = ['type', 'selector', 'violationId', 'reasoning', 'params'];

        for (const fieldToRemove of requiredFields) {
            fc.assert(
                fc.property(fixInstructionArb, (instruction) => {
                    // Create a copy and remove one required field
                    const incomplete = { ...instruction };
                    delete (incomplete as Record<string, unknown>)[fieldToRemove];

                    const result = validator.validateSchema(incomplete);

                    expect(result.valid).toBe(false);
                    expect(result.errors.length).toBeGreaterThan(0);
                }),
                { numRuns: 10 }
            );
        }
    });

    it('should validate type field has valid enum value', () => {
        const invalidTypes = ['invalid', 'unknown', 'delete', 'remove', '', null, undefined, 123];

        for (const invalidType of invalidTypes) {
            fc.assert(
                fc.property(fixInstructionArb, (instruction) => {
                    const invalidInstruction = {
                        ...instruction,
                        type: invalidType
                    };

                    const result = validator.validateSchema(invalidInstruction);

                    expect(result.valid).toBe(false);
                }),
                { numRuns: 5 }
            );
        }
    });

    it('should validate selector is non-empty string', () => {
        fc.assert(
            fc.property(fixInstructionArb, (instruction) => {
                const invalidInstruction = {
                    ...instruction,
                    selector: ''
                };

                const result = validator.validateSchema(invalidInstruction);

                expect(result.valid).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should validate violationId is non-empty string', () => {
        fc.assert(
            fc.property(fixInstructionArb, (instruction) => {
                const invalidInstruction = {
                    ...instruction,
                    violationId: ''
                };

                const result = validator.validateSchema(invalidInstruction);

                expect(result.valid).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should validate reasoning is non-empty string', () => {
        fc.assert(
            fc.property(fixInstructionArb, (instruction) => {
                const invalidInstruction = {
                    ...instruction,
                    reasoning: ''
                };

                const result = validator.validateSchema(invalidInstruction);

                expect(result.valid).toBe(false);
            }),
            { numRuns: 100 }
        );
    });
});
