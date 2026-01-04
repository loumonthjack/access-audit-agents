/**
 * fast-check arbitraries for Violation and PageContext types
 * 
 * Feature: agent-orchestration
 * Used for testing specialist routing (Property 12)
 */

import * as fc from 'fast-check';
import type { Violation, PageContext } from '../services/specialists/specialist-agent.js';

// ============================================================================
// Rule ID Generators by Specialist Type
// ============================================================================

/**
 * Rule IDs that should be handled by AltTextSpecialist
 */
export const altTextRuleIdArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('image-alt'),
    fc.constant('img-alt'),
    fc.constant('input-image-alt'),
    fc.constant('area-alt'),
    fc.constant('object-alt'),
    fc.constant('svg-img-alt'),
    // Variations with prefixes/suffixes
    fc.constant('wcag-image-alt'),
    fc.constant('img-alt-check'),
    fc.constant('IMAGE-ALT') // Case insensitive
);

/**
 * Rule IDs that should be handled by NavigationSpecialist
 */
export const navigationRuleIdArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('focus'),
    fc.constant('focus-order'),
    fc.constant('focus-visible'),
    fc.constant('keyboard'),
    fc.constant('keyboard-navigation'),
    fc.constant('tabindex'),
    fc.constant('tabindex-positive'),
    fc.constant('focusable'),
    fc.constant('scrollable-region-focusable'),
    fc.constant('skip-link'),
    fc.constant('bypass'),
    fc.constant('link-name'),
    fc.constant('button-name'),
    // Variations
    fc.constant('FOCUS-ORDER'), // Case insensitive
    fc.constant('keyboard-trap')
);

/**
 * Rule IDs that should be handled by ContrastSpecialist
 */
export const contrastRuleIdArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('contrast'),
    fc.constant('color-contrast'),
    fc.constant('color-contrast-enhanced'),
    fc.constant('link-in-text-block'),
    // Variations
    fc.constant('COLOR-CONTRAST'), // Case insensitive
    fc.constant('contrast-minimum')
);

/**
 * Rule IDs that should fall back to GenericAriaHandler
 */
export const genericRuleIdArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('aria-label'),
    fc.constant('aria-required'),
    fc.constant('aria-valid'),
    fc.constant('landmark'),
    fc.constant('region'),
    fc.constant('heading-order'),
    fc.constant('list'),
    fc.constant('table-header'),
    fc.constant('form-field-multiple-labels'),
    fc.constant('duplicate-id'),
    fc.constant('html-lang'),
    fc.constant('meta-viewport'),
    // Random rule IDs that don't match any specialist
    fc.stringMatching(/^[a-z]+-[a-z]+$/).filter(s =>
        !s.includes('image') &&
        !s.includes('alt') &&
        !s.includes('focus') &&
        !s.includes('keyboard') &&
        !s.includes('tabindex') &&
        !s.includes('contrast') &&
        !s.includes('skip') &&
        !s.includes('bypass') &&
        !s.includes('link-name') &&
        !s.includes('button-name')
    )
);

// ============================================================================
// Impact Level Generator
// ============================================================================

export const impactLevelArb: fc.Arbitrary<'critical' | 'serious' | 'moderate' | 'minor'> =
    fc.constantFrom('critical', 'serious', 'moderate', 'minor');

// ============================================================================
// HTML Snippet Generators
// ============================================================================

export const imageHtmlArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('<img src="photo.jpg">'),
    fc.constant('<img src="logo.png" class="logo">'),
    fc.constant('<img src="banner.jpg" width="800" height="400">'),
    fc.constant('<input type="image" src="submit.png">'),
    fc.constant('<svg role="img"><title></title></svg>')
);

export const interactiveHtmlArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('<button onclick="submit()">Submit</button>'),
    fc.constant('<a href="#" class="nav-link">Link</a>'),
    fc.constant('<div onclick="click()" tabindex="5">Clickable</div>'),
    fc.constant('<input type="text" id="search">'),
    fc.constant('<select><option>Choose</option></select>')
);

export const textHtmlArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('<p style="color: #999">Light gray text</p>'),
    fc.constant('<span style="color: #ccc; background: #fff">Low contrast</span>'),
    fc.constant('<div class="text-muted">Muted text</div>'),
    fc.constant('<h1 style="color: #888">Heading</h1>')
);

export const genericHtmlArb: fc.Arbitrary<string> = fc.oneof(
    fc.constant('<div role="region">Content</div>'),
    fc.constant('<nav>Navigation</nav>'),
    fc.constant('<main>Main content</main>'),
    fc.constant('<section aria-label="">Section</section>'),
    fc.constant('<form id="login">Form</form>')
);

// ============================================================================
// Violation Generators
// ============================================================================

/**
 * Generates a violation for AltTextSpecialist
 */
export const altTextViolationArb: fc.Arbitrary<Violation> = fc.record({
    id: fc.uuid(),
    ruleId: altTextRuleIdArb,
    impact: impactLevelArb,
    selector: fc.oneof(
        fc.constant('img'),
        fc.constant('img.hero'),
        fc.constant('img[src="photo.jpg"]'),
        fc.constant('input[type="image"]'),
        fc.constant('svg[role="img"]')
    ),
    html: imageHtmlArb,
    description: fc.constant('Images must have alternate text'),
    help: fc.constant('Ensure images have alt text')
});

/**
 * Generates a violation for NavigationSpecialist
 */
export const navigationViolationArb: fc.Arbitrary<Violation> = fc.record({
    id: fc.uuid(),
    ruleId: navigationRuleIdArb,
    impact: impactLevelArb,
    selector: fc.oneof(
        fc.constant('button'),
        fc.constant('a.nav-link'),
        fc.constant('div[onclick]'),
        fc.constant('input#search'),
        fc.constant('[tabindex="5"]')
    ),
    html: interactiveHtmlArb,
    description: fc.constant('Element must be keyboard accessible'),
    help: fc.constant('Ensure element can be accessed via keyboard')
});

/**
 * Generates a violation for ContrastSpecialist
 */
export const contrastViolationArb: fc.Arbitrary<Violation> = fc.record({
    id: fc.uuid(),
    ruleId: contrastRuleIdArb,
    impact: impactLevelArb,
    selector: fc.oneof(
        fc.constant('p'),
        fc.constant('span.text'),
        fc.constant('h1'),
        fc.constant('.text-muted'),
        fc.constant('div.content')
    ),
    html: textHtmlArb,
    description: fc.constant('Element has insufficient color contrast'),
    help: fc.constant('Ensure text has sufficient contrast')
});

/**
 * Generates a violation for GenericAriaHandler
 */
export const genericViolationArb: fc.Arbitrary<Violation> = fc.record({
    id: fc.uuid(),
    ruleId: genericRuleIdArb,
    impact: impactLevelArb,
    selector: fc.oneof(
        fc.constant('div'),
        fc.constant('section'),
        fc.constant('nav'),
        fc.constant('main'),
        fc.constant('form')
    ),
    html: genericHtmlArb,
    description: fc.constant('Element has accessibility issue'),
    help: fc.constant('Fix accessibility issue')
});

/**
 * Generates any type of violation
 */
export const violationArb: fc.Arbitrary<Violation> = fc.oneof(
    altTextViolationArb,
    navigationViolationArb,
    contrastViolationArb,
    genericViolationArb
);

// ============================================================================
// PageContext Generators
// ============================================================================

/**
 * Generates a minimal PageContext
 */
export const minimalPageContextArb: fc.Arbitrary<PageContext> = fc.record({
    url: fc.webUrl()
});

/**
 * Generates a PageContext with image-related fields
 */
export const imagePageContextArb: fc.Arbitrary<PageContext> = fc.record({
    url: fc.webUrl(),
    title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    surroundingText: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    imageFilename: fc.option(
        fc.oneof(
            fc.constant('product-photo.jpg'),
            fc.constant('team-member.png'),
            fc.constant('hero-banner.webp'),
            fc.constant('logo.svg'),
            fc.constant('IMG_1234.jpg') // Generic filename
        ),
        { nil: undefined }
    )
});

/**
 * Generates a PageContext with color-related fields
 */
export const colorPageContextArb: fc.Arbitrary<PageContext> = fc.record({
    url: fc.webUrl(),
    title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    currentColors: fc.option(
        fc.record({
            foreground: fc.oneof(
                fc.constant('#999999'),
                fc.constant('#cccccc'),
                fc.constant('rgb(150, 150, 150)'),
                fc.constant('#666666')
            ),
            background: fc.oneof(
                fc.constant('#ffffff'),
                fc.constant('#f5f5f5'),
                fc.constant('rgb(255, 255, 255)'),
                fc.constant('#fafafa')
            )
        }),
        { nil: undefined }
    )
});

/**
 * Generates a full PageContext with all optional fields
 */
export const fullPageContextArb: fc.Arbitrary<PageContext> = fc.record({
    url: fc.webUrl(),
    title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    surroundingText: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    parentElement: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    siblingElements: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }), { nil: undefined }),
    imageFilename: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    imageSrc: fc.option(fc.webUrl(), { nil: undefined }),
    currentColors: fc.option(
        fc.record({
            foreground: fc.hexaString({ minLength: 6, maxLength: 6 }).map(h => `#${h}`),
            background: fc.hexaString({ minLength: 6, maxLength: 6 }).map(h => `#${h}`)
        }),
        { nil: undefined }
    )
});

/**
 * Generates a PageContext appropriate for the violation type
 */
export const pageContextForViolationArb = (violation: Violation): fc.Arbitrary<PageContext> => {
    const ruleId = violation.ruleId.toLowerCase();

    if (ruleId.includes('image') || ruleId.includes('alt')) {
        return imagePageContextArb;
    }

    if (ruleId.includes('contrast') || ruleId.includes('color')) {
        return colorPageContextArb;
    }

    return minimalPageContextArb;
};
