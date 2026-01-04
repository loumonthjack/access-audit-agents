/**
 * SpecialistRouter
 * 
 * Routes violations to the appropriate specialist agent based on ruleId.
 * Falls back to a generic ARIA handler when no specialist matches.
 * 
 * Requirements: 6.4
 */

import type { FixInstruction, AttributeFixParams } from '../../types/index.js';
import {
    type SpecialistAgent,
    type Violation,
    type PageContext,
    BaseSpecialist
} from './specialist-agent.js';
import { AltTextSpecialist } from './alt-text-specialist.js';
import { NavigationSpecialist } from './navigation-specialist.js';
import { ContrastSpecialist } from './contrast-specialist.js';
import { FocusSpecialist } from './focus-specialist.js';
import { InteractionSpecialist } from './interaction-specialist.js';

// ============================================================================
// Generic ARIA Handler
// ============================================================================

/**
 * Generic specialist that handles violations not covered by domain specialists.
 * Applies generic ARIA attribute fixes.
 */
class GenericAriaHandler extends BaseSpecialist {
    readonly name = 'GenericAriaHandler';

    // This handler accepts all violations as a fallback
    protected readonly handledRulePatterns: RegExp[] = [/.*/];

    // Override canHandle to always return true (fallback handler)
    canHandle(_violation: Violation): boolean {
        return true;
    }

    async planFix(violation: Violation, _context: PageContext): Promise<FixInstruction> {
        const fix = this.determineGenericFix(violation);

        const params: AttributeFixParams = {
            selector: violation.selector,
            attribute: fix.attribute,
            value: fix.value,
            reasoning: this.generateReasoning(violation, fix)
        };

        return {
            type: 'attribute',
            selector: violation.selector,
            violationId: violation.id,
            reasoning: params.reasoning,
            params
        };
    }

    /**
     * Determines the most appropriate generic ARIA fix.
     */
    private determineGenericFix(violation: Violation): { attribute: string; value: string } {
        const ruleId = violation.ruleId.toLowerCase();

        // Label-related violations
        if (ruleId.includes('label') || ruleId.includes('name')) {
            const label = this.extractLabel(violation);
            return { attribute: 'aria-label', value: label };
        }

        // Role-related violations
        if (ruleId.includes('role') || ruleId.includes('landmark')) {
            const role = this.inferRole(violation);
            return { attribute: 'role', value: role };
        }

        // State-related violations
        if (ruleId.includes('aria-') && ruleId.includes('state')) {
            return this.handleStateViolation(violation);
        }

        // Hidden/visible violations
        if (ruleId.includes('hidden') || ruleId.includes('visible')) {
            return { attribute: 'aria-hidden', value: 'false' };
        }

        // Required field violations
        if (ruleId.includes('required')) {
            return { attribute: 'aria-required', value: 'true' };
        }

        // Invalid state violations
        if (ruleId.includes('invalid') || ruleId.includes('error')) {
            return { attribute: 'aria-invalid', value: 'true' };
        }

        // Expanded/collapsed violations
        if (ruleId.includes('expand')) {
            return { attribute: 'aria-expanded', value: 'false' };
        }

        // Default: add descriptive label
        return { attribute: 'aria-label', value: this.extractLabel(violation) };
    }

    /**
     * Extracts a meaningful label from the violation.
     */
    private extractLabel(violation: Violation): string {
        // Try to extract from help text
        if (violation.help) {
            const helpLabel = violation.help.replace(/^ensure\s+/i, '').trim();
            if (helpLabel.length <= 50) {
                return helpLabel;
            }
        }

        // Try to extract from HTML content
        const textMatch = violation.html.match(/>([^<]+)</);
        if (textMatch?.[1]?.trim()) {
            const text = textMatch[1].trim();
            if (text.length <= 50) {
                return text;
            }
        }

        // Fallback based on element type
        const html = violation.html.toLowerCase();
        if (html.includes('<button')) return 'Button';
        if (html.includes('<a ')) return 'Link';
        if (html.includes('<input')) return 'Input field';
        if (html.includes('<select')) return 'Selection';
        if (html.includes('<nav')) return 'Navigation';
        if (html.includes('<main')) return 'Main content';
        if (html.includes('<aside')) return 'Sidebar';
        if (html.includes('<footer')) return 'Footer';
        if (html.includes('<header')) return 'Header';

        return 'Interactive element';
    }

    /**
     * Infers the appropriate role for an element.
     */
    private inferRole(violation: Violation): string {
        const html = violation.html.toLowerCase();

        // Navigation elements
        if (html.includes('<nav') || html.includes('navigation')) return 'navigation';
        if (html.includes('<main')) return 'main';
        if (html.includes('<aside')) return 'complementary';
        if (html.includes('<footer')) return 'contentinfo';
        if (html.includes('<header')) return 'banner';
        if (html.includes('<form')) return 'form';
        if (html.includes('<search')) return 'search';

        // Interactive elements
        if (html.includes('onclick') || html.includes('click')) return 'button';
        if (html.includes('menu')) return 'menu';
        if (html.includes('tab')) return 'tab';
        if (html.includes('dialog') || html.includes('modal')) return 'dialog';
        if (html.includes('alert')) return 'alert';

        // Content elements
        if (html.includes('list')) return 'list';
        if (html.includes('table')) return 'table';
        if (html.includes('img') || html.includes('image')) return 'img';

        return 'region';
    }

    /**
     * Handles ARIA state violations.
     */
    private handleStateViolation(violation: Violation): { attribute: string; value: string } {
        const ruleId = violation.ruleId.toLowerCase();

        if (ruleId.includes('pressed')) return { attribute: 'aria-pressed', value: 'false' };
        if (ruleId.includes('checked')) return { attribute: 'aria-checked', value: 'false' };
        if (ruleId.includes('selected')) return { attribute: 'aria-selected', value: 'false' };
        if (ruleId.includes('expanded')) return { attribute: 'aria-expanded', value: 'false' };
        if (ruleId.includes('disabled')) return { attribute: 'aria-disabled', value: 'false' };

        return { attribute: 'aria-label', value: this.extractLabel(violation) };
    }

    /**
     * Generates reasoning for the fix.
     */
    private generateReasoning(
        violation: Violation,
        fix: { attribute: string; value: string }
    ): string {
        return `Applying generic ARIA fix: ${fix.attribute}="${fix.value}". ` +
            `This addresses the accessibility issue by providing semantic information ` +
            `to assistive technologies. Rule: ${violation.ruleId}`;
    }
}

// ============================================================================
// SpecialistRouter Implementation
// ============================================================================

export class SpecialistRouter {
    private readonly specialists: SpecialistAgent[];
    private readonly genericHandler: GenericAriaHandler;

    constructor() {
        // Initialize specialists in priority order
        // WCAG 2.2 specialists added for new criteria
        this.specialists = [
            new AltTextSpecialist(),
            new NavigationSpecialist(),
            new ContrastSpecialist(),
            new FocusSpecialist(),        // WCAG 2.2: 2.4.11, 2.4.12, 2.4.13
            new InteractionSpecialist()   // WCAG 2.2: 2.5.7, 2.5.8
        ];
        this.genericHandler = new GenericAriaHandler();
    }

    /**
     * Routes a violation to the appropriate specialist.
     * 
     * @param violation - The violation to route
     * @returns The specialist that can handle this violation
     */
    route(violation: Violation): SpecialistAgent {
        // Find the first specialist that can handle this violation
        for (const specialist of this.specialists) {
            if (specialist.canHandle(violation)) {
                return specialist;
            }
        }

        // Fall back to generic ARIA handler
        return this.genericHandler;
    }

    /**
     * Plans a fix for a violation by routing to the appropriate specialist.
     * 
     * @param violation - The violation to fix
     * @param context - Page context for the fix
     * @returns The fix instruction from the appropriate specialist
     */
    async planFix(violation: Violation, context: PageContext): Promise<FixInstruction> {
        const specialist = this.route(violation);
        return specialist.planFix(violation, context);
    }

    /**
     * Gets the name of the specialist that would handle a violation.
     * Useful for logging and debugging.
     * 
     * @param violation - The violation to check
     * @returns The name of the specialist
     */
    getSpecialistName(violation: Violation): string {
        return this.route(violation).name;
    }

    /**
     * Gets all registered specialists.
     */
    getSpecialists(): readonly SpecialistAgent[] {
        return [...this.specialists, this.genericHandler];
    }
}

// Export the generic handler for testing
export { GenericAriaHandler };
