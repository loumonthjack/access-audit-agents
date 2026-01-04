/**
 * fast-check arbitraries for FixInstruction and related types
 * 
 * Feature: agent-orchestration
 */

import * as fc from 'fast-check';
import type {
    AttributeFixParams,
    ContentFixParams,
    StyleFixParams,
    FixInstruction,
    FixType
} from '../types/index.js';

/**
 * Generates a valid CSS selector
 */
export const selectorArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('#main-content'),
    fc.constant('.btn-primary'),
    fc.constant('img[src]'),
    fc.constant('button.submit'),
    fc.constant('a[href="#"]'),
    fc.constant('input[type="text"]'),
    fc.stringMatching(/^[a-z]+(\.[a-z-]+)?$/)
);

/**
 * Generates a valid HTML attribute name
 */
export const attributeNameArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('alt'),
    fc.constant('aria-label'),
    fc.constant('aria-describedby'),
    fc.constant('role'),
    fc.constant('tabindex'),
    fc.constant('title'),
    fc.stringMatching(/^[a-z][a-z-]*$/)
);

/**
 * Generates a valid attribute value
 */
export const attributeValueArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 200 });

/**
 * Generates a reasoning string
 */
export const reasoningArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 500 });

/**
 * Generates a violation ID
 */
export const violationIdArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-z]+-[a-z]+-[0-9]+$/);

/**
 * Generates AttributeFixParams
 */
export const attributeFixParamsArb: fc.Arbitrary<AttributeFixParams> = fc.record({
    selector: selectorArb,
    attribute: attributeNameArb,
    value: attributeValueArb,
    reasoning: reasoningArb
});

/**
 * Generates a SHA-256 hash string (64 hex characters)
 */
export const sha256HashArb: fc.Arbitrary<string> = fc.hexaString({ minLength: 64, maxLength: 64 });

/**
 * Generates ContentFixParams
 */
export const contentFixParamsArb: fc.Arbitrary<ContentFixParams> = fc.record({
    selector: selectorArb,
    innerText: fc.string({ minLength: 0, maxLength: 500 }),
    originalTextHash: sha256HashArb
});

/**
 * Generates a CSS class name
 */
export const cssClassArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant(''),
    fc.constant('high-contrast'),
    fc.constant('focus-visible'),
    fc.constant('sr-only'),
    fc.stringMatching(/^[a-z][a-z0-9-]*$/)
);

/**
 * Generates CSS property name
 */
export const cssPropertyArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('color'),
    fc.constant('background-color'),
    fc.constant('font-size'),
    fc.constant('outline'),
    fc.constant('border')
);

/**
 * Generates CSS property value
 */
export const cssValueArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('#000000'),
    fc.constant('#ffffff'),
    fc.constant('16px'),
    fc.constant('2px solid blue'),
    fc.constant('inherit')
);

/**
 * Generates a styles object
 */
export const stylesArb: fc.Arbitrary<Record<string, string>> = fc.oneof(
    fc.constant({}),
    fc.record({
        color: cssValueArb
    }),
    fc.dictionary(cssPropertyArb, cssValueArb, { minKeys: 0, maxKeys: 5 })
);

/**
 * Generates StyleFixParams
 */
export const styleFixParamsArb: fc.Arbitrary<StyleFixParams> = fc.record({
    selector: selectorArb,
    cssClass: cssClassArb,
    styles: stylesArb
});

/**
 * Generates a FixType
 */
export const fixTypeArb: fc.Arbitrary<FixType> = fc.constantFrom('attribute', 'content', 'style');

/**
 * Generates a FixInstruction for attribute type
 */
export const attributeFixInstructionArb: fc.Arbitrary<FixInstruction> = attributeFixParamsArb.map(params => ({
    type: 'attribute' as const,
    selector: params.selector,
    violationId: `violation-${Math.random().toString(36).substring(7)}`,
    reasoning: params.reasoning,
    params
}));

/**
 * Generates a FixInstruction for content type
 */
export const contentFixInstructionArb: fc.Arbitrary<FixInstruction> = contentFixParamsArb.map(params => ({
    type: 'content' as const,
    selector: params.selector,
    violationId: `violation-${Math.random().toString(36).substring(7)}`,
    reasoning: 'Content fix reasoning',
    params
}));

/**
 * Generates a FixInstruction for style type
 */
export const styleFixInstructionArb: fc.Arbitrary<FixInstruction> = styleFixParamsArb.map(params => ({
    type: 'style' as const,
    selector: params.selector,
    violationId: `violation-${Math.random().toString(36).substring(7)}`,
    reasoning: 'Style fix reasoning',
    params
}));

/**
 * Generates a FixInstruction of any type
 */
export const fixInstructionArb: fc.Arbitrary<FixInstruction> = fc.oneof(
    attributeFixInstructionArb,
    contentFixInstructionArb,
    styleFixInstructionArb
);

/**
 * Generates a pair of text and its SHA-256 hash
 * This is useful for testing content hash validation
 */
export const textWithHashArb: fc.Arbitrary<{ text: string; hash: string }> = fc
    .string({ minLength: 0, maxLength: 500 })
    .map(text => {
        // We'll compute the hash at test time since we need async
        return { text, hash: '' };
    });

/**
 * Generates a pair of different texts (for testing hash mismatch)
 */
export const differentTextsArb: fc.Arbitrary<{ original: string; modified: string }> = fc
    .tuple(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 })
    )
    .filter(([a, b]) => a !== b)
    .map(([original, modified]) => ({ original, modified }));


// ============================================================================
// Generators for Safety Testing
// ============================================================================

/**
 * Interactive element selectors for safety testing
 */
export const interactiveElementSelectorArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('button'),
    fc.constant('button.submit'),
    fc.constant('button#save'),
    fc.constant('button[type="submit"]'),
    fc.constant('a'),
    fc.constant('a.nav-link'),
    fc.constant('a[href="/home"]'),
    fc.constant('input'),
    fc.constant('input[type="text"]'),
    fc.constant('input#email'),
    fc.constant('select'),
    fc.constant('select.dropdown'),
    fc.constant('textarea'),
    fc.constant('textarea#comments'),
    fc.constant('form'),
    fc.constant('form#login')
);

/**
 * Non-interactive element selectors
 */
export const nonInteractiveElementSelectorArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('div'),
    fc.constant('div.container'),
    fc.constant('span'),
    fc.constant('p'),
    fc.constant('img'),
    fc.constant('img[src]'),
    fc.constant('h1'),
    fc.constant('section'),
    fc.constant('article'),
    fc.constant('header'),
    fc.constant('footer'),
    fc.constant('#main-content'),
    fc.constant('.content-wrapper')
);

/**
 * Generates a destructive fix instruction (targets interactive element with empty content)
 */
export const destructiveFixInstructionArb: fc.Arbitrary<FixInstruction> = fc.oneof(
    // Content fix that clears text on interactive element
    interactiveElementSelectorArb.map(selector => ({
        type: 'content' as const,
        selector,
        violationId: `violation-${Math.random().toString(36).substring(7)}`,
        reasoning: 'Clearing content',
        params: {
            selector,
            innerText: '',
            originalTextHash: 'a'.repeat(64)
        }
    })),
    // Attribute fix that removes href from link
    fc.constant({
        type: 'attribute' as const,
        selector: 'a.nav-link',
        violationId: 'violation-destructive-1',
        reasoning: 'Removing href',
        params: {
            selector: 'a.nav-link',
            attribute: 'href',
            value: '',
            reasoning: 'Removing href'
        }
    }),
    // Attribute fix that removes type from input
    fc.constant({
        type: 'attribute' as const,
        selector: 'input#email',
        violationId: 'violation-destructive-2',
        reasoning: 'Removing type',
        params: {
            selector: 'input#email',
            attribute: 'type',
            value: '',
            reasoning: 'Removing type'
        }
    })
);

/**
 * Generates a safe fix instruction (non-destructive)
 */
export const safeFixInstructionArb: fc.Arbitrary<FixInstruction> = fc.oneof(
    // Attribute fix on non-interactive element
    nonInteractiveElementSelectorArb.chain(selector =>
        fc.record({
            type: fc.constant('attribute' as const),
            selector: fc.constant(selector),
            violationId: violationIdArb,
            reasoning: reasoningArb,
            params: fc.record({
                selector: fc.constant(selector),
                attribute: fc.constant('alt'),
                value: fc.string({ minLength: 1, maxLength: 100 }),
                reasoning: reasoningArb
            })
        })
    ),
    // Style fix on any element (styles are generally safe)
    selectorArb.chain(selector =>
        fc.record({
            type: fc.constant('style' as const),
            selector: fc.constant(selector),
            violationId: violationIdArb,
            reasoning: reasoningArb,
            params: fc.record({
                selector: fc.constant(selector),
                cssClass: cssClassArb,
                styles: stylesArb
            })
        })
    ),
    // Content fix with non-empty, non-whitespace text on interactive element
    interactiveElementSelectorArb.chain(selector =>
        fc.record({
            type: fc.constant('content' as const),
            selector: fc.constant(selector),
            violationId: violationIdArb,
            reasoning: reasoningArb,
            params: fc.record({
                selector: fc.constant(selector),
                // Use stringMatching to ensure at least one non-whitespace character
                innerText: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,99}$/),
                originalTextHash: sha256HashArb
            })
        })
    )
);

/**
 * Generates an invalid fix instruction (fails schema validation)
 */
export const invalidFixInstructionArb: fc.Arbitrary<unknown> = fc.oneof(
    // Missing required fields
    fc.constant({ type: 'attribute' }),
    fc.constant({ selector: 'div' }),
    fc.constant({}),
    // Invalid type
    fc.constant({
        type: 'invalid',
        selector: 'div',
        violationId: 'v-1',
        reasoning: 'test',
        params: {}
    }),
    // Empty selector
    fc.constant({
        type: 'attribute',
        selector: '',
        violationId: 'v-1',
        reasoning: 'test',
        params: {
            selector: '',
            attribute: 'alt',
            value: 'test',
            reasoning: 'test'
        }
    }),
    // Empty violationId
    fc.constant({
        type: 'attribute',
        selector: 'div',
        violationId: '',
        reasoning: 'test',
        params: {
            selector: 'div',
            attribute: 'alt',
            value: 'test',
            reasoning: 'test'
        }
    }),
    // Non-object
    fc.constant(null),
    fc.constant('string'),
    fc.constant(123)
);
