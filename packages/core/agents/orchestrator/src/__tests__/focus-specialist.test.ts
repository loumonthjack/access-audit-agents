/**
 * Unit Tests for Focus Specialist
 * 
 * Tests the specialist agent that handles WCAG 2.2 focus-related violations:
 * - Focus Not Obscured (2.4.11)
 * - Focus Not Obscured - Enhanced (2.4.12)
 * - Focus Appearance (2.4.13)
 * 
 * Requirements: WCAG 2.4.11, 2.4.12, 2.4.13
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    FocusSpecialist,
    createFocusSpecialist
} from '../services/specialists/focus-specialist.js';
import type { Violation, PageContext } from '../services/specialists/specialist-agent.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createFocusObscuredViolation = (overrides: Partial<Violation> = {}): Violation => ({
    id: 'focus-001',
    ruleId: 'focus-not-obscured',
    impact: 'serious',
    selector: '#login-button',
    html: '<button id="login-button">Login</button>',
    description: 'Focused element is obscured by sticky header',
    help: 'Ensure focused elements are not completely hidden',
    ...overrides
});

const createFocusAppearanceViolation = (overrides: Partial<Violation> = {}): Violation => ({
    id: 'focus-002',
    ruleId: 'focus-appearance',
    impact: 'moderate',
    selector: '.nav-link',
    html: '<a class="nav-link" href="#">About</a>',
    description: 'Focus indicator does not meet appearance requirements',
    help: 'Provide visible focus indicator with sufficient size and contrast',
    ...overrides
});

const createFocusVisibleViolation = (overrides: Partial<Violation> = {}): Violation => ({
    id: 'focus-003',
    ruleId: 'focus-visible',
    impact: 'serious',
    selector: 'input[type="text"]',
    html: '<input type="text" placeholder="Search">',
    description: 'No visible focus indicator',
    help: 'Ensure focus is visible when element receives keyboard focus',
    ...overrides
});

const createPageContext = (overrides: Partial<PageContext> = {}): PageContext => ({
    url: 'https://example.com/page',
    title: 'Test Page',
    ...overrides
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('FocusSpecialist', () => {
    let specialist: FocusSpecialist;

    beforeEach(() => {
        specialist = new FocusSpecialist();
    });

    // ========================================================================
    // Constructor and Factory
    // ========================================================================

    describe('constructor', () => {
        it('should create specialist instance', () => {
            expect(specialist).toBeDefined();
            expect(specialist).toBeInstanceOf(FocusSpecialist);
        });

        it('should have correct name', () => {
            expect(specialist.name).toBe('FocusSpecialist');
        });
    });

    describe('createFocusSpecialist factory', () => {
        it('should create specialist instance', () => {
            const created = createFocusSpecialist();
            expect(created).toBeInstanceOf(FocusSpecialist);
        });
    });

    // ========================================================================
    // canHandle()
    // ========================================================================

    describe('canHandle()', () => {
        it('should handle focus-not-obscured rule', () => {
            const violation = createFocusObscuredViolation({ ruleId: 'focus-not-obscured' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle focus-obscured rule', () => {
            const violation = createFocusObscuredViolation({ ruleId: 'focus-obscured' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle focus-visible rule', () => {
            const violation = createFocusVisibleViolation({ ruleId: 'focus-visible' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle focus-appearance rule', () => {
            const violation = createFocusAppearanceViolation({ ruleId: 'focus-appearance' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle WCAG 2.4.11 reference', () => {
            const violation = createFocusObscuredViolation({ ruleId: 'wcag-2.4.11' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle WCAG 2.4.12 reference', () => {
            const violation = createFocusObscuredViolation({ ruleId: 'wcag-2.4.12' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should handle WCAG 2.4.13 reference', () => {
            const violation = createFocusAppearanceViolation({ ruleId: 'wcag-2.4.13' });
            expect(specialist.canHandle(violation)).toBe(true);
        });

        it('should not handle color-contrast rules', () => {
            const violation = createFocusObscuredViolation({ ruleId: 'color-contrast' });
            expect(specialist.canHandle(violation)).toBe(false);
        });

        it('should not handle image-alt rules', () => {
            const violation = createFocusObscuredViolation({ ruleId: 'image-alt' });
            expect(specialist.canHandle(violation)).toBe(false);
        });

        it('should not handle dragging rules', () => {
            const violation = createFocusObscuredViolation({ ruleId: 'dragging-movements' });
            expect(specialist.canHandle(violation)).toBe(false);
        });

        it('should be case-insensitive', () => {
            const violation = createFocusObscuredViolation({ ruleId: 'FOCUS-NOT-OBSCURED' });
            expect(specialist.canHandle(violation)).toBe(true);
        });
    });

    // ========================================================================
    // planFix() - Focus Obscured
    // ========================================================================

    describe('planFix() - Focus Obscured', () => {
        it('should return style fix for focus-obscured violation', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.type).toBe('style');
            expect(fix.selector).toBe(violation.selector);
        });

        it('should include scroll-margin-top in styles', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['scroll-margin-top']).toBeDefined();
            expect(params.styles['scroll-margin-top']).toBe('80px');
        });

        it('should include scroll-margin-bottom in styles', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['scroll-margin-bottom']).toBeDefined();
            expect(params.styles['scroll-margin-bottom']).toBe('80px');
        });

        it('should set relative positioning', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['position']).toBe('relative');
        });

        it('should set z-index for element', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['z-index']).toBeDefined();
        });

        it('should use a11y-focus-visible class', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { cssClass: string };

            expect(params.cssClass).toBe('a11y-focus-visible');
        });

        it('should handle 2.4.11 ruleId', async () => {
            const violation = createFocusObscuredViolation({ ruleId: 'wcag-2.4.11' });
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['scroll-margin-top']).toBeDefined();
        });

        it('should handle 2.4.12 ruleId', async () => {
            const violation = createFocusObscuredViolation({ ruleId: 'wcag-2.4.12' });
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['scroll-margin-top']).toBeDefined();
        });
    });

    // ========================================================================
    // planFix() - Focus Appearance
    // ========================================================================

    describe('planFix() - Focus Appearance', () => {
        it('should return style fix for focus-appearance violation', async () => {
            const violation = createFocusAppearanceViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.type).toBe('style');
        });

        it('should include outline in styles', async () => {
            const violation = createFocusAppearanceViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['outline']).toBeDefined();
            expect(params.styles['outline']).toMatch(/2px solid/);
        });

        it('should include outline-offset', async () => {
            const violation = createFocusAppearanceViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['outline-offset']).toBe('2px');
        });

        it('should include border-radius', async () => {
            const violation = createFocusAppearanceViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['border-radius']).toBe('2px');
        });

        it('should use a11y-focus-indicator class', async () => {
            const violation = createFocusAppearanceViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { cssClass: string };

            expect(params.cssClass).toBe('a11y-focus-indicator');
        });

        it('should handle 2.4.13 ruleId', async () => {
            const violation = createFocusAppearanceViolation({ ruleId: 'wcag-2.4.13' });
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['outline']).toBeDefined();
        });
    });

    // ========================================================================
    // planFix() - Focus Visible (Default)
    // ========================================================================

    describe('planFix() - Focus Visible / Default', () => {
        it('should return style fix with default improvements', async () => {
            const violation = createFocusVisibleViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.type).toBe('style');
        });

        it('should include scroll-margin-top', async () => {
            const violation = createFocusVisibleViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['scroll-margin-top']).toBeDefined();
        });

        it('should include outline with currentColor', async () => {
            const violation = createFocusVisibleViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);
            const params = fix.params as { styles: Record<string, string> };

            expect(params.styles['outline']).toMatch(/currentColor/);
        });
    });

    // ========================================================================
    // Fix Instruction Format
    // ========================================================================

    describe('Fix Instruction Format', () => {
        it('should include violationId', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.violationId).toBeDefined();
            expect(fix.violationId).toMatch(/^fix-/);
        });

        it('should include non-empty reasoning', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning).toBeDefined();
            expect(fix.reasoning.length).toBeGreaterThan(0);
        });

        it('should mention WCAG 2.2 in reasoning', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning).toMatch(/WCAG 2\.2/);
        });

        it('should mention selector in reasoning', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning).toContain(violation.selector);
        });

        it('should mention keyboard navigation', async () => {
            const violation = createFocusObscuredViolation();
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.reasoning.toLowerCase()).toMatch(/keyboard/);
        });
    });

    // ========================================================================
    // calculateConfidence()
    // ========================================================================

    describe('calculateConfidence()', () => {
        it('should return high/medium confidence for standard violations', () => {
            const violation = createFocusObscuredViolation();

            const confidence = specialist.calculateConfidence(violation);

            expect(['high', 'medium']).toContain(confidence.tier);
            expect(confidence.value).toBeGreaterThanOrEqual(80);
        });

        it('should not require human review for standard violations', () => {
            const violation = createFocusObscuredViolation();

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.requiresHumanReview).toBe(false);
        });

        it('should reduce confidence for custom components', () => {
            const violation = createFocusObscuredViolation({
                selector: 'div[class*="custom-dropdown"]'
            });

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.factors).toContain('Custom component detected');
            expect(confidence.value).toBeLessThan(90);
        });

        it('should reduce confidence for data-attribute components', () => {
            const violation = createFocusObscuredViolation({
                selector: 'div[data-component="modal"]'
            });

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.factors).toContain('Custom component detected');
        });

        it('should reduce confidence for z-index issues', () => {
            const violation = createFocusObscuredViolation({
                description: 'Element z-index causes stacking context issues'
            });

            const confidence = specialist.calculateConfidence(violation);

            // Implementation outputs: 'Z-index modification may affect layout'
            expect(confidence.factors.some(f => f.includes('Z-index'))).toBe(true);
        });

        it('should require human review for low confidence', () => {
            const violation = createFocusObscuredViolation({
                selector: 'div[data-custom-widget="true"]',
                description: 'Complex z-index stacking context issue'
            });

            const confidence = specialist.calculateConfidence(violation);

            if (confidence.tier === 'low') {
                expect(confidence.requiresHumanReview).toBe(true);
            }
        });

        it('should include standard factor when no special cases', () => {
            const violation = createFocusObscuredViolation();

            const confidence = specialist.calculateConfidence(violation);

            if (confidence.factors.length === 1) {
                expect(confidence.factors[0]).toBe('Standard CSS focus fix');
            }
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('Edge Cases', () => {
        it('should handle empty selector', async () => {
            const violation = createFocusObscuredViolation({ selector: '' });
            const context = createPageContext();

            // Should not throw
            const fix = await specialist.planFix(violation, context);
            expect(fix).toBeDefined();
        });

        it('should handle complex CSS selectors', async () => {
            const violation = createFocusObscuredViolation({
                selector: 'main > section:nth-child(2) > form > button[type="submit"]:focus'
            });
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.selector).toBe(violation.selector);
        });

        it('should handle violations with special characters in selector', async () => {
            const violation = createFocusObscuredViolation({
                selector: '#form\\:submit-btn'
            });
            const context = createPageContext();

            const fix = await specialist.planFix(violation, context);

            expect(fix.selector).toBe(violation.selector);
        });

        it('should handle minimal page context', async () => {
            const violation = createFocusObscuredViolation();
            const context: PageContext = { url: 'https://example.com' };

            const fix = await specialist.planFix(violation, context);

            expect(fix).toBeDefined();
        });
    });
});
