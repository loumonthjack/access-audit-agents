/**
 * Focus Specialist Agent
 * 
 * Handles WCAG 2.2 focus-related violations:
 * - Focus Not Obscured (2.4.11)
 * - Focus Not Obscured - Enhanced (2.4.12)
 * - Focus Appearance (2.4.13)
 * 
 * Generates fixes such as:
 * - Adding scroll-margin-top to prevent sticky header overlap
 * - Adjusting z-index values
 * - Modifying sticky/fixed positioning
 * 
 * Requirements: WCAG 2.2 Success Criteria 2.4.11, 2.4.12, 2.4.13
 */

import type { FixInstruction } from '../../types/index.js';
import {
    BaseSpecialist,
    type Violation,
    type PageContext
} from './specialist-agent.js';

// ============================================================================
// Focus Specialist Implementation
// ============================================================================

/**
 * Focus Specialist
 * 
 * Handles focus visibility and appearance violations for WCAG 2.2.
 */
export class FocusSpecialist extends BaseSpecialist {
    readonly name = 'FocusSpecialist';

    protected readonly handledRulePatterns: RegExp[] = [
        /focus-not-obscured/i,
        /focus-obscured/i,
        /focus-visible/i,
        /focus-appearance/i,
        /2\.4\.11/,  // Focus Not Obscured (Minimum)
        /2\.4\.12/,  // Focus Not Obscured (Enhanced)
        /2\.4\.13/   // Focus Appearance
    ];

    /**
     * Plans a fix for focus-related violations
     */
    async planFix(violation: Violation, _context: PageContext): Promise<FixInstruction> {
        const fixId = this.generateFixId(violation);

        // Determine the best fix strategy based on violation type
        const fixStrategy = this.determineFocusFixStrategy(violation);

        return {
            type: fixStrategy.type,
            selector: violation.selector,
            violationId: fixId,
            reasoning: this.generateReasoning(violation, fixStrategy),
            params: fixStrategy.params
        };
    }

    /**
     * Determines the best fix strategy for focus violations
     */
    private determineFocusFixStrategy(violation: Violation): {
        type: 'style' | 'attribute';
        params: FixInstruction['params'];
        description: string;
    } {
        const ruleId = violation.ruleId.toLowerCase();

        // Focus Not Obscured - typically needs scroll-margin or z-index adjustment
        if (ruleId.includes('obscured') || ruleId.includes('2.4.11') || ruleId.includes('2.4.12')) {
            return {
                type: 'style',
                params: {
                    selector: violation.selector,
                    cssClass: 'a11y-focus-visible',
                    styles: {
                        'scroll-margin-top': '80px', // Account for typical sticky header
                        'scroll-margin-bottom': '80px', // Account for sticky footer
                        'position': 'relative',
                        'z-index': '1' // Ensure element is above background
                    }
                },
                description: 'Add scroll-margin to prevent focus being obscured by sticky elements'
            };
        }

        // Focus Appearance - needs visible focus indicator
        if (ruleId.includes('appearance') || ruleId.includes('2.4.13')) {
            return {
                type: 'style',
                params: {
                    selector: violation.selector,
                    cssClass: 'a11y-focus-indicator',
                    styles: {
                        'outline': '2px solid #005fcc',
                        'outline-offset': '2px',
                        'border-radius': '2px'
                    }
                },
                description: 'Add visible focus indicator meeting 2.4.13 requirements'
            };
        }

        // Default: add focus-visible styles
        return {
            type: 'style',
            params: {
                selector: violation.selector,
                cssClass: 'a11y-focus-default',
                styles: {
                    'scroll-margin-top': '80px',
                    'outline': '2px solid currentColor',
                    'outline-offset': '2px'
                }
            },
            description: 'Add default focus visibility improvements'
        };
    }

    /**
     * Generates reasoning for the fix
     */
    private generateReasoning(violation: Violation, fix: { description: string }): string {
        return `WCAG 2.2 Focus Fix: ${fix.description}. ` +
            `This addresses violation "${violation.ruleId}" on element "${violation.selector}". ` +
            `The fix ensures focused elements remain visible when users navigate with keyboard.`;
    }

    /**
     * Calculates confidence score for focus fixes
     * 
     * Focus fixes are generally high-confidence since they're CSS-based
     * and don't affect functionality.
     */
    calculateConfidence(violation: Violation): {
        value: number;
        tier: 'high' | 'medium' | 'low';
        factors: string[];
        requiresHumanReview: boolean;
    } {
        const factors: string[] = [];
        let confidence = 90; // Start high - CSS fixes are safe

        // Check if it's a custom component (lower confidence)
        const isCustomComponent =
            /\[class\*=["']?custom/i.test(violation.selector) ||
            violation.selector.includes('[data-');
        if (isCustomComponent) {
            confidence -= 15;
            factors.push('Custom component detected');
        }

        // Check if z-index might cause stacking issues
        if (violation.description.includes('z-index') ||
            violation.description.includes('stacking')) {
            confidence -= 10;
            factors.push('Z-index modification may affect layout');
        }

        // Determine tier
        let tier: 'high' | 'medium' | 'low';
        if (confidence >= 95) {
            tier = 'high';
        } else if (confidence >= 80) {
            tier = 'medium';
        } else {
            tier = 'low';
        }

        return {
            value: confidence,
            tier,
            factors: factors.length > 0 ? factors : ['Standard CSS focus fix'],
            requiresHumanReview: tier === 'low'
        };
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new FocusSpecialist instance
 */
export function createFocusSpecialist(): FocusSpecialist {
    return new FocusSpecialist();
}
