# Connection Issues

This guide helps you troubleshoot network and connection problems with AccessAgents.

## Symptoms of Connection Issues

You may be experiencing connection issues if you see:
- "Connection lost" or "Reconnecting..." messages
- Scan progress not updating
- Pages failing to load
- Timeout errors
- "Failed to connect" messages

## Quick Checks

Before diving into detailed troubleshooting, try these quick fixes:

1. **Refresh the page** - Often resolves temporary glitches
2. **Check your internet** - Visit another website to confirm connectivity
3. **Try a different browser** - Rules out browser-specific issues
4. **Disable VPN** - VPNs can interfere with WebSocket connections
5. **Wait and retry** - Temporary server issues usually resolve quickly

## Internet Connection Problems

### Symptom: No internet access

**Diagnosis**:
- Can't load any websites
- Network icon shows disconnected

**Solutions**:
1. Check your Wi-Fi or ethernet connection
2. Restart your router/modem
3. Contact your ISP if the issue persists

### Symptom: Slow or unstable connection

**Diagnosis**:
- Pages load slowly
- Connection drops intermittently
- High latency or packet loss

**Solutions**:
1. Move closer to your Wi-Fi router
2. Switch to a wired connection if possible
3. Close bandwidth-heavy applications
4. Check for network congestion
5. Contact your ISP about connection quality

### Symptom: Connection works but AccessAgents doesn't load

**Diagnosis**:
- Other websites work fine
- AccessAgents shows loading indefinitely

**Solutions**:
1. Clear your browser cache
2. Try incognito/private browsing mode
3. Check if AccessAgents is blocked by your network
4. Verify the AccessAgents URL is correct

## WebSocket Connection Issues

AccessAgents uses WebSocket connections for real-time updates during scans.

### Symptom: "Connection lost" during scans

**Cause**: WebSocket connection was interrupted.

**Solutions**:
1. Check your internet stability
2. Disable browser extensions that might block WebSockets
3. Check if your firewall blocks WebSocket connections
4. Try a different network (mobile hotspot as a test)

### Symptom: Progress not updating

**Cause**: WebSocket messages aren't being received.

**Solutions**:
1. Refresh the page to re-establish the connection
2. Check browser console for WebSocket errors
3. Verify WebSocket connections aren't blocked

### Symptom: "Failed to establish connection"

**Cause**: Initial WebSocket connection couldn't be made.

**Solutions**:
1. Check if port 443 (HTTPS) is open
2. Verify your firewall allows WebSocket upgrades
3. Disable proxy servers temporarily
4. Try from a different network

## Firewall and Proxy Issues

### Corporate Firewall Blocking

**Symptoms**:
- Works on home network but not at work
- Specific features don't work
- Timeout errors

**Solutions**:
1. Contact your IT department to whitelist AccessAgents
2. Request WebSocket connections be allowed
3. Ask about proxy configuration requirements

**Information for IT**:
```
AccessAgents requires:
- HTTPS (port 443) access to the application domain
- WebSocket connections (wss://) for real-time updates
- No content inspection that breaks WebSocket upgrades
```

### Proxy Server Configuration

**Symptoms**:
- Connection timeouts
- Authentication prompts
- Partial functionality

**Solutions**:
1. Configure your browser to use the proxy correctly
2. Add AccessAgents to the proxy bypass list
3. Ensure the proxy supports WebSocket connections

### VPN Interference

**Symptoms**:
- Works without VPN, fails with VPN
- Slow connections through VPN
- WebSocket failures

**Solutions**:
1. Try split tunneling (exclude AccessAgents from VPN)
2. Use a different VPN server
3. Temporarily disconnect VPN for scanning
4. Contact your VPN provider about WebSocket support

## Browser-Specific Issues

### Chrome

**Common issues**:
- Extensions blocking connections
- Cached data causing problems

**Solutions**:
1. Disable extensions one by one to find the culprit
2. Clear cache: Settings → Privacy → Clear browsing data
3. Try incognito mode (disables extensions)

### Firefox

**Common issues**:
- Enhanced Tracking Protection blocking connections
- WebSocket settings

**Solutions**:
1. Add AccessAgents to ETP exceptions
2. Check `about:config` for WebSocket settings
3. Reset Firefox if issues persist

### Safari

**Common issues**:
- Intelligent Tracking Prevention
- WebSocket limitations

**Solutions**:
1. Disable "Prevent cross-site tracking" temporarily
2. Clear website data for AccessAgents
3. Try a different browser if issues persist

### Edge

**Common issues**:
- Similar to Chrome (same engine)
- Microsoft Defender SmartScreen

**Solutions**:
1. Follow Chrome troubleshooting steps
2. Check SmartScreen isn't blocking the site

## DNS Issues

### Symptom: "Server not found" or DNS errors

**Cause**: DNS resolution is failing.

**Solutions**:
1. Try accessing by IP address (if known)
2. Flush DNS cache:
   - Windows: `ipconfig /flushdns`
   - macOS: `sudo dscacheutil -flushcache`
   - Linux: `sudo systemd-resolve --flush-caches`
3. Try alternative DNS servers (8.8.8.8, 1.1.1.1)
4. Check your DNS settings

## SSL/TLS Issues

### Symptom: Certificate errors

**Cause**: SSL certificate problems.

**Solutions**:
1. Check your system date/time is correct
2. Update your browser
3. Clear SSL state in browser settings
4. For self-hosted: verify certificate is properly installed

### Symptom: "Connection not secure" warning

**Cause**: Certificate validation failed.

**Solutions**:
1. Don't proceed if you see this on the production site
2. For self-hosted: ensure valid SSL certificate
3. Check for man-in-the-middle proxies

## Server-Side Issues

### Symptom: 502 Bad Gateway or 503 Service Unavailable

**Cause**: Server is temporarily unavailable.

**Solutions**:
1. Wait a few minutes and try again
2. Check the status page (if available)
3. Contact support if the issue persists

### Symptom: Slow response times

**Cause**: Server under heavy load.

**Solutions**:
1. Try during off-peak hours
2. Reduce concurrent operations
3. Contact support about performance issues

## Diagnostic Steps

### Check WebSocket Connection

Open browser developer tools (F12) and check:

1. **Network tab**: Look for WebSocket connections (filter by "WS")
2. **Console tab**: Look for connection error messages
3. **Status**: Should show "101 Switching Protocols" for successful WebSocket

### Test Network Connectivity

```bash
# Test basic connectivity
ping accessagents.example.com

# Test HTTPS
curl -I https://accessagents.example.com

# Test WebSocket (requires wscat)
wscat -c wss://accessagents.example.com/ws
```

### Browser Console Errors

Common error messages and meanings:

| Error | Meaning |
|-------|---------|
| `WebSocket connection failed` | Can't establish WebSocket |
| `net::ERR_CONNECTION_REFUSED` | Server not accepting connections |
| `net::ERR_CONNECTION_TIMED_OUT` | Connection attempt timed out |
| `net::ERR_NAME_NOT_RESOLVED` | DNS lookup failed |
| `net::ERR_SSL_PROTOCOL_ERROR` | SSL/TLS handshake failed |

## When to Contact Support

Contact support if:
- Issues persist after trying all solutions
- You see server-side errors (5xx)
- The problem affects multiple users
- You need firewall/proxy configuration help

Provide:
- Error messages (screenshots help)
- Browser and version
- Network environment (corporate, home, VPN)
- Steps to reproduce
- Time the issue occurred
