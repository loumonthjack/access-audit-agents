/**
 * Interaction Specialist Agent
 * 
 * Handles WCAG 2.2 interaction-related violations:
 * - Dragging Movements (2.5.7)
 * - Target Size - Minimum (2.5.8)
 * 
 * Generates fixes and recommendations for:
 * - Adding single-pointer alternatives to draggable elements
 * - Suggesting button implementations for drag operations
 * - Increasing target sizes for touch interactions
 * 
 * Note: Many interaction fixes require significant code changes and are
 * typically flagged for human review rather than auto-applied.
 * 
 * Requirements: WCAG 2.2 Success Criteria 2.5.7, 2.5.8
 */

import type { FixInstruction, HumanHandoffItem } from '../../types/index.js';
import {
    BaseSpecialist,
    type Violation,
    type PageContext
} from './specialist-agent.js';

// ============================================================================
// Interaction Fix Suggestion Types
// ============================================================================

/**
 * Suggested alternative for dragging operations
 */
export interface DraggingAlternativeSuggestion {
    type: 'button' | 'input' | 'select' | 'keyboard';
    description: string;
    codeExample: string;
}

// ============================================================================
// Interaction Specialist Implementation
// ============================================================================

/**
 * Interaction Specialist
 * 
 * Handles interaction-related accessibility violations for WCAG 2.2.
 * Due to the complexity of interaction fixes, most are flagged for human review.
 */
export class InteractionSpecialist extends BaseSpecialist {
    readonly name = 'InteractionSpecialist';

    protected readonly handledRulePatterns: RegExp[] = [
        /dragging/i,
        /drag-movements/i,
        /target-size/i,
        /pointer/i,
        /2\.5\.7/,  // Dragging Movements
        /2\.5\.8/   // Target Size (Minimum)
    ];

    /**
     * Plans a fix for interaction-related violations
     * 
     * Note: Most interaction fixes are flagged for human review
     * since they require JavaScript modifications.
     */
    async planFix(violation: Violation, context: PageContext): Promise<FixInstruction> {
        const fixId = this.generateFixId(violation);
        const ruleId = violation.ruleId.toLowerCase();

        // Target Size violations can be auto-fixed with CSS
        if (ruleId.includes('target-size') || ruleId.includes('2.5.8')) {
            return this.planTargetSizeFix(violation, fixId);
        }

        // Dragging violations need human review with suggestions
        return this.planDraggingFix(violation, fixId, context);
    }

    /**
     * Plans a fix for target size violations (can be auto-applied)
     */
    private planTargetSizeFix(violation: Violation, fixId: string): FixInstruction {
        return {
            type: 'style',
            selector: violation.selector,
            violationId: fixId,
            reasoning: this.generateTargetSizeReasoning(violation),
            params: {
                selector: violation.selector,
                cssClass: 'a11y-target-size',
                styles: {
                    'min-width': '24px',   // WCAG 2.5.8 minimum
                    'min-height': '24px',
                    'padding': '4px',       // Add padding if needed
                    'touch-action': 'manipulation'
                }
            }
        };
    }

    /**
     * Plans a fix for dragging violations (flagged for human review)
     */
    private planDraggingFix(
        violation: Violation,
        fixId: string,
        _context: PageContext
    ): FixInstruction {
        const suggestion = this.generateDraggingAlternative(violation);

        // For dragging, we add ARIA attributes and document the needed changes
        // The actual implementation requires human intervention
        return {
            type: 'attribute',
            selector: violation.selector,
            violationId: fixId,
            reasoning: this.generateDraggingReasoning(violation, suggestion),
            params: {
                selector: violation.selector,
                attribute: 'data-a11y-needs-alternative',
                value: 'true',
                reasoning: `This draggable element requires a single-pointer alternative. ` +
                    `Suggested implementation: ${suggestion.description}. ` +
                    `Example code:\n${suggestion.codeExample}`
            }
        };
    }

    /**
     * Generates an alternative suggestion for dragging elements
     */
    private generateDraggingAlternative(violation: Violation): DraggingAlternativeSuggestion {
        const html = violation.html.toLowerCase();

        // Slider-like elements
        if (html.includes('slider') || html.includes('range')) {
            return {
                type: 'input',
                description: 'Add a number input for precise value entry',
                codeExample: `
<div class="slider-container">
  <input type="range" id="slider" value="50">
  <!-- Alternative: number input -->
  <input type="number" id="slider-value" value="50" min="0" max="100">
</div>`
            };
        }

        // Sortable/reorderable lists
        if (html.includes('sortable') || html.includes('draggable') ||
            html.includes('kanban')) {
            return {
                type: 'button',
                description: 'Add "Move Up" and "Move Down" buttons for each item',
                codeExample: `
<li class="sortable-item">
  <span class="item-content">Item Text</span>
  <!-- Alternatives: move buttons -->
  <button aria-label="Move item up">↑</button>
  <button aria-label="Move item down">↓</button>
</li>`
            };
        }

        // Map-like elements
        if (html.includes('map')) {
            return {
                type: 'button',
                description: 'Add pan buttons and search input',
                codeExample: `
<div class="map-controls">
  <button aria-label="Pan north">↑</button>
  <button aria-label="Pan south">↓</button>
  <button aria-label="Pan west">←</button>
  <button aria-label="Pan east">→</button>
  <input type="text" placeholder="Search location...">
</div>`
            };
        }

        // Generic draggable
        return {
            type: 'button',
            description: 'Provide click-based alternatives to drag operation',
            codeExample: `
<!-- Instead of drag-to-position, offer: -->
<button aria-label="Move to position">Move</button>
<select aria-label="Select position">
  <option>Position 1</option>
  <option>Position 2</option>
</select>`
        };
    }

    /**
     * Generates reasoning for target size fix
     */
    private generateTargetSizeReasoning(violation: Violation): string {
        return `WCAG 2.2 Target Size Fix (2.5.8): ` +
            `Element "${violation.selector}" has a target size below the 24x24 CSS pixels minimum. ` +
            `Applying minimum dimensions to ensure adequate touch targets for users with motor impairments.`;
    }

    /**
     * Generates reasoning for dragging fix
     */
    private generateDraggingReasoning(
        violation: Violation,
        suggestion: DraggingAlternativeSuggestion
    ): string {
        return `WCAG 2.2 Dragging Movements (2.5.7): ` +
            `Element "${violation.selector}" uses dragging for operation without a single-pointer alternative. ` +
            `REQUIRES HUMAN REVIEW: Implement ${suggestion.type}-based alternative. ` +
            `Suggested: ${suggestion.description}`;
    }

    /**
     * Calculates confidence score for interaction fixes
     * 
     * Target size fixes are higher confidence (CSS-only).
     * Dragging fixes are always low confidence (require JS changes).
     */
    calculateConfidence(violation: Violation): {
        value: number;
        tier: 'high' | 'medium' | 'low';
        factors: string[];
        requiresHumanReview: boolean;
    } {
        const ruleId = violation.ruleId.toLowerCase();

        // Target size fixes are safe CSS changes
        if (ruleId.includes('target-size') || ruleId.includes('2.5.8')) {
            return {
                value: 85,
                tier: 'medium',
                factors: ['CSS-only fix', 'No functionality changes'],
                requiresHumanReview: false
            };
        }

        // Dragging fixes require code changes - always flag for review
        return {
            value: 30,
            tier: 'low',
            factors: [
                'Requires JavaScript implementation',
                'Alternative interface must be created',
                'Functional testing required'
            ],
            requiresHumanReview: true
        };
    }

    /**
     * Creates a human handoff item for dragging violations
     */
    createHumanHandoff(violation: Violation): HumanHandoffItem {
        const suggestion = this.generateDraggingAlternative(violation);

        return {
            violationId: violation.id,
            ruleId: violation.ruleId,
            selector: violation.selector,
            reason: 'Dragging functionality requires JavaScript implementation of single-pointer alternative',
            suggestedAction: `Implement ${suggestion.type}-based alternative: ${suggestion.description}`
        };
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new InteractionSpecialist instance
 */
export function createInteractionSpecialist(): InteractionSpecialist {
    return new InteractionSpecialist();
}
