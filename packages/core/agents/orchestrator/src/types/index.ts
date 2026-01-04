/**
 * Core type definitions for Agent Orchestration
 * 
 * This module defines all data models and Zod schemas for runtime validation.
 * Requirements: 3.1, 9.1, 9.2
 */

import { z } from 'zod';

// ============================================================================
// Injector Error Codes
// ============================================================================

export const InjectorErrorCodeSchema = z.enum([
    'SELECTOR_NOT_FOUND',
    'CONTENT_CHANGED',
    'VALIDATION_FAILED',
    'DESTRUCTIVE_CHANGE',
    'STYLE_CONFLICT'
]);

export type InjectorErrorCode = z.infer<typeof InjectorErrorCodeSchema>;

// ============================================================================
// Injector Error
// ============================================================================

export const InjectorErrorSchema = z.object({
    code: InjectorErrorCodeSchema,
    message: z.string().min(1),
    selector: z.string(),
    details: z.record(z.unknown()).optional()
});

export type InjectorError = z.infer<typeof InjectorErrorSchema>;

// ============================================================================
// Fix Instruction Types
// ============================================================================

export const FixTypeSchema = z.enum(['attribute', 'content', 'style']);
export type FixType = z.infer<typeof FixTypeSchema>;

// ============================================================================
// Attribute Fix Parameters
// ============================================================================

export const AttributeFixParamsSchema = z.object({
    selector: z.string().min(1),
    attribute: z.string().min(1),
    value: z.string(),
    reasoning: z.string().min(1)
});

export type AttributeFixParams = z.infer<typeof AttributeFixParamsSchema>;

// ============================================================================
// Content Fix Parameters
// ============================================================================

export const ContentFixParamsSchema = z.object({
    selector: z.string().min(1),
    innerText: z.string(),
    originalTextHash: z.string().min(1) // SHA-256 hash
});

export type ContentFixParams = z.infer<typeof ContentFixParamsSchema>;

// ============================================================================
// Style Fix Parameters
// ============================================================================

export const StyleFixParamsSchema = z.object({
    selector: z.string().min(1),
    cssClass: z.string(),
    styles: z.record(z.string())
});

export type StyleFixParams = z.infer<typeof StyleFixParamsSchema>;


// ============================================================================
// Fix Instruction
// ============================================================================

export const FixInstructionSchema = z.object({
    type: FixTypeSchema,
    selector: z.string().min(1),
    violationId: z.string().min(1),
    reasoning: z.string().min(1),
    params: z.union([
        AttributeFixParamsSchema,
        ContentFixParamsSchema,
        StyleFixParamsSchema
    ])
});

export type FixInstruction = z.infer<typeof FixInstructionSchema>;

// ============================================================================
// Fix Result
// ============================================================================

export const FixResultSchema = z.object({
    success: z.boolean(),
    selector: z.string(),
    beforeHtml: z.string(),
    afterHtml: z.string(),
    error: InjectorErrorSchema.optional()
});

export type FixResult = z.infer<typeof FixResultSchema>;

// ============================================================================
// Session State
// Requirements: 3.1 - Session state containing all required fields
// ============================================================================

export const SessionStateAttributesSchema = z.object({
    current_url: z.string(),
    pending_violations: z.string(), // JSON array of violation IDs
    current_violation_id: z.string().nullable(),
    retry_attempts: z.number().int().nonnegative(),
    human_handoff_reason: z.string().nullable(),
    fixed_violations: z.string(), // JSON array of fixed violation IDs
    skipped_violations: z.string() // JSON array of skipped violation IDs
});

export type SessionStateAttributes = z.infer<typeof SessionStateAttributesSchema>;

export const SessionStateSchema = z.object({
    sessionAttributes: SessionStateAttributesSchema
});

export type SessionState = z.infer<typeof SessionStateSchema>;

// ============================================================================
// Applied Fix
// Requirements: 9.2 - Fix details including violation_id, selector, fix_type, before_html, after_html
// ============================================================================

export const AppliedFixSchema = z.object({
    violationId: z.string().min(1),
    ruleId: z.string().min(1),
    selector: z.string().min(1),
    fixType: FixTypeSchema,
    beforeHtml: z.string(),
    afterHtml: z.string(),
    reasoning: z.string()
});

export type AppliedFix = z.infer<typeof AppliedFixSchema>;


// ============================================================================
// Skipped Violation
// Requirements: 9.1 - Skipped violations with reasons
// ============================================================================

export const SkippedViolationSchema = z.object({
    violationId: z.string().min(1),
    ruleId: z.string().min(1),
    selector: z.string().min(1),
    reason: z.string().min(1),
    attempts: z.number().int().nonnegative()
});

export type SkippedViolation = z.infer<typeof SkippedViolationSchema>;

// ============================================================================
// Human Handoff Item
// Requirements: 9.4 - Human handoff items with reasons
// ============================================================================

export const HumanHandoffItemSchema = z.object({
    violationId: z.string().min(1),
    ruleId: z.string().min(1),
    selector: z.string().min(1),
    reason: z.string().min(1),
    suggestedAction: z.string().min(1)
});

export type HumanHandoffItem = z.infer<typeof HumanHandoffItemSchema>;

// ============================================================================
// Remediation Report Summary
// Requirements: 9.3 - Summary counts: total_violations, fixed_count, skipped_count
// ============================================================================

export const ReportSummarySchema = z.object({
    totalViolations: z.number().int().nonnegative(),
    fixedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative()
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;

// ============================================================================
// Remediation Report
// Requirements: 9.1, 9.2, 9.3, 9.4 - Complete remediation report
// ============================================================================

export const RemediationReportSchema = z.object({
    sessionId: z.string().min(1),
    url: z.string(),
    timestamp: z.string().datetime(),
    summary: ReportSummarySchema,
    fixes: z.array(AppliedFixSchema),
    skipped: z.array(SkippedViolationSchema),
    humanHandoff: z.array(HumanHandoffItemSchema)
});

export type RemediationReport = z.infer<typeof RemediationReportSchema>;


// ============================================================================
// Audit Log Entry
// Requirements: 5.4 - Audit logging with before/after snapshots
// ============================================================================

export const AuditLogResultSchema = z.enum(['applied', 'rejected', 'rolled_back']);
export type AuditLogResult = z.infer<typeof AuditLogResultSchema>;

export const AuditLogEntrySchema = z.object({
    timestamp: z.string().datetime(),
    sessionId: z.string().min(1),
    violationId: z.string().min(1),
    instruction: FixInstructionSchema,
    beforeHtml: z.string(),
    afterHtml: z.string(),
    result: AuditLogResultSchema
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates a SessionState object at runtime
 * @throws ZodError if validation fails
 */
export function validateSessionState(data: unknown): SessionState {
    return SessionStateSchema.parse(data);
}

/**
 * Safely validates a SessionState object, returning a result object
 */
export function safeParseSessionState(data: unknown): z.SafeParseReturnType<unknown, SessionState> {
    return SessionStateSchema.safeParse(data);
}

/**
 * Validates a FixInstruction object at runtime
 * @throws ZodError if validation fails
 */
export function validateFixInstruction(data: unknown): FixInstruction {
    return FixInstructionSchema.parse(data);
}

/**
 * Safely validates a FixInstruction object, returning a result object
 */
export function safeParseFixInstruction(data: unknown): z.SafeParseReturnType<unknown, FixInstruction> {
    return FixInstructionSchema.safeParse(data);
}

/**
 * Validates a RemediationReport object at runtime
 * @throws ZodError if validation fails
 */
export function validateRemediationReport(data: unknown): RemediationReport {
    return RemediationReportSchema.parse(data);
}

/**
 * Safely validates a RemediationReport object, returning a result object
 */
export function safeParseRemediationReport(data: unknown): z.SafeParseReturnType<unknown, RemediationReport> {
    return RemediationReportSchema.safeParse(data);
}

/**
 * Validates an InjectorError object at runtime
 * @throws ZodError if validation fails
 */
export function validateInjectorError(data: unknown): InjectorError {
    return InjectorErrorSchema.parse(data);
}

/**
 * Safely validates an InjectorError object, returning a result object
 */
export function safeParseInjectorError(data: unknown): z.SafeParseReturnType<unknown, InjectorError> {
    return InjectorErrorSchema.safeParse(data);
}


// ============================================================================
// Serialization Utilities
// ============================================================================

/**
 * Serializes a SessionState to JSON string
 */
export function serializeSessionState(sessionState: SessionState): string {
    return JSON.stringify(sessionState);
}

/**
 * Deserializes a JSON string to SessionState
 * @throws ZodError if validation fails
 */
export function deserializeSessionState(json: string): SessionState {
    const parsed = JSON.parse(json) as unknown;
    return validateSessionState(parsed);
}

/**
 * Safely deserializes a JSON string to SessionState
 */
export function safeDeserializeSessionState(json: string): z.SafeParseReturnType<unknown, SessionState> {
    try {
        const parsed = JSON.parse(json) as unknown;
        return safeParseSessionState(parsed);
    } catch {
        return {
            success: false,
            error: new z.ZodError([{
                code: 'custom',
                message: 'Invalid JSON string',
                path: []
            }])
        };
    }
}

/**
 * Serializes a RemediationReport to JSON string
 */
export function serializeRemediationReport(report: RemediationReport): string {
    return JSON.stringify(report);
}

/**
 * Deserializes a JSON string to RemediationReport
 * @throws ZodError if validation fails
 */
export function deserializeRemediationReport(json: string): RemediationReport {
    const parsed = JSON.parse(json) as unknown;
    return validateRemediationReport(parsed);
}

/**
 * Safely deserializes a JSON string to RemediationReport
 */
export function safeDeserializeRemediationReport(json: string): z.SafeParseReturnType<unknown, RemediationReport> {
    try {
        const parsed = JSON.parse(json) as unknown;
        return safeParseRemediationReport(parsed);
    } catch {
        return {
            success: false,
            error: new z.ZodError([{
                code: 'custom',
                message: 'Invalid JSON string',
                path: []
            }])
        };
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates an empty SessionState with default values
 */
export function createEmptySessionState(url: string): SessionState {
    return {
        sessionAttributes: {
            current_url: url,
            pending_violations: '[]',
            current_violation_id: null,
            retry_attempts: 0,
            human_handoff_reason: null,
            fixed_violations: '[]',
            skipped_violations: '[]'
        }
    };
}

/**
 * Creates an empty RemediationReport
 */
export function createEmptyRemediationReport(sessionId: string, url: string): RemediationReport {
    return {
        sessionId,
        url,
        timestamp: new Date().toISOString(),
        summary: {
            totalViolations: 0,
            fixedCount: 0,
            skippedCount: 0,
            pendingCount: 0
        },
        fixes: [],
        skipped: [],
        humanHandoff: []
    };
}
