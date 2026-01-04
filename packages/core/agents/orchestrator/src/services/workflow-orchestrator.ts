/**
 * Workflow Orchestrator - State Machine for Remediation Workflow
 * 
 * Implements the Planner-Executor-Validator (PEV) pattern with a state machine
 * that enforces audit-first ordering and fix-verify cycles.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import type { FixInstruction, FixResult, RemediationReport } from '../types/index.js';
import { SessionStateManager } from './session-state-manager.js';
import type { Violation, PageContext } from './specialists/specialist-agent.js';
import { SpecialistRouter } from './specialists/specialist-router.js';
import { ReportGenerator, type ViolationMetadata } from './report-generator.js';
import { AuditLogger } from './audit-logger.js';

// ============================================================================
// Workflow States
// Requirements: 1.1, 1.3
// ============================================================================

/**
 * Workflow states for the remediation process
 */
export type WorkflowState =
    | 'IDLE'
    | 'SCANNING'
    | 'PLANNING'
    | 'EXECUTING'
    | 'VERIFYING'
    | 'COMPLETE';

/**
 * Actions that can be performed in the workflow
 */
export type WorkflowAction =
    | 'START_SCAN'
    | 'SCAN_COMPLETE'
    | 'START_PLANNING'
    | 'PLAN_COMPLETE'
    | 'START_EXECUTION'
    | 'EXECUTION_COMPLETE'
    | 'START_VERIFICATION'
    | 'VERIFICATION_PASS'
    | 'VERIFICATION_FAIL'
    | 'ALL_VIOLATIONS_PROCESSED'
    | 'RESET';

// ============================================================================
// Violation with Impact for Priority Sorting
// Requirements: 1.2
// ============================================================================

/**
 * Impact levels in priority order (highest to lowest)
 */
export const IMPACT_PRIORITY: Record<string, number> = {
    'critical': 0,
    'serious': 1,
    'moderate': 2,
    'minor': 3
};

/**
 * Extended violation type with impact level
 */
export interface ViolationWithImpact extends Violation {
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
}

// ============================================================================
// Workflow Event Types
// ============================================================================

export interface WorkflowEvent {
    type: WorkflowAction;
    timestamp: Date;
    data?: unknown;
}

export interface ScanCompleteData {
    violations: ViolationWithImpact[];
    url: string;
}

export interface PlanCompleteData {
    violationId: string;
    instruction: FixInstruction;
}

export interface ExecutionCompleteData {
    violationId: string;
    result: FixResult;
}

export interface VerificationResultData {
    violationId: string;
    passed: boolean;
    reason?: string;
}

// ============================================================================
// State Transition Error
// ============================================================================

export class WorkflowTransitionError extends Error {
    constructor(
        public readonly currentState: WorkflowState,
        public readonly attemptedAction: WorkflowAction,
        message: string
    ) {
        super(message);
        this.name = 'WorkflowTransitionError';
    }
}

// ============================================================================
// Workflow Orchestrator
// ============================================================================

/**
 * WorkflowOrchestrator manages the state machine for the remediation workflow.
 * 
 * State transitions:
 * - IDLE -> SCANNING (on START_SCAN)
 * - SCANNING -> PLANNING (on SCAN_COMPLETE with violations)
 * - SCANNING -> COMPLETE (on SCAN_COMPLETE with no violations)
 * - PLANNING -> EXECUTING (on PLAN_COMPLETE)
 * - EXECUTING -> VERIFYING (on EXECUTION_COMPLETE)
 * - VERIFYING -> PLANNING (on VERIFICATION_PASS/FAIL with more violations)
 * - VERIFYING -> COMPLETE (on VERIFICATION_PASS/FAIL with no more violations)
 * - Any -> IDLE (on RESET)
 */
export class WorkflowOrchestrator {
    private _state: WorkflowState = 'IDLE';
    private _scanCompleted: boolean = false;
    private _violations: ViolationWithImpact[] = [];
    private _currentViolation: ViolationWithImpact | null = null;
    private _currentInstruction: FixInstruction | null = null;
    private _eventHistory: WorkflowEvent[] = [];
    private _sessionManager: SessionStateManager;
    private _specialistRouter: SpecialistRouter;
    private _pageContext: PageContext | null = null;

    constructor(url: string) {
        this._sessionManager = new SessionStateManager(url);
        this._specialistRouter = new SpecialistRouter();
    }

    // ========================================================================
    // State Accessors
    // ========================================================================

    /**
     * Gets the current workflow state
     */
    get state(): WorkflowState {
        return this._state;
    }

    /**
     * Checks if a scan has been completed
     * Requirements: 1.1
     */
    get scanCompleted(): boolean {
        return this._scanCompleted;
    }

    /**
     * Gets the current violation being processed
     */
    get currentViolation(): ViolationWithImpact | null {
        return this._currentViolation;
    }

    /**
     * Gets the current fix instruction
     */
    get currentInstruction(): FixInstruction | null {
        return this._currentInstruction;
    }

    /**
     * Gets the session state manager
     */
    get sessionManager(): SessionStateManager {
        return this._sessionManager;
    }

    /**
     * Gets the event history
     */
    get eventHistory(): readonly WorkflowEvent[] {
        return [...this._eventHistory];
    }

    /**
     * Gets all violations sorted by priority
     */
    get violations(): readonly ViolationWithImpact[] {
        return [...this._violations];
    }

    // ========================================================================
    // Audit-First Enforcement
    // Requirements: 1.1
    // ========================================================================

    /**
     * Checks if injector actions are allowed (scan must be complete first)
     * Requirements: 1.1
     */
    canExecuteInjectorAction(): boolean {
        return this._scanCompleted;
    }

    /**
     * Validates that a scan has been completed before allowing injector actions
     * Requirements: 1.1
     * 
     * @throws WorkflowTransitionError if scan has not been completed
     */
    requireScanComplete(): void {
        if (!this._scanCompleted) {
            throw new WorkflowTransitionError(
                this._state,
                'START_EXECUTION',
                'Cannot execute injector actions before scan is complete. ' +
                'Audit-first ordering requires ScanURL to be called first.'
            );
        }
    }

    // ========================================================================
    // State Transitions
    // ========================================================================

    /**
     * Records an event in the history
     */
    private recordEvent(type: WorkflowAction, data?: unknown): void {
        this._eventHistory.push({
            type,
            timestamp: new Date(),
            data
        });
    }

    /**
     * Transitions to a new state
     */
    private transitionTo(newState: WorkflowState): void {
        this._state = newState;
    }

    /**
     * Starts a scan operation
     * Requirements: 1.1
     */
    startScan(): void {
        if (this._state !== 'IDLE') {
            throw new WorkflowTransitionError(
                this._state,
                'START_SCAN',
                `Cannot start scan from state ${this._state}. Must be in IDLE state.`
            );
        }

        this.recordEvent('START_SCAN');
        this.transitionTo('SCANNING');
    }

    /**
     * Completes a scan with the detected violations
     * Requirements: 1.1, 1.2
     * 
     * @param violations - The violations detected by the scan
     * @param url - The URL that was scanned
     */
    completeScan(violations: ViolationWithImpact[], url: string): void {
        if (this._state !== 'SCANNING') {
            throw new WorkflowTransitionError(
                this._state,
                'SCAN_COMPLETE',
                `Cannot complete scan from state ${this._state}. Must be in SCANNING state.`
            );
        }

        // Sort violations by priority (critical -> serious -> moderate -> minor)
        this._violations = this.sortViolationsByPriority(violations);
        this._scanCompleted = true;

        // Update session state with pending violations
        const violationIds = this._violations.map(v => v.id);
        this._sessionManager.setPendingViolations(violationIds);

        this.recordEvent('SCAN_COMPLETE', { violations: this._violations, url } as ScanCompleteData);

        if (this._violations.length === 0) {
            this.transitionTo('COMPLETE');
        } else {
            this.transitionTo('PLANNING');
        }
    }

    /**
     * Sorts violations by impact priority
     * Requirements: 1.2
     */
    private sortViolationsByPriority(violations: ViolationWithImpact[]): ViolationWithImpact[] {
        return [...violations].sort((a, b) => {
            const priorityA = IMPACT_PRIORITY[a.impact] ?? 999;
            const priorityB = IMPACT_PRIORITY[b.impact] ?? 999;
            return priorityA - priorityB;
        });
    }

    /**
     * Starts planning for the next violation
     * Requirements: 1.3
     */
    startPlanning(pageContext?: PageContext): void {
        if (this._state !== 'PLANNING') {
            throw new WorkflowTransitionError(
                this._state,
                'START_PLANNING',
                `Cannot start planning from state ${this._state}. Must be in PLANNING state.`
            );
        }

        // Get the next pending violation
        const nextViolationId = this._sessionManager.getNextPendingViolation();
        if (!nextViolationId) {
            this.transitionTo('COMPLETE');
            this.recordEvent('ALL_VIOLATIONS_PROCESSED');
            return;
        }

        // Find the violation object
        this._currentViolation = this._violations.find(v => v.id === nextViolationId) ?? null;
        if (!this._currentViolation) {
            throw new Error(`Violation ${nextViolationId} not found in violations list`);
        }

        this._sessionManager.setCurrentViolation(nextViolationId);
        this._pageContext = pageContext ?? { url: this._sessionManager.getCurrentUrl() };

        this.recordEvent('START_PLANNING', { violationId: nextViolationId });
    }

    /**
     * Completes planning with a fix instruction
     * Requirements: 1.3
     */
    async completePlanning(): Promise<FixInstruction> {
        if (this._state !== 'PLANNING' || !this._currentViolation) {
            throw new WorkflowTransitionError(
                this._state,
                'PLAN_COMPLETE',
                `Cannot complete planning from state ${this._state} or without current violation.`
            );
        }

        // Use specialist router to plan the fix
        const context = this._pageContext ?? { url: this._sessionManager.getCurrentUrl() };
        this._currentInstruction = await this._specialistRouter.planFix(this._currentViolation, context);

        this.recordEvent('PLAN_COMPLETE', {
            violationId: this._currentViolation.id,
            instruction: this._currentInstruction
        } as PlanCompleteData);

        this.transitionTo('EXECUTING');
        return this._currentInstruction;
    }

    /**
     * Starts execution of the current fix instruction
     * Requirements: 1.3
     */
    startExecution(): void {
        if (this._state !== 'EXECUTING') {
            throw new WorkflowTransitionError(
                this._state,
                'START_EXECUTION',
                `Cannot start execution from state ${this._state}. Must be in EXECUTING state.`
            );
        }

        // Enforce audit-first
        this.requireScanComplete();

        this.recordEvent('START_EXECUTION', {
            violationId: this._currentViolation?.id,
            instruction: this._currentInstruction
        });
    }

    /**
     * Completes execution with the fix result
     * Requirements: 1.3
     */
    completeExecution(result: FixResult): void {
        if (this._state !== 'EXECUTING') {
            throw new WorkflowTransitionError(
                this._state,
                'EXECUTION_COMPLETE',
                `Cannot complete execution from state ${this._state}. Must be in EXECUTING state.`
            );
        }

        this.recordEvent('EXECUTION_COMPLETE', {
            violationId: this._currentViolation?.id,
            result
        } as ExecutionCompleteData);

        this.transitionTo('VERIFYING');
    }

    /**
     * Starts verification of the applied fix
     * Requirements: 1.3
     */
    startVerification(): void {
        if (this._state !== 'VERIFYING') {
            throw new WorkflowTransitionError(
                this._state,
                'START_VERIFICATION',
                `Cannot start verification from state ${this._state}. Must be in VERIFYING state.`
            );
        }

        this.recordEvent('START_VERIFICATION', {
            violationId: this._currentViolation?.id
        });
    }

    /**
     * Handles verification result
     * Requirements: 1.3, 1.4
     * 
     * @param passed - Whether verification passed
     * @param reason - Reason for failure (if applicable)
     */
    handleVerificationResult(passed: boolean, reason?: string): void {
        if (this._state !== 'VERIFYING') {
            throw new WorkflowTransitionError(
                this._state,
                passed ? 'VERIFICATION_PASS' : 'VERIFICATION_FAIL',
                `Cannot handle verification result from state ${this._state}. Must be in VERIFYING state.`
            );
        }

        const violationId = this._currentViolation?.id;
        if (!violationId) {
            throw new Error('No current violation to verify');
        }

        if (passed) {
            // Mark violation as fixed
            this._sessionManager.markViolationFixed(violationId);
            this.recordEvent('VERIFICATION_PASS', { violationId, passed: true } as VerificationResultData);
        } else {
            // Increment retry counter
            this._sessionManager.incrementRetry(violationId, reason);

            // Check three-strike rule
            if (this._sessionManager.hasReachedThreeStrikeLimit(violationId)) {
                this._sessionManager.skipViolation(
                    violationId,
                    reason ?? `Max retries (${SessionStateManager.MAX_RETRY_ATTEMPTS}) exceeded`
                );
            }

            this.recordEvent('VERIFICATION_FAIL', {
                violationId,
                passed: false,
                reason
            } as VerificationResultData);
        }

        // Clear current violation
        this._currentViolation = null;
        this._currentInstruction = null;

        // Check if there are more violations to process
        if (this._sessionManager.isComplete()) {
            this.transitionTo('COMPLETE');
            this.recordEvent('ALL_VIOLATIONS_PROCESSED');
        } else {
            this.transitionTo('PLANNING');
        }
    }

    /**
     * Resets the workflow to IDLE state
     */
    reset(): void {
        this.recordEvent('RESET');
        this._state = 'IDLE';
        this._scanCompleted = false;
        this._violations = [];
        this._currentViolation = null;
        this._currentInstruction = null;
        this._pageContext = null;
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Gets the processing order of violations (for testing)
     * Requirements: 1.2
     */
    getProcessingOrder(): string[] {
        return this._violations.map(v => v.id);
    }

    /**
     * Checks if the workflow is complete
     */
    isComplete(): boolean {
        return this._state === 'COMPLETE';
    }

    /**
     * Gets a summary of the workflow state
     */
    getSummary(): {
        state: WorkflowState;
        scanCompleted: boolean;
        totalViolations: number;
        processedCount: number;
        fixedCount: number;
        skippedCount: number;
        pendingCount: number;
    } {
        const sessionSummary = this._sessionManager.getSummary();
        return {
            state: this._state,
            scanCompleted: this._scanCompleted,
            totalViolations: this._violations.length,
            processedCount: sessionSummary.totalProcessed,
            fixedCount: sessionSummary.fixedCount,
            skippedCount: sessionSummary.skippedCount,
            pendingCount: sessionSummary.pendingCount
        };
    }

    /**
     * Gets the action sequence from event history
     * Useful for verifying fix-verify cycle structure
     */
    getActionSequence(): WorkflowAction[] {
        return this._eventHistory.map(e => e.type);
    }

    /**
     * Validates that the action sequence follows the fix-verify cycle pattern
     * Requirements: 1.3
     */
    validateFixVerifyCycle(): boolean {
        const sequence = this.getActionSequence();

        // Find all PLAN_COMPLETE events
        for (let i = 0; i < sequence.length; i++) {
            if (sequence[i] === 'PLAN_COMPLETE') {
                // Must be followed by START_EXECUTION
                if (sequence[i + 1] !== 'START_EXECUTION') {
                    return false;
                }
                // Then EXECUTION_COMPLETE
                if (sequence[i + 2] !== 'EXECUTION_COMPLETE') {
                    return false;
                }
                // Then START_VERIFICATION
                if (sequence[i + 3] !== 'START_VERIFICATION') {
                    return false;
                }
                // Then VERIFICATION_PASS or VERIFICATION_FAIL
                if (sequence[i + 4] !== 'VERIFICATION_PASS' && sequence[i + 4] !== 'VERIFICATION_FAIL') {
                    return false;
                }
            }
        }

        return true;
    }

    // ========================================================================
    // Completion Detection and Report Generation
    // Requirements: 1.5
    // ========================================================================

    /**
     * Detects if all violations have been processed
     * Requirements: 1.5
     * 
     * @returns true if the workflow is complete and all violations processed
     */
    detectCompletion(): boolean {
        return this._state === 'COMPLETE' && this._sessionManager.isComplete();
    }

    /**
     * Generates a remediation report when the workflow is complete
     * Requirements: 1.5, 9.1, 9.2, 9.3, 9.4
     * 
     * @param sessionId - The session ID for the report
     * @param auditLogger - The audit logger with fix history
     * @returns The generated remediation report
     * @throws Error if workflow is not complete
     */
    generateReport(sessionId: string, auditLogger: AuditLogger): RemediationReport {
        if (!this.detectCompletion()) {
            throw new Error('Cannot generate report: workflow is not complete');
        }

        const generator = new ReportGenerator(sessionId, this._sessionManager.getCurrentUrl());

        // Build violation metadata map
        const violationMap = new Map<string, ViolationMetadata>();
        for (const violation of this._violations) {
            violationMap.set(violation.id, {
                violationId: violation.id,
                ruleId: violation.ruleId,
                selector: violation.selector
            });
        }

        // Populate from session state and audit logs
        generator.populateFromSession(this._sessionManager, auditLogger, violationMap);

        return generator.generate();
    }

    /**
     * Gets violation metadata for report generation
     */
    getViolationMetadata(): Map<string, ViolationMetadata> {
        const map = new Map<string, ViolationMetadata>();
        for (const violation of this._violations) {
            map.set(violation.id, {
                violationId: violation.id,
                ruleId: violation.ruleId,
                selector: violation.selector
            });
        }
        return map;
    }
}
