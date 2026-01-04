/**
 * Property-based tests for useScanSession hook
 * Feature: web-dashboard, Property 6: Real-Time Violation Status Updates
 * Validates: Requirements 2.2, 2.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as fc from 'fast-check';
import { useScanSession } from '../useScanSession';
import type { Violation, AppliedFix } from '@/types/domain';
import type { ProgressEvent } from '@/types/events';
import React from 'react';

// Mock the useProgressStream hook
vi.mock('../useProgressStream', () => ({
  useProgressStream: vi.fn(() => ({
    isConnected: true,
    lastEvent: null,
    error: null,
    disconnect: vi.fn(),
    reconnect: vi.fn(),
  })),
}));

// Mock the scanApi
vi.mock('../../api/scanApi', () => ({
  useSession: vi.fn(() => ({
    data: {
      id: 'test-session',
      url: 'https://example.com',
      viewport: 'desktop',
      status: 'scanning',
      createdAt: new Date().toISOString(),
      violationCounts: { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 },
      fixCounts: { fixed: 0, skipped: 0, pending: 0 },
    },
    isLoading: false,
  })),
  scanApi: {
    getSessionViolations: vi.fn().mockResolvedValue([]),
  },
}));

import { useProgressStream } from '../useProgressStream';

/**
 * Arbitrary for generating violation IDs
 */
const violationIdArbitrary = fc.uuid();

/**
 * Arbitrary for generating impact levels
 */
const impactLevelArbitrary = fc.constantFrom(
  'critical' as const,
  'serious' as const,
  'moderate' as const,
  'minor' as const
);

/**
 * Arbitrary for generating a violation
 */
const violationArbitrary = fc.record({
  id: violationIdArbitrary,
  ruleId: fc.string({ minLength: 1, maxLength: 20 }),
  impact: impactLevelArbitrary,
  description: fc.string({ minLength: 1, maxLength: 100 }),
  help: fc.string({ minLength: 1, maxLength: 100 }),
  helpUrl: fc.webUrl(),
  selector: fc.string({ minLength: 1, maxLength: 50 }),
  html: fc.string({ minLength: 1, maxLength: 200 }),
  status: fc.constant('pending' as const),
}) as fc.Arbitrary<Violation>;

/**
 * Arbitrary for generating an applied fix
 */
const appliedFixArbitrary = (violationId: string) =>
  fc.record({
    violationId: fc.constant(violationId),
    fixType: fc.constantFrom('attribute' as const, 'content' as const, 'style' as const),
    beforeHtml: fc.string({ minLength: 1, maxLength: 100 }),
    afterHtml: fc.string({ minLength: 1, maxLength: 100 }),
    reasoning: fc.string({ minLength: 1, maxLength: 200 }),
    appliedAt: fc.constant(new Date().toISOString()),
  }) as fc.Arbitrary<AppliedFix>;

/**
 * Create a wrapper with QueryClient for testing hooks
 */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useScanSession Property Tests', () => {
  let mockUseProgressStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseProgressStream = useProgressStream as ReturnType<typeof vi.fn>;
    mockUseProgressStream.mockReturnValue({
      isConnected: true,
      lastEvent: null,
      error: null,
      disconnect: vi.fn(),
      reconnect: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /**
   * Property 6: Real-Time Violation Status Updates
   * For any ProgressEvent of type 'fix_applied' or 'fix_skipped',
   * the corresponding violation in the query cache SHALL update its status
   * to 'fixed' or 'skipped' respectively within one render cycle.
   * Validates: Requirements 2.2, 2.3
   */
  it('Property 6: fix_applied event updates violation status to fixed', async () => {
    await fc.assert(
      fc.asyncProperty(violationArbitrary, async (violation) => {
        cleanup();

        // Generate a fix for this violation
        const fix = await fc.sample(appliedFixArbitrary(violation.id), 1)[0];

        // Set up initial state with the violation
        let currentLastEvent: ProgressEvent | null = null;

        mockUseProgressStream.mockImplementation(() => ({
          isConnected: true,
          lastEvent: currentLastEvent,
          error: null,
          disconnect: vi.fn(),
          reconnect: vi.fn(),
        }));

        const wrapper = createWrapper();
        const { result, rerender } = renderHook(
          () => useScanSession({ sessionId: 'test-session' }),
          { wrapper }
        );

        // First, simulate violation detected
        currentLastEvent = {
          type: 'violation_detected',
          violation,
        };
        mockUseProgressStream.mockReturnValue({
          isConnected: true,
          lastEvent: currentLastEvent,
          error: null,
          disconnect: vi.fn(),
          reconnect: vi.fn(),
        });
        rerender();

        await waitFor(() => {
          expect(result.current.violations).toHaveLength(1);
          expect(result.current.violations[0].status).toBe('pending');
        });

        // Now simulate fix_applied event
        currentLastEvent = {
          type: 'fix_applied',
          violationId: violation.id,
          fix,
        };
        mockUseProgressStream.mockReturnValue({
          isConnected: true,
          lastEvent: currentLastEvent,
          error: null,
          disconnect: vi.fn(),
          reconnect: vi.fn(),
        });
        rerender();

        // Verify violation status is updated to 'fixed'
        await waitFor(() => {
          const updatedViolation = result.current.violations.find((v) => v.id === violation.id);
          expect(updatedViolation?.status).toBe('fixed');
          expect(updatedViolation?.fix).toEqual(fix);
        });

        cleanup();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6b: fix_skipped event updates violation status to skipped
   * Validates: Requirements 2.2, 2.3
   */
  it('Property 6b: fix_skipped event updates violation status to skipped', async () => {
    await fc.assert(
      fc.asyncProperty(
        violationArbitrary,
        fc.string({ minLength: 1, maxLength: 100 }),
        async (violation, skipReason) => {
          cleanup();

          let currentLastEvent: ProgressEvent | null = null;

          mockUseProgressStream.mockImplementation(() => ({
            isConnected: true,
            lastEvent: currentLastEvent,
            error: null,
            disconnect: vi.fn(),
            reconnect: vi.fn(),
          }));

          const wrapper = createWrapper();
          const { result, rerender } = renderHook(
            () => useScanSession({ sessionId: 'test-session' }),
            { wrapper }
          );

          // First, simulate violation detected
          currentLastEvent = {
            type: 'violation_detected',
            violation,
          };
          mockUseProgressStream.mockReturnValue({
            isConnected: true,
            lastEvent: currentLastEvent,
            error: null,
            disconnect: vi.fn(),
            reconnect: vi.fn(),
          });
          rerender();

          await waitFor(() => {
            expect(result.current.violations).toHaveLength(1);
          });

          // Now simulate fix_skipped event
          currentLastEvent = {
            type: 'fix_skipped',
            violationId: violation.id,
            reason: skipReason,
          };
          mockUseProgressStream.mockReturnValue({
            isConnected: true,
            lastEvent: currentLastEvent,
            error: null,
            disconnect: vi.fn(),
            reconnect: vi.fn(),
          });
          rerender();

          // Verify violation status is updated to 'skipped'
          await waitFor(() => {
            const updatedViolation = result.current.violations.find((v) => v.id === violation.id);
            expect(updatedViolation?.status).toBe('skipped');
            expect(updatedViolation?.skipReason).toBe(skipReason);
          });

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('useScanSession Error Resilience Property Tests', () => {
  let mockUseProgressStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseProgressStream = useProgressStream as ReturnType<typeof vi.fn>;
    mockUseProgressStream.mockReturnValue({
      isConnected: true,
      lastEvent: null,
      error: null,
      disconnect: vi.fn(),
      reconnect: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /**
   * Property 7: Error Resilience
   * For any ProgressEvent of type 'error', the Dashboard SHALL display
   * the error message and SHALL NOT throw an unhandled exception or crash.
   * Validates: Requirements 2.5
   */
  it('Property 7: Error events are captured without crashing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.boolean(),
        async (errorMessage, recoverable) => {
          cleanup();

          let currentLastEvent: ProgressEvent | null = null;
          const onError = vi.fn();

          mockUseProgressStream.mockImplementation(() => ({
            isConnected: true,
            lastEvent: currentLastEvent,
            error: null,
            disconnect: vi.fn(),
            reconnect: vi.fn(),
          }));

          const wrapper = createWrapper();

          // This should not throw
          const { result, rerender } = renderHook(
            () =>
              useScanSession({
                sessionId: 'test-session',
                onError,
              }),
            { wrapper }
          );

          // Simulate error event
          currentLastEvent = {
            type: 'error',
            message: errorMessage,
            recoverable,
          };
          mockUseProgressStream.mockReturnValue({
            isConnected: true,
            lastEvent: currentLastEvent,
            error: null,
            disconnect: vi.fn(),
            reconnect: vi.fn(),
          });

          // This should not throw
          expect(() => rerender()).not.toThrow();

          // Verify error is captured
          await waitFor(() => {
            expect(result.current.error).toBe(errorMessage);
          });

          // Verify onError callback was called
          expect(onError).toHaveBeenCalledWith(errorMessage);

          // Hook should still be functional (not crashed)
          expect(result.current.session).toBeDefined();
          expect(result.current.violations).toBeDefined();
          expect(Array.isArray(result.current.violations)).toBe(true);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7b: Multiple error events don't cause accumulation issues
   * Validates: Requirements 2.5
   */
  it('Property 7b: Multiple error events are handled correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        async (errorMessages) => {
          cleanup();

          let currentLastEvent: ProgressEvent | null = null;
          const onError = vi.fn();

          mockUseProgressStream.mockImplementation(() => ({
            isConnected: true,
            lastEvent: currentLastEvent,
            error: null,
            disconnect: vi.fn(),
            reconnect: vi.fn(),
          }));

          const wrapper = createWrapper();
          const { result, rerender } = renderHook(
            () =>
              useScanSession({
                sessionId: 'test-session',
                onError,
              }),
            { wrapper }
          );

          // Send multiple error events
          for (const errorMessage of errorMessages) {
            currentLastEvent = {
              type: 'error',
              message: errorMessage,
              recoverable: true,
            };
            mockUseProgressStream.mockReturnValue({
              isConnected: true,
              lastEvent: currentLastEvent,
              error: null,
              disconnect: vi.fn(),
              reconnect: vi.fn(),
            });

            expect(() => rerender()).not.toThrow();
          }

          // Last error should be the current error
          const lastError = errorMessages[errorMessages.length - 1];
          await waitFor(() => {
            expect(result.current.error).toBe(lastError);
          });

          // Hook should still be functional
          expect(result.current.session).toBeDefined();

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
