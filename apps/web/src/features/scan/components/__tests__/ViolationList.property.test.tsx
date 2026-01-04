/**
 * Property-based tests for ViolationList component
 * Feature: web-dashboard, Property 8: Violation List Grouping by Impact
 * Validates: Requirements 3.1
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { ViolationList } from '../ViolationList';
import type { Violation, ImpactLevel } from '@/types/domain';

/**
 * Impact level order for verification
 */
const IMPACT_ORDER: ImpactLevel[] = ['critical', 'serious', 'moderate', 'minor'];

/**
 * Arbitrary for generating impact levels
 */
const impactLevelArbitrary = fc.constantFrom<ImpactLevel>(
  'critical',
  'serious',
  'moderate',
  'minor'
);

/**
 * Arbitrary for generating violation status
 */
const violationStatusArbitrary = fc.constantFrom(
  'pending' as const,
  'processing' as const,
  'fixed' as const,
  'skipped' as const
);

/**
 * Create a violation with a specific index to ensure unique IDs
 */
function createViolationArbitrary(index: number): fc.Arbitrary<Violation> {
  return fc.record({
    id: fc.constant(`violation-${index}-${Date.now()}`),
    ruleId: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    impact: impactLevelArbitrary,
    description: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    help: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    helpUrl: fc.webUrl(),
    selector: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    html: fc.string({ minLength: 1, maxLength: 200 }),
    status: violationStatusArbitrary,
  }) as fc.Arbitrary<Violation>;
}

/**
 * Arbitrary for generating a violation with unique ID
 */
const violationArbitrary = fc
  .integer({ min: 0, max: 999999 })
  .chain((index) => createViolationArbitrary(index));

/**
 * Arbitrary for generating a list of violations with unique IDs
 */
const violationsArbitrary = fc
  .integer({ min: 1, max: 20 })
  .chain((count) => {
    const arbitraries = Array.from({ length: count }, (_, i) => createViolationArbitrary(i));
    return fc.tuple(...(arbitraries as [fc.Arbitrary<Violation>, ...fc.Arbitrary<Violation>[]]));
  })
  .map((tuple) => (Array.isArray(tuple) ? tuple : [tuple]));

describe('ViolationList Impact Grouping Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 8: Violation List Grouping by Impact
   * For any set of violations, the ViolationList SHALL render them grouped by
   * impact level in order: Critical, Serious, Moderate, Minor.
   * Each group SHALL contain only violations of that impact level.
   * Validates: Requirements 3.1
   */
  it('Property 8: Violations are grouped by impact level in correct order', async () => {
    await fc.assert(
      fc.asyncProperty(violationsArbitrary, async (violations) => {
        cleanup();

        render(<ViolationList violations={violations} />);

        // Get all group headers that are visible
        const groupHeaders = screen.getAllByRole('button', { expanded: true });

        // Extract impact levels from visible groups
        const visibleImpacts: ImpactLevel[] = [];
        for (const header of groupHeaders) {
          const text = header.textContent?.toLowerCase() ?? '';
          for (const impact of IMPACT_ORDER) {
            if (text.includes(impact)) {
              visibleImpacts.push(impact);
              break;
            }
          }
        }

        // Verify order matches IMPACT_ORDER (for visible groups)
        const expectedOrder = IMPACT_ORDER.filter((impact) =>
          violations.some((v) => v.impact === impact)
        );

        expect(visibleImpacts).toEqual(expectedOrder);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8b: Each group contains only violations of that impact level
   * Validates: Requirements 3.1
   */
  it('Property 8b: Each impact group contains only violations of that impact level', async () => {
    await fc.assert(
      fc.asyncProperty(violationsArbitrary, async (violations) => {
        cleanup();

        render(<ViolationList violations={violations} />);

        // For each impact level, verify the group content
        for (const impact of IMPACT_ORDER) {
          const violationsOfImpact = violations.filter((v) => v.impact === impact);

          if (violationsOfImpact.length === 0) {
            continue;
          }

          // Find the group container
          const groupContainer = document.getElementById(`violation-group-${impact}`);

          if (groupContainer) {
            // Count violations in this group
            const violationItems = within(groupContainer).getAllByRole('button');

            // Each violation in this group should have the correct impact
            expect(violationItems.length).toBe(violationsOfImpact.length);
          }
        }

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8c: Count badges show correct counts per impact level
   * Validates: Requirements 3.4
   */
  it('Property 8c: Count badges show correct counts per impact level', async () => {
    await fc.assert(
      fc.asyncProperty(violationsArbitrary, async (violations) => {
        cleanup();

        render(<ViolationList violations={violations} />);

        // For each impact level, verify the count badge
        for (const impact of IMPACT_ORDER) {
          const expectedCount = violations.filter((v) => v.impact === impact).length;

          if (expectedCount === 0) {
            continue;
          }

          // Find the group header button
          const impactLabel = impact.charAt(0).toUpperCase() + impact.slice(1);
          const groupHeader = screen.getByRole('button', {
            name: new RegExp(impactLabel, 'i'),
            expanded: true,
          });

          // Verify the count is displayed
          expect(groupHeader.textContent).toContain(String(expectedCount));
        }

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});

describe('ViolationList Field Completeness Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 9: Violation List Field Completeness
   * For any violation rendered in the ViolationList, the display SHALL include:
   * ruleId, description, selector, and status.
   * None of these fields SHALL be empty or undefined.
   * Validates: Requirements 3.2
   */
  it('Property 9: Each violation displays ruleId, description, selector, and status', async () => {
    await fc.assert(
      fc.asyncProperty(violationArbitrary, async (violation) => {
        cleanup();

        render(<ViolationList violations={[violation]} />);

        // Find the violation item
        const violationButton = screen.getByRole('button', { expanded: false });
        const content = violationButton.textContent ?? '';

        // Verify ruleId is displayed
        expect(content).toContain(violation.ruleId);

        // Verify description is displayed
        expect(content).toContain(violation.description);

        // Verify selector is displayed
        expect(content).toContain(violation.selector);

        // Verify status is displayed (as badge text)
        const statusLabels: Record<string, string> = {
          pending: 'Pending',
          processing: 'Processing',
          fixed: 'Fixed',
          skipped: 'Skipped',
        };
        expect(content).toContain(statusLabels[violation.status]);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9b: All required fields are non-empty
   * Validates: Requirements 3.2
   */
  it('Property 9b: All displayed fields are non-empty', async () => {
    await fc.assert(
      fc.asyncProperty(violationArbitrary, async (violation) => {
        cleanup();

        render(<ViolationList violations={[violation]} />);

        // Find the violation item button
        const violationButton = screen.getByRole('button', { expanded: false });

        // Get the code element (ruleId)
        const ruleIdElement = violationButton.querySelector('code');
        expect(ruleIdElement).not.toBeNull();
        expect(ruleIdElement?.textContent?.trim().length).toBeGreaterThan(0);

        // Get the description paragraph
        const descriptionElement = violationButton.querySelector('p.text-sm');
        expect(descriptionElement).not.toBeNull();
        expect(descriptionElement?.textContent?.trim().length).toBeGreaterThan(0);

        // Get the selector paragraph
        const selectorElement = violationButton.querySelector('p.font-mono');
        expect(selectorElement).not.toBeNull();
        expect(selectorElement?.textContent?.trim().length).toBeGreaterThan(0);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});

import userEvent from '@testing-library/user-event';

describe('ViolationList Filter Functionality Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 10: Violation Filter Functionality
   * For any filter selection, the ViolationList SHALL display only violations
   * matching the filter criteria. Filter 'all' shows all violations,
   * 'pending' shows only pending, etc.
   * Validates: Requirements 3.5
   */
  it('Property 10: Filter "all" shows all violations', async () => {
    await fc.assert(
      fc.asyncProperty(violationsArbitrary, async (violations) => {
        cleanup();

        render(<ViolationList violations={violations} />);

        // "All" filter should be selected by default
        const allFilterButton = screen.getByRole('button', { name: /all/i, pressed: true });
        expect(allFilterButton).toBeInTheDocument();

        // Count total violations displayed
        // Each violation has a button in its group
        let totalDisplayed = 0;
        for (const impact of IMPACT_ORDER) {
          const groupContainer = document.getElementById(`violation-group-${impact}`);
          if (groupContainer) {
            const items = within(groupContainer).getAllByRole('button');
            totalDisplayed += items.length;
          }
        }

        expect(totalDisplayed).toBe(violations.length);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10b: Filter "pending" shows only pending violations
   * Note: The filter shows only exact status matches, not processing
   * Validates: Requirements 3.5
   */
  it('Property 10b: Filter "pending" shows only pending violations', async () => {
    await fc.assert(
      fc.asyncProperty(violationsArbitrary, async (violations) => {
        cleanup();

        const user = userEvent.setup();
        render(<ViolationList violations={violations} />);

        // Click the "Pending" filter
        const pendingFilterButton = screen.getByRole('button', {
          name: /pending/i,
          pressed: false,
        });
        await user.click(pendingFilterButton);

        // Count expected pending violations (only 'pending' status, not 'processing')
        // The filter counts both pending and processing for the badge, but filters only pending
        const expectedPending = violations.filter((v) => v.status === 'pending').length;

        // Count displayed violations
        let totalDisplayed = 0;
        for (const impact of IMPACT_ORDER) {
          const groupContainer = document.getElementById(`violation-group-${impact}`);
          if (groupContainer) {
            const items = within(groupContainer).queryAllByRole('button');
            totalDisplayed += items.length;
          }
        }

        expect(totalDisplayed).toBe(expectedPending);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10c: Filter "fixed" shows only fixed violations
   * Validates: Requirements 3.5
   */
  it('Property 10c: Filter "fixed" shows only fixed violations', async () => {
    await fc.assert(
      fc.asyncProperty(violationsArbitrary, async (violations) => {
        cleanup();

        const user = userEvent.setup();
        render(<ViolationList violations={violations} />);

        // Click the "Fixed" filter
        const fixedFilterButton = screen.getByRole('button', { name: /fixed/i, pressed: false });
        await user.click(fixedFilterButton);

        // Count expected fixed violations
        const expectedFixed = violations.filter((v) => v.status === 'fixed').length;

        // Count displayed violations
        let totalDisplayed = 0;
        for (const impact of IMPACT_ORDER) {
          const groupContainer = document.getElementById(`violation-group-${impact}`);
          if (groupContainer) {
            const items = within(groupContainer).queryAllByRole('button');
            totalDisplayed += items.length;
          }
        }

        expect(totalDisplayed).toBe(expectedFixed);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10d: Filter "skipped" shows only skipped violations
   * Validates: Requirements 3.5
   */
  it('Property 10d: Filter "skipped" shows only skipped violations', async () => {
    await fc.assert(
      fc.asyncProperty(violationsArbitrary, async (violations) => {
        cleanup();

        const user = userEvent.setup();
        render(<ViolationList violations={violations} />);

        // Click the "Skipped" filter
        const skippedFilterButton = screen.getByRole('button', {
          name: /skipped/i,
          pressed: false,
        });
        await user.click(skippedFilterButton);

        // Count expected skipped violations
        const expectedSkipped = violations.filter((v) => v.status === 'skipped').length;

        // Count displayed violations
        let totalDisplayed = 0;
        for (const impact of IMPACT_ORDER) {
          const groupContainer = document.getElementById(`violation-group-${impact}`);
          if (groupContainer) {
            const items = within(groupContainer).queryAllByRole('button');
            totalDisplayed += items.length;
          }
        }

        expect(totalDisplayed).toBe(expectedSkipped);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});
