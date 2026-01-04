/**
 * Property-based tests for Priority-Based Processing Order
 * 
 * Feature: agent-orchestration, Property 2: Priority-Based Processing Order
 * 
 * For any set of violations with mixed impact levels, the Orchestrator SHALL process
 * them in strict priority order: all critical violations before any serious,
 * all serious before any moderate, all moderate before any minor.
 * 
 * Validates: Requirements 1.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    WorkflowOrchestrator,
    IMPACT_PRIORITY,
    type ViolationWithImpact
} from '../services/workflow-orchestrator.js';
import { urlArb } from '../__generators__/session-state.generator.js';
import { violationArb, impactLevelArb } from '../__generators__/violation.generator.js';

/**
 * Generates a ViolationWithImpact with a specific impact level
 */
const violationWithSpecificImpactArb = (impact: 'critical' | 'serious' | 'moderate' | 'minor'): fc.Arbitrary<ViolationWithImpact> =>
    violationArb.map(violation => ({
        ...violation,
        impact
    }));

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
 * Generates an array of violations with mixed impact levels
 */
const mixedImpactViolationsArb: fc.Arbitrary<ViolationWithImpact[]> = fc.tuple(
    fc.array(violationWithSpecificImpactArb('critical'), { minLength: 0, maxLength: 3 }),
    fc.array(violationWithSpecificImpactArb('serious'), { minLength: 0, maxLength: 3 }),
    fc.array(violationWithSpecificImpactArb('moderate'), { minLength: 0, maxLength: 3 }),
    fc.array(violationWithSpecificImpactArb('minor'), { minLength: 0, maxLength: 3 })
).map(([critical, serious, moderate, minor]) => {
    // Shuffle the combined array to ensure random input order
    const all = [...critical, ...serious, ...moderate, ...minor];
    // Fisher-Yates shuffle
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
}).filter(arr => arr.length > 0);

describe('Feature: agent-orchestration, Property 2: Priority-Based Processing Order', () => {
    /**
     * Property 2: Priority-Based Processing Order
     * 
     * For any set of violations with mixed impact levels, the Orchestrator SHALL process
     * them in strict priority order: all critical violations before any serious,
     * all serious before any moderate, all moderate before any minor.
     * 
     * Validates: Requirements 1.2
     */

    it('should sort violations by impact priority after scan completes', () => {
        fc.assert(
            fc.property(
                urlArb,
                mixedImpactViolationsArb,
                (url, violations) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Start and complete scan
                    orchestrator.startScan();
                    orchestrator.completeScan(violations, url);

                    // Get the processing order
                    const sortedViolations = orchestrator.violations;

                    // Verify violations are sorted by priority
                    for (let i = 1; i < sortedViolations.length; i++) {
                        const prevPriority = IMPACT_PRIORITY[sortedViolations[i - 1].impact];
                        const currPriority = IMPACT_PRIORITY[sortedViolations[i].impact];
                        expect(prevPriority).toBeLessThanOrEqual(currPriority);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should process all critical violations before any serious violations', () => {
        fc.assert(
            fc.property(
                urlArb,
                fc.tuple(
                    fc.array(violationWithSpecificImpactArb('critical'), { minLength: 1, maxLength: 3 }),
                    fc.array(violationWithSpecificImpactArb('serious'), { minLength: 1, maxLength: 3 })
                ),
                (url, [criticalViolations, seriousViolations]) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Shuffle and combine violations
                    const allViolations = [...seriousViolations, ...criticalViolations];

                    orchestrator.startScan();
                    orchestrator.completeScan(allViolations, url);

                    const sortedViolations = orchestrator.violations;

                    // Find the last critical and first serious
                    let lastCriticalIndex = -1;
                    let firstSeriousIndex = sortedViolations.length;

                    sortedViolations.forEach((v, i) => {
                        if (v.impact === 'critical') lastCriticalIndex = i;
                        if (v.impact === 'serious' && i < firstSeriousIndex) firstSeriousIndex = i;
                    });

                    // All critical should come before all serious
                    if (lastCriticalIndex !== -1 && firstSeriousIndex !== sortedViolations.length) {
                        expect(lastCriticalIndex).toBeLessThan(firstSeriousIndex);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should process all serious violations before any moderate violations', () => {
        fc.assert(
            fc.property(
                urlArb,
                fc.tuple(
                    fc.array(violationWithSpecificImpactArb('serious'), { minLength: 1, maxLength: 3 }),
                    fc.array(violationWithSpecificImpactArb('moderate'), { minLength: 1, maxLength: 3 })
                ),
                (url, [seriousViolations, moderateViolations]) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Shuffle and combine violations
                    const allViolations = [...moderateViolations, ...seriousViolations];

                    orchestrator.startScan();
                    orchestrator.completeScan(allViolations, url);

                    const sortedViolations = orchestrator.violations;

                    // Find the last serious and first moderate
                    let lastSeriousIndex = -1;
                    let firstModerateIndex = sortedViolations.length;

                    sortedViolations.forEach((v, i) => {
                        if (v.impact === 'serious') lastSeriousIndex = i;
                        if (v.impact === 'moderate' && i < firstModerateIndex) firstModerateIndex = i;
                    });

                    // All serious should come before all moderate
                    if (lastSeriousIndex !== -1 && firstModerateIndex !== sortedViolations.length) {
                        expect(lastSeriousIndex).toBeLessThan(firstModerateIndex);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should process all moderate violations before any minor violations', () => {
        fc.assert(
            fc.property(
                urlArb,
                fc.tuple(
                    fc.array(violationWithSpecificImpactArb('moderate'), { minLength: 1, maxLength: 3 }),
                    fc.array(violationWithSpecificImpactArb('minor'), { minLength: 1, maxLength: 3 })
                ),
                (url, [moderateViolations, minorViolations]) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Shuffle and combine violations
                    const allViolations = [...minorViolations, ...moderateViolations];

                    orchestrator.startScan();
                    orchestrator.completeScan(allViolations, url);

                    const sortedViolations = orchestrator.violations;

                    // Find the last moderate and first minor
                    let lastModerateIndex = -1;
                    let firstMinorIndex = sortedViolations.length;

                    sortedViolations.forEach((v, i) => {
                        if (v.impact === 'moderate') lastModerateIndex = i;
                        if (v.impact === 'minor' && i < firstMinorIndex) firstMinorIndex = i;
                    });

                    // All moderate should come before all minor
                    if (lastModerateIndex !== -1 && firstMinorIndex !== sortedViolations.length) {
                        expect(lastModerateIndex).toBeLessThan(firstMinorIndex);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should maintain priority order in session state pending violations', () => {
        fc.assert(
            fc.property(
                urlArb,
                mixedImpactViolationsArb,
                (url, violations) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    orchestrator.startScan();
                    orchestrator.completeScan(violations, url);

                    // Get pending violations from session state
                    const pendingIds = orchestrator.sessionManager.getPendingViolations();
                    const sortedViolations = orchestrator.violations;

                    // Pending IDs should match the sorted order
                    expect(pendingIds).toEqual(sortedViolations.map(v => v.id));
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should return first critical violation as next to process', () => {
        fc.assert(
            fc.property(
                urlArb,
                fc.tuple(
                    fc.array(violationWithSpecificImpactArb('critical'), { minLength: 1, maxLength: 2 }),
                    fc.array(violationWithSpecificImpactArb('serious'), { minLength: 1, maxLength: 2 }),
                    fc.array(violationWithSpecificImpactArb('moderate'), { minLength: 1, maxLength: 2 }),
                    fc.array(violationWithSpecificImpactArb('minor'), { minLength: 1, maxLength: 2 })
                ),
                (url, [critical, serious, moderate, minor]) => {
                    const orchestrator = new WorkflowOrchestrator(url);

                    // Combine in reverse priority order
                    const allViolations = [...minor, ...moderate, ...serious, ...critical];

                    orchestrator.startScan();
                    orchestrator.completeScan(allViolations, url);

                    // The next violation to process should be critical
                    const nextId = orchestrator.sessionManager.getNextPendingViolation();
                    const nextViolation = orchestrator.violations.find(v => v.id === nextId);

                    expect(nextViolation?.impact).toBe('critical');
                }
            ),
            { numRuns: 100 }
        );
    });
});
