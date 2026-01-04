/**
 * Property-based tests for ReportView component
 * Feature: web-dashboard, Property 13: Report Content Completeness
 * Validates: Requirements 5.2, 5.3, 5.4
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { ReportView } from '../ReportView';
import type {
  RemediationReport,
  AppliedFix,
  SkippedViolation,
  HumanReviewItem,
  FixType,
  Viewport,
} from '@/types/domain';

/**
 * Arbitrary for generating fix types
 */
const fixTypeArbitrary = fc.constantFrom<FixType>('attribute', 'content', 'style');

/**
 * Arbitrary for generating viewports
 */
const viewportArbitrary = fc.constantFrom<Viewport>('mobile', 'desktop');

/**
 * Arbitrary for generating ISO date strings
 */
const dateArbitrary = fc
  .integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') })
  .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Arbitrary for generating valid HTML strings
 */
const htmlArbitrary = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0)
  .map((s) => `<div>${s}</div>`);

/**
 * Arbitrary for generating non-empty strings
 */
const nonEmptyStringArbitrary = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary for generating AppliedFix objects
 */
const appliedFixArbitrary = (index: number): fc.Arbitrary<AppliedFix> =>
  fc.record({
    violationId: fc.constant(`fix-${index}-${Date.now()}`),
    ruleId: fc.constantFrom('image-alt', 'button-name', 'color-contrast', 'link-name'),
    impact: fc.constantFrom('critical' as const, 'serious' as const, 'moderate' as const, 'minor' as const),
    description: nonEmptyStringArbitrary,
    selector: nonEmptyStringArbitrary,
    fixType: fixTypeArbitrary,
    beforeHtml: htmlArbitrary,
    afterHtml: htmlArbitrary,
    reasoning: nonEmptyStringArbitrary,
    appliedAt: dateArbitrary,
  });

/**
 * Arbitrary for generating SkippedViolation objects
 */
const skippedViolationArbitrary = (index: number): fc.Arbitrary<SkippedViolation> =>
  fc.record({
    violationId: fc.constant(`skipped-${index}-${Date.now()}`),
    ruleId: nonEmptyStringArbitrary,
    impact: fc.constantFrom('critical' as const, 'serious' as const, 'moderate' as const, 'minor' as const),
    description: nonEmptyStringArbitrary,
    selector: nonEmptyStringArbitrary,
    html: htmlArbitrary,
    reason: nonEmptyStringArbitrary,
    attempts: fc.integer({ min: 1, max: 5 }),
  });

/**
 * Arbitrary for generating HumanReviewItem objects
 */
const humanReviewItemArbitrary = (index: number): fc.Arbitrary<HumanReviewItem> =>
  fc.record({
    violationId: fc.constant(`review-${index}-${Date.now()}`),
    ruleId: nonEmptyStringArbitrary,
    selector: nonEmptyStringArbitrary,
    reason: nonEmptyStringArbitrary,
    suggestedAction: nonEmptyStringArbitrary,
  });

/**
 * Arbitrary for generating RemediationReport objects
 */
const remediationReportArbitrary: fc.Arbitrary<RemediationReport> = fc
  .record({
    fixCount: fc.integer({ min: 0, max: 5 }),
    skippedCount: fc.integer({ min: 0, max: 5 }),
    humanReviewCount: fc.integer({ min: 0, max: 5 }),
  })
  .chain(({ fixCount, skippedCount, humanReviewCount }) => {
    const fixesArb =
      fixCount === 0
        ? fc.constant([])
        : fc.tuple(...Array.from({ length: fixCount }, (_, i) => appliedFixArbitrary(i)));
    const skippedArb =
      skippedCount === 0
        ? fc.constant([])
        : fc.tuple(...Array.from({ length: skippedCount }, (_, i) => skippedViolationArbitrary(i)));
    const humanReviewArb =
      humanReviewCount === 0
        ? fc.constant([])
        : fc.tuple(
            ...Array.from({ length: humanReviewCount }, (_, i) => humanReviewItemArbitrary(i))
          );

    return fc.record({
      sessionId: fc.uuid(),
      url: fc.webUrl(),
      viewport: viewportArbitrary,
      timestamp: dateArbitrary,
      duration: fc.integer({ min: 1000, max: 300000 }),
      fixes: fixesArb.map((arr) => (Array.isArray(arr) ? arr : [])),
      skipped: skippedArb.map((arr) => (Array.isArray(arr) ? arr : [])),
      humanReview: humanReviewArb.map((arr) => (Array.isArray(arr) ? arr : [])),
      violations: fc.constant([]), // Empty violations array for testing
    });
  })
  .map((report) => ({
    ...report,
    summary: {
      totalViolations: report.fixes.length + report.skipped.length + report.humanReview.length,
      fixedCount: report.fixes.length,
      skippedCount: report.skipped.length,
      humanReviewCount: report.humanReview.length,
    },
  }));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

describe('ReportView Content Completeness Property Tests', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /**
   * Property 13: Report Content Completeness
   * For any RemediationReport displayed in ReportView, it SHALL show:
   * summary counts (total, fixed, skipped), all applied fixes, and all skipped violations with reasons.
   * Validates: Requirements 5.2, 5.3, 5.4
   */
  it('Property 13: ReportView displays summary counts correctly', async () => {
    await fc.assert(
      fc.asyncProperty(remediationReportArbitrary, async (report) => {
        cleanup();

        render(<ReportView report={report} />);

        // Verify the report view is rendered
        const reportView = screen.getByTestId('report-view');
        expect(reportView).toBeInTheDocument();

        // Verify summary counts are displayed
        const summaryRegion = screen.getByRole('region', { name: /report summary/i });
        expect(summaryRegion).toBeInTheDocument();

        // Check that the summary contains the correct counts
        expect(summaryRegion.textContent).toContain(String(report.summary.totalViolations));
        expect(summaryRegion.textContent).toContain(String(report.summary.fixedCount));
        expect(summaryRegion.textContent).toContain(String(report.summary.skippedCount));
        expect(summaryRegion.textContent).toContain(String(report.summary.humanReviewCount));

        cleanup();
      }),
      { numRuns: 25 }
    );
  });

  /**
   * Property 13b: All applied fixes are displayed
   * Validates: Requirements 5.3
   */
  it('Property 13b: All applied fixes are displayed in fixes tab', async () => {
    await fc.assert(
      fc.asyncProperty(remediationReportArbitrary, async (report) => {
        cleanup();

        const user = userEvent.setup();
        render(<ReportView report={report} />);

        // Click on the fixes tab (violations tab is active by default)
        const fixesTab = screen.getByRole('tab', { name: /applied fixes/i });
        await user.click(fixesTab);

        // Now the fixes tab should be active
        expect(fixesTab).toHaveAttribute('aria-selected', 'true');

        // Count fix cards displayed
        const fixCards = screen.queryAllByTestId('fix-card');
        expect(fixCards.length).toBe(report.fixes.length);

        cleanup();
      }),
      { numRuns: 25 }
    );
  });

  /**
   * Property 13c: All skipped violations are displayed with reasons
   * Validates: Requirements 5.4
   */
  it('Property 13c: All skipped violations are displayed with reasons', async () => {
    await fc.assert(
      fc.asyncProperty(remediationReportArbitrary, async (report) => {
        cleanup();

        const user = userEvent.setup();
        render(<ReportView report={report} />);

        // Click on the skipped tab
        const skippedTab = screen.getByRole('tab', { name: /skipped/i });
        await user.click(skippedTab);

        // If there are skipped violations, verify they are displayed
        if (report.skipped.length > 0) {
          const skippedList = screen.getByTestId('skipped-list');
          expect(skippedList).toBeInTheDocument();

          // Count skipped items
          const skippedItems = within(skippedList).getAllByTestId('skipped-item');
          expect(skippedItems.length).toBe(report.skipped.length);

          // Verify each skipped violation has its reason displayed
          for (const skipped of report.skipped) {
            expect(skippedList.textContent).toContain(skipped.reason);
          }
        }

        cleanup();
      }),
      { numRuns: 25 }
    );
  });

  /**
   * Property 13d: Human review items are displayed
   * Validates: Requirements 5.2
   */
  it('Property 13d: Human review items are displayed', async () => {
    await fc.assert(
      fc.asyncProperty(remediationReportArbitrary, async (report) => {
        cleanup();

        const user = userEvent.setup();
        render(<ReportView report={report} />);

        // Click on the human review tab
        const humanReviewTab = screen.getByRole('tab', { name: /human review/i });
        await user.click(humanReviewTab);

        // Count human review items
        const humanReviewItems = screen.queryAllByTestId('human-review-item');
        expect(humanReviewItems.length).toBe(report.humanReview.length);

        cleanup();
      }),
      { numRuns: 25 }
    );
  });

  /**
   * Property 13e: Tab counts match actual content
   * Validates: Requirements 5.2, 5.3, 5.4
   */
  it('Property 13e: Tab counts match actual content', async () => {
    await fc.assert(
      fc.asyncProperty(remediationReportArbitrary, async (report) => {
        cleanup();

        render(<ReportView report={report} />);

        // Verify fixes tab count
        const fixesTab = screen.getByRole('tab', { name: /applied fixes/i });
        expect(fixesTab.textContent).toContain(String(report.fixes.length));

        // Verify skipped tab count
        const skippedTab = screen.getByRole('tab', { name: /skipped/i });
        expect(skippedTab.textContent).toContain(String(report.skipped.length));

        // Verify human review tab count
        const humanReviewTab = screen.getByRole('tab', { name: /human review/i });
        expect(humanReviewTab.textContent).toContain(String(report.humanReview.length));

        cleanup();
      }),
      { numRuns: 25 }
    );
  });
});
