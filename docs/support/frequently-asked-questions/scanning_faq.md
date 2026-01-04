# Scanning FAQ

Frequently asked questions about scanning pages with AccessAgents.

## Starting Scans

### What URLs can I scan?

You can scan any publicly accessible URL. The page must be:
- Reachable from the internet (not localhost or internal networks)
- Using HTTP or HTTPS protocol
- Not blocked by robots.txt or authentication

### Can I scan localhost or internal URLs?

No, AccessAgents requires publicly accessible URLs. For local development:
- Deploy to a staging environment
- Use a tunneling service (ngrok, localtunnel) to expose your local server
- Self-hosted deployments can be configured for VPC access (advanced)

### What's the difference between desktop and mobile viewport?

| Viewport | Resolution | Use Case |
|----------|------------|----------|
| Desktop | 1920x1080 | Desktop-first sites, admin panels |
| Mobile | 375x667 | Mobile-responsive sites, mobile-first designs |

Some accessibility issues only appear at certain viewport sizes, so scanning both is recommended.

### How long does a scan take?

Typical scan times:
- Simple pages: 1-2 minutes
- Average pages: 2-4 minutes
- Complex pages: 4-8 minutes

Factors affecting scan time:
- Page load time
- Number of elements
- Number of violations found
- Complexity of fixes needed

### Can I scan multiple pages at once?

Yes! AccessAgents supports sitemap scanning (batch scanning) for scanning multiple URLs at once.

**How to use batch scanning:**
1. Navigate to the Batch Scan page
2. Enter your sitemap URL (e.g., `https://example.com/sitemap.xml`)
3. Review and select the URLs you want to scan
4. Start the batch scan

**Batch scanning features:**
- Scan up to 50,000 URLs from a sitemap
- Pause, resume, or cancel scans at any time
- Real-time progress updates
- Comprehensive site-wide reports
- Export results in JSON or HTML format

See the [Sitemap Scanning Feature Specification](../../product/feature-specifications/sitemap_scanning.md) for details.

### Why did my scan fail to start?

Common reasons:
- Invalid URL format (missing protocol)
- Page not publicly accessible
- Page takes too long to load (>30 seconds)
- Network connectivity issues

See [Scan Failures Troubleshooting](../troubleshooting-guides/scan_failures.md) for detailed solutions.

## During Scans

### What does each scan phase mean?

| Phase | Description |
|-------|-------------|
| **Initializing** | Setting up the browser and loading the page |
| **Auditing** | Running axe-core accessibility tests |
| **Analyzing** | AI reviewing violations and planning fixes |
| **Remediating** | Applying fixes to detected violations |
| **Verifying** | Confirming fixes resolved the issues |
| **Completing** | Generating the final report |

### Can I cancel a scan in progress?

Yes, click the **Cancel** button during the scan. Partial results may be available depending on how far the scan progressed.

### Why is my scan taking so long?

Long scan times can be caused by:
- Slow page load times
- Large number of violations
- Complex fixes requiring multiple attempts
- Network latency

If scans consistently take too long, check your page's performance.

### What happens if my connection drops during a scan?

The scan continues on the server. When you reconnect:
- If the scan is still running, you'll see live progress
- If the scan completed, you'll see the results
- Check your scan history if you're unsure of the status

## Scan Results

### What do the impact levels mean?

| Impact | Description | Priority |
|--------|-------------|----------|
| **Critical** | Completely blocks access for some users | Fix immediately |
| **Serious** | Significantly degrades the experience | Fix soon |
| **Moderate** | Creates difficulty but doesn't block access | Plan to fix |
| **Minor** | Minor inconvenience | Fix when possible |

### Why are some violations marked as "skipped"?

Violations are skipped when:
- The fix requires human judgment (content decisions)
- The element is too complex for automated fixing
- The fix might break functionality
- Multiple conflicting fixes are possible

Skipped violations should be reviewed and fixed manually.

### What does "needs review" mean?

"Needs review" indicates the AI applied a fix but recommends human verification because:
- The fix involved content generation (like alt text)
- The change might affect visual design
- The element has complex interactions

### Can I see what changes were made?

Yes, each fixed violation shows:
- **Before**: The original HTML
- **After**: The modified HTML
- **Fix Type**: What kind of change was made

### Why do I see different results on different scans?

Results can vary due to:
- Dynamic content on the page
- A/B testing or personalization
- Time-sensitive content
- Random elements or animations

For consistent results, scan static or stable versions of your pages.

## Violation Types

### What are the most common violations?

| Violation | Description | Frequency |
|-----------|-------------|-----------|
| Missing alt text | Images without alternative text | Very common |
| Low contrast | Text doesn't meet contrast requirements | Very common |
| Missing form labels | Form inputs without associated labels | Common |
| Empty links | Links with no accessible text | Common |
| Missing language | Page doesn't declare language | Common |

### What violations can AccessAgents auto-fix?

AccessAgents can automatically fix:
- Missing alt text (generates AI descriptions)
- Missing form labels
- Color contrast issues
- Missing ARIA attributes
- Empty buttons and links
- Missing document language
- Heading structure issues

### What violations require manual fixing?

Some issues need human intervention:
- Complex widget accessibility
- Video captions and transcripts
- Meaningful link text (requires context)
- Logical reading order
- Keyboard trap resolution
- Third-party content issues

### How accurate is the AI-generated alt text?

AI-generated alt text is generally accurate for:
- Photos of objects, people, scenes
- Icons and simple graphics
- Charts with clear labels

It may need review for:
- Complex infographics
- Text in images
- Context-dependent images
- Brand-specific content

Always review AI-generated alt text for accuracy.

## Reports & Export

### What's included in the scan report?

Reports include:
- Summary statistics (total, fixed, skipped)
- Violations grouped by impact level
- Detailed list of each violation
- Before/after HTML for fixes
- Skip reasons for unfixed items
- Recommendations for manual fixes

### What export formats are available?

| Format | Best For |
|--------|----------|
| **JSON** | Integration with other tools, programmatic access |
| **HTML** | Sharing with stakeholders, printing |

### Can I share reports with my team?

Yes:
- Export reports and share the files
- Team members with accounts can view shared scan history
- SaaS Enterprise includes team collaboration features

### How long are scan results stored?

Results are stored indefinitely until you delete them. You can delete individual scans from the History page.

### Can I compare results between scans?

Direct comparison isn't built-in yet, but you can:
- Export reports and compare manually
- Track violation counts over time
- Use the JSON export for programmatic comparison

## Best Practices

### How often should I scan my pages?

Recommended scanning frequency:
- **During development**: After significant changes
- **Before releases**: As part of QA process
- **Production**: Weekly or monthly audits
- **After updates**: When content or code changes

### Should I scan every page on my site?

Prioritize scanning:
1. High-traffic pages (homepage, key landing pages)
2. Critical user flows (checkout, signup, login)
3. Template pages (one of each type)
4. Pages with forms or interactive elements

### What should I do with skipped violations?

1. Review each skipped violation
2. Understand why it was skipped
3. Manually fix issues that need human judgment
4. Document decisions for complex cases
5. Re-scan to verify manual fixes

### How do I track accessibility improvements?

- Keep records of scan results over time
- Track violation counts by category
- Set goals for reducing violations
- Celebrate progress with your team


## Sitemap Scanning FAQ

### What sitemap formats are supported?

AccessAgents supports:
- **Standard sitemaps**: XML files following the sitemaps.org protocol
- **Sitemap indexes**: Files that reference multiple child sitemaps
- **Nested sitemaps**: Automatically fetches and parses up to 2 levels deep

### What are the limits for batch scanning?

| Limit | Value |
|-------|-------|
| Maximum URLs per batch | 50,000 |
| Default URL limit | 1,000 |
| Maximum sitemap file size | 50 MB |
| Sitemap recursion depth | 2 levels |

### How long does a batch scan take?

Batch scan duration depends on:
- Number of URLs (approximately 30 seconds per page)
- Page complexity
- Server response times

**Estimates:**
- 10 pages: ~5 minutes
- 50 pages: ~25 minutes
- 100 pages: ~50 minutes
- 500 pages: ~4 hours

### Can I pause and resume a batch scan?

Yes! During a batch scan you can:
- **Pause**: Stop processing temporarily (current page will complete)
- **Resume**: Continue from where you left off
- **Cancel**: Stop completely (partial results are preserved)

### What happens if some pages fail during a batch scan?

Individual page failures don't stop the entire batch:
- Failed pages are retried up to 2 times
- If still failing, they're marked as "failed" and the batch continues
- You can see which pages failed and why in the report
- Successful pages are included in the final report

### Why are some URLs filtered out from my sitemap?

URLs are filtered if they:
- Don't belong to the same domain as the sitemap
- Are duplicates
- Exceed the maximum URL limit

### Can I select which pages to scan from a sitemap?

Yes! After parsing the sitemap, you can:
- Select/deselect individual URLs
- Use search to find specific pages
- Select all or deselect all
- Filter by URL pattern

### What's included in the batch scan report?

Batch reports include:
- **Summary statistics**: Total pages, violations by severity
- **Most common violations**: Issues appearing across multiple pages
- **Per-page breakdown**: Violations for each scanned page
- **Prioritized recommendations**: What to fix first for maximum impact
- **Export options**: JSON and HTML formats

### How are recommendations prioritized?

Recommendations are prioritized based on:
1. **Impact severity**: Critical > Serious > Moderate > Minor
2. **Affected pages**: Issues on more pages rank higher
3. **Frequency**: More occurrences rank higher

This helps you focus on fixes that will have the biggest impact.
