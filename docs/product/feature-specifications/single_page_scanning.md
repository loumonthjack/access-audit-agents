# Feature Specification: Single Page Scanning

## Overview

Single Page Scanning is the core feature of AccessAgents that allows users to scan individual web pages for WCAG 2.2 accessibility violations and receive AI-powered remediation suggestions.

## User Story

As a developer or QA engineer, I want to scan a single web page for accessibility issues so that I can identify and fix WCAG violations before they reach production.

## Feature Description

### Capabilities

1. **URL Input**: Enter any publicly accessible URL to scan
2. **Viewport Selection**: Choose between desktop (1280x720) or mobile (375x667) viewport
3. **Real-time Progress**: View scanning progress via WebSocket updates
4. **Violation Detection**: Identify WCAG 2.2 AA violations using axe-core
5. **AI Remediation**: Automatic fix generation for common violation types
6. **Results Display**: View violations categorized by impact level

### Supported Violation Types

The scanner detects and can remediate the following violation categories:

| Category | Example Rules | Auto-Fix Support |
|----------|---------------|------------------|
| Images | image-alt, image-redundant-alt | ✅ Full |
| Navigation | landmark-*, region, bypass | ✅ Full |
| Color | color-contrast, link-in-text-block | ✅ Full |
| Focus | focus-visible, focus-order-semantics | ✅ Full |
| Interactive | button-name, link-name, input-label | ✅ Full |
| WCAG 2.2 | target-size, dragging | ⚠️ Partial |

## User Workflow

### Step 1: Initiate Scan

```
┌─────────────────────────────────────────────────────────────┐
│                    AccessAgents                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Website URL                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ https://example.com                              ✓  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Viewport                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Desktop                                          ▼  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              🔍 Start Scan                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

1. Navigate to the home page
2. Enter the URL to scan in the input field
3. Select viewport mode (Desktop or Mobile)
4. Click "Start Scan" button

### Step 2: View Progress

```
┌─────────────────────────────────────────────────────────────┐
│                    Scanning in Progress                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  URL: https://example.com                                    │
│  Status: Scanning...                                         │
│                                                              │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  35%              │
│                                                              │
│  Current Phase: Detecting violations                         │
│                                                              │
│  Violations Found: 12                                        │
│  ├── Critical: 2                                             │
│  ├── Serious: 5                                              │
│  ├── Moderate: 3                                             │
│  └── Minor: 2                                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The scan progresses through these phases:
1. **Pending**: Scan queued for processing
2. **Scanning**: axe-core analyzing the page
3. **Remediating**: AI agents applying fixes
4. **Complete**: All violations processed

### Step 3: Review Results

Once complete, users are redirected to the report page showing:
- Summary statistics (total, fixed, skipped, human review)
- Violations grouped by impact level
- Before/after HTML for each fix
- Skip reasons for unfixable violations

## Technical Details

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scans` | POST | Start a new scan |
| `/scans/:sessionId` | GET | Get scan status |
| `/scans/:sessionId/violations` | GET | Get violation details |

### Request Format

```json
POST /scans
{
  "url": "https://example.com",
  "viewport": "desktop"
}
```

### Response Format

```json
{
  "id": "uuid",
  "url": "https://example.com",
  "viewport": "desktop",
  "status": "pending",
  "createdAt": "2025-01-01T00:00:00Z",
  "violationCounts": {
    "total": 0,
    "critical": 0,
    "serious": 0,
    "moderate": 0,
    "minor": 0
  },
  "fixCounts": {
    "fixed": 0,
    "skipped": 0,
    "pending": 0
  }
}
```

### WebSocket Events

| Event | Description |
|-------|-------------|
| `scan:started` | Scan has begun |
| `scan:progress` | Progress update with violation counts |
| `scan:violation_found` | New violation detected |
| `scan:fix_applied` | Fix successfully applied |
| `scan:fix_skipped` | Violation skipped (unfixable) |
| `scan:completed` | Scan finished |
| `scan:error` | Error occurred |

## Validation Rules

### URL Validation
- Must be a valid URL format
- Must use HTTP or HTTPS protocol
- Must be publicly accessible (no authentication required)
- Maximum length: 2048 characters

### Viewport Options
- `desktop`: 1280x720 pixels
- `mobile`: 375x667 pixels (iPhone SE)

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Invalid URL | "Please enter a valid URL" | Correct URL format |
| Page not found | "The page could not be loaded" | Verify URL is accessible |
| Timeout | "Scan timed out" | Retry or try simpler page |
| Network error | "Connection failed" | Check network and retry |

## Limitations

1. **Authentication**: Cannot scan pages requiring login
2. **JavaScript**: Heavy SPA pages may have incomplete scans
3. **Rate Limiting**: Maximum 10 concurrent scans per user
4. **Page Size**: Pages over 10MB may timeout
5. **Dynamic Content**: Content loaded after initial render may be missed

## Related Features

- [Report Generation](./report_generation.md) - View detailed scan results
- [Sitemap Scanning](./sitemap_scanning.md) - Scan multiple pages (planned)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01 | Initial release |
| 1.1 | 2024-06 | Added mobile viewport support |
| 1.2 | 2024-09 | WebSocket progress updates |
