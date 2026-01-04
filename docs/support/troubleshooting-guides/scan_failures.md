# Scan Failures

This guide helps you troubleshoot issues when accessibility scans fail or produce unexpected results.

## Types of Scan Failures

| Failure Type | Description |
|--------------|-------------|
| **Won't Start** | Scan fails to initiate |
| **Timeout** | Scan takes too long and times out |
| **Partial** | Scan completes but with errors |
| **No Results** | Scan completes but finds nothing |
| **Incorrect Results** | Results don't match expectations |

## Scan Won't Start

### Error: "Invalid URL"

**Cause**: The URL format is incorrect.

**Solutions**:
1. Include the protocol: `https://` or `http://`
2. Remove trailing spaces
3. Encode special characters properly
4. Verify the URL works in your browser

**Valid URL examples**:
```
https://example.com
https://example.com/page
https://example.com/path?query=value
https://subdomain.example.com
```

### Error: "URL not accessible"

**Cause**: The page can't be reached.

**Diagnostic steps**:
1. Open the URL in your browser
2. Check if it requires login
3. Verify it's not an internal/localhost URL
4. Check if the site is down

**Solutions**:
| Issue | Solution |
|-------|----------|
| Page requires login | Use a public page or wait for auth support |
| Internal URL | Deploy to a public staging environment |
| Site is down | Wait for the site to come back up |
| Geo-restricted | Use a page accessible from all regions |

### Error: "Rate limited"

**Cause**: Too many scan requests in a short time.

**Solutions**:
1. Wait a few minutes before trying again
2. Reduce scan frequency
3. Contact support if you need higher limits

## Scan Timeouts

### Error: "Page load timeout"

**Cause**: The page took longer than 30 seconds to load.

**Common causes**:
- Slow server response
- Large page size
- Heavy JavaScript execution
- Slow third-party resources

**Solutions**:
1. Check page performance in your browser
2. Test with browser dev tools Network tab
3. Identify slow-loading resources
4. Contact site owner about performance

### Error: "Scan timeout"

**Cause**: The entire scan process exceeded the time limit.

**Common causes**:
- Very large pages with many elements
- Hundreds of violations to process
- Complex remediation attempts
- Server processing delays

**Solutions**:
1. Try scanning a simpler page first
2. Scan during off-peak hours
3. Break large sites into smaller scans
4. Contact support for large-scale scanning needs

### Error: "Remediation timeout"

**Cause**: Fix attempts took too long.

**Solutions**:
1. The scan may have partial results
2. Check the report for completed fixes
3. Manual fixes may be needed for complex issues

## Partial Scan Failures

### Some pages in a batch fail

**Cause**: Individual pages have issues while others succeed.

**Solutions**:
1. Review failed pages individually
2. Check if failed pages have common issues
3. Verify failed URLs are accessible
4. Retry failed pages separately

### Scan completes with errors

**Cause**: Some operations failed during the scan.

**What to check**:
1. Review the error messages in the report
2. Check which violations couldn't be processed
3. Note any skipped items and reasons

**Solutions**:
1. Address reported errors manually
2. Re-scan after fixing underlying issues
3. Contact support for persistent errors

## No Results Found

### No violations detected

**Possible causes**:
1. **Page is accessible** - Great news! Your page may be compliant
2. **Page didn't load correctly** - Content wasn't rendered
3. **Dynamic content** - Content loaded after scan completed
4. **Wrong viewport** - Issues only appear at different sizes

**Verification steps**:
1. Manually check the page with accessibility tools
2. Verify the page content loaded correctly
3. Try both desktop and mobile viewports
4. Check for JavaScript-dependent content

### Fewer violations than expected

**Possible causes**:
1. Some issues aren't detectable by automated tools
2. Content loaded dynamically after the scan
3. Issues are in iframes or shadow DOM
4. Viewport-specific issues

**Solutions**:
1. Combine automated scanning with manual testing
2. Scan at different viewport sizes
3. Check dynamic content separately

## Incorrect or Unexpected Results

### False positives (issues that aren't real)

**Cause**: Automated tools sometimes flag valid code.

**Common false positives**:
- Custom components with proper ARIA
- Intentionally hidden content
- Valid use of color for decoration

**Solutions**:
1. Review flagged items manually
2. Verify the element's actual accessibility
3. Report false positives to improve the tool

### False negatives (missed issues)

**Cause**: Some issues can't be detected automatically.

**Commonly missed issues**:
- Meaningful vs decorative image decisions
- Logical reading order
- Keyboard trap detection
- Complex widget accessibility
- Content quality (alt text accuracy)

**Solutions**:
1. Supplement with manual testing
2. Use screen readers to verify
3. Conduct user testing with people with disabilities

### Different results on re-scan

**Possible causes**:
1. Dynamic content changed
2. A/B testing showing different versions
3. Time-sensitive content
4. Random elements on the page

**Solutions**:
1. Scan static/stable versions of pages
2. Disable A/B testing for scans
3. Use consistent test environments

## Page-Specific Issues

### Single Page Applications (SPAs)

**Challenges**:
- Content loads dynamically
- Route changes don't trigger page loads
- State-dependent content

**Solutions**:
1. Scan specific routes directly
2. Ensure content is loaded before scanning
3. Test different application states

### Pages with authentication

**Current limitation**: AccessAgents scans public pages only.

**Workarounds**:
1. Create public test versions of pages
2. Use staging environments without auth
3. Wait for authenticated scanning feature

### Pages with CAPTCHAs

**Challenge**: CAPTCHAs block automated access.

**Solutions**:
1. Temporarily disable CAPTCHA for scanning
2. Whitelist the scanning service
3. Use a staging environment without CAPTCHA

### Pages with heavy JavaScript

**Challenges**:
- Long execution time
- Content renders late
- Framework-specific issues

**Solutions**:
1. Ensure JavaScript completes before scan
2. Check for JavaScript errors
3. Test with JavaScript disabled as baseline

## Remediation Failures

### Fix not applied

**Possible causes**:
1. Element changed during remediation
2. Fix would break functionality
3. Complex element structure
4. Conflicting fixes needed

**Solutions**:
1. Review the skip reason
2. Apply fix manually
3. Check if element needs redesign

### Fix applied but violation persists

**Possible causes**:
1. Multiple issues on same element
2. Fix didn't fully resolve the issue
3. Related elements also need fixes

**Solutions**:
1. Review all violations on the element
2. Check for cascading issues
3. Apply additional manual fixes

### Fix broke something

**Possible causes**:
1. Unexpected interaction with other code
2. CSS/JS dependencies
3. Framework-specific behavior

**Solutions**:
1. Review the before/after HTML
2. Identify what broke
3. Apply a custom fix instead
4. Report the issue for tool improvement

## Diagnostic Information

### What to collect for support

When reporting scan failures, include:

1. **URL scanned** (or description if sensitive)
2. **Error message** (exact text or screenshot)
3. **Scan ID** (from the URL or report)
4. **Viewport mode** (desktop/mobile)
5. **Time of scan**
6. **Browser and version**
7. **Steps to reproduce**

### Checking scan status

1. Go to your scan history
2. Find the scan session
3. Check the status:
   - `completed` - Finished successfully
   - `failed` - Encountered an error
   - `timeout` - Exceeded time limit
   - `cancelled` - Manually stopped

### Viewing error details

1. Open the scan report
2. Look for error messages in:
   - Summary section
   - Individual violation entries
   - Skipped items list

## Prevention Tips

1. **Test URLs first** - Verify pages load correctly
2. **Start simple** - Test with basic pages before complex ones
3. **Check performance** - Slow pages cause timeouts
4. **Use stable content** - Avoid scanning during deployments
5. **Monitor results** - Track patterns in failures
6. **Report issues** - Help improve the tool


---

## Batch Scanning (Sitemap) Failures

### Sitemap Parsing Issues

#### Error: "Invalid sitemap URL"

**Cause**: The URL doesn't appear to be a sitemap.

**Solutions**:
1. Ensure URL ends with `.xml` or contains `/sitemap`
2. Verify the URL is accessible
3. Check that it returns valid XML

**Valid sitemap URL examples**:
```
https://example.com/sitemap.xml
https://example.com/sitemap_index.xml
https://example.com/sitemap/pages.xml
```

#### Error: "Sitemap not found"

**Cause**: The sitemap URL returns a 404 error.

**Solutions**:
1. Verify the sitemap exists at the URL
2. Check for typos in the URL
3. Try common sitemap locations:
   - `/sitemap.xml`
   - `/sitemap_index.xml`
   - `/sitemap/sitemap.xml`

#### Error: "No URLs found in sitemap"

**Cause**: The sitemap is empty or doesn't contain valid `<loc>` elements.

**Solutions**:
1. Open the sitemap URL in your browser
2. Verify it contains `<url>` elements with `<loc>` tags
3. Check the XML is properly formatted
4. Ensure it follows the sitemaps.org protocol

#### Error: "Sitemap fetch timed out"

**Cause**: The sitemap took longer than 30 seconds to download.

**Solutions**:
1. Check if the sitemap file is very large
2. Verify the server is responding quickly
3. Try during off-peak hours
4. Consider splitting into smaller sitemaps

#### Error: "Sitemap file is too large"

**Cause**: The sitemap exceeds the 50 MB size limit.

**Solutions**:
1. Use a sitemap index with smaller child sitemaps
2. Remove unnecessary URLs from the sitemap
3. Split into multiple sitemaps

### Batch Processing Issues

#### Many pages failing in a batch

**Possible causes**:
- Target server rate limiting
- Server performance issues
- Network connectivity problems

**Solutions**:
1. Check if the target site is rate limiting requests
2. Run the batch during off-peak hours
3. Reduce the number of URLs in the batch
4. Contact the site administrator about rate limits

#### Batch scan stuck or not progressing

**Possible causes**:
- Current page is taking very long
- Server processing delays
- Network issues

**Solutions**:
1. Wait a few minutes - complex pages take longer
2. Check the current page URL for issues
3. Try pausing and resuming the batch
4. Cancel and restart with fewer URLs

#### Error: "Cannot pause/resume/cancel batch"

**Cause**: The batch is in a state that doesn't allow that operation.

**Valid operations by status**:
| Status | Pause | Resume | Cancel |
|--------|-------|--------|--------|
| pending | ❌ | ❌ | ✅ |
| running | ✅ | ❌ | ✅ |
| paused | ❌ | ✅ | ✅ |
| completed | ❌ | ❌ | ❌ |
| cancelled | ❌ | ❌ | ❌ |

### Batch Report Issues

#### Report shows fewer pages than expected

**Possible causes**:
- Some URLs were filtered (different domain)
- URLs exceeded the maximum limit
- Some pages failed and weren't included

**Solutions**:
1. Check the "failed pages" count in the report
2. Review filtered URLs during sitemap parsing
3. Verify all URLs belong to the same domain

#### Report missing violation details

**Possible causes**:
- Pages failed before violations could be detected
- Scan was cancelled before completion

**Solutions**:
1. Check page status in the report
2. Re-run failed pages individually
3. Complete the batch scan before generating report

### Domain Validation Issues

#### Error: "Skipped external sitemap"

**Cause**: A sitemap index references sitemaps on different domains.

**Solutions**:
1. Ensure all child sitemaps are on the same domain
2. Use only sitemaps from your own domain
3. Subdomains are allowed (e.g., `blog.example.com`)

#### URLs filtered due to domain mismatch

**Cause**: Some URLs in the sitemap don't match the sitemap's domain.

**What's allowed**:
- Same domain: `example.com` → `example.com/page` ✅
- Subdomains: `example.com` → `blog.example.com/page` ✅
- Different domain: `example.com` → `other-site.com/page` ❌

**Solutions**:
1. Review your sitemap for external URLs
2. Remove URLs from other domains
3. Create separate sitemaps for each domain

### Performance Tips for Batch Scanning

1. **Start small**: Test with 10-20 URLs before scanning hundreds
2. **Off-peak hours**: Run large batches when target servers are less busy
3. **Monitor progress**: Watch for patterns in failures
4. **Use filters**: Exclude pages that don't need scanning
5. **Check server logs**: Look for rate limiting or errors on your server
