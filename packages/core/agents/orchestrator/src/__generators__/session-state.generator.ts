/**
 * fast-check arbitraries for SessionState and related types
 * 
 * Feature: agent-orchestration
 */

import * as fc from 'fast-check';
import type { SessionState, SessionStateAttributes } from '../types/index.js';

/**
 * Generates a valid URL string
 */
export const urlArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('https://example.com'),
    fc.constant('https://test.example.org/page'),
    fc.constant('https://www.example.net/path/to/page'),
    fc.webUrl()
);

/**
 * Generates a violation ID
 */
export const violationIdArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-z]+-[a-z]+-[0-9]+$/);

/**
 * Generates a JSON array string of violation IDs
 */
export const violationIdsJsonArb: fc.Arbitrary<string> = fc.array(violationIdArb, { maxLength: 20 })
    .map(ids => JSON.stringify(ids));

/**
 * Generates a nullable string for current_violation_id
 */
export const currentViolationIdArb: fc.Arbitrary<string | null> = fc.oneof(
    fc.constant(null),
    violationIdArb
);

/**
 * Generates a nullable string for human_handoff_reason
 */
export const humanHandoffReasonArb: fc.Arbitrary<string | null> = fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 200 })
);

/**
 * Generates SessionStateAttributes
 */
export const sessionStateAttributesArb: fc.Arbitrary<SessionStateAttributes> = fc.record({
    current_url: urlArb,
    pending_violations: violationIdsJsonArb,
    current_violation_id: currentViolationIdArb,
    retry_attempts: fc.nat({ max: 10 }),
    human_handoff_reason: humanHandoffReasonArb,
    fixed_violations: violationIdsJsonArb,
    skipped_violations: violationIdsJsonArb
});

/**
 * Generates a complete, valid SessionState
 */
export const sessionStateArb: fc.Arbitrary<SessionState> = sessionStateAttributesArb
    .map(sessionAttributes => ({ sessionAttributes }));

/**
 * Generates a SessionState with specific pending violations count
 */
export function sessionStateWithPendingCount(count: number): fc.Arbitrary<SessionState> {
    return fc.array(violationIdArb, { minLength: count, maxLength: count })
        .chain(pendingIds => fc.record({
            sessionAttributes: fc.record({
                current_url: urlArb,
                pending_violations: fc.constant(JSON.stringify(pendingIds)),
                current_violation_id: count > 0 ? fc.constant(pendingIds[0] ?? null) : fc.constant(null),
                retry_attempts: fc.nat({ max: 3 }),
                human_handoff_reason: fc.constant(null),
                fixed_violations: violationIdsJsonArb,
                skipped_violations: violationIdsJsonArb
            })
        }));
}

/**
 * Generates a SessionState at the three-strike threshold
 */
export const sessionStateAtThreeStrikeArb: fc.Arbitrary<SessionState> = fc.record({
    sessionAttributes: fc.record({
        current_url: urlArb,
        pending_violations: fc.array(violationIdArb, { minLength: 1, maxLength: 5 })
            .map(ids => JSON.stringify(ids)),
        current_violation_id: violationIdArb,
        retry_attempts: fc.constant(3),
        human_handoff_reason: fc.constant(null),
        fixed_violations: violationIdsJsonArb,
        skipped_violations: violationIdsJsonArb
    })
});
