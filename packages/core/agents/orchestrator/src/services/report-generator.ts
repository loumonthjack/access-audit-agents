/**
 * Report Generator for Remediation Reports
 * 
 * Aggregates fixed, skipped, and handoff items to generate comprehensive
 * remediation reports with accurate summary counts.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 1.5
 */

import type {
    RemediationReport,
    AppliedFix,
    SkippedViolation,
    HumanHandoffItem,
    ReportSummary,
    AuditLogEntry,
    FixType
} from '../types/index.js';
import { RemediationReportSchema } from '../types/index.js';
import type { SessionStateManager } from './session-state-manager.js';
import type { AuditLogger } from './audit-logger.js';
import type { Violation } from './specialists/specialist-agent.js';

// ============================================================================
// Violation Metadata Interface
// ============================================================================

/**
 * Extended violation information needed for report generation
 */
export interface ViolationMetadata {
    violationId: string;
    ruleId: string;
    selector: string;
    reason?: string;
    attempts?: number;
    suggestedAction?: string;
}

// ============================================================================
// Report Generator Class
// ============================================================================

/**
 * ReportGenerator creates comprehensive remediation reports from session state
 * and audit logs.
 * 
 * Requirements:
 * - 9.1: Return RemediationReport containing all applied fixes
 * - 9.2: Include fix details (violation_id, selector, fix_type, before_html, after_html)
 * - 9.3: Include summary counts (total_violations, fixed_count, skipped_count)
 * - 9.4: Include human_handoff items with reasons
 * - 1.5: Report completion status with fix counts
 */
export class ReportGenerator {
    private sessionId: string;
    private url: string;
    private fixes: AppliedFix[] = [];
    private skipped: SkippedViolation[] = [];
    private humanHandoff: HumanHandoffItem[] = [];
    private pendingCount: number = 0;
    private violationMetadata: Map<string, ViolationMetadata> = new Map();

    /**
     * Creates a new ReportGenerator
     * @param sessionId - The session ID for the report
     * @param url - The URL being remediated
     */
    constructor(sessionId: string, url: string) {
        this.sessionId = sessionId;
        this.url = url;
    }

    /**
     * Registers violation metadata for later use in report generation
     * @param violations - Array of violations with metadata
     */
    registerViolations(violations: Array<Violation & { ruleId: string }>): void {
        for (const violation of violations) {
            this.violationMetadata.set(violation.id, {
                violationId: violation.id,
                ruleId: violation.ruleId,
                selector: violation.selector
            });
        }
    }

    /**
     * Adds a fixed violation to the report
     * Requirements: 9.1, 9.2
     * 
     * @param fix - The applied fix details
     */
    addFix(fix: AppliedFix): void {
        this.fixes.push(fix);
    }

    /**
     * Creates an AppliedFix from an audit log entry
     * Requirements: 9.2
     */
    createFixFromAuditLog(entry: AuditLogEntry): AppliedFix {
        return {
            violationId: entry.violationId,
            ruleId: entry.instruction.type, // Use instruction type as fallback
            selector: entry.instruction.selector,
            fixType: entry.instruction.type as FixType,
            beforeHtml: entry.beforeHtml,
            afterHtml: entry.afterHtml,
            reasoning: entry.instruction.reasoning
        };
    }

    /**
     * Adds a skipped violation to the report
     * Requirements: 9.1
     * 
     * @param skipped - The skipped violation details
     */
    addSkipped(skipped: SkippedViolation): void {
        this.skipped.push(skipped);
    }

    /**
     * Adds a human handoff item to the report
     * Requirements: 9.4
     * 
     * @param handoff - The human handoff item
     */
    addHumanHandoff(handoff: HumanHandoffItem): void {
        this.humanHandoff.push(handoff);
    }

    /**
     * Sets the pending violation count
     * @param count - Number of pending violations
     */
    setPendingCount(count: number): void {
        this.pendingCount = count;
    }

    /**
     * Calculates summary counts from the current state
     * Requirements: 9.3
     */
    calculateSummary(): ReportSummary {
        return {
            totalViolations: this.fixes.length + this.skipped.length + this.pendingCount,
            fixedCount: this.fixes.length,
            skippedCount: this.skipped.length,
            pendingCount: this.pendingCount
        };
    }

    /**
     * Generates the complete remediation report
     * Requirements: 9.1, 9.2, 9.3, 9.4
     */
    generate(): RemediationReport {
        const report: RemediationReport = {
            sessionId: this.sessionId,
            url: this.url,
            timestamp: new Date().toISOString(),
            summary: this.calculateSummary(),
            fixes: [...this.fixes],
            skipped: [...this.skipped],
            humanHandoff: [...this.humanHandoff]
        };

        // Validate the report
        RemediationReportSchema.parse(report);

        return report;
    }

    /**
     * Populates the report from a SessionStateManager and AuditLogger
     * Requirements: 9.1, 9.2, 9.3, 9.4
     * 
     * @param sessionManager - The session state manager
     * @param auditLogger - The audit logger with fix history
     * @param violationMap - Map of violation IDs to violation details
     */
    populateFromSession(
        sessionManager: SessionStateManager,
        auditLogger: AuditLogger,
        violationMap: Map<string, ViolationMetadata>
    ): void {
        // Get fixed violations and create AppliedFix entries from audit logs
        const fixedIds = sessionManager.getFixedViolations();
        for (const violationId of fixedIds) {
            const logs = auditLogger.getByViolationId(this.sessionId, violationId);
            const appliedLog = logs.find(l => l.result === 'applied');

            if (appliedLog) {
                const metadata = violationMap.get(violationId);
                this.addFix({
                    violationId,
                    ruleId: metadata?.ruleId ?? appliedLog.instruction.type,
                    selector: appliedLog.instruction.selector,
                    fixType: appliedLog.instruction.type as FixType,
                    beforeHtml: appliedLog.beforeHtml,
                    afterHtml: appliedLog.afterHtml,
                    reasoning: appliedLog.instruction.reasoning
                });
            }
        }

        // Get skipped violations
        const skippedIds = sessionManager.getSkippedViolations();
        for (const violationId of skippedIds) {
            const metadata = violationMap.get(violationId);
            const reason = sessionManager.getLastFailureReason(violationId) ??
                'Maximum retry attempts exceeded';
            const attempts = sessionManager.getRetryAttemptsForViolation(violationId);

            this.addSkipped({
                violationId,
                ruleId: metadata?.ruleId ?? 'unknown',
                selector: metadata?.selector ?? 'unknown',
                reason,
                attempts
            });

            // Also add to human handoff if it was skipped due to three-strike rule
            if (attempts >= 3) {
                this.addHumanHandoff({
                    violationId,
                    ruleId: metadata?.ruleId ?? 'unknown',
                    selector: metadata?.selector ?? 'unknown',
                    reason,
                    suggestedAction: metadata?.suggestedAction ??
                        'Manual review required - automated remediation failed after multiple attempts'
                });
            }
        }

        // Set pending count
        this.setPendingCount(sessionManager.getPendingViolations().length);
    }

    /**
     * Checks if all violations have been processed (completion detection)
     * Requirements: 1.5
     */
    isComplete(): boolean {
        return this.pendingCount === 0;
    }

    /**
     * Gets the current fix count
     */
    getFixedCount(): number {
        return this.fixes.length;
    }

    /**
     * Gets the current skipped count
     */
    getSkippedCount(): number {
        return this.skipped.length;
    }

    /**
     * Gets the current human handoff count
     */
    getHumanHandoffCount(): number {
        return this.humanHandoff.length;
    }

    /**
     * Clears all data from the generator
     */
    clear(): void {
        this.fixes = [];
        this.skipped = [];
        this.humanHandoff = [];
        this.pendingCount = 0;
        this.violationMetadata.clear();
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a ReportGenerator and populates it from session state
 * 
 * @param sessionId - The session ID
 * @param url - The URL being remediated
 * @param sessionManager - The session state manager
 * @param auditLogger - The audit logger
 * @param violationMap - Map of violation IDs to metadata
 */
export function createReportFromSession(
    sessionId: string,
    url: string,
    sessionManager: SessionStateManager,
    auditLogger: AuditLogger,
    violationMap: Map<string, ViolationMetadata>
): RemediationReport {
    const generator = new ReportGenerator(sessionId, url);
    generator.populateFromSession(sessionManager, auditLogger, violationMap);
    return generator.generate();
}

/**
 * Detects if remediation is complete and generates report if so
 * Requirements: 1.5
 * 
 * @param sessionManager - The session state manager
 * @returns true if all violations have been processed
 */
export function isRemediationComplete(sessionManager: SessionStateManager): boolean {
    return sessionManager.isComplete();
}
