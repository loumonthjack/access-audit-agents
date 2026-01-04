/**
 * NavigationSpecialist
 * 
 * Handles focus, keyboard, and tabindex violations by generating
 * appropriate tabindex and aria-label fixes for keyboard navigation.
 * 
 * Requirements: 6.2
 */

import type { FixInstruction, AttributeFixParams } from '../../types/index.js';
import { BaseSpecialist, type Violation, type PageContext } from './specialist-agent.js';

// ============================================================================
// NavigationSpecialist Implementation
// ============================================================================

export class NavigationSpecialist extends BaseSpecialist {
    readonly name = 'NavigationSpecialist';

    protected readonly handledRulePatterns: RegExp[] = [
        /focus/i,
        /keyboard/i,
        /tabindex/i,
        /focus-order/i,
        /focusable/i,
        /scrollable-region-focusable/i,
        /skip-link/i,
        /bypass/i,
        /link-name/i,
        /button-name/i
    ];

    async planFix(violation: Violation, context: PageContext): Promise<FixInstruction> {
        // Determine the best fix strategy based on the violation type
        const fixStrategy = this.determineFixStrategy(violation);

        const params: AttributeFixParams = {
            selector: violation.selector,
            attribute: fixStrategy.attribute,
            value: fixStrategy.value,
            reasoning: this.generateReasoning(violation, context, fixStrategy)
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
     * Determines the appropriate fix strategy based on violation type.
     */
    private determineFixStrategy(violation: Violation): { attribute: string; value: string } {
        const ruleId = violation.ruleId.toLowerCase();

        // Handle tabindex violations
        if (ruleId.includes('tabindex')) {
            return this.handleTabindexViolation(violation);
        }

        // Handle focus-related violations
        if (ruleId.includes('focus') || ruleId.includes('focusable')) {
            return this.handleFocusViolation(violation);
        }

        // Handle keyboard navigation violations
        if (ruleId.includes('keyboard')) {
            return this.handleKeyboardViolation(violation);
        }

        // Handle link/button name violations
        if (ruleId.includes('link-name') || ruleId.includes('button-name')) {
            return this.handleNameViolation(violation);
        }

        // Handle skip link / bypass violations
        if (ruleId.includes('skip') || ruleId.includes('bypass')) {
            return this.handleBypassViolation();
        }

        // Default: make element focusable
        return { attribute: 'tabindex', value: '0' };
    }

    /**
     * Handles tabindex-specific violations.
     */
    private handleTabindexViolation(violation: Violation): { attribute: string; value: string } {
        const html = violation.html.toLowerCase();

        // Check for positive tabindex (should be 0 or -1)
        const tabindexMatch = html.match(/tabindex\s*=\s*["']?(\d+)["']?/);
        if (tabindexMatch && tabindexMatch[1]) {
            const currentValue = parseInt(tabindexMatch[1], 10);
            if (currentValue > 0) {
                // Positive tabindex should be changed to 0
                return { attribute: 'tabindex', value: '0' };
            }
        }

        // Default: ensure element is in tab order
        return { attribute: 'tabindex', value: '0' };
    }

    /**
     * Handles focus-related violations.
     */
    private handleFocusViolation(violation: Violation): { attribute: string; value: string } {
        const html = violation.html.toLowerCase();

        // Scrollable regions need tabindex="0"
        if (violation.ruleId.includes('scrollable')) {
            return { attribute: 'tabindex', value: '0' };
        }

        // Check if element is interactive but not focusable
        const isInteractive = this.isInteractiveElement(html);
        if (isInteractive) {
            return { attribute: 'tabindex', value: '0' };
        }

        // Non-interactive elements that need focus should use tabindex="-1"
        // for programmatic focus only
        return { attribute: 'tabindex', value: '-1' };
    }

    /**
     * Handles keyboard navigation violations.
     */
    private handleKeyboardViolation(violation: Violation): { attribute: string; value: string } {
        const html = violation.html.toLowerCase();

        // Elements with click handlers need keyboard support
        if (html.includes('onclick') || html.includes('click')) {
            // Add role="button" for non-button elements with click handlers
            if (!html.includes('<button') && !html.includes('<a ')) {
                return { attribute: 'role', value: 'button' };
            }
        }

        // Default: make focusable
        return { attribute: 'tabindex', value: '0' };
    }

    /**
     * Handles link/button name violations.
     */
    private handleNameViolation(violation: Violation): { attribute: string; value: string } {
        const html = violation.html.toLowerCase();

        // Try to extract meaningful label from context
        const label = this.extractLabelFromHtml(html);

        return { attribute: 'aria-label', value: label };
    }

    /**
     * Handles skip link / bypass violations.
     */
    private handleBypassViolation(): { attribute: string; value: string } {
        // Skip links need proper labeling
        return { attribute: 'aria-label', value: 'Skip to main content' };
    }

    /**
     * Checks if an element is interactive.
     */
    private isInteractiveElement(html: string): boolean {
        const interactivePatterns = [
            /<button/i,
            /<a\s/i,
            /<input/i,
            /<select/i,
            /<textarea/i,
            /onclick/i,
            /role\s*=\s*["']button["']/i,
            /role\s*=\s*["']link["']/i,
            /role\s*=\s*["']tab["']/i,
            /role\s*=\s*["']menuitem["']/i
        ];

        return interactivePatterns.some(pattern => pattern.test(html));
    }

    /**
     * Extracts a meaningful label from HTML content.
     */
    private extractLabelFromHtml(html: string): string {
        // Try to find existing aria-label
        const ariaLabelMatch = html.match(/aria-label\s*=\s*["']([^"']+)["']/i);
        if (ariaLabelMatch?.[1]?.trim()) {
            return ariaLabelMatch[1].trim();
        }

        // Try to find title attribute
        const titleMatch = html.match(/title\s*=\s*["']([^"']+)["']/i);
        if (titleMatch?.[1]?.trim()) {
            return titleMatch[1].trim();
        }

        // Try to extract text content
        const textMatch = html.match(/>([^<]+)</);
        if (textMatch?.[1]?.trim()) {
            const text = textMatch[1].trim();
            if (text.length <= 50) {
                return text;
            }
        }

        // Check for common icon patterns
        if (html.includes('search')) return 'Search';
        if (html.includes('menu')) return 'Menu';
        if (html.includes('close')) return 'Close';
        if (html.includes('nav')) return 'Navigation';
        if (html.includes('submit')) return 'Submit';
        if (html.includes('cancel')) return 'Cancel';
        if (html.includes('edit')) return 'Edit';
        if (html.includes('delete')) return 'Delete';
        if (html.includes('add')) return 'Add';
        if (html.includes('remove')) return 'Remove';

        // Default fallback
        return 'Interactive element';
    }

    /**
     * Generates reasoning for the fix.
     */
    private generateReasoning(
        violation: Violation,
        _context: PageContext,
        fixStrategy: { attribute: string; value: string }
    ): string {
        const { attribute, value } = fixStrategy;

        if (attribute === 'tabindex') {
            if (value === '0') {
                return `Adding tabindex="0" to include element in keyboard navigation order. ` +
                    `This ensures keyboard users can access this interactive element. ` +
                    `Rule: ${violation.ruleId}`;
            }
            if (value === '-1') {
                return `Adding tabindex="-1" to allow programmatic focus without adding to tab order. ` +
                    `This is appropriate for elements that receive focus via scripts. ` +
                    `Rule: ${violation.ruleId}`;
            }
        }

        if (attribute === 'role') {
            return `Adding role="${value}" to provide semantic meaning for assistive technologies. ` +
                `This ensures the element's purpose is communicated to screen readers. ` +
                `Rule: ${violation.ruleId}`;
        }

        if (attribute === 'aria-label') {
            return `Adding aria-label="${value}" to provide accessible name for the element. ` +
                `This ensures screen reader users understand the element's purpose. ` +
                `Rule: ${violation.ruleId}`;
        }

        return `Applying ${attribute}="${value}" to fix keyboard navigation issue. ` +
            `Rule: ${violation.ruleId}`;
    }
}
