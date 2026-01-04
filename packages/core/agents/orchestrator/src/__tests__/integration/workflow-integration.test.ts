/**
 * Integration Tests for Orchestrator Workflow
 *
 * Tests the full remediation workflow: Audit -> Plan -> Execute -> Validate
 * Validates specialist routing and session state persistence.
 *
 * Requirements: 3.1, 9.1, 9.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FocusSpecialist } from '../../services/specialists/focus-specialist.js';
import { InteractionSpecialist } from '../../services/specialists/interaction-specialist.js';
import { SpecialistRouter } from '../../services/specialists/specialist-router.js';
import { SessionStateManager } from '../../services/session-state-manager.js';
import type { Violation, PageContext } from '../../services/specialists/specialist-agent.js';

const createMockViolation = (overrides: Partial<Violation> = {}): Violation => ({
    ruleId: 'focus-not-obscured',
    selector: 'button#test',
    description: 'Element is obscured by sticky header',
    impact: 'serious',
    html: '<button id="test">Test</button>',
    ...overrides
});

const createMockPageContext = (): PageContext => ({
    url: 'https://example.com',
    title: 'Test Page',
    viewport: { width: 1280, height: 720 }
});

describe('Orchestrator Workflow Integration', () => {
    describe('Specialist Routing', () => {
        it('should route focus violations to a specialist', () => {
            const router = new SpecialistRouter();
            const violation = createMockViolation({ ruleId: 'focus-not-obscured' });

            const specialist = router.route(violation);

            // NavigationSpecialist or FocusSpecialist can handle focus violations
            expect(specialist).toBeDefined();
            expect(['NavigationSpecialist', 'FocusSpecialist']).toContain(specialist?.name);
        });

        it('should route dragging violations to InteractionSpecialist', () => {
            const router = new SpecialistRouter();
            const violation = createMockViolation({ ruleId: 'dragging-movements' });

            const specialist = router.route(violation);

            expect(specialist).toBeDefined();
            expect(specialist?.name).toBe('InteractionSpecialist');
        });

        it('should route target-size violations to InteractionSpecialist', () => {
            const router = new SpecialistRouter();
            const violation = createMockViolation({ ruleId: 'target-size' });

            const specialist = router.route(violation);

            expect(specialist).toBeDefined();
            expect(specialist?.name).toBe('InteractionSpecialist');
        });

        it('should handle unknown rule IDs gracefully', () => {
            const router = new SpecialistRouter();
            const violation = createMockViolation({ ruleId: 'unknown-rule-id' });

            const specialist = router.route(violation);

            // Should return the generic handler
            expect(specialist).toBeDefined();
            expect(specialist?.name).toBe('GenericAriaHandler');
        });
    });

    describe('FocusSpecialist Workflow', () => {
        let specialist: FocusSpecialist;
        let context: PageContext;

        beforeEach(() => {
            specialist = new FocusSpecialist();
            context = createMockPageContext();
        });

        it('should generate fix instruction for focus obscured violation', async () => {
            const violation = createMockViolation({
                ruleId: 'focus-not-obscured',
                selector: 'button.submit',
                description: 'Button is hidden behind sticky header'
            });

            const fix = await specialist.planFix(violation, context);

            expect(fix).toBeDefined();
            expect(fix.type).toBe('style');
            expect(fix.selector).toBe('button.submit');
            expect(fix.params).toHaveProperty('styles');
        });

        it('should calculate confidence for standard elements', () => {
            const violation = createMockViolation({
                ruleId: 'focus-not-obscured',
                selector: 'button.submit'
            });

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.value).toBeGreaterThanOrEqual(80);
            expect(confidence.tier).toBe('medium');
            expect(confidence.requiresHumanReview).toBe(false);
        });

        it('should reduce confidence for custom components', () => {
            const violation = createMockViolation({
                ruleId: 'focus-not-obscured',
                selector: 'div[class*="custom-modal"]'
            });

            const confidence = specialist.calculateConfidence(violation);

            expect(confidence.value).toBeLessThan(90);
            expect(confidence.factors).toContain('Custom component detected');
        });
    });

    describe('InteractionSpecialist Workflow', () => {
        let specialist: InteractionSpecialist;
        let context: PageContext;

        beforeEach(() => {
            specialist = new InteractionSpecialist();
            context = createMockPageContext();
        });

        it('should generate fix for target-size violation', async () => {
            const violation = createMockViolation({
                ruleId: 'target-size',
                selector: 'button.small',
                description: 'Button is smaller than 24x24 pixels',
                html: '<button class="small">Small Button</button>'
            });

            const fix = await specialist.planFix(violation, context);

            expect(fix).toBeDefined();
            expect(fix.type).toBe('style');
            expect(fix.params).toHaveProperty('styles');
        });

        it('should generate fix for dragging violation', async () => {
            const violation = createMockViolation({
                ruleId: 'dragging-movements',
                selector: 'li[draggable="true"]',
                description: 'Element requires dragging without alternative',
                html: '<li draggable="true" class="sortable-item">Item 1</li>'
            });

            const fix = await specialist.planFix(violation, context);

            expect(fix).toBeDefined();
            expect(fix.selector).toBe('li[draggable="true"]');
        });

        it('should calculate lower confidence for dragging fixes', () => {
            const violation = createMockViolation({
                ruleId: 'dragging-movements',
                selector: 'li[draggable="true"]',
                html: '<li draggable="true">Item</li>'
            });

            const confidence = specialist.calculateConfidence(violation);

            // Dragging fixes are lower confidence (around 30)
            expect(confidence.value).toBeLessThanOrEqual(50);
            expect(confidence.requiresHumanReview).toBe(true);
        });
    });

    describe('Session State Management', () => {
        let sessionManager: SessionStateManager;

        beforeEach(() => {
            // SessionStateManager requires a URL in constructor
            sessionManager = new SessionStateManager('https://example.com');
        });

        it('should initialize with correct URL', () => {
            const state = sessionManager.getState();

            expect(state).toBeDefined();
            expect(state.sessionAttributes.current_url).toBe('https://example.com');
        });

        it('should serialize to session attributes', () => {
            const attributes = sessionManager.getSessionAttributes();

            expect(attributes).toBeDefined();
            expect(attributes.current_url).toBe('https://example.com');
            expect(attributes.pending_violations).toBeDefined();
        });

        it('should track retry attempts', () => {
            const violationId = 'test-violation-1';

            // Record first attempt
            sessionManager.incrementRetry(violationId, 'First failure');
            expect(sessionManager.hasReachedThreeStrikeLimit(violationId)).toBe(false);

            // Record second attempt
            sessionManager.incrementRetry(violationId, 'Second failure');
            expect(sessionManager.hasReachedThreeStrikeLimit(violationId)).toBe(false);

            // Record third attempt - should hit max
            sessionManager.incrementRetry(violationId, 'Third failure');
            expect(sessionManager.hasReachedThreeStrikeLimit(violationId)).toBe(true);
        });
    });

    describe('End-to-End Workflow', () => {
        it('should process violations through full workflow', async () => {
            // Setup
            const router = new SpecialistRouter();
            const context = createMockPageContext();

            // Simulate audit results - use violations that route to specialists with calculateConfidence
            const violations = [
                createMockViolation({
                    ruleId: 'target-size',
                    selector: '#btn2',
                    html: '<button id="btn2">Button 2</button>'
                }),
                createMockViolation({
                    ruleId: 'dragging-movements',
                    selector: '#list1',
                    html: '<li draggable="true" id="list1">Item</li>'
                })
            ];

            // Route and plan fixes
            const fixes = [];
            for (const violation of violations) {
                const specialist = router.route(violation);
                if (specialist) {
                    const fix = await specialist.planFix(violation, context);
                    // Only InteractionSpecialist has calculateConfidence for these rule types
                    if ('calculateConfidence' in specialist) {
                        const confidence = (specialist as InteractionSpecialist).calculateConfidence(violation);
                        fixes.push({ fix, confidence });
                    } else {
                        fixes.push({ fix, confidence: null });
                    }
                }
            }

            expect(fixes.length).toBe(2);

            // Verify confidence scoring - dragging should be low
            const lowConfidenceFixes = fixes.filter(f => f.confidence?.tier === 'low');
            expect(lowConfidenceFixes.length).toBeGreaterThanOrEqual(1);
        });

        it('should identify human review requirements', async () => {
            const router = new SpecialistRouter();

            // Dragging violations require human review
            const draggingViolation = createMockViolation({
                ruleId: 'dragging-movements',
                selector: 'li.sortable-item',
                html: '<li draggable="true" class="sortable-item">Item</li>'
            });

            const specialist = router.route(draggingViolation);
            expect(specialist).toBeDefined();

            const confidence = specialist!.calculateConfidence(draggingViolation);
            expect(confidence.requiresHumanReview).toBe(true);
        });
    });
});

