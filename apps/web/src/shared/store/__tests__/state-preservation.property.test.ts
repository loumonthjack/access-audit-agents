/**
 * Property Test: State Preservation During Disconnection
 *
 * Feature: web-dashboard, Property 20: State Preservation During Disconnection
 * Validates: Requirements 10.4
 *
 * For any temporary disconnection (< 30 seconds), the UI state (URL, viewport selection,
 * selected violation, filter settings) SHALL be preserved and restored when connection resumes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useUIStore, type Theme } from '../uiStore';
import { useConnectionStore } from '../connectionStore';
import type { WsStatus } from '../connectionStore';
import type { ViolationFilter } from '@/types/domain';

// Arbitrary generators for UI state
const violationFilterArb = fc.constantFrom<ViolationFilter>('all', 'pending', 'fixed', 'skipped');
const themeArb = fc.constantFrom<Theme>('light', 'dark', 'system');
const violationIdArb = fc.option(fc.uuid(), { nil: null });
const violationIdsSetArb = fc
  .array(fc.uuid(), { minLength: 0, maxLength: 10 })
  .map((ids) => new Set(ids));

// Simulate a disconnection/reconnection cycle
interface DisconnectionCycle {
  initialWsStatus: WsStatus;
  disconnectedStatus: WsStatus;
  reconnectedStatus: WsStatus;
}

const disconnectionCycleArb: fc.Arbitrary<DisconnectionCycle> = fc.record({
  initialWsStatus: fc.constant<WsStatus>('connected'),
  disconnectedStatus: fc.constantFrom<WsStatus>('disconnected', 'reconnecting'),
  reconnectedStatus: fc.constant<WsStatus>('connected'),
});

describe('Property 20: State Preservation During Disconnection', () => {
  beforeEach(() => {
    // Reset stores before each test
    useUIStore.getState().reset();
    useConnectionStore.getState().reset();
    // Clear localStorage to ensure clean state
    localStorage.clear();
  });

  it('should preserve selectedViolationId during disconnection cycles', () => {
    fc.assert(
      fc.property(violationIdArb, disconnectionCycleArb, (violationId, cycle) => {
        const uiStore = useUIStore.getState();
        const connectionStore = useConnectionStore.getState();

        // Set initial UI state
        uiStore.setSelectedViolation(violationId);

        // Simulate disconnection
        connectionStore.setWsStatus(cycle.disconnectedStatus);

        // Verify state is preserved during disconnection
        expect(useUIStore.getState().selectedViolationId).toBe(violationId);

        // Simulate reconnection
        connectionStore.setWsStatus(cycle.reconnectedStatus);

        // Verify state is still preserved after reconnection
        expect(useUIStore.getState().selectedViolationId).toBe(violationId);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve violationFilter during disconnection cycles', () => {
    fc.assert(
      fc.property(violationFilterArb, disconnectionCycleArb, (filter, cycle) => {
        const uiStore = useUIStore.getState();
        const connectionStore = useConnectionStore.getState();

        // Set initial UI state
        uiStore.setViolationFilter(filter);

        // Simulate disconnection
        connectionStore.setWsStatus(cycle.disconnectedStatus);

        // Verify state is preserved during disconnection
        expect(useUIStore.getState().violationFilter).toBe(filter);

        // Simulate reconnection
        connectionStore.setWsStatus(cycle.reconnectedStatus);

        // Verify state is still preserved after reconnection
        expect(useUIStore.getState().violationFilter).toBe(filter);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve expandedViolations during disconnection cycles', () => {
    fc.assert(
      fc.property(violationIdsSetArb, disconnectionCycleArb, (expandedIds, cycle) => {
        const uiStore = useUIStore.getState();
        const connectionStore = useConnectionStore.getState();

        // Set initial UI state
        uiStore.setExpandedViolations(expandedIds);

        // Simulate disconnection
        connectionStore.setWsStatus(cycle.disconnectedStatus);

        // Verify state is preserved during disconnection
        const currentExpanded = useUIStore.getState().expandedViolations;
        expect(currentExpanded.size).toBe(expandedIds.size);
        for (const id of expandedIds) {
          expect(currentExpanded.has(id)).toBe(true);
        }

        // Simulate reconnection
        connectionStore.setWsStatus(cycle.reconnectedStatus);

        // Verify state is still preserved after reconnection
        const afterReconnect = useUIStore.getState().expandedViolations;
        expect(afterReconnect.size).toBe(expandedIds.size);
        for (const id of expandedIds) {
          expect(afterReconnect.has(id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve sidebarOpen state during disconnection cycles', () => {
    fc.assert(
      fc.property(fc.boolean(), disconnectionCycleArb, (sidebarOpen, cycle) => {
        const uiStore = useUIStore.getState();
        const connectionStore = useConnectionStore.getState();

        // Set initial UI state
        uiStore.setSidebarOpen(sidebarOpen);

        // Simulate disconnection
        connectionStore.setWsStatus(cycle.disconnectedStatus);

        // Verify state is preserved during disconnection
        expect(useUIStore.getState().sidebarOpen).toBe(sidebarOpen);

        // Simulate reconnection
        connectionStore.setWsStatus(cycle.reconnectedStatus);

        // Verify state is still preserved after reconnection
        expect(useUIStore.getState().sidebarOpen).toBe(sidebarOpen);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve theme during disconnection cycles', () => {
    fc.assert(
      fc.property(themeArb, disconnectionCycleArb, (theme, cycle) => {
        const uiStore = useUIStore.getState();
        const connectionStore = useConnectionStore.getState();

        // Set initial UI state
        uiStore.setTheme(theme);

        // Simulate disconnection
        connectionStore.setWsStatus(cycle.disconnectedStatus);

        // Verify state is preserved during disconnection
        expect(useUIStore.getState().theme).toBe(theme);

        // Simulate reconnection
        connectionStore.setWsStatus(cycle.reconnectedStatus);

        // Verify state is still preserved after reconnection
        expect(useUIStore.getState().theme).toBe(theme);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all UI state simultaneously during disconnection cycles', () => {
    fc.assert(
      fc.property(
        fc.record({
          selectedViolationId: violationIdArb,
          violationFilter: violationFilterArb,
          expandedViolations: violationIdsSetArb,
          sidebarOpen: fc.boolean(),
          theme: themeArb,
        }),
        disconnectionCycleArb,
        (uiState, cycle) => {
          const uiStore = useUIStore.getState();
          const connectionStore = useConnectionStore.getState();

          // Set all initial UI state
          uiStore.setSelectedViolation(uiState.selectedViolationId);
          uiStore.setViolationFilter(uiState.violationFilter);
          uiStore.setExpandedViolations(uiState.expandedViolations);
          uiStore.setSidebarOpen(uiState.sidebarOpen);
          uiStore.setTheme(uiState.theme);

          // Simulate disconnection
          connectionStore.setWsStatus(cycle.disconnectedStatus);

          // Verify all state is preserved during disconnection
          const duringDisconnect = useUIStore.getState();
          expect(duringDisconnect.selectedViolationId).toBe(uiState.selectedViolationId);
          expect(duringDisconnect.violationFilter).toBe(uiState.violationFilter);
          expect(duringDisconnect.expandedViolations.size).toBe(uiState.expandedViolations.size);
          expect(duringDisconnect.sidebarOpen).toBe(uiState.sidebarOpen);
          expect(duringDisconnect.theme).toBe(uiState.theme);

          // Simulate reconnection
          connectionStore.setWsStatus(cycle.reconnectedStatus);

          // Verify all state is still preserved after reconnection
          const afterReconnect = useUIStore.getState();
          expect(afterReconnect.selectedViolationId).toBe(uiState.selectedViolationId);
          expect(afterReconnect.violationFilter).toBe(uiState.violationFilter);
          expect(afterReconnect.expandedViolations.size).toBe(uiState.expandedViolations.size);
          expect(afterReconnect.sidebarOpen).toBe(uiState.sidebarOpen);
          expect(afterReconnect.theme).toBe(uiState.theme);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should track reconnection attempts without affecting UI state', () => {
    fc.assert(
      fc.property(
        fc.record({
          selectedViolationId: violationIdArb,
          violationFilter: violationFilterArb,
        }),
        fc.integer({ min: 0, max: 10 }),
        (uiState, reconnectAttempts) => {
          const uiStore = useUIStore.getState();
          const connectionStore = useConnectionStore.getState();

          // Set initial UI state
          uiStore.setSelectedViolation(uiState.selectedViolationId);
          uiStore.setViolationFilter(uiState.violationFilter);

          // Simulate multiple reconnection attempts
          connectionStore.setWsStatus('reconnecting');
          for (let i = 0; i < reconnectAttempts; i++) {
            connectionStore.incrementReconnectAttempt();
          }

          // Verify UI state is unaffected by reconnection attempts
          expect(useUIStore.getState().selectedViolationId).toBe(uiState.selectedViolationId);
          expect(useUIStore.getState().violationFilter).toBe(uiState.violationFilter);

          // Verify reconnection attempts are tracked correctly
          expect(useConnectionStore.getState().reconnectAttempt).toBe(reconnectAttempts);

          // Simulate successful reconnection
          connectionStore.setWsStatus('connected');
          connectionStore.resetReconnectAttempt();

          // Verify UI state is still preserved
          expect(useUIStore.getState().selectedViolationId).toBe(uiState.selectedViolationId);
          expect(useUIStore.getState().violationFilter).toBe(uiState.violationFilter);
          expect(useConnectionStore.getState().reconnectAttempt).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
