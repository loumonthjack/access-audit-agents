/**
 * Safety Validator for Fix Instructions
 * 
 * Validates fix instructions against safety rules to prevent destructive changes.
 * Requirements: 5.1, 5.2, 5.3
 */

import type { FixInstruction, InjectorError } from '../types/index.js';
import { FixInstructionSchema } from '../types/index.js';

// ============================================================================
// Interactive Element Selectors
// Requirements: 5.1 - Never delete interactive elements
// ============================================================================

/**
 * List of interactive element selectors that should never be deleted
 */
export const INTERACTIVE_ELEMENT_SELECTORS = [
    'button',
    'a',
    'input',
    'select',
    'textarea',
    'form'
] as const;

/**
 * Patterns that indicate an element is interactive
 */
export const INTERACTIVE_PATTERNS = [
    /^button$/i,
    /^a$/i,
    /^input$/i,
    /^select$/i,
    /^textarea$/i,
    /^form$/i,
    /button\./i,
    /button\[/i,
    /button#/i,
    /a\./i,
    /a\[/i,
    /a#/i,
    /input\./i,
    /input\[/i,
    /input#/i,
    /select\./i,
    /select\[/i,
    /select#/i,
    /textarea\./i,
    /textarea\[/i,
    /textarea#/i,
    /form\./i,
    /form\[/i,
    /form#/i
] as const;

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// ============================================================================
// Safety Validator Class
// ============================================================================

export class SafetyValidator {
    /**
     * Checks if a selector targets an interactive element
     */
    private isInteractiveSelector(selector: string): boolean {
        const normalizedSelector = selector.toLowerCase().trim();

        // Check if selector starts with an interactive element tag
        for (const tag of INTERACTIVE_ELEMENT_SELECTORS) {
            if (normalizedSelector === tag) {
                return true;
            }
            if (normalizedSelector.startsWith(`${tag}.`) ||
                normalizedSelector.startsWith(`${tag}[`) ||
                normalizedSelector.startsWith(`${tag}#`) ||
                normalizedSelector.startsWith(`${tag} `)) {
                return true;
            }
        }

        // Check against patterns
        for (const pattern of INTERACTIVE_PATTERNS) {
            if (pattern.test(normalizedSelector)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if a fix instruction would be destructive
     * Requirements: 5.1, 5.2
     * 
     * A fix is considered destructive if it would:
     * - Delete an interactive element (button, a, input, select, textarea, form)
     * - Remove essential attributes from interactive elements
     */
    isDestructive(instruction: FixInstruction): boolean {
        const { type, selector, params } = instruction;

        // Check if targeting an interactive element
        const isInteractive = this.isInteractiveSelector(selector);

        if (!isInteractive) {
            return false;
        }

        // For attribute fixes, check if removing critical attributes
        if (type === 'attribute') {
            const attrParams = params as { attribute: string; value: string };
            const criticalAttributes = ['href', 'type', 'name', 'action', 'method'];

            // Removing (setting to empty) critical attributes on interactive elements is destructive
            if (criticalAttributes.includes(attrParams.attribute.toLowerCase()) &&
                attrParams.value === '') {
                return true;
            }
        }

        // For content fixes, check if clearing content of interactive elements
        if (type === 'content') {
            const contentParams = params as { innerText: string };
            // Clearing the text content of a button or link makes it unusable
            if (contentParams.innerText.trim() === '') {
                return true;
            }
        }

        return false;
    }

    /**
     * Validates a fix instruction against the Zod schema
     * Requirements: 5.3
     */
    validateSchema(instruction: unknown): ValidationResult {
        const result = FixInstructionSchema.safeParse(instruction);

        if (result.success) {
            return {
                valid: true,
                errors: [],
                warnings: []
            };
        }

        const errors = result.error.errors.map(err =>
            `${err.path.join('.')}: ${err.message}`
        );

        return {
            valid: false,
            errors,
            warnings: []
        };
    }

    /**
     * Performs full validation of a fix instruction
     * Requirements: 5.1, 5.2, 5.3
     * 
     * @returns ValidationResult with errors and warnings
     */
    validate(instruction: unknown): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // First, validate against schema
        const schemaResult = this.validateSchema(instruction);
        if (!schemaResult.valid) {
            return schemaResult;
        }

        // Now we know it's a valid FixInstruction
        const validInstruction = instruction as FixInstruction;

        // Check for destructive changes
        if (this.isDestructive(validInstruction)) {
            errors.push(
                `Destructive change detected: Fix would modify interactive element "${validInstruction.selector}" in a way that could break functionality`
            );
        }

        // Add warnings for potentially risky operations
        if (this.isInteractiveSelector(validInstruction.selector)) {
            warnings.push(
                `Modifying interactive element "${validInstruction.selector}" - verify functionality after fix`
            );
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Creates an InjectorError for destructive change detection
     */
    createDestructiveChangeError(instruction: FixInstruction): InjectorError {
        return {
            code: 'DESTRUCTIVE_CHANGE',
            message: `Fix would delete or break interactive element: ${instruction.selector}`,
            selector: instruction.selector,
            details: {
                fixType: instruction.type,
                violationId: instruction.violationId
            }
        };
    }

    /**
     * Creates an InjectorError for validation failure
     */
    createValidationFailedError(selector: string, errors: string[]): InjectorError {
        return {
            code: 'VALIDATION_FAILED',
            message: `Fix instruction validation failed: ${errors.join('; ')}`,
            selector,
            details: {
                validationErrors: errors
            }
        };
    }
}

/**
 * Singleton instance for convenience
 */
export const safetyValidator = new SafetyValidator();
