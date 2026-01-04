/**
 * Unit Tests for Interaction Specialist
 * 
 * Tests the specialist agent that handles WCAG 2.2 interaction violations:
 * - Dragging Movements (2.5.7)
 * - Target Size - Minimum (2.5.8)
 * 
 * Requirements: WCAG 2.5.7, 2.5.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    InteractionSpecialist,
    createInteractionSpecialist
} from '../services/specialists/interaction-specialist.js';
import type { Violation, PageContext } from '../services/specialists/specialist-agent.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createDraggingViolation = (overrides: Partial<Violation> = {}): Violation => ({
    id: 'drag-001',
    ruleId: 'dragging-movements',
    impact: 'serious',
    selector: '.sortable-item',
    html: '<li class="sortable-item draggable" draggable="true">Item 1</li>',
    description: 'Draggable element without single-pointer alternative',
    help: 'Provide a single-pointer alternative for drag operations',
    ...overrides
});

const createTargetSizeViolation = (overrides: Partial<Violation> = {}): Violation => ({
    id: 'target-001',
    ruleId: 'target-size-minimum',
    impact: 'moderate',
    selector: '.small-button',
    html: '<button class="small-button" style="width: 16px; height: 16px;">X</button>',
    description: 'Target size is below the minimum 24x24 CSS pixels',
    help: 'Ensure target size is at least 24x24 CSS pixels',
    ...overrides
});

const createSliderViolation = (): Violation => ({
    id: 'slider-001',
    ruleId: 'dragging-movements',
    impact: 'serious',
    selector: '#volume-slider',
    html: '<div role="slider" class="slider" draggable="true"></div>',
    description: 'Slider requires dragging without alternative',
    help: 'Provide input or buttons for slider value control'
});

const createSortableViolation = (): Violation => ({
    id: 'sort-001',
    ruleId: 'dragging-movements',
    impact: 'serious',
    selector: '.kanban-card',
    html: '<div class="kanban-card sortable" draggable="true">Task</div>',
    description: 'Sortable item requires dragging without alternative',
    help: 'Provide move buttons for reordering'
});

const createMapViolation = (): Violation => ({
    id: 'map-001',
    ruleId: 'dragging-movements',
    impact: 'moderate',
    selector: '.map-container',
    html: '<div class="map-container leaflet-map" draggable="true"></div>',
    description: 'Map panning requires dragging',
    help: 'Provide pan buttons or search input'
});

const createPageContext = (overrides: Partial<PageContext> = {}): PageContext => ({
    url: 'https://example.com/app',
    title: 'Test Application',
    ...overrides
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('InteractionSpecialist', () => {
    let specialist: InteractionSpecialist;

    beforeEach(() => {
        specialist = new InteractionSpecialist();
    });

    // ========================================================================
    // Constructor and Factory
    // ========================================================================

    describe('constructor', () => {
        it('should create specialist instance', () => {
            expect(specialist).toBeDefined();
            expect(specialist).toBeInstanceOf(InteractionSpecialist);
        });

        it('should have correct name', () => {
            expect(specialist.name).toBe('InteractionSpecialist');
        });
    });

    describe('createInteractionSpecialist factory', () => {
        it('should create specialist instance', () => {
            const created = createInteractionSpecialist();
            expect(created).toBeInstanceOf(InteractionSpecialist);
        });
    });

    // ========================================================================
    // canHandle()
    // ========================================================================

    describe('canHandle()', () => {
        it('should handle dragging-movements rule', () => {
            const violation = createDraggingViolation({ ruleId: 'dragging-movements' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle drag-movements rule (variant)', () => {
            const violation = createDraggingViolation({ ruleId: 'drag-movements' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle target-size rule', () => {
            const violation = createTargetSizeViolation({ ruleId: 'target-size' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle target-size-minimum rule', () => {
            const violation = createTargetSizeViolation({ ruleId: 'target-size-minimum' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle pointer-related rules', () => {
            const violation = createDraggingViolation({ ruleId: 'pointer-gestures' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle WCAG 2.5.7 reference', () => {
            const violation = createDraggingViolation({ ruleId: 'wcag-2.5.7' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle WCAG 2.5.8 reference', () => {
            const violation = createTargetSizeViolation({ ruleId: 'wcag-2.5.8' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should not handle unrelated rules', () => {
            const violation = createDraggingViolation({ ruleId: 'color-contrast' });
            expect(specialist.canHandle(violation)).toBe(false);
        });

        it('should not handle alt-text rules', () => {
            const violation = createDraggingViolation({ ruleId: 'image-alt' });
            expect(specialist.canHandle(violation)).toBe(false);
        });

        it('should not handle focus rules', () => {
            const violation = createDraggingViolation({ ruleId: 'focus-visible' });
            expect(specialist.canHandle(violation)).toBe(false);
        });

        it('should be case-insensitive for rule matching', () => {
            const violation = createDraggingViolation({ ruleId: 'DRAGGING-MOVEMENTS' });
            expect(specialist.canHandle(violation)).toBe(true);
        });
    });

    // ========================================================================
    // planFix() - Target Size
    // ========================================================================

    describe('planFix() - Target Size', () => {
        it('should return style fix for target size violation', async () => {
            const violation = createTargetSizeViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.type).toBe('style');
            expect(fix.selector).toBe(violation.selector);
        });

        it('should include minimum dimensions in style params', async () => {
            const violation = createTargetSizeViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles).toBeDefined();
            expect(params.styles['min-width']).toBe('24px');
            expect(params.styles['min-height']).toBe('24px');
        });

        it('should include padding in style fix', async () => {
            const violation = createTargetSizeViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['padding']).toBeDefined();
        });

        it('should include touch-action in style fix', async () => {
            const violation = createTargetSizeViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['touch-action']).toBe('manipulation');
        });

        it('should reference 2.5.8 in reasoning', async () => {
            const violation = createTargetSizeViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning).toMatch(/2\.5\.8/);
        });

        it('should include CSS class name', async () => {
            const violation = createTargetSizeViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { cssClass: string };

            expect(params.cssClass).toBe('a11y-target-size');
        });
    });

    // ========================================================================
    // planFix() - Dragging
    // ========================================================================

    describe('planFix() - Dragging', () => {
        it('should return attribute fix for dragging violation', async () => {
            const violation = createDraggingViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.type).toBe('attribute');
            expect(fix.selector).toBe(violation.selector);
        });

        it('should add data-a11y-needs-alternative attribute', async () => {
            const violation = createDraggingViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { attribute: string; value: string };

            expect(params.attribute).toBe('data-a11y-needs-alternative');
            expect(params.value).toBe('true');
        });

        it('should reference 2.5.7 in reasoning', async () => {
            const violation = createDraggingViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning).toMatch(/2\.5\.7/);
        });

        it('should mention HUMAN REVIEW in reasoning', async () => {
            const violation = createDraggingViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning).toMatch(/HUMAN REVIEW/i);
        });

        it('should suggest number input for slider violations', async () => {
            const violation = createSliderViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning.toLowerCase()).toMatch(/number input|input/);
        });

        it('should suggest move buttons for sortable violations', async () => {
            const violation = createSortableViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning.toLowerCase()).toMatch(/move|button/);
        });

        it('should suggest pan controls for map violations', async () => {
            const violation = createMapViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning.toLowerCase()).toMatch(/pan|button|search/);
        });

        it('should include suggested code example in params reasoning', async () => {
            const violation = createDraggingViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { reasoning: string };

            // Should include example code in the params reasoning
            expect(params.reasoning).toContain('Example code');
        });
    });

    // ========================================================================
    // calculateConfidence()
    // ========================================================================

    describe('calculateConfidence()', () => {
        it('should return medium confidence for target size violations', () => {
            const violation = createTargetSizeViolation();

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.tier).toBe('medium');
            expect(confidence.value).toBe(85);
            expect(confidence.requiresHumanReview).toBe(false);
        });

        it('should return low confidence for dragging violations', () => {
            const violation = createDraggingViolation();

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.tier).toBe('low');
            expect(confidence.value).toBe(30);
            expect(confidence.requiresHumanReview).toBe(true);
        });

        it('should include "CSS-only fix" factor for target size', () => {
            const violation = createTargetSizeViolation();

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.factors).toContain('CSS-only fix');
        });

        it('should include "Requires JavaScript" factor for dragging', () => {
            const violation = createDraggingViolation();

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.factors.join(' ').toLowerCase()).toMatch(/javascript/);
        });

        it('should include "Functional testing required" for dragging', () => {
            const violation = createDraggingViolation();

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.factors.join(' ').toLowerCase()).toMatch(/functional|testing/);
        });

        it('should handle WCAG reference in ruleId for target size', () => {
            const violation = createTargetSizeViolation({ ruleId: '2.5.8-target-size' });

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.tier).toBe('medium');
        });

        it('should handle WCAG reference in ruleId for dragging', () => {
            const violation = createDraggingViolation({ ruleId: '2.5.7-dragging' });

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.tier).toBe('low');
        });
    });

    // ========================================================================
    // createHumanHandoff()
    // ========================================================================

    describe('createHumanHandoff()', () => {
        it('should create handoff item with violation details', () => {
            const violation = createDraggingViolation();

            const handoff = specialist.createHumanHandoff(violation);

            expect(handoff.violationId).toBe(violation.id);
            expect(handoff.ruleId).toBe(violation.ruleId);
            expect(handoff.selector).toBe(violation.selector);
        });

        it('should include reason for handoff', () => {
            const violation = createDraggingViolation();

            const handoff = specialist.createHumanHandoff(violation);

            expect(handoff.reason).toBeDefined();
            expect(handoff.reason.length).toBeGreaterThan(0);
            expect(handoff.reason.toLowerCase()).toMatch(/javascript|implementation/);
        });

        it('should include suggested action', () => {
            const violation = createDraggingViolation();

            const handoff = specialist.createHumanHandoff(violation);

            expect(handoff.suggestedAction).toBeDefined();
            expect(handoff.suggestedAction.length).toBeGreaterThan(0);
        });

        it('should suggest button alternative for sortable', () => {
            const violation = createSortableViolation();

            const handoff = specialist.createHumanHandoff(violation);

            expect(handoff.suggestedAction.toLowerCase()).toMatch(/button/);
        });

        it('should suggest input alternative for slider', () => {
            const violation = createSliderViolation();

            const handoff = specialist.createHumanHandoff(violation);

            expect(handoff.suggestedAction.toLowerCase()).toMatch(/input/);
        });
    });

    // ========================================================================
    // Fix Instruction Format
    // ========================================================================

    describe('Fix Instruction Format', () => {
        it('should include violationId in fix instruction', async () => {
            const violation = createDraggingViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.violationId).toBeDefined();
            expect(fix.violationId).toMatch(/^fix-/);
        });

        it('should include timestamp-based ID', async () => {
            const violation = createDraggingViolation();
            const context = createPageContext();

            const fix1 = await specialist.planFix(violation, context);

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            const fix2 = await specialist.planFix(violation, context);

            expect(fix1.violationId).not.toBe(fix2.violationId);
        });

        it('should include non-empty reasoning', async () => {
            const violation = createTargetSizeViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning.length).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('Edge Cases', () => {
        it('should handle empty HTML in violation', async () => {
            const violation = createDraggingViolation({ html: '' });
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix).toBeDefined();
            expect(fix.type).toBe('attribute');
        });

        it('should handle very long HTML in violation', async () => {
            const longHtml = '<div class="' + 'a'.repeat(1000) + '" draggable="true">Content</div>';
            const violation = createDraggingViolation({ html: longHtml });
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix).toBeDefined();
        });

        it('should handle complex selectors', async () => {
            const violation = createTargetSizeViolation({
                selector: 'body > main > div:nth-child(3) > button.small[data-action="close"]'
            });
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.selector).toBe(violation.selector);
        });

        it('should handle missing page context properties', async () => {
            const violation = createDraggingViolation();
            const context: PageContext = { url: 'https://example.com' };

            const fix = await specialist.planFix(violation, context);

            expect(fix).toBeDefined();
        });
    });
});
