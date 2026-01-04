# Feature Specification: Report Generation

## Overview

Report Generation provides comprehensive accessibility audit reports after each scan, including violation details, applied fixes, and actionable recommendations for manual remediation.

## User Story

As a developer or accessibility specialist, I want to view detailed reports of accessibility scans so that I can understand what was fixed, what needs manual attention, and how to improve my website's accessibility.

## Feature Description

### Capabilities

1. **Summary Statistics**: Overview of total violations, fixes, and skipped items
2. **Violation Details**: Full information for each detected violation
3. **Fix Documentation**: Before/after HTML comparisons for applied fixes
4. **Skip Reasons**: Explanations for violations that couldn't be auto-fixed
5. **Human Review Items**: Complex cases flagged for manual attention
6. **Export Options**: Download reports in JSON or HTML format

### Report Sections

| Section | Description |
|---------|-------------|
| Summary | Counts by category (total, fixed, skipped, human review) |
| Violations | All detected violations with impact levels |
| Applied Fixes | Successfully remediated violations with code diffs |
| Skipped | Violations that couldn't be auto-fixed |
| Human Review | Complex cases requiring manual intervention |

## User Workflow

### Step 1: Access Report

After a scan completes, users are automatically redirected to the report page. Reports can also be accessed from:
- Scan history list
- Direct URL: `/report/:sessionId`

### Step 2: Review Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Accessibility Report                      │
├─────────────────────────────────────────────────────────────┤
│  URL: https://example.com                                    │
│  Scanned: January 1, 2025 at 10:30 AM                       │
│  Duration: 45 seconds                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │    12    │  │     8    │  │     3    │  │     1    │    │
│  │  Total   │  │  Fixed   │  │ Skipped  │  │  Review  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The summary cards show:
- **Total Violations**: All WCAG violations detected
- **Fixed**: Violations successfully remediated by AI
- **Skipped**: Violations that couldn't be auto-fixed
- **Human Review**: Complex cases needing manual attention

### Step 3: Explore Violations

```
┌─────────────────────────────────────────────────────────────┐
│  Violations by Impact                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🔴 Critical (2)                                             │
│  ├── image-alt: Images must have alternate text              │
│  └── button-name: Buttons must have discernible text         │
│                                                              │
│  🟠 Serious (5)                                              │
│  ├── color-contrast: Elements must have sufficient contrast  │
│  ├── link-name: Links must have discernible text (x3)        │
│  └── label: Form elements must have labels                   │
│                                                              │
│  🟡 Moderate (3)                                             │
│  └── landmark-one-main: Page should contain one main landmark│
│                                                              │
│  🔵 Minor (2)                                                │
│  └── region: All content should be contained in landmarks    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Violations are grouped by impact level:
- **Critical**: Blocks access for users with disabilities
- **Serious**: Significantly impacts accessibility
- **Moderate**: Causes some difficulty for users
- **Minor**: Minor inconvenience

### Step 4: View Fix Details

```
┌─────────────────────────────────────────────────────────────┐
│  Applied Fix: image-alt                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Rule: Images must have alternate text                       │
│  Impact: Critical                                            │
│  Selector: img.hero-image                                    │
│                                                              │
│  Before:                                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ <img src="hero.jpg" class="hero-image">             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  After:                                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ <img src="hero.jpg" class="hero-image"              │    │
│  │      alt="Team collaboration in modern office">     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Reasoning: Added descriptive alt text based on image        │
│  context and surrounding content.                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Each fix shows:
- Rule ID and description
- Impact level
- CSS selector for the element
- Before/after HTML comparison
- AI reasoning for the fix

### Step 5: Export Report

```
┌─────────────────────────────────────────────────────────────┐
│  Export Options                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  📄 JSON        │  │  🌐 HTML        │                   │
│  │  Download       │  │  Download       │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Export formats:
- **JSON**: Machine-readable format for CI/CD integration
- **HTML**: Human-readable standalone report

## Technical Details

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/reports/:sessionId` | GET | Get full report |
| `/reports/:sessionId/export` | GET | Export report (format query param) |

### Report Response Format

```json
{
  "sessionId": "uuid",
  "url": "https://example.com",
  "viewport": "desktop",
  "timestamp": "2025-01-01T10:30:00Z",
  "duration": 45000,
  "pageScreenshot": "base64...",
  "summary": {
    "totalViolations": 12,
    "fixedCount": 8,
    "skippedCount": 3,
    "humanReviewCount": 1
  },
  "violations": [
    {
      "id": "uuid",
      "ruleId": "image-alt",
      "impact": "critical",
      "description": "Images must have alternate text",
      "selector": "img.hero-image",
      "html": "<img src=\"hero.jpg\">",
      "status": "fixed",
      "screenshot": "base64...",
      "fix": {
        "type": "attribute",
        "beforeHtml": "<img src=\"hero.jpg\">",
        "afterHtml": "<img src=\"hero.jpg\" alt=\"...\">",
        "reasoning": "Added descriptive alt text..."
      }
    }
  ],
  "fixes": [...],
  "skipped": [...],
  "humanReview": [...]
}
```

### Export Query Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `format` | `json`, `html` | Export format |

### Export Response

- **JSON**: `application/json` with full report data
- **HTML**: `text/html` standalone document with embedded styles

## Report Data Model

### Violation Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique violation ID |
| `ruleId` | string | axe-core rule identifier |
| `impact` | enum | critical, serious, moderate, minor |
| `description` | string | Human-readable description |
| `selector` | string | CSS selector for element |
| `html` | string | Original HTML snippet |
| `status` | enum | pending, processing, fixed, skipped |
| `skipReason` | string | Why violation was skipped (if applicable) |
| `screenshot` | string | Base64 element screenshot |
| `fix` | object | Fix details (if applied) |

### Fix Object

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | attribute, content, style |
| `beforeHtml` | string | Original HTML |
| `afterHtml` | string | Fixed HTML |
| `reasoning` | string | AI explanation for fix |

### Skip Reasons

| Reason | Description |
|--------|-------------|
| `complex_structure` | Element structure too complex for auto-fix |
| `requires_content` | Needs human-written content |
| `interactive_element` | Would break functionality |
| `max_retries` | Failed after 3 fix attempts |
| `unsupported_rule` | Rule not supported for auto-fix |

## Accessibility Features

The report interface itself is fully accessible:
- Semantic HTML structure with proper headings
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader announcements for dynamic content
- High contrast color scheme
- Responsive design for all viewports

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Report not found | "Report not found" | Check session ID |
| Export failed | "Export failed" | Retry download |
| Session expired | "Session expired" | Re-authenticate |

## Related Features

- [Single Page Scanning](./single_page_scanning.md) - Initiate scans
- [Sitemap Scanning](./sitemap_scanning.md) - Batch reports (planned)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01 | Initial release |
| 1.1 | 2024-03 | Added HTML export |
| 1.2 | 2024-06 | Added violation screenshots |
| 1.3 | 2024-09 | Added human review section |
