/**
 * Property-Based Tests for Specialist Routing
 * 
 * Feature: agent-orchestration
 * Property 12: Specialist Routing by Violation Type
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 * 
 * For any violation, the Planner SHALL route to the appropriate specialist:
 * - ruleId containing "image-alt" or "img-alt" → AltTextSpecialist
 * - ruleId containing "focus", "keyboard", or "tabindex" → NavigationSpecialist
 * - ruleId containing "contrast" → ContrastSpecialist
 * - All other ruleIds → Generic ARIA handler
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpecialistRouter } from '../services/specialists/specialist-router.js';
import { AltTextSpecialist } from '../services/specialists/alt-text-specialist.js';
import { NavigationSpecialist } from '../services/specialists/navigation-specialist.js';
import { ContrastSpecialist } from '../services/specialists/contrast-specialist.js';
import {
    altTextViolationArb,
    navigationViolationArb,
    contrastViolationArb,
    genericViolationArb,
    violationArb,
    minimalPageContextArb
} from '../__generators__/violation.generator.js';

describe('Property 12: Specialist Routing by Violation Type', () => {
    const router = new SpecialistRouter();

    /**
     * Property 12.1: Alt-text violations route to AltTextSpecialist
     * 
     * For any violation with ruleId containing "image-alt" or "img-alt",
     * the router SHALL return AltTextSpecialist.
     * 
     * Validates: Requirements 6.1
     */
    it('routes image-alt violations to AltTextSpecialist', () => {
        fc.assert(
            fc.property(altTextViolationArb, (violation) => {
                const specialist = router.route(violation);
                expect(specialist.name).toBe('AltTextSpecialist');
                expect(specialist).toBeInstanceOf(AltTextSpecialist);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 12.2: Navigation violations route to NavigationSpecialist
     * 
     * For any violation with ruleId containing "focus", "keyboard", "tabindex",
     * "skip-link", "bypass", "link-name", or "button-name",
     * the router SHALL return NavigationSpecialist.
     * 
     * Validates: Requirements 6.2
     */
    it('routes navigation violations to NavigationSpecialist', () => {
        fc.assert(
            fc.property(navigationViolationArb, (violation) => {
                const specialist = router.route(violation);
                expect(specialist.name).toBe('NavigationSpecialist');
                expect(specialist).toBeInstanceOf(NavigationSpecialist);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 12.3: Contrast violations route to ContrastSpecialist
     * 
     * For any violation with ruleId containing "contrast",
     * the router SHALL return ContrastSpecialist.
     * 
     * Validates: Requirements 6.3
     */
    it('routes contrast violations to ContrastSpecialist', () => {
        fc.assert(
            fc.property(contrastViolationArb, (violation) => {
                const specialist = router.route(violation);
                expect(specialist.name).toBe('ContrastSpecialist');
                expect(specialist).toBeInstanceOf(ContrastSpecialist);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 12.4: Unmatched violations route to GenericAriaHandler
     * 
     * For any violation with ruleId not matching any specialist pattern,
     * the router SHALL return GenericAriaHandler.
     * 
     * Validates: Requirements 6.4
     */
    it('routes unmatched violations to GenericAriaHandler', () => {
        fc.assert(
            fc.property(genericViolationArb, (violation) => {
                const specialist = router.route(violation);
                expect(specialist.name).toBe('GenericAriaHandler');
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 12.5: All violations get routed to some specialist
     * 
     * For any violation, the router SHALL always return a valid specialist
     * (never null or undefined).
     * 
     * Validates: Requirements 6.1, 6.2, 6.3, 6.4
     */
    it('always routes to a valid specialist', () => {
        fc.assert(
            fc.property(violationArb, (violation) => {
                const specialist = router.route(violation);
                expect(specialist).toBeDefined();
                expect(specialist.name).toBeTruthy();
                expect(typeof specialist.canHandle).toBe('function');
                expect(typeof specialist.planFix).toBe('function');
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 12.6: Routed specialist can handle the violation
     * 
     * For any violation, the specialist returned by route() SHALL
     * return true for canHandle(violation).
     * 
     * Validates: Requirements 6.1, 6.2, 6.3, 6.4
     */
    it('routed specialist can handle the violation', () => {
        fc.assert(
            fc.property(violationArb, (violation) => {
                const specialist = router.route(violation);
                expect(specialist.canHandle(violation)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 12.7: planFix returns valid FixInstruction
     * 
     * For any violation and context, planFix SHALL return a FixInstruction
     * with all required fields populated.
     * 
     * Validates: Requirements 6.1, 6.2, 6.3, 6.4
     */
    it('planFix returns valid FixInstruction', async () => {
        await fc.assert(
            fc.asyncProperty(violationArb, minimalPageContextArb, async (violation, context) => {
                const fixInstruction = await router.planFix(violation, context);

                // Verify required fields
                expect(fixInstruction.type).toMatch(/^(attribute|content|style)$/);
                expect(fixInstruction.selector).toBeTruthy();
                expect(fixInstruction.violationId).toBe(violation.id);
                expect(fixInstruction.reasoning).toBeTruthy();
                expect(fixInstruction.params).toBeDefined();
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 12.8: Specialist routing is deterministic
     * 
     * For any violation, routing the same violation multiple times
     * SHALL always return the same specialist.
     * 
     * Validates: Requirements 6.1, 6.2, 6.3, 6.4
     */
    it('routing is deterministic', () => {
        fc.assert(
            fc.property(violationArb, (violation) => {
                const specialist1 = router.route(violation);
                const specialist2 = router.route(violation);
                const specialist3 = router.route(violation);

                expect(specialist1.name).toBe(specialist2.name);
                expect(specialist2.name).toBe(specialist3.name);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 12.9: getSpecialistName matches routed specialist
     * 
     * For any violation, getSpecialistName SHALL return the same name
     * as the routed specialist's name property.
     * 
     * Validates: Requirements 6.1, 6.2, 6.3, 6.4
     */
    it('getSpecialistName matches routed specialist', () => {
        fc.assert(
            fc.property(violationArb, (violation) => {
                const specialist = router.route(violation);
                const name = router.getSpecialistName(violation);

                expect(name).toBe(specialist.name);
            }),
            { numRuns: 100 }
        );
    });
});
