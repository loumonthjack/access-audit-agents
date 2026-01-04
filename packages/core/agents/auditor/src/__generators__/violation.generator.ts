/**
 * fast-check arbitraries for Violation and related types
 * 
 * Feature: core-auditor-agent
 */

import * as fc from 'fast-check';
import type { ImpactLevel, Violation, ViolationNode } from '../types/index.js';

/**
 * Generates a random ImpactLevel
 */
export const impactLevelArb: fc.Arbitrary<ImpactLevel> = fc.constantFrom(
    'critical',
    'serious',
    'moderate',
    'minor'
);

/**
 * Generates a valid CSS selector string
 */
export const selectorArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('#main'),
    fc.constant('.button'),
    fc.constant('div.container'),
    fc.constant('button[type="submit"]'),
    fc.constant('a.nav-link'),
    fc.constant('#header > nav'),
    fc.constant('.form-group input'),
    fc.stringMatching(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)?$/)
);

/**
 * Generates a valid HTML snippet
 */
export const htmlSnippetArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('<button>Click me</button>'),
    fc.constant('<a href="#">Link</a>'),
    fc.constant('<input type="text" />'),
    fc.constant('<img src="image.png" />'),
    fc.constant('<div class="container">Content</div>'),
    fc.string({ minLength: 1, maxLength: 200 }).map(s => `<span>${s}</span>`)
);

/**
 * Generates a failure summary string
 */
export const failureSummaryArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('Fix any of the following: Element has no accessible name'),
    fc.constant('Fix any of the following: Element does not have an alt attribute'),
    fc.constant('Fix any of the following: Element has insufficient color contrast'),
    fc.constant('Fix any of the following: Form element does not have a label'),
    fc.string({ minLength: 10, maxLength: 200 })
);


/**
 * Generates a ViolationNode
 */
export const violationNodeArb: fc.Arbitrary<ViolationNode> = fc.record({
    selector: selectorArb,
    html: htmlSnippetArb,
    failureSummary: failureSummaryArb,
    target: fc.array(selectorArb, { minLength: 1, maxLength: 3 })
});

/**
 * Generates an axe-core rule ID
 */
export const ruleIdArb: fc.Arbitrary<string> = fc.constantFrom(
    'button-name',
    'color-contrast',
    'image-alt',
    'label',
    'link-name',
    'list',
    'listitem',
    'region',
    'landmark-one-main',
    'page-has-heading-one',
    'html-has-lang',
    'document-title',
    'meta-viewport',
    'bypass',
    'focus-order-semantics'
);

/**
 * Generates a help URL
 */
export const helpUrlArb: fc.Arbitrary<string> = ruleIdArb.map(
    ruleId => `https://dequeuniversity.com/rules/axe/4.10/${ruleId}`
);

/**
 * Generates a description string
 */
export const descriptionArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('Ensures buttons have discernible text'),
    fc.constant('Ensures the contrast between foreground and background colors meets WCAG 2 AA'),
    fc.constant('Ensures <img> elements have alternate text'),
    fc.constant('Ensures every form element has a label'),
    fc.constant('Ensures links have discernible text'),
    fc.string({ minLength: 10, maxLength: 150 })
);

/**
 * Generates a help string
 */
export const helpArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('Button must have discernible text'),
    fc.constant('Elements must meet minimum color contrast ratio thresholds'),
    fc.constant('Images must have alternate text'),
    fc.constant('Form elements must have labels'),
    fc.constant('Links must have discernible text'),
    fc.string({ minLength: 5, maxLength: 100 })
);

/**
 * Generates a complete Violation
 */
export const violationArb: fc.Arbitrary<Violation> = fc.record({
    id: ruleIdArb,
    impact: impactLevelArb,
    description: descriptionArb,
    help: helpArb,
    helpUrl: helpUrlArb,
    nodes: fc.array(violationNodeArb, { minLength: 1, maxLength: 5 })
});

/**
 * Generates an array of violations with specified count
 */
export function violationsArb(options?: { minLength?: number; maxLength?: number }): fc.Arbitrary<Violation[]> {
    return fc.array(violationArb, {
        minLength: options?.minLength ?? 0,
        maxLength: options?.maxLength ?? 50
    });
}
