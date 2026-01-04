# Getting Started with AccessAgents

Welcome to AccessAgents! This guide will help you get up and running with your first accessibility scan in just a few minutes.

## What is AccessAgents?

AccessAgents is an AI-powered accessibility remediation platform that automatically detects and fixes WCAG 2.2 violations in web applications. Instead of manually auditing and fixing accessibility issues, AccessAgents uses intelligent AI agents to scan your pages, identify problems, and apply fixes automatically.

## Prerequisites

Before you begin, you'll need:
- A modern web browser (Chrome, Firefox, Safari, or Edge)
- An AccessAgents account (sign up at your organization's AccessAgents URL)
- A public URL to scan (the page must be accessible from the internet)

## Step 1: Sign In

1. Navigate to your AccessAgents dashboard URL
2. Enter your email address and password
3. Click **Sign In**

If you don't have an account, contact your organization's administrator to request access.

## Step 2: Start Your First Scan

Once signed in, you'll see the main dashboard with a URL input form.

### Enter a URL

1. In the **URL** field, enter the full URL of the page you want to scan
   - Example: `https://example.com/products`
   - Make sure to include `https://` or `http://`

### Select Viewport Mode

Choose how you want the page to be scanned:

| Mode | Description | Best For |
|------|-------------|----------|
| **Desktop** | Scans at 1920x1080 resolution | Desktop-first websites |
| **Mobile** | Scans at 375x667 resolution | Mobile-responsive sites |

### Start the Scan

Click the **Start Scan** button to begin. The scan process includes:

1. **Page Loading**: AccessAgents loads your page in a headless browser
2. **Accessibility Audit**: The axe-core engine scans for WCAG 2.2 violations
3. **AI Analysis**: Violations are analyzed and prioritized
4. **Remediation**: AI agents automatically fix detected issues
5. **Verification**: Fixes are verified to ensure they resolved the violations

## Step 3: Monitor Progress

During the scan, you'll see real-time progress updates:

- **Current Phase**: Shows which step of the process is active
- **Violations Found**: Running count of accessibility issues detected
- **Fixes Applied**: Number of violations successfully remediated
- **Status Messages**: Detailed updates about what's happening

The scan typically takes 1-5 minutes depending on page complexity.

## Step 4: Review Results

When the scan completes, you'll see a comprehensive report with:

### Summary Statistics

- **Total Violations**: Number of accessibility issues found
- **Fixed**: Issues automatically remediated
- **Skipped**: Issues that couldn't be auto-fixed (flagged for manual review)

### Violations by Impact

Issues are categorized by severity:

| Impact | Description |
|--------|-------------|
| **Critical** | Blocks access for users with disabilities |
| **Serious** | Significantly impacts accessibility |
| **Moderate** | Causes some difficulty for users |
| **Minor** | Minor inconvenience |

### Detailed Violation List

Each violation includes:
- **Rule ID**: The axe-core rule that was violated
- **Description**: What the issue is and why it matters
- **Element**: The HTML element with the problem
- **Fix Applied**: What AccessAgents did to fix it (if applicable)
- **Skip Reason**: Why it couldn't be auto-fixed (if applicable)

## Step 5: Export Your Report

You can export your scan results in two formats:

### JSON Export
- Machine-readable format
- Ideal for integration with other tools
- Contains all violation details and metadata

### HTML Export
- Human-readable report
- Shareable with stakeholders
- Includes visual formatting and summaries

Click the **Export** button and select your preferred format.

## Viewing Scan History

Access your previous scans from the **History** page:

1. Click **History** in the navigation
2. Browse your past scan sessions
3. Click any session to view its full report
4. Use filters to find specific scans by date or URL

## Understanding Violation Types

AccessAgents detects violations across several categories:

### Common Issues

| Category | Examples |
|----------|----------|
| **Images** | Missing alt text, decorative images not marked |
| **Forms** | Missing labels, unclear error messages |
| **Navigation** | Keyboard traps, missing skip links |
| **Color** | Insufficient contrast, color-only indicators |
| **Structure** | Missing headings, incorrect heading order |
| **ARIA** | Invalid roles, missing required attributes |

### What Gets Auto-Fixed

AccessAgents can automatically fix many common issues:
- Adding missing alt text (using AI-generated descriptions)
- Adding form labels
- Fixing color contrast
- Adding ARIA attributes
- Correcting heading structure

### What Requires Manual Review

Some issues need human judgment:
- Complex interactive widgets
- Content that requires domain knowledge
- Layout changes that might affect design
- Issues with third-party embedded content

## Tips for Best Results

1. **Scan production URLs**: Test your live site for the most accurate results
2. **Check both viewports**: Run scans in both desktop and mobile modes
3. **Review skipped items**: Manually address issues that couldn't be auto-fixed
4. **Scan regularly**: Catch new issues as your site evolves
5. **Start with high-impact pages**: Focus on your most-visited pages first

---

## Scanning Multiple Pages with Sitemap Scanning

For scanning an entire website at once, use the Sitemap Scanning feature.

### What is Sitemap Scanning?

Sitemap scanning allows you to provide a sitemap URL (like `https://example.com/sitemap.xml`) and automatically scan all pages listed in it. This is ideal for:
- Initial accessibility audits of existing websites
- Comprehensive site-wide compliance checks
- Pre-launch accessibility reviews

### Quick Start: Batch Scan

1. **Navigate to Batch Scan**: Click "Batch Scan" from the dashboard
2. **Enter Sitemap URL**: Provide your sitemap URL (e.g., `https://example.com/sitemap.xml`)
3. **Parse Sitemap**: Click "Parse Sitemap" to discover all URLs
4. **Review URLs**: Select which pages to include in the scan
5. **Start Batch**: Choose viewport and click "Start Batch Scan"
6. **Monitor Progress**: Watch real-time progress as pages are scanned
7. **Review Report**: Get a comprehensive site-wide accessibility report

### Batch Scan Features

| Feature | Description |
|---------|-------------|
| **Pause/Resume** | Stop and continue scans at any time |
| **Real-time Progress** | See live updates as pages complete |
| **Site-wide Report** | Aggregated statistics across all pages |
| **Prioritized Recommendations** | Focus on issues with the biggest impact |
| **Export Options** | Download reports in JSON or HTML format |

### When to Use Batch Scanning

| Scenario | Recommendation |
|----------|----------------|
| Single page check | Use standard single-page scan |
| Full site audit | Use sitemap scanning |
| Specific pages only | Use single-page scan for each |
| Regular monitoring | Schedule periodic batch scans |

For detailed information, see the [Sitemap Scanning Feature Specification](../product/feature-specifications/sitemap_scanning.md).

---

## Next Steps

- Learn about [common accessibility terms](./glossary.md)
- Read the [Scanning FAQ](./frequently-asked-questions/scanning_faq.md) for detailed questions
- Check [Troubleshooting](./troubleshooting-guides/common_errors.md) if you encounter issues

## Getting Help

If you need assistance:
- Check the [FAQ](./frequently-asked-questions/general_faq.md) for common questions
- Review [Troubleshooting Guides](./troubleshooting-guides/common_errors.md) for error resolution
- Contact your organization's administrator for account issues
