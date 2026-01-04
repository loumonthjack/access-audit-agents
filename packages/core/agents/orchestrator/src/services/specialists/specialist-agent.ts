/**
 * SpecialistAgent Interface
 * 
 * Defines the contract for domain-specific agents that handle particular
 * types of accessibility violations. Each specialist implements canHandle()
 * to determine if it can process a violation, and planFix() to generate
 * the appropriate fix instruction.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { z } from 'zod';
import type { FixInstruction } from '../../types/index.js';

// ============================================================================
// Violation Schema (simplified for specialist routing)
// ============================================================================

export const ViolationSchema = z.object({
    id: z.string(),
    ruleId: z.string(),
    impact: z.enum(['critical', 'serious', 'moderate', 'minor']),
    selector: z.string(),
    html: z.string(),
    description: z.string(),
    help: z.string()
});

export type Violation = z.infer<typeof ViolationSchema>;

// ============================================================================
// Page Context Schema
// ============================================================================

export const PageContextSchema = z.object({
    url: z.string(),
    title: z.string().optional(),
    surroundingText: z.string().optional(),
    parentElement: z.string().optional(),
    siblingElements: z.array(z.string()).optional(),
    imageSrc: z.string().optional(),
    imageFilename: z.string().optional(),
    currentColors: z.object({
        foreground: z.string(),
        background: z.string()
    }).optional()
});

export type PageContext = z.infer<typeof PageContextSchema>;

// ============================================================================
// SpecialistAgent Interface
// ============================================================================

/**
 * Interface for domain-specific accessibility fix agents.
 * 
 * Each specialist handles a specific category of violations and generates
 * contextually appropriate fixes.
 */
export interface SpecialistAgent {
    /**
     * The unique name of this specialist
     */
    readonly name: string;

    /**
     * Determines if this specialist can handle the given violation.
     * 
     * @param violation - The accessibility violation to check
     * @returns true if this specialist can handle the violation
     */
    canHandle(violation: Violation): boolean;

    /**
     * Plans a fix for the given violation using the provided context.
     * 
     * @param violation - The accessibility violation to fix
     * @param context - Additional page context to inform the fix
     * @returns A FixInstruction describing how to remediate the violation
     */
    planFix(violation: Violation, context: PageContext): Promise<FixInstruction>;
}

// ============================================================================
// Base Specialist Class
// ============================================================================

/**
 * Abstract base class providing common functionality for specialists.
 */
export abstract class BaseSpecialist implements SpecialistAgent {
    abstract readonly name: string;
    protected abstract readonly handledRulePatterns: RegExp[];

    canHandle(violation: Violation): boolean {
        return this.handledRulePatterns.some(pattern => pattern.test(violation.ruleId));
    }

    abstract planFix(violation: Violation, context: PageContext): Promise<FixInstruction>;

    /**
     * Generates a unique violation ID for tracking
     */
    protected generateFixId(violation: Violation): string {
        return `fix-${violation.id}-${Date.now()}`;
    }
}
