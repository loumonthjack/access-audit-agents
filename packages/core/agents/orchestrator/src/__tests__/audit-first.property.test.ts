/**
 * Property-based tests for Audit-First Ordering
 * 
 * Feature: agent-orchestration, Property 1: Audit-First Ordering
 * 
 * For any remediation session, the first action invoked SHALL be Auditor::ScanURL.
 * No Injector actions SHALL be called before at least one ScanURL completes successfully.
 * 
 * Validates: Requirements 1.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    WorkflowOrchestrator,
    WorkflowTransitionError,
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
    { minLength: 1, maxLength: 10 }
);

describe('Feature: agent-orchestration, Property 1: Audit-First Ordering', () => {
    /**
     * Property 1: Audit-First Ordering
     * 
     * For any remediation session, the first action invoked SHALL be Auditor::ScanURL.
     * No Injector actions SHALL be called before at least one ScanURL completes successfully.
     * 
     * Validates: Requirements 1.1
     */

    it('should not allow injector actions before scan is complete', () => {
        fc.assert(
            fc.property(
                urlArb,
                (url) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Before any scan, injector actions should be blocked
                    expect(orchestrator.canExecuteInjectorAction()).toBe(false);
                    expect(orchestrator.scanCompleted).toBe(false);

                    // Attempting to require scan complete should throw
                    expect(() => orchestrator.requireScanComplete()).toThrow(WorkflowTransitionError);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should allow injector actions only after scan completes', () => {
        fc.assert(
            fc.property(
                urlArb,
                violationsWithImpactArb,
                (url, violations) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Before scan
                    expect(orchestrator.canExecuteInjectorAction()).toBe(false);

                    // Start scan
                    orchestrator.startScan();
                    expect(orchestrator.state).toBe('SCANNING');
                    expect(orchestrator.canExecuteInjectorAction()).toBe(false);

                    // Complete scan
                    orchestrator.completeScan(violations, url);
                    expect(orchestrator.scanCompleted).toBe(true);
                    expect(orchestrator.canExecuteInjectorAction()).toBe(true);

                    // Now requireScanComplete should not throw
                    expect(() => orchestrator.requireScanComplete()).not.toThrow();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should have ScanURL as the first action in any valid workflow', () => {
        fc.assert(
            fc.property(
                urlArb,
                violationsWithImpactArb,
                (url, violations) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Execute a complete workflow
                    orchestrator.startScan();
                    orchestrator.completeScan(violations, url);

                    // Get the action sequence
                    const actionSequence = orchestrator.getActionSequence();

                    // First action must be START_SCAN
                    expect(actionSequence[0]).toBe('START_SCAN');

                    // SCAN_COMPLETE must come before any execution actions
                    const scanCompleteIndex = actionSequence.indexOf('SCAN_COMPLETE');
                    const startExecutionIndex = actionSequence.indexOf('START_EXECUTION');

                    expect(scanCompleteIndex).toBeGreaterThan(-1);

                    // If there are execution actions, they must come after scan complete
                    if (startExecutionIndex !== -1) {
                        expect(startExecutionIndex).toBeGreaterThan(scanCompleteIndex);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should block state transitions to EXECUTING without prior scan', () => {
        fc.assert(
            fc.property(
                urlArb,
                (url) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Cannot start scan from non-IDLE state after reset
                    // First, verify we start in IDLE
                    expect(orchestrator.state).toBe('IDLE');

                    // Cannot transition directly to EXECUTING
                    expect(() => {
                        // Try to force execution without scan
                        (orchestrator as unknown as { _state: string })._state = 'EXECUTING';
                        orchestrator.startExecution();
                    }).toThrow(WorkflowTransitionError);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should maintain audit-first invariant across workflow reset', () => {
        fc.assert(
            fc.property(
                urlArb,
                violationsWithImpactArb,
                (url, violations) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Complete a scan
                    orchestrator.startScan();
                    orchestrator.completeScan(violations, url);
                    expect(orchestrator.canExecuteInjectorAction()).toBe(true);

                    // Reset the workflow
                    orchestrator.reset();

                    // After reset, should be back to requiring scan
                    expect(orchestrator.canExecuteInjectorAction()).toBe(false);
                    expect(orchestrator.scanCompleted).toBe(false);
                    expect(orchestrator.state).toBe('IDLE');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should enforce scan completion even with empty violations', () => {
        fc.assert(
            fc.property(
                urlArb,
                (url) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Before scan
                    expect(orchestrator.canExecuteInjectorAction()).toBe(false);

                    // Complete scan with no violations
                    orchestrator.startScan();
                    orchestrator.completeScan([], url);

                    // Scan is still considered complete
                    expect(orchestrator.scanCompleted).toBe(true);
                    expect(orchestrator.canExecuteInjectorAction()).toBe(true);

                    // Workflow should be COMPLETE since no violations
                    expect(orchestrator.state).toBe('COMPLETE');
                }
            ),
            { numRuns: 100 }
        );
    });
});
