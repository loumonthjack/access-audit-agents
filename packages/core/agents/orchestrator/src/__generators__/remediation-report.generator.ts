/**
 * fast-check arbitraries for RemediationReport and related types
 * 
 * Feature: agent-orchestration
 */

import * as fc from 'fast-check';
import type {
    RemediationReport,
    AppliedFix,
    SkippedViolation,
    HumanHandoffItem,
    FixType,
    ReportSummary
} from '../types/index.js';

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
 * Generates an ISO 8601 timestamp
 */
export const timestampArb: fc.Arbitrary<string> = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31')
}).map(d => d.toISOString());

/**
 * Generates a session ID
 */
export const sessionIdArb: fc.Arbitrary<string> = fc.uuid();

/**
 * Generates a violation ID
 */
export const violationIdArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-z]+-[a-z]+-[0-9]+$/);

/**
 * Generates a rule ID
 */
export const ruleIdArb: fc.Arbitrary<string> = fc.constantFrom(
    'image-alt',
    'img-alt',
    'color-contrast',
    'focus-visible',
    'keyboard-navigation',
    'tabindex',
    'aria-label',
    'button-name',
    'link-name'
);

/**
 * Generates a CSS selector
 */
export const selectorArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('#main-content'),
    fc.constant('.hero-image'),
    fc.constant('button.submit'),
    fc.constant('a[href="/home"]'),
    fc.stringMatching(/^[a-z]+(\.[a-z-]+)?$/)
);

/**
 * Generates a fix type
 */
export const fixTypeArb: fc.Arbitrary<FixType> = fc.constantFrom('attribute', 'content', 'style');

/**
 * Generates HTML snippet
 */
export const htmlSnippetArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('<img src="photo.jpg">'),
    fc.constant('<img src="photo.jpg" alt="A descriptive alt text">'),
    fc.constant('<button>Click</button>'),
    fc.constant('<button aria-label="Submit form">Click</button>'),
    fc.constant('<a href="/home">Home</a>')
);

/**
 * Generates reasoning text
 */
export const reasoningArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('Added alt text to describe the image content'),
    fc.constant('Added aria-label for better screen reader support'),
    fc.constant('Adjusted color contrast to meet WCAG AA requirements'),
    fc.constant('Added tabindex for keyboard navigation'),
    fc.string({ minLength: 10, maxLength: 200 })
);

/**
 * Generates an AppliedFix
 */
export const appliedFixArb: fc.Arbitrary<AppliedFix> = fc.record({
    violationId: violationIdArb,
    ruleId: ruleIdArb,
    selector: selectorArb,
    fixType: fixTypeArb,
    beforeHtml: htmlSnippetArb,
    afterHtml: htmlSnippetArb,
    reasoning: reasoningArb
});

/**
 * Generates a SkippedViolation
 */
export const skippedViolationArb: fc.Arbitrary<SkippedViolation> = fc.record({
    violationId: violationIdArb,
    ruleId: ruleIdArb,
    selector: selectorArb,
    reason: fc.oneof(
        fc.constant('Maximum retry attempts exceeded'),
        fc.constant('Selector not found after recovery attempts'),
        fc.constant('Fix would cause destructive change'),
        fc.string({ minLength: 10, maxLength: 100 })
    ),
    attempts: fc.integer({ min: 1, max: 3 })
});

/**
 * Generates a HumanHandoffItem
 */
export const humanHandoffItemArb: fc.Arbitrary<HumanHandoffItem> = fc.record({
    violationId: violationIdArb,
    ruleId: ruleIdArb,
    selector: selectorArb,
    reason: fc.oneof(
        fc.constant('Complex interaction pattern requires manual review'),
        fc.constant('Fix would remove interactive element'),
        fc.constant('Unable to determine appropriate fix'),
        fc.string({ minLength: 10, maxLength: 100 })
    ),
    suggestedAction: fc.oneof(
        fc.constant('Review element and add appropriate ARIA attributes'),
        fc.constant('Consider restructuring the component'),
        fc.constant('Manual color adjustment recommended'),
        fc.string({ minLength: 10, maxLength: 100 })
    )
});


/**
 * Generates a ReportSummary with accurate counts based on arrays
 */
export function reportSummaryFromArrays(
    fixes: AppliedFix[],
    skipped: SkippedViolation[],
    pending: number = 0
): ReportSummary {
    return {
        totalViolations: fixes.length + skipped.length + pending,
        fixedCount: fixes.length,
        skippedCount: skipped.length,
        pendingCount: pending
    };
}

/**
 * Generates a complete, valid RemediationReport with accurate counts
 * Property 15: Report Count Accuracy - counts match array lengths
 */
export const remediationReportArb: fc.Arbitrary<RemediationReport> = fc.tuple(
    fc.array(appliedFixArb, { maxLength: 20 }),
    fc.array(skippedViolationArb, { maxLength: 10 }),
    fc.array(humanHandoffItemArb, { maxLength: 5 }),
    fc.nat({ max: 10 }) // pending count
).chain(([fixes, skipped, humanHandoff, pendingCount]) => {
    const summary = reportSummaryFromArrays(fixes, skipped, pendingCount);

    return fc.record({
        sessionId: sessionIdArb,
        url: urlArb,
        timestamp: timestampArb,
        summary: fc.constant(summary),
        fixes: fc.constant(fixes),
        skipped: fc.constant(skipped),
        humanHandoff: fc.constant(humanHandoff)
    });
});

/**
 * Generates a RemediationReport with specific counts
 */
export function remediationReportWithCounts(
    fixedCount: number,
    skippedCount: number,
    pendingCount: number
): fc.Arbitrary<RemediationReport> {
    return fc.tuple(
        fc.array(appliedFixArb, { minLength: fixedCount, maxLength: fixedCount }),
        fc.array(skippedViolationArb, { minLength: skippedCount, maxLength: skippedCount }),
        fc.array(humanHandoffItemArb, { maxLength: 5 })
    ).chain(([fixes, skipped, humanHandoff]) => {
        const summary: ReportSummary = {
            totalViolations: fixedCount + skippedCount + pendingCount,
            fixedCount,
            skippedCount,
            pendingCount
        };

        return fc.record({
            sessionId: sessionIdArb,
            url: urlArb,
            timestamp: timestampArb,
            summary: fc.constant(summary),
            fixes: fc.constant(fixes),
            skipped: fc.constant(skipped),
            humanHandoff: fc.constant(humanHandoff)
        });
    });
}

/**
 * Generates a RemediationReport with INACCURATE counts (for negative testing)
 * This is useful for testing that validation catches count mismatches
 */
export const remediationReportWithInaccurateCountsArb: fc.Arbitrary<RemediationReport> = fc.tuple(
    fc.array(appliedFixArb, { minLength: 1, maxLength: 10 }),
    fc.array(skippedViolationArb, { maxLength: 5 }),
    fc.array(humanHandoffItemArb, { maxLength: 3 }),
    fc.nat({ max: 5 })
).chain(([fixes, skipped, humanHandoff, pendingCount]) => {
    // Intentionally create inaccurate summary
    const inaccurateSummary: ReportSummary = {
        totalViolations: fixes.length + skipped.length + pendingCount + 1, // Off by 1
        fixedCount: fixes.length + 1, // Off by 1
        skippedCount: skipped.length,
        pendingCount
    };

    return fc.record({
        sessionId: sessionIdArb,
        url: urlArb,
        timestamp: timestampArb,
        summary: fc.constant(inaccurateSummary),
        fixes: fc.constant(fixes),
        skipped: fc.constant(skipped),
        humanHandoff: fc.constant(humanHandoff)
    });
});
