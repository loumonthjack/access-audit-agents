/**
 * SessionStateManager - Manages session state for the orchestration workflow
 * 
 * Handles state initialization, serialization/deserialization for Bedrock sessionAttributes,
 * and state transitions during the remediation process.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 4.1
 */

import {
    SessionState,
    validateSessionState,
    safeParseSessionState,
    createEmptySessionState
} from '../types/index.js';

/**
 * Retry tracking for individual violations
 */
interface ViolationRetryState {
    violationId: string;
    attempts: number;
    lastFailureReason?: string;
}

/**
 * SessionStateManager class
 * 
 * Manages the lifecycle of session state across Bedrock Agent invocations.
 * Provides methods for state transitions during the remediation workflow.
 */
export class SessionStateManager {
    private state: SessionState;
    private retryTracker: Map<string, ViolationRetryState>;

    /**
     * Maximum retry attempts before a violation is skipped (Three-Strike Rule)
     * Requirements: 4.1
     */
    public static readonly MAX_RETRY_ATTEMPTS = 3;

    /**
     * Creates a new SessionStateManager
     * @param initialUrl - The URL being remediated
     */
    constructor(initialUrl: string) {
        this.state = createEmptySessionState(initialUrl);
        this.retryTracker = new Map();
    }

    /**
     * Creates a SessionStateManager from existing Bedrock sessionAttributes
     * Used to restore state across agent invocations
     * Requirements: 3.4
     * 
     * @param sessionAttributes - The sessionAttributes from Bedrock
     * @returns SessionStateManager instance
     * @throws Error if sessionAttributes are invalid
     */
    static fromSessionAttributes(sessionAttributes: Record<string, string>): SessionStateManager {
        const state: SessionState = {
            sessionAttributes: {
                current_url: sessionAttributes.current_url ?? '',
                pending_violations: sessionAttributes.pending_violations ?? '[]',
                current_violation_id: sessionAttributes.current_violation_id ?? null,
                retry_attempts: parseInt(sessionAttributes.retry_attempts ?? '0', 10),
                human_handoff_reason: sessionAttributes.human_handoff_reason ?? null,
                fixed_violations: sessionAttributes.fixed_violations ?? '[]',
                skipped_violations: sessionAttributes.skipped_violations ?? '[]'
            }
        };

        // Validate the reconstructed state
        validateSessionState(state);

        const manager = new SessionStateManager(state.sessionAttributes.current_url);
        manager.state = state;
        manager.rebuildRetryTracker();
        return manager;
    }

    /**
     * Rebuilds the retry tracker from the current state
     * Called when restoring from sessionAttributes
     */
    private rebuildRetryTracker(): void {
        this.retryTracker.clear();
        const currentId = this.state.sessionAttributes.current_violation_id;
        if (currentId) {
            this.retryTracker.set(currentId, {
                violationId: currentId,
                attempts: this.state.sessionAttributes.retry_attempts
            });
        }
    }

    /**
     * Gets the current session state
     */
    getState(): SessionState {
        return { ...this.state };
    }

    /**
     * Gets the session attributes for Bedrock
     * Requirements: 3.4
     */
    getSessionAttributes(): Record<string, string> {
        const attrs = this.state.sessionAttributes;
        return {
            current_url: attrs.current_url,
            pending_violations: attrs.pending_violations,
            current_violation_id: attrs.current_violation_id ?? '',
            retry_attempts: String(attrs.retry_attempts),
            human_handoff_reason: attrs.human_handoff_reason ?? '',
            fixed_violations: attrs.fixed_violations,
            skipped_violations: attrs.skipped_violations
        };
    }


    /**
     * Gets the current URL being remediated
     */
    getCurrentUrl(): string {
        return this.state.sessionAttributes.current_url;
    }

    /**
     * Gets the list of pending violation IDs
     */
    getPendingViolations(): string[] {
        return JSON.parse(this.state.sessionAttributes.pending_violations) as string[];
    }

    /**
     * Gets the list of fixed violation IDs
     */
    getFixedViolations(): string[] {
        return JSON.parse(this.state.sessionAttributes.fixed_violations) as string[];
    }

    /**
     * Gets the list of skipped violation IDs
     */
    getSkippedViolations(): string[] {
        return JSON.parse(this.state.sessionAttributes.skipped_violations) as string[];
    }

    /**
     * Gets the current violation being processed
     */
    getCurrentViolationId(): string | null {
        return this.state.sessionAttributes.current_violation_id;
    }

    /**
     * Gets the retry attempts for the current violation
     */
    getRetryAttempts(): number {
        return this.state.sessionAttributes.retry_attempts;
    }

    /**
     * Gets the retry attempts for a specific violation
     */
    getRetryAttemptsForViolation(violationId: string): number {
        return this.retryTracker.get(violationId)?.attempts ?? 0;
    }

    /**
     * Sets the pending violations to process
     * @param violationIds - Array of violation IDs to process
     */
    setPendingViolations(violationIds: string[]): void {
        this.state.sessionAttributes.pending_violations = JSON.stringify(violationIds);
    }

    /**
     * Sets the current violation being processed
     * @param violationId - The violation ID to set as current
     */
    setCurrentViolation(violationId: string | null): void {
        this.state.sessionAttributes.current_violation_id = violationId;
        if (violationId) {
            // Initialize retry tracker for this violation if not exists
            if (!this.retryTracker.has(violationId)) {
                this.retryTracker.set(violationId, {
                    violationId,
                    attempts: 0
                });
            }
            // Sync retry_attempts with the tracker
            this.state.sessionAttributes.retry_attempts = this.retryTracker.get(violationId)!.attempts;
        } else {
            this.state.sessionAttributes.retry_attempts = 0;
        }
    }

    /**
     * Marks a violation as fixed and moves it from pending to fixed
     * Requirements: 3.2
     * 
     * @param violationId - The violation ID that was successfully fixed
     * @returns true if the violation was found and moved, false otherwise
     */
    markViolationFixed(violationId: string): boolean {
        const pending = this.getPendingViolations();
        const index = pending.indexOf(violationId);

        if (index === -1) {
            return false;
        }

        // Remove from pending
        pending.splice(index, 1);
        this.state.sessionAttributes.pending_violations = JSON.stringify(pending);

        // Add to fixed
        const fixed = this.getFixedViolations();
        if (!fixed.includes(violationId)) {
            fixed.push(violationId);
            this.state.sessionAttributes.fixed_violations = JSON.stringify(fixed);
        }

        // Clear current violation if it was the one fixed
        if (this.state.sessionAttributes.current_violation_id === violationId) {
            this.state.sessionAttributes.current_violation_id = null;
            this.state.sessionAttributes.retry_attempts = 0;
        }

        // Clean up retry tracker
        this.retryTracker.delete(violationId);

        return true;
    }

    /**
     * Increments the retry counter for a violation
     * Requirements: 3.3
     * 
     * @param violationId - The violation ID to increment retry for
     * @param failureReason - Optional reason for the failure
     * @returns The new retry count
     */
    incrementRetry(violationId: string, failureReason?: string): number {
        let tracker = this.retryTracker.get(violationId);

        if (!tracker) {
            tracker = {
                violationId,
                attempts: 0
            };
            this.retryTracker.set(violationId, tracker);
        }

        tracker.attempts += 1;
        if (failureReason) {
            tracker.lastFailureReason = failureReason;
        }

        // Update state if this is the current violation
        if (this.state.sessionAttributes.current_violation_id === violationId) {
            this.state.sessionAttributes.retry_attempts = tracker.attempts;
        }

        return tracker.attempts;
    }


    /**
     * Skips a violation and moves it from pending to skipped
     * Requirements: 4.1
     * 
     * @param violationId - The violation ID to skip
     * @param reason - The reason for skipping (will be set as human_handoff_reason)
     * @returns true if the violation was found and skipped, false otherwise
     */
    skipViolation(violationId: string, reason: string): boolean {
        const pending = this.getPendingViolations();
        const index = pending.indexOf(violationId);

        if (index === -1) {
            return false;
        }

        // Remove from pending
        pending.splice(index, 1);
        this.state.sessionAttributes.pending_violations = JSON.stringify(pending);

        // Add to skipped
        const skipped = this.getSkippedViolations();
        if (!skipped.includes(violationId)) {
            skipped.push(violationId);
            this.state.sessionAttributes.skipped_violations = JSON.stringify(skipped);
        }

        // Set human handoff reason
        this.state.sessionAttributes.human_handoff_reason = reason;

        // Clear current violation if it was the one skipped
        if (this.state.sessionAttributes.current_violation_id === violationId) {
            this.state.sessionAttributes.current_violation_id = null;
            this.state.sessionAttributes.retry_attempts = 0;
        }

        // Clean up retry tracker
        this.retryTracker.delete(violationId);

        return true;
    }

    /**
     * Checks if a violation has reached the three-strike limit
     * Requirements: 4.1
     * 
     * @param violationId - The violation ID to check
     * @returns true if the violation has reached MAX_RETRY_ATTEMPTS
     */
    hasReachedThreeStrikeLimit(violationId: string): boolean {
        const attempts = this.getRetryAttemptsForViolation(violationId);
        return attempts >= SessionStateManager.MAX_RETRY_ATTEMPTS;
    }

    /**
     * Gets the failure reason for a violation from the retry tracker
     * @param violationId - The violation ID
     * @returns The last failure reason or undefined
     */
    getLastFailureReason(violationId: string): string | undefined {
        return this.retryTracker.get(violationId)?.lastFailureReason;
    }

    /**
     * Gets the next pending violation to process
     * @returns The next violation ID or null if none pending
     */
    getNextPendingViolation(): string | null {
        const pending = this.getPendingViolations();
        const first = pending[0];
        return first !== undefined ? first : null;
    }

    /**
     * Checks if all violations have been processed
     * @returns true if no pending violations remain
     */
    isComplete(): boolean {
        return this.getPendingViolations().length === 0;
    }

    /**
     * Gets a summary of the current state
     */
    getSummary(): {
        totalProcessed: number;
        fixedCount: number;
        skippedCount: number;
        pendingCount: number;
    } {
        const fixed = this.getFixedViolations();
        const skipped = this.getSkippedViolations();
        const pending = this.getPendingViolations();

        return {
            totalProcessed: fixed.length + skipped.length,
            fixedCount: fixed.length,
            skippedCount: skipped.length,
            pendingCount: pending.length
        };
    }

    /**
     * Serializes the session state to a JSON string
     * Requirements: 3.4
     */
    serialize(): string {
        return JSON.stringify(this.state);
    }

    /**
     * Creates a SessionStateManager from a serialized JSON string
     * Requirements: 3.4
     * 
     * @param json - The serialized session state
     * @returns SessionStateManager instance
     * @throws Error if JSON is invalid or state validation fails
     */
    static deserialize(json: string): SessionStateManager {
        const parsed = JSON.parse(json) as unknown;
        const state = validateSessionState(parsed);

        const manager = new SessionStateManager(state.sessionAttributes.current_url);
        manager.state = state;
        manager.rebuildRetryTracker();
        return manager;
    }

    /**
     * Validates the current state
     * @returns true if state is valid
     */
    isValid(): boolean {
        const result = safeParseSessionState(this.state);
        return result.success;
    }
}
