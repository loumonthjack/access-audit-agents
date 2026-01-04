/**
 * Zod schemas for runtime validation
 * Requirements: 1.1, 2.1
 */
import { z } from 'zod';

// ============================================================================
// Enum Schemas
// ============================================================================

export const SessionStatusSchema = z.enum([
  'pending',
  'scanning',
  'remediating',
  'complete',
  'error',
]);

export const ImpactLevelSchema = z.enum(['critical', 'serious', 'moderate', 'minor']);

export const ViolationStatusSchema = z.enum(['pending', 'processing', 'fixed', 'skipped']);

export const ViolationFilterSchema = z.enum(['all', 'pending', 'fixed', 'skipped']);

export const ViewportSchema = z.enum(['mobile', 'desktop']);

export const FixTypeSchema = z.enum(['attribute', 'content', 'style']);

export const AuthProviderTypeSchema = z.enum(['cognito', 'google', 'github', 'local']);

// ============================================================================
// Domain Model Schemas
// ============================================================================

export const ViolationCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  critical: z.number().int().nonnegative(),
  serious: z.number().int().nonnegative(),
  moderate: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
});

export const FixCountsSchema = z.object({
  fixed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
});

export const AppliedFixSchema = z.object({
  violationId: z.string().min(1),
  fixType: FixTypeSchema,
  beforeHtml: z.string(),
  afterHtml: z.string(),
  reasoning: z.string().min(1),
  appliedAt: z.string().datetime(),
});

export const ViolationSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  impact: ImpactLevelSchema,
  description: z.string().min(1),
  help: z.string().min(1),
  helpUrl: z.string().url(),
  selector: z.string().min(1),
  html: z.string(),
  status: ViolationStatusSchema,
  fix: AppliedFixSchema.optional(),
  skipReason: z.string().optional(),
});

export const ScanSessionSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  viewport: ViewportSchema,
  status: SessionStatusSchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  violationCounts: ViolationCountsSchema,
  fixCounts: FixCountsSchema,
});

export const SkippedViolationSchema = z.object({
  violationId: z.string().min(1),
  ruleId: z.string().min(1),
  selector: z.string().min(1),
  reason: z.string().min(1),
  attempts: z.number().int().nonnegative(),
});

export const HumanReviewItemSchema = z.object({
  violationId: z.string().min(1),
  ruleId: z.string().min(1),
  selector: z.string().min(1),
  reason: z.string().min(1),
  suggestedAction: z.string().min(1),
});

export const ReportSummarySchema = z.object({
  totalViolations: z.number().int().nonnegative(),
  fixedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  humanReviewCount: z.number().int().nonnegative(),
});

export const RemediationReportSchema = z.object({
  sessionId: z.string().min(1),
  url: z.string().url(),
  viewport: ViewportSchema,
  timestamp: z.string().datetime(),
  duration: z.number().nonnegative(),
  summary: ReportSummarySchema,
  fixes: z.array(AppliedFixSchema),
  skipped: z.array(SkippedViolationSchema),
  humanReview: z.array(HumanReviewItemSchema),
});

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  authProvider: AuthProviderTypeSchema,
});

// ============================================================================
// WebSocket Event Schemas
// Requirements: 2.1
// ============================================================================

export const SessionStartedEventSchema = z.object({
  type: z.literal('session_started'),
  session: ScanSessionSchema,
});

export const ViolationDetectedEventSchema = z.object({
  type: z.literal('violation_detected'),
  violation: ViolationSchema,
});

export const FixStartedEventSchema = z.object({
  type: z.literal('fix_started'),
  violationId: z.string().min(1),
});

export const FixAppliedEventSchema = z.object({
  type: z.literal('fix_applied'),
  violationId: z.string().min(1),
  fix: AppliedFixSchema,
});

export const FixSkippedEventSchema = z.object({
  type: z.literal('fix_skipped'),
  violationId: z.string().min(1),
  reason: z.string().min(1),
});

export const SessionCompleteEventSchema = z.object({
  type: z.literal('session_complete'),
  report: RemediationReportSchema,
});

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string().min(1),
  recoverable: z.boolean(),
});

export const ProgressEventSchema = z.discriminatedUnion('type', [
  SessionStartedEventSchema,
  ViolationDetectedEventSchema,
  FixStartedEventSchema,
  FixAppliedEventSchema,
  FixSkippedEventSchema,
  SessionCompleteEventSchema,
  ErrorEventSchema,
]);

// ============================================================================
// Form Input Schemas
// Requirements: 1.1
// ============================================================================

/**
 * Schema for URL validation in scan form
 * Requirements: 1.1
 */
export const ScanFormSchema = z.object({
  url: z
    .string()
    .min(1, 'URL is required')
    .url('Please enter a valid URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL must start with http:// or https://'
    ),
  viewport: ViewportSchema,
});

/**
 * Schema for login credentials
 * Requirements: 7.2
 */
export const CredentialsSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

// ============================================================================
// API Response Schemas
// Requirements: 6.5, 10.1
// ============================================================================

/**
 * Schema for pagination metadata
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

/**
 * Generic paginated response schema factory
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}

/**
 * Schema for API error responses
 */
export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});

/**
 * Generic API response schema factory
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
  });
}

// ============================================================================
// Pre-built Response Schemas
// ============================================================================

export const PaginatedSessionsResponseSchema = createPaginatedResponseSchema(ScanSessionSchema);
export const SessionResponseSchema = createApiResponseSchema(ScanSessionSchema);
export const ReportResponseSchema = createApiResponseSchema(RemediationReportSchema);
export const ViolationsResponseSchema = createApiResponseSchema(z.array(ViolationSchema));

// ============================================================================
// Type Inference Helpers
// ============================================================================

export type ScanFormInput = z.infer<typeof ScanFormSchema>;
export type CredentialsInput = z.infer<typeof CredentialsSchema>;
export type PaginatedSessionsResponse = z.infer<typeof PaginatedSessionsResponseSchema>;
