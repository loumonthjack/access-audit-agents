/**
 * Audit Logger for Fix Operations
 * 
 * Creates and stores audit log entries for all applied fixes.
 * Requirements: 5.4
 */

import type { FixInstruction, AuditLogEntry, AuditLogResult } from '../types/index.js';
import { AuditLogEntrySchema } from '../types/index.js';

// ============================================================================
// Audit Logger Class
// ============================================================================

export class AuditLogger {
    private logs: Map<string, AuditLogEntry[]> = new Map();

    /**
     * Creates an audit log entry for a fix operation
     * Requirements: 5.4 - Log all applied fixes with before/after snapshots
     */
    createEntry(
        sessionId: string,
        violationId: string,
        instruction: FixInstruction,
        beforeHtml: string,
        afterHtml: string,
        result: AuditLogResult
    ): AuditLogEntry {
        const entry: AuditLogEntry = {
            timestamp: new Date().toISOString(),
            sessionId,
            violationId,
            instruction,
            beforeHtml,
            afterHtml,
            result
        };

        // Validate the entry
        AuditLogEntrySchema.parse(entry);

        return entry;
    }

    /**
     * Records an audit log entry
     */
    record(entry: AuditLogEntry): void {
        const sessionLogs = this.logs.get(entry.sessionId) ?? [];
        sessionLogs.push(entry);
        this.logs.set(entry.sessionId, sessionLogs);
    }

    /**
     * Creates and records an audit log entry in one operation
     */
    log(
        sessionId: string,
        violationId: string,
        instruction: FixInstruction,
        beforeHtml: string,
        afterHtml: string,
        result: AuditLogResult
    ): AuditLogEntry {
        const entry = this.createEntry(
            sessionId,
            violationId,
            instruction,
            beforeHtml,
            afterHtml,
            result
        );
        this.record(entry);
        return entry;
    }

    /**
     * Queries logs by session ID
     * Requirements: 5.4 - Support querying logs by sessionId
     */
    getBySessionId(sessionId: string): AuditLogEntry[] {
        return this.logs.get(sessionId) ?? [];
    }

    /**
     * Gets all logs for a specific violation
     */
    getByViolationId(sessionId: string, violationId: string): AuditLogEntry[] {
        const sessionLogs = this.getBySessionId(sessionId);
        return sessionLogs.filter(log => log.violationId === violationId);
    }

    /**
     * Gets logs filtered by result type
     */
    getByResult(sessionId: string, result: AuditLogResult): AuditLogEntry[] {
        const sessionLogs = this.getBySessionId(sessionId);
        return sessionLogs.filter(log => log.result === result);
    }

    /**
     * Gets the count of logs for a session
     */
    getCount(sessionId: string): number {
        return this.getBySessionId(sessionId).length;
    }

    /**
     * Gets summary statistics for a session
     */
    getSummary(sessionId: string): {
        total: number;
        applied: number;
        rejected: number;
        rolledBack: number;
    } {
        const logs = this.getBySessionId(sessionId);
        return {
            total: logs.length,
            applied: logs.filter(l => l.result === 'applied').length,
            rejected: logs.filter(l => l.result === 'rejected').length,
            rolledBack: logs.filter(l => l.result === 'rolled_back').length
        };
    }

    /**
     * Clears logs for a session
     */
    clearSession(sessionId: string): void {
        this.logs.delete(sessionId);
    }

    /**
     * Clears all logs
     */
    clearAll(): void {
        this.logs.clear();
    }

    /**
     * Gets all session IDs with logs
     */
    getSessionIds(): string[] {
        return Array.from(this.logs.keys());
    }
}

/**
 * Singleton instance for convenience
 */
export const auditLogger = new AuditLogger();
