# Common Errors

This guide covers common errors you may encounter while using AccessAgents and how to resolve them.

## Authentication Errors

### Error: "Invalid credentials"

**Cause**: The email or password entered is incorrect.

**Solution**:
1. Verify your email address is correct
2. Check for typos in your password
3. Ensure Caps Lock is not enabled
4. Try resetting your password if you've forgotten it

### Error: "Session expired"

**Cause**: Your login session has timed out due to inactivity.

**Solution**:
1. Click "Sign In" to log in again
2. Your work in progress may be lost; check scan history for completed scans

**Prevention**: Stay active in the application or save your work regularly.

### Error: "Account not found"

**Cause**: No account exists with the provided email address.

**Solution**:
1. Verify you're using the correct email
2. Check if you registered with a different email
3. Contact your administrator to create an account

### Error: "Account locked"

**Cause**: Too many failed login attempts.

**Solution**:
1. Wait 15-30 minutes before trying again
2. Use the password reset feature
3. Contact your administrator if the issue persists

## URL Validation Errors

### Error: "Invalid URL format"

**Cause**: The URL entered doesn't follow the correct format.

**Solution**:
1. Include the protocol (`https://` or `http://`)
2. Ensure no spaces in the URL
3. Check for special characters that need encoding

**Examples**:
- ❌ `example.com/page`
- ❌ `www.example.com`
- ✅ `https://example.com/page`
- ✅ `http://www.example.com`

### Error: "URL must use HTTP or HTTPS"

**Cause**: The URL uses an unsupported protocol.

**Solution**: Use `http://` or `https://` URLs only. File paths, FTP, and other protocols are not supported.

### Error: "URL is not accessible"

**Cause**: The page cannot be reached from the internet.

**Solution**:
1. Verify the URL is correct
2. Check if the page requires authentication
3. Ensure the page is publicly accessible
4. Test the URL in your browser first

## Scan Errors

### Error: "Scan failed to start"

**Cause**: The scan couldn't be initiated.

**Possible causes and solutions**:

| Cause | Solution |
|-------|----------|
| Server overload | Wait a few minutes and try again |
| Invalid URL | Check URL format and accessibility |
| Network issues | Check your internet connection |
| Service outage | Check status page or try later |

### Error: "Page load timeout"

**Cause**: The page took too long to load (>30 seconds).

**Solution**:
1. Check if the page loads slowly in your browser
2. Try scanning during off-peak hours
3. Contact the site owner about performance issues
4. Try scanning a simpler page first

### Error: "Page not found (404)"

**Cause**: The URL returns a 404 error.

**Solution**:
1. Verify the URL is correct
2. Check if the page has been moved or deleted
3. Try the page's homepage or a different URL

### Error: "Access denied (403)"

**Cause**: The server is blocking access to the page.

**Solution**:
1. The page may require authentication
2. The server may be blocking automated access
3. Check if robots.txt blocks the page
4. Contact the site owner for access

### Error: "Server error (500)"

**Cause**: The target website is experiencing server issues.

**Solution**:
1. Wait and try again later
2. Check if the site is working in your browser
3. Contact the site owner if the issue persists

### Error: "Scan interrupted"

**Cause**: The scan was interrupted before completion.

**Possible causes**:
- Network disconnection
- Server restart
- Manual cancellation

**Solution**:
1. Check your internet connection
2. Start a new scan
3. Check scan history for partial results

## Report Errors

### Error: "Report not found"

**Cause**: The requested report doesn't exist or has been deleted.

**Solution**:
1. Check your scan history for the correct session
2. The report may have been deleted
3. Run a new scan if needed

### Error: "Export failed"

**Cause**: The report couldn't be exported.

**Solution**:
1. Try a different export format (JSON vs HTML)
2. Check your browser's download settings
3. Ensure you have disk space available
4. Try refreshing the page and exporting again

### Error: "Report generation failed"

**Cause**: The system couldn't generate the report.

**Solution**:
1. Wait a moment and refresh the page
2. Check if the scan completed successfully
3. Try viewing the report again
4. Contact support if the issue persists

## WebSocket Errors

### Error: "Connection lost"

**Cause**: The real-time connection to the server was interrupted.

**Solution**:
1. Check your internet connection
2. The page will attempt to reconnect automatically
3. Refresh the page if reconnection fails
4. Your scan continues on the server even if disconnected

### Error: "Failed to connect"

**Cause**: Unable to establish a WebSocket connection.

**Solution**:
1. Check your internet connection
2. Verify your firewall allows WebSocket connections
3. Try a different browser
4. Disable browser extensions that might block connections

## Database Errors

### Error: "Failed to save scan"

**Cause**: The scan results couldn't be saved to the database.

**Solution**:
1. Try the scan again
2. Check if you've exceeded storage limits
3. Contact support if the issue persists

### Error: "Failed to load history"

**Cause**: Your scan history couldn't be retrieved.

**Solution**:
1. Refresh the page
2. Check your internet connection
3. Try logging out and back in
4. Contact support if the issue persists

## Browser-Related Errors

### Error: "Browser not supported"

**Cause**: You're using an unsupported or outdated browser.

**Solution**: Use a modern browser:
- Chrome (recommended)
- Firefox
- Safari
- Edge

### Error: "JavaScript required"

**Cause**: JavaScript is disabled in your browser.

**Solution**:
1. Enable JavaScript in your browser settings
2. Disable extensions that block JavaScript
3. Try a different browser

### Error: "Cookies required"

**Cause**: Cookies are disabled or blocked.

**Solution**:
1. Enable cookies in your browser settings
2. Add AccessAgents to your cookie allowlist
3. Disable extensions that block cookies

## Error Codes Reference

| Code | Description | Action |
|------|-------------|--------|
| `AUTH_001` | Invalid credentials | Check email/password |
| `AUTH_002` | Session expired | Log in again |
| `AUTH_003` | Account locked | Wait or reset password |
| `SCAN_001` | Invalid URL | Check URL format |
| `SCAN_002` | Page unreachable | Verify URL accessibility |
| `SCAN_003` | Page timeout | Check page performance |
| `SCAN_004` | Scan failed | Retry or contact support |
| `SCAN_005` | Scan interrupted | Check connection, retry |
| `REPORT_001` | Report not found | Check scan history |
| `REPORT_002` | Export failed | Try different format |
| `WS_001` | Connection lost | Check internet, refresh |
| `WS_002` | Connection failed | Check firewall, try again |
| `DB_001` | Save failed | Retry scan |
| `DB_002` | Load failed | Refresh page |

## Getting More Help

If you can't resolve an error:

1. Note the error message and code
2. Check the [Connection Issues](./connection_issues.md) guide
3. Check the [Scan Failures](./scan_failures.md) guide
4. Contact support with:
   - Error message/code
   - Steps to reproduce
   - Browser and OS information
   - Time the error occurred
