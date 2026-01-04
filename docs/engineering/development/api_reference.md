# API Reference

This document describes the REST and WebSocket APIs for AccessAgents.

## Overview

The AccessAgents API consists of two components:

- **REST API**: Standard HTTP endpoints for CRUD operations
- **WebSocket API**: Real-time updates for scan progress

### Base URLs

**Local Development:**
```
REST:      http://localhost:3003/api
WebSocket: ws://localhost:3003/ws
```

**Production (AWS):**
```
REST:      https://{api-id}.execute-api.{region}.amazonaws.com/prod
WebSocket: wss://{api-id}.execute-api.{region}.amazonaws.com/prod
```

## Authentication

### Self-Hosted Mode

In self-hosted mode, authentication uses JWT tokens. Obtain a token via the login endpoint:

```bash
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

Include the token in subsequent requests:
```
Authorization: Bearer {jwt-token}
```

### SaaS Mode

In SaaS mode, authentication uses Amazon Cognito. Tokens are obtained from Cognito and expire after 1 hour.

```
Authorization: Bearer {cognito-access-token}
```

## REST API Endpoints

### Health Check

Returns the API health status. No authentication required.

```
GET /api/health
```

**Response (200 OK)**

```json
{
  "status": "healthy",
  "environment": "development",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Authentication Endpoints

#### Login

Authenticates a user and returns a JWT token. In development mode, users are automatically created if they don't exist.

```
POST /api/auth/login
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |
| password | string | Yes | User password |

**Example Request**

```json
{
  "email": "developer@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK)**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "developer@example.com",
    "authProvider": "local"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 400 | VALIDATION_ERROR | Email or password missing |
| 401 | UNAUTHORIZED | Invalid credentials |
| 500 | INTERNAL_ERROR | Server error |

---

#### Get Current User

Returns the authenticated user's information.

```
GET /api/auth/me
```

**Headers**
```
Authorization: Bearer {token}
```

**Response (200 OK)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "developer@example.com",
  "authProvider": "local"
}
```

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 401 | UNAUTHORIZED | Missing or invalid token |

---

#### Logout

Logs out the current user. In self-hosted mode, this is a no-op as JWT tokens are stateless.

```
POST /api/auth/logout
```

**Response (204 No Content)**

No response body.

---

### Scan Endpoints

#### Start Scan

Initiates a new accessibility scan workflow.

```
POST /api/scans
```

**Headers**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| url | string | Yes | - | Target URL to scan (must be valid URL) |
| viewport | string | No | desktop | Device viewport: `mobile` or `desktop` |

**Example Request**

```json
{
  "url": "https://example.com",
  "viewport": "desktop"
}
```

**Response (201 Created)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "url": "https://example.com",
  "viewport": "desktop",
  "status": "scanning",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 400 | VALIDATION_ERROR | URL is required or invalid format |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 500 | INTERNAL_ERROR | Failed to start scan |

---

#### Get Scan Status

Retrieves the current status of a scan session with violation summary.

```
GET /api/scans/{sessionId}
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | UUID | Scan session identifier |

**Response (200 OK)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "url": "https://example.com",
  "viewport": "desktop",
  "status": "complete",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z",
  "completedAt": "2024-01-15T10:35:00.000Z",
  "summary": {
    "totalViolations": 15,
    "criticalCount": 2,
    "seriousCount": 5,
    "moderateCount": 6,
    "minorCount": 2,
    "fixedCount": 13,
    "skippedCount": 2,
    "pendingCount": 0
  }
}
```

**Status Values**

| Status | Description |
|--------|-------------|
| pending | Scan queued, not yet started |
| scanning | Actively scanning for violations |
| remediating | AI agents fixing violations |
| complete | Scan finished successfully |
| error | Scan failed with error |

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 401 | UNAUTHORIZED | Missing or invalid token |
| 404 | NOT_FOUND | Session not found or not owned by user |
| 500 | INTERNAL_ERROR | Failed to get scan |

---

#### Get Scan Violations

Retrieves all violations for a scan session, ordered by impact severity.

```
GET /api/scans/{sessionId}/violations
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | UUID | Scan session identifier |

**Response (200 OK)**

```json
{
  "violations": [
    {
      "id": "violation-uuid",
      "ruleId": "image-alt",
      "impact": "critical",
      "description": "Images must have alternative text",
      "selector": "img.hero-image",
      "html": "<img src=\"hero.jpg\" class=\"hero-image\">",
      "status": "fixed",
      "skipReason": null,
      "createdAt": "2024-01-15T10:31:00.000Z"
    },
    {
      "id": "violation-uuid-2",
      "ruleId": "color-contrast",
      "impact": "serious",
      "description": "Elements must have sufficient color contrast",
      "selector": ".btn-primary",
      "html": "<button class=\"btn-primary\">Submit</button>",
      "status": "skipped",
      "skipReason": "Requires design review",
      "createdAt": "2024-01-15T10:31:05.000Z"
    }
  ]
}
```

**Violation Impact Levels**

| Impact | Description |
|--------|-------------|
| critical | Blocks access for users with disabilities |
| serious | Significantly impacts accessibility |
| moderate | Causes some difficulty |
| minor | Minor inconvenience |

**Violation Status Values**

| Status | Description |
|--------|-------------|
| pending | Not yet processed |
| processing | Currently being fixed |
| fixed | Successfully remediated |
| skipped | Skipped (requires human review) |

---

### Session Endpoints

#### List Sessions

Retrieves a paginated list of scan sessions for the authenticated user.

```
GET /api/sessions
```

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | integer | 20 | Max results per page (1-100) |
| offset | integer | 0 | Number of results to skip |
| status | string | - | Filter by status |

**Example Request**

```
GET /api/sessions?limit=10&offset=0&status=complete
```

**Response (200 OK)**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://example.com",
      "viewport": "desktop",
      "status": "complete",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "completedAt": "2024-01-15T10:35:00.000Z",
      "summary": {
        "totalViolations": 15,
        "fixedCount": 13,
        "skippedCount": 2
      }
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

#### Delete Session

Deletes a scan session and all associated data (violations, fixes).

```
DELETE /api/sessions/{sessionId}
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | UUID | Scan session identifier |

**Response (204 No Content)**

No response body.

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 401 | UNAUTHORIZED | Missing or invalid token |
| 404 | NOT_FOUND | Session not found or not owned by user |
| 500 | INTERNAL_ERROR | Failed to delete session |

---

### Report Endpoints

#### Get Report

Retrieves the detailed accessibility report for a completed scan session.

```
GET /api/reports/{sessionId}
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | UUID | Scan session identifier |

**Response (200 OK)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com",
  "viewport": "desktop",
  "status": "complete",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "completedAt": "2024-01-15T10:35:00.000Z",
  "violations": [
    {
      "id": "violation-uuid",
      "ruleId": "image-alt",
      "impact": "critical",
      "description": "Images must have alternative text",
      "selector": "img.hero-image",
      "html": "<img src=\"hero.jpg\" class=\"hero-image\">",
      "status": "fixed",
      "fix": {
        "type": "attribute",
        "beforeHtml": "<img src=\"hero.jpg\" class=\"hero-image\">",
        "afterHtml": "<img src=\"hero.jpg\" class=\"hero-image\" alt=\"Hero banner showing product\">",
        "reasoning": "Added descriptive alt text based on image context"
      }
    }
  ],
  "summary": {
    "totalViolations": 15,
    "fixedCount": 13,
    "skippedCount": 2
  }
}
```

**Fix Types**

| Type | Description |
|------|-------------|
| attribute | Modified HTML attribute (e.g., added alt text) |
| content | Changed text content |
| style | Modified CSS styles |

---

#### Export Report

Exports the report in JSON or HTML format for download.

```
GET /api/reports/{sessionId}/export
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | UUID | Scan session identifier |

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| format | string | json | Export format: `json` or `html` |

**Example Requests**

```bash
# Export as JSON
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3003/api/reports/{sessionId}/export?format=json"

# Export as HTML
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3003/api/reports/{sessionId}/export?format=html"
```

**Response Headers**

```
Content-Type: application/json (or text/html)
Content-Disposition: attachment; filename="report-{sessionId}.json"
```

---

## WebSocket API

The WebSocket API provides real-time updates during scan execution.

### Connecting

**Local Development:**
```javascript
const ws = new WebSocket('ws://localhost:3003/ws');
```

**Production:**
```javascript
const ws = new WebSocket('wss://{api-id}.execute-api.{region}.amazonaws.com/prod');
```

### Subscribing to Sessions

After connecting, subscribe to receive updates for a specific scan session:

```javascript
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    sessionId: 'session-uuid-here'
  }));
};
```

**Subscription Confirmation**

```json
{
  "type": "subscribed",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Unsubscribing

```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  sessionId: 'session-uuid-here'
}));
```

### Event Types

#### Session Status Update

Sent when the scan status changes.

```json
{
  "type": "session:status",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "scanning",
  "timestamp": "2024-01-15T10:31:00.000Z"
}
```

#### Violation Detected

Sent when a new accessibility violation is found.

```json
{
  "type": "violation:detected",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "violation": {
    "id": "violation-uuid",
    "ruleId": "color-contrast",
    "impact": "serious",
    "selector": ".btn-primary",
    "description": "Elements must have sufficient color contrast"
  },
  "timestamp": "2024-01-15T10:32:00.000Z"
}
```

#### Violation Fixed

Sent when a violation is successfully remediated.

```json
{
  "type": "violation:fixed",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "violationId": "violation-uuid",
  "fix": {
    "type": "style",
    "reasoning": "Increased contrast ratio to 4.5:1"
  },
  "timestamp": "2024-01-15T10:33:00.000Z"
}
```

#### Violation Skipped

Sent when a violation is skipped (requires human review).

```json
{
  "type": "violation:skipped",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "violationId": "violation-uuid",
  "reason": "Requires human review - complex drag-drop interface",
  "timestamp": "2024-01-15T10:34:00.000Z"
}
```

#### Session Complete

Sent when the scan finishes.

```json
{
  "type": "session:complete",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "summary": {
    "totalViolations": 15,
    "fixedCount": 13,
    "skippedCount": 2
  },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

#### Error

Sent when an error occurs during scanning.

```json
{
  "type": "error",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Failed to load page: Connection timeout",
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

---

## Error Response Format

All error responses follow a consistent format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /api/scans | 10 per minute |
| GET endpoints | 50 per second |
| WebSocket connections | 100 per user |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704020400
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Login and start a scan
async function scanWebsite(url: string) {
  // Login
  const loginResponse = await fetch('http://localhost:3003/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'password' })
  });
  const { token } = await loginResponse.json();

  // Start scan
  const scanResponse = await fetch('http://localhost:3003/api/scans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ url, viewport: 'desktop' })
  });
  const session = await scanResponse.json();

  // Subscribe to WebSocket updates
  const ws = new WebSocket('ws://localhost:3003/ws');
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', sessionId: session.id }));
  };
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Event:', data.type, data);
  };

  return session;
}
```

### cURL

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}' \
  | jq -r '.token')

# Start a scan
curl -X POST http://localhost:3003/api/scans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "viewport": "desktop"}'

# Get scan status
curl http://localhost:3003/api/scans/{sessionId} \
  -H "Authorization: Bearer $TOKEN"

# List sessions
curl "http://localhost:3003/api/sessions?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Get report
curl http://localhost:3003/api/reports/{sessionId} \
  -H "Authorization: Bearer $TOKEN"

# Export report as JSON
curl -o report.json \
  "http://localhost:3003/api/reports/{sessionId}/export?format=json" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Batch Scanning API

The batch scanning API enables scanning multiple URLs from a sitemap in a single operation.

### Sitemap Endpoints

#### Parse Sitemap

Parses a sitemap URL and returns discovered URLs for batch scanning.

```
POST /api/sitemaps/parse
```

**Headers**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| sitemapUrl | string | Yes | - | URL of the sitemap to parse |
| maxUrls | integer | No | 1000 | Maximum URLs to return (max: 50000) |

**Example Request**

```json
{
  "sitemapUrl": "https://example.com/sitemap.xml",
  "maxUrls": 500
}
```

**Response (200 OK)**

```json
{
  "urls": [
    {
      "loc": "https://example.com/page1",
      "lastmod": "2024-01-15",
      "changefreq": "weekly",
      "priority": 0.8
    },
    {
      "loc": "https://example.com/page2",
      "lastmod": "2024-01-10"
    }
  ],
  "totalCount": 47,
  "truncated": false,
  "sitemapType": "standard",
  "parseTime": 1250,
  "errors": []
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| urls | array | Array of parsed URL objects |
| urls[].loc | string | Page URL |
| urls[].lastmod | string | Last modification date (optional) |
| urls[].changefreq | string | Change frequency hint (optional) |
| urls[].priority | number | Priority 0.0-1.0 (optional) |
| totalCount | integer | Total URLs found |
| truncated | boolean | Whether results were truncated due to maxUrls |
| sitemapType | string | `standard` or `index` (sitemap index) |
| parseTime | integer | Parse time in milliseconds |
| errors | array | Any non-fatal errors encountered |

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 400 | VALIDATION_ERROR | Invalid sitemap URL format |
| 400 | PARSE_ERROR | Failed to parse sitemap XML |
| 400 | EMPTY_SITEMAP | No URLs found in sitemap |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 500 | INTERNAL_ERROR | Server error |

---

### Batch Scan Endpoints

#### Create Batch Scan

Creates a new batch scan session and starts processing URLs.

```
POST /api/batch-scans
```

**Headers**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| urls | string[] | Yes | - | Array of URLs to scan |
| viewport | string | No | desktop | Device viewport: `mobile` or `desktop` |
| name | string | No | - | Optional name for the batch |
| sitemapUrl | string | No | - | Source sitemap URL (for reference) |

**Example Request**

```json
{
  "urls": [
    "https://example.com/",
    "https://example.com/about",
    "https://example.com/contact"
  ],
  "viewport": "desktop",
  "name": "Example.com Full Site Scan",
  "sitemapUrl": "https://example.com/sitemap.xml"
}
```

**Response (201 Created)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "orgId": "org-uuid",
  "name": "Example.com Full Site Scan",
  "status": "pending",
  "viewport": "desktop",
  "totalPages": 3,
  "completedPages": 0,
  "failedPages": 0,
  "totalViolations": 0,
  "sitemapUrl": "https://example.com/sitemap.xml",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 400 | VALIDATION_ERROR | URLs array is required or contains invalid URLs |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 500 | INTERNAL_ERROR | Failed to create batch |

---

#### Get Batch Scan Status

Retrieves the current status and progress of a batch scan.

```
GET /api/batch-scans/{batchId}
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| batchId | UUID | Batch scan session identifier |

**Response (200 OK)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "orgId": "org-uuid",
  "name": "Example.com Full Site Scan",
  "status": "running",
  "viewport": "desktop",
  "totalPages": 47,
  "completedPages": 12,
  "failedPages": 1,
  "totalViolations": 34,
  "sitemapUrl": "https://example.com/sitemap.xml",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z",
  "startedAt": "2024-01-15T10:30:05.000Z",
  "progress": {
    "completedPages": 12,
    "totalPages": 47,
    "failedPages": 1,
    "totalViolations": 34,
    "estimatedTimeRemaining": 1050
  }
}
```

**Batch Status Values**

| Status | Description |
|--------|-------------|
| pending | Batch created, not yet started |
| running | Actively scanning pages |
| paused | Scan paused by user |
| completed | All pages processed |
| cancelled | Scan cancelled by user |
| error | Batch failed with error |

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 400 | VALIDATION_ERROR | Batch ID required |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 404 | NOT_FOUND | Batch not found or not owned by user |

---

#### Pause Batch Scan

Pauses a running batch scan. Processing will stop after the current page completes.

```
POST /api/batch-scans/{batchId}/pause
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| batchId | UUID | Batch scan session identifier |

**Response (200 OK)**

```json
{
  "message": "Batch paused successfully"
}
```

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 400 | INVALID_OPERATION | Cannot pause batch with current status |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 404 | NOT_FOUND | Batch not found |

---

#### Resume Batch Scan

Resumes a paused batch scan from where it left off.

```
POST /api/batch-scans/{batchId}/resume
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| batchId | UUID | Batch scan session identifier |

**Response (200 OK)**

```json
{
  "message": "Batch resumed successfully"
}
```

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 400 | INVALID_OPERATION | Cannot resume batch with current status |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 404 | NOT_FOUND | Batch not found |

---

#### Cancel Batch Scan

Cancels a batch scan. Any pending pages will be marked as skipped.

```
POST /api/batch-scans/{batchId}/cancel
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| batchId | UUID | Batch scan session identifier |

**Response (200 OK)**

```json
{
  "message": "Batch cancelled successfully"
}
```

**Error Responses**

| Code | Error | Description |
|------|-------|-------------|
| 400 | INVALID_OPERATION | Cannot cancel batch with current status |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 404 | NOT_FOUND | Batch not found |

---

#### Get Batch Pages

Retrieves all pages in a batch scan with their individual status.

```
GET /api/batch-scans/{batchId}/pages
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| batchId | UUID | Batch scan session identifier |

**Response (200 OK)**

```json
{
  "pages": [
    {
      "id": "page-uuid-1",
      "batchId": "batch-uuid",
      "url": "https://example.com/",
      "status": "completed",
      "scanSessionId": "session-uuid-1",
      "violationCount": 5,
      "startedAt": "2024-01-15T10:30:05.000Z",
      "completedAt": "2024-01-15T10:30:35.000Z"
    },
    {
      "id": "page-uuid-2",
      "batchId": "batch-uuid",
      "url": "https://example.com/about",
      "status": "failed",
      "violationCount": 0,
      "errorMessage": "Connection timeout",
      "startedAt": "2024-01-15T10:30:37.000Z",
      "completedAt": "2024-01-15T10:31:07.000Z"
    },
    {
      "id": "page-uuid-3",
      "batchId": "batch-uuid",
      "url": "https://example.com/contact",
      "status": "pending",
      "violationCount": 0
    }
  ]
}
```

**Page Status Values**

| Status | Description |
|--------|-------------|
| pending | Not yet processed |
| running | Currently being scanned |
| completed | Successfully scanned |
| failed | Scan failed after retries |
| skipped | Skipped (batch cancelled) |

---

#### Get Batch Report

Retrieves the comprehensive accessibility report for a batch scan.

```
GET /api/batch-scans/{batchId}/report
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| batchId | UUID | Batch scan session identifier |

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| format | string | json | Export format: `json`, `json-download`, or `html` |

**Response (200 OK) - JSON Format**

```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Example.com Full Site Scan",
  "sitemapUrl": "https://example.com/sitemap.xml",
  "viewport": "desktop",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "completedAt": "2024-01-15T11:15:00.000Z",
  "duration": 2700,
  "summary": {
    "totalPages": 47,
    "successfulPages": 45,
    "failedPages": 2,
    "totalViolations": 156
  },
  "violationsByImpact": {
    "critical": 12,
    "serious": 45,
    "moderate": 67,
    "minor": 32
  },
  "violationsByRule": [
    {
      "ruleId": "color-contrast",
      "description": "Elements must have sufficient color contrast",
      "count": 45,
      "impact": "serious"
    },
    {
      "ruleId": "image-alt",
      "description": "Images must have alternative text",
      "count": 23,
      "impact": "critical"
    }
  ],
  "pages": [
    {
      "url": "https://example.com/",
      "status": "completed",
      "violationCount": 5,
      "scanSessionId": "session-uuid-1"
    },
    {
      "url": "https://example.com/about",
      "status": "failed",
      "violationCount": 0,
      "errorMessage": "Connection timeout"
    }
  ],
  "recommendations": [
    {
      "priority": 450,
      "ruleId": "color-contrast",
      "description": "Elements must have sufficient color contrast",
      "affectedPages": 35,
      "count": 45,
      "suggestedAction": "Increase the contrast ratio between text and background colors to meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)."
    },
    {
      "priority": 280,
      "ruleId": "image-alt",
      "description": "Images must have alternative text",
      "affectedPages": 20,
      "count": 23,
      "suggestedAction": "Add descriptive alt text to all images that convey information. Use empty alt=\"\" for decorative images."
    }
  ]
}
```

**Export Formats**

| Format | Content-Type | Description |
|--------|--------------|-------------|
| json | application/json | JSON response (default) |
| json-download | application/json | JSON file download |
| html | text/html | Styled HTML report download |

**Example Export Requests**

```bash
# Get JSON report
curl http://localhost:3003/api/batch-scans/{batchId}/report \
  -H "Authorization: Bearer $TOKEN"

# Download JSON file
curl -o report.json \
  "http://localhost:3003/api/batch-scans/{batchId}/report?format=json-download" \
  -H "Authorization: Bearer $TOKEN"

# Download HTML report
curl -o report.html \
  "http://localhost:3003/api/batch-scans/{batchId}/report?format=html" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Batch WebSocket Events

The WebSocket API provides real-time updates during batch scan execution.

### Subscribing to Batch Updates

After connecting, subscribe to receive updates for a specific batch scan:

```javascript
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe:batch',
    batchId: 'batch-uuid-here'
  }));
};
```

### Batch Event Types

#### Batch Started

Sent when a batch scan begins processing.

```json
{
  "type": "batch:started",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "totalPages": 47,
  "timestamp": "2024-01-15T10:30:05.000Z"
}
```

#### Page Started

Sent when scanning begins for a specific page.

```json
{
  "type": "batch:page_started",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "pageUrl": "https://example.com/about",
  "pageIndex": 5,
  "timestamp": "2024-01-15T10:32:00.000Z"
}
```

#### Page Complete

Sent when a page scan completes successfully.

```json
{
  "type": "batch:page_complete",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "pageUrl": "https://example.com/about",
  "violations": 3,
  "progress": {
    "completedPages": 6,
    "totalPages": 47,
    "failedPages": 0,
    "totalViolations": 18,
    "estimatedTimeRemaining": 1230
  },
  "timestamp": "2024-01-15T10:32:30.000Z"
}
```

#### Page Failed

Sent when a page scan fails after all retry attempts.

```json
{
  "type": "batch:page_failed",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "pageUrl": "https://example.com/broken-page",
  "error": "Connection timeout",
  "timestamp": "2024-01-15T10:33:00.000Z"
}
```

#### Batch Paused

Sent when a batch scan is paused.

```json
{
  "type": "batch:paused",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

#### Batch Resumed

Sent when a paused batch scan is resumed.

```json
{
  "type": "batch:resumed",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:40:00.000Z"
}
```

#### Batch Completed

Sent when all pages in a batch have been processed.

```json
{
  "type": "batch:completed",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "summary": {
    "totalPages": 47,
    "successfulPages": 45,
    "failedPages": 2,
    "totalViolations": 156,
    "violationsByImpact": {
      "critical": 12,
      "serious": 45,
      "moderate": 67,
      "minor": 32
    },
    "violationsByRule": {
      "color-contrast": 45,
      "image-alt": 23
    },
    "mostCommonViolations": [
      {
        "ruleId": "color-contrast",
        "description": "Elements must have sufficient color contrast",
        "count": 45,
        "impact": "serious",
        "affectedPages": 35
      }
    ]
  },
  "timestamp": "2024-01-15T11:15:00.000Z"
}
```

#### Batch Cancelled

Sent when a batch scan is cancelled by the user.

```json
{
  "type": "batch:cancelled",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:45:00.000Z"
}
```

#### Batch Error

Sent when a batch scan encounters a fatal error.

```json
{
  "type": "batch:error",
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Database connection lost",
  "timestamp": "2024-01-15T10:50:00.000Z"
}
```

---

## Batch Scanning Code Examples

### JavaScript/TypeScript - Full Batch Scan Flow

```typescript
// Parse sitemap and start batch scan
async function batchScanWebsite(sitemapUrl: string, token: string) {
  const baseUrl = 'http://localhost:3003/api';

  // Step 1: Parse sitemap
  const parseResponse = await fetch(`${baseUrl}/sitemaps/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ sitemapUrl, maxUrls: 100 })
  });
  const { urls } = await parseResponse.json();
  console.log(`Found ${urls.length} URLs in sitemap`);

  // Step 2: Create batch scan
  const batchResponse = await fetch(`${baseUrl}/batch-scans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      urls: urls.map((u: { loc: string }) => u.loc),
      viewport: 'desktop',
      name: 'My Site Scan',
      sitemapUrl
    })
  });
  const batch = await batchResponse.json();
  console.log(`Created batch: ${batch.id}`);

  // Step 3: Subscribe to WebSocket updates
  const ws = new WebSocket('ws://localhost:3003/ws');
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe:batch', batchId: batch.id }));
  };
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'batch:page_complete':
        console.log(`Page ${data.progress.completedPages}/${data.progress.totalPages}: ${data.pageUrl} (${data.violations} violations)`);
        break;
      case 'batch:page_failed':
        console.log(`Failed: ${data.pageUrl} - ${data.error}`);
        break;
      case 'batch:completed':
        console.log(`Batch complete! Total violations: ${data.summary.totalViolations}`);
        ws.close();
        break;
    }
  };

  return batch;
}
```

### cURL - Batch Scan Commands

```bash
# Parse sitemap
curl -X POST http://localhost:3003/api/sitemaps/parse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sitemapUrl": "https://example.com/sitemap.xml", "maxUrls": 50}'

# Create batch scan
curl -X POST http://localhost:3003/api/batch-scans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com/", "https://example.com/about"],
    "viewport": "desktop",
    "name": "Quick Scan"
  }'

# Get batch status
curl http://localhost:3003/api/batch-scans/{batchId} \
  -H "Authorization: Bearer $TOKEN"

# Pause batch
curl -X POST http://localhost:3003/api/batch-scans/{batchId}/pause \
  -H "Authorization: Bearer $TOKEN"

# Resume batch
curl -X POST http://localhost:3003/api/batch-scans/{batchId}/resume \
  -H "Authorization: Bearer $TOKEN"

# Cancel batch
curl -X POST http://localhost:3003/api/batch-scans/{batchId}/cancel \
  -H "Authorization: Bearer $TOKEN"

# Get batch pages
curl http://localhost:3003/api/batch-scans/{batchId}/pages \
  -H "Authorization: Bearer $TOKEN"

# Get batch report
curl http://localhost:3003/api/batch-scans/{batchId}/report \
  -H "Authorization: Bearer $TOKEN"

# Download HTML report
curl -o report.html \
  "http://localhost:3003/api/batch-scans/{batchId}/report?format=html" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Related Documentation

- [Local Development Setup](./local_setup.md)
- [Authentication Architecture](./authentication_architecture.md)
- [Database Schema](../requirements/database_schema.md)
- [Infrastructure Overview](../deployment/infrastructure_overview.md)
- [Sitemap Scanning Feature](../../product/feature-specifications/sitemap_scanning.md)
