/**
 * Property-based tests for Fix-Verify Cycle Structure
 * 
 * Feature: agent-orchestration, Property 3: Fix-Verify Cycle Structure
 * 
 * For any violation that is processed (not skipped), the action sequence SHALL follow
 * the pattern: [plan] → [Injector action] → [VerifyElement]. The verify step SHALL
 * always follow the fix step.
 * 
 * Validates: Requirements 1.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    WorkflowOrchestrator,
    type ViolationWithImpact
} from '../services/workflow-orchestrator.js';
import { urlArb } from '../__generators__/session-state.generator.js';
import { violationArb, impactLevelArb } from '../__generators__/violation.generator.js';

/**
 * Generates a ViolationWithImpact from a base violation
 */
const violationWithImpactArb: fc.Arbitrary<ViolationWithImpact> = fc.tuple(
    violationArb,
    impactLevelArb
).map(([violation, impact]) => ({
    ...violation,
    impact
}));

/**
 * Generates an array of violations with impact
 */
const violationsWithImpactArb: fc.Arbitrary<ViolationWithImpact[]> = fc.array(
    violationWithImpactArb,
    { minLength: 1, maxLength: 5 }
);

describe('Feature: agent-orchestration, Property 3: Fix-Verify Cycle Structure', () => {
    /**
     * Property 3: Fix-Verify Cycle Structure
     * 
     * For any violation that is processed (not skipped), the action sequence SHALL follow
     * the pattern: [plan] → [Injector action] → [VerifyElement]. The verify step SHALL
     * always follow the fix step.
     * 
     * Validates: Requirements 1.3
     */

    it('should follow plan -> execute -> verify sequence for each violation', async () => {
        await fc.assert(
            fc.asyncProperty(
                urlArb,
                violationsWithImpactArb,
                async (url, violations) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Start and complete scan
                    orchestrator.startScan();
                    orchestrator.completeScan(violations, url);

                    // Process the first violation through the complete cycle
                    if (violations.length > 0) {
                        // Start planning
                        orchestrator.startPlanning();
                        expect(orchestrator.state).toBe('PLANNING');

                        // Complete planning
                        await orchestrator.completePlanning();
                        expect(orchestrator.state).toBe('EXECUTING');

                        // Start execution
                        orchestrator.startExecution();
                        expect(orchestrator.state).toBe('EXECUTING');

                        // Complete execution
                        orchestrator.completeExecution({
                            success: true,
                            selector: violations[0].selector,
                            beforeHtml: '<div>before</div>',
                            afterHtml: '<div>after</div>'
                        });
                        expect(orchestrator.state).toBe('VERIFYING');

                        // Start verification
                        orchestrator.startVerification();
                        expect(orchestrator.state).toBe('VERIFYING');

                        // Handle verification result
                        orchestrator.handleVerificationResult(true);

                        // Verify the action sequence
                        const sequence = orchestrator.getActionSequence();

                        // Find the indices of key actions
                        const planCompleteIndex = sequence.indexOf('PLAN_COMPLETE');
                        const startExecutionIndex = sequence.indexOf('START_EXECUTION');
                        const executionCompleteIndex = sequence.indexOf('EXECUTION_COMPLETE');
                        const startVerificationIndex = sequence.indexOf('START_VERIFICATION');
                        const verificationPassIndex = sequence.indexOf('VERIFICATION_PASS');

                        // Verify order: PLAN_COMPLETE < START_EXECUTION < EXECUTION_COMPLETE < START_VERIFICATION < VERIFICATION_PASS
                        expect(planCompleteIndex).toBeLessThan(startExecutionIndex);
                        expect(startExecutionIndex).toBeLessThan(executionCompleteIndex);
                        expect(executionCompleteIndex).toBeLessThan(startVerificationIndex);
                        expect(startVerificationIndex).toBeLessThan(verificationPassIndex);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should transition through correct states during fix-verify cycle', async () => {
        await fc.assert(
            fc.asyncProperty(
                urlArb,
                violationWithImpactArb,
                async (url, violation) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Initial state
                    expect(orchestrator.state).toBe('IDLE');

                    // Start scan
                    orchestrator.startScan();
                    expect(orchestrator.state).toBe('SCANNING');

                    // Complete scan
                    orchestrator.completeScan([violation], url);
                    expect(orchestrator.state).toBe('PLANNING');

                    // Start planning
                    orchestrator.startPlanning();
                    expect(orchestrator.state).toBe('PLANNING');

                    // Complete planning
                    await orchestrator.completePlanning();
                    expect(orchestrator.state).toBe('EXECUTING');

                    // Start and complete execution
                    orchestrator.startExecution();
                    orchestrator.completeExecution({
                        success: true,
                        selector: violation.selector,
                        beforeHtml: '<div>before</div>',
                        afterHtml: '<div>after</div>'
                    });
                    expect(orchestrator.state).toBe('VERIFYING');

                    // Start verification and handle result
                    orchestrator.startVerification();
                    orchestrator.handleVerificationResult(true);

                    // Should be COMPLETE since only one violation
                    expect(orchestrator.state).toBe('COMPLETE');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return to PLANNING state after verification failure with more violations', async () => {
        await fc.assert(
            fc.asyncProperty(
                urlArb,
                fc.array(violationWithImpactArb, { minLength: 2, maxLength: 5 }),
                async (url, violations) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    orchestrator.startScan();
                    orchestrator.completeScan(violations, url);

                    // Process first violation with failure
                    orchestrator.startPlanning();
                    await orchestrator.completePlanning();
                    orchestrator.startExecution();
                    orchestrator.completeExecution({
                        success: true,
                        selector: violations[0].selector,
                        beforeHtml: '<div>before</div>',
                        afterHtml: '<div>after</div>'
                    });
                    orchestrator.startVerification();
                    orchestrator.handleVerificationResult(false, 'Verification failed');

                    // Should return to PLANNING for next violation
                    expect(orchestrator.state).toBe('PLANNING');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should validate fix-verify cycle structure using validateFixVerifyCycle', async () => {
        await fc.assert(
            fc.asyncProperty(
                urlArb,
                violationWithImpactArb,
                async (url, violation) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    orchestrator.startScan();
                    orchestrator.completeScan([violation], url);

                    // Complete a full cycle
                    orchestrator.startPlanning();
                    await orchestrator.completePlanning();
                    orchestrator.startExecution();
                    orchestrator.completeExecution({
                        success: true,
                        selector: violation.selector,
                        beforeHtml: '<div>before</div>',
                        afterHtml: '<div>after</div>'
                    });
                    orchestrator.startVerification();
                    orchestrator.handleVerificationResult(true);

                    // Validate the cycle structure
                    expect(orchestrator.validateFixVerifyCycle()).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should always have verify step follow fix step', async () => {
        await fc.assert(
            fc.asyncProperty(
                urlArb,
                fc.array(violationWithImpactArb, { minLength: 1, maxLength: 3 }),
                fc.array(fc.boolean(), { minLength: 1, maxLength: 3 }),
                async (url, violations, verificationResults) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    orchestrator.startScan();
                    orchestrator.completeScan(violations, url);

                    // Process violations
                    let processedCount = 0;
                    while (!orchestrator.isComplete() && processedCount < violations.length) {
                        orchestrator.startPlanning();
                        await orchestrator.completePlanning();
                        orchestrator.startExecution();
                        orchestrator.completeExecution({
                            success: true,
                            selector: 'div',
                            beforeHtml: '<div>before</div>',
                            afterHtml: '<div>after</div>'
                        });
                        orchestrator.startVerification();

                        const passed = verificationResults[processedCount % verificationResults.length];
                        orchestrator.handleVerificationResult(passed);
                        processedCount++;
                    }

                    // Verify the action sequence
                    const sequence = orchestrator.getActionSequence();

                    // For each EXECUTION_COMPLETE, there should be a START_VERIFICATION after it
                    for (let i = 0; i < sequence.length; i++) {
                        if (sequence[i] === 'EXECUTION_COMPLETE') {
                            // Next action should be START_VERIFICATION
                            expect(sequence[i + 1]).toBe('START_VERIFICATION');
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should not allow skipping verification step', async () => {
        await fc.assert(
            fc.asyncProperty(
                urlArb,
                violationWithImpactArb,
                async (url, violation) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    orchestrator.startScan();
                    orchestrator.completeScan([violation], url);

                    orchestrator.startPlanning();
                    await orchestrator.completePlanning();
                    orchestrator.startExecution();
                    orchestrator.completeExecution({
                        success: true,
                        selector: violation.selector,
                        beforeHtml: '<div>before</div>',
                        afterHtml: '<div>after</div>'
                    });

                    // State should be VERIFYING, cannot skip to PLANNING
                    expect(orchestrator.state).toBe('VERIFYING');

                    // Trying to start planning should throw
                    expect(() => orchestrator.startPlanning()).toThrow();
                }
            ),
            { numRuns: 100 }
        );
    });
});
