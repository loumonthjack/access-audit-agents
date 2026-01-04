/**
 * Core type definitions for the Auditor Agent
 * 
 * This module defines all data models and Zod schemas for runtime validation.
 * Requirements: 2.1, 2.2, 2.4, 6.3
 */

import { z } from 'zod';

// ============================================================================
// Impact Level
// ============================================================================

export const ImpactLevelSchema = z.enum(['critical', 'serious', 'moderate', 'minor']);
export type ImpactLevel = z.infer<typeof ImpactLevelSchema>;

/**
 * Impact level priority for sorting (higher = more severe)
 */
export const IMPACT_PRIORITY: Record<ImpactLevel, number> = {
    critical: 4,
    serious: 3,
    moderate: 2,
    minor: 1
};

// ============================================================================
// Violation Node
// ============================================================================

export const ViolationNodeSchema = z.object({
    selector: z.string(),
    html: z.string(),
    failureSummary: z.string(),
    target: z.array(z.string())
});

export type ViolationNode = z.infer<typeof ViolationNodeSchema>;

// ============================================================================
// Violation
// ============================================================================

export const ViolationSchema = z.object({
    id: z.string(),
    impact: ImpactLevelSchema,
    description: z.string(),
    help: z.string(),
    helpUrl: z.string(),
    nodes: z.array(ViolationNodeSchema)
});

export type Violation = z.infer<typeof ViolationSchema>;


// ============================================================================
// Violation Counts
// ============================================================================

export const ViolationCountsSchema = z.object({
    critical: z.number().int().nonnegative(),
    serious: z.number().int().nonnegative(),
    moderate: z.number().int().nonnegative(),
    minor: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
});

export type ViolationCounts = z.infer<typeof ViolationCountsSchema>;

// ============================================================================
// Viewport
// ============================================================================

export const ViewportSchema = z.enum(['mobile', 'desktop']);
export type Viewport = z.infer<typeof ViewportSchema>;

// ============================================================================
// Scan Metadata
// ============================================================================

export const ScanMetadataSchema = z.object({
    url: z.string().url(),
    timestamp: z.string().datetime(),
    viewport: ViewportSchema,
    violationCounts: ViolationCountsSchema
});

export type ScanMetadata = z.infer<typeof ScanMetadataSchema>;

// ============================================================================
// Pagination Info
// ============================================================================

export const PaginationInfoSchema = z.object({
    currentPage: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    hasMoreViolations: z.boolean()
});

export type PaginationInfo = z.infer<typeof PaginationInfoSchema>;

// ============================================================================
// Scan Result
// ============================================================================

export const SCHEMA_VERSION = '1.0.0' as const;

export const ScanResultSchema = z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    metadata: ScanMetadataSchema,
    violations: z.array(ViolationSchema),
    pagination: PaginationInfoSchema
});

export type ScanResult = z.infer<typeof ScanResultSchema>;


// ============================================================================
// Auditor Error
// ============================================================================

export const AuditorErrorCodeSchema = z.enum([
    'BROWSER_LAUNCH_FAILED',
    'BROWSER_PROVIDER_UNAVAILABLE',
    'AXE_INJECTION_FAILED',
    'AUTOMATION_BLOCKED',
    'URL_UNREACHABLE',
    'TIMEOUT',
    'ELEMENT_NOT_FOUND'
]);

export type AuditorErrorCode = z.infer<typeof AuditorErrorCodeSchema>;

export const AuditorErrorSchema = z.object({
    code: AuditorErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.unknown()).optional(),
    stack: z.string().optional()
});

export type AuditorError = z.infer<typeof AuditorErrorSchema>;

// ============================================================================
// Verify Result
// ============================================================================

export const VerifyStatusSchema = z.enum(['pass', 'fail']);
export type VerifyStatus = z.infer<typeof VerifyStatusSchema>;

export const VerifyResultSchema = z.object({
    status: VerifyStatusSchema,
    violations: z.array(ViolationSchema).optional(),
    score: z.number().min(0).max(100).optional()
});

export type VerifyResult = z.infer<typeof VerifyResultSchema>;

// ============================================================================
// Verify Options
// ============================================================================

export const VerifyOptionsSchema = z.object({
    selector: z.string().min(1),
    ruleId: z.string().min(1)
});

export type VerifyOptions = z.infer<typeof VerifyOptionsSchema>;

// ============================================================================
// Element Summary (for Structure Analyzer)
// ============================================================================

export const ElementSummarySchema = z.object({
    selector: z.string(),
    tagName: z.string(),
    role: z.string().optional(),
    text: z.string().optional()
});

export type ElementSummary = z.infer<typeof ElementSummarySchema>;

// ============================================================================
// Page Structure (for Structure Analyzer)
// ============================================================================

export const PageStructureSchema = z.object({
    interactiveElements: z.array(ElementSummarySchema),
    landmarks: z.array(ElementSummarySchema),
    headings: z.array(ElementSummarySchema)
});

export type PageStructure = z.infer<typeof PageStructureSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates a ScanResult object at runtime
 * @throws ZodError if validation fails
 */
export function validateScanResult(data: unknown): ScanResult {
    return ScanResultSchema.parse(data);
}

/**
 * Safely validates a ScanResult object, returning a result object
 */
export function safeParseScanResult(data: unknown): z.SafeParseReturnType<unknown, ScanResult> {
    return ScanResultSchema.safeParse(data);
}

/**
 * Validates an AuditorError object at runtime
 * @throws ZodError if validation fails
 */
export function validateAuditorError(data: unknown): AuditorError {
    return AuditorErrorSchema.parse(data);
}

/**
 * Safely validates an AuditorError object, returning a result object
 */
export function safeParseAuditorError(data: unknown): z.SafeParseReturnType<unknown, AuditorError> {
    return AuditorErrorSchema.safeParse(data);
}

// ============================================================================
// Serialization Utilities
// ============================================================================

/**
 * Serializes a ScanResult to JSON string
 */
export function serializeScanResult(scanResult: ScanResult): string {
    return JSON.stringify(scanResult);
}

/**
 * Deserializes a JSON string to ScanResult
 * @throws ZodError if validation fails
 */
export function deserializeScanResult(json: string): ScanResult {
    const parsed = JSON.parse(json) as unknown;
    return validateScanResult(parsed);
}

/**
 * Safely deserializes a JSON string to ScanResult
 */
export function safeDeserializeScanResult(json: string): z.SafeParseReturnType<unknown, ScanResult> {
    try {
        const parsed = JSON.parse(json) as unknown;
        return safeParseScanResult(parsed);
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
