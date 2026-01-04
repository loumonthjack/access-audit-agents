# Sitemap Scanning Feature Specification

## Overview

Sitemap scanning enables users to scan an entire website for accessibility issues by providing a sitemap URL. Instead of scanning individual pages one at a time, users can discover all pages from a sitemap and run a batch accessibility audit across the entire site.

This feature is ideal for:
- Initial accessibility audits of existing websites
- Continuous monitoring of site-wide accessibility
- Pre-launch accessibility reviews
- Compliance reporting across multiple pages

## User Workflow

### Step 1: Enter Sitemap URL

1. Navigate to the Batch Scan page from the dashboard
2. Enter your sitemap URL (e.g., `https://example.com/sitemap.xml`)
3. Optionally set a maximum number of URLs to scan
4. Click "Parse Sitemap"

The system validates that the URL:
- Is a valid URL format
- Ends with `.xml` or contains `/sitemap`
- Is accessible and returns valid XML

### Step 2: Review Discovered URLs

After parsing, you'll see:
- Total number of URLs discovered
- List of all URLs with metadata (last modified date, priority)
- Option to select/deselect individual URLs
- Search and filter functionality for large sitemaps

You can:
- Select all or deselect all URLs
- Search for specific pages
- Filter by URL pattern
- Remove URLs you don't want to scan

### Step 3: Configure and Start Batch Scan

1. Choose viewport (desktop or mobile)
2. Optionally name your batch scan
3. Review estimated scan time
4. Click "Start Batch Scan"

### Step 4: Monitor Progress

During the scan, you'll see:
- Overall progress bar (X of Y pages completed)
- Current page being scanned
- Running count of violations found
- Estimated time remaining
- Real-time updates via WebSocket

You can:
- **Pause** the scan to temporarily stop processing
- **Resume** a paused scan to continue from where it left off
- **Cancel** the scan to stop completely (partial results are preserved)

### Step 5: Review Results

When the scan completes, you'll see:
- Summary statistics (total pages, violations by severity)
- Most common violations across the site
- Per-page breakdown with violation counts
- Prioritized recommendations for fixing issues

### Step 6: Export Report

Export your results in multiple formats:
- **JSON**: Machine-readable format for integration with other tools
- **HTML**: Styled report for sharing with stakeholders

## Features

### Sitemap Support

The system supports:
- **Standard sitemaps**: XML files following the sitemaps.org protocol
- **Sitemap indexes**: Files that reference multiple child sitemaps
- **Recursive parsing**: Automatically fetches and parses nested sitemaps

### Batch Processing

- **Sequential processing**: Pages are scanned one at a time to avoid overwhelming target servers
- **Automatic retries**: Failed pages are retried up to 2 times before being marked as failed
- **Resilient processing**: Individual page failures don't stop the entire batch
- **Pause/Resume**: Stop and continue scans at any time

### Real-Time Updates

- WebSocket-based progress updates
- Live violation counts
- Immediate notification when pages complete or fail

### Comprehensive Reporting

- Site-wide violation statistics
- Violations grouped by impact level (critical, serious, moderate, minor)
- Violations grouped by rule type
- Per-page breakdown
- Prioritized recommendations based on impact and frequency

## Limitations

### URL Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Maximum URLs per batch | 50,000 | Sitemap protocol limit |
| Default URL limit | 1,000 | Can be increased in request |
| Sitemap file size | 50 MB | Maximum XML file size |
| Recursion depth | 2 levels | For sitemap indexes |

### Processing Constraints

| Constraint | Value | Notes |
|------------|-------|-------|
| Concurrent scans | 1 page at a time | Sequential to respect target servers |
| Delay between pages | 2 seconds | Prevents rate limiting |
| Page timeout | 2 minutes | Per-page scan timeout |
| Retry attempts | 2 | Before marking page as failed |
| Sitemap fetch timeout | 30 seconds | For fetching sitemap XML |

### Domain Restrictions

- All URLs must belong to the same domain as the sitemap
- Subdomains are allowed (e.g., `blog.example.com` from `example.com/sitemap.xml`)
- External URLs are automatically filtered out

## Best Practices

### Preparing Your Sitemap

1. **Keep it current**: Ensure your sitemap reflects your actual site structure
2. **Include all important pages**: Don't exclude pages that need accessibility testing
3. **Use standard format**: Follow the sitemaps.org protocol
4. **Set priorities**: Higher priority pages will be listed first in results

### Optimizing Batch Scans

1. **Start small**: Test with a subset of URLs before scanning the entire site
2. **Use filters**: Exclude pages that don't need scanning (e.g., admin pages)
3. **Schedule wisely**: Run large scans during off-peak hours
4. **Monitor progress**: Watch for patterns in failures that might indicate issues

### Interpreting Results

1. **Focus on critical issues first**: Address critical and serious violations before moderate/minor
2. **Look for patterns**: Common violations across many pages indicate systemic issues
3. **Use recommendations**: Follow the prioritized recommendations for maximum impact
4. **Track progress**: Run periodic scans to measure improvement

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Sitemap not found" | Invalid URL or 404 | Verify sitemap URL is correct and accessible |
| "No URLs found" | Empty or invalid XML | Check sitemap format follows sitemaps.org protocol |
| Many page failures | Rate limiting or server issues | Reduce batch size or scan during off-peak hours |
| Slow scanning | Large pages or slow server | Consider scanning fewer pages or using mobile viewport |
| Domain mismatch errors | URLs from different domains | Ensure all sitemap URLs match the sitemap's domain |

## API Integration

For programmatic access to sitemap scanning, see the [API Reference](../../engineering/development/api_reference.md#batch-scanning-api).

### Quick Start

```bash
# 1. Parse sitemap
curl -X POST http://localhost:3003/api/sitemaps/parse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sitemapUrl": "https://example.com/sitemap.xml"}'

# 2. Create batch scan with discovered URLs
curl -X POST http://localhost:3003/api/batch-scans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["..."], "viewport": "desktop"}'

# 3. Monitor progress via WebSocket or polling
curl http://localhost:3003/api/batch-scans/{batchId} \
  -H "Authorization: Bearer $TOKEN"

# 4. Get report when complete
curl http://localhost:3003/api/batch-scans/{batchId}/report \
  -H "Authorization: Bearer $TOKEN"
```

## Related Documentation

- [Single Page Scanning](./single_page_scanning.md)
- [Report Generation](./report_generation.md)
- [API Reference - Batch Scanning](../../engineering/development/api_reference.md#batch-scanning-api)
- [Getting Started Guide](../../support/getting_started.md)
