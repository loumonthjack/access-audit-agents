/**
 * Batch Report Generator
 *
 * Generates comprehensive accessibility reports for batch scans.
 * Includes violation statistics, per-page breakdown, and prioritized recommendations.
 *
 * Requirements: 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { query } from '../shared/database';
import type {
    BatchSession,
    BatchPage,
    BatchPageStatus,
    BatchReport,
    ImpactLevel,
} from '../shared/types';

// ============================================================================
// Types
// ============================================================================

interface ViolationByRule {
    ruleId: string;
    description: string;
    count: number;
    impact: ImpactLevel;
    affectedPages: number;
}

interface PageViolationDetail {
    url: string;
    status: BatchPageStatus;
    violationCount: number;
    scanSessionId?: string;
    errorMessage?: string;
}

interface Recommendation {
    priority: number;
    ruleId: string;
    description: string;
    affectedPages: number;
    count: number;
    suggestedAction: string;
}

// Impact severity weights for priority calculation
const IMPACT_WEIGHTS: Record<ImpactLevel, number> = {
    critical: 4,
    serious: 3,
    moderate: 2,
    minor: 1,
};

// Suggested actions for common accessibility violations
const SUGGESTED_ACTIONS: Record<string, string> = {
    'color-contrast': 'Increase the contrast ratio between text and background colors to meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text).',
    'image-alt': 'Add descriptive alt text to all images that convey information. Use empty alt="" for decorative images.',
    'link-name': 'Ensure all links have accessible names through visible text, aria-label, or aria-labelledby.',
    'button-name': 'Add accessible names to buttons using visible text, aria-label, or aria-labelledby.',
    'label': 'Associate form inputs with labels using the for/id attributes or by nesting inputs within label elements.',
    'html-has-lang': 'Add a lang attribute to the <html> element specifying the page language (e.g., lang="en").',
    'document-title': 'Add a descriptive <title> element to the page head.',
    'heading-order': 'Ensure headings follow a logical order (h1, h2, h3) without skipping levels.',
    'list': 'Use proper list markup (<ul>, <ol>, <li>) for list content.',
    'listitem': 'Ensure list items (<li>) are contained within list elements (<ul> or <ol>).',
    'region': 'Wrap page content in landmark regions (main, nav, header, footer) for better navigation.',
    'bypass': 'Add a skip link at the top of the page to allow users to bypass repetitive content.',
    'meta-viewport': 'Ensure the viewport meta tag allows user scaling (user-scalable=yes, maximum-scale >= 2).',
    'aria-required-attr': 'Add all required ARIA attributes for the specified role.',
    'aria-valid-attr-value': 'Ensure ARIA attribute values are valid for their attribute type.',
    'aria-roles': 'Use valid ARIA roles that exist in the ARIA specification.',
    'tabindex': 'Avoid using tabindex values greater than 0. Use tabindex="0" or tabindex="-1" only.',
    'focus-visible': 'Ensure interactive elements have visible focus indicators.',
    'landmark-one-main': 'Add exactly one main landmark to the page.',
    'page-has-heading-one': 'Include at least one h1 heading on each page.',
};

// ============================================================================
// Database Queries
// ============================================================================

/**
 * Get batch session details
 */
async function getBatchSession(batchId: string): Promise<BatchSession | null> {
    const result = await query<BatchSession>(
        `SELECT id, user_id as "userId", org_id as "orgId", name, status, viewport,
                total_pages as "totalPages", completed_pages as "completedPages",
                failed_pages as "failedPages", total_violations as "totalViolations",
                sitemap_url as "sitemapUrl", created_at as "createdAt",
                updated_at as "updatedAt", started_at as "startedAt",
                completed_at as "completedAt", paused_at as "pausedAt"
         FROM batch_sessions WHERE id = $1`,
        [batchId]
    );
    return result.rows[0] ?? null;
}

/**
 * Get all pages for a batch
 */
async function getBatchPages(batchId: string): Promise<PageViolationDetail[]> {
    const result = await query<PageViolationDetail>(
        `SELECT url, status, violation_count as "violationCount",
                scan_session_id as "scanSessionId", error_message as "errorMessage"
         FROM batch_pages
         WHERE batch_id = $1
         ORDER BY created_at ASC`,
        [batchId]
    );
    return result.rows;
}

/**
 * Get violations grouped by impact level
 */
async function getViolationsByImpact(batchId: string): Promise<Record<ImpactLevel, number>> {
    const result = await query<{ impact: ImpactLevel; count: number }>(
        `SELECT v.impact, COUNT(*)::int as count
         FROM violations v
         JOIN scan_sessions s ON s.id = v.session_id
         JOIN batch_pages bp ON bp.scan_session_id = s.id
         WHERE bp.batch_id = $1
         GROUP BY v.impact`,
        [batchId]
    );

    const violationsByImpact: Record<ImpactLevel, number> = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
    };

    for (const row of result.rows) {
        violationsByImpact[row.impact] = row.count;
    }

    return violationsByImpact;
}

/**
 * Get violations grouped by rule with details
 * Requirements: 10.3, 10.4
 */
async function getViolationsByRule(batchId: string): Promise<ViolationByRule[]> {
    const result = await query<ViolationByRule>(
        `SELECT v.rule_id as "ruleId", 
                v.description,
                v.impact,
                COUNT(*)::int as count,
                COUNT(DISTINCT bp.id)::int as "affectedPages"
         FROM violations v
         JOIN scan_sessions s ON s.id = v.session_id
         JOIN batch_pages bp ON bp.scan_session_id = s.id
         WHERE bp.batch_id = $1
         GROUP BY v.rule_id, v.description, v.impact
         ORDER BY count DESC`,
        [batchId]
    );

    return result.rows;
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Calculate priority score for a violation rule
 * Higher score = higher priority
 * Requirements: 10.6
 */
function calculatePriority(impact: ImpactLevel, affectedPages: number, count: number): number {
    const impactWeight = IMPACT_WEIGHTS[impact];
    // Priority = impact weight * (affected pages factor + count factor)
    // This prioritizes issues that affect many pages and occur frequently
    return impactWeight * (affectedPages * 10 + count);
}

/**
 * Get suggested action for a rule
 */
function getSuggestedAction(ruleId: string): string {
    return SUGGESTED_ACTIONS[ruleId] ??
        `Review and fix all instances of the "${ruleId}" violation according to WCAG guidelines.`;
}

/**
 * Generate prioritized recommendations
 * Requirements: 10.6
 */
function generateRecommendations(violationsByRule: ViolationByRule[]): Recommendation[] {
    const recommendations: Recommendation[] = violationsByRule.map((violation) => ({
        priority: calculatePriority(violation.impact, violation.affectedPages, violation.count),
        ruleId: violation.ruleId,
        description: violation.description,
        affectedPages: violation.affectedPages,
        count: violation.count,
        suggestedAction: getSuggestedAction(violation.ruleId),
    }));

    // Sort by priority (descending)
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations;
}

/**
 * Generate a complete batch report
 * Requirements: 10.2, 10.3, 10.4, 10.6
 */
export async function generateBatchReport(batchId: string): Promise<BatchReport | null> {
    const batch = await getBatchSession(batchId);
    if (!batch) {
        return null;
    }

    // Get all data in parallel
    const [pages, violationsByImpact, violationsByRule] = await Promise.all([
        getBatchPages(batchId),
        getViolationsByImpact(batchId),
        getViolationsByRule(batchId),
    ]);

    // Calculate duration
    const createdAt = new Date(batch.createdAt);
    const completedAt = batch.completedAt ? new Date(batch.completedAt) : new Date();
    const duration = Math.floor((completedAt.getTime() - createdAt.getTime()) / 1000);

    // Generate recommendations
    const recommendations = generateRecommendations(violationsByRule);

    const report: BatchReport = {
        batchId: batch.id,
        name: batch.name,
        sitemapUrl: batch.sitemapUrl,
        viewport: batch.viewport,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt ?? new Date().toISOString(),
        duration,
        summary: {
            totalPages: batch.totalPages,
            successfulPages: batch.completedPages,
            failedPages: batch.failedPages,
            totalViolations: batch.totalViolations,
        },
        violationsByImpact,
        violationsByRule: violationsByRule.map((v) => ({
            ruleId: v.ruleId,
            description: v.description,
            count: v.count,
            impact: v.impact,
        })),
        pages,
        recommendations,
    };

    return report;
}


// ============================================================================
// Report Export - JSON
// Requirements: 10.5
// ============================================================================

/**
 * Export batch report as JSON string
 */
export function exportReportAsJson(report: BatchReport): string {
    return JSON.stringify(report, null, 2);
}

// ============================================================================
// Report Export - HTML
// Requirements: 10.5
// ============================================================================

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds} seconds`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
        return remainingSeconds > 0
            ? `${minutes} min ${remainingSeconds} sec`
            : `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get CSS class for impact level
 */
function getImpactClass(impact: ImpactLevel): string {
    const classes: Record<ImpactLevel, string> = {
        critical: 'impact-critical',
        serious: 'impact-serious',
        moderate: 'impact-moderate',
        minor: 'impact-minor',
    };
    return classes[impact];
}

/**
 * Get status badge class
 */
function getStatusClass(status: BatchPageStatus): string {
    const classes: Record<BatchPageStatus, string> = {
        completed: 'status-completed',
        failed: 'status-failed',
        pending: 'status-pending',
        running: 'status-running',
        skipped: 'status-skipped',
    };
    return classes[status];
}

/**
 * Export batch report as HTML string
 */
export function exportReportAsHtml(report: BatchReport): string {
    const title = report.name
        ? `Accessibility Report: ${escapeHtml(report.name)}`
        : 'Accessibility Report';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        :root {
            --color-critical: #dc2626;
            --color-serious: #ea580c;
            --color-moderate: #ca8a04;
            --color-minor: #2563eb;
            --color-success: #16a34a;
            --color-failed: #dc2626;
            --color-pending: #6b7280;
            --color-bg: #f9fafb;
            --color-card: #ffffff;
            --color-border: #e5e7eb;
            --color-text: #111827;
            --color-text-secondary: #6b7280;
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: var(--color-bg);
            color: var(--color-text);
            line-height: 1.6;
            padding: 2rem;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        header {
            margin-bottom: 2rem;
        }
        
        h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        
        .meta {
            color: var(--color-text-secondary);
            font-size: 0.875rem;
        }
        
        .card {
            background: var(--color-card);
            border: 1px solid var(--color-border);
            border-radius: 0.5rem;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        
        .card h2 {
            font-size: 1.25rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--color-border);
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
        }
        
        .summary-item {
            text-align: center;
            padding: 1rem;
            background: var(--color-bg);
            border-radius: 0.375rem;
        }
        
        .summary-item .value {
            font-size: 2rem;
            font-weight: 700;
        }
        
        .summary-item .label {
            font-size: 0.875rem;
            color: var(--color-text-secondary);
        }
        
        .impact-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
        }
        
        .impact-item {
            text-align: center;
            padding: 1rem;
            border-radius: 0.375rem;
        }
        
        .impact-critical { background: #fef2f2; color: var(--color-critical); }
        .impact-serious { background: #fff7ed; color: var(--color-serious); }
        .impact-moderate { background: #fefce8; color: var(--color-moderate); }
        .impact-minor { background: #eff6ff; color: var(--color-minor); }
        
        .impact-item .count {
            font-size: 1.5rem;
            font-weight: 700;
        }
        
        .impact-item .label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th, td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid var(--color-border);
        }
        
        th {
            font-weight: 600;
            background: var(--color-bg);
        }
        
        .badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
        }
        
        .status-completed { background: #dcfce7; color: var(--color-success); }
        .status-failed { background: #fef2f2; color: var(--color-failed); }
        .status-pending { background: #f3f4f6; color: var(--color-pending); }
        .status-running { background: #dbeafe; color: #2563eb; }
        .status-skipped { background: #f3f4f6; color: var(--color-pending); }
        
        .recommendation {
            padding: 1rem;
            margin-bottom: 1rem;
            background: var(--color-bg);
            border-radius: 0.375rem;
            border-left: 4px solid;
        }
        
        .recommendation.priority-high { border-color: var(--color-critical); }
        .recommendation.priority-medium { border-color: var(--color-moderate); }
        .recommendation.priority-low { border-color: var(--color-minor); }
        
        .recommendation h3 {
            font-size: 1rem;
            margin-bottom: 0.5rem;
        }
        
        .recommendation .meta {
            margin-bottom: 0.5rem;
        }
        
        .recommendation .action {
            font-size: 0.875rem;
        }
        
        .url {
            word-break: break-all;
            font-family: monospace;
            font-size: 0.875rem;
        }
        
        footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid var(--color-border);
            text-align: center;
            color: var(--color-text-secondary);
            font-size: 0.875rem;
        }
        
        @media print {
            body { padding: 1rem; }
            .card { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${title}</h1>
            <p class="meta">
                Generated: ${new Date(report.completedAt).toLocaleString()} | 
                Duration: ${formatDuration(report.duration)} |
                Viewport: ${report.viewport}
                ${report.sitemapUrl ? ` | Sitemap: ${escapeHtml(report.sitemapUrl)}` : ''}
            </p>
        </header>

        <section class="card">
            <h2>Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="value">${report.summary.totalPages}</div>
                    <div class="label">Total Pages</div>
                </div>
                <div class="summary-item">
                    <div class="value" style="color: var(--color-success)">${report.summary.successfulPages}</div>
                    <div class="label">Successful</div>
                </div>
                <div class="summary-item">
                    <div class="value" style="color: var(--color-failed)">${report.summary.failedPages}</div>
                    <div class="label">Failed</div>
                </div>
                <div class="summary-item">
                    <div class="value" style="color: var(--color-critical)">${report.summary.totalViolations}</div>
                    <div class="label">Total Violations</div>
                </div>
            </div>
        </section>

        <section class="card">
            <h2>Violations by Impact</h2>
            <div class="impact-grid">
                <div class="impact-item impact-critical">
                    <div class="count">${report.violationsByImpact.critical}</div>
                    <div class="label">Critical</div>
                </div>
                <div class="impact-item impact-serious">
                    <div class="count">${report.violationsByImpact.serious}</div>
                    <div class="label">Serious</div>
                </div>
                <div class="impact-item impact-moderate">
                    <div class="count">${report.violationsByImpact.moderate}</div>
                    <div class="label">Moderate</div>
                </div>
                <div class="impact-item impact-minor">
                    <div class="count">${report.violationsByImpact.minor}</div>
                    <div class="label">Minor</div>
                </div>
            </div>
        </section>

        ${report.recommendations.length > 0 ? `
        <section class="card">
            <h2>Top Recommendations</h2>
            ${report.recommendations.slice(0, 10).map((rec, index) => {
        const priorityClass = index < 3 ? 'priority-high' : index < 6 ? 'priority-medium' : 'priority-low';
        return `
                <div class="recommendation ${priorityClass}">
                    <h3>${escapeHtml(rec.ruleId)}</h3>
                    <p class="meta">
                        <span class="badge ${getImpactClass(report.violationsByRule.find(v => v.ruleId === rec.ruleId)?.impact ?? 'minor')}">
                            ${report.violationsByRule.find(v => v.ruleId === rec.ruleId)?.impact ?? 'unknown'}
                        </span>
                        ${rec.count} occurrences across ${rec.affectedPages} pages
                    </p>
                    <p class="action">${escapeHtml(rec.suggestedAction)}</p>
                </div>`;
    }).join('')}
        </section>
        ` : ''}

        ${report.violationsByRule.length > 0 ? `
        <section class="card">
            <h2>Violations by Rule</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rule</th>
                        <th>Impact</th>
                        <th>Count</th>
                        <th>Affected Pages</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.violationsByRule.map(v => `
                    <tr>
                        <td>
                            <strong>${escapeHtml(v.ruleId)}</strong><br>
                            <small>${escapeHtml(v.description)}</small>
                        </td>
                        <td><span class="badge ${getImpactClass(v.impact)}">${v.impact}</span></td>
                        <td>${v.count}</td>
                        <td>${report.recommendations.find(r => r.ruleId === v.ruleId)?.affectedPages ?? '-'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </section>
        ` : ''}

        <section class="card">
            <h2>Pages (${report.pages.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>URL</th>
                        <th>Status</th>
                        <th>Violations</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.pages.map(page => `
                    <tr>
                        <td class="url">${escapeHtml(page.url)}</td>
                        <td><span class="badge ${getStatusClass(page.status)}">${page.status}</span></td>
                        <td>${page.status === 'completed' ? page.violationCount : (page.errorMessage ? escapeHtml(page.errorMessage) : '-')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </section>

        <footer>
            <p>Generated by AccessAgents | Batch ID: ${report.batchId}</p>
        </footer>
    </div>
</body>
</html>`;

    return html;
}
