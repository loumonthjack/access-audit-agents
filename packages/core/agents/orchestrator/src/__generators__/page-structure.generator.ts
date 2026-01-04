/**
 * fast-check arbitraries for PageStructure and ElementSummary types
 * 
 * Feature: agent-orchestration
 * Used for testing selector error recovery (Property 13)
 */

import * as fc from 'fast-check';
import type { PageStructure, ElementSummary } from '../services/error-recovery.js';

// ============================================================================
// Element Summary Generators
// ============================================================================

/**
 * Generates a valid CSS selector
 */
export const selectorArb: fc.Arbitrary<string> = fc.oneof(
    // ID selectors
    fc.stringMatching(/^[a-z][a-z0-9-]*$/).map(id => `#${id}`),
    // Class selectors
    fc.stringMatching(/^[a-z][a-z0-9-]*$/).map(cls => `.${cls}`),
    // Tag selectors
    fc.constantFrom('div', 'span', 'button', 'a', 'input', 'img', 'p', 'h1', 'h2', 'nav', 'main', 'header', 'footer'),
    // Combined selectors
    fc.tuple(
        fc.constantFrom('div', 'button', 'a', 'input', 'img'),
        fc.stringMatching(/^[a-z][a-z0-9-]*$/)
    ).map(([tag, cls]) => `${tag}.${cls}`),
    // Attribute selectors
    fc.tuple(
        fc.constantFrom('button', 'a', 'input'),
        fc.constantFrom('aria-label', 'role', 'type'),
        fc.stringMatching(/^[a-z][a-z0-9 -]*$/)
    ).map(([tag, attr, val]) => `${tag}[${attr}="${val}"]`)
);

/**
 * Generates a tag name
 */
export const tagNameArb: fc.Arbitrary<string> = fc.constantFrom(
    'div', 'span', 'button', 'a', 'input', 'img', 'p', 'h1', 'h2', 'h3',
    'nav', 'main', 'header', 'footer', 'section', 'article', 'aside',
    'form', 'select', 'textarea', 'label'
);

/**
 * Generates an ARIA role
 */
export const roleArb: fc.Arbitrary<string> = fc.constantFrom(
    'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
    'navigation', 'main', 'banner', 'contentinfo', 'complementary',
    'region', 'heading', 'img', 'list', 'listitem', 'menuitem', 'tab'
);

/**
 * Generates element text content
 */
export const elementTextArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('Submit'),
    fc.constant('Cancel'),
    fc.constant('Click here'),
    fc.constant('Learn more'),
    fc.constant('Navigation'),
    fc.constant('Main content'),
    fc.constant('Search'),
    fc.stringMatching(/^[A-Z][a-z]+ [a-z]+$/)
);

/**
 * Generates an ElementSummary for interactive elements
 */
export const interactiveElementSummaryArb: fc.Arbitrary<ElementSummary> = fc.record({
    selector: fc.oneof(
        fc.stringMatching(/^[a-z][a-z0-9-]*$/).map(id => `#${id}`),
        fc.tuple(
            fc.constantFrom('button', 'a', 'input'),
            fc.stringMatching(/^[a-z][a-z0-9-]*$/)
        ).map(([tag, cls]) => `${tag}.${cls}`)
    ),
    tagName: fc.constantFrom('button', 'a', 'input', 'select', 'textarea'),
    role: fc.option(fc.constantFrom('button', 'link', 'textbox', 'combobox'), { nil: undefined }),
    text: fc.option(elementTextArb, { nil: undefined })
}).map(({ selector, tagName, role, text }) => {
    const result: ElementSummary = { selector, tagName };
    if (role !== undefined) result.role = role;
    if (text !== undefined) result.text = text;
    return result;
});

/**
 * Generates an ElementSummary for landmark elements
 */
export const landmarkElementSummaryArb: fc.Arbitrary<ElementSummary> = fc.record({
    selector: fc.oneof(
        fc.constant('nav'),
        fc.constant('main'),
        fc.constant('header'),
        fc.constant('footer'),
        fc.stringMatching(/^[a-z][a-z0-9-]*$/).map(id => `#${id}`)
    ),
    tagName: fc.constantFrom('nav', 'main', 'header', 'footer', 'aside', 'section'),
    role: fc.option(fc.constantFrom('navigation', 'main', 'banner', 'contentinfo', 'complementary', 'region'), { nil: undefined }),
    text: fc.option(elementTextArb, { nil: undefined })
}).map(({ selector, tagName, role, text }) => {
    const result: ElementSummary = { selector, tagName };
    if (role !== undefined) result.role = role;
    if (text !== undefined) result.text = text;
    return result;
});

/**
 * Generates an ElementSummary for heading elements
 */
export const headingElementSummaryArb: fc.Arbitrary<ElementSummary> = fc.record({
    selector: fc.oneof(
        fc.constantFrom('h1', 'h2', 'h3', 'h4', 'h5', 'h6'),
        fc.stringMatching(/^[a-z][a-z0-9-]*$/).map(id => `h1#${id}`)
    ),
    tagName: fc.constantFrom('h1', 'h2', 'h3', 'h4', 'h5', 'h6'),
    role: fc.option(fc.constant('heading'), { nil: undefined }),
    text: fc.option(elementTextArb, { nil: undefined })
}).map(({ selector, tagName, role, text }) => {
    const result: ElementSummary = { selector, tagName };
    if (role !== undefined) result.role = role;
    if (text !== undefined) result.text = text;
    return result;
});

/**
 * Generates any ElementSummary
 */
export const elementSummaryArb: fc.Arbitrary<ElementSummary> = fc.oneof(
    interactiveElementSummaryArb,
    landmarkElementSummaryArb,
    headingElementSummaryArb
);

// ============================================================================
// Page Structure Generators
// ============================================================================

/**
 * Generates a PageStructure with at least one element
 */
export const pageStructureArb: fc.Arbitrary<PageStructure> = fc.record({
    interactiveElements: fc.array(interactiveElementSummaryArb, { minLength: 1, maxLength: 10 }),
    landmarks: fc.array(landmarkElementSummaryArb, { minLength: 0, maxLength: 5 }),
    headings: fc.array(headingElementSummaryArb, { minLength: 0, maxLength: 5 })
});

/**
 * Generates an empty PageStructure
 */
export const emptyPageStructureArb: fc.Arbitrary<PageStructure> = fc.constant({
    interactiveElements: [],
    landmarks: [],
    headings: []
});

/**
 * Generates a PageStructure with a specific element included
 * Useful for testing that fuzzy matching finds the correct element
 */
export const pageStructureWithElementArb = (element: ElementSummary): fc.Arbitrary<PageStructure> => {
    return fc.record({
        interactiveElements: fc.array(interactiveElementSummaryArb, { minLength: 0, maxLength: 5 })
            .map(elements => [...elements, element]),
        landmarks: fc.array(landmarkElementSummaryArb, { minLength: 0, maxLength: 3 }),
        headings: fc.array(headingElementSummaryArb, { minLength: 0, maxLength: 3 })
    });
};

// ============================================================================
// Selector Variation Generators (for fuzzy matching tests)
// ============================================================================

/**
 * Generates a slightly modified version of a selector (simulating AI hallucination)
 */
export const modifiedSelectorArb = (originalSelector: string): fc.Arbitrary<string> => {
    return fc.oneof(
        // Add typo
        fc.constant(originalSelector.replace(/[aeiou]/, 'x')),
        // Change case
        fc.constant(originalSelector.toUpperCase()),
        // Add extra class
        fc.constant(`${originalSelector}.extra-class`),
        // Remove part of selector
        fc.constant(originalSelector.split('.')[0] ?? originalSelector),
        // Add attribute
        fc.constant(`${originalSelector}[data-test]`),
        // Swap characters
        fc.constant(originalSelector.length > 2
            ? originalSelector.slice(0, -2) + originalSelector.slice(-1) + originalSelector.slice(-2, -1)
            : originalSelector
        )
    );
};

/**
 * Generates a pair of (original element, modified selector) for testing fuzzy matching
 */
export const elementWithModifiedSelectorArb: fc.Arbitrary<{
    element: ElementSummary;
    modifiedSelector: string;
}> = elementSummaryArb.chain(element =>
    modifiedSelectorArb(element.selector).map(modifiedSelector => ({
        element,
        modifiedSelector
    }))
);

/**
 * Generates a completely different selector (should not match)
 */
export const unmatchableSelectorArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('#completely-nonexistent-element-xyz123'),
    fc.constant('.this-class-does-not-exist-anywhere'),
    fc.constant('nonexistent-tag-name'),
    fc.stringMatching(/^#[a-z]{20,30}$/)
);
