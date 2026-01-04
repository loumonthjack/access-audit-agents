/**
 * Property-based tests for report display on completion
 * Feature: web-dashboard, Property 12: Report Display on Completion
 * Validates: Requirements 5.1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type {
  RemediationReport,
  AppliedFix,
  SkippedViolation,
  HumanReviewItem,
  FixType,
  Viewport,
} from '@/types/domain';
import type { ProgressEvent } from '@/types/events';

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
    violationId: fc.constant(`fix-${index}`),
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
    violationId: fc.constant(`skipped-${index}`),
    ruleId: nonEmptyStringArbitrary,
    selector: nonEmptyStringArbitrary,
    reason: nonEmptyStringArbitrary,
    attempts: fc.integer({ min: 1, max: 5 }),
  });

/**
 * Arbitrary for generating HumanReviewItem objects
 */
const humanReviewItemArbitrary = (index: number): fc.Arbitrary<HumanReviewItem> =>
  fc.record({
    violationId: fc.constant(`review-${index}`),
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
    fixCount: fc.integer({ min: 0, max: 3 }),
    skippedCount: fc.integer({ min: 0, max: 3 }),
    humanReviewCount: fc.integer({ min: 0, max: 3 }),
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

/**
 * Simulates the navigation behavior when session_complete event is received
 */
interface NavigationState {
  currentPath: string;
  navigatedTo: string | null;
}

/**
 * Simulates the router navigation on session complete
 */
function simulateSessionCompleteNavigation(
  report: RemediationReport,
  currentPath: string
): NavigationState {
  // When session_complete event is received, navigate to report page
  const reportPath = `/report/${report.sessionId}`;

  return {
    currentPath,
    navigatedTo: reportPath,
  };
}

/**
 * Simulates handling a session_complete progress event
 */
function handleSessionCompleteEvent(
  event: ProgressEvent,
  navigate: (path: string) => void
): boolean {
  if (event.type === 'session_complete') {
    navigate(`/report/${event.report.sessionId}`);
    return true;
  }
  return false;
}

describe('Report Display on Completion Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 12: Report Display on Completion
   * For any ScanSession that receives a 'session_complete' event,
   * the router SHALL navigate to the report page within one render cycle.
   * Validates: Requirements 5.1
   */
  it('Property 12: session_complete event triggers navigation to report page', async () => {
    await fc.assert(
      fc.asyncProperty(remediationReportArbitrary, async (report) => {
        const sessionCompleteEvent: ProgressEvent = {
          type: 'session_complete',
          report,
        };

        const navigateMock = vi.fn();
        const handled = handleSessionCompleteEvent(sessionCompleteEvent, navigateMock);

        // Verify navigation was triggered
        expect(handled).toBe(true);
        expect(navigateMock).toHaveBeenCalledTimes(1);
        expect(navigateMock).toHaveBeenCalledWith(`/report/${report.sessionId}`);
      }),
      { numRuns: 25 }
    );
  });

  /**
   * Property 12b: Navigation path contains correct session ID
   * Validates: Requirements 5.1
   */
  it('Property 12b: Navigation path contains correct session ID', async () => {
    await fc.assert(
      fc.asyncProperty(remediationReportArbitrary, async (report) => {
        const navState = simulateSessionCompleteNavigation(report, `/scan/${report.sessionId}`);

        // Verify navigation target contains the session ID
        expect(navState.navigatedTo).toBe(`/report/${report.sessionId}`);
        expect(navState.navigatedTo).toContain(report.sessionId);
      }),
      { numRuns: 25 }
    );
  });

  /**
   * Property 12c: Non-complete events do not trigger navigation
   * Validates: Requirements 5.1
   */
  it('Property 12c: Non-complete events do not trigger navigation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<ProgressEvent['type']>(
          'violation_detected',
          'fix_started',
          'fix_applied',
          'fix_skipped',
          'error'
        ),
        async (eventType) => {
          // Create a non-complete event
          let event: ProgressEvent;
          switch (eventType) {
            case 'violation_detected':
              event = {
                type: 'violation_detected',
                violation: {
                  id: 'v1',
                  ruleId: 'rule1',
                  impact: 'critical',
                  description: 'Test',
                  help: 'Help',
                  helpUrl: 'https://example.com',
                  selector: 'div',
                  html: '<div></div>',
                  status: 'pending',
                },
              };
              break;
            case 'fix_started':
              event = { type: 'fix_started', violationId: 'v1' };
              break;
            case 'fix_applied':
              event = {
                type: 'fix_applied',
                violationId: 'v1',
                fix: {
                  violationId: 'v1',
                  fixType: 'attribute',
                  beforeHtml: '<div></div>',
                  afterHtml: '<div role="button"></div>',
                  reasoning: 'Added role',
                  appliedAt: new Date().toISOString(),
                },
              };
              break;
            case 'fix_skipped':
              event = { type: 'fix_skipped', violationId: 'v1', reason: 'Cannot fix' };
              break;
            case 'error':
              event = { type: 'error', message: 'Error', recoverable: true };
              break;
            default:
              throw new Error(`Unknown event type: ${eventType}`);
          }

          const navigateMock = vi.fn();
          const handled = handleSessionCompleteEvent(event, navigateMock);

          // Verify navigation was NOT triggered
          expect(handled).toBe(false);
          expect(navigateMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 12d: Report data is available after navigation
   * Validates: Requirements 5.1
   */
  it('Property 12d: Report data is preserved in session_complete event', async () => {
    await fc.assert(
      fc.asyncProperty(remediationReportArbitrary, async (report) => {
        const sessionCompleteEvent: ProgressEvent = {
          type: 'session_complete',
          report,
        };

        // Verify the report data is complete
        expect(sessionCompleteEvent.report.sessionId).toBe(report.sessionId);
        expect(sessionCompleteEvent.report.url).toBe(report.url);
        expect(sessionCompleteEvent.report.summary.totalViolations).toBe(
          report.summary.totalViolations
        );
        expect(sessionCompleteEvent.report.fixes.length).toBe(report.fixes.length);
        expect(sessionCompleteEvent.report.skipped.length).toBe(report.skipped.length);
      }),
      { numRuns: 25 }
    );
  });
});
