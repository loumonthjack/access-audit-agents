/**
 * Domain models for the Web Dashboard
 * Requirements: 2.1, 5.1, 7.1
 */

// ============================================================================
// Enums and Type Aliases
// ============================================================================

/**
 * Status of a scan session throughout its lifecycle
 */
export type SessionStatus = 'pending' | 'scanning' | 'remediating' | 'complete' | 'error';

/**
 * Impact level of accessibility violations (WCAG severity)
 */
export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Status of an individual violation during remediation
 */
export type ViolationStatus = 'pending' | 'processing' | 'fixed' | 'skipped';

/**
 * Filter options for the violation list UI
 */
export type ViolationFilter = 'all' | 'pending' | 'fixed' | 'skipped';

/**
 * Viewport mode for scanning
 */
export type Viewport = 'mobile' | 'desktop';

/**
 * Type of fix applied to a violation
 */
export type FixType = 'attribute' | 'content' | 'style';

/**
 * Authentication provider types
 */
export type AuthProviderType = 'cognito' | 'google' | 'github' | 'local';

// ============================================================================
// Core Domain Interfaces
// ============================================================================

/**
 * Counts of violations by impact level
 */
export interface ViolationCounts {
  total: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

/**
 * Counts of fixes by status
 */
export interface FixCounts {
  fixed: number;
  skipped: number;
  pending: number;
}

/**
 * A single remediation workflow from URL input to completion report
 * Requirements: 2.1
 */
export interface ScanSession {
  id: string;
  url: string;
  viewport: Viewport;
  status: SessionStatus;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  violationCounts: ViolationCounts;
  fixCounts: FixCounts;
}

/**
 * An accessibility violation detected during scanning
 * Requirements: 2.1, 3.2
 */
export interface Violation {
  id: string;
  ruleId: string;
  impact: ImpactLevel;
  description: string;
  help: string;
  helpUrl: string;
  selector: string;
  html: string;
  status: ViolationStatus;
  fix?: AppliedFix;
  skipReason?: string;
}

/**
 * A fix applied to resolve an accessibility violation
 * Requirements: 4.1, 4.4
 */
export interface AppliedFix {
  violationId: string;
  ruleId: string;
  impact: ImpactLevel;
  description: string;
  selector: string;
  fixType: FixType;
  beforeHtml: string;
  afterHtml: string;
  reasoning: string;
  appliedAt: string;
}

/**
 * Summary statistics for a remediation report
 */
export interface ReportSummary {
  totalViolations: number;
  fixedCount: number;
  skippedCount: number;
  humanReviewCount: number;
}

/**
 * A violation in the report with its details
 * Requirements: 5.1
 */
export interface ReportViolation {
  id: string;
  ruleId: string;
  impact: ImpactLevel;
  description: string;
  selector: string;
  html: string;
  status: ViolationStatus;
  skipReason?: string;
  screenshot?: string;
  fix?: {
    type: FixType;
    beforeHtml: string;
    afterHtml: string;
    reasoning: string;
  };
}

/**
 * Complete remediation report generated after session completion
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export interface RemediationReport {
  sessionId: string;
  url: string;
  viewport: Viewport;
  timestamp: string;
  duration: number; // milliseconds
  pageScreenshot?: string;
  summary: ReportSummary;
  violations: ReportViolation[];
  fixes: AppliedFix[];
  skipped: SkippedViolation[];
  humanReview: HumanReviewItem[];
}

/**
 * A violation that was skipped during remediation
 * Requirements: 5.4
 */
export interface SkippedViolation {
  violationId: string;
  ruleId: string;
  impact: ImpactLevel;
  description: string;
  selector: string;
  html: string;
  reason: string;
  attempts: number;
}

/**
 * A violation flagged for human review
 * Requirements: 5.2
 */
export interface HumanReviewItem {
  violationId: string;
  ruleId: string;
  selector: string;
  reason: string;
  suggestedAction: string;
}

/**
 * Authenticated user information
 * Requirements: 7.1, 7.4
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  authProvider: AuthProviderType;
}

/**
 * User credentials for email/password authentication
 * Requirements: 7.2
 */
export interface Credentials {
  email: string;
  password: string;
}

// ============================================================================
// Batch Scanning Types
// Requirements: 6.1, 8.1, 9.1, 10.1
// ============================================================================

/**
 * Status of a batch scan session
 */
export type BatchStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

/**
 * Status of an individual page within a batch scan
 */
export type BatchPageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * A batch scan session that processes multiple URLs from a sitemap
 * Requirements: 8.1
 */
export interface BatchSession {
  id: string;
  name?: string;
  status: BatchStatus;
  viewport: Viewport;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  totalViolations: number;
  sitemapUrl?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  pausedAt?: string;
}

/**
 * An individual page within a batch scan session
 * Requirements: 8.1
 */
export interface BatchPage {
  id: string;
  batchId: string;
  url: string;
  status: BatchPageStatus;
  scanSessionId?: string;
  violationCount: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Progress information for a running batch scan
 * Requirements: 9.1
 */
export interface BatchProgress {
  completedPages: number;
  totalPages: number;
  failedPages: number;
  totalViolations: number;
  estimatedTimeRemaining: number; // seconds
}

/**
 * Summary of a completed batch scan
 * Requirements: 9.2, 10.2
 */
export interface BatchSummary {
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  totalViolations: number;
  violationsByImpact: Record<ImpactLevel, number>;
  violationsByRule: Record<string, number>;
  mostCommonViolations: BatchViolationSummary[];
}

/**
 * Summary of a violation type across a batch scan
 * Requirements: 10.4
 */
export interface BatchViolationSummary {
  ruleId: string;
  description: string;
  count: number;
  impact: ImpactLevel;
  affectedPages: number;
}

/**
 * Complete batch scan report
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export interface BatchReport {
  batchId: string;
  name?: string;
  sitemapUrl?: string;
  viewport: Viewport;
  createdAt: string;
  completedAt: string;
  duration: number;
  summary: {
    totalPages: number;
    successfulPages: number;
    failedPages: number;
    totalViolations: number;
  };
  violationsByImpact: Record<ImpactLevel, number>;
  violationsByRule: Array<{
    ruleId: string;
    description: string;
    count: number;
    impact: ImpactLevel;
  }>;
  pages: Array<{
    url: string;
    status: BatchPageStatus;
    violationCount: number;
    scanSessionId?: string;
    errorMessage?: string;
  }>;
  recommendations: Array<BatchRecommendation>;
}

/**
 * A prioritized recommendation from a batch scan
 * Requirements: 10.6
 */
export interface BatchRecommendation {
  priority: number;
  ruleId: string;
  description: string;
  affectedPages: number;
  suggestedAction: string;
}

/**
 * URL parsed from a sitemap
 * Requirements: 6.4, 7.3
 */
export interface ParsedUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}
