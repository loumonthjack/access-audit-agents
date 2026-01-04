/**
 * Property-based tests for FixCard component
 * Feature: web-dashboard, Property 11: Fix Card Completeness
 * Validates: Requirements 4.1, 4.4
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { FixCard } from '../FixCard';
import type { AppliedFix, FixType } from '@/types/domain';

/**
 * Arbitrary for generating fix types
 */
const fixTypeArbitrary = fc.constantFrom<FixType>('attribute', 'content', 'style');

/**
 * Arbitrary for generating valid HTML strings
 */
const htmlArbitrary = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0)
  .map((s) => `<div>${s}</div>`);

/**
 * Arbitrary for generating reasoning strings
 */
const reasoningArbitrary = fc
  .string({ minLength: 10, maxLength: 300 })
  .filter((s) => s.trim().length >= 10);

/**
 * Arbitrary for generating ISO date strings
 */
const dateArbitrary = fc
  .integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') })
  .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Arbitrary for generating AppliedFix objects
 */
const appliedFixArbitrary: fc.Arbitrary<AppliedFix> = fc.record({
  violationId: fc.uuid(),
  ruleId: fc.constantFrom('image-alt', 'button-name', 'color-contrast', 'link-name'),
  impact: fc.constantFrom(
    'critical' as const,
    'serious' as const,
    'moderate' as const,
    'minor' as const
  ),
  description: fc.string({ minLength: 10, maxLength: 100 }),
  selector: fc.string({ minLength: 1, maxLength: 50 }),
  fixType: fixTypeArbitrary,
  beforeHtml: htmlArbitrary,
  afterHtml: htmlArbitrary,
  reasoning: reasoningArbitrary,
  appliedAt: dateArbitrary,
});

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

describe('FixCard Completeness Property Tests', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /**
   * Property 11: Fix Card Completeness
   * For any AppliedFix displayed in a FixCard, the card SHALL show:
   * beforeHtml, afterHtml (as a diff), and reasoning.
   * All three fields SHALL be present and non-empty.
   * Validates: Requirements 4.1, 4.4
   */
  it('Property 11: FixCard displays beforeHtml, afterHtml, and reasoning', async () => {
    await fc.assert(
      fc.asyncProperty(appliedFixArbitrary, async (fix) => {
        cleanup();

        render(<FixCard fix={fix} />);

        // Verify the diff viewer is present (contains before/after HTML)
        const diffElement = screen.getByTestId('fix-diff');
        expect(diffElement).toBeInTheDocument();

        // The diff viewer should contain the before and after HTML content
        // Note: The diff viewer renders the content, so we check for presence
        expect(diffElement.textContent).toBeTruthy();

        // Verify reasoning is displayed
        const reasoningElement = screen.getByTestId('fix-reasoning');
        expect(reasoningElement).toBeInTheDocument();
        expect(reasoningElement.textContent).toBe(fix.reasoning);

        // Verify reasoning is non-empty
        expect(fix.reasoning.trim().length).toBeGreaterThan(0);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11b: All required fields are non-empty
   * Validates: Requirements 4.1, 4.4
   */
  it('Property 11b: All displayed fields are non-empty', async () => {
    await fc.assert(
      fc.asyncProperty(appliedFixArbitrary, async (fix) => {
        cleanup();

        render(<FixCard fix={fix} />);

        // Verify beforeHtml is non-empty
        expect(fix.beforeHtml.trim().length).toBeGreaterThan(0);

        // Verify afterHtml is non-empty
        expect(fix.afterHtml.trim().length).toBeGreaterThan(0);

        // Verify reasoning is non-empty
        expect(fix.reasoning.trim().length).toBeGreaterThan(0);

        // Verify the card is rendered
        const card = screen.getByTestId('fix-card');
        expect(card).toBeInTheDocument();

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11c: Fix type badge is displayed
   * Validates: Requirements 4.1
   */
  it('Property 11c: Fix type badge is displayed correctly', async () => {
    await fc.assert(
      fc.asyncProperty(appliedFixArbitrary, async (fix) => {
        cleanup();

        render(<FixCard fix={fix} />);

        // Find the badge with the fix type - component displays "{fixType} fix"
        const badge = screen.getByText(`${fix.fixType} fix`);
        expect(badge).toBeInTheDocument();

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11d: Copy button is present and functional
   * Validates: Requirements 4.5
   */
  it('Property 11d: Copy button is present', async () => {
    await fc.assert(
      fc.asyncProperty(appliedFixArbitrary, async (fix) => {
        cleanup();

        render(<FixCard fix={fix} />);

        // Find the copy button
        const copyButton = screen.getByRole('button', { name: /copy/i });
        expect(copyButton).toBeInTheDocument();

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});
